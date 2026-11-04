import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantProductsService {
  constructor(private tenantService: TenantService) {}

  async findAll(slug: string, page = 1, limit = 25, search = '') {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    let whereClause = `p."isDeleted" = false`;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (p."name" ILIKE $${params.length} OR p."sku" ILIKE $${params.length})`;
    }

    params.push(limit);
    params.push(offset);

    const products = await client.$queryRawUnsafe(
      `SELECT p.*, c."name" as "categoryName", b."name" as "brandName"
       FROM "products" p
       LEFT JOIN "categories" c ON p."categoryId" = c."id"
       LEFT JOIN "brands" b ON p."brandId" = b."id"
       WHERE ${whereClause}
       ORDER BY p."createdAt" DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      ...params,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "products" p WHERE ${whereClause}`,
      ...params.slice(0, params.length - 2),
    ) as any[];

    const total = parseInt(countResult[0].count);

    return {
      success: true,
      message: 'Products fetched successfully',
      data: products,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const result = await client.$queryRawUnsafe(
      `SELECT p.*, c."name" as "categoryName", b."name" as "brandName"
       FROM "products" p
       LEFT JOIN "categories" c ON p."categoryId" = c."id"
       LEFT JOIN "brands" b ON p."brandId" = b."id"
       WHERE p."id" = $1::uuid AND p."isDeleted" = false LIMIT 1`,
      id,
    ) as any[];

    if (!result || result.length === 0) {
      throw new NotFoundException('Product not found');
    }

    return {
      success: true,
      message: 'Product fetched successfully',
      data: result[0],
    };
  }

  async create(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const result = await client.$queryRawUnsafe(
      `INSERT INTO "products" (
        "id", "sku", "barcode", "name", "categoryId", "brandId",
        "unit", "purchasePrice", "salePrice", "minStock", "maxStock", "status"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE'
      ) RETURNING *`,
      body.sku,
      body.barcode || null,
      body.name,
      body.categoryId || null,
      body.brandId || null,
      body.unit || 'pcs',
      body.purchasePrice || 0,
      body.salePrice || 0,
      body.minStock || 0,
      body.maxStock || 0,
    ) as any[];

    return {
      success: true,
      message: 'Product created successfully',
      data: result[0],
    };
  }

  async update(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const result = await client.$queryRawUnsafe(
      `UPDATE "products"
       SET "name" = $1, "sku" = $2, "barcode" = $3,
           "unit" = $4, "purchasePrice" = $5, "salePrice" = $6,
           "minStock" = $7, "maxStock" = $8,
           "categoryId" = $10::uuid, "brandId" = $11::uuid, "updatedAt" = NOW()
       WHERE "id" = $9::uuid AND "isDeleted" = false
       RETURNING *`,
      body.name,
      body.sku,
      body.barcode || null,
      body.unit || 'pcs',
      body.purchasePrice || 0,
      body.salePrice || 0,
      body.minStock || 0,
      body.maxStock || 0,
      id,
      body.categoryId || null,
      body.brandId || null,
    ) as any[];

    if (!result || result.length === 0) {
      throw new NotFoundException('Product not found');
    }

    return {
      success: true,
      message: 'Product updated successfully',
      data: result[0],
    };
  }

  async remove(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);

    await client.$queryRawUnsafe(
      `UPDATE "products"
       SET "isDeleted" = true, "deletedAt" = NOW()
       WHERE "id" = $1::uuid`,
      id,
    );

    return {
      success: true,
      message: 'Product deleted successfully',
    };
  }

  async getCategories(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT c.*, (SELECT COUNT(*) FROM "products" p WHERE p."categoryId" = c."id" AND p."isDeleted" = false) as "productCount"
       FROM "categories" c ORDER BY c."name" ASC`,
    ) as any[];

    const data = result.map((r: any) => ({ ...r, productCount: Number(r.productCount || 0) }));
    return { success: true, data };
  }

  async createCategory(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `INSERT INTO "categories" ("id", "name") VALUES (gen_random_uuid(), $1) RETURNING *`,
      body.name,
    ) as any[];
    return { success: true, message: 'Category created successfully', data: result[0] };
  }

  async deleteCategory(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await client.$queryRawUnsafe(`DELETE FROM "categories" WHERE "id" = $1::uuid`, id);
    return { success: true, message: 'Category deleted successfully' };
  }

  async getBrands(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT b.*, (SELECT COUNT(*) FROM "products" p WHERE p."brandId" = b."id" AND p."isDeleted" = false) as "productCount"
       FROM "brands" b ORDER BY b."name" ASC`,
    ) as any[];

    const data = result.map((r: any) => ({ ...r, productCount: Number(r.productCount || 0) }));
    return { success: true, data };
  }

  async createBrand(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `INSERT INTO "brands" ("id", "name") VALUES (gen_random_uuid(), $1) RETURNING *`,
      body.name,
    ) as any[];
    return { success: true, message: 'Brand created successfully', data: result[0] };
  }

  async deleteBrand(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await client.$queryRawUnsafe(`DELETE FROM "brands" WHERE "id" = $1::uuid`, id);
    return { success: true, message: 'Brand deleted successfully' };
  }
}