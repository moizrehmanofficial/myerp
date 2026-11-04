import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ensureTenantUpgrades } from './tenant-doc.helper';
import { naturalBalance, ACC } from './tenant-accounting.helper';

// "2026-11-04" as an END date should include the whole day
function endOfDay(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? `${d}T23:59:59.999` : d;
}

@Injectable()
export class TenantReportsService {
  constructor(private tenantService: TenantService) {}

  async getSalesReport(slug: string, from: string, to: string) {
    to = endOfDay(to);
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
    to = endOfDay(to);
    const client = await this.tenantService.getTenantClient(slug);

    const summary = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as "totalOrders", COALESCE(SUM("totalAmount"), 0) as "totalPurchases"
       FROM "purchase_orders"
       WHERE "isDeleted" = false AND "status" != 'CANCELLED'
         AND "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp`,
      from, to,
    ) as any[];

    const bySupplier = await client.$queryRawUnsafe(
      `SELECT s."name", s."phone", COUNT(po."id") as "orderCount", SUM(po."totalAmount") as "totalSpent"
       FROM "purchase_orders" po
       JOIN "suppliers" s ON po."supplierId" = s."id"
       WHERE po."isDeleted" = false AND po."status" != 'CANCELLED' AND po."createdAt" >= $1::timestamp AND po."createdAt" <= $2::timestamp
       GROUP BY s."id", s."name", s."phone"
       ORDER BY "totalSpent" DESC
       LIMIT 10`,
      from, to,
    ) as any[];

