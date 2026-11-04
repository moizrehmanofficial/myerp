import { BadRequestException } from '@nestjs/common';
import { Db, nextDocNumber, round2, registerUpgradeHook } from './tenant-doc.helper';

// Default account codes (created for every company in tenant.service / upgrades)
export const ACC = {
  CASH: '1000',
  BANK: '1001',
  AR: '1100', // Accounts Receivable (customers owe us)
  INVENTORY: '1200',
  AP: '2000', // Accounts Payable (we owe suppliers)
  TAX: '2200', // Sales Tax Payable
  SALES: '4000',
  COGS: '5000',
} as const;

// Liabilities, equity and income grow on the CREDIT side
export const CREDIT_NORMAL = ['LIABILITY', 'EQUITY', 'INCOME'];

export function naturalBalance(type: string, debit: number, credit: number) {
  return CREDIT_NORMAL.includes(type) ? credit - debit : debit - credit;
}

// CASH → Cash in Hand; BANK / CHEQUE / ONLINE → Bank Account
export function cashAccountFor(method?: string) {
  const m = String(method || 'CASH').toUpperCase();
  return m === 'CASH' ? ACC.CASH : ACC.BANK;
}

export interface JournalLine {
  code?: string; // account code, e.g. ACC.AR
  accountId?: string; // or a direct account id (manual journals)
  debit?: number;
  credit?: number;
  description?: string;
}

export interface JournalInput {
  description: string;
  reference?: string | null;
  sourceType?: string | null; // 'invoice', 'invoice_payment', 'purchase', 'payment', 'receipt', 'manual'
  sourceId?: string | null;
  date?: Date | string | null; // defaults to now
  lines: JournalLine[];
}

// Creates one balanced journal entry. Must run inside a transaction.
export async function postJournal(db: Db, input: JournalInput) {
  const lines = input.lines
    .map((l) => ({ ...l, debit: round2(Number(l.debit) || 0), credit: round2(Number(l.credit) || 0) }))
    .filter((l) => l.debit > 0 || l.credit > 0);

  if (lines.length < 2) return null; // nothing to post (e.g. zero amount)

  for (const l of lines) {
    if (l.debit < 0 || l.credit < 0) throw new BadRequestException('Journal amounts cannot be negative');
  }

  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new BadRequestException(`Journal must balance. Debit: ${totalDebit}, Credit: ${totalCredit}`);
  }

  // Resolve account codes → ids
  const codes = [...new Set(lines.filter((l) => !l.accountId && l.code).map((l) => l.code as string))];
  const idByCode = new Map<string, string>();
  if (codes.length) {
    const rows = (await db.$queryRawUnsafe(
      `SELECT "id", "code" FROM "chart_of_accounts" WHERE "code" = ANY($1::text[])`,
      codes,
    )) as any[];
    rows.forEach((r) => idByCode.set(r.code, r.id));
    const missing = codes.filter((c) => !idByCode.has(c));
    if (missing.length) {
      throw new BadRequestException(`Account code(s) missing in Chart of Accounts: ${missing.join(', ')}`);
    }
  }

  const entryNumber = await nextDocNumber(db, 'journal');
  const entryRows = (await db.$queryRawUnsafe(
    `INSERT INTO "journal_entries" (
       "id", "entryNumber", "description", "totalDebit", "totalCredit",
       "reference", "sourceType", "sourceId", "createdAt"
     ) VALUES (
       gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::uuid, COALESCE($8::timestamp, NOW())
     ) RETURNING *`,
    entryNumber,
    input.description,
    totalDebit,
    totalCredit,
    input.reference || null,
    input.sourceType || null,
    input.sourceId || null,
    input.date ? new Date(input.date).toISOString() : null,
  )) as any[];
  const entry = entryRows[0];

  for (const l of lines) {
    const accountId = l.accountId || idByCode.get(l.code as string);
    await db.$queryRawUnsafe(
      `INSERT INTO "journal_items" ("id", "journalEntryId", "accountId", "debit", "credit", "description", "createdAt")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, $6::timestamp)`,
      entry.id,
      accountId,
      l.debit,
      l.credit,
      l.description || input.description,
      new Date(entry.createdAt).toISOString(),
    );
    // Stored balance keeps the existing convention: debit − credit
    await db.$queryRawUnsafe(
      `UPDATE "chart_of_accounts" SET "balance" = COALESCE("balance", 0) + $1 WHERE "id" = $2::uuid`,
      round2(l.debit - l.credit),
      accountId,
    );
  }

  return entry;
}

