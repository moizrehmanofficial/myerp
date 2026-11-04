import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { requestInfo } from '../../common/request-context';

@Injectable()
export class TenantAuditService {
  constructor(private tenantService: TenantService) {}

  async log(slug: string, data: {
    userId?: string;
    userName?: string;
    action: string;
    module: string;
    recordId?: string;
    description: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      // Fill user / IP / device / browser from the current request automatically
      const info = requestInfo();
      const userId = data.userId || info.user?.sub || null;
      const userName = data.userName || info.user?.name || 'Unknown';
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const client = await this.tenantService.getTenantClient(slug);
      await client.$queryRawUnsafe(
        `INSERT INTO "audit_logs" (
          "id", "userId", "action", "module",
          "recordId", "ipAddress", "device", "browser", "details"
        ) VALUES (
          gen_random_uuid(), $1::uuid, $2, $3, $4::uuid, $5, $6, $7, $8
        )`,
        userId,
        data.action,
        data.module,
        data.recordId && uuid.test(data.recordId) ? data.recordId : null,
        data.ipAddress || info.ip,
        data.userAgent || info.device,
        info.browser,
        JSON.stringify({
          description: data.description,
          userName,
        }),
      );
    } catch (err) {
      // Audit log failure should never break the main operation
      console.error('Audit log failed:', err);
    }
  }

  async getLogs(slug: string, page = 1, limit = 50, filters: {
    module?: string;
    action?: string;
    from?: string;
    to?: string;
  } = {}) {
    const client = await this.tenantService.getTenantClient(slug);
    const offset = (page - 1) * limit;

    let whereClause = `1=1`;
    const params: any[] = [];

    if (filters.module) {
      params.push(filters.module);
      whereClause += ` AND "module" = $${params.length}`;
    }

    if (filters.action) {
      params.push(filters.action);
      whereClause += ` AND "action" = $${params.length}`;
    }

    if (filters.from) {
      params.push(filters.from);
      whereClause += ` AND "createdAt" >= $${params.length}::timestamp`;
    }

    if (filters.to) {
      params.push(filters.to);
      whereClause += ` AND "createdAt" <= $${params.length}::timestamp`;
    }

    params.push(limit);
    params.push(offset);

    const logs = await client.$queryRawUnsafe(
      `SELECT * FROM "audit_logs"
       WHERE ${whereClause}
       ORDER BY "createdAt" DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      ...params,
    ) as any[];

    const countResult = await client.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "audit_logs" WHERE ${whereClause}`,
      ...params.slice(0, params.length - 2),
    ) as any[];

    return {
      success: true,
      data: logs.map((log: any) => {
        let details: any = {}
        try { details = JSON.parse(log.details || '{}') } catch {}
        return { ...log, details }
      }),
      meta: {
        total: Number(countResult[0].count),
        page, limit,
        totalPages: Math.ceil(Number(countResult[0].count) / limit),
      },
    };
  }
}