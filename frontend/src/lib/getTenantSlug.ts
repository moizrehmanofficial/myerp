'use client'

import { restoreTenantSession } from './tenantSession'

export function getTenantSlug(): string {
  if (typeof window === 'undefined') return 'localhost'

  restoreTenantSession()

  const params = new URLSearchParams(window.location.search)
  const queryCompany = params.get('company')
  if (queryCompany) return queryCompany

  const cached = sessionStorage.getItem('tenant_slug_current')
  if (cached) return cached

  const host = window.location.hostname
  const parts = host.split('.')
  if (parts.length >= 3 && !host.includes('vercel.app')) {
    return parts[0]
  }

  return 'localhost'
}