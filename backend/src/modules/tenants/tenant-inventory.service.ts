import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantInventoryService {
  constructor(private tenantService: TenantService) {}

  async getStockOverview(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const products = await client.$queryRawUnsafe(
      `SELECT p.*, c."name" as "categoryName", b."name" as "brandName"
       FROM "products" p
       LEFT JOIN "categories" c ON p."categoryId" = c."id"
       LEFT JOIN "brands" b ON p."brandId" = b."id"
       WHERE p."isDeleted" = false
       ORDER BY p."stock" ASC`,
    ) as any[];

    const statsResult = await client.$queryRawUnsafe(
      `SELECT
        COUNT(*) as "totalProducts",
        SUM("stock") as "totalStock",
        SUM("stock" * "purchasePrice") as "stockValue",
        COUNT(CASE WHEN "stock" <= "minStock" THEN 1 END) as "lowStockCount",
        COUNT(CASE WHEN "stock" = 0 THEN 1 END) as "outOfStockCount"
       FROM "products"
       WHERE "isDeleted" = false`,
    ) as any[];

    const raw = statsResult[0];
    const stats = {
      totalProducts: Number(raw.totalProducts || 0),
      totalStock: Number(raw.totalStock || 0),
      stockValue: Number(raw.stockValue || 0),
      lowStockCount: Number(raw.lowStockCount || 0),
      outOfStockCount: Number(raw.outOfStockCount || 0),
    };

    return {
      success: true,
      data: {
        products,
        stats,
      },
    };
  }

  async getTransactions(slug: string, page = 1, limit = 25, productId = '') {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    let whereClause = `1=1`;
    const params: any[] = [];

    if (productId) {
      params.push(productId);
      whereClause += ` AND it."productId" = $${params.length}::uuid`;
    }

    params.push(limit);
    params.push(offset);

    const transactions = await client.$queryRawUnsafe(
      `SELECT it.*, p."name" as "productName", p."sku" as "productSku", p."unit" as "productUnit"
       FROM "inventory_transactions" it
       LEFT JOIN "products" p ON it."productId" = p."id"
       WHERE ${whereClause}
       ORDER BY it."createdAt" DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      ...params,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "inventory_transactions" it WHERE ${whereClause}`,
      ...params.slice(0, params.length - 2),
    ) as any[];

    const total = Number(countResult[0].count || 0);

    return {
      success: true,
      data: transactions,
      meta: {
        total,
        page, limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async adjustStock(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const products = await client.$queryRawUnsafe(
      `SELECT * FROM "products" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      body.productId,
    ) as any[];

    if (!products || products.length === 0) {
      throw new Error('Product not found');
    }

    const product = products[0];
    const adjustment = parseFloat(body.quantity);
    const type = body.type; // 'ADD' or 'SUBTRACT'

    let newStock: number;
    if (type === 'ADD') {
      newStock = parseFloat(product.stock) + adjustment;
    } else {
      newStock = parseFloat(product.stock) - adjustment;
      if (newStock < 0) newStock = 0;
    }

    await client.$queryRawUnsafe(
      `UPDATE "products" SET "stock" = $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
      newStock,
      body.productId,
    );

    await client.$queryRawUnsafe(
      `INSERT INTO "inventory_transactions" (
        "id", "productId", "type", "quantity", "reference", "notes"
      ) VALUES (gen_random_uuid(), $1::uuid, $2, $3, 'MANUAL_ADJUSTMENT', $4)`,
      body.productId,
      type === 'ADD' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
      adjustment,
      body.notes || null,
    );

    return {
      success: true,
      message: 'Stock adjusted successfully',
      data: { previousStock: product.stock, newStock, adjustment, type },
    };
  }
}