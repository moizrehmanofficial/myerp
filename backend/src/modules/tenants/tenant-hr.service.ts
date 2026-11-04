import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ensureTenantUpgrades, nextDocNumber } from './tenant-doc.helper';
import { TenantAuditService } from './tenant-audit.service';

@Injectable()
export class TenantHRService {
  constructor(
    private tenantService: TenantService,
    private auditService: TenantAuditService,
  ) {}

  // ── EMPLOYEES ──────────────────────────────────────────

  async getEmployees(slug: string, page = 1, limit = 25, search = '') {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    let whereClause = `"isDeleted" = false`;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND ("name" ILIKE $${params.length} OR "employeeCode" ILIKE $${params.length} OR "department" ILIKE $${params.length})`;
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
           "status" = $8, "updatedAt" = NOW()
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
      const presentDays = Number(att.present || 0) + (Number(att.halfDay || 0) * 0.5);
      const absentDays = Number(att.absent || 0);

      const basicSalary = Number(emp.salary || 0);
      const perDaySalary = basicSalary / daysInMonth;
      const deductions = absentDays * perDaySalary;
      const netSalary = basicSalary - deductions;

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

  async updatePayrollRecord(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const allowances = parseFloat(body.allowances) || 0;
    const deductions = parseFloat(body.deductions) || 0;
    const tax = parseFloat(body.tax) || 0;
    const basicSalary = parseFloat(body.basicSalary) || 0;
    const netSalary = basicSalary + allowances - deductions - tax;

    const result = await client.$queryRawUnsafe(
      `UPDATE "payroll"
       SET "basicSalary" = $1, "allowances" = $2, "deductions" = $3,
           "tax" = $4, "netSalary" = $5, "status" = $6
       WHERE "id" = $7::uuid
       RETURNING *`,
      basicSalary, allowances, deductions, tax,
      netSalary < 0 ? 0 : netSalary,
      body.status || 'PENDING',
      id,
    ) as any[];

    return { success: true, message: 'Payroll updated', data: result[0] };
  }
}