    const dailyPurchases = await client.$queryRawUnsafe(
      `SELECT DATE("createdAt") as "date", COUNT(*) as "count", COALESCE(SUM("totalAmount"), 0) as "total"
       FROM "purchase_orders"
       WHERE "isDeleted" = false AND "status" != 'CANCELLED' AND "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp
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

  // Profit & Loss from the accounts (journal entries) — includes every
  // income and expense: sales, COGS, salaries, rent, manual journals...
  async getProfitLoss(slug: string, from: string, to: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);
    const toEnd = endOfDay(to);

    const rows = (await client.$queryRawUnsafe(
      `SELECT coa."id", coa."code", coa."name", coa."type",
              COALESCE(SUM(ji."debit"), 0) AS "debit",
              COALESCE(SUM(ji."credit"), 0) AS "credit"
       FROM "chart_of_accounts" coa
       JOIN "journal_items" ji ON ji."accountId" = coa."id"
       JOIN "journal_entries" je ON je."id" = ji."journalEntryId"
       WHERE coa."type" IN ('INCOME', 'EXPENSE')
         AND je."createdAt" >= $1::timestamp AND je."createdAt" <= $2::timestamp
       GROUP BY coa."id"
       ORDER BY coa."code" ASC`,
      from,
      toEnd,
    )) as any[];

    const accounts = rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      amount: naturalBalance(r.type, Number(r.debit), Number(r.credit)),
    }));

    const incomeAccounts = accounts.filter((a: any) => a.type === 'INCOME');
    const cogsAccounts = accounts.filter((a: any) => a.type === 'EXPENSE' && a.code === ACC.COGS);
    const expenseAccounts = accounts.filter((a: any) => a.type === 'EXPENSE' && a.code !== ACC.COGS);

    const sum = (list: any[]) => list.reduce((s: number, a: any) => s + a.amount, 0);
    const totalRevenue = sum(incomeAccounts);
    const totalCOGS = sum(cogsAccounts);
    const totalExpenses = sum(expenseAccounts);
    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Info only: money spent on stock in the period (not an expense until sold)
    const purchases = (await client.$queryRawUnsafe(
      `SELECT COALESCE(SUM("totalAmount"), 0) as "totalPurchases"
       FROM "purchase_orders"
       WHERE "isDeleted" = false AND "status" = 'RECEIVED'
         AND "createdAt" >= $1::timestamp AND "createdAt" <= $2::timestamp`,
      from,
      toEnd,
    )) as any[];

    return {
      success: true,
      data: {
        totalRevenue,
        totalCOGS,
        grossProfit,
        grossMargin,
        totalExpenses,
        netProfit,
        netMargin,
        totalPurchases: Number(purchases[0].totalPurchases || 0),
        incomeAccounts,
        expenseAccounts,
      },
    };
  }

  // Balance sheet as of a date, from journal entries up to that date.
  // Current period profit is shown under equity so the sheet balances.
  async getBalanceSheet(slug: string, asOf: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);
    const asOfEnd = endOfDay(asOf);

    const rows = (await client.$queryRawUnsafe(
      `SELECT coa.*,
              COALESCE(t."debit", 0) AS "totalDebit",
              COALESCE(t."credit", 0) AS "totalCredit"
       FROM "chart_of_accounts" coa
       LEFT JOIN (
         SELECT ji."accountId", SUM(ji."debit") AS "debit", SUM(ji."credit") AS "credit"
         FROM "journal_items" ji
         JOIN "journal_entries" je ON je."id" = ji."journalEntryId"
         WHERE je."createdAt" <= $1::timestamp
         GROUP BY ji."accountId"
       ) t ON t."accountId" = coa."id"
       WHERE coa."isActive" = true
       ORDER BY coa."code" ASC`,
      asOfEnd,
    )) as any[];

    const accounts = rows.map((a: any) => ({
      ...a,
      totalDebit: Number(a.totalDebit),
      totalCredit: Number(a.totalCredit),
      balance: naturalBalance(a.type, Number(a.totalDebit), Number(a.totalCredit)),
    }));

    const assets = accounts.filter((a: any) => a.type === 'ASSET');
    const liabilities = accounts.filter((a: any) => a.type === 'LIABILITY');
    const equity = accounts.filter((a: any) => a.type === 'EQUITY');

    const sum = (list: any[]) => list.reduce((s: number, a: any) => s + a.balance, 0);
    const income = sum(accounts.filter((a: any) => a.type === 'INCOME'));
    const expense = sum(accounts.filter((a: any) => a.type === 'EXPENSE'));
    const currentProfit = income - expense;

    // Shown as an equity line (not a real account)
    equity.push({
      id: 'current-period-profit',
      code: '—',
      name: 'Current Period Profit / (Loss)',
      type: 'EQUITY',
      balance: currentProfit,
      totalDebit: 0,
      totalCredit: 0,
    });

    const totalAssets = sum(assets);
    const totalLiabilities = sum(liabilities);
    const totalEquity = sum(equity);

    return {
      success: true,
      data: {
        assets,
        liabilities,
        equity,
        totalAssets,
        totalLiabilities,
        totalEquity,
        currentProfit,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
        asOf,
      },
    };
  }

  async getARReport(slug: string, asOf: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const asOfEnd = endOfDay(asOf);

    const invoices = await client.$queryRawUnsafe(
      `SELECT i.*, c."name" as "customerName", c."phone" as "customerPhone",
        GREATEST(EXTRACT(DAY FROM ($1::timestamp - i."createdAt")), 0) as "ageDays"
       FROM "invoices" i
       JOIN "customers" c ON i."customerId" = c."id"
       WHERE i."isDeleted" = false
         AND i."paymentStatus" != 'PAID'
         AND i."dueAmount" > 0
         AND i."createdAt" <= $1::timestamp
       ORDER BY i."createdAt" ASC`,
      asOfEnd,
    ) as any[];

    const data = invoices.map((inv: any) => ({
      ...inv,
      ageDays: Number(inv.ageDays || 0),
      dueAmount: Number(inv.dueAmount || 0),
      totalAmount: Number(inv.totalAmount || 0),
      paidAmount: Number(inv.paidAmount || 0),
      agingBucket: this.getAgingBucket(Number(inv.ageDays || 0)),
    }));

    return { success: true, data: { invoices: data, summary: this.agingSummary(data, 'dueAmount') } };
  }

  // What we owe suppliers = their balance. Payments are not linked to a
  // purchase order, so the balance is matched to the newest received orders
  // first (older ones count as paid) to show how old the debt is.
  async getAPReport(slug: string, asOf: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const asOfEnd = endOfDay(asOf);

    const suppliers = (await client.$queryRawUnsafe(
      `SELECT "id", "name", "phone", "balance" FROM "suppliers"
       WHERE "isDeleted" = false AND "balance" > 0
       ORDER BY "balance" DESC`,
    )) as any[];

    const orders = suppliers.length
      ? ((await client.$queryRawUnsafe(
          `SELECT "id", "orderNumber", "supplierId", "totalAmount", "createdAt",
             GREATEST(EXTRACT(DAY FROM ($1::timestamp - "createdAt")), 0) as "ageDays"
           FROM "purchase_orders"
           WHERE "isDeleted" = false AND COALESCE("isPosted", false) = true
             AND "createdAt" <= $1::timestamp
           ORDER BY "createdAt" DESC`,
          asOfEnd,
        )) as any[])
      : [];

    const rows: any[] = [];
    for (const s of suppliers) {
      let left = Number(s.balance);
      for (const o of orders.filter((x: any) => x.supplierId === s.id)) {
        if (left <= 0.004) break;
        const owed = Math.min(left, Number(o.totalAmount));
        rows.push({
          id: o.id,
          supplierId: s.id,
          supplierName: s.name,
          supplierPhone: s.phone,
          orderNumber: o.orderNumber,
          createdAt: o.createdAt,
          totalAmount: Number(o.totalAmount),
          dueAmount: Math.round(owed * 100) / 100,
          ageDays: Number(o.ageDays || 0),
          agingBucket: this.getAgingBucket(Number(o.ageDays || 0)),
        });
        left -= owed;
      }
      // Opening balance or anything not tied to an order
      if (left > 0.004) {
        rows.push({
          id: `${s.id}-other`,
          supplierId: s.id,
          supplierName: s.name,
          supplierPhone: s.phone,
          orderNumber: null,
          createdAt: null,
          totalAmount: Math.round(left * 100) / 100,
          dueAmount: Math.round(left * 100) / 100,
          ageDays: 999,
          agingBucket: this.getAgingBucket(999),
        });
      }
    }

    return {
      success: true,
      data: {
        orders: rows,
        suppliers: suppliers.map((s: any) => ({ ...s, balance: Number(s.balance) })),
        summary: this.agingSummary(rows, 'dueAmount'),
      },
    };
  }

  // Everything that changed a customer's balance: invoices, money received,
  // refunds and sale returns. Starts from the balance before "from".
  async getCustomerLedger(slug: string, customerId: string, from: string, to: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const customers = await client.$queryRawUnsafe(
      `SELECT * FROM "customers" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      customerId,
    ) as any[];
    if (!customers.length) throw new NotFoundException('Customer not found');

