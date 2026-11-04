'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { BookUser, Printer } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Badge, Button, Card, CardHeader, Field, Select, Spinner, Stat, Table, TableWrap, Th, Td, Tr, EmptyState } from '@/components/ui'
import { DateRangeBar, presetRange, type Range } from './ReportBits'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, date } from '@/lib/format'

type Kind = 'customer' | 'supplier'

const TEXT = {
  customer: {
    title: 'Customer ledger', subtitle: 'Every invoice, payment and return for one customer',
    list: '/erp/reports/customers-list', endpoint: '/erp/reports/customer-ledger', idParam: 'customerId', key: 'customer',
    debit: 'Invoiced', credit: 'Received', owes: (b: number) => (b > 0 ? 'Owes you' : b < 0 ? 'Has credit with you' : 'Nothing owed'),
  },
  supplier: {
    title: 'Supplier ledger', subtitle: 'Every purchase, payment and return for one supplier',
    list: '/erp/reports/suppliers-list', endpoint: '/erp/reports/supplier-ledger', idParam: 'supplierId', key: 'supplier',
    debit: 'Paid', credit: 'Purchased', owes: (b: number) => (b > 0 ? 'You owe' : b < 0 ? 'Owes you (advance)' : 'Nothing owed'),
  },
}

const TYPE_LABEL: Record<string, string> = {
  INVOICE: 'Invoice', RECEIPT: 'Payment received', REFUND: 'Refund', RETURN: 'Return', PURCHASE: 'Purchase', PAYMENT: 'Payment made',
}

export default function PartyLedgerReport({ kind }: { kind: Kind }) {
  const t = TEXT[kind]
  const [people, setPeople] = useState<any[]>([])
  const [partyId, setPartyId] = useState('')
  const [range, setRange] = useState<Range>(() => presetRange('year'))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    tenantApi
      .get(t.list)
      .then((r) => {
        const list = r.data.data || []
        setPeople(list)
        // Opened from a customer / supplier page: ?id=...
        const id = new URLSearchParams(window.location.search).get('id')
        if (id && list.some((p: any) => p.id === id)) {
          setPartyId(id)
          load(id, range)
        }
      })
      .catch((err) => toast.error(apiError(err, 'Could not load the list.')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.list])

  async function load(id: string, r: Range) {
    if (!id) return
    setLoading(true)
    try {
      const res = await tenantApi.get(`${t.endpoint}?${t.idParam}=${id}&from=${r.from}&to=${r.to}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load the ledger.'))
    } finally {
      setLoading(false)
    }
  }

  const party = data?.[t.key]
  const entries: any[] = data?.entries || []
  const closing = Number(data?.closingBalance || 0)

  return (
    <TenantLayout
      title={t.title}
      subtitle={t.subtitle}
      requiredModule="reports"
      headerRight={
        <>
          <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()} disabled={!data}>Print</Button>
          <ExportButton
            data={entries}
            filename={`${kind}-ledger-${party?.name || ''}`.replace(/\s+/g, '-').toLowerCase()}
            title={`${t.title}: ${party?.name || ''}`}
            subtitle={`${date(range.from)} to ${date(range.to)}. Opening ${money(data?.openingBalance)}, closing ${money(closing)}`}
            disabled={!data}
            columns={[
              { header: 'Date', value: (r: any) => date(r.date), width: 14 },
              { header: 'Type', value: (r: any) => TYPE_LABEL[r.type] || r.type, width: 16 },
              { header: 'Reference', value: (r: any) => r.reference || '', width: 16 },
              { header: t.debit, value: (r: any) => Number(r.debit || 0).toFixed(2), width: 14 },
              { header: t.credit, value: (r: any) => Number(r.credit || 0).toFixed(2), width: 14 },
              { header: 'Balance', value: (r: any) => Number(r.runningBalance || 0).toFixed(2), width: 16 },
            ]}
          />
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <DateRangeBar initial={range} onApply={(r) => { setRange(r); load(partyId, r) }}>
          <Field label={kind === 'customer' ? 'Customer' : 'Supplier'} className="min-w-56 sm:w-72">
            {(id) => (
              <Select id={id} value={partyId} onChange={(e) => { setPartyId(e.target.value); load(e.target.value, range) }}>
                <option value="">Choose {kind}</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.phone ? ` (${p.phone})` : ''}</option>)}
              </Select>
            )}
          </Field>
        </DateRangeBar>

        {!partyId ? (
          <Card><EmptyState icon={<BookUser />} title={`Choose a ${kind}`} description="Their full history with you will show here." /></Card>
        ) : loading && !data ? (
          <Spinner label="Loading ledger" />
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Opening balance" value={money(data.openingBalance)} sub={`On ${date(range.from)}`} />
              <Stat label={kind === 'customer' ? t.debit : t.credit} value={money(kind === 'customer' ? data.totalDebit : data.totalCredit)} sub="In these dates" />
              <Stat label={kind === 'customer' ? t.credit : t.debit} value={money(kind === 'customer' ? data.totalCredit : data.totalDebit)} sub="In these dates" />
              <Stat label={t.owes(closing)} value={<span className={closing > 0 ? 'text-warn' : closing < 0 ? 'text-good' : ''}>{money(Math.abs(closing))}</span>} sub={`On ${date(range.to)}`} />
            </div>
            <Card>
              <CardHeader title={party?.name || ''} description={[party?.phone, party?.email].filter(Boolean).join(', ') || undefined} />
              {entries.length === 0 ? (
                <EmptyState icon={<BookUser />} title="Nothing in these dates" description="Try a wider date range." />
              ) : (
                <TableWrap>
                  <Table className="min-w-[620px]">
                    <thead>
                      <tr>
                        <Th>Date</Th>
                        <Th>Details</Th>
                        <Th align="right">{kind === 'customer' ? t.debit : t.credit}</Th>
                        <Th align="right">{kind === 'customer' ? t.credit : t.debit}</Th>
                        <Th align="right">Balance</Th>
                      </tr>
                    </thead>
                    <tbody>
                      <Tr className="bg-subtle/60">
                        <Td className="text-ink-3">{date(range.from)}</Td>
                        <Td className="text-ink-2">Opening balance</Td>
                        <Td />
                        <Td />
                        <Td align="right" className="font-medium">{money(data.openingBalance)}</Td>
                      </Tr>
                      {entries.map((e, i) => {
                        const up = kind === 'customer' ? e.debit : e.credit
                        const down = kind === 'customer' ? e.credit : e.debit
                        return (
                          <Tr key={i}>
                            <Td className="whitespace-nowrap text-ink-2">{date(e.date)}</Td>
                            <Td>
                              <p className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{e.reference || TYPE_LABEL[e.type]}</span>
                                <Badge tone={e.type === 'RETURN' ? 'warn' : e.type === 'RECEIPT' || e.type === 'PAYMENT' ? 'good' : 'neutral'}>{TYPE_LABEL[e.type] || e.type}</Badge>
                              </p>
                              {e.details && e.details !== TYPE_LABEL[e.type] && <p className="mt-0.5 text-xs text-ink-3">{e.details}</p>}
                            </Td>
                            <Td align="right">{up ? money(up) : ''}</Td>
                            <Td align="right">{down ? money(down) : ''}</Td>
                            <Td align="right" className="font-medium">{money(e.runningBalance)}</Td>
                          </Tr>
                        )
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Card>
          </>
        ) : null}
      </div>
    </TenantLayout>
  )
}
