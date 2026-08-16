import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantAuditService } from './tenant-audit.service';

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

  async create(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    // Generate invoice number
    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "invoices"`
    ) as any[];
    const count = parseInt(countResult[0].count) + 1;
    const invoiceNumber = `INV-${String(count).padStart(5, '0')}`;

    // Calculate totals
    const items = body.items || [];
    let subtotal = 0;
    items.forEach((item: any) => {
      subtotal += parseFloat(item.quantity) * parseFloat(item.unitPrice);
    });

    const discount = parseFloat(body.discount) || 0;
    const tax = parseFloat(body.tax) || 0;
    const totalAmount = subtotal - discount + tax;
    const paidAmount = parseFloat(body.paidAmount) || 0;
    const dueAmount = totalAmount - paidAmount;
    const paymentStatus = dueAmount <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';

    // Create invoice
    const invoiceResult = await client.$queryRawUnsafe(
      `INSERT INTO "invoices" (
        "id", "invoiceNumber", "customerId", "status", "paymentStatus",
        "subtotal", "discount", "tax", "totalAmount", "paidAmount",
        "dueAmount", "dueDate", "notes"
      ) VALUES (
        gen_random_uuid(), $1, $2::uuid, 'CONFIRMED', $3,
        $4, $5, $6, $7, $8, $9, $10::timestamp, $11
      ) RETURNING *`,
      invoiceNumber,
      body.customerId,
      paymentStatus,
      subtotal,
      discount,
      tax,
      totalAmount,
      paidAmount,
      dueAmount,
      body.dueDate || null,
      body.notes || null,
    ) as any[];

    const invoice = invoiceResult[0];

    // Create invoice items
    for (const item of items) {
      const totalPrice = parseFloat(item.quantity) * parseFloat(item.unitPrice) - (parseFloat(item.discount) || 0);
      await client.$queryRawUnsafe(
        `INSERT INTO "invoice_items" (
          "id", "invoiceId", "productId", "quantity", "unitPrice", "discount", "totalPrice"
        ) VALUES (
          gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, $6
        )`,
        invoice.id,
        item.productId,
        parseFloat(item.quantity),
        parseFloat(item.unitPrice),
        parseFloat(item.discount) || 0,
        totalPrice,
      );
    }

    await this.auditService.log(slug, {
      action: 'CREATED',
      module: 'invoices',
      recordId: invoice.id,
      description: `Invoice ${invoiceNumber} created`,
    });

    return {
      success: true,
      message: 'Invoice created successfully',
      data: invoice,
    };
  }

  async updatePayment(slug: string, id: string, body: any) {
    if (!id || id === 'undefined') {
      throw new NotFoundException('Invoice not found')
    }

    const client = await this.tenantService.getTenantClient(slug);

    const invoices = await client.$queryRawUnsafe(
      `SELECT * FROM "invoices" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      id,
    ) as any[];

    if (!invoices || invoices.length === 0) {
      throw new NotFoundException('Invoice not found');
    }

    const invoice = invoices[0];
    const newPaidAmount = parseFloat(invoice.paidAmount) + parseFloat(body.amount);
    const newDueAmount = parseFloat(invoice.totalAmount) - newPaidAmount;
    const paymentStatus = newDueAmount <= 0 ? 'PAID' : 'PARTIAL';

    const result = await client.$queryRawUnsafe(
      `UPDATE "invoices"
       SET "paidAmount" = $1, "dueAmount" = $2, "paymentStatus" = $3, "updatedAt" = NOW()
       WHERE "id" = $4::uuid
       RETURNING *`,
      newPaidAmount,
      newDueAmount < 0 ? 0 : newDueAmount,
      paymentStatus,
      id,
    ) as any[];

    await this.auditService.log(slug, {
      action: 'UPDATED',
      module: 'invoices',
      recordId: id,
      description: `Payment recorded on invoice`,
    });

    return {
      success: true,
      message: 'Payment recorded successfully',
      data: result[0],
    };
  }

  async remove(slug: string, id: string) {
    if (!id || id === 'undefined') {
      throw new NotFoundException('Invoice not found')
    }

    const client = await this.tenantService.getTenantClient(slug);

    await client.$queryRawUnsafe(
      `UPDATE "invoices" SET "isDeleted" = true, "deletedAt" = NOW() WHERE "id" = $1::uuid`,
      id,
    );

    await this.auditService.log(slug, {
      action: 'DELETED',
      module: 'invoices',
      recordId: id,
      description: `Invoice deleted`,
    });

    return {
      success: true,
      message: 'Invoice deleted successfully',
    };
  }

  async update(slug: string, id: string, body: any) {
    if (!id || id === 'undefined') {
      throw new NotFoundException('Invoice not found')
    }

    const client = await this.tenantService.getTenantClient(slug);

    const invoices = await client.$queryRawUnsafe(
      `SELECT * FROM "invoices" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      id,
    ) as any[];

    if (!invoices || invoices.length === 0) {
      throw new NotFoundException('Invoice not found');
    }

    const items = body.items || [];
    let subtotal = 0;
    items.forEach((item: any) => {
      subtotal += parseFloat(item.quantity) * parseFloat(item.unitPrice);
    });

    const discount = parseFloat(body.discount) || 0;
    const tax = parseFloat(body.tax) || 0;
    const totalAmount = subtotal - discount + tax;
    const paidAmount = parseFloat(body.paidAmount) || 0;
    const dueAmount = totalAmount - paidAmount;
    const paymentStatus = dueAmount <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';

    const result = await client.$queryRawUnsafe(
      `UPDATE "invoices"
       SET "customerId" = $1::uuid, "paymentStatus" = $2, "subtotal" = $3,
           "discount" = $4, "tax" = $5, "totalAmount" = $6, "paidAmount" = $7,
           "dueAmount" = $8, "dueDate" = $9::timestamp, "notes" = $10, "updatedAt" = NOW()
       WHERE "id" = $11::uuid
       RETURNING *`,
      body.customerId,
      paymentStatus,
      subtotal,
      discount,
      tax,
      totalAmount,
      paidAmount,
      dueAmount < 0 ? 0 : dueAmount,
      body.dueDate || null,
      body.notes || null,
      id,
    ) as any[];

    // Replace items: delete existing then insert new ones
    await client.$queryRawUnsafe(
      `DELETE FROM "invoice_items" WHERE "invoiceId" = $1::uuid`,
      id,
    );

    for (const item of items) {
      const totalPrice = parseFloat(item.quantity) * parseFloat(item.unitPrice) - (parseFloat(item.discount) || 0);
      await client.$queryRawUnsafe(
        `INSERT INTO "invoice_items" (
          "id", "invoiceId", "productId", "quantity", "unitPrice", "discount", "totalPrice"
        ) VALUES (
          gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, $6
        )`,
        id,
        item.productId,
        parseFloat(item.quantity),
        parseFloat(item.unitPrice),
        parseFloat(item.discount) || 0,
        totalPrice,
      );
    }

    return {
      success: true,
      message: 'Invoice updated successfully',
      data: result[0],
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