import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ensureTenantUpgrades, nextDocNumber, round2, TX_OPTIONS } from './tenant-doc.helper';
import { ACC, cashAccountFor, postJournal, reverseSource } from './tenant-accounting.helper';
import { TenantAuditService } from './tenant-audit.service';

@Injectable()
export class TenantHRService {
  constructor(
    private tenantService: TenantService,
    private auditService: TenantAuditService,
  ) {}

  // ── EMPLOYEES ──────────────────────────────────────────

  // Departments are the names used on employee records
  async getDepartments(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const rows = (await client.$queryRawUnsafe(
      `SELECT MIN(NULLIF(TRIM("department"), '')) AS "name",
              COUNT(*) FILTER (WHERE "status" = 'ACTIVE') AS "active",
              COUNT(*) AS "total",
              COALESCE(SUM("salary") FILTER (WHERE "status" = 'ACTIVE'), 0) AS "monthlySalary"
       FROM "employees" WHERE "isDeleted" = false
       GROUP BY LOWER(NULLIF(TRIM("department"), ''))
       ORDER BY 1 NULLS LAST`,
    )) as any[];
    return {
      success: true,
      data: rows.map((r: any) => ({ name: r.name, active: Number(r.active), total: Number(r.total), monthlySalary: Number(r.monthlySalary) })),
    };
  }

