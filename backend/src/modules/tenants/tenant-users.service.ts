import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantAuditService } from './tenant-audit.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenantUsersService {
  constructor(
    private tenantService: TenantService,
    private auditService: TenantAuditService,
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

  async getUsers(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const users = await client.$queryRawUnsafe(
      `SELECT u."id", u."name", u."email", u."phone", u."status",
              u."isOwner", u."roleId", u."createdAt",
              r."name" as "roleName", r."moduleKeys" as "roleModuleKeys"
       FROM "users" u
       LEFT JOIN "roles" r ON u."roleId" = r."id"
       WHERE u."isDeleted" = false
       ORDER BY u."isOwner" DESC, u."createdAt" ASC`,
    ) as any[];

    return { success: true, data: users };
  }

  async createUser(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    body.name = String(body.name || '').trim();
    body.email = String(body.email || '').trim().toLowerCase();
    if (!body.name) throw new BadRequestException('Enter the person’s name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new BadRequestException('Enter a valid email address');
    if (String(body.password || '').length < 8) throw new BadRequestException('Password must be at least 8 characters');

    const existing = await client.$queryRawUnsafe(
      `SELECT id FROM "users" WHERE LOWER("email") = $1 AND "isDeleted" = false LIMIT 1`,
      body.email,
    ) as any[];

    if (existing.length > 0) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);

    const result = await client.$queryRawUnsafe(
      `INSERT INTO "users" (
        "id", "name", "email", "phone", "password",
        "roleId", "isOwner", "status"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5::uuid, false, 'ACTIVE'
      ) RETURNING "id", "name", "email", "phone", "status", "roleId", "createdAt"`,
      body.name,
      body.email,
      body.phone || null,
      hashedPassword,
      body.roleId || null,
    ) as any[];

    await this.auditService.log(slug, {
      action: 'CREATED',
      module: 'users',
      recordId: result[0].id,
      description: `User ${body.email} created`,
    });

    return { success: true, message: 'User created successfully', data: result[0] };
  }

  async updateUser(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const users = await client.$queryRawUnsafe(
      `SELECT "isOwner" FROM "users" WHERE "id" = $1::uuid LIMIT 1`, id,
    ) as any[];

    if (users[0]?.isOwner) {
      throw new BadRequestException('Cannot modify owner account');
    }
    if (!String(body.name || '').trim()) throw new BadRequestException('Enter the person’s name');
    if (body.password && String(body.password).length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    if (body.status && !['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(body.status)) {
      throw new BadRequestException('Unknown status');
    }

    let result: any[];

    if (body.password) {
      const hashedPassword = await bcrypt.hash(body.password, 10);
      result = await client.$queryRawUnsafe(
        `UPDATE "users"
         SET "name" = $1, "phone" = $2, "roleId" = $3::uuid,
             "status" = $4, "password" = $5, "updatedAt" = NOW()
         WHERE "id" = $6::uuid AND "isDeleted" = false
         RETURNING "id", "name", "email", "phone", "status", "roleId"`,
        body.name,
        body.phone || null,
        body.roleId || null,
        body.status || 'ACTIVE',
        hashedPassword,
        id,
      ) as any[];
    } else {
      result = await client.$queryRawUnsafe(
        `UPDATE "users"
         SET "name" = $1, "phone" = $2, "roleId" = $3::uuid,
             "status" = $4, "updatedAt" = NOW()
         WHERE "id" = $5::uuid AND "isDeleted" = false
         RETURNING "id", "name", "email", "phone", "status", "roleId"`,
        body.name,
        body.phone || null,
        body.roleId || null,
        body.status || 'ACTIVE',
        id,
      ) as any[];
    }

    if (!result.length) throw new NotFoundException('User not found');

    await this.auditService.log(slug, {
      action: 'UPDATED',
      module: 'users',
      recordId: id,
      description: `User updated`,
    });

    return { success: true, message: 'User updated', data: result[0] };
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