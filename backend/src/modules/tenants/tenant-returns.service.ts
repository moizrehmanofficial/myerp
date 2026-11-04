import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { BadRequestException } from '@nestjs/common';
import { ensureTenantUpgrades, nextDocNumber, stockIn, stockOut, groupQtyByProduct, TX_OPTIONS, round2 } from './tenant-doc.helper';
import { postSaleReturn, postPurchaseReturn, changeCustomerBalance, changeSupplierBalance } from './tenant-accounting.helper';

// Clean, validated return lines
function returnLines(body: any) {
  const items = (Array.isArray(body.items) ? body.items : [])
    .filter((i: any) => i && i.productId)
    .map((i: any) => {
      const quantity = Number(i.quantity);
      const unitPrice = Number(i.unitPrice);
      if (!(quantity > 0)) throw new BadRequestException('Quantity must be greater than 0');
      if (!(unitPrice >= 0)) throw new BadRequestException('Price cannot be negative');
      return { productId: i.productId, quantity, unitPrice, totalPrice: round2(quantity * unitPrice) };
    });
  if (!items.length) throw new BadRequestException('Add at least one product');
  return items;
}

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
    await ensureTenantUpgrades(client, slug);
    if (!body.supplierId) throw new BadRequestException('Choose the supplier');
    const items = returnLines(body);
    const totalAmount = round2(items.reduce((s: number, i: any) => s + i.totalPrice, 0));

    const purchaseReturn = await client.$transaction(async (tx: any) => {
      const returnNumber = await nextDocNumber(tx, 'purchaseReturn');
      const rows = (await tx.$queryRawUnsafe(
        `INSERT INTO "purchase_returns" (
          "id", "returnNumber", "supplierId", "purchaseOrderId", "totalAmount", "reason", "status"
        ) VALUES (gen_random_uuid(), $1, $2::uuid, $3::uuid, $4, $5, 'COMPLETED') RETURNING *`,
        returnNumber,
        body.supplierId,
        body.purchaseOrderId || null,
        totalAmount,
        body.reason || null,
      )) as any[];
      const ret = rows[0];

      for (const item of items) {
        await tx.$queryRawUnsafe(
          `INSERT INTO "purchase_return_items" (
            "id", "purchaseReturnId", "productId", "quantity", "unitPrice", "totalPrice"
          ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5)`,
          ret.id, item.productId, item.quantity, item.unitPrice, item.totalPrice,
        );
      }
      // Stock goes out (blocked if you don't have that much)
      for (const [productId, qty] of groupQtyByProduct(items)) {
        await stockOut(tx, productId, qty, returnNumber, 'Purchase return');
      }
      // We owe the supplier less
      await changeSupplierBalance(tx, body.supplierId, -totalAmount);
      await postPurchaseReturn(tx, ret);
      return ret;
    }, TX_OPTIONS);

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
    await ensureTenantUpgrades(client, slug);
    if (!body.customerId) throw new BadRequestException('Choose the customer');
    const items = returnLines(body);
    const totalAmount = round2(items.reduce((s: number, i: any) => s + i.totalPrice, 0));

    const saleReturn = await client.$transaction(async (tx: any) => {
      const returnNumber = await nextDocNumber(tx, 'saleReturn');
      const rows = (await tx.$queryRawUnsafe(
        `INSERT INTO "sale_returns" (
          "id", "returnNumber", "customerId", "invoiceId", "totalAmount", "reason", "status"
        ) VALUES (gen_random_uuid(), $1, $2::uuid, $3::uuid, $4, $5, 'COMPLETED') RETURNING *`,
        returnNumber,
        body.customerId,
        body.invoiceId || null,
        totalAmount,
        body.reason || null,
      )) as any[];
      const ret = rows[0];

      for (const item of items) {
        await tx.$queryRawUnsafe(
          `INSERT INTO "sale_return_items" (
            "id", "saleReturnId", "productId", "quantity", "unitPrice", "totalPrice"
          ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5)`,
          ret.id, item.productId, item.quantity, item.unitPrice, item.totalPrice,
        );
      }
      // Goods come back into stock
      for (const [productId, qty] of groupQtyByProduct(items)) {
        await stockIn(tx, productId, qty, returnNumber, 'Sale return');
      }
      // Customer owes less (or gets credit)
      await changeCustomerBalance(tx, body.customerId, -totalAmount);
      await postSaleReturn(tx, ret, items);
      return ret;
    }, TX_OPTIONS);

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