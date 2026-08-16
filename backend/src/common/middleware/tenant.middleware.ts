import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../database/prisma.service';

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

    const company = await this.prisma.company.findUnique({
      where: { slug },
      include: {
        modules: { include: { module: true } },
      },
    })

    if (!company) {
      return res.status(404).json({
        success: false,
        message: `No company found for: ${slug}`,
      })
    }

    if (company.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'This company account has been suspended',
      })
    }

    ;(req as any).tenant = {
      companyId: company.id,
      slug: company.slug,
      name: company.name,
      modules: company.modules.map((cm) => cm.module.key),
    }

    next()
  }
}