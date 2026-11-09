import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);
  private tenantClients: Map<string, PrismaClient> = new Map();

  constructor(private configService: ConfigService) {}

  // Each company gets its own small pool of database connections.
  //
  // Before: one connection per company (connection_limit=1) and an extra
  // "SET search_path" round trip before every request. All requests of a
  // company waited in one line, so pages with several calls (dashboard,
  // reports) were slow and a long transaction made everything else hang.
  //
  // Now: a few connections per company. Prisma sets the schema on every new
  // connection from the ?schema= setting, so no extra query per request.
  // When a client is created we check that every connection really is on the
  // company's schema; if not, we fall back to the old safe behaviour.
  private inFlight = new Map<string, Promise<PrismaClient>>();
  private lastUsed = new Map<string, number>();
  private legacy = new Set<string>(); // clients that need SET search_path per request
  private sweeper?: NodeJS.Timeout;

  async getTenantClient(slug: string): Promise<PrismaClient> {
    // Block SQL injection / random schema names via slug
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      throw new BadRequestException('Invalid company');
    }
    this.lastUsed.set(slug, Date.now());

    const cached = this.tenantClients.get(slug);
    if (cached) {
      if (this.legacy.has(slug)) {
        await cached.$executeRawUnsafe(`SET search_path TO "tenant_${slug}", public`);
      }
      return cached;
    }

    // Two requests at the same moment must not create two clients
    let pending = this.inFlight.get(slug);
    if (!pending) {
      pending = this.createTenantClient(slug)
        .then((client) => {
          this.tenantClients.set(slug, client);
          this.startSweeper();
          return client;
        })
        .finally(() => this.inFlight.delete(slug));
      this.inFlight.set(slug, pending);
    }
    return pending;
  }

  private poolSize() {
    const n = Number(this.configService.get<string>('TENANT_DB_CONNECTIONS') || 5);
    return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 20) : 5;
  }

  // The database address used for company data.
  // Neon's "-pooler" address (PgBouncer, transaction mode) does not keep
  // session settings like search_path, so a query could run against the
  // wrong schema. Company clients therefore use the direct address.
  // TENANT_DATABASE_URL overrides this if you want a different address.
  private tenantBaseUrl(): string {
    const explicit = this.configService.get<string>('TENANT_DATABASE_URL');
    const base = explicit || this.configService.get<string>('DATABASE_URL')!;
    try {
      const u = new URL(base);
      if (!explicit && u.hostname.includes('-pooler.')) {
        u.hostname = u.hostname.replace('-pooler.', '.');
        this.logger.log('Company data uses the direct Neon address (not -pooler)');
      }
      u.searchParams.delete('pgbouncer');
      u.searchParams.delete('connection_limit');
      u.searchParams.delete('schema');
      return u.toString();
    } catch {
      return base;
    }
  }

  private async createTenantClient(slug: string): Promise<PrismaClient> {
    const schemaName = `tenant_${slug}`;
    const size = this.poolSize();
    let client = this.newClient(this.tenantUrl(schemaName, size));
    await client.$connect();

    // Open several connections at once and check each one's schema
    let ok = false;
    try {
      const rows = await Promise.all(
        Array.from({ length: size }, () =>
          client.$queryRawUnsafe(`SELECT current_schema() AS "s", pg_backend_pid() AS "pid" FROM pg_sleep(0.05)`),
        ),
      );
      ok = rows.every((r: any) => r?.[0]?.s === schemaName);
    } catch (err) {
      this.logger.warn(`Schema check failed for ${slug}: ${(err as Error).message}`);
    }

    if (!ok) {
      this.logger.warn(`Connections for ${slug} are not on ${schemaName}; using one connection with SET search_path`);
      await client.$disconnect().catch(() => undefined);
      client = this.newClient(this.tenantUrl(schemaName, 1));
      await client.$connect();
      await client.$executeRawUnsafe(`SET search_path TO "${schemaName}", public`);
      this.legacy.add(slug);
    } else {
      this.legacy.delete(slug);
    }

    this.logger.log(`Tenant client ready: ${slug} (${ok ? size : 1} connection${ok && size > 1 ? 's' : ''})`);
    return client;
  }

  private newClient(url: string) {
    return new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
  }

  private tenantUrl(schemaName: string, size: number) {
    const u = new URL(this.tenantBaseUrl());
    u.searchParams.set('schema', schemaName);
    u.searchParams.set('connection_limit', String(size));
    u.searchParams.set('pool_timeout', '20');
    return u.toString();
  }

  // Close pools of companies nobody has used for a while, so many companies
  // do not use up the database's connection limit
  private startSweeper() {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      const cutoff = Date.now() - 15 * 60_000;
      for (const [slug, client] of this.tenantClients) {
        if ((this.lastUsed.get(slug) || 0) < cutoff) {
          this.tenantClients.delete(slug);
          this.legacy.delete(slug);
          client.$disconnect().catch(() => undefined);
          this.logger.log(`Closed idle connections for ${slug}`);
        }
      }
    }, 5 * 60_000);
    this.sweeper.unref?.();
  }

  async createTenantSchema(slug: string): Promise<void> {
    const schemaName = `tenant_${slug}`;
    // Direct address (not -pooler): schema changes need a real session
    const baseUrl = this.tenantBaseUrl();
    const urlWithSchema = this.tenantUrl(schemaName, 1);

    const adminClient = new PrismaClient({
      datasources: { db: { url: baseUrl } },
    });

    try {
      await adminClient.$connect();
      await adminClient.$executeRawUnsafe(
        `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`
      );
      this.logger.log(`✅ Schema created: ${schemaName}`);

      const tenantClient = new PrismaClient({
        datasources: { db: { url: urlWithSchema } },
      });

      await tenantClient.$connect();
      await tenantClient.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);
      await tenantClient.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
      await this.runTenantMigrations(tenantClient);
      await tenantClient.$disconnect();

      this.logger.log(`✅ Migrations ran for: ${schemaName}`);
    } catch (error) {
      this.logger.error(`❌ Failed to create schema: ${schemaName}`, error);
      throw error;
    } finally {
      await adminClient.$disconnect();
    }
  }

  private async runTenantMigrations(client: PrismaClient): Promise<void> {
    const statements = [
      `CREATE TABLE IF NOT EXISTS "roles" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "isDefault" BOOLEAN DEFAULT false,
        "moduleKeys" JSONB DEFAULT '[]',
        "permissions" JSONB DEFAULT '{}',
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "permissions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "module" VARCHAR(100) NOT NULL,
        "action" VARCHAR(100) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("module", "action")
      )`,

      `CREATE TABLE IF NOT EXISTS "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) UNIQUE NOT NULL,
        "phone" VARCHAR(50),
        "password" VARCHAR(255) NOT NULL,
        "refreshToken" TEXT,
        "roleId" UUID REFERENCES "roles"("id") ON DELETE SET NULL,
        "status" VARCHAR(20) DEFAULT 'ACTIVE',
        "isOwner" BOOLEAN DEFAULT false,
        "isDeleted" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "role_permissions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "roleId" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "permissionId" UUID NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("roleId", "permissionId")
      )`,

      `CREATE TABLE IF NOT EXISTS "customers" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255),
        "phone" VARCHAR(50),
        "address" TEXT,
        "balance" DECIMAL(15,2) DEFAULT 0,
        "isDeleted" BOOLEAN DEFAULT false,
        "deletedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "suppliers" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255),
        "phone" VARCHAR(50),
        "address" TEXT,
        "balance" DECIMAL(15,2) DEFAULT 0,
        "isDeleted" BOOLEAN DEFAULT false,
        "deletedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "categories" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "brands" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "products" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "sku" VARCHAR(100) UNIQUE NOT NULL,
        "barcode" VARCHAR(100),
        "name" VARCHAR(255) NOT NULL,
        "categoryId" UUID REFERENCES "categories"("id"),
        "brandId" UUID REFERENCES "brands"("id"),
        "unit" VARCHAR(50) DEFAULT 'pcs',
        "purchasePrice" DECIMAL(15,2) DEFAULT 0,
        "salePrice" DECIMAL(15,2) DEFAULT 0,
        "stock" DECIMAL(15,2) DEFAULT 0,
        "minStock" DECIMAL(15,2) DEFAULT 0,
        "maxStock" DECIMAL(15,2) DEFAULT 0,
        "status" VARCHAR(20) DEFAULT 'ACTIVE',
        "isDeleted" BOOLEAN DEFAULT false,
        "deletedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "inventory_transactions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "productId" UUID NOT NULL REFERENCES "products"("id"),
        "type" VARCHAR(20) NOT NULL,
        "quantity" DECIMAL(15,2) NOT NULL,
        "reference" VARCHAR(255),
        "notes" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "purchase_orders" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderNumber" VARCHAR(100) UNIQUE NOT NULL,
        "supplierId" UUID NOT NULL REFERENCES "suppliers"("id"),
        "status" VARCHAR(20) DEFAULT 'PENDING',
        "totalAmount" DECIMAL(15,2) DEFAULT 0,
        "notes" TEXT,
        "isDeleted" BOOLEAN DEFAULT false,
        "deletedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "purchase_items" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "purchaseOrderId" UUID NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
        "productId" UUID NOT NULL REFERENCES "products"("id"),
        "quantity" DECIMAL(15,2) NOT NULL,
        "unitPrice" DECIMAL(15,2) NOT NULL,
        "totalPrice" DECIMAL(15,2) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "invoices" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoiceNumber" VARCHAR(100) UNIQUE NOT NULL,
        "customerId" UUID NOT NULL REFERENCES "customers"("id"),
        "status" VARCHAR(20) DEFAULT 'DRAFT',
        "paymentStatus" VARCHAR(20) DEFAULT 'UNPAID',
        "subtotal" DECIMAL(15,2) DEFAULT 0,
        "discount" DECIMAL(15,2) DEFAULT 0,
        "tax" DECIMAL(15,2) DEFAULT 0,
        "totalAmount" DECIMAL(15,2) DEFAULT 0,
        "paidAmount" DECIMAL(15,2) DEFAULT 0,
        "dueAmount" DECIMAL(15,2) DEFAULT 0,
        "dueDate" TIMESTAMP,
        "notes" TEXT,
        "isDeleted" BOOLEAN DEFAULT false,
        "deletedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "invoice_items" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoiceId" UUID NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
        "productId" UUID NOT NULL REFERENCES "products"("id"),
        "quantity" DECIMAL(15,2) NOT NULL,
        "unitPrice" DECIMAL(15,2) NOT NULL,
        "discount" DECIMAL(15,2) DEFAULT 0,
        "totalPrice" DECIMAL(15,2) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "payments" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoiceId" UUID REFERENCES "invoices"("id"),
        "customerId" UUID REFERENCES "customers"("id"),
        "supplierId" UUID REFERENCES "suppliers"("id"),
        "type" VARCHAR(20) NOT NULL,
        "method" VARCHAR(20) DEFAULT 'CASH',
        "amount" DECIMAL(15,2) NOT NULL,
        "reference" VARCHAR(255),
        "notes" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "chart_of_accounts" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" VARCHAR(50) UNIQUE NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "type" VARCHAR(20) NOT NULL,
        "parentId" UUID REFERENCES "chart_of_accounts"("id"),
        "balance" DECIMAL(15,2) DEFAULT 0,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "journal_entries" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "entryNumber" VARCHAR(100) UNIQUE NOT NULL,
        "description" TEXT NOT NULL,
        "totalDebit" DECIMAL(15,2) NOT NULL,
        "totalCredit" DECIMAL(15,2) NOT NULL,
        "reference" VARCHAR(255),
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "journal_items" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "journalEntryId" UUID NOT NULL REFERENCES "journal_entries"("id") ON DELETE CASCADE,
        "accountId" UUID NOT NULL REFERENCES "chart_of_accounts"("id"),
        "debit" DECIMAL(15,2) DEFAULT 0,
        "credit" DECIMAL(15,2) DEFAULT 0,
        "description" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "employees" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "employeeCode" VARCHAR(100) UNIQUE NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255),
        "phone" VARCHAR(50),
        "cnic" VARCHAR(50),
        "department" VARCHAR(255),
        "designation" VARCHAR(255),
        "joiningDate" TIMESTAMP,
        "salary" DECIMAL(15,2) DEFAULT 0,
        "status" VARCHAR(20) DEFAULT 'ACTIVE',
        "isDeleted" BOOLEAN DEFAULT false,
        "deletedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "attendance" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "employeeId" UUID NOT NULL REFERENCES "employees"("id"),
        "date" TIMESTAMP NOT NULL,
        "checkIn" TIMESTAMP,
        "checkOut" TIMESTAMP,
        "status" VARCHAR(20) DEFAULT 'PRESENT',
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "leaves" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "employeeId" UUID NOT NULL REFERENCES "employees"("id"),
        "type" VARCHAR(100) NOT NULL,
        "startDate" TIMESTAMP NOT NULL,
        "endDate" TIMESTAMP NOT NULL,
        "reason" TEXT,
        "status" VARCHAR(20) DEFAULT 'PENDING',
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "payroll" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "employeeId" UUID NOT NULL REFERENCES "employees"("id"),
        "month" INTEGER NOT NULL,
        "year" INTEGER NOT NULL,
        "basicSalary" DECIMAL(15,2) NOT NULL,
        "allowances" DECIMAL(15,2) DEFAULT 0,
        "deductions" DECIMAL(15,2) DEFAULT 0,
        "tax" DECIMAL(15,2) DEFAULT 0,
        "netSalary" DECIMAL(15,2) NOT NULL,
        "status" VARCHAR(20) DEFAULT 'PENDING',
        "slipUrl" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID,
        "action" VARCHAR(255) NOT NULL,
        "module" VARCHAR(100) NOT NULL,
        "recordId" UUID,
        "ipAddress" VARCHAR(50),
        "device" VARCHAR(255),
        "browser" VARCHAR(255),
        "details" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "settings" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" VARCHAR(255) UNIQUE NOT NULL,
        "value" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "notifications" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" VARCHAR(255) NOT NULL,
        "message" TEXT NOT NULL,
        "isRead" BOOLEAN DEFAULT false,
        "userId" UUID,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "sales_orders" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderNumber" VARCHAR(100) UNIQUE NOT NULL,
        "customerId" UUID NOT NULL REFERENCES "customers"("id"),
        "status" VARCHAR(20) DEFAULT 'PENDING',
        "subtotal" DECIMAL(15,2) DEFAULT 0,
        "discount" DECIMAL(15,2) DEFAULT 0,
        "tax" DECIMAL(15,2) DEFAULT 0,
        "totalAmount" DECIMAL(15,2) DEFAULT 0,
        "notes" TEXT,
        "isDeleted" BOOLEAN DEFAULT false,
        "deletedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "sales_items" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "salesOrderId" UUID NOT NULL REFERENCES "sales_orders"("id") ON DELETE CASCADE,
        "productId" UUID NOT NULL REFERENCES "products"("id"),
        "quantity" DECIMAL(15,2) NOT NULL,
        "unitPrice" DECIMAL(15,2) NOT NULL,
        "discount" DECIMAL(15,2) DEFAULT 0,
        "totalPrice" DECIMAL(15,2) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS "purchase_returns" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "returnNumber" VARCHAR(100) UNIQUE NOT NULL,
        "supplierId" UUID NOT NULL REFERENCES "suppliers"("id"),
        "purchaseOrderId" UUID REFERENCES "purchase_orders"("id"),
        "totalAmount" DECIMAL(15,2) DEFAULT 0,
        "reason" TEXT,
        "status" VARCHAR(20) DEFAULT 'PENDING',
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "purchase_return_items" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "purchaseReturnId" UUID NOT NULL REFERENCES "purchase_returns"("id") ON DELETE CASCADE,
        "productId" UUID NOT NULL REFERENCES "products"("id"),
        "quantity" DECIMAL(15,2) NOT NULL,
        "unitPrice" DECIMAL(15,2) NOT NULL,
        "totalPrice" DECIMAL(15,2) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "sale_returns" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "returnNumber" VARCHAR(100) UNIQUE NOT NULL,
        "customerId" UUID NOT NULL REFERENCES "customers"("id"),
        "invoiceId" UUID REFERENCES "invoices"("id"),
        "totalAmount" DECIMAL(15,2) DEFAULT 0,
        "reason" TEXT,
        "status" VARCHAR(20) DEFAULT 'PENDING',
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "sale_return_items" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "saleReturnId" UUID NOT NULL REFERENCES "sale_returns"("id") ON DELETE CASCADE,
        "productId" UUID NOT NULL REFERENCES "products"("id"),
        "quantity" DECIMAL(15,2) NOT NULL,
        "unitPrice" DECIMAL(15,2) NOT NULL,
        "totalPrice" DECIMAL(15,2) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "manufacturing_orders" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderNumber" VARCHAR(100) UNIQUE NOT NULL,
        "productId" UUID NOT NULL REFERENCES "products"("id"),
        "quantity" DECIMAL(15,2) NOT NULL,
        "status" VARCHAR(20) DEFAULT 'PLANNED',
        "startDate" TIMESTAMP,
        "endDate" TIMESTAMP,
        "notes" TEXT,
        "isDeleted" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "manufacturing_materials" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "manufacturingOrderId" UUID NOT NULL REFERENCES "manufacturing_orders"("id") ON DELETE CASCADE,
        "productId" UUID NOT NULL REFERENCES "products"("id"),
        "requiredQuantity" DECIMAL(15,2) NOT NULL,
        "usedQuantity" DECIMAL(15,2) DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "leave_types" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "daysAllowed" INTEGER NOT NULL DEFAULT 0,
        "isPaid" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "leave_requests" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "employeeId" UUID NOT NULL REFERENCES "employees"("id"),
        "leaveTypeId" UUID NOT NULL REFERENCES "leave_types"("id"),
        "startDate" TIMESTAMP NOT NULL,
        "endDate" TIMESTAMP NOT NULL,
        "totalDays" INTEGER NOT NULL DEFAULT 1,
        "reason" TEXT,
        "status" VARCHAR(20) DEFAULT 'PENDING',
        "approvedBy" UUID REFERENCES "users"("id"),
        "approvedAt" TIMESTAMP,
        "rejectionReason" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )`,
    ];

    for (const sql of statements) {
      await client.$executeRawUnsafe(sql);
    }

    this.logger.log(`✅ All tables created successfully`);
  }

  async seedTenantData(
    slug: string,
    ceoName: string,
    ceoEmail: string,
    hashedPassword: string,
    moduleKeys: string[] = [],
  ) {
    const client = await this.getTenantClient(slug);

    // ── Create Owner role WITH moduleKeys ──────────────────
    // Build full permissions for all selected modules
    const ownerPermissions: Record<string, any> = {};
    moduleKeys.forEach((key: string) => {
      ownerPermissions[key] = {
        read: true, write: true, modify: true,
        delete: true, print: true, export: true, approve: true,
      };
    });

    const roleResult = await client.$queryRawUnsafe(`
      INSERT INTO "roles" ("id", "name", "description", "isDefault", "moduleKeys", "permissions")
      VALUES (gen_random_uuid(), 'Owner', 'Company Owner with all permissions', false, $1::jsonb, $2::jsonb)
      RETURNING "id"
    `, JSON.stringify(moduleKeys), JSON.stringify(ownerPermissions)) as any[];

    const roleId = roleResult[0].id;

    // ── Create Owner user ──────────────────────────────────
    await client.$queryRawUnsafe(`
      INSERT INTO "users" ("id", "name", "email", "password", "roleId", "isOwner", "status")
      VALUES (gen_random_uuid(), $1, $2, $3, $4::uuid, true, 'ACTIVE')
    `, ceoName, ceoEmail, hashedPassword, roleId);

    // ── Default settings ───────────────────────────────────
    const defaultSettings = [
      ['company_currency', 'PKR'],
      ['company_timezone', 'Asia/Karachi'],
      ['invoice_prefix', 'INV-'],
      ['purchase_prefix', 'PO-'],
      ['employee_prefix', 'EMP-'],
    ];

    for (const [key, value] of defaultSettings) {
      await client.$queryRawUnsafe(`
        INSERT INTO "settings" ("key", "value")
        VALUES ($1, $2)
        ON CONFLICT ("key") DO NOTHING
      `, key, value);
    }

    // ── Default Chart of Accounts ──────────────────────────
    const defaultAccounts = [
      ['1000', 'Cash in Hand', 'ASSET'],
      ['1001', 'Bank Account', 'ASSET'],
      ['1100', 'Accounts Receivable', 'ASSET'],
      ['1200', 'Inventory', 'ASSET'],
      ['2000', 'Accounts Payable', 'LIABILITY'],
      ['2100', 'Loans Payable', 'LIABILITY'],
      ['3000', 'Owner Equity', 'EQUITY'],
      ['3100', 'Retained Earnings', 'EQUITY'],
      ['4000', 'Sales Revenue', 'INCOME'],
      ['4100', 'Other Income', 'INCOME'],
      ['5000', 'Cost of Goods Sold', 'EXPENSE'],
      ['5100', 'Salaries Expense', 'EXPENSE'],
      ['5200', 'Rent Expense', 'EXPENSE'],
      ['5300', 'Utilities Expense', 'EXPENSE'],
      ['5400', 'Other Expenses', 'EXPENSE'],
    ];

    for (const [code, name, type] of defaultAccounts) {
      await client.$queryRawUnsafe(`
        INSERT INTO "chart_of_accounts" ("id", "code", "name", "type", "balance", "isActive")
        VALUES (gen_random_uuid(), $1, $2, $3, 0, true)
        ON CONFLICT ("code") DO NOTHING
      `, code, name, type);
    }

    // Seed default leave types
    const defaultLeaveTypes = [
      ['Annual Leave', 14, true],
      ['Sick Leave', 10, true],
      ['Casual Leave', 7, true],
      ['Unpaid Leave', 0, false],
      ['Maternity Leave', 90, true],
    ];

    for (const [name, daysAllowed, isPaid] of defaultLeaveTypes) {
      await client.$queryRawUnsafe(`
        INSERT INTO "leave_types" ("id", "name", "daysAllowed", "isPaid")
        VALUES (gen_random_uuid(), $1, $2, $3)
        ON CONFLICT DO NOTHING
      `, name, daysAllowed, isPaid);
    }

    this.logger.log(`✅ Tenant data seeded for: ${slug} (${moduleKeys.length} modules)`);
  }

  // Forget a company's pool (after its schema is dropped)
  async closeTenantClient(slug: string): Promise<void> {
    const client = this.tenantClients.get(slug);
    this.tenantClients.delete(slug);
    this.legacy.delete(slug);
    this.lastUsed.delete(slug);
    await client?.$disconnect().catch(() => undefined);
  }

  async disconnectAll(): Promise<void> {
    for (const [slug, client] of this.tenantClients) {
      await client.$disconnect();
      this.logger.log(`🔌 Tenant disconnected: ${slug}`);
    }
    this.tenantClients.clear();
  }
}