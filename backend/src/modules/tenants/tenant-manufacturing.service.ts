import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ensureTenantUpgrades, nextDocNumber, stockIn, stockOut, groupQtyByProduct, TX_OPTIONS, round2 } from './tenant-doc.helper';

const STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

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

    const quantity = Number(body.quantity);
    if (!body.productId) throw new BadRequestException('Choose the product to make');
    if (!(quantity > 0)) throw new BadRequestException('Quantity to make must be more than 0');
    const materials = (body.materials || [])
      .filter((m: any) => m.productId)
      .map((m: any) => ({ productId: m.productId, quantity: Number(m.requiredQuantity) }));
    if (!materials.length) throw new BadRequestException('Add at least one raw material');
    for (const m of materials) {
      if (!(m.quantity > 0)) throw new BadRequestException('Every raw material needs a quantity above 0');
      if (m.productId === body.productId) throw new BadRequestException('A product cannot be a raw material for itself');
    }

    const order = await client.$transaction(async (tx: any) => {
      const orderNumber = await nextDocNumber(tx, 'manufacturing');
      const rows = (await tx.$queryRawUnsafe(
        `INSERT INTO "manufacturing_orders" (
          "id", "orderNumber", "productId", "quantity", "status", "startDate", "endDate", "notes"
        ) VALUES (gen_random_uuid(), $1, $2::uuid, $3, 'PLANNED', $4::timestamp, $5::timestamp, $6)
        RETURNING *`,
        orderNumber,
        body.productId,
        quantity,
        body.startDate || null,
        body.endDate || null,
        body.notes || null,
      )) as any[];
      // Same material twice → one line
      for (const [productId, qty] of groupQtyByProduct(materials)) {
        await tx.$queryRawUnsafe(
          `INSERT INTO "manufacturing_materials" ("id", "manufacturingOrderId", "productId", "requiredQuantity")
           VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3)`,
          rows[0].id,
          productId,
          qty,
        );
      }
      return rows[0];
    }, TX_OPTIONS);

    return { success: true, message: 'Manufacturing order created', data: order };
  }

  // COMPLETED  → raw materials leave stock, finished product enters stock
  // moving away from COMPLETED → both are put back (only if the finished
  // goods are still in stock)
  async updateStatus(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);
    const status = String(body.status || '').toUpperCase();
    if (!STATUSES.includes(status)) throw new BadRequestException('Unknown status');

    await client.$transaction(async (tx: any) => {
      const orders = (await tx.$queryRawUnsafe(
        `SELECT * FROM "manufacturing_orders" WHERE "id" = $1::uuid AND "isDeleted" = false FOR UPDATE`,
        id,
      )) as any[];
      if (!orders.length) throw new NotFoundException('Order not found');
      const order = orders[0];
      if (order.status === status) return;

      if (order.status !== 'COMPLETED' && status === 'COMPLETED') await this.complete(tx, order);
      if (order.status === 'COMPLETED' && status !== 'COMPLETED') await this.uncomplete(tx, order, 'Production undone');

      await tx.$queryRawUnsafe(
        `UPDATE "manufacturing_orders" SET "status" = $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
        status,
        id,
      );
    }, TX_OPTIONS);

    return { success: true, message: 'Status updated' };
  }

  async remove(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);
    await client.$transaction(async (tx: any) => {
      const orders = (await tx.$queryRawUnsafe(
        `SELECT * FROM "manufacturing_orders" WHERE "id" = $1::uuid AND "isDeleted" = false FOR UPDATE`,
        id,
      )) as any[];
      if (!orders.length) throw new NotFoundException('Order not found');
      if (orders[0].status === 'COMPLETED') await this.uncomplete(tx, orders[0], 'Production order deleted');
      await tx.$queryRawUnsafe(`UPDATE "manufacturing_orders" SET "isDeleted" = true WHERE "id" = $1::uuid`, id);
    }, TX_OPTIONS);
    return { success: true, message: 'Order deleted' };
  }

  private async materials(tx: any, orderId: string) {
    return (await tx.$queryRawUnsafe(
      `SELECT * FROM "manufacturing_materials" WHERE "manufacturingOrderId" = $1::uuid`,
      orderId,
    )) as any[];
  }

  private async complete(tx: any, order: any) {
    const mats = await this.materials(tx, order.id);
    // stockOut refuses if there is not enough, and the whole thing rolls back
    let cost = 0;
    for (const m of mats) {
      const qty = Number(m.requiredQuantity);
      const p = (await tx.$queryRawUnsafe(`SELECT "purchasePrice" FROM "products" WHERE "id" = $1::uuid`, m.productId)) as any[];
      cost += qty * Number(p[0]?.purchasePrice || 0);
      await stockOut(tx, m.productId, qty, order.orderNumber, 'Used in production');
      await tx.$queryRawUnsafe(`UPDATE "manufacturing_materials" SET "usedQuantity" = $1 WHERE "id" = $2::uuid`, qty, m.id);
    }
    cost = round2(cost);

    // The finished product now carries the cost of its materials:
    // new cost price = average of the stock already there and the new batch.
    // (So cost of goods sold is right when it is sold.)
    const qty = Number(order.quantity);
    const fp = (await tx.$queryRawUnsafe(
      `SELECT "stock", "purchasePrice" FROM "products" WHERE "id" = $1::uuid FOR UPDATE`,
      order.productId,
    )) as any[];
    const oldStock = Math.max(Number(fp[0]?.stock || 0), 0);
    const oldPrice = Number(fp[0]?.purchasePrice || 0);
    if (cost > 0) {
      const avg = round2((oldStock * oldPrice + cost) / (oldStock + qty));
      await tx.$queryRawUnsafe(`UPDATE "products" SET "purchasePrice" = $1 WHERE "id" = $2::uuid`, avg, order.productId);
    }
    await tx.$queryRawUnsafe(`UPDATE "manufacturing_orders" SET "materialCost" = $1 WHERE "id" = $2::uuid`, cost, order.id);
    await stockIn(tx, order.productId, qty, order.orderNumber, 'Produced');
  }

  private async uncomplete(tx: any, order: any, why: string) {
    const qty = Number(order.quantity);
    const cost = Number(order.materialCost || 0);
    // Take the batch's cost back out of the average before removing it
    const fp = (await tx.$queryRawUnsafe(
      `SELECT "stock", "purchasePrice" FROM "products" WHERE "id" = $1::uuid FOR UPDATE`,
      order.productId,
    )) as any[];
    const stock = Number(fp[0]?.stock || 0);
    const price = Number(fp[0]?.purchasePrice || 0);
    await stockOut(tx, order.productId, qty, order.orderNumber, why);
    if (cost > 0 && stock - qty > 0) {
      const avg = Math.max(round2((stock * price - cost) / (stock - qty)), 0);
      await tx.$queryRawUnsafe(`UPDATE "products" SET "purchasePrice" = $1 WHERE "id" = $2::uuid`, avg, order.productId);
    }
    for (const m of await this.materials(tx, order.id)) {
      const used = Number(m.usedQuantity || m.requiredQuantity);
      await stockIn(tx, m.productId, used, order.orderNumber, why);
      await tx.$queryRawUnsafe(`UPDATE "manufacturing_materials" SET "usedQuantity" = 0 WHERE "id" = $1::uuid`, m.id);
    }
    await tx.$queryRawUnsafe(`UPDATE "manufacturing_orders" SET "materialCost" = 0 WHERE "id" = $1::uuid`, order.id);
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