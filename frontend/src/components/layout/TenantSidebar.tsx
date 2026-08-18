'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import axios from 'axios'

interface TenantSidebarProps {
  activePath: string
  user: any
  subdomain: string
}

const menuGroups = [
  {
    key: 'dashboard',
    moduleKey: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    path: '/erp/dashboard',
    single: true,
  },
  {
    key: 'users',
    moduleKey: 'users',
    label: 'Users & Roles',
    icon: '👥',
    path: '/erp/users',
    single: true,
  },
  {
    key: 'customers',
    moduleKey: 'contacts',
    label: 'Customers & Suppliers',
    icon: '👥',
    single: false,
    children: [
      { label: 'Customers', path: '/erp/customers' },
      { label: 'Suppliers', path: '/erp/suppliers' },
    ],
  },
  {
    key: 'products',
    moduleKey: 'products',
    label: 'Products & Inventory',
    icon: '📦',
    single: false,
    children: [
      { label: 'Products', path: '/erp/products' },
      { label: 'Inventory', path: '/erp/inventory' },
      { label: 'Stock Adjustment', path: '/erp/stock-adjustment' },
      { label: 'Categories', path: '/erp/categories' },
      { label: 'Brands', path: '/erp/brands' },
    ],
  },
  {
    key: 'purchase',
    moduleKey: 'purchase',
    label: 'Purchase',
    icon: '🛒',
    single: false,
    children: [
      { label: 'Purchase Orders', path: '/erp/purchase/orders' },
      { label: 'Purchase Returns', path: '/erp/purchase/returns' },
    ],
  },
  {
    key: 'sales',
    moduleKey: 'sales',
    label: 'Sales',
    icon: '💰',
    single: false,
    children: [
      { label: 'Sales Orders', path: '/erp/sales/orders' },
      { label: 'Sale Returns', path: '/erp/sales/returns' },
    ],
  },
  {
    key: 'invoices',
    moduleKey: 'invoices',
    label: 'Invoices',
    icon: '🧾',
    single: false,
    children: [
      { label: 'All Invoices', path: '/erp/invoices' },
      { label: 'Create Invoice', path: '/erp/invoices/create' },
    ],
  },
  {
    key: 'finance',
    moduleKey: 'finance',
    label: 'Accounts & Finance',
    icon: '🏦',
    single: false,
    children: [
      { label: 'Chart of Accounts', path: '/erp/finance/accounts' },
      { label: 'Journal Voucher', path: '/erp/finance/journal' },
      { label: 'Payment Voucher', path: '/erp/finance/payments' },
      { label: 'Receipt Voucher', path: '/erp/finance/receipts' },
      { label: 'Ledger', path: '/erp/finance/ledger' },
    ],
  },
  {
    key: 'manufacturing',
    moduleKey: 'manufacturing',
    label: 'Manufacturing',
    icon: '🏭',
    path: '/erp/manufacturing',
    single: true,
  },
  {
    key: 'hr',
    moduleKey: 'hr',
    label: 'HR & Payroll',
    icon: '👤',
    single: false,
    children: [
      { label: 'Employees', path: '/erp/hr/employees' },
      { label: 'Attendance', path: '/erp/hr/attendance' },
      { label: 'Leave Management', path: '/erp/hr/leave' },
      { label: 'Payroll', path: '/erp/hr/payroll' },
    ],
  },
  {
    key: 'reports',
    moduleKey: 'reports',
    label: 'Reports',
    icon: '📈',
    single: false,
    children: [
      { label: 'Sales Report', path: '/erp/reports/sales' },
      { label: 'Purchase Report', path: '/erp/reports/purchase' },
      { label: 'Invoice Report', path: '/erp/reports/invoices' },
      { label: 'Stock Report', path: '/erp/reports/stock' },
      { label: 'Stock Movement', path: '/erp/reports/stock-movement' },
      { label: 'Profit & Loss', path: '/erp/reports/profit-loss' },
      { label: 'Balance Sheet', path: '/erp/reports/balance-sheet' },
      { label: 'Accounts Receivable', path: '/erp/reports/ar' },
      { label: 'Accounts Payable', path: '/erp/reports/ap' },
      { label: 'Customer Ledger', path: '/erp/reports/customer-ledger' },
      { label: 'Supplier Ledger', path: '/erp/reports/supplier-ledger' },
      { label: 'Attendance Report', path: '/erp/reports/attendance' },
      { label: 'Payroll Report', path: '/erp/reports/payroll-report' },
    ],
  },
  {
    key: 'settings',
    moduleKey: 'settings',
    label: 'Settings',
    icon: '⚙️',
    single: false,
    children: [
      { label: 'Company Settings', path: '/erp/settings' },
      { label: 'Audit Log', path: '/erp/audit-logs' },
    ],
  },
]

