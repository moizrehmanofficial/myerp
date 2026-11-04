import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { TenantAuditService } from '../../modules/tenants/tenant-audit.service';
import { findRule } from '../guards/tenant-permission.guard';

// These services already write their own (more detailed) audit logs
const SELF_LOGGED = [
  /^users\//,
  /^customers(\/|$)/,
  /^invoices(\/|$)/,
  /^hr\/employees(\/|$)/,
  /^hr\/payroll\/generate$/,
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Automatically logs every successful create / update / delete on ERP routes
@Injectable()
export class TenantAuditInterceptor implements NestInterceptor {
  constructor(private auditService: TenantAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = String(req.method).toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next.handle();

    const path = String(req.path || '').replace(/^.*?\/erp\//, '').replace(/\/+$/, '');
    if (SELF_LOGGED.some((r) => r.test(path))) return next.handle();

    return next.handle().pipe(
      tap((result) => {
        const slug = req.tenantUser?.slug || req.tenant?.slug;
        if (!slug) return;

        let action = method === 'POST' ? 'CREATED' : method === 'DELETE' ? 'DELETED' : 'UPDATED';
        if (/\/approve$/.test(path)) action = 'APPROVED';
        else if (/\/reject$/.test(path)) action = 'REJECTED';
        else if (/\/status$/.test(path)) action = 'STATUS_CHANGED';

        const rule = findRule(path, method);
        const module = rule && rule.modules !== 'ANY' ? rule.modules[0] : path.split('/')[0];

        const data = result?.data || {};
        const docNo =
          data.invoiceNumber || data.orderNumber || data.returnNumber ||
          data.entryNumber || data.employeeCode || data.name || '';
        const id = req.params?.id || data.id;

        // e.g. "STATUS_CHANGED purchase/orders → RECEIVED"
        const readablePath = path.split('/').filter((p) => !UUID.test(p)).join('/');
        const extra = req.body?.status ? ` → ${req.body.status}` : '';
        const description = `${action} ${readablePath}${docNo ? ` ${docNo}` : ''}${extra}`;

        // Fire and forget: logging must never slow down or break the request
        void this.auditService.log(slug, {
          action,
          module,
          recordId: id && UUID.test(String(id)) ? String(id) : undefined,
          description,
        });
      }),
    );
  }
}