// Cancels everything a document has posted so far (net per account),
// by posting an opposite entry. Old entries stay for the audit trail.
export async function reverseSource(
  db: Db,
  sourceType: string,
  sourceId: string,
  description: string,
  reference?: string | null,
) {
  const rows = (await db.$queryRawUnsafe(
    `SELECT ji."accountId", SUM(ji."debit") AS "debit", SUM(ji."credit") AS "credit"
     FROM "journal_items" ji
     JOIN "journal_entries" je ON je."id" = ji."journalEntryId"
     WHERE je."sourceType" = $1 AND je."sourceId" = $2::uuid
     GROUP BY ji."accountId"`,
    sourceType,
    sourceId,
  )) as any[];

  const lines: JournalLine[] = [];
  for (const r of rows) {
    const net = round2(Number(r.debit) - Number(r.credit));
    if (net > 0) lines.push({ accountId: r.accountId, credit: net });
    else if (net < 0) lines.push({ accountId: r.accountId, debit: -net });
  }
  if (lines.length === 0) return null;

  return postJournal(db, { description, reference, sourceType, sourceId, lines });
}

// ── Document postings ─────────────────────────────────────────

// Sale invoice: customer owes total; sales + tax; cost of the goods sold
export async function postInvoiceSale(db: Db, inv: any, items: { productId: string; quantity: any }[], date?: any) {
  const total = round2(Number(inv.totalAmount) || 0);
  const tax = round2(Number(inv.tax) || 0);
  const revenue = round2(total - tax);

  // Cost = quantity × product purchase price
  let cost = 0;
  const ids = [...new Set(items.map((i) => i.productId))];
  if (ids.length) {
    const products = (await db.$queryRawUnsafe(
      `SELECT "id", "purchasePrice" FROM "products" WHERE "id" = ANY($1::uuid[])`,
      ids,
    )) as any[];
    const price = new Map(products.map((p) => [p.id, Number(p.purchasePrice) || 0]));
    cost = round2(items.reduce((s, i) => s + (Number(i.quantity) || 0) * (price.get(i.productId) || 0), 0));
  }

  return postJournal(db, {
    description: `Sale invoice ${inv.invoiceNumber}`,
    reference: inv.invoiceNumber,
    sourceType: 'invoice',
    sourceId: inv.id,
    date,
    lines: [
      { code: ACC.AR, debit: total, description: 'Customer receivable' },
      { code: ACC.SALES, credit: revenue, description: 'Sales revenue' },
      { code: ACC.TAX, credit: tax, description: 'Sales tax' },
      { code: ACC.COGS, debit: cost, description: 'Cost of goods sold' },
      { code: ACC.INVENTORY, credit: cost, description: 'Inventory out' },
    ],
  });
}

// Money received against an invoice (amount can be negative to undo)
export async function postInvoicePayment(db: Db, inv: any, amount: number, method?: string, date?: any) {
  const a = round2(amount);
  if (!a) return null;
  const cash = cashAccountFor(method);
  return postJournal(db, {
    description: `${a > 0 ? 'Payment received' : 'Payment adjusted'} for ${inv.invoiceNumber}`,
    reference: inv.invoiceNumber,
    sourceType: 'invoice_payment',
    sourceId: inv.id,
    date,
    lines:
      a > 0
        ? [{ code: cash, debit: a }, { code: ACC.AR, credit: a }]
        : [{ code: ACC.AR, debit: -a }, { code: cash, credit: -a }],
  });
}

// Purchase received: stock value in, we owe the supplier
export async function postPurchaseReceived(db: Db, po: any, date?: any) {
  const total = round2(Number(po.totalAmount) || 0);
  return postJournal(db, {
    description: `Purchase received ${po.orderNumber}`,
    reference: po.orderNumber,
    sourceType: 'purchase',
    sourceId: po.id,
    date,
    lines: [
      { code: ACC.INVENTORY, debit: total, description: 'Inventory in' },
      { code: ACC.AP, credit: total, description: 'Supplier payable' },
    ],
  });
}

