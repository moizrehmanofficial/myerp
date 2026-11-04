import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ensureTenantUpgrades, nextDocNumber, TX_OPTIONS, round2 } from './tenant-doc.helper';
import {
  ACC,
  cashAccountFor,
  naturalBalance,
  postJournal,
  changeCustomerBalance,
  changeSupplierBalance,
  syncOldRecords,
} from './tenant-accounting.helper';

@Injectable()
export class TenantFinanceService {
  constructor(private tenantService: TenantService) {}

  // ── CHART OF ACCOUNTS ─────────────────────────────────

  async getAccounts(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const rows = await client.$queryRawUnsafe(
      `SELECT * FROM "chart_of_accounts" WHERE "isActive" = true ORDER BY "code" ASC`,
    ) as any[];

    // Show balances the way accountants read them:
    // liabilities / equity / income as positive numbers
    const accounts = rows.map((a: any) => {
      const raw = Number(a.balance || 0); // stored as debit − credit
      return { ...a, balance: naturalBalance(a.type, raw > 0 ? raw : 0, raw < 0 ? -raw : 0) };
    });

    const grouped = {
      ASSET: accounts.filter((a: any) => a.type === 'ASSET'),
      LIABILITY: accounts.filter((a: any) => a.type === 'LIABILITY'),
      EQUITY: accounts.filter((a: any) => a.type === 'EQUITY'),
      INCOME: accounts.filter((a: any) => a.type === 'INCOME'),
      EXPENSE: accounts.filter((a: any) => a.type === 'EXPENSE'),
    };

    return { success: true, data: { accounts, grouped } };
  }

  async createAccount(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const existing = await client.$queryRawUnsafe(
      `SELECT id FROM "chart_of_accounts" WHERE "code" = $1 LIMIT 1`,
      body.code,
    ) as any[];

    if (existing.length > 0) throw new BadRequestException('Account code already exists');

    const result = await client.$queryRawUnsafe(
      `INSERT INTO "chart_of_accounts" ("id", "code", "name", "type", "parentId", "balance", "isActive")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, true)
       RETURNING *`,
      body.code,
      body.name,
      body.type,
      body.parentId || null,
    ) as any[];

    return { success: true, message: 'Account created successfully', data: result[0] };
  }

  async getLedger(slug: string, accountId: string, from?: string, to?: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const accounts = await client.$queryRawUnsafe(
      `SELECT * FROM "chart_of_accounts" WHERE "id" = $1::uuid LIMIT 1`, accountId,
    ) as any[];

    if (!accounts.length) throw new NotFoundException('Account not found');
    const account = accounts[0];

    let whereClause = `ji."accountId" = $1::uuid`;
    const params: any[] = [accountId];

    if (from) {
      params.push(from);
      whereClause += ` AND je."createdAt" >= $${params.length}::timestamp`;
    }
    if (to) {
      params.push(to);
      whereClause += ` AND je."createdAt" <= $${params.length}::timestamp`;
    }

    const entries = await client.$queryRawUnsafe(
      `SELECT ji.*, je."entryNumber", je."description", je."createdAt", je."reference", je."sourceType" AS "sourceType"
       FROM "journal_items" ji
       JOIN "journal_entries" je ON ji."journalEntryId" = je."id"
       WHERE ${whereClause}
       ORDER BY je."createdAt" ASC`,
      ...params,
    ) as any[];

    // Opening balance = everything before the "from" date, so the running
    // balance on screen matches the account's real balance
    const sign = ['ASSET', 'EXPENSE'].includes(account.type) ? 1 : -1;
    let openingBalance = 0;
    if (from) {
      const before = (await client.$queryRawUnsafe(
        `SELECT COALESCE(SUM(ji."debit"), 0) AS dr, COALESCE(SUM(ji."credit"), 0) AS cr
         FROM "journal_items" ji
         JOIN "journal_entries" je ON ji."journalEntryId" = je."id"
         WHERE ji."accountId" = $1::uuid AND je."createdAt" < $2::timestamp`,
        accountId, from,
      )) as any[];
      openingBalance = sign * (Number(before[0]?.dr || 0) - Number(before[0]?.cr || 0));
    }

    // Calculate running balance
    let runningBalance = openingBalance;
    const ledgerEntries = entries.map((entry: any) => {
      const debit = Number(entry.debit || 0);
      const credit = Number(entry.credit || 0);
      if (['ASSET', 'EXPENSE'].includes(account.type)) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }
      return { ...entry, debit, credit, runningBalance };
    });

