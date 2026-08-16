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

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private tenantService: TenantService,
    private configService: ConfigService,
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

    // ── Create tenant schema + tables ──────────────────
    await this.tenantService.createTenantSchema(dto.slug);

    // ── Seed CEO + default data in tenant ──────────────
    const moduleKeys = modules.map((m) => m.key);

await this.tenantService.seedTenantData(
  dto.slug,
  dto.ceoName,
  dto.ceoEmail,
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
    const company = await this.prisma.$transaction(async (tx) => {
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

    return {
      success: true,
      message: 'Company ERP created successfully',
      data: {
        ...company,
        erpUrl: `${dto.slug}.myerp.com`,
        ceoEmail: dto.ceoEmail,
        modulesEnabled: modules.length,
      },
    };
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    if (dto.slug && dto.slug !== company.slug) {
      const existing = await this.prisma.company.findUnique({ where: { slug: dto.slug } });
      if (existing) {
        throw new BadRequestException('This subdomain is already taken');
      }
    }

    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.slug) data.slug = dto.slug;
    if (dto.ceoName) data.ceoName = dto.ceoName;
    if (dto.ceoEmail) data.ceoEmail = dto.ceoEmail;
    if (dto.plan) data.plan = dto.plan;

    if (dto.moduleKeys) {
      const modules = await this.prisma.module.findMany({
        where: { key: { in: dto.moduleKeys }, isActive: true },
      });
      if (modules.length === 0) {
        throw new BadRequestException('No valid modules selected');
      }
      await this.prisma.companyModule.deleteMany({ where: { companyId: id } });
      await this.prisma.companyModule.createMany({
        data: modules.map((m) => ({
          companyId: id,
          moduleId: m.id,
        })),
      });
    }

    if (dto.ceoPassword) {
      data.ceoPassword = await bcrypt.hash(dto.ceoPassword, 10);
    }

    const updated = await this.prisma.company.update({ where: { id }, data });

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

    return {
      success: true,
      message: 'Logo uploaded successfully',
      data: { logoUrl },
    };
  }
}