import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantReportsService {
  constructor(private tenantService: TenantService) {}

  async getSalesReport(slug: string, from: string, to: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const summary = await client.$queryRawUnsafe(
      `SELECT
        COUNT(*) as "totalInvoices",
        COALESCE(SUM("totalAmount"), 0) as "totalSales",
        COALESCE(SUM("paidAmount"), 0) as "totalCollected",
        COALESCE(SUM("dueAmount"), 0) as "totalDue"
       FROM "invoices"
       WHERE "isDeleted" = false
         AND "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp`,
      from, to,
    ) as any[];

    const dailySales = await client.$queryRawUnsafe(
      `SELECT DATE("createdAt") as "date", COUNT(*) as "count", COALESCE(SUM("totalAmount"), 0) as "total"
       FROM "invoices"
       WHERE "isDeleted" = false
         AND "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp
       GROUP BY DATE("createdAt")
       ORDER BY "date" ASC`,
      from, to,
    ) as any[];

    const topProducts = await client.$queryRawUnsafe(
      `SELECT p."name", p."sku", SUM(ii."quantity") as "totalQty", SUM(ii."totalPrice") as "totalRevenue"
       FROM "invoice_items" ii
       JOIN "products" p ON ii."productId" = p."id"
       JOIN "invoices" i ON ii."invoiceId" = i."id"
       WHERE i."isDeleted" = false AND i."createdAt" >= $1::timestamp AND i."createdAt" <= $2::timestamp
       GROUP BY p."id", p."name", p."sku"
       ORDER BY "totalRevenue" DESC
       LIMIT 10`,
      from, to,
    ) as any[];

    const topCustomers = await client.$queryRawUnsafe(
      `SELECT c."name", c."phone", COUNT(i."id") as "orderCount", SUM(i."totalAmount") as "totalSpent"
       FROM "invoices" i
       JOIN "customers" c ON i."customerId" = c."id"
       WHERE i."isDeleted" = false AND i."createdAt" >= $1::timestamp AND i."createdAt" <= $2::timestamp
       GROUP BY c."id", c."name", c."phone"
       ORDER BY "totalSpent" DESC
       LIMIT 10`,
      from, to,
    ) as any[];

    return {
      success: true,
      data: {
        summary: this.normalize(summary[0]),
        dailySales: dailySales.map((d: any) => ({ ...d, count: Number(d.count), total: Number(d.total) })),
        topProducts: topProducts.map((p: any) => ({ ...p, totalQty: Number(p.totalQty), totalRevenue: Number(p.totalRevenue) })),
        topCustomers: topCustomers.map((c: any) => ({ ...c, orderCount: Number(c.orderCount), totalSpent: Number(c.totalSpent) })),
      },
    };
  }

  async getPurchaseReport(slug: string, from: string, to: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const summary = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as "totalOrders", COALESCE(SUM("totalAmount"), 0) as "totalPurchases"
       FROM "purchase_orders"
       WHERE "isDeleted" = false AND "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp`,
      from, to,
    ) as any[];

    const bySupplier = await client.$queryRawUnsafe(
      `SELECT s."name", s."phone", COUNT(po."id") as "orderCount", SUM(po."totalAmount") as "totalSpent"
       FROM "purchase_orders" po
       JOIN "suppliers" s ON po."supplierId" = s."id"
       WHERE po."isDeleted" = false AND po."createdAt" >= $1::timestamp AND po."createdAt" <= $2::timestamp
       GROUP BY s."id", s."name", s."phone"
       ORDER BY "totalSpent" DESC
       LIMIT 10`,
      from, to,
    ) as any[];

    const dailyPurchases = await client.$queryRawUnsafe(
      `SELECT DATE("createdAt") as "date", COUNT(*) as "count", COALESCE(SUM("totalAmount"), 0) as "total"
       FROM "purchase_orders"
       WHERE "isDeleted" = false AND "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp
       GROUP BY DATE("createdAt")
       ORDER BY "date" ASC`,
      from, to,
    ) as any[];

    return {
      success: true,
      data: {
        summary: this.normalize(summary[0]),
        bySupplier: bySupplier.map((s: any) => ({ ...s, orderCount: Number(s.orderCount), totalSpent: Number(s.totalSpent) })),
        dailyPurchases: dailyPurchases.map((d: any) => ({ ...d, count: Number(d.count), total: Number(d.total) })),
      },
    };
  }

  async getStockReport(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const products = await client.$queryRawUnsafe(
      `SELECT p.*, c."name" as "categoryName"
       FROM "products" p
       LEFT JOIN "categories" c ON p."categoryId" = c."id"
       WHERE p."isDeleted" = false
       ORDER BY (p."stock" * p."purchasePrice") DESC`,
    ) as any[];

    const summary = await client.$queryRawUnsafe(
      `SELECT
        COUNT(*) as "totalProducts",
        COALESCE(SUM("stock"), 0) as "totalUnits",
        COALESCE(SUM("stock" * "purchasePrice"), 0) as "totalCostValue",
        COALESCE(SUM("stock" * "salePrice"), 0) as "totalSaleValue"
       FROM "products" WHERE "isDeleted" = false`,
    ) as any[];

    return {
      success: true,
      data: {
        products,
        summary: this.normalize(summary[0]),
      },
    };
  }

  async getProfitLoss(slug: string, from: string, to: string) {
    const client = await this.tenantService.getTenantClient(slug);

    // Revenue from invoices
    const revenue = await client.$queryRawUnsafe(
      `SELECT COALESCE(SUM("totalAmount"), 0) as "totalRevenue"
       FROM "invoices"
       WHERE "isDeleted" = false AND "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp`,
      from, to,
    ) as any[];

    // Cost of goods sold — using purchase price of items sold via invoices
    const cogs = await client.$queryRawUnsafe(
      `SELECT COALESCE(SUM(ii."quantity" * p."purchasePrice"), 0) as "totalCOGS"
       FROM "invoice_items" ii
       JOIN "products" p ON ii."productId" = p."id"
       JOIN "invoices" i ON ii."invoiceId" = i."id"
       WHERE i."isDeleted" = false AND i."createdAt" >= $1::timestamp AND i."createdAt" <= $2::timestamp`,
      from, to,
    ) as any[];

    // Purchases made in period (cash outflow, separate from COGS)
    const purchases = await client.$queryRawUnsafe(
      `SELECT COALESCE(SUM("totalAmount"), 0) as "totalPurchases"
       FROM "purchase_orders"
       WHERE "isDeleted" = false AND "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp`,
      from, to,
    ) as any[];

    const totalRevenue = Number(revenue[0].totalRevenue || 0);
    const totalCOGS = Number(cogs[0].totalCOGS || 0);
    const totalPurchases = Number(purchases[0].totalPurchases || 0);
    const grossProfit = totalRevenue - totalCOGS;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      success: true,
      data: {
        totalRevenue,
        totalCOGS,
        totalPurchases,
        grossProfit,
        grossMargin,
      },
    };
  }

  async getBalanceSheet(slug: string, asOf: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const accounts = await client.$queryRawUnsafe(
      `SELECT coa.*,
        COALESCE(SUM(CASE WHEN ji."debit" IS NOT NULL THEN ji."debit" ELSE 0 END), 0) as "totalDebit",
        COALESCE(SUM(CASE WHEN ji."credit" IS NOT NULL THEN ji."credit" ELSE 0 END), 0) as "totalCredit"
       FROM "chart_of_accounts" coa
       LEFT JOIN "journal_items" ji ON coa."id" = ji."accountId"
       LEFT JOIN "journal_entries" je ON ji."journalEntryId" = je."id"
         AND je."createdAt" <= $1::timestamp
       WHERE coa."isActive" = true
       GROUP BY coa."id"
       ORDER BY coa."code" ASC`,
      asOf,
    ) as any[];

    const assets     = accounts.filter((a: any) => a.type === 'ASSET')
    const liabilities = accounts.filter((a: any) => a.type === 'LIABILITY')
    const equity     = accounts.filter((a: any) => a.type === 'EQUITY')

    const totalAssets      = assets.reduce((s: number, a: any) => s + Number(a.balance || 0), 0)
    const totalLiabilities = liabilities.reduce((s: number, a: any) => s + Number(a.balance || 0), 0)
    const totalEquity      = equity.reduce((s: number, a: any) => s + Number(a.balance || 0), 0)

    return {
      success: true,
      data: {
        assets, liabilities, equity,
        totalAssets, totalLiabilities, totalEquity,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
        asOf,
      },
    };
  }

  async getARReport(slug: string, asOf: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const invoices = await client.$queryRawUnsafe(
      `SELECT i.*, c."name" as "customerName", c."phone" as "customerPhone",
        EXTRACT(DAY FROM (NOW() - i."createdAt")) as "ageDays"
       FROM "invoices" i
       JOIN "customers" c ON i."customerId" = c."id"
       WHERE i."isDeleted" = false
         AND i."paymentStatus" != 'PAID'
         AND i."dueAmount" > 0
         AND i."createdAt" <= $1::timestamp
       ORDER BY i."createdAt" ASC`,
      asOf,
    ) as any[];

    const data = invoices.map((inv: any) => ({
      ...inv,
      ageDays: Number(inv.ageDays || 0),
      dueAmount: Number(inv.dueAmount || 0),
      totalAmount: Number(inv.totalAmount || 0),
      paidAmount: Number(inv.paidAmount || 0),
      agingBucket: this.getAgingBucket(Number(inv.ageDays || 0)),
    }));

    const summary = {
      current:   data.filter((i: any) => i.ageDays <= 30).reduce((s: number, i: any) => s + i.dueAmount, 0),
      days31_60: data.filter((i: any) => i.ageDays > 30 && i.ageDays <= 60).reduce((s: number, i: any) => s + i.dueAmount, 0),
      days61_90: data.filter((i: any) => i.ageDays > 60 && i.ageDays <= 90).reduce((s: number, i: any) => s + i.dueAmount, 0),
      over90:    data.filter((i: any) => i.ageDays > 90).reduce((s: number, i: any) => s + i.dueAmount, 0),
      total:     data.reduce((s: number, i: any) => s + i.dueAmount, 0),
    };

    return { success: true, data: { invoices: data, summary } };
  }

  async getAPReport(slug: string, asOf: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const orders = await client.$queryRawUnsafe(
      `SELECT po.*, s."name" as "supplierName", s."phone" as "supplierPhone",
        EXTRACT(DAY FROM (NOW() - po."createdAt")) as "ageDays"
       FROM "purchase_orders" po
       JOIN "suppliers" s ON po."supplierId" = s."id"
       WHERE po."isDeleted" = false
         AND po."status" != 'CANCELLED'
         AND po."createdAt" <= $1::timestamp
       ORDER BY po."createdAt" ASC`,
      asOf,
    ) as any[];

    const data = orders.map((o: any) => ({
      ...o,
      ageDays: Number(o.ageDays || 0),
      totalAmount: Number(o.totalAmount || 0),
      agingBucket: this.getAgingBucket(Number(o.ageDays || 0)),
    }));

    const summary = {
      current:   data.filter((o: any) => o.ageDays <= 30).reduce((s: number, o: any) => s + o.totalAmount, 0),
      days31_60: data.filter((o: any) => o.ageDays > 30 && o.ageDays <= 60).reduce((s: number, o: any) => s + o.totalAmount, 0),
      days61_90: data.filter((o: any) => o.ageDays > 60 && o.ageDays <= 90).reduce((s: number, o: any) => s + o.totalAmount, 0),
      over90:    data.filter((o: any) => o.ageDays > 90).reduce((s: number, o: any) => s + o.totalAmount, 0),
      total:     data.reduce((s: number, o: any) => s + o.totalAmount, 0),
    };

    return { success: true, data: { orders: data, summary } };
  }

  async getCustomerLedger(slug: string, customerId: string, from: string, to: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const customers = await client.$queryRawUnsafe(
      `SELECT * FROM "customers" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      customerId,
    ) as any[];

    if (!customers.length) throw new Error('Customer not found');

    const invoices = await client.$queryRawUnsafe(
      `SELECT 'INVOICE' as "type", "invoiceNumber" as "reference",
        "createdAt" as "date", "totalAmount" as "debit",
        "paidAmount" as "credit", "paymentStatus" as "status"
       FROM "invoices"
       WHERE "customerId" = $1::uuid AND "isDeleted" = false
         AND "createdAt" >= $2::timestamp AND "createdAt" <= $3::timestamp
       ORDER BY "createdAt" ASC`,
      customerId, from, to,
    ) as any[];

    let runningBalance = 0;
    const entries = invoices.map((entry: any) => {
      const debit = Number(entry.debit || 0);
      const credit = Number(entry.credit || 0);
      runningBalance += debit - credit;
      return { ...entry, debit, credit, runningBalance };
    });

    return {
      success: true,
      data: {
        customer: customers[0],
        entries,
        totalDebit: entries.reduce((s: number, e: any) => s + e.debit, 0),
        totalCredit: entries.reduce((s: number, e: any) => s + e.credit, 0),
        closingBalance: runningBalance,
      },
    };
  }

  async getSupplierLedger(slug: string, supplierId: string, from: string, to: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const suppliers = await client.$queryRawUnsafe(
      `SELECT * FROM "suppliers" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      supplierId,
    ) as any[];

    if (!suppliers.length) throw new Error('Supplier not found');

    const orders = await client.$queryRawUnsafe(
      `SELECT 'PURCHASE' as "type", "orderNumber" as "reference",
        "createdAt" as "date", "totalAmount" as "debit",
        0 as "credit", "status"
       FROM "purchase_orders"
       WHERE "supplierId" = $1::uuid AND "isDeleted" = false
         AND "createdAt" >= $2::timestamp AND "createdAt" <= $3::timestamp
       ORDER BY "createdAt" ASC`,
      supplierId, from, to,
    ) as any[];

    let runningBalance = 0;
    const entries = orders.map((entry: any) => {
      const debit = Number(entry.debit || 0);
      const credit = Number(entry.credit || 0);
      runningBalance += debit - credit;
      return { ...entry, debit, credit, runningBalance };
    });

    return {
      success: true,
      data: {
        supplier: suppliers[0],
        entries,
        totalDebit: entries.reduce((s: number, e: any) => s + e.debit, 0),
        totalCredit: entries.reduce((s: number, e: any) => s + e.credit, 0),
        closingBalance: runningBalance,
      },
    };
  }

  async getStockMovementReport(slug: string, from: string, to: string, productId?: string) {
    const client = await this.tenantService.getTenantClient(slug);

    let whereClause = `it."createdAt" >= $1::timestamp AND it."createdAt" <= $2::timestamp`;
    const params: any[] = [from, to];

    if (productId) {
      params.push(productId);
      whereClause += ` AND it."productId" = $${params.length}::uuid`;
    }

    const movements = await client.$queryRawUnsafe(
      `SELECT it.*, p."name" as "productName", p."sku" as "productSku", p."unit" as "productUnit"
       FROM "inventory_transactions" it
       JOIN "products" p ON it."productId" = p."id"
       WHERE ${whereClause}
       ORDER BY it."createdAt" DESC`,
      ...params,
    ) as any[];

    const summary = await client.$queryRawUnsafe(
      `SELECT
        COALESCE(SUM(CASE WHEN "type" IN ('IN', 'ADJUSTMENT_IN') THEN "quantity" ELSE 0 END), 0) as "totalIn",
        COALESCE(SUM(CASE WHEN "type" IN ('OUT', 'ADJUSTMENT_OUT') THEN "quantity" ELSE 0 END), 0) as "totalOut",
        COUNT(*) as "totalTransactions"
       FROM "inventory_transactions"
       WHERE "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp`,
      from, to,
    ) as any[];

    return {
      success: true,
      data: {
        movements: movements.map((m: any) => ({
          ...m,
          quantity: Number(m.quantity || 0),
        })),
        summary: {
          totalIn: Number(summary[0].totalIn || 0),
          totalOut: Number(summary[0].totalOut || 0),
          totalTransactions: Number(summary[0].totalTransactions || 0),
        },
      },
    };
  }

  async getInvoiceReport(slug: string, from: string, to: string, status?: string) {
    const client = await this.tenantService.getTenantClient(slug);

    let whereClause = `i."isDeleted" = false
      AND i."createdAt" >= $1::timestamp AND i."createdAt" <= $2::timestamp`;
    const params: any[] = [from, to];

    if (status) {
      params.push(status);
      whereClause += ` AND i."paymentStatus" = $${params.length}`;
    }

    const invoices = await client.$queryRawUnsafe(
      `SELECT i.*, c."name" as "customerName"
       FROM "invoices" i
       JOIN "customers" c ON i."customerId" = c."id"
       WHERE ${whereClause}
       ORDER BY i."createdAt" DESC`,
      ...params,
    ) as any[];

    const summary = await client.$queryRawUnsafe(
      `SELECT
        COUNT(*) as "totalInvoices",
        COALESCE(SUM("totalAmount"), 0) as "totalAmount",
        COALESCE(SUM("paidAmount"), 0) as "totalPaid",
        COALESCE(SUM("dueAmount"), 0) as "totalDue",
        COUNT(CASE WHEN "paymentStatus" = 'PAID' THEN 1 END) as "paidCount",
        COUNT(CASE WHEN "paymentStatus" = 'UNPAID' THEN 1 END) as "unpaidCount",
        COUNT(CASE WHEN "paymentStatus" = 'PARTIAL' THEN 1 END) as "partialCount"
       FROM "invoices"
       WHERE "isDeleted" = false
         AND "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp`,
      from, to,
    ) as any[];

    const raw = summary[0];
    return {
      success: true,
      data: {
        invoices,
        summary: {
          totalInvoices: Number(raw.totalInvoices || 0),
          totalAmount: Number(raw.totalAmount || 0),
          totalPaid: Number(raw.totalPaid || 0),
          totalDue: Number(raw.totalDue || 0),
          paidCount: Number(raw.paidCount || 0),
          unpaidCount: Number(raw.unpaidCount || 0),
          partialCount: Number(raw.partialCount || 0),
        },
      },
    };
  }

  async getAttendanceReport(slug: string, month: number, year: number, department?: string) {
    const client = await this.tenantService.getTenantClient(slug);

    let whereClause = `e."isDeleted" = false AND e."status" = 'ACTIVE'`;
    const params: any[] = [];

    if (department) {
      params.push(department);
      whereClause += ` AND e."department" = $${params.length}`;
    }

    const employees = await client.$queryRawUnsafe(
      `SELECT e.*,
        COUNT(CASE WHEN a."status" = 'PRESENT' THEN 1 END) as "present",
        COUNT(CASE WHEN a."status" = 'ABSENT' THEN 1 END) as "absent",
        COUNT(CASE WHEN a."status" = 'HALF_DAY' THEN 1 END) as "halfDay",
        COUNT(CASE WHEN a."status" = 'LEAVE' THEN 1 END) as "onLeave"
       FROM "employees" e
       LEFT JOIN "attendance" a ON e."id" = a."employeeId"
         AND EXTRACT(MONTH FROM a."date") = ${month}
         AND EXTRACT(YEAR FROM a."date") = ${year}
       WHERE ${whereClause}
       GROUP BY e."id"
       ORDER BY e."name"`,
      ...params,
    ) as any[];

    const daysInMonth = new Date(year, month, 0).getDate();

    return {
      success: true,
      data: {
        employees: employees.map((e: any) => ({
          ...e,
          present: Number(e.present || 0),
          absent: Number(e.absent || 0),
          halfDay: Number(e.halfDay || 0),
          onLeave: Number(e.onLeave || 0),
          attendanceRate: Math.round((Number(e.present || 0) / daysInMonth) * 100),
        })),
        month, year, daysInMonth,
      },
    };
  }

  async getPayrollReport(slug: string, month: number, year: number, department?: string) {
    const client = await this.tenantService.getTenantClient(slug);

    let whereClause = `p."month" = ${month} AND p."year" = ${year}`;
    const params: any[] = [];

    if (department) {
      params.push(department);
      whereClause += ` AND e."department" = $${params.length}`;
    }

    const payrolls = await client.$queryRawUnsafe(
      `SELECT p.*, e."name" as "employeeName", e."employeeCode",
        e."department", e."designation"
       FROM "payroll" p
       JOIN "employees" e ON p."employeeId" = e."id"
       WHERE ${whereClause}
       ORDER BY e."name"`,
      ...params,
    ) as any[];

    const summary = {
      totalEmployees: payrolls.length,
      totalBasic: payrolls.reduce((s: number, p: any) => s + Number(p.basicSalary || 0), 0),
      totalAllowances: payrolls.reduce((s: number, p: any) => s + Number(p.allowances || 0), 0),
      totalDeductions: payrolls.reduce((s: number, p: any) => s + Number(p.deductions || 0), 0),
      totalTax: payrolls.reduce((s: number, p: any) => s + Number(p.tax || 0), 0),
      totalNet: payrolls.reduce((s: number, p: any) => s + Number(p.netSalary || 0), 0),
      paidCount: payrolls.filter((p: any) => p.status === 'PAID').length,
      pendingCount: payrolls.filter((p: any) => p.status === 'PENDING').length,
    };

    return { success: true, data: { payrolls, summary, month, year } };
  }

  async getCustomersForReport(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT "id", "name", "phone" FROM "customers"
       WHERE "isDeleted" = false ORDER BY "name" ASC`,
    ) as any[];
    return { success: true, data: result };
  }

  async getSuppliersForReport(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT "id", "name", "phone" FROM "suppliers"
       WHERE "isDeleted" = false ORDER BY "name" ASC`,
    ) as any[];
    return { success: true, data: result };
  }

  private getAgingBucket(days: number): string {
    if (days <= 30) return 'Current (0-30)'
    if (days <= 60) return '31-60 Days'
    if (days <= 90) return '61-90 Days'
    return 'Over 90 Days'
  }

  private normalize(row: any) {
    const result: any = {};
    for (const key in row) {
      result[key] = typeof row[key] === 'bigint' ? Number(row[key]) : Number(row[key] ?? 0);
    }
    return result;
  }
}