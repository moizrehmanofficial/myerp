'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCompanyHref } from '@/lib/useCompanyHref'
import axios from 'axios'
import { clearTenantSession } from '@/lib/tenantSession'
import { Building2, ChevronDown, ChevronsLeft, ChevronsRight, KeyRound, LogOut, X } from 'lucide-react'
import ChangePasswordModal from '@/components/auth/ChangePasswordModal'
import { cn } from '@/utils/utils'
import { TENANT_NAV, ALWAYS_VISIBLE, type NavGroup } from './tenantNav'

interface TenantSidebarProps {
  activePath: string
  user: any
  subdomain: string
  companyName?: string
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}


function isActive(activePath: string, path: string) {
  return activePath === path || activePath.startsWith(path + '/')
}

export default function TenantSidebar({
  activePath, user, subdomain, companyName, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile,
}: TenantSidebarProps) {
  const href = useCompanyHref()
  const moduleKeys: string[] = user?.moduleKeys || []

  const groups = TENANT_NAV.filter((g) => ALWAYS_VISIBLE.includes(g.moduleKey) || moduleKeys.includes(g.moduleKey))

  // The group that contains the current page starts open
  const [pwOpen, setPwOpen] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {}
    TENANT_NAV.forEach((g) => {
      if (g.children?.some((c) => isActive(activePath, c.path))) o[g.key] = true
    })
    return o
  })

  async function handleLogout() {
    clearTenantSession(subdomain)
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/tenant-auth/logout`,
        {},
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } },
      )
    } catch {}
    window.location.href = '/signin'
  }

  const name = companyName || subdomain || 'Company'
  // On phones the drawer is always full width (never the icon-only mode)
  const compact = collapsed && !mobileOpen

  function renderGroup(group: NavGroup) {
    const Icon = group.icon
    const children = (group.children || []).filter(
      (c) => !c.ownerOrModuleOnly || user?.isOwner || moduleKeys.includes(group.moduleKey),
    )

    if (group.path || compact) {
      // Single link — or, in icon-only mode, jump to the group's first page
      const target = group.path || children[0]?.path || '#'
      const active = group.path ? isActive(activePath, group.path) : children.some((c) => isActive(activePath, c.path))
      return (
        <li key={group.key}>
          <Link
            href={href(target)}
            onClick={onCloseMobile}
            title={compact ? group.label : undefined}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] text-nav-text transition-colors hover:bg-nav-hover hover:text-white',
              active && 'bg-nav-active font-medium text-white',
              compact && 'justify-center px-0',
            )}
          >
            {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-[#2dd4bf]" aria-hidden />}
            <Icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
            {!compact && <span className="truncate">{group.label}</span>}
          </Link>
        </li>
      )
    }

    const expanded = !!open[group.key]
    const hasActive = children.some((c) => isActive(activePath, c.path))
    return (
      <li key={group.key}>
        <button
          type="button"
          onClick={() => setOpen((o) => ({ ...o, [group.key]: !o[group.key] }))}
          aria-expanded={expanded}
          className={cn(
            'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] text-nav-text transition-colors hover:bg-nav-hover hover:text-white',
            hasActive && 'text-white',
          )}
        >
          <Icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
          <span className="flex-1 truncate">{group.label}</span>
          <ChevronDown className={cn('size-4 shrink-0 text-nav-muted transition-transform', expanded && 'rotate-180')} aria-hidden />
        </button>
        {expanded && (
          <ul className="mt-0.5 mb-1 ml-[21px] border-l border-white/10 pl-2">
            {children.map((c) => {
              const active = activePath === c.path
              return (
                <li key={c.path}>
                  <Link
                    href={href(c.path)}
                    onClick={onCloseMobile}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block truncate rounded-md px-3 py-1.5 text-[13.5px] text-nav-muted transition-colors hover:bg-nav-hover hover:text-white',
                      active && 'bg-nav-active font-medium text-white',
                    )}
                  >
                    {c.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </li>
    )
  }

  const initials = String(user?.name || 'U')
    .split(' ')
    .map((p: string) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      {/* Phone / tablet backdrop */}
      {mobileOpen && <div className="fixed inset-0 z-[90] bg-nav/50 lg:hidden" onClick={onCloseMobile} aria-hidden />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[100] flex flex-col bg-nav transition-[width,transform] duration-200 print:hidden',
          'w-[272px] -translate-x-full lg:translate-x-0',
          mobileOpen && 'translate-x-0',
          collapsed ? 'lg:w-[72px]' : 'lg:w-[256px]',
        )}
        aria-label="Main navigation"
      >
        {/* Company */}
        <div className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4', compact && 'justify-center px-0')}>
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 text-white">
            {user?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.logoUrl} alt="" className="size-full object-contain p-1" />
            ) : (
              <Building2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
            )}
          </div>
          {!compact && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-white capitalize">{name}</p>
              <p className="text-xs text-nav-muted">MyERP</p>
            </div>
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-md p-1.5 text-nav-muted hover:bg-nav-hover hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
          <ul className="flex flex-col gap-0.5">{groups.map(renderGroup)}</ul>
        </nav>

        {/* Collapse (desktop only) */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            'mx-3 mb-2 hidden h-9 items-center gap-3 rounded-lg px-3 text-[13px] text-nav-muted hover:bg-nav-hover hover:text-white lg:flex',
            compact && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!compact && 'Collapse menu'}
        </button>

        {/* User */}
        <div className={cn('flex shrink-0 items-center gap-3 border-t border-white/10 p-3', compact && 'flex-col gap-2')}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#2dd4bf]/15 text-[13px] font-semibold text-[#5eead4]" title={user?.name}>
            {initials}
          </div>
          {!compact && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-white">{user?.name || '…'}</p>
              <p className="truncate text-xs text-nav-muted">{user?.isOwner ? 'Owner' : user?.role || 'User'}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setPwOpen(true)}
            className="rounded-md p-2 text-nav-muted hover:bg-nav-hover hover:text-white"
            aria-label="Change password"
            title="Change password"
          >
            <KeyRound className="size-[18px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md p-2 text-nav-muted hover:bg-nav-hover hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      </aside>
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  )
}
