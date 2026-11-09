import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
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
import { domainMessage, parseLoginId } from '../tenants/tenant-login-id';

// Compared against when the login ID does not exist, so a wrong ID takes as
// long as a wrong password
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// Wrong tries per login ID (in memory, per server process)
const MAX_TRIES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; first: number; lockedUntil: number }>();

function lockedMinutes(key: string): number {
  const f = failures.get(key);
  if (!f || f.lockedUntil <= Date.now()) return 0;
  return Math.max(1, Math.ceil((f.lockedUntil - Date.now()) / 60000));
}

function recordFailure(key: string) {
  const now = Date.now();
  let f = failures.get(key);
  if (!f || now - f.first > WINDOW_MS) f = { count: 0, first: now, lockedUntil: 0 };
  f.count++;
  if (f.count >= MAX_TRIES) f.lockedUntil = now + WINDOW_MS;
  failures.set(key, f);
  if (failures.size > 10000) {
    for (const [k, v] of failures) if (v.lockedUntil < now && now - v.first > WINDOW_MS) failures.delete(k);
  }
}

function clearFailures(key: string) {
  failures.delete(key);
}

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

  // Old sign-in: company code (header) + email. Kept for a short while so
  // nobody is locked out; the answer tells the person their new login ID.
  async login(slug: string, email: string, password: string, res: any) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    const users = await client.$queryRawUnsafe(
      `SELECT * FROM "users" WHERE LOWER("email") = LOWER(TRIM($1)) AND "isDeleted" = false LIMIT 1`,
      email,
    ) as any[];

    if (!users || users.length === 0) {
      await bcrypt.compare(String(password || ''), DUMMY_HASH);
      await this.logFailedLogin(slug, email, 'unknown email');
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = users[0];

    if (user.status !== 'ACTIVE') {
      await this.logFailedLogin(slug, email, `account ${String(user.status).toLowerCase()}`, user);
      throw new UnauthorizedException('Your account has been suspended');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      await this.logFailedLogin(slug, email, 'wrong password', user);
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.completeLogin(slug, client, user, res);
  }

  // New sign-in for everyone: login ID "name@company" + password.
  // - "name@company.com" is refused at once (it is not an email)
  // - every failure gives the same message and takes about the same time,
  //   so nobody can find out which companies or names exist
  // - 5 wrong tries on one login ID locks it for 15 minutes
  async signin(loginId: string, password: string, res: any) {
    const parsed = parseLoginId(loginId);
    if (!parsed.ok && parsed.reason === 'domain') {
      throw new BadRequestException(domainMessage(parsed.domain));
    }
    const key = String(loginId || '').trim().toLowerCase().slice(0, 120);
    const wait = lockedMinutes(key);
    if (wait) throw new HttpException(`Too many wrong tries. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`, HttpStatus.TOO_MANY_REQUESTS);

    const pw = String(password || '');
    const fail = async (slug?: string, reason?: string, user?: any) => {
      recordFailure(key);
      if (slug && reason) await this.logFailedLogin(slug, key, reason, user).catch(() => undefined);
      throw new UnauthorizedException('Login ID or password is incorrect');
    };

    if (!parsed.ok) {
      await bcrypt.compare(pw, DUMMY_HASH);
      return fail();
    }
    const { username, slug } = parsed;

    const company = await this.prisma.company.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!company) {
      await bcrypt.compare(pw, DUMMY_HASH);
      return fail();
    }

    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);
    const users = (await client.$queryRawUnsafe(
      `SELECT * FROM "users" WHERE LOWER("username") = $1 AND "isDeleted" = false LIMIT 1`,
      username,
    )) as any[];
    const user = users[0];

    const match = await bcrypt.compare(pw, user?.password || DUMMY_HASH);
    if (!user) return fail(slug, 'unknown login ID');
    if (!match) return fail(slug, 'wrong password', user);

    // Right password from here on, so it is safe to say what is wrong
    clearFailures(key);
    if (company.status === 'SUSPENDED') throw new ForbiddenException('This company account has been suspended. Contact your administrator.');
    if (user.status !== 'ACTIVE') {
      await this.logFailedLogin(slug, key, `account ${String(user.status).toLowerCase()}`, user);
      throw new ForbiddenException('Your account has been turned off. Ask your company owner.');
    }

    return this.completeLogin(slug, client, user, res);
  }

  // Tokens, cookies, modules and permissions once the password is checked
  private async completeLogin(slug: string, client: any, user: any, res: any) {
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
        loginId: user.username ? `${user.username}@${slug}` : null,
        companyName: company?.name || null,
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
  // New way: the login ID ("name@company") picks the company and the person;
  // the link goes to the real email saved on their account.
  async forgotPasswordByLoginId(loginId: string) {
    const generic = { success: true, message: 'If that login ID has an email on file, a reset link is on its way.' };
    const parsed = parseLoginId(loginId);
    if (!parsed.ok && parsed.reason === 'domain') {
      throw new BadRequestException(domainMessage(parsed.domain));
    }
    if (!parsed.ok) return generic;
    const company = await this.prisma.company.findUnique({ where: { slug: parsed.slug }, select: { status: true } });
    if (!company || company.status === 'SUSPENDED') return generic;
    return this.forgotPassword(parsed.slug, '', parsed.username);
  }

  async forgotPassword(slug: string, email: string, username?: string) {
    const generic = username
      ? { success: true, message: 'If that login ID has an email on file, a reset link is on its way.' }
      : { success: true, message: 'If that email has an account, a reset link is on its way.' };
    const e = String(email || '').trim().toLowerCase();
    if (!e && !username) return generic;
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);
    const users = (await client.$queryRawUnsafe(
      username
        ? `SELECT "id", "name", "email", "status", "username" FROM "users" WHERE LOWER("username") = $1 AND "isDeleted" = false LIMIT 1`
        : `SELECT "id", "name", "email", "status", "username" FROM "users" WHERE LOWER("email") = $1 AND "isDeleted" = false LIMIT 1`,
      username || e,
    )) as any[];
    const user = users[0];
    // No email on file: nothing to send to (the owner can reset it instead)
    if (!user || user.status !== 'ACTIVE' || !user.email) return generic;

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
        `Someone asked to reset the password for your ${company?.name || 'MyERP'} account${user.username ? ` (login ID ${user.username}@${slug})` : ''}. If it was you, use the button below. The link works for one hour and only once.`,
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