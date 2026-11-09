import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantAuditService } from './tenant-audit.service';
import * as bcrypt from 'bcrypt';
import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../database/prisma.service';
import { ensureTenantUpgrades } from './tenant-doc.helper';
import { cleanUsername } from './tenant-login-id';

@Injectable()
export class TenantUsersService {
  constructor(
    private tenantService: TenantService,
    private auditService: TenantAuditService,
    private mail: MailService,
    private prisma: PrismaService,
  ) {}

  // ── ROLES ─────────────────────────────────────────────

  async getRoles(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const roles = await client.$queryRawUnsafe(
      `SELECT r.*,
        (SELECT COUNT(*) FROM "users" u WHERE u."roleId" = r."id" AND u."isDeleted" = false) as "userCount"
       FROM "roles" r
       ORDER BY r."createdAt" ASC`,
    ) as any[];

    return {
      success: true,
      data: roles.map((r: any) => ({
        ...r,
        userCount: Number(r.userCount || 0),
        moduleKeys: r.moduleKeys || [],
      })),
    };
  }

  async createRole(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const existing = await client.$queryRawUnsafe(
      `SELECT id FROM "roles" WHERE LOWER("name") = LOWER($1) LIMIT 1`,
      body.name,
    ) as any[];

    if (existing.length > 0) {
      throw new BadRequestException('Role name already exists');
    }

    const moduleKeys = Array.isArray(body.moduleKeys) ? body.moduleKeys : [];
    const permissions = body.permissions && typeof body.permissions === 'object'
      ? body.permissions : {};

    const result = await client.$queryRawUnsafe(
      `INSERT INTO "roles" ("id", "name", "description", "moduleKeys", "permissions")
       VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::jsonb)
       RETURNING *`,
      body.name,
      body.description || null,
      JSON.stringify(moduleKeys),
      JSON.stringify(permissions),
    ) as any[];

    await this.auditService.log(slug, {
      action: 'CREATED',
      module: 'users',
      recordId: result[0].id,
      description: `Role ${body.name} created`,
    });

    return { success: true, message: 'Role created', data: result[0] };
  }

  async updateRole(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const moduleKeys = Array.isArray(body.moduleKeys) ? body.moduleKeys : [];
    const permissions = body.permissions && typeof body.permissions === 'object'
      ? body.permissions : {};

    const result = await client.$queryRawUnsafe(
      `UPDATE "roles"
       SET "name" = $1, "description" = $2, "moduleKeys" = $3::jsonb,
           "permissions" = $4::jsonb, "updatedAt" = NOW()
       WHERE "id" = $5::uuid
       RETURNING *`,
      body.name,
      body.description || null,
      JSON.stringify(moduleKeys),
      JSON.stringify(permissions),
      id,
    ) as any[];

    if (!result.length) throw new NotFoundException('Role not found');

    await this.auditService.log(slug, {
      action: 'UPDATED',
      module: 'users',
      recordId: id,
      description: `Role permissions updated`,
    });

    return { success: true, message: 'Role updated', data: result[0] };
  }