export default function TenantSidebar({ activePath, user, subdomain }: TenantSidebarProps) {
  const router = useRouter()

  const moduleKeys: string[] = user?.moduleKeys || []

  // Always-visible items regardless of plan
  const alwaysVisible = ['dashboard', 'settings']

  const visibleGroups = menuGroups.filter((g) =>
    alwaysVisible.includes(g.moduleKey) || moduleKeys.includes(g.moduleKey)
  )

  function getInitialOpenGroups(): Record<string, boolean> {
    const open: Record<string, boolean> = {}
    visibleGroups.forEach((group) => {
      if (!group.single && group.children) {
        const isActive = group.children.some((c) => activePath.startsWith(c.path))
        if (isActive) open[group.key] = true
      }
    })
    return open
  }

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getInitialOpenGroups)

    function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Preserves ?company= when navigating, so tenant identity isn't
  // lost on sidebar clicks (Vercel no-domain URLs).
  function navigate(path: string) {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const company = params.get('company')
      if (company) {
        router.push(`${path}?company=${company}`)
        return
      }
    }
    router.push(path)
  }

  async function handleLogout() {
    sessionStorage.removeItem(`tenant_user_${subdomain}`)
    sessionStorage.removeItem('tenant_slug_current')
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/tenant-auth/logout`,
        {},
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } }
      )
    } catch {}
    window.location.href = '/erp-login'
  }

  return (
    <aside style={{
      width: '230px', height: '100vh',
      background: '#1E3A5F', position: 'fixed',
      left: 0, top: 0, display: 'flex',
      flexDirection: 'column', zIndex: 100,
      overflow: 'hidden',
    }}>

      {/* Logo */}
      <div style={{
        padding: '20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '10px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '16px',
            overflow: 'hidden', flexShrink: 0,
          }}>
            {user?.logoUrl ? (
              <img src={user.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
            ) : (
              <span>🏢</span>
            )}
          </div>
          <div>
            <div style={{
              color: '#fff', fontWeight: 700, fontSize: '15px',
              lineHeight: 1, textTransform: 'capitalize',
            }}>{subdomain || 'Company'}</div>
            <div style={{ color: '#93C5FD', fontSize: '10px', marginTop: '2px' }}>
              ERP System
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{
        flex: 1,
        padding: '10px 8px',
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.15) transparent',
      }}>
        {visibleGroups.map((group) => {

          if (group.single) {
            const isActive = activePath === group.path
            return (
                            <button
                key={group.key}
                onClick={() => navigate(group.path!)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 10px', borderRadius: '8px', border: 'none',
                  cursor: 'pointer', marginBottom: '2px',
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: isActive ? '#fff' : '#94A3B8',
                  fontSize: '13px', fontWeight: isActive ? 600 : 400,
                  fontFamily: 'Inter, sans-serif', textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.color = '#fff'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#94A3B8'
                  }
                }}
              >
                <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>
                  {group.icon}
                </span>
                <span style={{ flex: 1 }}>{group.label}</span>
                {isActive && <span style={{ fontSize: '10px', color: '#60A5FA' }}>●</span>}
              </button>
            )
          }

          const isOpen = openGroups[group.key] || false
          const hasActive = group.children?.some((c) => activePath.startsWith(c.path))

          return (
            <div key={group.key} style={{ marginBottom: '2px' }}>
              <button
                onClick={() => toggleGroup(group.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 10px', borderRadius: '8px', border: 'none',
                  cursor: 'pointer',
                  background: hasActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: hasActive ? '#fff' : '#94A3B8',
                  fontSize: '13px', fontWeight: hasActive ? 600 : 400,
                  fontFamily: 'Inter, sans-serif', textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!hasActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.color = '#fff'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!hasActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#94A3B8'
                  }
                }}
              >
                <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>
                  {group.icon}
                </span>
                <span style={{ flex: 1 }}>{group.label}</span>
                <span style={{
                  fontSize: '10px', color: '#64748B',
                  transition: 'transform 0.2s', display: 'inline-block',
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                }}>▶</span>
              </button>

              {isOpen && (
                <div style={{
                  marginLeft: '8px',
                  borderLeft: '1px solid rgba(255,255,255,0.1)',
                  marginBottom: '4px',
                }}>
                  {group.children?.map((child) => {
                    const isChildActive = activePath === child.path
                    return (
                                            <button
                        key={child.path}
                        onClick={() => navigate(child.path)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '7px 10px 7px 14px',
                          borderRadius: '6px', border: 'none',
                          cursor: 'pointer', marginBottom: '1px',
                          background: isChildActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                          color: isChildActive ? '#60A5FA' : '#94A3B8',
                          fontSize: '12px', fontWeight: isChildActive ? 600 : 400,
                          fontFamily: 'Inter, sans-serif', textAlign: 'left',
                        }}
                        onMouseEnter={(e) => {
                          if (!isChildActive) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                            e.currentTarget.style.color = '#CBD5E1'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isChildActive) {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = '#94A3B8'
                          }
                        }}
                      >
                        <span style={{
                          width: '5px', height: '5px',
                          borderRadius: '50%', flexShrink: 0,
                          background: isChildActive ? '#60A5FA' : '#475569',
                        }} />
                        {child.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div style={{
        padding: '12px 10px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 10px', marginBottom: '8px',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: '#2E86AB', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: '13px',
          }}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{
              color: '#fff', fontSize: '12px', fontWeight: 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{user?.name || '...'}</div>
            <div style={{
              color: '#64748B', fontSize: '10px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{user?.role || 'Owner'}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '8px 10px',
            background: 'transparent',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px', color: '#FCA5A5',
            fontSize: '12px', fontWeight: 500,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '6px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#FCA5A5'
          }}
        >
          🚪 Sign Out
        </button>
      </div>
    </aside>
  )
}