import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantAuditService } from './tenant-audit.service';
import {
  Db,
  ensureTenantUpgrades,
  nextDocNumber,
  stockOut,
  stockIn,
  groupQtyByProduct,
  TX_OPTIONS,
  round2,
} from './tenant-doc.helper';
import {
  postInvoiceSale,
  postInvoicePayment,
  reverseSource,
} from './tenant-accounting.helper';

// Invoice is in the accounts (journal + customer balance):
// new invoices (isPosted) or old ones posted later (isJournaled)
const isAccounted = (inv: any) => inv?.isPosted === true || inv?.isJournaled === true;

@Injectable()
export class TenantInvoicesService {
  constructor(
    private tenantService: TenantService,
    private auditService: TenantAuditService,
  ) {}

  async findAll(slug: string, page = 1, limit = 25, search = '') {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    let whereClause = `i."isDeleted" = false`;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (i."invoiceNumber" ILIKE $${params.length} OR c."name" ILIKE $${params.length})`;
    }

    params.push(limit);
    params.push(offset);

    const invoices = await client.$queryRawUnsafe(
      `SELECT i.*, c."name" as "customerName", c."phone" as "customerPhone"
       FROM "invoices" i
       LEFT JOIN "customers" c ON i."customerId" = c."id"
       WHERE ${whereClause}
       ORDER BY i."createdAt" DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      ...params,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "invoices" i
       LEFT JOIN "customers" c ON i."customerId" = c."id"
       WHERE ${whereClause}`,
      ...params.slice(0, params.length - 2),
    ) as any[];

    const total = parseInt(countResult[0].count);

    return {
      success: true,
      data: invoices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(slug: string, id: string) {
    if (!id || id === 'undefined') {
      throw new NotFoundException('Invoice not found')
    }

    const client = await this.tenantService.getTenantClient(slug);

    const invoices = await client.$queryRawUnsafe(
      `SELECT i.*, c."name" as "customerName", c."email" as "customerEmail",
              c."phone" as "customerPhone", c."address" as "customerAddress"
       FROM "invoices" i
       LEFT JOIN "customers" c ON i."customerId" = c."id"
       WHERE i."id" = $1::uuid AND i."isDeleted" = false LIMIT 1`,
      id,
    ) as any[];

    if (!invoices || invoices.length === 0) {
      throw new NotFoundException('Invoice not found');
    }

    const invoice = invoices[0];

    const items = await client.$queryRawUnsafe(
      `SELECT ii.*, p."name" as "productName", p."sku" as "productSku"
       FROM "invoice_items" ii
       LEFT JOIN "products" p ON ii."productId" = p."id"
       WHERE ii."invoiceId" = $1::uuid`,
      id,
    ) as any[];

    return {
      success: true,
      data: { ...invoice, items },
    };
  }

  // ── Validate input and calculate totals (one place for create + update) ──
  private calculate(body: any, keepPaidAmount?: number) {
    if (!body.customerId) throw new BadRequestException('Please select a customer');

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items = rawItems
      .filter((i: any) => i && i.productId)
      .map((i: any) => {
        const quantity = Number(i.quantity);
        const unitPrice = Number(i.unitPrice);
        const discount = Number(i.discount) || 0;
        if (!(quantity > 0)) throw new BadRequestException('Quantity must be greater than 0');
        if (!(unitPrice >= 0)) throw new BadRequestException('Price cannot be negative');
        if (discount < 0) throw new BadRequestException('Discount cannot be negative');
        const gross = quantity * unitPrice;
        if (discount > gross) throw new BadRequestException('Item discount cannot be more than item total');
        return {
          productId: i.productId,
          quantity,
          unitPrice,
          discount,
          totalPrice: round2(gross - discount),
        };
      });

    if (items.length === 0) throw new BadRequestException('Add at least one product');

    // Subtotal = sum of line totals (after item discounts)
    const subtotal = round2(items.reduce((s: number, i: any) => s + i.totalPrice, 0));
    const discount = Number(body.discount) || 0;
    const tax = Number(body.tax) || 0;
    if (discount < 0 || tax < 0) throw new BadRequestException('Discount/tax cannot be negative');
    if (discount > subtotal) throw new BadRequestException('Discount cannot be more than subtotal');

    const totalAmount = round2(subtotal - discount + tax);
    let paidAmount = round2(
      keepPaidAmount !== undefined && body.paidAmount === undefined
        ? keepPaidAmount
        : Number(body.paidAmount) || 0,
    );
    if (paidAmount < 0) throw new BadRequestException('Paid amount cannot be negative');
    // Small rounding from the "PAID" button (e.g. 100.6 → 101) is allowed and capped
    if (paidAmount > totalAmount + 1) {
      throw new BadRequestException('Paid amount cannot be more than invoice total');
    }
    paidAmount = Math.min(paidAmount, totalAmount);

    const dueAmount = round2(Math.max(totalAmount - paidAmount, 0));
    const paymentStatus = dueAmount <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';

    return { items, subtotal, discount, tax, totalAmount, paidAmount, dueAmount, paymentStatus };
  }

  private async assertCustomer(db: Db, customerId: string) {
    const rows = (await db.$queryRawUnsafe(
      `SELECT "id" FROM "customers" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      customerId,
    )) as any[];
    if (!rows || rows.length === 0) throw new BadRequestException('Customer not found');
  }

  private async changeCustomerBalance(db: Db, customerId: string, amount: number) {
    if (!amount) return;
    await db.$queryRawUnsafe(
      `UPDATE "customers" SET "balance" = COALESCE("balance", 0) + $1, "updatedAt" = NOW()
       WHERE "id" = $2::uuid`,
      round2(amount),
      customerId,
    );
  }

  private async insertItems(db: Db, invoiceId: string, items: any[]) {
    for (const item of items) {
      await db.$queryRawUnsafe(
        `INSERT INTO "invoice_items" (
          "id", "invoiceId", "productId", "quantity", "unitPrice", "discount", "totalPrice"
        ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, $6)`,
        invoiceId,
        item.productId,
        item.quantity,
        item.unitPrice,
        item.discount,
        item.totalPrice,
      );
    }
  }

  private async recordReceipt(db: Db, invoice: any, amount: number, method?: string, notes?: string) {
    if (!(amount > 0)) return;
    await db.$queryRawUnsafe(
      `INSERT INTO "payments" ("id", "invoiceId", "customerId", "type", "method", "amount", "reference", "notes")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'RECEIPT', $3, $4, $5, $6)`,
      invoice.id,
      invoice.customerId,
      method || 'CASH',
      round2(amount),
      invoice.invoiceNumber,
      notes || `Payment for ${invoice.invoiceNumber}`,
    );
  }

  private async recordRefund(db: Db, invoice: any, amount: number, method?: string, notes?: string) {
    if (!(amount > 0)) return;
    await db.$queryRawUnsafe(
      `INSERT INTO "payments" ("id", "invoiceId", "customerId", "type", "method", "amount", "reference", "notes")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'PAYMENT', $3, $4, $5, $6)`,
      invoice.id,
      invoice.customerId,
      method || 'CASH',
      round2(amount),
      invoice.invoiceNumber,
      notes || `Refund for ${invoice.invoiceNumber}`,
    );
  }

  async create(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);
    const calc = this.calculate(body);

    // Everything below succeeds together or fails together
    const invoice = await client.$transaction(async (tx: any) => {
      await this.assertCustomer(tx, body.customerId);

      const invoiceNumber = await nextDocNumber(tx, 'invoice');

      const rows = (await tx.$queryRawUnsafe(
        `INSERT INTO "invoices" (
          "id", "invoiceNumber", "customerId", "status", "paymentStatus",
          "subtotal", "discount", "tax", "totalAmount", "paidAmount",
          "dueAmount", "dueDate", "notes", "isPosted"
        ) VALUES (
          gen_random_uuid(), $1, $2::uuid, 'CONFIRMED', $3,
          $4, $5, $6, $7, $8, $9, $10::timestamp, $11, true
        ) RETURNING *`,
        invoiceNumber,
        body.customerId,
        calc.paymentStatus,
        calc.subtotal,
        calc.discount,
        calc.tax,
        calc.totalAmount,
        calc.paidAmount,
        calc.dueAmount,
        body.dueDate || null,
        body.notes || null,
      )) as any[];
      const inv = rows[0];

      await this.insertItems(tx, inv.id, calc.items);

      // Stock goes down when the invoice is created
      for (const [productId, qty] of groupQtyByProduct(calc.items)) {
        await stockOut(tx, productId, qty, invoiceNumber, 'Sale invoice');
      }

      // Customer owes the unpaid part
      await this.changeCustomerBalance(tx, body.customerId, calc.dueAmount);

      // Money received at the time of sale
      await this.recordReceipt(tx, inv, calc.paidAmount, body.paymentMethod);

      // Accounting: AR / Sales / Tax / COGS, then the payment
      await postInvoiceSale(tx, inv, calc.items);
      await postInvoicePayment(tx, inv, calc.paidAmount, body.paymentMethod);

      return inv;
    }, TX_OPTIONS);

    await this.auditService.log(slug, {
      action: 'CREATED',
      module: 'invoices',
      recordId: invoice.id,
      description: `Invoice ${invoice.invoiceNumber} created`,
    });

    return {
      success: true,
      message: 'Invoice created successfully',
      data: invoice,
    };
  }

  async updatePayment(slug: string, id: string, body: any) {
    if (!id || id === 'undefined') {
      throw new NotFoundException('Invoice not found');
    }

    const amount = round2(Number(body.amount));
    if (!(amount > 0)) throw new BadRequestException('Payment amount must be greater than 0');

    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    const updated = await client.$transaction(async (tx: any) => {
      // FOR UPDATE = lock the row so two payments at once can't overpay
      const invoices = (await tx.$queryRawUnsafe(
        `SELECT * FROM "invoices" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1 FOR UPDATE`,
        id,
      )) as any[];
      if (!invoices || invoices.length === 0) throw new NotFoundException('Invoice not found');

      const invoice = invoices[0];
      const due = Number(invoice.dueAmount);
      if (due <= 0) throw new BadRequestException('This invoice is already fully paid');
      if (amount > due + 1) {
        throw new BadRequestException(`Payment cannot be more than due amount (${due})`);
      }

      const newPaid = round2(Math.min(Number(invoice.paidAmount) + amount, Number(invoice.totalAmount)));
      const newDue = round2(Math.max(Number(invoice.totalAmount) - newPaid, 0));
      const paymentStatus = newDue <= 0 ? 'PAID' : 'PARTIAL';

      const result = (await tx.$queryRawUnsafe(
        `UPDATE "invoices"
         SET "paidAmount" = $1, "dueAmount" = $2, "paymentStatus" = $3, "updatedAt" = NOW()
         WHERE "id" = $4::uuid
         RETURNING *`,
        newPaid,
        newDue,
        paymentStatus,
        id,
      )) as any[];

      const received = round2(due - newDue);
      if (isAccounted(invoice)) {
        await this.changeCustomerBalance(tx, invoice.customerId, -received);
        await postInvoicePayment(tx, invoice, received, body.method);
      }
      await this.recordReceipt(tx, invoice, received, body.method, body.notes);

      return result[0];
    }, TX_OPTIONS);

    await this.auditService.log(slug, {
      action: 'UPDATED',
      module: 'invoices',
      recordId: id,
      description: `Payment of ${amount} recorded on invoice ${updated.invoiceNumber}`,
    });

    return {
      success: true,
      message: 'Payment recorded successfully',
      data: updated,
    };
  }

  async remove(slug: string, id: string) {
    if (!id || id === 'undefined') {
      throw new NotFoundException('Invoice not found');
    }

    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    const invoice = await client.$transaction(async (tx: any) => {
      const invoices = (await tx.$queryRawUnsafe(
        `SELECT * FROM "invoices" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1 FOR UPDATE`,
        id,
      )) as any[];
      if (!invoices || invoices.length === 0) throw new NotFoundException('Invoice not found');
      const inv = invoices[0];

      if (inv.isPosted) {
        // Put the stock back
        const items = (await tx.$queryRawUnsafe(
          `SELECT "productId", "quantity" FROM "invoice_items" WHERE "invoiceId" = $1::uuid`,
          id,
        )) as any[];
        for (const [productId, qty] of groupQtyByProduct(items)) {
          await stockIn(tx, productId, qty, inv.invoiceNumber, 'Invoice deleted');
        }
      }
      if (isAccounted(inv)) {
        // Cancel the SALE only. Money already received stays with us and
        // becomes the customer's credit (negative balance), which can be
        // refunded from Finance → Payments (select the customer).
        await this.changeCustomerBalance(tx, inv.customerId, -Number(inv.totalAmount));
        await reverseSource(tx, 'invoice', inv.id, `Invoice ${inv.invoiceNumber} deleted`, inv.invoiceNumber);
      }

      await tx.$queryRawUnsafe(
        `UPDATE "invoices" SET "isDeleted" = true, "deletedAt" = NOW() WHERE "id" = $1::uuid`,
        id,
      );
      return inv;
    }, TX_OPTIONS);

    await this.auditService.log(slug, {
      action: 'DELETED',
      module: 'invoices',
      recordId: id,
      description: `Invoice ${invoice.invoiceNumber} deleted`,
    });

    return {
      success: true,
      message: 'Invoice deleted successfully',
    };
  }

  async update(slug: string, id: string, body: any) {
    if (!id || id === 'undefined') {
      throw new NotFoundException('Invoice not found');
    }

    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    const updated = await client.$transaction(async (tx: any) => {
      const invoices = (await tx.$queryRawUnsafe(
        `SELECT * FROM "invoices" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1 FOR UPDATE`,
        id,
      )) as any[];
      if (!invoices || invoices.length === 0) throw new NotFoundException('Invoice not found');
      const old = invoices[0];

      const calc = this.calculate(body, Number(old.paidAmount));
      await this.assertCustomer(tx, body.customerId);

      if (old.isPosted) {
        // 1. Undo the old invoice: stock back
        const oldItems = (await tx.$queryRawUnsafe(
          `SELECT "productId", "quantity" FROM "invoice_items" WHERE "invoiceId" = $1::uuid`,
          id,
        )) as any[];
        for (const [productId, qty] of groupQtyByProduct(oldItems)) {
          await stockIn(tx, productId, qty, old.invoiceNumber, 'Invoice edited (old items)');
        }
      }
      if (isAccounted(old)) {
        // ...old due off the old customer, and cancel the old sale entry
        await this.changeCustomerBalance(tx, old.customerId, -Number(old.dueAmount));
        await reverseSource(tx, 'invoice', old.id, `Invoice ${old.invoiceNumber} edited (old values)`, old.invoiceNumber);
      }

      const result = (await tx.$queryRawUnsafe(
        `UPDATE "invoices"
         SET "customerId" = $1::uuid, "paymentStatus" = $2, "subtotal" = $3,
             "discount" = $4, "tax" = $5, "totalAmount" = $6, "paidAmount" = $7,
             "dueAmount" = $8, "dueDate" = $9::timestamp, "notes" = $10, "updatedAt" = NOW()
         WHERE "id" = $11::uuid
         RETURNING *`,
        body.customerId,
        calc.paymentStatus,
        calc.subtotal,
        calc.discount,
        calc.tax,
        calc.totalAmount,
        calc.paidAmount,
        calc.dueAmount,
        body.dueDate || null,
        body.notes || null,
        id,
      )) as any[];

      await tx.$queryRawUnsafe(`DELETE FROM "invoice_items" WHERE "invoiceId" = $1::uuid`, id);
      await this.insertItems(tx, id, calc.items);

      if (old.isPosted) {
        // 2. Apply the new invoice: stock out
        for (const [productId, qty] of groupQtyByProduct(calc.items)) {
          await stockOut(tx, productId, qty, old.invoiceNumber, 'Invoice edited (new items)');
        }
      }
      if (isAccounted(old)) {
        // ...new due on the (new) customer, new sale entry, and any change in paid amount
        await this.changeCustomerBalance(tx, body.customerId, calc.dueAmount);
        await postInvoiceSale(tx, result[0], calc.items);
        const paidChange = round2(calc.paidAmount - Number(old.paidAmount));
        await postInvoicePayment(tx, result[0], paidChange, body.paymentMethod);
        if (paidChange > 0) await this.recordReceipt(tx, result[0], paidChange, body.paymentMethod, 'Paid amount changed on edit');
        // Received amount lowered = money given back; keep it in the payment history
        if (paidChange < 0) await this.recordRefund(tx, result[0], -paidChange, body.paymentMethod, 'Received amount lowered on edit');
      }

      return result[0];
    }, TX_OPTIONS);

    await this.auditService.log(slug, {
      action: 'UPDATED',
      module: 'invoices',
      recordId: id,
      description: `Invoice ${updated.invoiceNumber} updated`,
    });

    return {
      success: true,
      message: 'Invoice updated successfully',
      data: updated,
    };
  }

  async getCustomers(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT "id", "name", "phone", "balance" FROM "customers"
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