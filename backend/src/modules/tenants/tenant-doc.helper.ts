import { BadRequestException } from '@nestjs/common';

// Works with both a normal Prisma client and a transaction client (tx)
export type Db = { $queryRawUnsafe: (query: string, ...params: any[]) => Promise<any> };

// ── Document numbering ───────────────────────────────────────
// Old code used COUNT(*) + 1, which gives DUPLICATE numbers after a
// delete or when two users save at the same time. A sequence row per
// document type, locked by Postgres, always gives the next unique number.
const DOCS = {
  invoice:        { table: 'invoices',             column: 'invoiceNumber', setting: 'invoice_prefix',  prefix: 'INV-', pad: 5 },
  sales:          { table: 'sales_orders',         column: 'orderNumber',   setting: 'sales_prefix',    prefix: 'SO-',  pad: 5 },
  purchase:       { table: 'purchase_orders',      column: 'orderNumber',   setting: 'purchase_prefix', prefix: 'PO-',  pad: 5 },
  employee:       { table: 'employees',            column: 'employeeCode',  setting: 'employee_prefix', prefix: 'EMP-', pad: 4 },
  journal:        { table: 'journal_entries',      column: 'entryNumber',   setting: null,              prefix: 'JV-',  pad: 5 },
  purchaseReturn: { table: 'purchase_returns',     column: 'returnNumber',  setting: null,              prefix: 'PR-',  pad: 5 },
  saleReturn:     { table: 'sale_returns',         column: 'returnNumber',  setting: null,              prefix: 'SR-',  pad: 5 },
  manufacturing:  { table: 'manufacturing_orders', column: 'orderNumber',   setting: null,              prefix: 'MO-',  pad: 5 },
} as const;

export type DocType = keyof typeof DOCS;

// One-time, per company: create new helper table/columns on old tenant schemas
const upgradedTenants = new Set<string>();
const upgradesInFlight = new Map<string, Promise<void>>();

// Extra one-time steps registered by other helpers (e.g. accounting sync)
type UpgradeHook = (client: any, slug: string) => Promise<void>;
const upgradeHooks: UpgradeHook[] = [];
export function registerUpgradeHook(hook: UpgradeHook) {
  upgradeHooks.push(hook);
}

export async function ensureTenantUpgrades(client: Db, slug: string) {
  if (upgradedTenants.has(slug)) return;
  // Two requests at the same time share one upgrade run
  if (!upgradesInFlight.has(slug)) {
    upgradesInFlight.set(
      slug,
      runTenantUpgrades(client, slug).finally(() => upgradesInFlight.delete(slug)),
    );
  }
  return upgradesInFlight.get(slug);
}