export async function changeSupplierBalance(db: Db, supplierId: string, amount: number) {
  if (!amount || !supplierId) return;
  await db.$queryRawUnsafe(
    `UPDATE "suppliers" SET "balance" = COALESCE("balance", 0) + $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
    round2(amount),
    supplierId,
  );
}

export async function changeCustomerBalance(db: Db, customerId: string, amount: number) {
  if (!amount || !customerId) return;
  await db.$queryRawUnsafe(
    `UPDATE "customers" SET "balance" = COALESCE("balance", 0) + $1, "updatedAt" = NOW() WHERE "id" = $2::uuid`,
    round2(amount),
    customerId,
  );
}

// ── One-time sync of records created before auto-accounting ──────────
// Runs automatically once per company (see registerUpgradeHook below) and can be
// re-run safely: anything that already has its journal entry is skipped.
export async function syncOldRecords(client: any, slug: string) {
  return client.$transaction(async (tx: any) => {
    // Only one sync per company at a time (even across server instances)
    // COUNT wrapper: Prisma can't read the 'void' value the lock function returns
    await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS "locked" FROM (SELECT pg_advisory_xact_lock(hashtext($1))) t`,
      `legacy_sync:${slug}`,
    );

    let invoices = 0;
    let purchases = 0;

    const oldInvoices = (await tx.$queryRawUnsafe(
      `SELECT i.* FROM "invoices" i
       WHERE i."isDeleted" = false
         AND NOT EXISTS (
           SELECT 1 FROM "journal_entries" je
           WHERE je."sourceType" = 'invoice' AND je."sourceId" = i."id"
         )
       ORDER BY i."createdAt" ASC`,
    )) as any[];

    for (const inv of oldInvoices) {
      const items = (await tx.$queryRawUnsafe(
        `SELECT "productId", "quantity" FROM "invoice_items" WHERE "invoiceId" = $1::uuid`,
        inv.id,
      )) as any[];
      // Dated on the invoice's own date, so reports show the right month
      await postInvoiceSale(tx, inv, items, inv.createdAt);

      // Payment already in the accounts for this invoice (normally 0)
      const done = (await tx.$queryRawUnsafe(
        `SELECT COALESCE(SUM(ji."credit" - ji."debit"), 0) AS "paid"
         FROM "journal_items" ji
         JOIN "journal_entries" je ON je."id" = ji."journalEntryId"
         JOIN "chart_of_accounts" coa ON coa."id" = ji."accountId"
         WHERE je."sourceType" = 'invoice_payment' AND je."sourceId" = $1::uuid AND coa."code" = $2`,
        inv.id,
        ACC.AR,
      )) as any[];
      const paidToPost = round2(Number(inv.paidAmount) - Number(done[0].paid));
      await postInvoicePayment(tx, inv, paidToPost, 'CASH', inv.createdAt);

      // Very old invoices never touched the customer balance (newer ones did)
      if (!inv.isPosted && !inv.isJournaled) {
        await changeCustomerBalance(tx, inv.customerId, Number(inv.dueAmount));
      }
      await tx.$queryRawUnsafe(`UPDATE "invoices" SET "isJournaled" = true WHERE "id" = $1::uuid`, inv.id);
      invoices++;
    }

    const oldPurchases = (await tx.$queryRawUnsafe(
      `SELECT po.* FROM "purchase_orders" po
       WHERE po."isDeleted" = false AND po."status" = 'RECEIVED'
         AND COALESCE(po."isPosted", false) = false
         AND NOT EXISTS (
           SELECT 1 FROM "journal_entries" je
           WHERE je."sourceType" = 'purchase' AND je."sourceId" = po."id"
         )
       ORDER BY po."createdAt" ASC`,
    )) as any[];

    for (const po of oldPurchases) {
      await postPurchaseReceived(tx, po, po.createdAt);
      await changeSupplierBalance(tx, po.supplierId, Number(po.totalAmount));
      await tx.$queryRawUnsafe(`UPDATE "purchase_orders" SET "isPosted" = true WHERE "id" = $1::uuid`, po.id);
      purchases++;
    }

    if (invoices || purchases) {
      console.log(`[accounting] ${slug}: posted ${invoices} old invoice(s), ${purchases} old purchase(s)`);
    }
    return { invoices, purchases };
  }, { maxWait: 10000, timeout: 120000 });
}

registerUpgradeHook(async (client, slug) => {
  await syncOldRecords(client, slug);
});