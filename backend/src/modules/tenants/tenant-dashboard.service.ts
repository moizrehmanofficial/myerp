import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantDashboardService {
  constructor(private tenantService: TenantService) {}

  async getStats(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);

    async function safeQuery(query: string, ...params: any[]) {
      try {
        return (await client.$queryRawUnsafe(query, ...params)) as any[];
      } catch {
        return [{}];
      }
    }

    const normalize = (val: any) =>
      typeof val === 'bigint' ? Number(val) : Number(val ?? 0);

    const [
      customers,
      suppliers,
      products,
      lowStock,
      purchaseOrders,
      salesOrders,
      invoices,
      revenue,
      due,
      employees,
      recentInvoices,
      recentPurchases,
      topProducts,
      monthlyRevenue,
    ] = await Promise.all([

      // Total customers
      safeQuery(
        `SELECT COUNT(*) as count FROM "customers" WHERE "isDeleted" = false`
      ),

      // Total suppliers
      safeQuery(
        `SELECT COUNT(*) as count FROM "suppliers" WHERE "isDeleted" = false`
      ),

      // Total products
      safeQuery(
        `SELECT COUNT(*) as count FROM "products" WHERE "isDeleted" = false`
      ),

      // Low stock products
      safeQuery(
        `SELECT COUNT(*) as count FROM "products"
         WHERE "isDeleted" = false AND "stock" <= "minStock"`
      ),

      // Purchase orders this month
      safeQuery(
        `SELECT COUNT(*) as count, COALESCE(SUM("totalAmount"), 0) as total
         FROM "purchase_orders"
         WHERE "isDeleted" = false
           AND EXTRACT(MONTH FROM "createdAt") = EXTRACT(MONTH FROM NOW())
           AND EXTRACT(YEAR FROM "createdAt") = EXTRACT(YEAR FROM NOW())`
      ),

      // Sales orders this month
      safeQuery(
        `SELECT COUNT(*) as count, COALESCE(SUM("totalAmount"), 0) as total
         FROM "sales_orders"
         WHERE "isDeleted" = false
           AND EXTRACT(MONTH FROM "createdAt") = EXTRACT(MONTH FROM NOW())
           AND EXTRACT(YEAR FROM "createdAt") = EXTRACT(YEAR FROM NOW())`
      ),

      // Invoice stats
      safeQuery(
        `SELECT
           COUNT(*) as "totalCount",
           COALESCE(SUM("totalAmount"), 0) as "totalAmount",
           COALESCE(SUM("paidAmount"), 0) as "totalPaid",
           COALESCE(SUM("dueAmount"), 0) as "totalDue",
           COUNT(CASE WHEN "paymentStatus" = 'UNPAID' THEN 1 END) as "unpaidCount",
           COUNT(CASE WHEN "paymentStatus" = 'PARTIAL' THEN 1 END) as "partialCount"
         FROM "invoices"
         WHERE "isDeleted" = false AND COALESCE("status", '') NOT IN ('DRAFT', 'CANCELLED')`
      ),

      // Revenue this month
      safeQuery(
        `SELECT COALESCE(SUM("totalAmount"), 0) as revenue
         FROM "invoices"
         WHERE "isDeleted" = false AND COALESCE("status", '') NOT IN ('DRAFT', 'CANCELLED')
           AND EXTRACT(MONTH FROM "createdAt") = EXTRACT(MONTH FROM NOW())
           AND EXTRACT(YEAR FROM "createdAt") = EXTRACT(YEAR FROM NOW())`
      ),

      // Total due (AR)
      safeQuery(
        `SELECT COALESCE(SUM("dueAmount"), 0) as due
         FROM "invoices"
         WHERE "isDeleted" = false AND COALESCE("status", '') NOT IN ('DRAFT', 'CANCELLED') AND "paymentStatus" != 'PAID'`
      ),

      // Active employees
      safeQuery(
        `SELECT COUNT(*) as count FROM "employees"
         WHERE "isDeleted" = false AND "status" = 'ACTIVE'`
      ),

      // Recent invoices (last 5)
      safeQuery(
        `SELECT i."id", i."invoiceNumber", i."totalAmount", i."paymentStatus",
                i."createdAt", c."name" as "customerName"
         FROM "invoices" i
         JOIN "customers" c ON i."customerId" = c."id"
         WHERE i."isDeleted" = false AND COALESCE(i."status", '') NOT IN ('DRAFT', 'CANCELLED')
         ORDER BY i."createdAt" DESC LIMIT 5`
      ),

      // Recent purchases (last 5)
      safeQuery(
        `SELECT po."id", po."orderNumber", po."totalAmount", po."status",
                po."createdAt", s."name" as "supplierName"
         FROM "purchase_orders" po
         JOIN "suppliers" s ON po."supplierId" = s."id"
         WHERE po."isDeleted" = false
         ORDER BY po."createdAt" DESC LIMIT 5`
      ),

      // Top selling products (this month)
      safeQuery(
        `SELECT p."name", p."sku",
                SUM(ii."quantity") as "soldQty",
                SUM(ii."totalPrice") as "revenue"
         FROM "invoice_items" ii
         JOIN "products" p ON ii."productId" = p."id"
         JOIN "invoices" i ON ii."invoiceId" = i."id"
         WHERE i."isDeleted" = false AND COALESCE(i."status", '') NOT IN ('DRAFT', 'CANCELLED')
           AND EXTRACT(MONTH FROM i."createdAt") = EXTRACT(MONTH FROM NOW())
           AND EXTRACT(YEAR FROM i."createdAt") = EXTRACT(YEAR FROM NOW())
         GROUP BY p."id", p."name", p."sku"
         ORDER BY "revenue" DESC LIMIT 5`
      ),

      // Monthly revenue (last 6 months)
      safeQuery(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') as "month",
           EXTRACT(MONTH FROM "createdAt") as "monthNum",
           EXTRACT(YEAR FROM "createdAt") as "yearNum",
           COALESCE(SUM("totalAmount"), 0) as "revenue"
         FROM "invoices"
         WHERE "isDeleted" = false AND COALESCE("status", '') NOT IN ('DRAFT', 'CANCELLED')
           AND "createdAt" >= NOW() - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', "createdAt"),
                  EXTRACT(MONTH FROM "createdAt"),
                  EXTRACT(YEAR FROM "createdAt")
         ORDER BY DATE_TRUNC('month', "createdAt") ASC`
      ),
    ]);

    const inv = invoices[0] || {};

    return {
      success: true,
      data: {
        // Counts
        totalCustomers:    normalize(customers[0]?.count),
        totalSuppliers:    normalize(suppliers[0]?.count),
        totalProducts:     normalize(products[0]?.count),
        lowStockCount:     normalize(lowStock[0]?.count),
        activeEmployees:   normalize(employees[0]?.count),

        // This month
        monthlyPurchaseCount:  normalize(purchaseOrders[0]?.count),
        monthlyPurchaseTotal:  normalize(purchaseOrders[0]?.total),
        monthlySalesCount:     normalize(salesOrders[0]?.count),
        monthlySalesTotal:     normalize(salesOrders[0]?.total),
        monthlyRevenue:        normalize(revenue[0]?.revenue),

        // Invoices
        totalInvoices:   normalize(inv.totalCount),
        totalRevenue:    normalize(inv.totalAmount),
        totalCollected:  normalize(inv.totalPaid),
        totalDue:        normalize(inv.totalDue),
        unpaidInvoices:  normalize(inv.unpaidCount),
        partialInvoices: normalize(inv.partialCount),

        // AR
        accountsReceivable: normalize(due[0]?.due),

        // Lists
        recentInvoices: (recentInvoices || []).map((r: any) => ({
          ...r,
          totalAmount: normalize(r.totalAmount),
        })),
        recentPurchases: (recentPurchases || []).map((r: any) => ({
          ...r,
          totalAmount: normalize(r.totalAmount),
        })),
        topProducts: (topProducts || []).map((p: any) => ({
          ...p,
          soldQty: normalize(p.soldQty),
          revenue: normalize(p.revenue),
        })),
        monthlyRevenueTrend: (monthlyRevenue || []).map((m: any) => ({
          ...m,
          revenue: normalize(m.revenue),
        })),
      },
    };
  }
}