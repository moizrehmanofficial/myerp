import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../tenants/tenant.service';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../../common/mail/mail.service';
import { ensureTenantUpgrades } from '../tenants/tenant-doc.helper';
import {
  TENANT_ACCESS_COOKIE,
  TENANT_REFRESH_COOKIE,
  tenantCookieOptions,
} from '../../common/auth-cookies';
import { TenantAuditService } from '../tenants/tenant-audit.service';

@Injectable()
export class TenantAuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private tenantService: TenantService,
    private prisma: PrismaService,
    private auditService: TenantAuditService,
    private mail: MailService,
  ) {}

  async login(slug: string, email: string, password: string, res: any) {
    // Get tenant client
    const client = await this.tenantService.getTenantClient(slug);

    // Find user in tenant DB
    const users = await client.$queryRawUnsafe(
      `SELECT * FROM "users" WHERE LOWER("email") = LOWER(TRIM($1)) AND "isDeleted" = false LIMIT 1`,
      email,
    ) as any[];

    if (!users || users.length === 0) {
      await this.logFailedLogin(slug, email, 'unknown email');
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = users[0];

    if (user.status !== 'ACTIVE') {
      await this.logFailedLogin(slug, email, `account ${String(user.status).toLowerCase()}`, user);
      throw new UnauthorizedException('Your account has been suspended');
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      await this.logFailedLogin(slug, email, 'wrong password', user);
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
    const cookieOptions = this.getCookieOptions();

    res.cookie(TENANT_ACCESS_COOKIE, accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie(TENANT_REFRESH_COOKIE, refreshToken, {
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

  getCookieOptions() {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    return tenantCookieOptions(isProduction);
  }

  // Clearing must use the same options, or browsers ignore it in production
  clearAuthCookies(res: any) {
    const options = this.getCookieOptions();
    res.clearCookie(TENANT_ACCESS_COOKIE, options);
    res.clearCookie(TENANT_REFRESH_COOKIE, options);
  }

  private async logFailedLogin(slug: string, email: string, reason: string, user?: any) {
    await this.auditService.log(slug, {
      userId: user?.id,
      userName: user?.name || email,
      action: 'LOGIN_FAILED',
      module: 'auth',
      description: `Failed login for ${email} (${reason})`,
    });
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
    res.cookie(TENANT_ACCESS_COOKIE, accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie(TENANT_REFRESH_COOKIE, newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

    return { success: true, message: 'Session refreshed' };
  }

  async logout(slug: string, userId: string, res: any) {
    await this.auditService.log(slug, {
      userId,
      action: 'LOGOUT',
      module: 'auth',
      description: 'User logged out',
    });
    try {
      const client = await this.tenantService.getTenantClient(slug);
      await client.$queryRawUnsafe(
        `UPDATE "users" SET "refreshToken" = NULL WHERE "id" = $1::uuid`,
        userId,
      );
    } catch {}

    this.clearAuthCookies(res);

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

  // ── Passwords ──────────────────────────────────────────

  // Signed-in user changes their own password
  async changePassword(slug: string, userId: string, current: string, next: string) {
    if (String(next || '').length < 8) throw new BadRequestException('The new password must be at least 8 characters');
    if (current === next) throw new BadRequestException('The new password must be different from the current one');
    const client = await this.tenantService.getTenantClient(slug);
    const users = (await client.$queryRawUnsafe(
      `SELECT "id", "name", "password" FROM "users" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      userId,
    )) as any[];
    if (!users.length) throw new UnauthorizedException('User not found');
    if (!(await bcrypt.compare(String(current || ''), users[0].password))) {
      throw new BadRequestException('Your current password is not correct');
    }
    await client.$queryRawUnsafe(
      `UPDATE "users" SET "password" = $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
      await bcrypt.hash(next, 10),
      userId,
    );
    await this.auditService.log(slug, { userId, userName: users[0].name, action: 'UPDATED', module: 'auth', description: 'Changed their password' });
    return { success: true, message: 'Password changed' };
  }

  // Sends a one-hour reset link. Always answers the same way, so nobody can
  // use this form to find out which emails have accounts.
  async forgotPassword(slug: string, email: string) {
    const generic = { success: true, message: 'If that email has an account, a reset link is on its way.' };
    const e = String(email || '').trim().toLowerCase();
    if (!e) return generic;
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);
    const users = (await client.$queryRawUnsafe(
      `SELECT "id", "name", "email", "status" FROM "users" WHERE LOWER("email") = $1 AND "isDeleted" = false LIMIT 1`,
      e,
    )) as any[];
    const user = users[0];
    if (!user || user.status !== 'ACTIVE') return generic;

    // At most 3 links per hour per person
    const recent = (await client.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM "password_resets" WHERE "userId" = $1::uuid AND "createdAt" > NOW() - interval '1 hour'`,
      user.id,
    )) as any[];
    if (Number(recent[0]?.n) >= 3) return generic;

    const token = randomBytes(32).toString('hex');
    await client.$queryRawUnsafe(
      `INSERT INTO "password_resets" ("id", "userId", "tokenHash", "expiresAt")
       VALUES (gen_random_uuid(), $1::uuid, $2, NOW() + interval '1 hour')`,
      user.id,
      this.hashToken(token),
    );
    const company = await this.prisma.company.findUnique({ where: { slug }, select: { name: true } });
    const base = this.frontendUrl();
    const url = `${base}/reset-password?company=${encodeURIComponent(slug)}&token=${token}`;
    await this.mail.send(
      user.email,
      `Reset your ${company?.name || 'MyERP'} password`,
      'Reset your password',
      [
        `Hi ${user.name},`,
        `Someone asked to reset the password for your ${company?.name || 'MyERP'} account. If it was you, use the button below. The link works for one hour and only once.`,
        'If you did not ask for this, you can ignore this email. Your password stays the same.',
      ],
      { label: 'Choose a new password', url },
    );
    await this.auditService.log(slug, { userId: user.id, userName: user.name, action: 'UPDATED', module: 'auth', description: 'Asked for a password reset link' });
    return generic;
  }

  async resetPassword(slug: string, token: string, password: string) {
    if (String(password || '').length < 8) throw new BadRequestException('The new password must be at least 8 characters');
    if (!/^[a-f0-9]{64}$/.test(String(token || ''))) throw new BadRequestException('This reset link is not valid');
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);
    const rows = (await client.$queryRawUnsafe(
      `SELECT pr."id", pr."userId", u."name" FROM "password_resets" pr
       JOIN "users" u ON u."id" = pr."userId"
       WHERE pr."tokenHash" = $1 AND pr."usedAt" IS NULL AND pr."expiresAt" > NOW()
         AND u."isDeleted" = false AND u."status" = 'ACTIVE'
       LIMIT 1`,
      this.hashToken(token),
    )) as any[];
    if (!rows.length) throw new BadRequestException('This reset link has expired or was already used. Ask for a new one.');
    const r = rows[0];
    await client.$transaction(async (tx: any) => {
      await tx.$queryRawUnsafe(
        `UPDATE "users" SET "password" = $1, "refreshToken" = NULL, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
        await bcrypt.hash(password, 10),
        r.userId,
      );
      // This link and any other open links for the person stop working
      await tx.$queryRawUnsafe(`UPDATE "password_resets" SET "usedAt" = NOW() WHERE "userId" = $1::uuid AND "usedAt" IS NULL`, r.userId);
    });
    await this.auditService.log(slug, { userId: r.userId, userName: r.name, action: 'UPDATED', module: 'auth', description: 'Reset their password with an email link' });
    return { success: true, message: 'Password changed. You can sign in now.' };
  }

  private frontendUrl() {
    const first = (this.configService.get<string>('FRONTEND_URL') || '').split(',')[0].trim();
    return (first || 'https://myerp-frontend.vercel.app').replace(/\/$/, '');
  }

  async getCompanyInfo(slug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      select: { name: true, slug: true, logoUrl: true },
    });
    return { success: true, data: company };
  }
}