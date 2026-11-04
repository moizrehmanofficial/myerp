import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import {
  ensureTenantUpgrades,
  nextDocNumber,
  stockIn,
  stockOut,
  groupQtyByProduct,
  TX_OPTIONS,
  round2,
} from './tenant-doc.helper';

@Injectable()
export class TenantPurchaseService {
  constructor(private tenantService: TenantService) {}

  async findAll(slug: string, page = 1, limit = 25, search = '') {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    let whereClause = `po."isDeleted" = false`;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (po."orderNumber" ILIKE $${params.length} OR s."name" ILIKE $${params.length})`;
    }

    params.push(limit);
    params.push(offset);

    const orders = await client.$queryRawUnsafe(
      `SELECT po.*, s."name" as "supplierName", s."phone" as "supplierPhone"
       FROM "purchase_orders" po
       LEFT JOIN "suppliers" s ON po."supplierId" = s."id"
       WHERE ${whereClause}
       ORDER BY po."createdAt" DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      ...params,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "purchase_orders" po
       LEFT JOIN "suppliers" s ON po."supplierId" = s."id"
       WHERE ${whereClause}`,
      ...params.slice(0, params.length - 2),
    ) as any[];

    return {
      success: true,
      data: orders,
      meta: {
        total: parseInt(countResult[0].count),
        page, limit,
        totalPages: Math.ceil(parseInt(countResult[0].count) / limit),
      },
    };
  }

  async findOne(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const orders = await client.$queryRawUnsafe(
      `SELECT po.*, s."name" as "supplierName", s."email" as "supplierEmail",
              s."phone" as "supplierPhone", s."address" as "supplierAddress"
       FROM "purchase_orders" po
       LEFT JOIN "suppliers" s ON po."supplierId" = s."id"
       WHERE po."id" = $1::uuid AND po."isDeleted" = false LIMIT 1`,
      id,
    ) as any[];

    if (!orders || orders.length === 0) throw new NotFoundException('Purchase order not found');

    const items = await client.$queryRawUnsafe(
      `SELECT pi.*, p."name" as "productName", p."sku" as "productSku", p."unit" as "productUnit"
       FROM "purchase_items" pi
       LEFT JOIN "products" p ON pi."productId" = p."id"
       WHERE pi."purchaseOrderId" = $1::uuid`,
      id,
    ) as any[];

    return { success: true, data: { ...orders[0], items } };
  }

  async create(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    if (!body.supplierId) throw new BadRequestException('Please select a supplier');
    const items = (Array.isArray(body.items) ? body.items : [])
      .filter((i: any) => i && i.productId)
      .map((i: any) => {
        const quantity = Number(i.quantity);
        const unitPrice = Number(i.unitPrice);
        if (!(quantity > 0)) throw new BadRequestException('Quantity must be greater than 0');
        if (!(unitPrice >= 0)) throw new BadRequestException('Price cannot be negative');
        return { productId: i.productId, quantity, unitPrice, totalPrice: round2(quantity * unitPrice) };
      });
    if (items.length === 0) throw new BadRequestException('Add at least one product');

    const totalAmount = round2(items.reduce((sum: number, i: any) => sum + i.totalPrice, 0));

    const order = await client.$transaction(async (tx: any) => {
      const orderNumber = await nextDocNumber(tx, 'purchase');

      const orderResult = (await tx.$queryRawUnsafe(
        `INSERT INTO "purchase_orders" (
          "id", "orderNumber", "supplierId", "status", "totalAmount", "notes"
        ) VALUES (
          gen_random_uuid(), $1, $2::uuid, $3, $4, $5
        ) RETURNING *`,
        orderNumber,
        body.supplierId,
        body.status || 'PENDING',
        totalAmount,
        body.notes || null,
      )) as any[];
      const created = orderResult[0];

      for (const item of items) {
        await tx.$queryRawUnsafe(
          `INSERT INTO "purchase_items" (
            "id", "purchaseOrderId", "productId", "quantity", "unitPrice", "totalPrice"
          ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5)`,
          created.id,
          item.productId,
          item.quantity,
          item.unitPrice,
          item.totalPrice,
        );
      }

      // Goods received → stock goes up
      if (created.status === 'RECEIVED') {
        for (const [productId, qty] of groupQtyByProduct(items)) {
          await stockIn(tx, productId, qty, orderNumber, 'Purchase received');
        }
      }
      return created;
    }, TX_OPTIONS);

    return { success: true, message: 'Purchase order created successfully', data: order };
  }

  async updateStatus(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    if (!body.status) throw new BadRequestException('Status is required');

    await client.$transaction(async (tx: any) => {
      const orders = (await tx.$queryRawUnsafe(
        `SELECT * FROM "purchase_orders" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1 FOR UPDATE`,
        id,
      )) as any[];
      if (!orders || orders.length === 0) throw new NotFoundException('Purchase order not found');

      const order = orders[0];
      const wasReceived = order.status === 'RECEIVED';
      const nowReceived = body.status === 'RECEIVED';

      if (wasReceived !== nowReceived) {
        const items = (await tx.$queryRawUnsafe(
          `SELECT "productId", "quantity" FROM "purchase_items" WHERE "purchaseOrderId" = $1::uuid`,
          id,
        )) as any[];

        for (const [productId, qty] of groupQtyByProduct(items)) {
          if (nowReceived) {
            await stockIn(tx, productId, qty, order.orderNumber, 'Purchase received');
          } else {
            // Un-receiving: take the stock back out (blocked if already sold)
            await stockOut(tx, productId, qty, order.orderNumber, `Purchase status → ${body.status}`);
          }
        }
      }

      await tx.$queryRawUnsafe(
        `UPDATE "purchase_orders" SET "status" = $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
        body.status,
        id,
      );
    }, TX_OPTIONS);

    return { success: true, message: 'Status updated successfully' };
  }

  async remove(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);

    await client.$transaction(async (tx: any) => {
      const orders = (await tx.$queryRawUnsafe(
        `SELECT * FROM "purchase_orders" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1 FOR UPDATE`,
        id,
      )) as any[];
      if (!orders || orders.length === 0) throw new NotFoundException('Purchase order not found');
      const order = orders[0];

      // Deleting a received order removes its stock again
      if (order.status === 'RECEIVED') {
        const items = (await tx.$queryRawUnsafe(
          `SELECT "productId", "quantity" FROM "purchase_items" WHERE "purchaseOrderId" = $1::uuid`,
          id,
        )) as any[];
        for (const [productId, qty] of groupQtyByProduct(items)) {
          await stockOut(tx, productId, qty, order.orderNumber, 'Purchase order deleted');
        }
      }

      await tx.$queryRawUnsafe(
        `UPDATE "purchase_orders" SET "isDeleted" = true, "deletedAt" = NOW() WHERE "id" = $1::uuid`,
        id,
      );
    }, TX_OPTIONS);

    return { success: true, message: 'Purchase order deleted successfully' };
  }

  async getSuppliers(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT "id", "name", "phone" FROM "suppliers"
       WHERE "isDeleted" = false ORDER BY "name" ASC`,
    ) as any[];
    return { success: true, data: result };
  }

  async getProducts(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT "id", "name", "sku", "purchasePrice", "stock", "unit"
       FROM "products"
       WHERE "isDeleted" = false AND "status" = 'ACTIVE'
       ORDER BY "name" ASC`,
    ) as any[];
    return { success: true, data: result };
  }
}