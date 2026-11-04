import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ensureTenantUpgrades, nextDocNumber, TX_OPTIONS, round2 } from './tenant-doc.helper';

@Injectable()
export class TenantSalesService {
  constructor(private tenantService: TenantService) {}

  async findAll(slug: string, page = 1, limit = 25, search = '') {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    let whereClause = `so."isDeleted" = false`;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (so."orderNumber" ILIKE $${params.length} OR c."name" ILIKE $${params.length})`;
    }

    params.push(limit);
    params.push(offset);

    const orders = await client.$queryRawUnsafe(
      `SELECT so.*, c."name" as "customerName", c."phone" as "customerPhone"
       FROM "sales_orders" so
       LEFT JOIN "customers" c ON so."customerId" = c."id"
       WHERE ${whereClause}
       ORDER BY so."createdAt" DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      ...params,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "sales_orders" so
       LEFT JOIN "customers" c ON so."customerId" = c."id"
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
      `SELECT so.*, c."name" as "customerName", c."email" as "customerEmail",
              c."phone" as "customerPhone", c."address" as "customerAddress"
       FROM "sales_orders" so
       LEFT JOIN "customers" c ON so."customerId" = c."id"
       WHERE so."id" = $1::uuid AND so."isDeleted" = false LIMIT 1`,
      id,
    ) as any[];

    if (!orders || orders.length === 0) throw new NotFoundException('Sales order not found');

    const items = await client.$queryRawUnsafe(
      `SELECT si.*, p."name" as "productName", p."sku" as "productSku", p."unit" as "productUnit"
       FROM "sales_items" si
       LEFT JOIN "products" p ON si."productId" = p."id"
       WHERE si."salesOrderId" = $1::uuid`,
      id,
    ) as any[];

    return { success: true, data: { ...orders[0], items } };
  }

  async create(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    if (!body.customerId) throw new BadRequestException('Please select a customer');
    const items = (Array.isArray(body.items) ? body.items : [])
      .filter((i: any) => i && i.productId)
      .map((i: any) => {
        const quantity = Number(i.quantity);
        const unitPrice = Number(i.unitPrice);
        const discount = Number(i.discount) || 0;
        if (!(quantity > 0)) throw new BadRequestException('Quantity must be greater than 0');
        if (!(unitPrice >= 0) || discount < 0) throw new BadRequestException('Invalid price or discount');
        return { ...i, quantity, unitPrice, discount, totalPrice: round2(quantity * unitPrice - discount) };
      });
    if (items.length === 0) throw new BadRequestException('Add at least one product');

    // Subtotal = sum of line totals (after item discounts), same as invoices
    const subtotal = round2(items.reduce((sum: number, i: any) => sum + i.totalPrice, 0));
    const discount = Number(body.discount) || 0;
    const tax = Number(body.tax) || 0;
    const totalAmount = round2(subtotal - discount + tax);

    // NOTE: Sales orders do NOT change stock any more.
    // Stock goes down only when a sale INVOICE is created.
    const order = await client.$transaction(async (tx: any) => {
      const orderNumber = await nextDocNumber(tx, 'sales');

      const orderResult = (await tx.$queryRawUnsafe(
        `INSERT INTO "sales_orders" (
          "id", "orderNumber", "customerId", "status",
          "subtotal", "discount", "tax", "totalAmount", "notes"
        ) VALUES (
          gen_random_uuid(), $1, $2::uuid, $3, $4, $5, $6, $7, $8
        ) RETURNING *`,
        orderNumber,
        body.customerId,
        body.status || 'PENDING',
        subtotal,
        discount,
        tax,
        totalAmount,
        body.notes || null,
      )) as any[];
      const created = orderResult[0];

      for (const item of items) {
        await tx.$queryRawUnsafe(
          `INSERT INTO "sales_items" (
            "id", "salesOrderId", "productId", "quantity", "unitPrice", "discount", "totalPrice"
          ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, $6)`,
          created.id,
          item.productId,
          item.quantity,
          item.unitPrice,
          item.discount,
          item.totalPrice,
        );
      }
      return created;
    }, TX_OPTIONS);

    return { success: true, message: 'Sales order created successfully', data: order };
  }

  async updateStatus(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const orders = await client.$queryRawUnsafe(
      `SELECT * FROM "sales_orders" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      id,
    ) as any[];

    if (!orders || orders.length === 0) throw new NotFoundException('Sales order not found');

    await client.$queryRawUnsafe(
      `UPDATE "sales_orders" SET "status" = $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
      body.status, id,
    );

    return { success: true, message: 'Status updated successfully' };
  }

  async remove(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await client.$queryRawUnsafe(
      `UPDATE "sales_orders" SET "isDeleted" = true, "deletedAt" = NOW() WHERE "id" = $1::uuid`, id,
    );
    return { success: true, message: 'Sales order deleted successfully' };
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
      `SELECT "id", "name", "sku", "salePrice", "stock", "unit"
       FROM "products"
       WHERE "isDeleted" = false AND "status" = 'ACTIVE'
       ORDER BY "name" ASC`,
    ) as any[];
    return { success: true, data: result };
  }
}