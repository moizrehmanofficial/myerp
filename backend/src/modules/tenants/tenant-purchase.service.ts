import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';

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

    // Generate order number
    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "purchase_orders"`
    ) as any[];
    const count = parseInt(countResult[0].count) + 1;
    const orderNumber = `PO-${String(count).padStart(5, '0')}`;

    // Calculate total
    const items = body.items || [];
    let totalAmount = 0;
    items.forEach((item: any) => {
      totalAmount += parseFloat(item.quantity) * parseFloat(item.unitPrice);
    });

    // Create purchase order
    const orderResult = await client.$queryRawUnsafe(
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
    ) as any[];

    const order = orderResult[0];

    // Create items
    for (const item of items) {
      const totalPrice = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      await client.$queryRawUnsafe(
        `INSERT INTO "purchase_items" (
          "id", "purchaseOrderId", "productId", "quantity", "unitPrice", "totalPrice"
        ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5)`,
        order.id,
        item.productId,
        parseFloat(item.quantity),
        parseFloat(item.unitPrice),
        totalPrice,
      );
    }

    // If status is RECEIVED — update stock
    if (body.status === 'RECEIVED') {
      await this.updateStock(client, order.id, items);
    }

    return { success: true, message: 'Purchase order created successfully', data: order };
  }

  async updateStatus(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const orders = await client.$queryRawUnsafe(
      `SELECT * FROM "purchase_orders" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      id,
    ) as any[];

    if (!orders || orders.length === 0) throw new NotFoundException('Purchase order not found');

    const order = orders[0];
    const wasReceived = order.status === 'RECEIVED';
    const nowReceived = body.status === 'RECEIVED';

    await client.$queryRawUnsafe(
      `UPDATE "purchase_orders" SET "status" = $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
      body.status,
      id,
    );

    // Update stock when marked as RECEIVED
    if (!wasReceived && nowReceived) {
      const items = await client.$queryRawUnsafe(
        `SELECT * FROM "purchase_items" WHERE "purchaseOrderId" = $1::uuid`,
        id,
      ) as any[];
      await this.updateStock(client, id, items);
    }

    return { success: true, message: 'Status updated successfully' };
  }

  private async updateStock(client: any, orderId: string, items: any[]) {
    for (const item of items) {
      await client.$queryRawUnsafe(
        `UPDATE "products"
         SET "stock" = "stock" + $1, "updatedAt" = NOW()
         WHERE "id" = $2::uuid`,
        parseFloat(item.quantity),
        item.productId,
      );

      // Log inventory transaction
      await client.$queryRawUnsafe(
        `INSERT INTO "inventory_transactions" (
          "id", "productId", "type", "quantity", "reference"
        ) VALUES (gen_random_uuid(), $1::uuid, 'IN', $2, $3)`,
        item.productId,
        parseFloat(item.quantity),
        orderId,
      );
    }
  }

  async remove(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await client.$queryRawUnsafe(
      `UPDATE "purchase_orders" SET "isDeleted" = true, "deletedAt" = NOW() WHERE "id" = $1::uuid`,
      id,
    );
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