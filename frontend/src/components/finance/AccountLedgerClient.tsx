'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, BookOpen } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Badge, Button, Card, Field, Input, Table, TableWrap, Th, Td, Tr, Spinner, EmptyState, Stat, buttonStyles } from '@/components/ui'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, date } from '@/lib/format'
import { useCompanyHref } from '@/lib/useCompanyHref'
import { typeLabel, sourceLabel } from './accounting'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}

export default function AccountLedgerClient({ id }: { id: string }) {
  const href = useCompanyHref()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    return iso(new Date(d.getFullYear(), d.getMonth(), 1))
  })
  const [to, setTo] = useState(() => iso(new Date()))

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (f) q.set('from', f)
      if (t) q.set('to', `${t}T23:59:59`)
      const res = await tenantApi.get(`/erp/finance/accounts/${id}/ledger?${q}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load this ledger.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load(from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  function quick(kind: 'month' | 'last' | 'year' | 'all') {
    const d = new Date()
    let f = ''
    let t = iso(d)
    if (kind === 'month') f = iso(new Date(d.getFullYear(), d.getMonth(), 1))
    if (kind === 'last') {
      f = iso(new Date(d.getFullYear(), d.getMonth() - 1, 1))
      t = iso(new Date(d.getFullYear(), d.getMonth(), 0))
    }
    if (kind === 'year') f = iso(new Date(d.getFullYear(), 0, 1))
    setFrom(f)
    setTo(t)
    load(f, t)
  }

  const account = data?.account
  const entries: any[] = data?.entries || []
  const opening = Number(data?.openingBalance || 0)
  const closing = Number(data?.closingBalance ?? opening)
  const totalDr = entries.reduce((s, e) => s + Number(e.debit || 0), 0)
  const totalCr = entries.reduce((s, e) => s + Number(e.credit || 0), 0)

  return (
    <TenantLayout
      title={account ? `${account.code} ${account.name}` : 'Account ledger'}
      subtitle={account ? `${typeLabel(account.type)} account. Every entry posted to it, with the running balance.` : undefined}
      requiredModule="finance"
      headerRight={
        <>
          <Link href={href('/erp/finance/ledger')} className={buttonStyles({ variant: 'ghost' })}>
            <ArrowLeft className="size-4" aria-hidden />
            All accounts
          </Link>
          <ExportButton
            data={entries}
            filename={`ledger-${account?.code || id}`}
            title={account ? `Ledger: ${account.code} ${account.name}` : 'Ledger'}
            subtitle={`${from ? date(from) : 'Start'} to ${date(to)}. Opening ${money(opening)}, closing ${money(closing)}`}
            columns={[
              { header: 'Date', value: (r: any) => date(r.createdAt), width: 14 },
              { header: 'Entry', value: (r: any) => r.entryNumber, width: 14 },
              { header: 'Description', value: (r: any) => r.description || '', width: 34 },
              { header: 'Debit', value: (r: any) => Number(r.debit || 0).toFixed(2), width: 14 },
              { header: 'Credit', value: (r: any) => Number(r.credit || 0).toFixed(2), width: 14 },
              { header: 'Balance', value: (r: any) => Number(r.runningBalance || 0).toFixed(2), width: 16 },
            ]}
          />
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Card className="p-4 sm:p-5">
          <form
            className="flex flex-col gap-3 md:flex-row md:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              load(from, to)
            }}
          >
            <div className="grid grid-cols-2 gap-3 md:flex">
              <Field label="From">{(fid) => <Input id={fid} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
              <Field label="To">{(fid) => <Input id={fid} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
            </div>
            <Button type="submit" variant="secondary">Show</Button>
            <div className="flex flex-wrap gap-1 md:ml-auto">
              {([
                ['month', 'This month'],
                ['last', 'Last month'],
                ['year', 'This year'],
                ['all', 'All time'],
              ] as const).map(([k, l]) => (
                <Button key={k} size="sm" variant="ghost" onClick={() => quick(k)}>
                  {l}
                </Button>
              ))}
            </div>
          </form>
        </Card>

        {loading && !data ? (
          <Spinner label="Loading ledger" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Opening balance" value={money(opening)} sub={from ? `On ${date(from)}` : 'From the start'} />
              <Stat label="Debits" value={money(totalDr)} sub={plural(entries.filter((e) => Number(e.debit) > 0).length, 'entry', 'entries')} />
              <Stat label="Credits" value={money(totalCr)} sub={plural(entries.filter((e) => Number(e.credit) > 0).length, 'entry', 'entries')} />
              <Stat label="Closing balance" value={money(closing)} sub={`On ${date(to)}`} />
            </div>

            <Card>
              {entries.length === 0 ? (
                <EmptyState icon={<BookOpen />} title="No entries in these dates" description="Pick a wider date range, or All time." />
              ) : (
                <TableWrap>
                  <Table className="min-w-[640px]">
                    <thead>
                      <tr>
                        <Th>Date</Th>
                        <Th>Details</Th>
                        <Th align="right">Debit</Th>
                        <Th align="right">Credit</Th>
                        <Th align="right">Balance</Th>
                      </tr>
                    </thead>
                    <tbody>
                      <Tr className="bg-subtle/60">
                        <Td className="whitespace-nowrap text-ink-3">{from ? date(from) : '—'}</Td>
                        <Td className="text-ink-2">Opening balance</Td>
                        <Td />
                        <Td />
                        <Td align="right" className="font-medium">{money(opening)}</Td>
                      </Tr>
                      {entries.map((e, i) => (
                        <Tr key={`${e.id}-${i}`}>
                          <Td className="whitespace-nowrap text-ink-2">{date(e.createdAt)}</Td>
                          <Td>
                            <p className="font-medium">{e.description || 'Journal entry'}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                              <span className="num">{e.entryNumber}</span>
                              <Badge>{sourceLabel(e.sourceType)}</Badge>
                              {e.reference && <span>Ref {e.reference}</span>}
                            </p>
                          </Td>
                          <Td align="right">{Number(e.debit) > 0 ? money(e.debit) : ''}</Td>
                          <Td align="right">{Number(e.credit) > 0 ? money(e.credit) : ''}</Td>
                          <Td align="right" className="font-medium whitespace-nowrap">{money(e.runningBalance)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-subtle">
                        <td colSpan={2} className="px-4 py-3 text-sm font-semibold">Closing balance</td>
                        <td className="num px-4 py-3 text-right text-sm font-semibold">{money(totalDr)}</td>
                        <td className="num px-4 py-3 text-right text-sm font-semibold">{money(totalCr)}</td>
                        <td className="num px-4 py-3 text-right text-sm font-semibold">{money(closing)}</td>
                      </tr>
                    </tfoot>
                  </Table>
                </TableWrap>
              )}
            </Card>
          </>
        )}
      </div>
    </TenantLayout>
  )
}
