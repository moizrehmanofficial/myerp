import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ensureTenantUpgrades, TX_OPTIONS } from './tenant-doc.helper';
import { postOpeningBalance } from './tenant-accounting.helper';
import { TenantService } from './tenant.service';
import { TenantAuditService } from './tenant-audit.service';

@Injectable()
export class TenantCustomersService {
  constructor(
  private tenantService: TenantService,
  private auditService: TenantAuditService,
) {}

  async findAll(slug: string, page = 1, limit = 25, search = '') {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    // Debug — verify which schema is being used
    const schemaCheck = await client.$queryRawUnsafe(
      `SELECT current_schema() as schema`
    ) as any[];
    console.log(`[Customers] slug=${slug} schema=${schemaCheck[0]?.schema}`);

    let whereClause = `"isDeleted" = false`;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND ("name" ILIKE $${params.length} OR "email" ILIKE $${params.length} OR "phone" ILIKE $${params.length})`;
    }

    params.push(limit);
    params.push(offset);

    try {
      const customers = await client.$queryRawUnsafe(
        `SELECT * FROM "customers"
         WHERE ${whereClause}
         ORDER BY "createdAt" DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        ...params,
      ) as any[];

      const countResult = await client.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "customers" WHERE ${whereClause}`,
        ...params.slice(0, params.length - 2),
      ) as any[];

      const total = parseInt(countResult[0].count);

      return {
        success: true,
        message: 'Customers fetched successfully',
        data: customers,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error(`[Customers] slug=${slug} failed`, error);
      throw error;
    }
  }

  async findOne(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const result = await client.$queryRawUnsafe(
      `SELECT * FROM "customers" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      id,
    ) as any[];

    if (!result || result.length === 0) {
      throw new NotFoundException('Customer not found');
    }

    return {
      success: true,
      message: 'Customer fetched successfully',
      data: result[0],
    };
  }

  async create(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    // Opening balance: what they owed (customer) / what you owed (supplier)
    // on the day you started using MyERP. Negative = advance.
    const opening = Math.round((Number(body.openingBalance) || 0) * 100) / 100;
    if (!String(body.name || '').trim()) throw new BadRequestException('Enter a name');
    await ensureTenantUpgrades(client, slug);
    const result = await client.$transaction(async (tx: any) => {
      const rows = (await tx.$queryRawUnsafe(
        `INSERT INTO "customers" ("id", "name", "email", "phone", "address", "balance")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
         RETURNING *`,
        String(body.name).trim(),
        body.email || null,
        body.phone || null,
        body.address || null,
        opening,
      )) as any[];
      if (opening) await postOpeningBalance(tx, 'customer', rows[0], opening);
      return rows;
    }, TX_OPTIONS) as any[];

    await this.auditService.log(slug, {
      action: 'CREATED',
      module: 'contacts',
      recordId: result[0].id,
      description: `Customer "${body.name}" created`,
    });

    return {
      success: true,
      message: 'Customer created successfully',
      data: result[0],
    };
  }

  async update(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const result = await client.$queryRawUnsafe(
      `UPDATE "customers"
       SET "name" = $1, "email" = $2, "phone" = $3, "address" = $4, "updatedAt" = NOW()
       WHERE "id" = $5::uuid AND "isDeleted" = false
       RETURNING *`,
      body.name,
      body.email || null,
      body.phone || null,
      body.address || null,
      id,
    ) as any[];

    if (!result || result.length === 0) {
      throw new NotFoundException('Customer not found');
    }

    await this.auditService.log(slug, {
      action: 'UPDATED',
      module: 'contacts',
      recordId: id,
      description: `Customer "${body.name}" updated`,
    });

    return {
      success: true,
      message: 'Customer updated successfully',
      data: result[0],
    };
  }

  async remove(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);

    await client.$queryRawUnsafe(
      `UPDATE "customers"
       SET "isDeleted" = true, "deletedAt" = NOW()
       WHERE "id" = $1::uuid`,
      id,
    );

    await this.auditService.log(slug, {
      action: 'DELETED',
      module: 'contacts',
      recordId: id,
      description: `Customer deleted`,
    });

    return {
      success: true,
      message: 'Customer deleted successfully',
    };
  }
}