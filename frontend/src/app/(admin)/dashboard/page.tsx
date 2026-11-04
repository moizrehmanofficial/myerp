'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Building2, CircleCheck, HardDrive, Pause, Plus, Puzzle } from 'lucide-react'
import api from '@/lib/axios'
import AdminLayout from '@/components/layout/AdminLayout'
import { Badge, Card, CardHeader, Spinner, Stat, StatusBadge, EmptyState, buttonStyles } from '@/components/ui'
import { apiError } from '@/lib/tenantApi'
import { date } from '@/lib/format'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [companies, setCompanies] = useState<any[]>([])
  const [backups, setBackups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([api.get('/super-admin/stats'), api.get('/companies?page=1&limit=6'), api.get('/backups?page=1&limit=6')])
      .then(([s, c, b]) => {
        if (s.status === 'fulfilled') setStats(s.value.data.data)
        else toast.error(apiError(s.reason, 'Could not load the dashboard.'))
        if (c.status === 'fulfilled') setCompanies(c.value.data.data || [])
        if (b.status === 'fulfilled') setBackups(b.value.data.data || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const total = Number(stats?.totalCompanies || 0)
  const active = Number(stats?.activeCompanies || 0)
  const failed = backups.filter((b) => b.status === 'FAILED').length

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="All companies at a glance"
      headerRight={<Link href="/companies/create" className={buttonStyles()}><Plus className="size-4" aria-hidden />New company</Link>}
    >
      {loading ? (
        <Spinner label="Loading dashboard" />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Companies" value={total} icon={<Building2 />} tone="brand" />
            <Stat label="Active" value={active} icon={<CircleCheck />} tone="good" sub={total ? `${Math.round((active / total) * 100)}% of all` : undefined} />
            <Stat label="Suspended" value={Math.max(total - active, 0)} icon={<Pause />} tone={total - active > 0 ? 'warn' : 'neutral'} />
            <Stat label="Modules available" value={stats?.totalModules ?? '—'} icon={<Puzzle />} tone="info" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
            <Card>
              <CardHeader title="Newest companies" action={<Link href="/companies" className="text-[13px] font-medium text-brand hover:underline">All companies</Link>} />
              {companies.length === 0 ? (
                <EmptyState icon={<Building2 />} title="No companies yet" action={<Link href="/companies/create" className={buttonStyles()}><Plus className="size-4" aria-hidden />New company</Link>} />
              ) : (
                <ul className="divide-y divide-line">
                  {companies.map((c) => (
                    <li key={c.id}>
                      <Link href={`/companies/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle/70 sm:px-5">
                        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-subtle text-xs font-semibold text-ink-2">
                          {c.logoUrl ? <img src={c.logoUrl} alt="" className="size-full object-contain" /> : c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink">{c.name}</p>
                          <p className="truncate text-xs text-ink-3">{c.ceoName}, added {date(c.createdAt)}</p>
                        </div>
                        <Badge tone={c.plan === 'FREE' ? 'neutral' : 'brand'}>{String(c.plan).charAt(0) + String(c.plan).slice(1).toLowerCase()}</Badge>
                        <StatusBadge status={c.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Recent backups"
                description={failed ? `${failed} of the last ${backups.length} failed` : undefined}
                action={<Link href="/backup" className="text-[13px] font-medium text-brand hover:underline">All backups</Link>}
              />
              {backups.length === 0 ? (
                <EmptyState icon={<HardDrive />} title="No backups yet" />
              ) : (
                <ul className="divide-y divide-line">
                  {backups.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{b.company?.name || '—'}</p>
                        <p className="text-xs text-ink-3">{date(b.createdAt)}, {String(b.type || '').toLowerCase()}</p>
                      </div>
                      <Badge tone={b.status === 'FAILED' ? 'bad' : b.status === 'COMPLETED' || b.status === 'SUCCESS' ? 'good' : 'warn'}>
                        {b.status === 'FAILED' ? 'Failed' : b.status === 'COMPLETED' || b.status === 'SUCCESS' ? 'Done' : 'Running'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
