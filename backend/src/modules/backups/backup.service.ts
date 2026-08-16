import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as os from 'os';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private s3: S3Client;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${this.configService.get('CLOUDFLARE_R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.get('CLOUDFLARE_R2_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  // ── CREATE BACKUP ──────────────────────────────────────

  async createBackup(slug: string, type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'MANUAL') {
    this.logger.log(`Starting ${type} backup for: ${slug}`);

    // Find company
    const company = await this.prisma.company.findUnique({ where: { slug } });
    if (!company) throw new Error(`Company not found: ${slug}`);

    // Create pending log
    const backupLog = await this.prisma.backupLog.create({
      data: {
        companyId: company.id,
        type,
        status: 'PENDING',
      },
    });

    try {
      const dbUrl = this.configService.get<string>('DATABASE_URL') || '';
      const schemaName = `tenant_${slug}`;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `backup-${slug}-${type.toLowerCase()}-${timestamp}`
      const tmpDir = os.tmpdir()
      const sqlFile = path.join(tmpDir, `${filename}.sql`)
      const gzFile = path.join(tmpDir, `${filename}.sql.gz`)

      // ── pg_dump ────────────────────────────────────────
      // Extract connection info from DATABASE_URL
      const urlObj = new URL(dbUrl.replace('postgresql://', 'http://'))
      const pgUser = urlObj.username
      const pgPassword = urlObj.password
      const pgHost = urlObj.hostname
      const pgPort = urlObj.port || '5432'
      const pgDb = urlObj.pathname.replace('/', '').split('?')[0]

      const pgDumpCmd = `pg_dump -h ${pgHost} -p ${pgPort} -U ${pgUser} -d ${pgDb} -n "${schemaName}" --no-owner --no-acl -f "${sqlFile}"`

      await execAsync(pgDumpCmd, {
        env: { ...process.env, PGPASSWORD: pgPassword },
      })

      this.logger.log(`✅ pg_dump completed for ${slug}`)

      // ── Gzip ──────────────────────────────────────────
      await new Promise<void>((resolve, reject) => {
        const input = fs.createReadStream(sqlFile)
        const output = fs.createWriteStream(gzFile)
        const gzip = zlib.createGzip({ level: 9 })
        input.pipe(gzip).pipe(output)
        output.on('finish', resolve)
        output.on('error', reject)
      })

      this.logger.log(`✅ Compressed backup for ${slug}`)

      // ── Upload to R2 ───────────────────────────────────
      const fileBuffer = fs.readFileSync(gzFile)
      const fileSizeMb = parseFloat((fileBuffer.length / (1024 * 1024)).toFixed(2))
      const s3Key = `backups/${slug}/${type.toLowerCase()}/${filename}.sql.gz`

      await this.s3.send(new PutObjectCommand({
        Bucket: this.configService.get('CLOUDFLARE_R2_BUCKET_NAME'),
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'application/gzip',
        Metadata: {
          slug,
          type,
          createdAt: new Date().toISOString(),
        },
      }))

      this.logger.log(`✅ Uploaded backup to R2: ${s3Key}`)

      // ── Cleanup temp files ─────────────────────────────
      fs.unlinkSync(sqlFile)
      fs.unlinkSync(gzFile)

      // ── Update log ─────────────────────────────────────
      const updated = await this.prisma.backupLog.update({
        where: { id: backupLog.id },
        data: {
          status: 'COMPLETED',
          fileKey: s3Key,
          fileSizeMb,
          completedAt: new Date(),
        },
      })

      return {
        success: true,
        message: `Backup completed successfully`,
        data: updated,
      }

    } catch (error: any) {
      this.logger.error(`❌ Backup failed for ${slug}:`, error.message)

      await this.prisma.backupLog.update({
        where: { id: backupLog.id },
        data: {
          status: 'FAILED',
          errorMsg: error.message,
          completedAt: new Date(),
        },
      })

      throw new Error(`Backup failed: ${error.message}`)
    }
  }

  // ── GET BACKUP DOWNLOAD URL ────────────────────────────

  async getDownloadUrl(backupId: string) {
    const backup = await this.prisma.backupLog.findUnique({
      where: { id: backupId },
    })

    if (!backup || !backup.fileKey) {
      throw new Error('Backup not found or file missing')
    }

    const signedUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.configService.get('CLOUDFLARE_R2_BUCKET_NAME'),
        Key: backup.fileKey,
      }),
      { expiresIn: 3600 } // 1 hour
    )

    return { success: true, data: { url: signedUrl, expiresIn: '1 hour' } }
  }

  // ── GET BACKUP LOGS ────────────────────────────────────

  async getBackupLogs(companyId?: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit

    const where = companyId ? { companyId } : {}

    const [logs, total] = await Promise.all([
      this.prisma.backupLog.findMany({
        where,
        include: { company: { select: { name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.backupLog.count({ where }),
    ])

    return {
      success: true,
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async getBackupLogsBySlug(slug: string, page = 1, limit = 10) {
    const company = await this.prisma.company.findUnique({ where: { slug } })
    if (!company) throw new Error('Company not found')
    return this.getBackupLogs(company.id, page, limit)
  }

  // ── BACKUP ALL COMPANIES ───────────────────────────────

  async backupAllCompanies(type: 'DAILY' | 'WEEKLY' | 'MONTHLY') {
    this.logger.log(`🔄 Starting ${type} backup for all companies`)

    const companies = await this.prisma.company.findMany({
      where: { status: 'ACTIVE' },
      select: { slug: true, name: true },
    })

    this.logger.log(`Found ${companies.length} active companies to backup`)

    const results = []
    for (const company of companies) {
      try {
        const result = await this.createBackup(company.slug, type)
        results.push({ slug: company.slug, status: 'SUCCESS' })
      } catch (err: any) {
        results.push({ slug: company.slug, status: 'FAILED', error: err.message })
      }
    }

    const succeeded = results.filter((r) => r.status === 'SUCCESS').length
    const failed = results.filter((r) => r.status === 'FAILED').length

    this.logger.log(`✅ ${type} backup complete: ${succeeded} succeeded, ${failed} failed`)
    return results
  }
}