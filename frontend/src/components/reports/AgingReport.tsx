'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { HandCoins } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Badge, Card, Spinner, Table, TableWrap, Th, Td, Tr, EmptyState, Tabs } from '@/components/ui'
import { AsOfBar, isoDate } from './ReportBits'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, date } from '@/lib/format'
import { useCompanyHref } from '@/lib/useCompanyHref'
import { cn } from '@/utils/utils'

type Kind = 'ar' | 'ap'
type Bucket = 'all' | 'current' | 'days31_60' | 'days61_90' | 'over90'

const BUCKETS: { key: Exclude<Bucket, 'all'>; label: string; test: (d: number) => boolean; tone: string }[] = [
  { key: 'current', label: '0 to 30 days', test: (d) => d <= 30, tone: 'bg-good' },
  { key: 'days31_60', label: '31 to 60 days', test: (d) => d > 30 && d <= 60, tone: 'bg-warn/70' },
  { key: 'days61_90', label: '61 to 90 days', test: (d) => d > 60 && d <= 90, tone: 'bg-warn' },
  { key: 'over90', label: 'Over 90 days', test: (d) => d > 90, tone: 'bg-bad' },
]

const TEXT = {
  ar: {
    title: 'Receivables', subtitle: 'Money customers still owe you, and how long it has been waiting',
    endpoint: '/erp/reports/ar', listKey: 'invoices', party: 'Customer', partyKey: 'customerName', docKey: 'invoiceNumber', doc: 'Invoice',
    byParty: 'By customer', byDoc: 'By invoice', empty: 'No customer owes you money', link: (id: string) => `/erp/invoices/${id}`,
    note: 'Based on unpaid invoices. Money received is applied to the oldest invoice first.',
  },
  ap: {
    title: 'Payables', subtitle: 'Money you still owe suppliers, and how long it has been waiting',
    endpoint: '/erp/reports/ap', listKey: 'orders', party: 'Supplier', partyKey: 'supplierName', docKey: 'orderNumber', doc: 'Purchase',
    byParty: 'By supplier', byDoc: 'By purchase', empty: 'You do not owe any supplier', link: (id: string) => `/erp/purchase/orders/${id}`,
    note: 'Based on each supplier’s balance. Payments are matched to the oldest purchases first, so what is left belongs to the newest ones. “Opening balance” is anything not tied to a purchase order.',
  },
}

