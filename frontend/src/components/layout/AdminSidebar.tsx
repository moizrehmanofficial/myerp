'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, Building2, Puzzle, Users, HardDrive, LogOut, ShieldCheck, X } from 'lucide-react'
import api from '@/lib/axios'
import { cn } from '@/utils/utils'

interface AdminSidebarProps {
  activePath: string
  admin: any
  mobileOpen: boolean
  onCloseMobile: () => void
}

const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Companies', icon: Building2, path: '/companies' },
  { label: 'Modules', icon: Puzzle, path: '/modules' },
  { label: 'Admin users', icon: Users, path: '/users' },
  { label: 'Backups', icon: HardDrive, path: '/backup' },
]

export default function AdminSidebar({ activePath, admin, mobileOpen, onCloseMobile }: AdminSidebarProps) {
  const router = useRouter()

  async function handleLogout() {
    sessionStorage.removeItem('admin_user')
    try {
      await api.post('/auth/logout')
    } catch {}
    router.push('/')
  }

  const initials = String(admin?.name || 'A')
    .split(' ')
    .map((p: string) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-[90] bg-nav/50 lg:hidden" onClick={onCloseMobile} aria-hidden />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[100] flex w-[248px] flex-col bg-nav transition-transform duration-200',
          '-translate-x-full lg:translate-x-0',
          mobileOpen && 'translate-x-0',
        )}
        aria-label="Admin navigation"
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
            <ShieldCheck className="size-[18px]" strokeWidth={1.8} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white">MyERP</p>
            <p className="text-xs text-nav-muted">Platform admin</p>
          </div>
          <button type="button" onClick={onCloseMobile} className="rounded-md p-1.5 text-nav-muted hover:bg-nav-hover hover:text-white lg:hidden" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-0.5">
            {menuItems.map((item) => {
              const Icon = item.icon
              const active = activePath === item.path || activePath.startsWith(item.path + '/')
              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    onClick={onCloseMobile}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] text-nav-text transition-colors hover:bg-nav-hover hover:text-white',
                      active && 'bg-nav-active font-medium text-white',
                    )}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-[#2dd4bf]" aria-hidden />}
                    <Icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-3 border-t border-white/10 p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#2dd4bf]/15 text-[13px] font-semibold text-[#5eead4]">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-white">{admin?.name || 'Super Admin'}</p>
            <p className="truncate text-xs text-nav-muted">{admin?.email || ''}</p>
          </div>
          <button type="button" onClick={handleLogout} className="rounded-md p-2 text-nav-muted hover:bg-nav-hover hover:text-white" aria-label="Sign out" title="Sign out">
            <LogOut className="size-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      </aside>
    </>
  )
}