  async deleteRole(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const usersWithRole = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "users" WHERE "roleId" = $1::uuid AND "isDeleted" = false`,
      id,
    ) as any[];

    if (Number(usersWithRole[0].count) > 0) {
      throw new BadRequestException('Cannot delete role with assigned users');
    }

    await client.$queryRawUnsafe(
      `DELETE FROM "roles" WHERE "id" = $1::uuid`, id,
    );

    return { success: true, message: 'Role deleted' };
  }

  // ── USERS ──────────────────────────────────────────────
  // Everyone signs in with a login ID "name@company". The owner picks the
  // name part; the company part is fixed. A real email is optional and only
  // used for welcome and password reset emails.

  async getUsers(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    const users = await client.$queryRawUnsafe(
      `SELECT u."id", u."name", u."username", u."email", u."phone", u."status",
              u."isOwner", u."roleId", u."createdAt",
              r."name" as "roleName", r."moduleKeys" as "roleModuleKeys"
       FROM "users" u
       LEFT JOIN "roles" r ON u."roleId" = r."id"
       WHERE u."isDeleted" = false
       ORDER BY u."isOwner" DESC, u."createdAt" ASC`,
    ) as any[];

    return {
      success: true,
      data: users.map((u) => ({ ...u, loginId: u.username ? `${u.username}@${slug}` : null })),
    };
  }

  // Checks the login name and email the owner typed
  private async checkIdentity(client: any, body: any, exceptId?: string) {
    const username = cleanUsername(body.username);
    if (!username) {
      throw new BadRequestException('Login name: 1 to 40 letters or numbers. Dots, dashes and underscores are fine in the middle. No spaces.');
    }
    const taken = (await client.$queryRawUnsafe(
      `SELECT "id" FROM "users" WHERE LOWER("username") = $1 AND "isDeleted" = false AND ($2::uuid IS NULL OR "id" <> $2::uuid) LIMIT 1`,
      username,
      exceptId || null,
    )) as any[];
    if (taken.length) throw new BadRequestException(`The login name "${username}" is already used in this company`);

    const email = String(body.email || '').trim().toLowerCase() || null;
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address, or leave it empty');
      const used = (await client.$queryRawUnsafe(
        `SELECT "id" FROM "users" WHERE LOWER("email") = $1 AND "isDeleted" = false AND ($2::uuid IS NULL OR "id" <> $2::uuid) LIMIT 1`,
        email,
        exceptId || null,
      )) as any[];
      if (used.length) throw new BadRequestException('Another user in this company already has that email');
    }
    return { username, email };
  }

  async createUser(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    body.name = String(body.name || '').trim();
    if (!body.name) throw new BadRequestException('Enter the person’s name');
    if (String(body.password || '').length < 8) throw new BadRequestException('Password must be at least 8 characters');
    const { username, email } = await this.checkIdentity(client, body);
    const loginId = `${username}@${slug}`;

    const hashedPassword = await bcrypt.hash(body.password, 10);

    const result = await client.$queryRawUnsafe(
      `INSERT INTO "users" (
        "id", "name", "username", "email", "phone", "password",
        "roleId", "isOwner", "status"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        $6::uuid, false, 'ACTIVE'
      ) RETURNING "id", "name", "username", "email", "phone", "status", "roleId", "createdAt"`,
      body.name,
      username,
      email,
      body.phone || null,
      hashedPassword,
      body.roleId || null,
    ) as any[];

    await this.auditService.log(slug, {
      action: 'CREATED',
      module: 'users',
      recordId: result[0].id,
      description: `User ${loginId} created`,
    });

    // Tell the new person how to sign in (the password is shared by the owner)
    let emailSent = false;
    if (email) {
      const company = await this.prisma.company.findUnique({ where: { slug }, select: { name: true } }).catch(() => null);
      const base = ((process.env.FRONTEND_URL || '').split(',')[0].trim() || 'https://myerp-frontend.vercel.app').replace(/\/$/, '');
      emailSent = await this.mail.send(
        email,
        `You have been added to ${company?.name || 'a company'} on MyERP`,
        `Welcome, ${body.name}`,
        [
          `You now have an account in ${company?.name || 'your company'}'s MyERP workspace.`,
          `Your login ID is ${loginId} (type it exactly like this, without .com). The person who added you will give you the password, or you can set your own with "Forgot password" on the sign-in page.`,
        ],
        { label: 'Go to sign in', url: `${base}/signin` },
      );
    }

    return { success: true, message: 'User created successfully', data: { ...result[0], loginId, emailSent } };
  }

  async updateUser(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    const users = await client.$queryRawUnsafe(
      `SELECT "isOwner", "username" FROM "users" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`, id,
    ) as any[];
    if (!users.length) throw new NotFoundException('User not found');

    if (users[0].isOwner) {
      throw new BadRequestException('Cannot modify owner account');
    }
    if (!String(body.name || '').trim()) throw new BadRequestException('Enter the person’s name');
    if (body.password && String(body.password).length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    if (body.status && !['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(body.status)) {
      throw new BadRequestException('Unknown status');
    }
    // Older screens may not send the login name: keep the current one
    if (body.username === undefined) body.username = users[0].username;
    const { username, email } = await this.checkIdentity(client, body, id);

    const hashedPassword = body.password ? await bcrypt.hash(body.password, 10) : null;
    // A new password (or turning the account off) signs the person out everywhere
    const signOut = !!hashedPassword || (body.status && body.status !== 'ACTIVE');
    const result = await client.$queryRawUnsafe(
      `UPDATE "users"
       SET "name" = $1, "username" = $2, "email" = $3, "phone" = $4, "roleId" = $5::uuid,
           "status" = $6, "password" = COALESCE($7, "password"),
           "refreshToken" = CASE WHEN $8 THEN NULL ELSE "refreshToken" END,
           "updatedAt" = NOW()
       WHERE "id" = $9::uuid AND "isDeleted" = false
       RETURNING "id", "name", "username", "email", "phone", "status", "roleId"`,
      String(body.name).trim(),
      username,
      email,
      body.phone || null,
      body.roleId || null,
      body.status || 'ACTIVE',
      hashedPassword,
      signOut,
      id,
    ) as any[];

    if (!result.length) throw new NotFoundException('User not found');

    await this.auditService.log(slug, {
      action: 'UPDATED',
      module: 'users',
      recordId: id,
      description: hashedPassword ? `User ${username}@${slug} updated (password reset)` : `User ${username}@${slug} updated`,
    });

    return { success: true, message: 'User updated', data: { ...result[0], loginId: `${username}@${slug}` } };
  }

  async deleteUser(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const users = await client.$queryRawUnsafe(
      `SELECT "isOwner" FROM "users" WHERE "id" = $1::uuid LIMIT 1`, id,
    ) as any[];

    if (users[0]?.isOwner) {
      throw new BadRequestException('Cannot delete owner account');
    }

    await client.$queryRawUnsafe(
      `UPDATE "users" SET "isDeleted" = true, "deletedAt" = NOW() WHERE "id" = $1::uuid`, id,
    );

    await this.auditService.log(slug, {
      action: 'DELETED',
      module: 'users',
      recordId: id,
      description: `User deleted`,
    });

    return { success: true, message: 'User deleted' };
  }
}