export default function AgingReport({ kind }: { kind: Kind }) {
  const t = TEXT[kind]
  const router = useRouter()
  const href = useCompanyHref()
  const [asOf, setAsOf] = useState(() => isoDate(new Date()))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [bucket, setBucket] = useState<Bucket>('all')
  const [view, setView] = useState<'party' | 'doc'>('party')

  const load = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`${t.endpoint}?asOf=${d}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, `Could not load ${t.title.toLowerCase()}.`))
    } finally {
      setLoading(false)
    }
  }, [t.endpoint, t.title])

  useEffect(() => {
    load(asOf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const all: any[] = data?.[t.listKey] || []
  const s = data?.summary || {}
  const rows = bucket === 'all' ? all : all.filter((r) => BUCKETS.find((b) => b.key === bucket)!.test(Number(r.ageDays)))
  const total = Number(s.total || 0)

  // One line per customer / supplier, split into age buckets
  const parties = useMemo(() => {
    const map = new Map<string, any>()
    for (const r of rows) {
      const name = r[t.partyKey] || '—'
      const p = map.get(name) || { name, phone: r.customerPhone || r.supplierPhone, total: 0, oldest: 0, current: 0, days31_60: 0, days61_90: 0, over90: 0 }
      const due = Number(r.dueAmount || 0)
      p.total += due
      p.oldest = Math.max(p.oldest, Number(r.ageDays))
      const b = BUCKETS.find((x) => x.test(Number(r.ageDays)))!
      p[b.key] += due
      map.set(name, p)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [rows, t.partyKey])

  const ageText = (d: number) => (d >= 999 ? 'Opening' : `${d} day${d === 1 ? '' : 's'}`)

  return (
    <TenantLayout
      title={t.title}
      subtitle={t.subtitle}
      requiredModule="reports"
      headerRight={
        <ExportButton
          data={view === 'party' ? parties : rows}
          filename={`${kind === 'ar' ? 'receivables' : 'payables'}-${asOf}`}
          title={t.title}
          subtitle={`As of ${date(asOf)}. Total ${money(total)}`}
          disabled={!data}
          columns={
            view === 'party'
              ? [
                  { header: t.party, value: (r: any) => r.name, width: 28 },
                  { header: '0-30', value: (r: any) => r.current.toFixed(2), width: 14 },
                  { header: '31-60', value: (r: any) => r.days31_60.toFixed(2), width: 14 },
                  { header: '61-90', value: (r: any) => r.days61_90.toFixed(2), width: 14 },
                  { header: '90+', value: (r: any) => r.over90.toFixed(2), width: 14 },
                  { header: 'Total', value: (r: any) => r.total.toFixed(2), width: 16 },
                ]
              : [
                  { header: t.doc, value: (r: any) => r[t.docKey] || 'Opening balance', width: 16 },
                  { header: t.party, value: (r: any) => r[t.partyKey], width: 26 },
                  { header: 'Date', value: (r: any) => date(r.createdAt), width: 14 },
                  { header: 'Age (days)', value: (r: any) => (r.ageDays >= 999 ? '' : r.ageDays), width: 10 },
                  { header: 'Due (PKR)', value: (r: any) => Number(r.dueAmount || 0).toFixed(2), width: 16 },
                ]
          }
        />
      }
    >
      <div className="flex flex-col gap-5">
        <AsOfBar initial={asOf} onApply={(d) => { setAsOf(d); load(d) }} />
        {loading && !data ? (
          <Spinner label={`Loading ${t.title.toLowerCase()}`} />
        ) : (
          <>
            {/* Total, split by age. Click a part to show only that. */}
            <Card className="p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-medium text-ink-2">{kind === 'ar' ? 'Customers owe you' : 'You owe suppliers'}</p>
                <p className="num text-2xl font-semibold text-ink">{money(total)}</p>
              </div>
              {total > 0 && (
                <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-subtle" aria-hidden>
                  {BUCKETS.map((b) => (
                    <div key={b.key} className={b.tone} style={{ width: `${(Number(s[b.key] || 0) / total) * 100}%` }} />
                  ))}
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {BUCKETS.map((b) => {
                  const active = bucket === b.key
                  return (
                    <button
                      key={b.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setBucket(active ? 'all' : b.key)}
                      className={cn(
                        'rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-colors',
                        active ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <span className="flex items-center gap-2 text-xs text-ink-2">
                        <span className={cn('size-2 rounded-full', b.tone)} aria-hidden />
                        {b.label}
                      </span>
                      <span className="num mt-1 block text-[15px] font-semibold text-ink">{money(s[b.key])}</span>
                    </button>
                  )
                })}
              </div>
            </Card>

            <Card>
              <Tabs
                tabs={[
                  { key: 'party', label: t.byParty, count: parties.length },
                  { key: 'doc', label: t.byDoc, count: rows.length },
                ]}
                value={view}
                onChange={setView}
              />
              {bucket !== 'all' && (
                <p className="border-b border-line bg-subtle px-4 py-2 text-[13px] text-ink-2 sm:px-5">
                  Showing only {BUCKETS.find((b) => b.key === bucket)!.label.toLowerCase()}.{' '}
                  <button type="button" className="font-medium text-brand hover:underline" onClick={() => setBucket('all')}>Show all</button>
                </p>
              )}
              {rows.length === 0 ? (
                <EmptyState icon={<HandCoins />} title={bucket === 'all' ? t.empty : 'Nothing in this age group'} />
              ) : view === 'party' ? (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>{t.party}</Th>
                        <Th align="right" className="hidden md:table-cell">0-30</Th>
                        <Th align="right" className="hidden md:table-cell">31-60</Th>
                        <Th align="right" className="hidden md:table-cell">61-90</Th>
                        <Th align="right" className="hidden md:table-cell">90+</Th>
                        <Th align="right">Total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {parties.map((p) => (
                        <Tr key={p.name}>
                          <Td>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-ink-3">{p.oldest >= 999 ? 'Includes an opening balance' : `Oldest ${ageText(p.oldest).toLowerCase()}`}</p>
                          </Td>
                          {BUCKETS.map((b) => (
                            <Td key={b.key} align="right" className={cn('hidden md:table-cell', p[b.key] ? (b.key === 'over90' ? 'text-bad' : '') : 'text-ink-3')}>
                              {p[b.key] ? money(p[b.key]) : '—'}
                            </Td>
                          ))}
                          <Td align="right" className="font-semibold">{money(p.total)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>{t.doc}</Th>
                        <Th className="hidden sm:table-cell">{t.party}</Th>
                        <Th align="right" className="hidden md:table-cell">Total</Th>
                        <Th>Age</Th>
                        <Th align="right">Due</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const age = Number(r.ageDays)
                        const real = !!r[t.docKey]
                        return (
                          <Tr key={r.id} onClick={real ? () => router.push(href(t.link(r.id))) : undefined}>
                            <Td>
                              <p className="font-medium">{r[t.docKey] || 'Opening balance'}</p>
                              <p className="text-xs text-ink-3"><span className="sm:hidden">{r[t.partyKey]}, </span>{r.createdAt ? date(r.createdAt) : 'Not tied to a purchase'}</p>
                            </Td>
                            <Td className="hidden sm:table-cell">{r[t.partyKey]}</Td>
                            <Td align="right" className="hidden text-ink-2 md:table-cell">{money(r.totalAmount)}</Td>
                            <Td>
                              <Badge tone={age > 90 ? 'bad' : age > 30 ? 'warn' : 'neutral'}>{ageText(age)}</Badge>
                            </Td>
                            <Td align="right" className="font-semibold">{money(r.dueAmount)}</Td>
                          </Tr>
                        )
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Card>
            <p className="text-[13px] text-ink-3">{t.note}</p>
          </>
        )}
      </div>
    </TenantLayout>
  )
}