    // debit = customer owes more, credit = owes less
    const moves = (await client.$queryRawUnsafe(
      `SELECT * FROM (
         SELECT 'INVOICE' AS "type", "invoiceNumber" AS "reference", "createdAt" AS "date",
                "totalAmount" AS "debit", 0 AS "credit", 'Invoice' AS "details"
         FROM "invoices" WHERE "customerId" = $1::uuid AND "isDeleted" = false
         UNION ALL
         SELECT CASE WHEN "type" = 'RECEIPT' THEN 'RECEIPT' ELSE 'REFUND' END, "reference", "createdAt",
                CASE WHEN "type" = 'PAYMENT' THEN "amount" ELSE 0 END,
                CASE WHEN "type" = 'RECEIPT' THEN "amount" ELSE 0 END,
                COALESCE("notes", CASE WHEN "type" = 'RECEIPT' THEN 'Payment received' ELSE 'Refund paid' END)
         FROM "payments" WHERE "customerId" = $1::uuid
         UNION ALL
         SELECT 'RETURN', "returnNumber", "createdAt", 0, "totalAmount", COALESCE("reason", 'Goods returned')
         FROM "sale_returns" WHERE "customerId" = $1::uuid
       ) m ORDER BY "date" ASC`,
      customerId,
    )) as any[];

