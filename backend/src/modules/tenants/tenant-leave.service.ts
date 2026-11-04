import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantLeaveService {
  constructor(private tenantService: TenantService) {}

  // ── LEAVE TYPES ────────────────────────────────────────

  async getLeaveTypes(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT lt.*,
        (SELECT COUNT(*) FROM "leave_requests" lr
         WHERE lr."leaveTypeId" = lt."id") as "requestCount"
       FROM "leave_types" lt
       ORDER BY lt."name" ASC`,
    ) as any[];

    return {
      success: true,
      data: result.map((r: any) => ({
        ...r,
        requestCount: Number(r.requestCount || 0),
      })),
    };
  }

  async createLeaveType(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `INSERT INTO "leave_types" ("id", "name", "daysAllowed", "isPaid")
       VALUES (gen_random_uuid(), $1, $2, $3) RETURNING *`,
      body.name,
      parseInt(body.daysAllowed) || 0,
      body.isPaid !== false,
    ) as any[];
    return { success: true, message: 'Leave type created', data: result[0] };
  }

  async updateLeaveType(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `UPDATE "leave_types"
       SET "name" = $1, "daysAllowed" = $2, "isPaid" = $3
       WHERE "id" = $4::uuid RETURNING *`,
      body.name,
      parseInt(body.daysAllowed) || 0,
      body.isPaid !== false,
      id,
    ) as any[];
    if (!result.length) throw new NotFoundException('Leave type not found');
    return { success: true, message: 'Leave type updated', data: result[0] };
  }

  async deleteLeaveType(slug: string, id: string) {
    const client = await this.tenantService.getTenantClient(slug);
    await client.$queryRawUnsafe(
      `DELETE FROM "leave_types" WHERE "id" = $1::uuid`, id,
    );
    return { success: true, message: 'Leave type deleted' };
  }

  // ── LEAVE REQUESTS ─────────────────────────────────────

  async getLeaveRequests(slug: string, filters: {
    status?: string;
    employeeId?: string;
    month?: number;
    year?: number;
    page?: number;
    limit?: number;
  } = {}) {
    const client = await this.tenantService.getTenantClient(slug);
    const page = filters.page || 1;
    const limit = filters.limit || 25;
    const offset = (page - 1) * limit;

    let whereClause = `1=1`;
    const params: any[] = [];

    if (filters.status) {
      params.push(filters.status);
      whereClause += ` AND lr."status" = $${params.length}`;
    }

    if (filters.employeeId) {
      params.push(filters.employeeId);
      whereClause += ` AND lr."employeeId" = $${params.length}::uuid`;
    }

    if (filters.month && filters.year) {
      whereClause += ` AND EXTRACT(MONTH FROM lr."startDate") = ${filters.month}
        AND EXTRACT(YEAR FROM lr."startDate") = ${filters.year}`;
    }

    params.push(limit);
    params.push(offset);

    const requests = await client.$queryRawUnsafe(
      `SELECT lr.*, e."name" as "employeeName", e."employeeCode", e."department",
              lt."name" as "leaveTypeName", lt."isPaid"
       FROM "leave_requests" lr
       JOIN "employees" e ON lr."employeeId" = e."id"
       JOIN "leave_types" lt ON lr."leaveTypeId" = lt."id"
       WHERE ${whereClause}
       ORDER BY lr."createdAt" DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      ...params,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "leave_requests" lr
       JOIN "employees" e ON lr."employeeId" = e."id"
       WHERE ${whereClause}`,
      ...params.slice(0, params.length - 2),
    ) as any[];

    return {
      success: true,
      data: requests,
      meta: {
        total: Number(countResult[0].count),
        page, limit,
        totalPages: Math.ceil(Number(countResult[0].count) / limit),
      },
    };
  }

  async createLeaveRequest(slug: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Calculate total days
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Check for overlapping leaves
    const overlap = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "leave_requests"
       WHERE "employeeId" = $1::uuid
         AND "status" != 'REJECTED'
         AND NOT ("endDate" < $2::timestamp OR "startDate" > $3::timestamp)`,
      body.employeeId,
      body.startDate,
      body.endDate,
    ) as any[];

    if (Number(overlap[0].count) > 0) {
      throw new BadRequestException('Employee already has a leave request for this period');
    }

    // Check leave balance
    const leaveType = await client.$queryRawUnsafe(
      `SELECT * FROM "leave_types" WHERE "id" = $1::uuid LIMIT 1`,
      body.leaveTypeId,
    ) as any[];

    if (!leaveType.length) throw new NotFoundException('Leave type not found');

    const usedDays = await client.$queryRawUnsafe(
      `SELECT COALESCE(SUM("totalDays"), 0) as used
       FROM "leave_requests"
       WHERE "employeeId" = $1::uuid
         AND "leaveTypeId" = $2::uuid
         AND "status" = 'APPROVED'
         AND EXTRACT(YEAR FROM "startDate") = EXTRACT(YEAR FROM NOW())`,
      body.employeeId,
      body.leaveTypeId,
    ) as any[];

    const used = Number(usedDays[0].used || 0);
    const allowed = Number(leaveType[0].daysAllowed || 0);

    if (allowed > 0 && (used + totalDays) > allowed) {
      throw new BadRequestException(
        `Insufficient leave balance. Used: ${used}, Allowed: ${allowed}, Requested: ${totalDays}`
      );
    }

    const result = await client.$queryRawUnsafe(
      `INSERT INTO "leave_requests" (
        "id", "employeeId", "leaveTypeId", "startDate",
        "endDate", "totalDays", "reason", "status"
      ) VALUES (
        gen_random_uuid(), $1::uuid, $2::uuid, $3::timestamp,
        $4::timestamp, $5, $6, 'PENDING'
      ) RETURNING *`,
      body.employeeId,
      body.leaveTypeId,
      body.startDate,
      body.endDate,
      totalDays,
      body.reason || null,
    ) as any[];

    return { success: true, message: 'Leave request submitted', data: result[0] };
  }

  async approveLeave(slug: string, id: string, userId: string) {
    const client = await this.tenantService.getTenantClient(slug);

    // Approval + attendance marks happen together, or not at all
    const approved = await client.$transaction(async (tx: any) => {
      const requests = (await tx.$queryRawUnsafe(
        `SELECT * FROM "leave_requests" WHERE "id" = $1::uuid LIMIT 1 FOR UPDATE`, id,
      )) as any[];
      if (!requests.length) throw new NotFoundException('Leave request not found');
      if (requests[0].status !== 'PENDING') {
        throw new BadRequestException('Only pending requests can be approved');
      }

      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const result = (await tx.$queryRawUnsafe(
        `UPDATE "leave_requests"
         SET "status" = 'APPROVED', "approvedBy" = $1::uuid,
             "approvedAt" = NOW(), "updatedAt" = NOW()
         WHERE "id" = $2::uuid RETURNING *`,
        userId && uuid.test(userId) ? userId : null,
        id,
      )) as any[];

      // Mark every day of the leave as LEAVE in attendance (dates done in SQL,
      // so time zones can't move a day)
      await tx.$queryRawUnsafe(
        `UPDATE "attendance" a SET "status" = 'LEAVE'
         FROM "leave_requests" lr
         WHERE lr."id" = $1::uuid AND a."employeeId" = lr."employeeId"
           AND a."date"::date BETWEEN lr."startDate"::date AND lr."endDate"::date`,
        id,
      );
      await tx.$queryRawUnsafe(
        `INSERT INTO "attendance" ("id", "employeeId", "date", "status")
         SELECT gen_random_uuid(), lr."employeeId", d::date::timestamp, 'LEAVE'
         FROM "leave_requests" lr,
              generate_series(lr."startDate"::date, lr."endDate"::date, interval '1 day') d
         WHERE lr."id" = $1::uuid
           AND NOT EXISTS (
             SELECT 1 FROM "attendance" a
             WHERE a."employeeId" = lr."employeeId" AND a."date"::date = d::date
           )`,
        id,
      );
      return result[0];
    });

    return { success: true, message: 'Leave approved and attendance updated', data: approved };
  }

  async rejectLeave(slug: string, id: string, body: any) {
    const client = await this.tenantService.getTenantClient(slug);

    const result = await client.$queryRawUnsafe(
      `UPDATE "leave_requests"
       SET "status" = 'REJECTED', "rejectionReason" = $1, "updatedAt" = NOW()
       WHERE "id" = $2::uuid AND "status" = 'PENDING'
       RETURNING *`,
      body.reason || 'Request rejected',
      id,
    ) as any[];

    if (!result.length) throw new NotFoundException('Request not found or already processed');
    return { success: true, message: 'Leave rejected', data: result[0] };
  }

  async getLeaveBalance(slug: string, employeeId: string, year: number) {
    const client = await this.tenantService.getTenantClient(slug);

    const leaveTypes = await client.$queryRawUnsafe(
      `SELECT * FROM "leave_types" ORDER BY "name"`,
    ) as any[];

    const balances = await Promise.all(
      leaveTypes.map(async (lt: any) => {
        const used = await client.$queryRawUnsafe(
          `SELECT COALESCE(SUM("totalDays"), 0) as used
           FROM "leave_requests"
           WHERE "employeeId" = $1::uuid
             AND "leaveTypeId" = $2::uuid
             AND "status" = 'APPROVED'
             AND EXTRACT(YEAR FROM "startDate") = $3`,
          employeeId, lt.id, year,
        ) as any[];

        const usedDays = Number(used[0].used || 0);
        const allowed = Number(lt.daysAllowed || 0);

        return {
          leaveTypeId: lt.id,
          leaveTypeName: lt.name,
          isPaid: lt.isPaid,
          allowed,
          used: usedDays,
          remaining: allowed > 0 ? Math.max(0, allowed - usedDays) : null,
        };
      })
    );

    return { success: true, data: balances };
  }

  async getEmployees(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);
    const result = await client.$queryRawUnsafe(
      `SELECT "id", "name", "employeeCode", "department"
       FROM "employees"
       WHERE "isDeleted" = false AND "status" = 'ACTIVE'
       ORDER BY "name"`,
    ) as any[];
    return { success: true, data: result };
  }
}