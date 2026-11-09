import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../database/prisma.service';

// Company lookups are cached for a short time. Every API call used to read
// the company and its modules from the master database (three queries)
// before doing any real work.
type CachedTenant = { at: number; tenant: any | null; status: string | null }
const TENANT_TTL_MS = 30_000
const tenantCache = new Map<string, CachedTenant>()

// Call after a company is changed (modules, status, name, delete)
export function clearTenantCache(slug?: string) {
  if (slug) tenantCache.delete(slug)
  else tenantCache.clear()
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let slug: string | null = null

    // Method 1: the x-tenant-slug header (the frontend always sends it)
    const headerSlug = req.headers['x-tenant-slug'] as string
    if (headerSlug) {
      slug = headerSlug
    } else {
      // The shared sign-in finds the company from the login ID itself
      const path = (req.originalUrl || req.url || '').split('?')[0]
      if (/\/tenant-auth\/(signin|forgot-password)\/?$/.test(path)) return next()

      // Method 2: a company sub-domain of our own domain (APP_DOMAIN), e.g.
      // vertex.myerp.pk. Before, any host counted, so the API's own address
      // (myerp-backend-xxxx.onrender.com) was read as a company name.
      const host = (req.hostname || '').toLowerCase()
      const appDomain = (process.env.APP_DOMAIN || '').trim().toLowerCase()
      if (appDomain && host.endsWith(`.${appDomain}`)) {
        const sub = host.slice(0, -(appDomain.length + 1))
        if (!sub.includes('.') && !['admin', 'api', 'www', 'app'].includes(sub)) {
          slug = sub
        }
      }
    }

    if (!slug) return next()

    let cached = tenantCache.get(slug)
    if (!cached || Date.now() - cached.at > TENANT_TTL_MS) {
      const found = await this.prisma.company.findUnique({
        where: { slug },
        include: {
          modules: { include: { module: true } },
        },
      })
      cached = {
        at: Date.now(),
        status: found?.status ?? null,
        tenant: found
          ? {
              companyId: found.id,
              slug: found.slug,
              name: found.name,
              modules: found.modules.map((cm) => cm.module.key),
            }
          : null,
      }
      tenantCache.set(slug, cached)
      if (tenantCache.size > 1000) tenantCache.delete(tenantCache.keys().next().value as string)
    }
    const company = cached.tenant

    if (!company) {
      return res.status(404).json({
        success: false,
        message: `No company found for: ${slug}`,
      })
    }

    if (cached.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'This company account has been suspended',
      })
    }

    ;(req as any).tenant = { ...company, modules: [...company.modules] }

    next()
  }
}