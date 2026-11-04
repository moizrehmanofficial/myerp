import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ensureTenantUpgrades, nextDocNumber } from './tenant-doc.helper';

@Injectable()
export class TenantManufacturingService {
  constructor(private tenantService: TenantService) {}

  async findAll(slug: string, page = 1, limit = 25) {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    const orders = await client.$queryRawUnsafe(
      `SELECT mo.*, p."name" as "productName", p."sku" as "productSku", p."unit" as "productUnit"
       FROM "manufacturing_orders" mo
       JOIN "products" p ON mo."productId" = p."id"
       WHERE mo."isDeleted" = false
       ORDER BY mo."createdAt" DESC
       LIMIT $1 OFFSET $2`,
      limit, offset,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "manufacturing_orders" WHERE "isDeleted" = false`,
    ) as any[];

    return {
      success: true,
      data: orders,
      meta: {
        total: Number(countResult[0].count),
        page, limit,
        totalPages: Math.ceil(Number(countResult[0].count) / limit),
      },
    };
  }

  async findOne(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const orders = await client.$queryRawUnsafe(
      `SELECT mo.*, p."name" as "productName", p."sku" as "productSku", p."unit" as "productUnit", p."stock" as "currentStock"
       FROM "manufacturing_orders" mo
       JOIN "products" p ON mo."productId" = p."id"
       WHERE mo."id" = $1::uuid AND mo."isDeleted" = false LIMIT 1`,
      id,
    ) as any[];

    if (!orders.length) throw new NotFoundException('Manufacturing order not found');

    const materials = await client.$queryRawUnsafe(
      `SELECT mm.*, p."name" as "productName", p."sku" as "productSku", p."stock" as "availableStock", p."unit"
       FROM "manufacturing_materials" mm
       JOIN "products" p ON mm."productId" = p."id"
       WHERE mm."manufacturingOrderId" = $1::uuid`,
      id,
    ) as any[];

    return { success: true, data: { ...orders[0], materials } };
  }

  async create(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    await ensureTenantUpgrades(client, slug);
    const orderNumber = await nextDocNumber(client, 'manufacturing');

    const orderResult = await client.$queryRawUnsafe(
      `INSERT INTO "manufacturing_orders" (
        "id", "orderNumber", "productId", "quantity",
        "status", "startDate", "endDate", "notes"
      ) VALUES (
        gen_random_uuid(), $1, $2::uuid, $3, 'PLANNED', $4, $5, $6
      ) RETURNING *`,
      orderNumber,
      body.productId,
      parseFloat(body.quantity),
      body.startDate || null,
      body.endDate || null,
      body.notes || null,
    ) as any[];

    const order = orderResult[0];

    for (const material of (body.materials || [])) {
      await client.$queryRawUnsafe(
        `INSERT INTO "manufacturing_materials" (
          "id", "manufacturingOrderId", "productId", "requiredQuantity"
        ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3)`,
        order.id,
        material.productId,
        parseFloat(material.requiredQuantity),
      );
    }

    return { success: true, message: 'Manufacturing order created', data: order };
  }

  async updateStatus(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const orders = await client.$queryRawUnsafe(
      `SELECT * FROM "manufacturing_orders" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      id,
    ) as any[];

    if (!orders.length) throw new NotFoundException('Order not found');
    const order = orders[0];

    const wasCompleted = order.status === 'COMPLETED';
    const nowCompleted = body.status === 'COMPLETED';

    await client.$queryRawUnsafe(
      `UPDATE "manufacturing_orders"
       SET "status" = $1, "updatedAt" = NOW()
       WHERE "id" = $2::uuid`,
      body.status, id,
    );

    // When COMPLETED — deduct raw materials and add finished product to stock
    if (!wasCompleted && nowCompleted) {
      const materials = await client.$queryRawUnsafe(
        `SELECT * FROM "manufacturing_materials" WHERE "manufacturingOrderId" = $1::uuid`, id,
      ) as any[];

      // Deduct raw materials
      for (const mat of materials) {
        await client.$queryRawUnsafe(
          `UPDATE "products" SET "stock" = "stock" - $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
          parseFloat(mat.requiredQuantity), mat.productId,
        );
        await client.$queryRawUnsafe(
          `INSERT INTO "inventory_transactions" ("id", "productId", "type", "quantity", "reference", "notes")
           VALUES (gen_random_uuid(), $1::uuid, 'OUT', $2, $3, 'Manufacturing - Raw Material Used')`,
          mat.productId, parseFloat(mat.requiredQuantity), id,
        );
        // Mark as used
        await client.$queryRawUnsafe(
          `UPDATE "manufacturing_materials" SET "usedQuantity" = $1 WHERE "id" = $2::uuid`,
          parseFloat(mat.requiredQuantity), mat.id,
        );
      }

      // Add finished product to stock
      await client.$queryRawUnsafe(
        `UPDATE "products" SET "stock" = "stock" + $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
        parseFloat(order.quantity), order.productId,
      );
      await client.$queryRawUnsafe(
        `INSERT INTO "inventory_transactions" ("id", "productId", "type", "quantity", "reference", "notes")
         VALUES (gen_random_uuid(), $1::uuid, 'IN', $2, $3, 'Manufacturing - Finished Product')`,
        order.productId, parseFloat(order.quantity), id,
      );
    }

    return { success: true, message: 'Status updated' };
  }

  async remove(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await client.$queryRawUnsafe(
      `UPDATE "manufacturing_orders" SET "isDeleted" = true WHERE "id" = $1::uuid`, id,
    );
    return { success: true, message: 'Order deleted' };
  }

  async getProducts(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT "id", "name", "sku", "stock", "unit" FROM "products"
       WHERE "isDeleted" = false AND "status" = 'ACTIVE'
       ORDER BY "name" ASC`,
    ) as any[];
    return { success: true, data: result };
  }
}