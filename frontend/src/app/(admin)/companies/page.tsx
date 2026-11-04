'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Building2, Pause, Play, Plus } from 'lucide-react'
import api from '@/lib/axios'
import AdminLayout from '@/components/layout/AdminLayout'
import Pagination from '@/components/common/Pagination'
import { Badge, Card, Spinner, Table, TableWrap, Th, Td, Tr, EmptyState, ListToolbar, SearchInput, FilterChips, IconAction, StatusBadge, buttonStyles, useConfirm } from '@/components/ui'
import { PLANS } from '@/components/admin/CompanyForm'
import { apiError } from '@/lib/tenantApi'
import { date } from '@/lib/format'

type Filter = 'ALL' | 'ACTIVE' | 'SUSPENDED'

export default function CompaniesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [confirm, confirmDialog] = useConfirm()

  const load = useCallback(async (p: number, l: number) => {
    setLoading(true)
    try {
      const res = await api.get(`/companies?page=${p}&limit=${l}`)
      setRows(res.data.data || [])
      setMeta(res.data.meta)
    } catch (err) {
      toast.error(apiError(err, 'Could not load companies.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page, limit)
  }, [load, page, limit])

  const shown = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter((c) => {
      if (filter !== 'ALL' && c.status !== filter) return false
      return !q || [c.name, c.slug, c.ceoName, c.ceoEmail].some((x) => String(x || '').toLowerCase().includes(q))
    })
  }, [rows, search, filter])

  async function toggle(c: any) {
    const suspend = c.status === 'ACTIVE'
    if (suspend) {
      const ok = await confirm({ title: `Suspend ${c.name}?`, message: 'Nobody in this company can sign in until you activate it again.', confirmLabel: 'Suspend', danger: true })
      if (!ok) return
    }
    try {
      await api.patch(`/companies/${c.id}/${suspend ? 'suspend' : 'activate'}`)
      toast.success(suspend ? `${c.name} suspended` : `${c.name} is active again`)
      load(page, limit)
    } catch (err) {
      toast.error(apiError(err, 'Could not change the status.'))
    }
  }

  return (
    <AdminLayout
      title="Companies"
      subtitle="Every business using MyERP"
      headerRight={<Link href="/companies/create" className={buttonStyles()}><Plus className="size-4" aria-hidden />New company</Link>}
    >
      <Card>
        <ListToolbar>
          <SearchInput placeholder="Search name, subdomain or owner" onSearch={setSearch} />
          <FilterChips<Filter>
            options={[
              { key: 'ALL', label: 'All', count: rows.length },
              { key: 'ACTIVE', label: 'Active', count: rows.filter((c) => c.status === 'ACTIVE').length },
              { key: 'SUSPENDED', label: 'Suspended', count: rows.filter((c) => c.status === 'SUSPENDED').length },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </ListToolbar>
        {loading ? (
          <Spinner label="Loading companies" />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title={rows.length ? 'No companies match' : 'No companies yet'}
            description={rows.length ? undefined : 'Create the first company. It gets its own database and owner login.'}
            action={!rows.length ? <Link href="/companies/create" className={buttonStyles()}><Plus className="size-4" aria-hidden />New company</Link> : undefined}
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Company</Th>
                    <Th className="hidden md:table-cell">Owner</Th>
                    <Th className="hidden sm:table-cell">Plan</Th>
                    <Th align="right" className="hidden lg:table-cell">Modules</Th>
                    <Th>Status</Th>
                    <Th className="hidden xl:table-cell">Created</Th>
                    <Th align="right"><span className="sr-only">Actions</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <Tr key={c.id} onClick={() => router.push(`/companies/${c.id}`)}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-subtle text-xs font-semibold text-ink-2">
                            {c.logoUrl ? <img src={c.logoUrl} alt="" className="size-full object-contain" /> : c.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{c.name}</p>
                            <p className="num truncate text-xs text-ink-3">{c.slug}</p>
                          </div>
                        </div>
                      </Td>
                      <Td className="hidden md:table-cell">
                        <p>{c.ceoName}</p>
                        <p className="text-xs text-ink-3">{c.ceoEmail}</p>
                      </Td>
                      <Td className="hidden sm:table-cell"><Badge tone={c.plan === 'FREE' ? 'neutral' : 'brand'}>{PLANS.find((p) => p.key === c.plan)?.label || c.plan}</Badge></Td>
                      <Td align="right" className="hidden lg:table-cell">{c._count?.modules ?? (c.modules || []).length}</Td>
                      <Td><StatusBadge status={c.status} /></Td>
                      <Td className="hidden text-ink-2 xl:table-cell">{date(c.createdAt)}</Td>
                      <Td align="right">
                        <IconAction label={c.status === 'ACTIVE' ? `Suspend ${c.name}` : `Activate ${c.name}`} onClick={() => toggle(c)} danger={c.status === 'ACTIVE'}>
                          {c.status === 'ACTIVE' ? <Pause /> : <Play />}
                        </IconAction>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            {meta && <Pagination page={page} totalPages={meta.totalPages || 1} total={meta.total || 0} limit={limit} onPageChange={setPage} onLimitChange={(l) => { setPage(1); setLimit(l) }} />}
          </>
        )}
      </Card>
      {confirmDialog}
    </AdminLayout>
  )
}