    return {
      success: true,
      data: { account, openingBalance, closingBalance: runningBalance, entries: ledgerEntries },
    };
  }

  // ── JOURNAL VOUCHERS ──────────────────────────────────

  async getJournals(slug: string, page = 1, limit = 25) {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    const journals = await client.$queryRawUnsafe(
      `SELECT je.*,
        (SELECT json_agg(json_build_object(
          'id', ji.id, 'accountId', ji."accountId",
          'debit', ji.debit, 'credit', ji.credit,
          'description', ji.description,
          'accountName', coa.name, 'accountCode', coa.code
        ))
        FROM "journal_items" ji
        JOIN "chart_of_accounts" coa ON ji."accountId" = coa."id"
        WHERE ji."journalEntryId" = je."id") as "items"
       FROM "journal_entries" je
       ORDER BY je."createdAt" DESC
       LIMIT $1 OFFSET $2`,
      limit, offset,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "journal_entries"`,
    ) as any[];

    return {
      success: true,
      data: journals,
      meta: {
        total: Number(countResult[0].count),
        page, limit,
        totalPages: Math.ceil(Number(countResult[0].count) / limit),
      },
    };
  }

  async createJournal(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    const items = body.items || [];
    if (items.length < 2) throw new BadRequestException('Journal must have at least 2 entries');
    if (!body.description) throw new BadRequestException('Description is required');
    for (const i of items) {
      if (!i.accountId) throw new BadRequestException('Select an account on every line');
    }

    // Balance check + entry + items + account balances, all in one transaction
    const journal = await client.$transaction(async (tx: any) => {
      return postJournal(tx, {
        description: body.description,
        reference: body.reference || null,
        sourceType: body.sourceType || 'manual',
        sourceId: body.sourceId || null,
        lines: items.map((i: any) => ({
          accountId: i.accountId,
          debit: Number(i.debit) || 0,
          credit: Number(i.credit) || 0,
          description: i.description || null,
        })),
      });
    }, TX_OPTIONS);

    if (!journal) throw new BadRequestException('Journal amounts cannot all be zero');
    return { success: true, message: 'Journal entry created successfully', data: journal };
  }

  async getJournalOne(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const journals = await client.$queryRawUnsafe(
      `SELECT je.*,
        (SELECT json_agg(json_build_object(
          'id', ji.id, 'accountId', ji."accountId",
          'debit', ji.debit, 'credit', ji.credit,
          'description', ji.description,
          'accountName', coa.name, 'accountCode', coa.code
        ))
        FROM "journal_items" ji
        JOIN "chart_of_accounts" coa ON ji."accountId" = coa."id"
        WHERE ji."journalEntryId" = je."id") as "items"
       FROM "journal_entries" je
       WHERE je."id" = $1::uuid`,
      id,
    ) as any[];

    if (!journals.length) throw new NotFoundException('Journal entry not found');

    return { success: true, data: journals[0] };
  }

  // ── PAYMENTS (Money OUT) ───────────────────────────────

  async getPayments(slug: string, page = 1, limit = 25) {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    const payments = await client.$queryRawUnsafe(
      `SELECT p.*, s."name" as "supplierName", c."name" as "customerName"
       FROM "payments" p
       LEFT JOIN "suppliers" s ON p."supplierId" = s."id"
       LEFT JOIN "customers" c ON p."customerId" = c."id"
       WHERE p."type" = 'PAYMENT'
       ORDER BY p."createdAt" DESC
       LIMIT $1 OFFSET $2`,
      limit, offset,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "payments" WHERE "type" = 'PAYMENT'`,
    ) as any[];

    return {
      success: true,
      data: payments,
      meta: {
        total: Number(countResult[0].count),
        page, limit,
        totalPages: Math.ceil(Number(countResult[0].count) / limit),
      },
    };
  }

  // Money OUT.
  // Supplier  → Dr Accounts Payable, Cr Cash/Bank (supplier balance goes down)
  // Customer  → refund: Dr Accounts Receivable, Cr Cash/Bank
  // No party  → expense: Dr <selected expense account>, Cr Cash/Bank
  async createPayment(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    const amount = round2(Number(body.amount));
    if (!(amount > 0)) throw new BadRequestException('Amount must be greater than 0');
    if (!body.supplierId && !body.customerId && !body.debitAccountId) {
      throw new BadRequestException('Select a supplier, a customer, or the expense (debit) account');
    }

    const payment = await client.$transaction(async (tx: any) => {
      const result = (await tx.$queryRawUnsafe(
        `INSERT INTO "payments" ("id", "type", "method", "amount", "supplierId", "customerId", "reference", "notes")
         VALUES (gen_random_uuid(), 'PAYMENT', $1, $2, $3::uuid, $4::uuid, $5, $6)
         RETURNING *`,
        body.method || 'CASH',
        amount,
        body.supplierId || null,
        body.customerId || null,
        body.reference || null,
        body.notes || null,
      )) as any[];
      const p = result[0];

      const credit = body.creditAccountId
        ? { accountId: body.creditAccountId, credit: amount }
        : { code: cashAccountFor(body.method), credit: amount };

      let debit: any;
      if (body.supplierId) {
        debit = { code: ACC.AP, debit: amount };
        await changeSupplierBalance(tx, body.supplierId, -amount);
      } else if (body.customerId) {
        debit = { code: ACC.AR, debit: amount };
        await changeCustomerBalance(tx, body.customerId, amount);
      } else {
        debit = { accountId: body.debitAccountId, debit: amount };
      }

      await postJournal(tx, {
        description: body.notes || 'Payment voucher',
        reference: body.reference || null,
        sourceType: 'payment',
        sourceId: p.id,
        lines: [debit, credit],
      });
      return p;
    }, TX_OPTIONS);

    return { success: true, message: 'Payment recorded successfully', data: payment };
  }

  // ── RECEIPTS (Money IN) ────────────────────────────────

  async getReceipts(slug: string, page = 1, limit = 25) {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    const receipts = await client.$queryRawUnsafe(
      `SELECT p.*, s."name" as "supplierName", c."name" as "customerName"
       FROM "payments" p
       LEFT JOIN "suppliers" s ON p."supplierId" = s."id"
       LEFT JOIN "customers" c ON p."customerId" = c."id"
       WHERE p."type" = 'RECEIPT'
       ORDER BY p."createdAt" DESC
       LIMIT $1 OFFSET $2`,
      limit, offset,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "payments" WHERE "type" = 'RECEIPT'`,
    ) as any[];

    return {
      success: true,
      data: receipts,
      meta: {
        total: Number(countResult[0].count),
        page, limit,
        totalPages: Math.ceil(Number(countResult[0].count) / limit),
      },
    };
  }

  // Money IN.
  // Customer → Dr Cash/Bank, Cr Accounts Receivable; also marks the customer's
  //            oldest unpaid invoices as paid (FIFO), so invoice dues stay correct
  // Supplier → refund: Dr Cash/Bank, Cr Accounts Payable
  // No party → other income: Dr Cash/Bank, Cr <selected income account>
  async createReceipt(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    const amount = round2(Number(body.amount));
    if (!(amount > 0)) throw new BadRequestException('Amount must be greater than 0');
    if (!body.supplierId && !body.customerId && !body.creditAccountId) {
      throw new BadRequestException('Select a customer, a supplier, or the income (credit) account');
    }

    const receipt = await client.$transaction(async (tx: any) => {
      const result = (await tx.$queryRawUnsafe(
        `INSERT INTO "payments" ("id", "type", "method", "amount", "supplierId", "customerId", "reference", "notes")
         VALUES (gen_random_uuid(), 'RECEIPT', $1, $2, $3::uuid, $4::uuid, $5, $6)
         RETURNING *`,
        body.method || 'CASH',
        amount,
        body.supplierId || null,
        body.customerId || null,
        body.reference || null,
        body.notes || null,
      )) as any[];
      const r = result[0];

      const debit = body.debitAccountId
        ? { accountId: body.debitAccountId, debit: amount }
        : { code: cashAccountFor(body.method), debit: amount };

      let credit: any;
      if (body.customerId) {
        credit = { code: ACC.AR, credit: amount };
        await changeCustomerBalance(tx, body.customerId, -amount);

        // Apply to oldest unpaid invoices (only ones that are in the accounts)
        let left = amount;
        const open = (await tx.$queryRawUnsafe(
          `SELECT * FROM "invoices"
           WHERE "customerId" = $1::uuid AND "isDeleted" = false AND "dueAmount" > 0
             AND (COALESCE("isPosted", false) = true OR COALESCE("isJournaled", false) = true)
           ORDER BY "createdAt" ASC
           FOR UPDATE`,
          body.customerId,
        )) as any[];
        for (const inv of open) {
          if (left <= 0) break;
          const pay = round2(Math.min(left, Number(inv.dueAmount)));
          const newPaid = round2(Number(inv.paidAmount) + pay);
          const newDue = round2(Math.max(Number(inv.totalAmount) - newPaid, 0));
          await tx.$queryRawUnsafe(
            `UPDATE "invoices" SET "paidAmount" = $1, "dueAmount" = $2, "paymentStatus" = $3, "updatedAt" = NOW()
             WHERE "id" = $4::uuid`,
            newPaid,
            newDue,
            newDue <= 0 ? 'PAID' : 'PARTIAL',
            inv.id,
          );
          left = round2(left - pay);
        }
      } else if (body.supplierId) {
        credit = { code: ACC.AP, credit: amount };
        await changeSupplierBalance(tx, body.supplierId, amount);
      } else {
        credit = { accountId: body.creditAccountId, credit: amount };
      }

      await postJournal(tx, {
        description: body.notes || 'Receipt voucher',
        reference: body.reference || null,
        sourceType: 'receipt',
        sourceId: r.id,
        lines: [debit, credit],
      });
      return r;
    }, TX_OPTIONS);

    return { success: true, message: 'Receipt recorded successfully', data: receipt };
  }

  // Re-run the one-time sync of old invoices/purchases into the accounts.
  // (It also runs automatically once per company.) Safe to run again.
  async postOldRecords(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);
    const summary = await syncOldRecords(client, slug);
    return {
      success: true,
      message: `Posted ${summary.invoices} old invoice(s) and ${summary.purchases} old purchase(s) to accounts`,
      data: summary,
    };
  }

  async getTrialBalance(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const accounts = await client.$queryRawUnsafe(
      `SELECT coa.*,
        COALESCE(SUM(ji."debit"), 0) as "totalDebit",
        COALESCE(SUM(ji."credit"), 0) as "totalCredit"
       FROM "chart_of_accounts" coa
       LEFT JOIN "journal_items" ji ON coa."id" = ji."accountId"
       WHERE coa."isActive" = true
       GROUP BY coa."id"
       ORDER BY coa."code" ASC`,
    ) as any[];

    const data = accounts.map((a: any) => ({
      ...a,
      totalDebit: Number(a.totalDebit || 0),
      totalCredit: Number(a.totalCredit || 0),
      balance: Number(a.balance || 0),
    }));

    const totalDebit = data.reduce((sum: number, a: any) => sum + a.totalDebit, 0);
    const totalCredit = data.reduce((sum: number, a: any) => sum + a.totalCredit, 0);

    return {
      success: true,
      data: { accounts: data, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 },
    };
  }
}