async function runTenantUpgrades(client: Db, slug: string) {
  await client.$queryRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "doc_sequences" (
      "key" VARCHAR(50) PRIMARY KEY,
      "value" INTEGER NOT NULL
    )`,
  );
  // true = this invoice already changed stock + customer balance.
  // Old invoices stay false, so editing/deleting them never "restores"
  // stock that was never deducted.
  await client.$queryRawUnsafe(
    `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "isPosted" BOOLEAN DEFAULT false`,
  );

  // Payroll: when and how a salary was paid (Part 3)
  await client.$queryRawUnsafe(`ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP`);
  await client.$queryRawUnsafe(`ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "paidMethod" VARCHAR(20)`);

  // ── Accounting upgrades (Batch 4) ──
  // isJournaled = old invoice that was later posted to accounts (no stock change)
  await client.$queryRawUnsafe(
    `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "isJournaled" BOOLEAN DEFAULT false`,
  );
  // isPosted on purchase = journal + supplier balance done for this received order
  await client.$queryRawUnsafe(
    `ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "isPosted" BOOLEAN DEFAULT false`,
  );
  // Link every auto journal to the document that created it
  await client.$queryRawUnsafe(
    `ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "sourceType" VARCHAR(50)`,
  );
  await client.$queryRawUnsafe(
    `ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "sourceId" UUID`,
  );
  await client.$queryRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "journal_entries_source_idx" ON "journal_entries" ("sourceType", "sourceId")`,
  );
  // Accounts the auto-posting needs (old companies may be missing some)
  const requiredAccounts: [string, string, string][] = [
    ['1000', 'Cash in Hand', 'ASSET'],
    ['1001', 'Bank Account', 'ASSET'],
    ['1100', 'Accounts Receivable', 'ASSET'],
    ['1200', 'Inventory', 'ASSET'],
    ['2000', 'Accounts Payable', 'LIABILITY'],
    ['2200', 'Sales Tax Payable', 'LIABILITY'],
    ['4000', 'Sales Revenue', 'INCOME'],
    ['5000', 'Cost of Goods Sold', 'EXPENSE'],
    ['5100', 'Salaries Expense', 'EXPENSE'],
  ];
  for (const [code, name, type] of requiredAccounts) {
    await client.$queryRawUnsafe(
      `INSERT INTO "chart_of_accounts" ("id", "code", "name", "type", "balance", "isActive")
       VALUES (gen_random_uuid(), $1, $2, $3, 0, true)
       ON CONFLICT ("code") DO NOTHING`,
      code,
      name,
      type,
    );
  }

  // ── Indexes (Batch 5): keep lists, reports and lookups fast as data grows ──
  const indexes: [string, string, string][] = [
    // [index name, table, columns]
    ['idx_invoices_customer', 'invoices', '"customerId"'],
    ['idx_invoices_created', 'invoices', '"isDeleted", "createdAt"'],
    ['idx_invoices_status', 'invoices', '"paymentStatus"'],
    ['idx_invoice_items_invoice', 'invoice_items', '"invoiceId"'],
    ['idx_invoice_items_product', 'invoice_items', '"productId"'],
    ['idx_sales_orders_customer', 'sales_orders', '"customerId"'],
    ['idx_sales_orders_created', 'sales_orders', '"isDeleted", "createdAt"'],
    ['idx_sales_items_order', 'sales_items', '"salesOrderId"'],
    ['idx_purchase_orders_supplier', 'purchase_orders', '"supplierId"'],
    ['idx_purchase_orders_created', 'purchase_orders', '"isDeleted", "createdAt"'],
    ['idx_purchase_items_order', 'purchase_items', '"purchaseOrderId"'],
    ['idx_products_name', 'products', '"name"'],
    ['idx_products_category', 'products', '"categoryId"'],
    ['idx_products_barcode', 'products', '"barcode"'],
    ['idx_customers_name', 'customers', '"name"'],
    ['idx_suppliers_name', 'suppliers', '"name"'],
    ['idx_inventory_tx_product', 'inventory_transactions', '"productId", "createdAt"'],
    ['idx_inventory_tx_created', 'inventory_transactions', '"createdAt"'],
    ['idx_payments_type', 'payments', '"type", "createdAt"'],
    ['idx_payments_customer', 'payments', '"customerId"'],
    ['idx_payments_supplier', 'payments', '"supplierId"'],
    ['idx_payments_invoice', 'payments', '"invoiceId"'],
    ['idx_journal_entries_created', 'journal_entries', '"createdAt"'],
    ['idx_journal_items_account', 'journal_items', '"accountId"'],
    ['idx_journal_items_entry', 'journal_items', '"journalEntryId"'],
    ['idx_audit_logs_created', 'audit_logs', '"createdAt"'],
    ['idx_audit_logs_module', 'audit_logs', '"module", "action"'],
    ['idx_audit_logs_user', 'audit_logs', '"userId"'],
    ['idx_employees_status', 'employees', '"isDeleted", "status"'],
    ['idx_attendance_employee', 'attendance', '"employeeId", "date"'],
    ['idx_payroll_period', 'payroll', '"year", "month"'],
    ['idx_leave_requests_employee', 'leave_requests', '"employeeId", "status"'],
  ];
  // Audit log "browser" column (older companies may not have it)
  await client.$queryRawUnsafe(`ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "browser" VARCHAR(100)`);
  for (const [name, table, columns] of indexes) {
    try {
      await client.$queryRawUnsafe(`CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${columns})`);
    } catch (err: any) {
      // A missing table/column in a very old company must not stop the rest
      console.error(`[tenant-upgrade] index ${name} skipped:`, err?.message || err);
    }
  }

  for (const hook of upgradeHooks) {
    try {
      await hook(client, slug);
    } catch (err) {
      // Never block the ERP because of a one-time background step
      console.error(`[tenant-upgrade] ${slug}:`, err);
    }
  }

  upgradedTenants.add(slug);
}

