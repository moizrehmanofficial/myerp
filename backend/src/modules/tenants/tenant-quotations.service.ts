import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantAuditService } from './tenant-audit.service';
import { TenantInvoicesService } from './tenant-invoices.service';
import { ensureTenantUpgrades, nextDocNumber, round2, TX_OPTIONS } from './tenant-doc.helper';

// A quotation is a price offer. It changes nothing (no stock, no balance,
// no accounts). When the customer agrees it becomes a draft invoice.
const STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'];

@Injectable()
export class TenantQuotationsService {
  constructor(
    private tenantService: TenantService,
    private auditService: TenantAuditService,
    private invoicesService: TenantInvoicesService,
  ) {}

  private async client(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);
    return client;
  }

  async findAll(slug: string, page = 1, limit = 25, search = '', status = '') {
    const client = await this.client(slug);
    const offset = (page - 1) * limit;
    let where = `q."isDeleted" = false`;
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (q."quotationNumber" ILIKE $${params.length} OR c."name" ILIKE $${params.length})`;
    }
    if (status === 'expired') {
      where += ` AND q."status" IN ('DRAFT', 'SENT') AND q."validUntil" IS NOT NULL AND q."validUntil"::date < CURRENT_DATE`;
    } else if (status) {
      params.push(String(status).toUpperCase());
      where += ` AND q."status" = $${params.length}`;
    }
    const rows = (await client.$queryRawUnsafe(
      `SELECT q.*, c."name" AS "customerName", c."phone" AS "customerPhone", i."invoiceNumber"
       FROM "quotations" q
       LEFT JOIN "customers" c ON c."id" = q."customerId"
       LEFT JOIN "invoices" i ON i."id" = q."invoiceId"
       WHERE ${where}
       ORDER BY q."createdAt" DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      ...params,
      limit,
      offset,
    )) as any[];
    const count = (await client.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM "quotations" q LEFT JOIN "customers" c ON c."id" = q."customerId" WHERE ${where}`,
      ...params,
    )) as any[];
    const total = Number(count[0]?.n || 0);
    return { success: true, data: rows, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(slug: string, id: string) {
    const client = await this.client(slug);
    const rows = (await client.$queryRawUnsafe(
      `SELECT q.*, c."name" AS "customerName", c."email" AS "customerEmail", c."phone" AS "customerPhone",
              c."address" AS "customerAddress", i."invoiceNumber"
       FROM "quotations" q
       LEFT JOIN "customers" c ON c."id" = q."customerId"
       LEFT JOIN "invoices" i ON i."id" = q."invoiceId"
       WHERE q."id" = $1::uuid AND q."isDeleted" = false LIMIT 1`,
      id,
    )) as any[];
    if (!rows.length) throw new NotFoundException('Quotation not found');
    const items = (await client.$queryRawUnsafe(
      `SELECT qi.*, p."name" AS "productName", p."sku" AS "productSku", p."stock"
       FROM "quotation_items" qi LEFT JOIN "products" p ON p."id" = qi."productId"
       WHERE qi."quotationId" = $1::uuid`,
      id,
    )) as any[];
    return { success: true, data: { ...rows[0], items } };
  }

  private calculate(body: any) {
    if (!body.customerId) throw new BadRequestException('Please select a customer');
    const items = (Array.isArray(body.items) ? body.items : [])
      .filter((i: any) => i && i.productId)
      .map((i: any) => {
        const quantity = Number(i.quantity);
        const unitPrice = Number(i.unitPrice);
        const discount = Number(i.discount) || 0;
        if (!(quantity > 0)) throw new BadRequestException('Quantity must be greater than 0');
        if (!(unitPrice >= 0)) throw new BadRequestException('Price cannot be negative');
        if (discount < 0 || discount > quantity * unitPrice) throw new BadRequestException('Item discount is not valid');
        return { productId: i.productId, quantity, unitPrice, discount, totalPrice: round2(quantity * unitPrice - discount) };
      });
    if (!items.length) throw new BadRequestException('Add at least one product');
    const subtotal = round2(items.reduce((s: number, i: any) => s + i.totalPrice, 0));
    const discount = Number(body.discount) || 0;
    const tax = Number(body.tax) || 0;
    if (discount < 0 || tax < 0) throw new BadRequestException('Discount/tax cannot be negative');
    if (discount > subtotal) throw new BadRequestException('Discount cannot be more than subtotal');
    return { items, subtotal, discount, tax, totalAmount: round2(subtotal - discount + tax) };
  }

  private async saveItems(tx: any, id: string, items: any[]) {
    await tx.$queryRawUnsafe(`DELETE FROM "quotation_items" WHERE "quotationId" = $1::uuid`, id);
    for (const i of items) {
      await tx.$queryRawUnsafe(
        `INSERT INTO "quotation_items" ("id", "quotationId", "productId", "quantity", "unitPrice", "discount", "totalPrice")
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, $6)`,
        id, i.productId, i.quantity, i.unitPrice, i.discount, i.totalPrice,
      );
    }
  }

  async create(slug: string, body: any) {
    const client = await this.client(slug);
    const calc = this.calculate(body);
    const q = await client.$transaction(async (tx: any) => {
      const number = await nextDocNumber(tx, 'quotation');
      const rows = (await tx.$queryRawUnsafe(
        `INSERT INTO "quotations" ("id", "quotationNumber", "customerId", "status", "subtotal", "discount", "tax", "totalAmount", "validUntil", "notes")
         VALUES (gen_random_uuid(), $1, $2::uuid, 'DRAFT', $3, $4, $5, $6, $7::timestamp, $8) RETURNING *`,
        number, body.customerId, calc.subtotal, calc.discount, calc.tax, calc.totalAmount, body.validUntil || null, body.notes || null,
      )) as any[];
      await this.saveItems(tx, rows[0].id, calc.items);
      return rows[0];
    }, TX_OPTIONS);
    await this.auditService.log(slug, { action: 'CREATED', module: 'sales', recordId: q.id, description: `Quotation ${q.quotationNumber} created` });
    return { success: true, message: 'Quotation created', data: q };
  }

  async update(slug: string, id: string, body: any) {
    const client = await this.client(slug);
    const calc = this.calculate(body);
    const q = await client.$transaction(async (tx: any) => {
      const old = (await tx.$queryRawUnsafe(
        `SELECT * FROM "quotations" WHERE "id" = $1::uuid AND "isDeleted" = false FOR UPDATE`, id,
      )) as any[];
      if (!old.length) throw new NotFoundException('Quotation not found');
      if (old[0].status === 'CONVERTED') throw new BadRequestException('This quotation is already an invoice. Edit the invoice instead.');
      const rows = (await tx.$queryRawUnsafe(
        `UPDATE "quotations" SET "customerId" = $1::uuid, "subtotal" = $2, "discount" = $3, "tax" = $4, "totalAmount" = $5,
                "validUntil" = $6::timestamp, "notes" = $7, "updatedAt" = NOW()
         WHERE "id" = $8::uuid RETURNING *`,
        body.customerId, calc.subtotal, calc.discount, calc.tax, calc.totalAmount, body.validUntil || null, body.notes || null, id,
      )) as any[];
      await this.saveItems(tx, id, calc.items);
      return rows[0];
    }, TX_OPTIONS);
    await this.auditService.log(slug, { action: 'UPDATED', module: 'sales', recordId: id, description: `Quotation ${q.quotationNumber} updated` });
    return { success: true, message: 'Quotation updated', data: q };
  }

  async setStatus(slug: string, id: string, status: string) {
    const s = String(status || '').toUpperCase();
    if (!STATUSES.includes(s)) throw new BadRequestException('Unknown status');
    const client = await this.client(slug);
    const rows = (await client.$queryRawUnsafe(
      `UPDATE "quotations" SET "status" = $1, "updatedAt" = NOW()
       WHERE "id" = $2::uuid AND "isDeleted" = false AND "status" <> 'CONVERTED' RETURNING *`,
      s, id,
    )) as any[];
    if (!rows.length) throw new BadRequestException('This quotation cannot be changed');
    return { success: true, message: 'Status updated', data: rows[0] };
  }

  // Customer said yes: make a DRAFT invoice with the same lines. Nothing moves
  // until that invoice is issued, so prices and stock can still be checked.
  async convert(slug: string, id: string) {
    const { data: q } = await this.findOne(slug, id);
    if (q.status === 'CONVERTED') throw new BadRequestException(`Already turned into invoice ${q.invoiceNumber || ''}`.trim());
    if (q.status === 'REJECTED') throw new BadRequestException('This quotation was rejected');
    const res = await this.invoicesService.create(slug, {
      draft: true,
      quotationId: q.id,
      customerId: q.customerId,
      discount: Number(q.discount),
      tax: Number(q.tax),
      notes: q.notes ? `${q.notes}\nFrom quotation ${q.quotationNumber}` : `From quotation ${q.quotationNumber}`,
      items: q.items.map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), discount: Number(i.discount) })),
    });
    await this.auditService.log(slug, { action: 'UPDATED', module: 'sales', recordId: id, description: `Quotation ${q.quotationNumber} turned into invoice ${res.data.invoiceNumber}` });
    return { success: true, message: `Draft invoice ${res.data.invoiceNumber} created`, data: res.data };
  }

  async remove(slug: string, id: string) {
    const client = await this.client(slug);
    const rows = (await client.$queryRawUnsafe(
      `UPDATE "quotations" SET "isDeleted" = true, "updatedAt" = NOW() WHERE "id" = $1::uuid AND "isDeleted" = false RETURNING "quotationNumber"`,
      id,
    )) as any[];
    if (!rows.length) throw new NotFoundException('Quotation not found');
    await this.auditService.log(slug, { action: 'DELETED', module: 'sales', recordId: id, description: `Quotation ${rows[0].quotationNumber} deleted` });
    return { success: true, message: 'Quotation deleted' };
  }
}
