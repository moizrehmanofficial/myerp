import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantReturnsService {
  constructor(private tenantService: TenantService) {}

  // ── PURCHASE RETURNS ───────────────────────────────────

  async getPurchaseReturns(slug: string, page = 1, limit = 25) {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    const returns = await client.$queryRawUnsafe(
      `SELECT pr.*, s."name" as "supplierName"
       FROM "purchase_returns" pr
       LEFT JOIN "suppliers" s ON pr."supplierId" = s."id"
       ORDER BY pr."createdAt" DESC
       LIMIT $1 OFFSET $2`,
      limit, offset,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "purchase_returns"`,
    ) as any[];

    return {
      success: true,
      data: returns,
      meta: {
        total: Number(countResult[0].count),
        page, limit,
        totalPages: Math.ceil(Number(countResult[0].count) / limit),
      },
    };
  }

  async createPurchaseReturn(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "purchase_returns"`,
    ) as any[];
    const count = Number(countResult[0].count) + 1;
    const returnNumber = `PR-${String(count).padStart(5, '0')}`;

    const items = body.items || [];
    let totalAmount = 0;
    items.forEach((item: any) => {
      totalAmount += parseFloat(item.quantity) * parseFloat(item.unitPrice);
    });

    const returnResult = await client.$queryRawUnsafe(
      `INSERT INTO "purchase_returns" (
        "id", "returnNumber", "supplierId", "purchaseOrderId",
        "totalAmount", "reason", "status"
      ) VALUES (
        gen_random_uuid(), $1, $2::uuid, $3, $4, $5, 'PENDING'
      ) RETURNING *`,
      returnNumber,
      body.supplierId,
      body.purchaseOrderId || null,
      totalAmount,
      body.reason || null,
    ) as any[];

    const purchaseReturn = returnResult[0];

    for (const item of items) {
      const totalPrice = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      await client.$queryRawUnsafe(
        `INSERT INTO "purchase_return_items" (
          "id", "purchaseReturnId", "productId", "quantity", "unitPrice", "totalPrice"
        ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5)`,
        purchaseReturn.id,
        item.productId,
        parseFloat(item.quantity),
        parseFloat(item.unitPrice),
        totalPrice,
      );

      // Deduct stock when returning to supplier
      await client.$queryRawUnsafe(
        `UPDATE "products" SET "stock" = "stock" - $1, "updatedAt" = NOW()
         WHERE "id" = $2::uuid`,
        parseFloat(item.quantity),
        item.productId,
      );

      await client.$queryRawUnsafe(
        `INSERT INTO "inventory_transactions" (
          "id", "productId", "type", "quantity", "reference", "notes"
        ) VALUES (gen_random_uuid(), $1::uuid, 'OUT', $2, $3, 'Purchase Return')`,
        item.productId,
        parseFloat(item.quantity),
        purchaseReturn.id,
      );
    }

    return { success: true, message: 'Purchase return created', data: purchaseReturn };
  }

  // ── SALE RETURNS ───────────────────────────────────────

  async getSaleReturns(slug: string, page = 1, limit = 25) {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    const returns = await client.$queryRawUnsafe(
      `SELECT sr.*, c."name" as "customerName"
       FROM "sale_returns" sr
       LEFT JOIN "customers" c ON sr."customerId" = c."id"
       ORDER BY sr."createdAt" DESC
       LIMIT $1 OFFSET $2`,
      limit, offset,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "sale_returns"`,
    ) as any[];

    return {
      success: true,
      data: returns,
      meta: {
        total: Number(countResult[0].count),
        page, limit,
        totalPages: Math.ceil(Number(countResult[0].count) / limit),
      },
    };
  }

  async createSaleReturn(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "sale_returns"`,
    ) as any[];
    const count = Number(countResult[0].count) + 1;
    const returnNumber = `SR-${String(count).padStart(5, '0')}`;

    const items = body.items || [];
    let totalAmount = 0;
    items.forEach((item: any) => {
      totalAmount += parseFloat(item.quantity) * parseFloat(item.unitPrice);
    });

    const returnResult = await client.$queryRawUnsafe(
      `INSERT INTO "sale_returns" (
        "id", "returnNumber", "customerId", "invoiceId",
        "totalAmount", "reason", "status"
      ) VALUES (
        gen_random_uuid(), $1, $2::uuid, $3, $4, $5, 'PENDING'
      ) RETURNING *`,
      returnNumber,
      body.customerId,
      body.invoiceId || null,
      totalAmount,
      body.reason || null,
    ) as any[];

    const saleReturn = returnResult[0];

    for (const item of items) {
      const totalPrice = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      await client.$queryRawUnsafe(
        `INSERT INTO "sale_return_items" (
          "id", "saleReturnId", "productId", "quantity", "unitPrice", "totalPrice"
        ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5)`,
        saleReturn.id,
        item.productId,
        parseFloat(item.quantity),
        parseFloat(item.unitPrice),
        totalPrice,
      );

      // Add stock back when customer returns
      await client.$queryRawUnsafe(
        `UPDATE "products" SET "stock" = "stock" + $1, "updatedAt" = NOW()
         WHERE "id" = $2::uuid`,
        parseFloat(item.quantity),
        item.productId,
      );

      await client.$queryRawUnsafe(
        `INSERT INTO "inventory_transactions" (
          "id", "productId", "type", "quantity", "reference", "notes"
        ) VALUES (gen_random_uuid(), $1::uuid, 'IN', $2, $3, 'Sale Return')`,
        item.productId,
        parseFloat(item.quantity),
        saleReturn.id,
      );
    }

    return { success: true, message: 'Sale return created', data: saleReturn };
  }

  async getSuppliers(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT "id", "name", "phone" FROM "suppliers"
       WHERE "isDeleted" = false ORDER BY "name" ASC`,
    ) as any[];
    return { success: true, data: result };
  }

  async getCustomers(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT "id", "name", "phone" FROM "customers"
       WHERE "isDeleted" = false ORDER BY "name" ASC`,
    ) as any[];
    return { success: true, data: result };
  }

  async getProducts(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT "id", "name", "sku", "purchasePrice", "salePrice", "stock", "unit"
       FROM "products"
       WHERE "isDeleted" = false AND "status" = 'ACTIVE'
       ORDER BY "name" ASC`,
    ) as any[];
    return { success: true, data: result };
  }
}