'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import api from '@/lib/axios'
import AdminSidebar from './AdminSidebar'
import { Toaster } from 'react-hot-toast'

interface AdminLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  headerRight?: React.ReactNode
}

export default function AdminLayout({
  children,
  title,
  subtitle,
  headerRight,
}: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [admin, setAdmin] = useState<any>(null)

  useEffect(() => {
    fetchAdmin()
  }, [])

  async function fetchAdmin() {
    const cached = sessionStorage.getItem('admin_user')
    if (cached) {
      try {
        setAdmin(JSON.parse(cached))
        return
      } catch {}
    }
    try {
      const res = await api.get('/super-admin/me')
      setAdmin(res.data.data)
      sessionStorage.setItem('admin_user', JSON.stringify(res.data.data))
    } catch {
      router.push('/login')
    }
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      fontFamily: 'Inter, sans-serif', background: '#F8FAFC',
    }}>
      <Toaster position="top-right" />
      <AdminSidebar activePath={pathname} admin={admin} />

      <div style={{ flex: 1, marginLeft: '240px', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          background: '#fff', borderBottom: '1px solid #E2E8F0',
          padding: '0 32px', height: '64px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>{title}</h2>
            {subtitle && (
              <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>{subtitle}</p>
            )}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </header>

        <main style={{ padding: '32px', flex: 1 }}>
          {children}
        </main>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}