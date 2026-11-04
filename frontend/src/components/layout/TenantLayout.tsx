'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import TenantSidebar from './TenantSidebar'
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

const ALWAYS_ALLOWED = ['dashboard', 'settings']

export default function TenantLayout({
  children,
  title,
  subtitle,
  headerRight,
  requiredModule,
}: TenantLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [subdomain, setSubdomain] = useState('')
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')

    // Priority: saved slug from login > real subdomain > 'localhost'
    let sub = sessionStorage.getItem('tenant_slug_current') || ''
    if (!sub) {
      if (parts.length >= 3 && !host.includes('vercel.app')) {
        sub = parts[0]
      } else if (host === 'localhost' || host === '127.0.0.1') {
        sub = 'localhost'
      } else if (parts.length === 2 && parts[1] === 'localhost') {
        sub = parts[0]
      } else {
        sub = 'localhost'
      }
    }
    setSubdomain(sub)

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

      if (requiredModule && !ALWAYS_ALLOWED.includes(requiredModule)) {
        const moduleKeys: string[] = parsed.moduleKeys || []
        if (!moduleKeys.includes(requiredModule)) {
          setBlocked(true)
        }
      }
    } catch {
      router.replace('/erp-login')
    }
  }, [router, requiredModule])

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      fontFamily: 'Inter, sans-serif', background: '#F8FAFC',
    }}>
      <Toaster position="top-right" />
      <TenantSidebar
        activePath={pathname || ''}
        user={user}
        subdomain={subdomain}
      />

      <div style={{
        flex: 1, marginLeft: '230px',
        display: 'flex', flexDirection: 'column',
      }}>
        <header style={{
          background: '#fff', borderBottom: '1px solid #E2E8F0',
          padding: '0 28px', height: '60px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>
                {subtitle}
              </p>
            )}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </header>

        <main style={{ padding: '28px', flex: 1 }}>
          {blocked ? (
            <div style={{
              background: '#fff', borderRadius: '16px',
              border: '1px solid #E2E8F0', padding: '80px',
              textAlign: 'center', maxWidth: '500px', margin: '40px auto',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                Module Not Enabled
              </h3>
              <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '24px' }}>
                This module is not included in your current subscription plan. Please contact your administrator.
              </p>
              <button
                onClick={() => router.push('/erp/dashboard')}
                style={{
                  padding: '10px 24px', background: '#1E3A5F',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >← Back to Dashboard</button>
            </div>
          ) : children}
        </main>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}