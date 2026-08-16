import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantFinanceService {
  constructor(private tenantService: TenantService) {}

  // ── CHART OF ACCOUNTS ─────────────────────────────────

  async getAccounts(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const accounts = await client.$queryRawUnsafe(
      `SELECT * FROM "chart_of_accounts" WHERE "isActive" = true ORDER BY "code" ASC`,
    ) as any[];

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
      `SELECT ji.*, je."entryNumber", je."description", je."createdAt", je."reference"
       FROM "journal_items" ji
       JOIN "journal_entries" je ON ji."journalEntryId" = je."id"
       WHERE ${whereClause}
       ORDER BY je."createdAt" ASC`,
      ...params,
    ) as any[];

    // Calculate running balance
    let runningBalance = 0;
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
      data: { account, entries: ledgerEntries },
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

    const items = body.items || [];
    if (items.length < 2) throw new BadRequestException('Journal must have at least 2 entries');

    const totalDebit = items.reduce((sum: number, i: any) => sum + (parseFloat(i.debit) || 0), 0);
    const totalCredit = items.reduce((sum: number, i: any) => sum + (parseFloat(i.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(`Journal must balance. Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }

    // Generate entry number
    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "journal_entries"`,
    ) as any[];
    const count = Number(countResult[0].count) + 1;
    const entryNumber = `JV-${String(count).padStart(5, '0')}`;

    const journalResult = await client.$queryRawUnsafe(
      `INSERT INTO "journal_entries" ("id", "entryNumber", "description", "totalDebit", "totalCredit", "reference")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       RETURNING *`,
      entryNumber,
      body.description,
      totalDebit,
      totalCredit,
      body.reference || null,
    ) as any[];

    const journal = journalResult[0];

    for (const item of items) {
      const debit = parseFloat(item.debit) || 0;
      const credit = parseFloat(item.credit) || 0;

      await client.$queryRawUnsafe(
        `INSERT INTO "journal_items" ("id", "journalEntryId", "accountId", "debit", "credit", "description")
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5)`,
        journal.id,
        item.accountId,
        debit,
        credit,
        item.description || null,
      );

      // Update account balance
      await client.$queryRawUnsafe(
        `UPDATE "chart_of_accounts"
         SET "balance" = "balance" + $1
         WHERE "id" = $2::uuid`,
        debit - credit,
        item.accountId,
      );
    }

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

  async createPayment(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const result = await client.$queryRawUnsafe(
      `INSERT INTO "payments" ("id", "type", "method", "amount", "supplierId", "customerId", "reference", "notes")
       VALUES (gen_random_uuid(), 'PAYMENT', $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      body.method || 'CASH',
      parseFloat(body.amount),
      body.supplierId || null,
      body.customerId || null,
      body.reference || null,
      body.notes || null,
    ) as any[];

    // Auto create journal entry
    if (body.debitAccountId && body.creditAccountId) {
      await this.createJournal(slug, {
        description: body.notes || 'Payment Voucher',
        reference: result[0].id,
        items: [
          { accountId: body.debitAccountId, debit: body.amount, credit: 0, description: 'Payment' },
          { accountId: body.creditAccountId, debit: 0, credit: body.amount, description: 'Payment' },
        ],
      });
    }

    return { success: true, message: 'Payment recorded successfully', data: result[0] };
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

  async createReceipt(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const result = await client.$queryRawUnsafe(
      `INSERT INTO "payments" ("id", "type", "method", "amount", "supplierId", "customerId", "reference", "notes")
       VALUES (gen_random_uuid(), 'RECEIPT', $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      body.method || 'CASH',
      parseFloat(body.amount),
      body.supplierId || null,
      body.customerId || null,
      body.reference || null,
      body.notes || null,
    ) as any[];

    // Auto create journal entry
    if (body.debitAccountId && body.creditAccountId) {
      await this.createJournal(slug, {
        description: body.notes || 'Receipt Voucher',
        reference: result[0].id,
        items: [
          { accountId: body.debitAccountId, debit: body.amount, credit: 0, description: 'Receipt' },
          { accountId: body.creditAccountId, debit: 0, credit: body.amount, description: 'Receipt' },
        ],
      });
    }

    return { success: true, message: 'Receipt recorded successfully', data: result[0] };
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