export async function nextDocNumber(db: Db, type: DocType): Promise<string> {
  const doc = DOCS[type];

  // Starts after the highest number already in the table (keeps old numbers safe)
  const rows = (await db.$queryRawUnsafe(
    `INSERT INTO "doc_sequences" ("key", "value")
     VALUES ($1, (
       SELECT COALESCE(MAX(CAST(SUBSTRING("${doc.column}" FROM '([0-9]+)$') AS INTEGER)), 0) + 1
       FROM "${doc.table}"
     ))
     ON CONFLICT ("key") DO UPDATE SET "value" = "doc_sequences"."value" + 1
     RETURNING "value"`,
    type,
  )) as any[];
  const value = Number(rows[0].value);

  let prefix: string = doc.prefix;
  if (doc.setting) {
    const s = (await db.$queryRawUnsafe(
      `SELECT "value" FROM "settings" WHERE "key" = $1 LIMIT 1`,
      doc.setting,
    )) as any[];
    if (s?.[0]?.value) prefix = String(s[0].value);
  }

  return `${prefix}${String(value).padStart(doc.pad, '0')}`;
}

// ── Stock helpers (always inside a transaction) ──────────────

// Decrease stock; fails (and rolls back everything) if not enough stock
export async function stockOut(db: Db, productId: string, qty: number, reference: string, notes: string) {
  if (!(qty > 0)) return;
  const rows = (await db.$queryRawUnsafe(
    `UPDATE "products"
     SET "stock" = "stock" - $1, "updatedAt" = NOW()
     WHERE "id" = $2::uuid AND "isDeleted" = false AND "stock" >= $1
     RETURNING "id"`,
    qty,
    productId,
  )) as any[];

  if (!rows || rows.length === 0) {
    const p = (await db.$queryRawUnsafe(
      `SELECT "name", "stock" FROM "products" WHERE "id" = $1::uuid LIMIT 1`,
      productId,
    )) as any[];
    if (!p || p.length === 0) throw new BadRequestException('Product not found');
    throw new BadRequestException(
      `Not enough stock for "${p[0].name}". Available: ${Number(p[0].stock)}, required: ${qty}`,
    );
  }

  await db.$queryRawUnsafe(
    `INSERT INTO "inventory_transactions" ("id", "productId", "type", "quantity", "reference", "notes")
     VALUES (gen_random_uuid(), $1::uuid, 'OUT', $2, $3, $4)`,
    productId,
    qty,
    reference,
    notes,
  );
}

// Increase stock
export async function stockIn(db: Db, productId: string, qty: number, reference: string, notes: string) {
  if (!(qty > 0)) return;
  await db.$queryRawUnsafe(
    `UPDATE "products" SET "stock" = "stock" + $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
    qty,
    productId,
  );
  await db.$queryRawUnsafe(
    `INSERT INTO "inventory_transactions" ("id", "productId", "type", "quantity", "reference", "notes")
     VALUES (gen_random_uuid(), $1::uuid, 'IN', $2, $3, $4)`,
    productId,
    qty,
    reference,
    notes,
  );
}

// Same product on 2 lines → one stock check for the total quantity
export function groupQtyByProduct(items: { productId: string; quantity: any }[]) {
  const map = new Map<string, number>();
  for (const item of items) {
    const q = Number(item.quantity) || 0;
    map.set(item.productId, (map.get(item.productId) || 0) + q);
  }
  return map;
}

// Interactive transactions on a remote DB (Neon) need more than the 5s default
export const TX_OPTIONS = { maxWait: 10000, timeout: 30000 };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
