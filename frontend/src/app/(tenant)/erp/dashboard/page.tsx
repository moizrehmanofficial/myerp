'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Wallet, CircleDollarSign, Banknote, ShoppingCart, Contact, Truck, Package,
  TriangleAlert, Briefcase, Plus, Receipt, ChevronRight,
} from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import { Card, CardHeader, Stat, Spinner, EmptyState, StatusBadge, buttonStyles } from '@/components/ui'
import { money, number, compact, date } from '@/lib/format'
import { getTenantSlug } from '@/lib/getTenantSlug'
import { useCompanyHref } from '@/lib/useCompanyHref'

type Sections = { money: boolean; sales: boolean; purchase: boolean; contacts: boolean; stock: boolean; hr: boolean }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}


export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const withCompany = useCompanyHref()

  useEffect(() => {
    const sub = getTenantSlug()
    const cached = sessionStorage.getItem(`tenant_user_${sub}`)
    if (cached) {
      try {
        setUserName(JSON.parse(cached).name || '')
      } catch {}
    }

    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/erp/dashboard/stats`, {
        withCredentials: true,
        headers: { 'x-tenant-slug': sub },
      })
      .then((res) => setStats(res.data.data))
      .catch(() => toast.error('Could not load the dashboard. Refresh the page to try again.'))
      .finally(() => setLoading(false))
  }, [])

  const s = stats || {}
  // Older API versions don't send this: show everything
  const show: Sections = s.visibleSections || { money: true, sales: true, purchase: true, contacts: true, stock: true, hr: true }
  const firstName = String(userName || '').split(' ')[0]

  return (
    <TenantLayout
      title="Dashboard"
      subtitle={firstName ? `${greeting()}, ${firstName}. Here is how the business is doing.` : 'Here is how the business is doing.'}
      headerRight={
        show.money ? (
          <Link href={withCompany('/erp/invoices/create')} className={buttonStyles({ className: 'gap-2' })}>
            <Plus className="size-4" aria-hidden />
            New invoice
          </Link>
        ) : undefined
      }
    >
      {loading ? (
        <Spinner label="Loading dashboard" />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Money */}
          {(show.money || show.purchase) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {show.money && (
                <>
                  <Stat
                    label="Total sales"
                    icon={<CircleDollarSign />}
                    tone="brand"
                    value={money(s.totalRevenue)}
                    sub={`${money(s.monthlyRevenue)} this month`}
                  />
                  <Stat
                    label="Money received"
                    icon={<Banknote />}
                    tone="good"
                    value={money(s.totalCollected)}
                    sub={`From ${number(s.totalInvoices)} invoices`}
                  />
                  <Stat
                    label="Customers owe you"
                    icon={<Wallet />}
                    tone={Number(s.accountsReceivable) > 0 ? 'warn' : 'neutral'}
                    value={money(s.accountsReceivable)}
                    sub={
                      Number(s.unpaidInvoices) + Number(s.partialInvoices) > 0
                        ? `${number(Number(s.unpaidInvoices) + Number(s.partialInvoices))} invoices not fully paid`
                        : 'All invoices are paid'
                    }
                  />
                </>
              )}
              {show.purchase && (
                <Stat
                  label="Purchases this month"
                  icon={<ShoppingCart />}
                  tone="info"
                  value={money(s.monthlyPurchaseTotal)}
                  sub={`${number(s.monthlyPurchaseCount)} purchase orders`}
                />
              )}
            </div>
          )}

          {/* Counts — each opens its list */}
          {(show.contacts || show.stock || show.hr) && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {show.contacts && (
                <>
                  <CountLink href="/erp/customers" icon={<Contact />} label="Customers" value={s.totalCustomers} />
                  <CountLink href="/erp/suppliers" icon={<Truck />} label="Suppliers" value={s.totalSuppliers} />
                </>
              )}
              {show.stock && (
                <>
                  <CountLink href="/erp/products" icon={<Package />} label="Products" value={s.totalProducts} />
                  <CountLink
                    href="/erp/inventory"
                    icon={<TriangleAlert />}
                    label="Low on stock"
                    value={s.lowStockCount}
                    alert={Number(s.lowStockCount) > 0}
                  />
                </>
              )}
              {show.hr && <CountLink href="/erp/hr/employees" icon={<Briefcase />} label="Employees" value={s.activeEmployees} />}
            </div>
          )}

          {show.money && (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader title="Sales by month" description="Invoice totals for the last 6 months" />
                <RevenueChart data={s.monthlyRevenueTrend || []} />
              </Card>

              <Card>
                <CardHeader title="Best sellers this month" />
                {(s.topProducts || []).length === 0 ? (
                  <EmptyState icon={<Package />} title="No sales yet this month" description="Products you invoice this month will show here." />
                ) : (
                  <ul className="divide-y divide-line">
                    {s.topProducts.map((p: any, i: number) => (
                      <li key={p.sku || i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <span className="num w-5 text-[13px] text-ink-3">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                          <p className="num text-xs text-ink-3">{number(p.soldQty)} sold</p>
                        </div>
                        <span className="num text-sm font-medium text-ink">{money(p.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}

          {(show.money || show.purchase) && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {show.money && (
                <RecentList
                  title="Latest invoices"
                  viewAll="/erp/invoices"
                  emptyTitle="No invoices yet"
                  emptyText="Create your first invoice to start tracking sales."
                  emptyAction={
                    <Link href={withCompany('/erp/invoices/create')} className={buttonStyles({ size: 'sm' })}>
                      <Plus className="size-4" aria-hidden />
                      New invoice
                    </Link>
                  }
                  rows={(s.recentInvoices || []).map((r: any) => ({
                    id: r.id,
                    href: `/erp/invoices/${r.id}`,
                    title: r.invoiceNumber,
                    party: r.customerName || 'Customer',
                    when: date(r.createdAt),
                    amount: money(r.totalAmount),
                    status: r.paymentStatus,
                  }))}
                />
              )}
              {show.purchase && (
                <RecentList
                  title="Latest purchases"
                  viewAll="/erp/purchase/orders"
                  emptyTitle="No purchases yet"
                  emptyText="Purchase orders you create will show here."
                  rows={(s.recentPurchases || []).map((r: any) => ({
                    id: r.id,
                    href: `/erp/purchase/orders/${r.id}`,
                    title: r.orderNumber,
                    party: r.supplierName || 'Supplier',
                    when: date(r.createdAt),
                    amount: money(r.totalAmount),
                    status: r.status,
                  }))}
                />
              )}
            </div>
          )}

          {!show.money && !show.purchase && !show.contacts && !show.stock && !show.hr && (
            <Card>
              <EmptyState
                icon={<Receipt />}
                title="Nothing to show yet"
                description="Your role doesn't include any business data. Ask your company owner for access to the modules you need."
              />
            </Card>
          )}
        </div>
      )}
    </TenantLayout>
  )
}

function CountLink({ href, icon, label, value, alert }: { href: string; icon: React.ReactNode; label: string; value: unknown; alert?: boolean }) {
  const withCompany = useCompanyHref()
  return (
    <Link
      href={withCompany(href)}
      className="group flex items-center gap-3 rounded-[var(--radius-panel)] border border-line bg-surface p-3.5 transition-colors hover:border-line-strong hover:bg-subtle"
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg [&>svg]:size-[18px] ${
          alert ? 'bg-warn-soft text-warn' : 'bg-subtle text-ink-2 group-hover:bg-surface'
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="num text-lg leading-tight font-semibold text-ink">{number(value)}</p>
        <p className="truncate text-[13px] text-ink-3">{label}</p>
      </div>
    </Link>
  )
}

function RecentList({
  title, viewAll, rows, emptyTitle, emptyText, emptyAction,
}: {
  title: string
  viewAll: string
  rows: { id: string; href: string; title: string; party: string; when: string; amount: string; status?: string }[]
  emptyTitle: string
  emptyText: string
  emptyAction?: React.ReactNode
}) {
  const withCompany = useCompanyHref()
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <Link href={withCompany(viewAll)} className="text-[13px] font-medium text-brand hover:text-brand-hover">
            View all
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyText} action={emptyAction} />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={withCompany(r.href)} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{r.title}</p>
                  <p className="truncate text-xs text-ink-3">
                    {r.party}, {r.when}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="num text-sm font-medium text-ink">{r.amount}</span>
                  <StatusBadge status={r.status} />
                </div>
                <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// Simple bar chart in plain HTML/CSS — no chart library needed
function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  if (!data.length) {
    return <EmptyState title="No sales in the last 6 months" description="Monthly totals appear here once you create invoices." />
  }
  const max = Math.max(...data.map((d) => Number(d.revenue) || 0), 1)
  return (
    <div className="px-4 pt-5 pb-4 sm:px-5">
      <div className="flex h-52 items-end gap-3 sm:gap-5" role="img" aria-label="Sales by month">
        {data.map((d) => {
          const v = Number(d.revenue) || 0
          const h = Math.max((v / max) * 100, 2)
          return (
            <div key={d.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <span className="num text-xs font-medium text-ink-2">{compact(v)}</span>
              <div
                className="w-full max-w-16 rounded-t-md bg-brand/85 transition-colors hover:bg-brand"
                style={{ height: `${h}%` }}
                title={`${d.month}: ${money(v)}`}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-3 border-t border-line pt-2 sm:gap-5">
        {data.map((d) => (
          <span key={d.month} className="min-w-0 flex-1 truncate text-center text-xs text-ink-3">
            {String(d.month).replace(/\s\d{4}$/, '')}
          </span>
        ))}
      </div>
    </div>
  )
}
