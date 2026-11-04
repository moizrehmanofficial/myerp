import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../tenants/tenant.service';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { TenantAuditService } from '../tenants/tenant-audit.service';

@Injectable()
export class TenantAuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private tenantService: TenantService,
    private prisma: PrismaService,
    private auditService: TenantAuditService,
  ) {}

  async login(slug: string, email: string, password: string, res: any) {
    // Get tenant client
    const client = await this.tenantService.getTenantClient(slug);

    // Find user in tenant DB
    const users = await client.$queryRawUnsafe(
      `SELECT * FROM "users" WHERE "email" = $1 AND "isDeleted" = false LIMIT 1`,
      email,
    ) as any[];

    if (!users || users.length === 0) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = users[0];

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your account has been suspended');
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Get user role
    let roleName = 'User';
    if (user.roleId) {
      const roles = await client.$queryRawUnsafe(
        `SELECT * FROM "roles" WHERE "id" = $1::uuid LIMIT 1`,
        user.roleId,
      ) as any[];
      if (roles.length > 0) roleName = roles[0].name;
    }

    // Generate tokens
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      slug,
      type: 'tenant_user',
      isOwner: user.isOwner,
      roleId: user.roleId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m' as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: '7d' as any,
    });

    // Save hashed refresh token (sha256 — bcrypt only reads first 72 chars of a JWT)
    const hashedRefresh = this.hashToken(refreshToken);
    await client.$queryRawUnsafe(
          `UPDATE "users" SET "refreshToken" = $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
      hashedRefresh,
      user.id,
    );

    // Set cookies for cross-site tenant auth requests.
    // SameSite=None is required when frontend and API are served from different domains/subdomains.
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };

    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Fetch enabled modules from master DB
    const company = await this.prisma.company.findUnique({
      where: { slug },
      include: { modules: { include: { module: true } } },
    });

    const companyModuleKeys = company?.modules.map((cm) => cm.module.key) || [];
    const companyLogoUrl = company?.logoUrl || null;

    // Owner gets all company modules
    // Non-owner gets intersection of role modules and company modules
    let moduleKeys: string[] = [];
    let userPermissions: Record<string, any> = {};

    if (user.isOwner) {
      moduleKeys = companyModuleKeys;
      // Owner gets full permissions (all 7 actions) on every module the company has enabled
      companyModuleKeys.forEach((key) => {
        userPermissions[key] = {
          read: true, write: true, modify: true,
          delete: true, print: true, export: true, approve: true,
        };
      });
    } else {
      // Get role moduleKeys + permissions from tenant DB
      const tenantClient = await this.tenantService.getTenantClient(slug);
      if (user.roleId) {
        const roles = await tenantClient.$queryRawUnsafe(
          `SELECT "moduleKeys", "permissions" FROM "roles" WHERE "id" = $1::uuid LIMIT 1`,
          user.roleId,
        ) as any[];
        const roleModuleKeys: string[] = roles[0]?.moduleKeys || [];
        // Intersect role modules with company-enabled modules
        moduleKeys = roleModuleKeys.filter((k: string) => companyModuleKeys.includes(k));
        userPermissions = roles[0]?.permissions || {};
      }
    }


    await this.auditService.log(slug, {
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      module: 'auth',
      description: `${user.name} logged in`,
    });



    return {
      success: true,
      message: 'Login successful',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleName,
        isOwner: user.isOwner,
        type: 'tenant_user',
        slug,
        moduleKeys,
        permissions: userPermissions,
        logoUrl: companyLogoUrl,
      },
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getCookieOptions() {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
  }

  async refresh(slug: string, refreshToken: string, res: any) {
    if (!refreshToken) throw new UnauthorizedException('Session expired, please login again');

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Session expired, please login again');
    }

    if (payload.type !== 'tenant_user' || payload.slug !== slug) {
      throw new UnauthorizedException('Invalid session');
    }

    const client = await this.tenantService.getTenantClient(slug);
    const users = await client.$queryRawUnsafe(
      `SELECT * FROM "users" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      payload.sub,
    ) as any[];
    const user = users?.[0];

    if (!user || !user.refreshToken || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Session expired, please login again');
    }

    // Token must be the latest one we issued (rotation + logout safe)
    if (user.refreshToken !== this.hashToken(refreshToken)) {
      throw new UnauthorizedException('Session expired, please login again');
    }

    const newPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      slug,
      type: 'tenant_user',
      isOwner: user.isOwner,
      roleId: user.roleId,
    };

    const accessToken = this.jwtService.sign(newPayload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m' as any,
    });
    const newRefreshToken = this.jwtService.sign(newPayload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: '7d' as any,
    });

    await client.$queryRawUnsafe(
      `UPDATE "users" SET "refreshToken" = $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
      this.hashToken(newRefreshToken),
      user.id,
    );

    const cookieOptions = this.getCookieOptions();
    res.cookie('access_token', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

    return { success: true, message: 'Session refreshed' };
  }

  async logout(slug: string, userId: string, res: any) {
    try {
      const client = await this.tenantService.getTenantClient(slug);
      await client.$queryRawUnsafe(
        `UPDATE "users" SET "refreshToken" = NULL WHERE "id" = $1::uuid`,
        userId,
      );
    } catch {}

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return { success: true, message: 'Logged out successfully' };
  }

  async getProfile(slug: string, userId: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const users = await client.$queryRawUnsafe(
      `SELECT u.*, r.name as "roleName"
       FROM "users" u
       LEFT JOIN "roles" r ON u."roleId" = r."id"
           WHERE u."id" = $1::uuid LIMIT 1`,
      userId,
    ) as any[];

    if (!users || users.length === 0) {
      throw new UnauthorizedException('User not found');
    }

    const user = users[0];

    const company = await this.prisma.company.findUnique({
      where: { slug },
      include: { modules: { include: { module: true } } },
    });

    const companyModuleKeys = company?.modules.map((cm) => cm.module.key) || [];
    const companyLogoUrl = company?.logoUrl || null;

    let moduleKeys: string[] = [];
    let userPermissions: Record<string, any> = {};

    if (user.isOwner) {
      moduleKeys = companyModuleKeys;
      companyModuleKeys.forEach((key) => {
        userPermissions[key] = {
          read: true, write: true, modify: true,
          delete: true, print: true, export: true, approve: true,
        };
      });
    } else {
      const tenantClient = await this.tenantService.getTenantClient(slug);
      if (user.roleId) {
        const roles = await tenantClient.$queryRawUnsafe(
          `SELECT "moduleKeys", "permissions" FROM "roles" WHERE "id" = $1::uuid LIMIT 1`,
          user.roleId,
        ) as any[];
        const roleModuleKeys: string[] = roles[0]?.moduleKeys || [];
        moduleKeys = roleModuleKeys.filter((k: string) => companyModuleKeys.includes(k));
        userPermissions = roles[0]?.permissions || {};
      }
    }

    return {
      success: true,
      message: 'Profile fetched successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.roleName || 'User',
        isOwner: user.isOwner,
        status: user.status,
        slug,
        moduleKeys,
        permissions: userPermissions,
        logoUrl: companyLogoUrl,
      },
    };
  }

  async getCompanyInfo(slug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      select: { name: true, slug: true, logoUrl: true },
    });
    return { success: true, data: company };
  }
}