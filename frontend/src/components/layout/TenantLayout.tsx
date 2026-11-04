'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import axios from 'axios'
import { Toaster } from 'react-hot-toast'
import { Lock, Menu } from 'lucide-react'
import TenantSidebar from './TenantSidebar'
import { ALWAYS_VISIBLE } from './tenantNav'
import { Button, EmptyState } from '@/components/ui'
import { cn } from '@/utils/utils'
import { installTenantAuthInterceptor } from '@/lib/tenantAuthInterceptor'

// Auto-refresh expired login (15 min) for every tenant page
installTenantAuthInterceptor()

interface TenantLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  headerRight?: React.ReactNode
  requiredModule?: string
}

const COLLAPSE_KEY = 'erp_sidebar_collapsed'

function readSlug() {
  const host = window.location.hostname
  const parts = host.split('.')
  // Priority: saved slug from login > real subdomain > 'localhost'
  let sub = sessionStorage.getItem('tenant_slug_current') || ''
  if (!sub) {
    if (parts.length >= 3 && !host.includes('vercel.app')) sub = parts[0]
    else if (parts.length === 2 && parts[1] === 'localhost') sub = parts[0]
    else sub = 'localhost'
  }
  return sub
}

export default function TenantLayout({ children, title, subtitle, headerRight, requiredModule }: TenantLayoutProps) {
  const router = useRouter()
  const pathname = usePathname() || ''
  const [user, setUser] = useState<any>(null)
  const [subdomain, setSubdomain] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const sub = readSlug()
    setSubdomain(sub)

    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
    } catch {}

    const cachedUser = sessionStorage.getItem(`tenant_user_${sub}`)
    if (!cachedUser) {
      router.replace('/erp-login')
      return
    }

    try {
      const parsed = JSON.parse(cachedUser)
      if (parsed.slug !== sub) {
        router.replace('/erp-login')
        return
      }
      setUser(parsed)
      if (requiredModule && !ALWAYS_VISIBLE.includes(requiredModule)) {
        setBlocked(!(parsed.moduleKeys || []).includes(requiredModule))
      }
    } catch {
      router.replace('/erp-login')
      return
    }

    // Company display name (cached for the session)
    const nameKey = `tenant_company_${sub}`
    const cachedName = sessionStorage.getItem(nameKey)
    if (cachedName) {
      setCompanyName(cachedName)
    } else {
      axios
        .get(`${process.env.NEXT_PUBLIC_API_URL}/tenant-auth/company-info`, { headers: { 'x-tenant-slug': sub } })
        .then((res) => {
          const n = res.data?.data?.name
          if (n) {
            setCompanyName(n)
            sessionStorage.setItem(nameKey, n)
          }
        })
        .catch(() => {})
    }
  }, [router, requiredModule])

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {}
      return !c
    })
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Toaster
        position="top-right"
        toastOptions={{ style: { fontSize: '14px', borderRadius: '10px', border: '1px solid var(--color-line)' } }}
      />
      <TenantSidebar
        activePath={pathname}
        user={user}
        subdomain={subdomain}
        companyName={companyName}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200 print:pl-0', collapsed ? 'lg:pl-[72px]' : 'lg:pl-[256px]')}>
        <header className="sticky top-0 z-40 border-b print:hidden border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
          <div className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="-ml-1 rounded-md p-2 text-ink-2 hover:bg-subtle lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[17px] leading-tight font-semibold text-ink">{title}</h1>
              {subtitle && <p className="mt-0.5 hidden truncate text-[13px] text-ink-3 sm:block">{subtitle}</p>}
            </div>
            {headerRight && !blocked && (
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:shrink-0">{headerRight}</div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 sm:py-6 print:max-w-none print:p-0">
          {blocked ? (
            <div className="mx-auto mt-8 max-w-md rounded-[var(--radius-panel)] border border-line bg-surface">
              <EmptyState
                icon={<Lock />}
                title="This module is not part of your plan"
                description="Ask your company owner or MyERP support to enable it."
                action={
                  <Button variant="secondary" onClick={() => router.push('/erp/dashboard')}>
                    Go to dashboard
                  </Button>
                }
              />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}
