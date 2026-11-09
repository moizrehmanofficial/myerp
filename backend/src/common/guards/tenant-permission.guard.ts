import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../../modules/tenants/tenant.service';
import { TENANT_ACCESS_COOKIE } from '../auth-cookies';
import { ensureTenantUpgrades } from '../../modules/tenants/tenant-doc.helper';
// Loads the accounting helper so its one-time "post old records" step is registered
import '../../modules/tenants/tenant-accounting.helper';

export type PermissionAction =
  | 'read'
  | 'write'
  | 'modify'
  | 'delete'
  | 'print'
  | 'export'
  | 'approve';

interface PermissionRule {
  // Regex tested against the path after /api/erp/  (e.g. "customers/123")
  pattern: RegExp;
  // Optional HTTP method filter
  methods?: string[];
  // User needs the action on ANY one of these modules.
  // 'ANY' = every logged-in user of the company is allowed.
  modules: string[] | 'ANY';
  // If not set, action comes from HTTP method
  action?: PermissionAction;
  // Only the company owner (CEO) can call this route
  ownerOnly?: boolean;
}

// ORDER MATTERS: first matching rule wins (specific rules first).
export const PERMISSION_RULES: PermissionRule[] = [
  // ── Always allowed (dashboard + reading settings) ──
  { pattern: /^dashboard\//, modules: 'ANY' },
  { pattern: /^settings$/, methods: ['GET'], modules: 'ANY' },
  { pattern: /^settings$/, modules: ['settings'], action: 'modify' },
  { pattern: /^audit-logs$/, modules: ['settings'], action: 'read' },

  // ── Users & roles: owner only (or a role with "users" permission) ──
  { pattern: /^users\//, modules: ['users'], ownerOnly: true },

  // ── Customers & suppliers ──
  { pattern: /^customers(\/|$)/, modules: ['contacts'] },
  { pattern: /^suppliers(\/|$)/, modules: ['contacts'] },

  // ── Products, categories, brands ──
  { pattern: /^products(\/|$)/, modules: ['products'] },

  // ── Inventory + stock adjustment ──
  { pattern: /^inventory\/adjust$/, modules: ['stock_adjust', 'inventory'], action: 'write' },
  { pattern: /^inventory\//, modules: ['inventory', 'stock_adjust'], action: 'read' },

  // ── Purchase ──
  // Supplier dropdown is also used by Finance → Payments/Receipts
  { pattern: /^purchase\/suppliers$/, methods: ['GET'], modules: ['purchase', 'finance'], action: 'read' },
  { pattern: /^purchase\//, modules: ['purchase'] },
  { pattern: /^returns\/purchase$/, modules: ['purchase'] },

  // ── Sales ──
  { pattern: /^sales\//, modules: ['sales'] },
  { pattern: /^returns\/sale$/, modules: ['sales'] },

  // Dropdown lookups used by both return pages
  { pattern: /^returns\/(suppliers|customers|products)$/, modules: ['purchase', 'sales'], action: 'read' },

  // ── Invoices ──
  // Customer dropdown is also used by Finance → Payments/Receipts
  { pattern: /^invoices\/customers$/, methods: ['GET'], modules: ['invoices', 'finance'], action: 'read' },
  { pattern: /^invoices\/[^/]+\/payment$/, modules: ['invoices'], action: 'modify' },
  { pattern: /^invoices\/[^/]+\/cancel$/, modules: ['invoices'], action: 'delete' },
  // Quotations: sales or invoice staff; turning one into an invoice needs invoice "write"
  { pattern: /^quotations\/[^/]+\/convert$/, modules: ['invoices'], action: 'write' },
  { pattern: /^quotations\/(customers|products)$/, methods: ['GET'], modules: ['sales', 'invoices'], action: 'read' },
  { pattern: /^quotations(\/|$)/, modules: ['sales', 'invoices'] },
  { pattern: /^invoices(\/|$)/, modules: ['invoices'] },

  // ── Manufacturing ──
  { pattern: /^manufacturing\//, modules: ['manufacturing'] },

  // ── HR + payroll (payroll page currently lives under HR) ──
  { pattern: /^hr\/leave\/requests\/[^/]+\/(approve|reject)$/, modules: ['hr'], action: 'approve' },
  { pattern: /^hr\/payroll(\/|$)/, methods: ['GET'], modules: ['payroll', 'hr'], action: 'read' },
  { pattern: /^hr\/payroll(\/|$)/, modules: ['payroll', 'hr'] },
  { pattern: /^hr\//, modules: ['hr'] },

  // ── Finance + ledger ──
  { pattern: /^finance\/accounts\/[^/]+\/ledger$/, modules: ['ledger', 'finance'], action: 'read' },
  { pattern: /^finance\/accounts$/, methods: ['GET'], modules: ['finance', 'ledger'], action: 'read' },
  { pattern: /^finance\/trial-balance$/, modules: ['finance', 'ledger', 'reports'], action: 'read' },
  // One-time posting of old records into the accounts: company owner only
  { pattern: /^finance\/post-old-records$/, modules: ['finance'], action: 'approve', ownerOnly: true },
  { pattern: /^finance\//, modules: ['finance'] },

  // ── Reports ──
  { pattern: /^reports\//, modules: ['reports'], action: 'read' },
];

// Helper for controllers: can the current user do `action` on `module`?
export function userCan(req: any, module: string, action: PermissionAction = 'read'): boolean {
  const u = req?.tenantUser;
  if (!u) return false;
  if (!(u.companyModules || []).includes(module)) return false;
  if (u.isOwner) return true;
  return u.permissions?.[module]?.[action] === true;
}

function actionFromMethod(method: string): PermissionAction {
  switch (method.toUpperCase()) {
    case 'GET':
    case 'HEAD':
      return 'read';
    case 'POST':
      return 'write';
    case 'PUT':
    case 'PATCH':
      return 'modify';
    case 'DELETE':
      return 'delete';
    default:
      return 'read';
  }
}

export function findRule(path: string, method: string): PermissionRule | undefined {
  return PERMISSION_RULES.find(
    (r) =>
      r.pattern.test(path) &&
      (!r.methods || r.methods.includes(method.toUpperCase())),
  );
}

interface CachedAccess {
  at: number;
  isOwner: boolean;
  permissions: Record<string, Record<string, boolean>>;
}

const CACHE_TTL_MS = 30 * 1000;

@Injectable()
export class TenantPermissionGuard implements CanActivate {
  private cache = new Map<string, CachedAccess>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private tenantService: TenantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // ── 1. Valid tenant user token ──
    const token = req.cookies?.[TENANT_ACCESS_COOKIE];
    if (!token) throw new UnauthorizedException('Not authenticated');

    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload?.type !== 'tenant_user' || !payload?.slug) {
      throw new UnauthorizedException('Invalid token type');
    }

    // ── 2. Same company as the request ──
    if (!req.tenant?.slug) throw new UnauthorizedException('No tenant found');
    if (req.tenant.slug !== payload.slug) {
      throw new ForbiddenException('You do not have access to this company');
    }

    // ── 3. Find the permission rule for this route ──
    const fullPath: string = (req.path || req.url || '').split('?')[0];
    const erpPath = fullPath.replace(/^.*?\/erp\//, '').replace(/\/+$/, '');
    const rule = findRule(erpPath, req.method);

    // Deny by default: a new route without a rule is blocked, not open
    if (!rule) {
      throw new ForbiddenException('Access denied');
    }

    // ── 4. Load user access (fresh from DB, cached 30s) ──
    const access = await this.getAccess(payload.slug, payload.sub);
    req.tenantUser = {
      ...payload,
      isOwner: access.isOwner,
      permissions: access.permissions,
      companyModules: req.tenant.modules || [],
    };

    if (rule.modules === 'ANY') return true;

    // ── 5. Module must be enabled for this company ──
    const companyModules: string[] = req.tenant.modules || [];
    const enabled = rule.modules.filter((m) => companyModules.includes(m));
    if (enabled.length === 0) {
      throw new ForbiddenException('This module is not enabled for your company');
    }

    // ── 6. Owner can do everything in enabled modules ──
    if (access.isOwner) return true;

    if (rule.ownerOnly) {
      const allowedForRole = enabled.some(
        (m) => access.permissions?.[m]?.[rule.action || actionFromMethod(req.method)] === true,
      );
      if (!allowedForRole) {
        throw new ForbiddenException('Only the company owner can do this');
      }
      return true;
    }

    // ── 7. Role permission check ──
    const action = rule.action || actionFromMethod(req.method);
    const allowed = enabled.some((m) => access.permissions?.[m]?.[action] === true);
    if (!allowed) {
      throw new ForbiddenException(
        `You do not have "${action}" permission for this module`,
      );
    }
    return true;
  }

  private async getAccess(slug: string, userId: string): Promise<CachedAccess> {
    const key = `${slug}:${userId}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;

    const client = await this.tenantService.getTenantClient(slug);
    // One-time per company per server start: new columns + post old records to accounts
    await ensureTenantUpgrades(client, slug);
    const rows = (await client.$queryRawUnsafe(
      `SELECT u."status", u."isOwner", u."isDeleted", r."permissions"
       FROM "users" u
       LEFT JOIN "roles" r ON u."roleId" = r."id"
       WHERE u."id" = $1::uuid
       LIMIT 1`,
      userId,
    )) as any[];

    const user = rows?.[0];
    // Deleted or suspended users are blocked immediately (max 30s delay)
    if (!user || user.isDeleted || user.status !== 'ACTIVE') {
      this.cache.delete(key);
      throw new UnauthorizedException('Your account is not active');
    }

    let permissions = user.permissions || {};
    if (typeof permissions === 'string') {
      try {
        permissions = JSON.parse(permissions);
      } catch {
        permissions = {};
      }
    }

    const access: CachedAccess = {
      at: Date.now(),
      isOwner: user.isOwner === true,
      permissions,
    };
    this.cache.set(key, access);
    return access;
  }
}
