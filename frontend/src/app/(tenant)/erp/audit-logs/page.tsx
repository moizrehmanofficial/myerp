'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { History, Monitor, Smartphone } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import Pagination from '@/components/common/Pagination'
import { Badge, Button, Card, Field, Input, Select, Spinner, Table, TableWrap, Th, Td, Tr, EmptyState } from '@/components/ui'
import { tenantApi, apiError } from '@/lib/tenantApi'

const MODULES: [string, string][] = [
  ['auth', 'Sign in / out'], ['contacts', 'Customers & suppliers'], ['products', 'Products'], ['inventory', 'Stock'],
  ['purchase', 'Purchases'], ['sales', 'Sales'], ['invoices', 'Invoices'], ['finance', 'Accounts'], ['hr', 'HR'],
  ['payroll', 'Payroll'], ['manufacturing', 'Manufacturing'], ['users', 'Users & roles'], ['settings', 'Settings'],
]
const ACTIONS: [string, string, 'good' | 'info' | 'bad' | 'brand' | 'warn' | 'neutral'][] = [
  ['CREATED', 'Added', 'good'], ['UPDATED', 'Changed', 'info'], ['DELETED', 'Deleted', 'bad'], ['APPROVED', 'Approved', 'good'],
  ['LOGIN', 'Signed in', 'brand'], ['LOGOUT', 'Signed out', 'neutral'], ['LOGIN_FAILED', 'Failed sign-in', 'warn'], ['EXPORTED', 'Exported', 'neutral'],
]
const actionOf = (a: string) => ACTIONS.find((x) => x[0] === a)
const moduleLabel = (m: string) => MODULES.find((x) => x[0] === m)?.[1] || m

function when(v: string) {
  const d = new Date(v)
  if (isNaN(d.getTime())) return { day: '—', time: '' }
  return {
    day: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

const EMPTY = { module: '', action: '', from: '', to: '' }

export default function AuditLogsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [draft, setDraft] = useState(EMPTY)
  const [filters, setFilters] = useState(EMPTY)

  const load = useCallback(async (p: number, l: number, f: typeof EMPTY) => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: String(p), limit: String(l) })
      if (f.module) q.set('module', f.module)
      if (f.action) q.set('action', f.action)
      if (f.from) q.set('from', f.from)
      if (f.to) q.set('to', `${f.to}T23:59:59`)
      const res = await tenantApi.get(`/erp/audit-logs?${q}`)
      setRows(res.data.data || [])
      setMeta(res.data.meta)
    } catch (err) {
      toast.error(apiError(err, 'Could not load the activity log.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page, limit, filters)
  }, [load, page, limit, filters])

  const filtered = Object.values(filters).some(Boolean)

  return (
    <TenantLayout
      title="Activity log"
      subtitle="Who did what, and when"
      requiredModule="settings"
      headerRight={
        <ExportButton
          data={rows}
          filename="activity-log"
          title="Activity log"
          subtitle={new Date().toLocaleDateString('en-GB')}
          columns={[
            { header: 'Date', value: (r: any) => `${when(r.createdAt).day} ${when(r.createdAt).time}`, width: 18 },
            { header: 'User', value: (r: any) => r.details?.userName || '', width: 18 },
            { header: 'Action', value: (r: any) => actionOf(r.action)?.[1] || r.action, width: 14 },
            { header: 'Area', value: (r: any) => moduleLabel(r.module), width: 18 },
            { header: 'What happened', value: (r: any) => r.details?.description || '', width: 40 },
            { header: 'IP', value: (r: any) => r.ipAddress || '', width: 14 },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <Card className="p-4 sm:p-5">
          <form
            className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              setPage(1)
              setFilters(draft)
            }}
          >
            <Field label="Area" className="col-span-2 md:w-52">
              {(id) => (
                <Select id={id} value={draft.module} onChange={(e) => setDraft({ ...draft, module: e.target.value })}>
                  <option value="">Everything</option>
                  {MODULES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Action" className="col-span-2 md:w-44">
              {(id) => (
                <Select id={id} value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}>
                  <option value="">Any</option>
                  {ACTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              )}
            </Field>
            <Field label="From">{(id) => <Input id={id} type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />}</Field>
            <Field label="To">{(id) => <Input id={id} type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />}</Field>
            <div className="col-span-2 flex gap-2">
              <Button type="submit" variant="secondary">Show</Button>
              {filtered && <Button variant="ghost" onClick={() => { setDraft(EMPTY); setPage(1); setFilters(EMPTY) }}>Clear</Button>}
            </div>
          </form>
        </Card>

        <Card>
          {loading ? (
            <Spinner label="Loading activity" />
          ) : rows.length === 0 ? (
            <EmptyState icon={<History />} title={filtered ? 'Nothing matches these filters' : 'No activity yet'} />
          ) : (
            <>
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th className="w-32">When</Th>
                      <Th>What happened</Th>
                      <Th className="hidden md:table-cell">Who</Th>
                      <Th className="hidden lg:table-cell">Device</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const a = actionOf(r.action)
                      const w = when(r.createdAt)
                      const mobile = /android|iphone|ipad|mobile/i.test(`${r.device || ''}`)
                      return (
                        <Tr key={r.id}>
                          <Td className="align-top whitespace-nowrap">
                            <p className="text-ink">{w.day}</p>
                            <p className="num text-xs text-ink-3">{w.time}</p>
                          </Td>
                          <Td className="align-top">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge tone={a?.[2] || 'neutral'}>{a?.[1] || r.action}</Badge>
                              <span className="text-xs text-ink-3">{moduleLabel(r.module)}</span>
                            </div>
                            <p className="mt-1 text-ink">{r.details?.description || '—'}</p>
                            <p className="mt-0.5 text-xs text-ink-3 md:hidden">{r.details?.userName || 'Unknown user'}</p>
                          </Td>
                          <Td className="hidden align-top md:table-cell">{r.details?.userName || <span className="text-ink-3">Unknown</span>}</Td>
                          <Td className="hidden align-top lg:table-cell">
                            <p className="flex items-center gap-1.5 text-ink-2">
                              {mobile ? <Smartphone className="size-3.5 text-ink-3" aria-hidden /> : <Monitor className="size-3.5 text-ink-3" aria-hidden />}
                              {[r.browser, r.device].filter(Boolean).join(' on ') || '—'}
                            </p>
                            {r.ipAddress && <p className="num text-xs text-ink-3">{r.ipAddress}</p>}
                          </Td>
                        </Tr>
                      )
                    })}
                  </tbody>
                </Table>
              </TableWrap>
              {meta && <Pagination page={page} totalPages={meta.totalPages || 1} total={meta.total || 0} limit={limit} onPageChange={setPage} onLimitChange={(l) => { setPage(1); setLimit(l) }} />}
            </>
          )}
        </Card>
      </div>
    </TenantLayout>
  )
}