  async getEmployees(slug: string, page = 1, limit = 25, search = '', department = '') {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    let whereClause = `"isDeleted" = false`;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND ("name" ILIKE $${params.length} OR "employeeCode" ILIKE $${params.length} OR "department" ILIKE $${params.length})`;
    }
    if (department === '-') {
      whereClause += ` AND NULLIF(TRIM("department"), '') IS NULL`;
    } else if (department) {
      params.push(department);
      whereClause += ` AND LOWER(TRIM("department")) = LOWER($${params.length})`;
    }

    params.push(limit);
    params.push(offset);

    const employees = await client.$queryRawUnsafe(
      `SELECT * FROM "employees"
       WHERE ${whereClause}
       ORDER BY "createdAt" DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      ...params,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "employees" WHERE ${whereClause}`,
      ...params.slice(0, params.length - 2),
    ) as any[];

    return {
      success: true,
      data: employees,
      meta: {
        total: Number(countResult[0].count),
        page, limit,
        totalPages: Math.ceil(Number(countResult[0].count) / limit),
      },
    };
  }

  async getEmployee(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT * FROM "employees" WHERE "id" = $1::uuid AND "isDeleted" = false LIMIT 1`,
      id,
    ) as any[];
    if (!result.length) throw new NotFoundException('Employee not found');
    return { success: true, data: result[0] };
  }

  async createEmployee(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    if (!String(body.name || '').trim()) throw new BadRequestException('Enter the employee name');

    // Generate employee code (unique, never repeats)
    await ensureTenantUpgrades(client, slug);
    const employeeCode = await nextDocNumber(client, 'employee');

    const result = await client.$queryRawUnsafe(
      `INSERT INTO "employees" (
        "id", "employeeCode", "name", "email", "phone", "cnic",
        "department", "designation", "joiningDate", "salary", "status"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8::timestamp, $9, 'ACTIVE'
      ) RETURNING *`,
      employeeCode,
      body.name,
      body.email || null,
      body.phone || null,
      body.cnic || null,
      body.department || null,
      body.designation || null,
      body.joiningDate || null,
      parseFloat(body.salary) || 0,
    ) as any[];

    await this.auditService.log(slug, {
      action: 'CREATED',
      module: 'hr',
      recordId: result[0].id,
      description: `Employee ${body.name} created`,
    });

    return { success: true, message: 'Employee created', data: result[0] };
  }

  async updateEmployee(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const result = await client.$queryRawUnsafe(
      `UPDATE "employees"
       SET "name" = $1, "email" = $2, "phone" = $3, "cnic" = $4,
           "department" = $5, "designation" = $6, "salary" = $7,
           "status" = $8, "joiningDate" = $10::timestamp, "updatedAt" = NOW()
       WHERE "id" = $9::uuid AND "isDeleted" = false
       RETURNING *`,
      body.name,
      body.email || null,
      body.phone || null,
      body.cnic || null,
      body.department || null,
      body.designation || null,
      parseFloat(body.salary) || 0,
      body.status || 'ACTIVE',
      id,
      body.joiningDate || null,
    ) as any[];

    if (!result.length) throw new NotFoundException('Employee not found');

    await this.auditService.log(slug, {
      action: 'UPDATED',
      module: 'hr',
      recordId: id,
      description: `Employee ${body.name} updated`,
    });

    return { success: true, message: 'Employee updated', data: result[0] };
  }

  async deleteEmployee(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await client.$queryRawUnsafe(
      `UPDATE "employees" SET "isDeleted" = true, "deletedAt" = NOW() WHERE "id" = $1::uuid`,
      id,
    );
    await this.auditService.log(slug, {
      action: 'DELETED',
      module: 'hr',
      recordId: id,
      description: `Employee deleted`,
    });

    return { success: true, message: 'Employee deleted' };
  }

  // ── ATTENDANCE ─────────────────────────────────────────

  async getAttendance(slug: string, month: number, year: number) {
    const client = await this.tenantService.getTenantClient(slug);

    const records = await client.$queryRawUnsafe(
      `SELECT a.*, e."name" as "employeeName", e."employeeCode", e."department"
       FROM "attendance" a
       JOIN "employees" e ON a."employeeId" = e."id"
       WHERE EXTRACT(MONTH FROM a."date") = $1 AND EXTRACT(YEAR FROM a."date") = $2
         AND e."isDeleted" = false
       ORDER BY a."date" DESC, e."name" ASC`,
      month, year,
    ) as any[];

    const summary = await client.$queryRawUnsafe(
      `SELECT
        e."id", e."name", e."employeeCode",
        COUNT(CASE WHEN a."status" = 'PRESENT' THEN 1 END) as "present",
        COUNT(CASE WHEN a."status" = 'ABSENT' THEN 1 END) as "absent",
        COUNT(CASE WHEN a."status" = 'HALF_DAY' THEN 1 END) as "halfDay",
        COUNT(CASE WHEN a."status" = 'LEAVE' THEN 1 END) as "onLeave"
       FROM "employees" e
       LEFT JOIN "attendance" a ON e."id" = a."employeeId"
         AND EXTRACT(MONTH FROM a."date") = $1
         AND EXTRACT(YEAR FROM a."date") = $2
       WHERE e."isDeleted" = false AND e."status" = 'ACTIVE'
       GROUP BY e."id", e."name", e."employeeCode"
       ORDER BY e."name"`,
      month, year,
    ) as any[];

    return {
      success: true,
      data: {
        records,
        summary: summary.map((s: any) => ({
          ...s,
          present: Number(s.present || 0),
          absent: Number(s.absent || 0),
          halfDay: Number(s.halfDay || 0),
          onLeave: Number(s.onLeave || 0),
        })),
      },
    };
  }

  async markAttendance(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    // Upsert attendance
    const existing = await client.$queryRawUnsafe(
      `SELECT id FROM "attendance"
       WHERE "employeeId" = $1::uuid AND DATE("date") = $2::date LIMIT 1`,
      body.employeeId,
      body.date,
    ) as any[];

    if (existing.length > 0) {
      await client.$queryRawUnsafe(
        `UPDATE "attendance" SET "status" = $1, "checkIn" = $2, "checkOut" = $3
         WHERE "id" = $4::uuid`,
        body.status,
        body.checkIn || null,
        body.checkOut || null,
        existing[0].id,
      );
    } else {
      await client.$queryRawUnsafe(
        `INSERT INTO "attendance" ("id", "employeeId", "date", "status", "checkIn", "checkOut")
         VALUES (gen_random_uuid(), $1::uuid, $2::timestamp, $3, $4, $5)`,
        body.employeeId,
        body.date,
        body.status || 'PRESENT',
        body.checkIn || null,
        body.checkOut || null,
      );
    }

    return { success: true, message: 'Attendance marked' };
  }

  async markBulkAttendance(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    const { date, records } = body;

    for (const record of records) {
      const existing = await client.$queryRawUnsafe(
        `SELECT id FROM "attendance"
         WHERE "employeeId" = $1::uuid AND DATE("date") = $2::date LIMIT 1`,
        record.employeeId,
        date,
      ) as any[];

      if (existing.length > 0) {
        await client.$queryRawUnsafe(
          `UPDATE "attendance" SET "status" = $1 WHERE "id" = $2::uuid`,
          record.status,
          existing[0].id,
        );
      } else {
        await client.$queryRawUnsafe(
          `INSERT INTO "attendance" ("id", "employeeId", "date", "status")
           VALUES (gen_random_uuid(), $1::uuid, $2::timestamp, $3)`,
          record.employeeId,
          date,
          record.status || 'PRESENT',
        );
      }
    }

    return { success: true, message: 'Bulk attendance marked' };
  }

  // ── PAYROLL ────────────────────────────────────────────

  async getPayroll(slug: string, month: number, year: number) {
    const client = await this.tenantService.getTenantClient(slug);

    const payrolls = await client.$queryRawUnsafe(
      `SELECT p.*, e."name" as "employeeName", e."employeeCode", e."department", e."designation"
       FROM "payroll" p
       JOIN "employees" e ON p."employeeId" = e."id"
       WHERE p."month" = $1 AND p."year" = $2
       ORDER BY e."name"`,
      month, year,
    ) as any[];

    const summary = await client.$queryRawUnsafe(
      `SELECT
        COUNT(*) as "totalEmployees",
        COALESCE(SUM("netSalary"), 0) as "totalPayroll",
        COALESCE(SUM("basicSalary"), 0) as "totalBasic",
        COALESCE(SUM("allowances"), 0) as "totalAllowances",
        COALESCE(SUM("deductions"), 0) as "totalDeductions"
       FROM "payroll"
       WHERE "month" = $1 AND "year" = $2`,
      month, year,
    ) as any[];

    const raw = summary[0];

    return {
      success: true,
      data: {
        payrolls,
        summary: {
          totalEmployees: Number(raw.totalEmployees || 0),
          totalPayroll: Number(raw.totalPayroll || 0),
          totalBasic: Number(raw.totalBasic || 0),
          totalAllowances: Number(raw.totalAllowances || 0),
          totalDeductions: Number(raw.totalDeductions || 0),
        },
      },
    };
  }

  async generatePayroll(slug: string, month: number, year: number) {
    const client = await this.tenantService.getTenantClient(slug);

    // Get all active employees
    const employees = await client.$queryRawUnsafe(
      `SELECT * FROM "employees" WHERE "status" = 'ACTIVE' AND "isDeleted" = false`,
    ) as any[];

    // Get attendance for the month
    const daysInMonth = new Date(year, month, 0).getDate();

    let generated = 0;
    for (const emp of employees) {
      // Check if payroll already exists
      const existing = await client.$queryRawUnsafe(
        `SELECT id FROM "payroll" WHERE "employeeId" = $1::uuid AND "month" = $2 AND "year" = $3 LIMIT 1`,
        emp.id, month, year,
      ) as any[];

      if (existing.length > 0) continue;

      // Count present days
      const attendanceResult = await client.$queryRawUnsafe(
        `SELECT
          COUNT(CASE WHEN "status" = 'PRESENT' THEN 1 END) as "present",
          COUNT(CASE WHEN "status" = 'HALF_DAY' THEN 1 END) as "halfDay",
          COUNT(CASE WHEN "status" = 'ABSENT' THEN 1 END) as "absent"
         FROM "attendance"
         WHERE "employeeId" = $1::uuid
           AND EXTRACT(MONTH FROM "date") = $2
           AND EXTRACT(YEAR FROM "date") = $3`,
        emp.id, month, year,
      ) as any[];

      const att = attendanceResult[0];
      // Absent = 1 day off pay, half day = half a day off pay
      const absentDays = Number(att.absent || 0) + Number(att.halfDay || 0) * 0.5;

      // Approved UNPAID leave in this month is also not paid (days counted in SQL,
      // so time zones can't shift them)
      const monthFirst = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthLast = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      const unpaid = (await client.$queryRawUnsafe(
        `SELECT COALESCE(SUM(LEAST(lr."endDate"::date, $3::date) - GREATEST(lr."startDate"::date, $2::date) + 1), 0)::int AS "days"
         FROM "leave_requests" lr
         JOIN "leave_types" lt ON lt."id" = lr."leaveTypeId"
         WHERE lr."employeeId" = $1::uuid AND lr."status" = 'APPROVED' AND lt."isPaid" = false
           AND lr."startDate"::date <= $3::date AND lr."endDate"::date >= $2::date`,
        emp.id,
        monthFirst,
        monthLast,
      )) as any[];
      const unpaidDays = Number(unpaid[0]?.days || 0);

      const basicSalary = Number(emp.salary || 0);
      const perDaySalary = basicSalary / daysInMonth;
      const deductions = round2((absentDays + unpaidDays) * perDaySalary);
      const netSalary = round2(basicSalary - deductions);

      await client.$queryRawUnsafe(
        `INSERT INTO "payroll" (
          "id", "employeeId", "month", "year", "basicSalary",
          "allowances", "deductions", "tax", "netSalary", "status"
        ) VALUES (
          gen_random_uuid(), $1::uuid, $2, $3, $4, 0, $5, 0, $6, 'PENDING'
        )`,
        emp.id, month, year,
        basicSalary,
        deductions,
        netSalary < 0 ? 0 : netSalary,
      );
      generated++;
    }

    await this.auditService.log(slug, {
      action: 'CREATED',
      module: 'payroll',
      description: `Payroll generated for month ${month}/${year}`,
    });

    return { success: true, message: `Generated payroll for ${generated} employees` };
  }

  // Edit a salary line. Marking it PAID posts it to the accounts
  // (Dr Salaries Expense, Cr Cash/Bank); un-marking reverses that.
  async updatePayrollRecord(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    await ensureTenantUpgrades(client, slug);

    const num = (v: any, fallback: number) => (v === undefined || v === null || v === '' ? fallback : round2(parseFloat(v) || 0));

    const updated = await client.$transaction(async (tx: any) => {
      const rows = (await tx.$queryRawUnsafe(
        `SELECT p.*, e."name" AS "employeeName" FROM "payroll" p
         JOIN "employees" e ON e."id" = p."employeeId"
         WHERE p."id" = $1::uuid FOR UPDATE OF p`,
        id,
      )) as any[];
      if (!rows.length) throw new NotFoundException('Payroll record not found');
      const old = rows[0];

      const basicSalary = num(body.basicSalary, Number(old.basicSalary));
      const allowances = num(body.allowances, Number(old.allowances));
      const deductions = num(body.deductions, Number(old.deductions));
      const tax = num(body.tax, Number(old.tax));
      if ([basicSalary, allowances, deductions, tax].some((n) => n < 0)) {
        throw new BadRequestException('Amounts cannot be negative');
      }
      const netSalary = Math.max(round2(basicSalary + allowances - deductions - tax), 0);
      const status = String(body.status || old.status || 'PENDING').toUpperCase();
      const method = String(body.method || old.paidMethod || 'CASH').toUpperCase();
      const wasPaid = old.status === 'PAID';
      const isPaid = status === 'PAID';

      const result = (await tx.$queryRawUnsafe(
        `UPDATE "payroll"
         SET "basicSalary" = $1, "allowances" = $2, "deductions" = $3, "tax" = $4, "netSalary" = $5,
             "status" = $6, "paidMethod" = $7, "paidAt" = $8::timestamp
         WHERE "id" = $9::uuid
         RETURNING *`,
        basicSalary, allowances, deductions, tax, netSalary,
        status,
        isPaid ? method : null,
        isPaid ? (wasPaid && old.paidAt ? new Date(old.paidAt).toISOString() : new Date().toISOString()) : null,
        id,
      )) as any[];

      const changed = Number(old.netSalary) !== netSalary || Number(old.tax) !== tax || old.paidMethod !== method;
      const ref = `Salary ${old.month}/${old.year}`;
      if (wasPaid && (!isPaid || changed)) {
        await reverseSource(tx, 'payroll', id, `Salary payment cancelled: ${old.employeeName}`, ref);
      }
      if (isPaid && (!wasPaid || changed)) {
        await postJournal(tx, {
          description: `Salary paid: ${old.employeeName} (${ref})`,
          reference: ref,
          sourceType: 'payroll',
          sourceId: id,
          // Expense = what the employee earned (net pay + tax withheld).
          // Tax withheld is owed to the government until you pay it.
          lines: [
            { code: ACC.SALARIES, debit: round2(netSalary + tax), description: 'Salaries expense' },
            { code: cashAccountFor(method), credit: netSalary, description: 'Salary paid' },
            { code: ACC.INCOME_TAX, credit: tax, description: 'Income tax withheld' },
          ],
        });
      }
      return result[0];
    }, TX_OPTIONS);

    return { success: true, message: 'Payroll updated', data: updated };
  }
}