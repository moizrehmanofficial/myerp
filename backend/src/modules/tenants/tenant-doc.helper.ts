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

export async function ensureTenantUpgrades(client: Db, slug: string) {
  if (upgradedTenants.has(slug)) return;
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