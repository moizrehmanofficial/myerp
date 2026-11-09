'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import { Menu } from 'lucide-react'
import api from '@/lib/axios'
import AdminSidebar from './AdminSidebar'

interface AdminLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  headerRight?: React.ReactNode
}

export default function AdminLayout({ children, title, subtitle, headerRight }: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname() || ''
  const [admin, setAdmin] = useState<any>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
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
        router.push('/')
      }
    }
    fetchAdmin()
  }, [router])

  return (
    <div className="min-h-screen bg-canvas">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '14px', borderRadius: '10px', border: '1px solid var(--color-line)' } }} />
      <AdminSidebar activePath={pathname} admin={admin} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div className="flex min-h-screen flex-col lg:pl-[248px]">
        <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
          <div className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
            <button type="button" onClick={() => setMobileOpen(true)} className="-ml-1 rounded-md p-2 text-ink-2 hover:bg-subtle lg:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[17px] leading-tight font-semibold text-ink">{title}</h1>
              {subtitle && <p className="mt-0.5 hidden truncate text-[13px] text-ink-3 sm:block">{subtitle}</p>}
            </div>
            {headerRight && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:shrink-0">{headerRight}</div>}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  )
}
