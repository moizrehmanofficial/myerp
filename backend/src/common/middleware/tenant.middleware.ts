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

    // Method 1: Check x-tenant-slug header (for local dev)
    const headerSlug = req.headers['x-tenant-slug'] as string
    if (headerSlug) {
      slug = headerSlug
    } else {
      // Method 2: Extract from hostname
      const host = req.hostname
      if (host === 'localhost' || host === '127.0.0.1') {
        return next()
      }
      const parts = host.split('.')
      if (parts.length >= 2) {
        const sub = parts[0]
        if (!['admin', 'api', 'www'].includes(sub)) {
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