    return {
      success: true,
      data: { customer: customers[0], ...this.partyLedger(moves, Number(customers[0].balance || 0), from, to) },
    };
  }

  // Everything that changed what we owe a supplier: received purchases,
  // payments, refunds and purchase returns
  async getSupplierLedger(slug: string, supplierId: string, from: string, to: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const suppliers = await client.$queryRawUnsafe(
      `SELECT * FROM "suppliers" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      supplierId,
    ) as any[];
    if (!suppliers.length) throw new NotFoundException('Supplier not found');

    // credit = we owe more, debit = we owe less (shown from our side)
    const moves = (await client.$queryRawUnsafe(
      `SELECT * FROM (
         SELECT 'PURCHASE' AS "type", "orderNumber" AS "reference", "createdAt" AS "date",
                0 AS "debit", "totalAmount" AS "credit", 'Goods received' AS "details"
         FROM "purchase_orders"
         WHERE "supplierId" = $1::uuid AND "isDeleted" = false AND COALESCE("isPosted", false) = true
         UNION ALL
         SELECT CASE WHEN "type" = 'PAYMENT' THEN 'PAYMENT' ELSE 'REFUND' END, "reference", "createdAt",
                CASE WHEN "type" = 'PAYMENT' THEN "amount" ELSE 0 END,
                CASE WHEN "type" = 'RECEIPT' THEN "amount" ELSE 0 END,
                COALESCE("notes", CASE WHEN "type" = 'PAYMENT' THEN 'Payment made' ELSE 'Refund received' END)
         FROM "payments" WHERE "supplierId" = $1::uuid
         UNION ALL
         SELECT 'RETURN', "returnNumber", "createdAt", "totalAmount", 0, COALESCE("reason", 'Goods returned')
         FROM "purchase_returns" WHERE "supplierId" = $1::uuid
       ) m ORDER BY "date" ASC`,
      supplierId,
    )) as any[];

    // For suppliers the balance grows with credits, so flip the sign
    const flipped = moves.map((m: any) => ({ ...m, debit: m.credit, credit: m.debit, _flip: true }));
    const result = this.partyLedger(flipped, Number(suppliers[0].balance || 0), from, to);
    result.entries = result.entries.map((e: any) => ({ ...e, debit: e.credit, credit: e.debit }));
    const t = result.totalDebit;
    result.totalDebit = result.totalCredit;
    result.totalCredit = t;

    return { success: true, data: { supplier: suppliers[0], ...result } };
  }

  // Shared: opening balance, running balance, closing balance.
  // Anything the records can't explain (e.g. a starting balance typed in when
  // the contact was created) is carried as "balance brought forward".
  private partyLedger(moves: any[], currentBalance: number, from?: string, to?: string) {
    const fromTs = from ? new Date(from).getTime() : -Infinity;
    const toTs = to ? new Date(endOfDay(to)).getTime() : Infinity;
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const all = moves.map((m: any) => ({
      type: m.type,
      reference: m.reference,
      details: m.details,
      date: m.date,
      debit: Number(m.debit || 0),
      credit: Number(m.credit || 0),
    }));
    const net = (list: any[]) => list.reduce((s, m) => s + m.debit - m.credit, 0);
    const broughtForward = r2(currentBalance - net(all));

    const before = all.filter((m) => new Date(m.date).getTime() < fromTs);
    const inRange = all.filter((m) => {
      const t = new Date(m.date).getTime();
      return t >= fromTs && t <= toTs;
    });

    const openingBalance = r2(broughtForward + net(before));
    let running = openingBalance;
    const entries = inRange.map((m) => {
      running = r2(running + m.debit - m.credit);
      return { ...m, runningBalance: running };
    });

    return {
      openingBalance,
      entries,
      totalDebit: r2(inRange.reduce((s, m) => s + m.debit, 0)),
      totalCredit: r2(inRange.reduce((s, m) => s + m.credit, 0)),
      closingBalance: running,
    };
  }

  private agingSummary(rows: any[], key: string) {
    const sum = (f: (d: number) => boolean) => rows.filter((r) => f(r.ageDays)).reduce((s, r) => s + Number(r[key] || 0), 0);
    return {
      current: sum((d) => d <= 30),
      days31_60: sum((d) => d > 30 && d <= 60),
      days61_90: sum((d) => d > 60 && d <= 90),
      over90: sum((d) => d > 90),
      total: sum(() => true),
    };
  }

  async getStockMovementReport(slug: string, from: string, to: string, productId?: string) {
    to = endOfDay(to);
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
    to = endOfDay(to);
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
    // Numbers only (they are put into the SQL text)
    month = Math.min(Math.max(Math.trunc(Number(month)) || 1, 1), 12);
    year = Math.trunc(Number(year)) || new Date().getFullYear();
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
    // Numbers only (they are put into the SQL text)
    month = Math.min(Math.max(Math.trunc(Number(month)) || 1, 1), 12);
    year = Math.trunc(Number(year)) || new Date().getFullYear();
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