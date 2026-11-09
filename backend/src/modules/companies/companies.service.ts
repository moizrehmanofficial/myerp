import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantService } from '../tenants/tenant.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import * as bcrypt from 'bcrypt';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../common/mail/mail.service';
import { clearTenantCache } from '../../common/middleware/tenant.middleware';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private tenantService: TenantService,
    private configService: ConfigService,
    private mail: MailService,
  ) {}

  async findAll(page = 1, limit = 25) {
    const skip = (page - 1) * limit;

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where: { status: { not: 'DELETED' } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          modules: {
            include: { module: true },
          },
          _count: {
            select: { modules: true },
          },
        },
      }),
      this.prisma.company.count({ where: { status: { not: 'DELETED' } } }),
    ]);

    return {
      success: true,
      message: 'Companies fetched successfully',
      data: companies,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        modules: { include: { module: true } },
        subscriptions: true,
        backupLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!company) throw new NotFoundException('Company not found');

    return {
      success: true,
      message: 'Company fetched successfully',
      data: company,
    };
  }

  async create(dto: CreateCompanyDto) {
    const RESERVED = ['www', 'admin', 'api', 'app', 'mail', 'erp', 'login', 'dashboard', 'public'];
    if (RESERVED.includes(dto.slug) || dto.slug.length < 3 || dto.slug.length > 30 || /^-|-$/.test(dto.slug)) {
      throw new BadRequestException('Choose another subdomain: 3 to 30 letters, numbers or hyphens, not starting or ending with a hyphen');
    }

    // ── Check duplicate slug ───────────────────────────
    const existing = await this.prisma.company.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('This subdomain is already taken');
    }

    // ── Hash CEO password ──────────────────────────────
    const hashedPassword = await bcrypt.hash(dto.ceoPassword, 10);

    // ── Get selected modules ───────────────────────────
    const modules = await this.prisma.module.findMany({
      where: { key: { in: dto.moduleKeys }, isActive: true },
    });

    if (modules.length === 0) {
      throw new BadRequestException('No valid modules selected');
    }

    // If anything below fails, remove the half-made database schema so the
    // same subdomain can be used again cleanly
    let company: any;
    try {
      // ── Create tenant schema + tables ──────────────────
      await this.tenantService.createTenantSchema(dto.slug);

      // ── Seed CEO + default data in tenant ──────────────
      const moduleKeys = modules.map((m) => m.key);

      await this.tenantService.seedTenantData(
        dto.slug,
        dto.ceoName,
        dto.ceoEmail.trim().toLowerCase(),
        hashedPassword,
        moduleKeys,
      );

      // ── Build tenant database URL ──────────────────────
      const schemaName = `tenant_${dto.slug}`;
      const baseUrl = process.env.DATABASE_URL!;
      const databaseUrl = baseUrl.includes('?')
        ? `${baseUrl}&schema=${schemaName}`
        : `${baseUrl}?schema=${schemaName}`;

      // ── Create company + modules in transaction ────────
      company = await this.prisma.$transaction(async (tx) => {
        const newCompany = await tx.company.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            ceoName: dto.ceoName,
            ceoEmail: dto.ceoEmail,
            databaseUrl,
            plan: (dto.plan as any) || 'FREE',
            status: 'ACTIVE',
          },
        });

        await tx.companyModule.createMany({
          data: modules.map((m) => ({
            companyId: newCompany.id,
            moduleId: m.id,
          })),
        });

        await tx.subscription.create({
          data: {
            companyId: newCompany.id,
            plan: (dto.plan as any) || 'FREE',
            status: 'ACTIVE',
            startDate: new Date(),
          },
        });

        await tx.systemLog.create({
          data: {
            action: 'COMPANY_CREATED',
            performedBy: 'super_admin',
            details: `Company ${dto.name} created with schema ${schemaName}`,
          },
        });

        return newCompany;
      });
    } catch (err) {
      await this.tenantService.closeTenantClient(dto.slug).catch(() => undefined);
      await this.prisma
        .$executeRawUnsafe(`DROP SCHEMA IF EXISTS "tenant_${dto.slug}" CASCADE`)
        .catch(() => {});
      throw err;
    }

    const frontendUrl = ((process.env.FRONTEND_URL || '').split(',')[0].trim() || 'https://myerp-frontend.vercel.app').replace(/\/$/, '');

    // Welcome email to the owner. The password is NOT emailed; the admin
    // shares it privately, or the owner uses "Forgot password".
    const welcomeSent = await this.mail.send(
      dto.ceoEmail,
      `Your ${dto.name} workspace on MyERP is ready`,
      `Welcome to MyERP, ${dto.ceoName}`,
      [
        `Your company workspace "${dto.name}" has been created. You are its owner, so you can add your team and choose what each person can do.`,
        `Sign in with this email address (${dto.ceoEmail}). Your administrator will give you the password, or you can set one yourself with "Forgot password" on the sign-in page.`,
      ],
      { label: 'Open your workspace', url: `${frontendUrl}/erp-login?company=${dto.slug}` },
    );

    clearTenantCache();
    return {
      success: true,
      message: 'Company ERP created successfully',
      data: {
        ...company,
        erpUrl: `${frontendUrl}/erp-login?company=${dto.slug}`,
        ceoEmail: dto.ceoEmail,
        modulesEnabled: modules.length,
        welcomeEmailSent: welcomeSent,
      },
    };
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    // The company's data lives in schema "tenant_<slug>", so the slug can't change
    if (dto.slug && dto.slug !== company.slug) {
      throw new BadRequestException('The company login address (subdomain) cannot be changed after creation');
    }

    const data: any = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.ceoName) data.ceoName = dto.ceoName.trim();
    if (dto.ceoEmail) data.ceoEmail = dto.ceoEmail.trim().toLowerCase();
    if (dto.plan) {
      if (!['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'].includes(dto.plan)) {
        throw new BadRequestException('Unknown plan');
      }
      data.plan = dto.plan;
    }

    let modules: { id: string }[] | null = null;
    if (dto.moduleKeys) {
      modules = await this.prisma.module.findMany({
        where: { key: { in: dto.moduleKeys }, isActive: true },
      });
      if (modules.length === 0) {
        throw new BadRequestException('No valid modules selected');
      }
    }

    // Owner login (name / email / password) lives in the company's own users table
    if (data.ceoName || data.ceoEmail || dto.ceoPassword) {
      const client = await this.tenantService.getTenantClient(company.slug);
      if (data.ceoEmail) {
        const taken = (await client.$queryRawUnsafe(
          `SELECT "id" FROM "users" WHERE LOWER("email") = $1 AND "isOwner" = false AND "isDeleted" = false LIMIT 1`,
          data.ceoEmail,
        )) as any[];
        if (taken.length) throw new BadRequestException('Another user in this company already uses that email');
      }
      const hashed = dto.ceoPassword ? await bcrypt.hash(dto.ceoPassword, 10) : null;
      await client.$queryRawUnsafe(
        `UPDATE "users"
         SET "name" = COALESCE($1, "name"), "email" = COALESCE($2, "email"),
             "password" = COALESCE($3, "password"), "updatedAt" = NOW()
         WHERE "isOwner" = true AND "isDeleted" = false`,
        data.ceoName || null,
        data.ceoEmail || null,
        hashed,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (modules) {
        await tx.companyModule.deleteMany({ where: { companyId: id } });
        await tx.companyModule.createMany({
          data: modules.map((m) => ({ companyId: id, moduleId: m.id })),
        });
      }
      return tx.company.update({ where: { id }, data });
    });

    clearTenantCache();
    return {
      success: true,
      message: 'Company updated successfully',
      data: updated,
    };
  }

  async suspend(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    const updated = await this.prisma.company.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    clearTenantCache();
    return {
      success: true,
      message: 'Company suspended successfully',
      data: updated,
    };
  }

  async activate(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    const updated = await this.prisma.company.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    clearTenantCache();
    return {
      success: true,
      message: 'Company activated successfully',
      data: updated,
    };
  }

  async remove(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    await this.prisma.company.update({
      where: { id },
      data: { status: 'DELETED' },
    });

    clearTenantCache();
    return {
      success: true,
      message: 'Company deleted successfully',
    };
  }

  async getModules() {
    const modules = await this.prisma.module.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      success: true,
      message: 'Modules fetched successfully',
      data: modules,
    };
  }

  async uploadLogo(companyId: string, file: Express.Multer.File) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    if (!file) throw new BadRequestException('No file uploaded');

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPG, PNG, WebP and SVG files are allowed');
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Logo must be under 2MB');
    }

    const ext = file.originalname.split('.').pop();
    const key = `logos/${companyId}.${ext}`;

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${this.configService.get('CLOUDFLARE_R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.get('CLOUDFLARE_R2_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY') || '',
      },
    });

    await s3.send(new PutObjectCommand({
      Bucket: this.configService.get('CLOUDFLARE_R2_BUCKET_NAME'),
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    const logoUrl = `${this.configService.get('CLOUDFLARE_R2_PUBLIC_URL')}/${key}`;

    await this.prisma.company.update({
      where: { id: companyId },
      data: { logoUrl },
    });

    clearTenantCache();
    return {
      success: true,
      message: 'Logo uploaded successfully',
      data: { logoUrl },
    };
  }
}