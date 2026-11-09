'use client'

// The signed-in company and user. Kept in this tab (sessionStorage) and
// also in localStorage, so a new tab or a link without ?company= still
// knows the company. No passwords or tokens are stored here: the login
// itself lives in http-only cookies.

const KEY = 'myerp_tenant_session'
export const NEW_LOGIN_ID_KEY = 'myerp_new_login_id'

type Session = { slug: string; user: unknown; companyName?: string | null }

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function saveTenantSession(slug: string, user: unknown, companyName?: string | null) {
  safe(() => {
    sessionStorage.setItem('tenant_slug_current', slug)
    sessionStorage.setItem(`tenant_user_${slug}`, JSON.stringify(user))
    if (companyName) sessionStorage.setItem(`tenant_company_${slug}`, companyName)
    localStorage.setItem(KEY, JSON.stringify({ slug, user, companyName } satisfies Session))
  }, undefined)
}

// Copies the saved session into this tab if the tab has none yet
export function restoreTenantSession() {
  if (typeof window === 'undefined') return
  safe(() => {
    if (sessionStorage.getItem('tenant_slug_current')) return
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    const s = JSON.parse(raw) as Session
    if (!s?.slug || !/^[a-z0-9-]+$/.test(s.slug)) return
    sessionStorage.setItem('tenant_slug_current', s.slug)
    sessionStorage.setItem(`tenant_user_${s.slug}`, JSON.stringify(s.user))
    if (s.companyName) sessionStorage.setItem(`tenant_company_${s.slug}`, s.companyName)
  }, undefined)
}

export function clearTenantSession(slug?: string | null) {
  safe(() => {
    if (slug) {
      sessionStorage.removeItem(`tenant_user_${slug}`)
      sessionStorage.removeItem(`tenant_company_${slug}`)
    }
    sessionStorage.removeItem('tenant_slug_current')
    localStorage.removeItem(KEY)
  }, undefined)
}
