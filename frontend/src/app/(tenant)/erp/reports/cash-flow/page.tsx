'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Printer } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Button, Card, CardHeader, Spinner, Stat, Table, TableWrap, Th, Td, Tr } from '@/components/ui'
import { DateRangeBar, StatementRow, StatementSection, dayLabel, presetRange, type Range } from '@/components/reports/ReportBits'
import { sourceLabel } from '@/components/finance/accounting'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, date } from '@/lib/format'

// Plain words for where cash came from or went
const IN_LABELS: Record<string, string> = {
  invoice: 'Cash sales',
  invoice_payment: 'Payments from customers',
  receipt: 'Other money received',
  opening_balance: 'Opening balances',
  purchase_return: 'Refunds from suppliers',
  manual: 'Journal entries',
}
const OUT_LABELS: Record<string, string> = {
  purchase: 'Paid for purchases',
  payment: 'Payments made',
  payroll: 'Salaries paid',
  sale_return: 'Refunds to customers',
  invoice_payment: 'Refunds to customers',
  invoice: 'Invoice reversals',
  opening_balance: 'Opening balances',
  manual: 'Journal entries',
}

export default function CashFlowPage() {
  const [range, setRange] = useState<Range>(() => presetRange('month'))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (r: Range) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/reports/cash-flow?from=${r.from}&to=${r.to}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load the cash flow report.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const d = data || {}
  const sources: any[] = d.sources || []
  const ins = sources.filter((s) => s.moneyIn > 0)
  const outs = sources.filter((s) => s.moneyOut > 0)
  const net = Number(d.net || 0)
  const period = `${date(range.from)} to ${date(range.to)}`

  const exportRows = [
    { section: 'Opening cash and bank', name: '', amount: d.opening || 0 },
    ...ins.map((s) => ({ section: 'Money in', name: IN_LABELS[s.sourceType] || sourceLabel(s.sourceType), amount: s.moneyIn })),
    ...outs.map((s) => ({ section: 'Money out', name: OUT_LABELS[s.sourceType] || sourceLabel(s.sourceType), amount: -s.moneyOut })),
    { section: 'Closing cash and bank', name: '', amount: d.closing || 0 },
  ]

  return (
    <TenantLayout
      title="Cash flow"
      subtitle="Money in and out of cash and bank"
      requiredModule="reports"
      headerRight={
        <>
          <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print</Button>
          <ExportButton
            data={exportRows}
            filename={`cash-flow-${range.from}-${range.to}`}
            title="Cash flow"
            subtitle={period}
            disabled={!data}
            columns={[
              { header: 'Section', value: (r: any) => r.section, width: 24 },
              { header: 'Item', value: (r: any) => r.name, width: 30 },
              { header: 'Amount (PKR)', value: (r: any) => Number(r.amount || 0).toFixed(2), width: 18 },
            ]}
          />
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <DateRangeBar initial={range} onApply={(r) => { setRange(r); load(r) }} />

        {loading && !data ? (
          <Spinner label="Adding up cash" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="At the start" value={money(d.opening)} sub={`Cash and bank on ${date(range.from)}`} />
              <Stat label="Money in" value={<span className="text-good">{money(d.totalIn)}</span>} />
              <Stat label="Money out" value={<span className="text-bad">{money(d.totalOut)}</span>} />
              <Stat label="At the end" value={money(d.closing)} sub={`${net >= 0 ? 'Up' : 'Down'} ${money(Math.abs(net))}`} />
            </div>

            <Card>
              <CardHeader title="Day by day" description="Green is money in, red is money out" />
              <InOutChart days={d.daily || []} />
            </Card>

            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:items-start">
              <Card className="overflow-hidden">
                <CardHeader title="Cash flow statement" description={period} />
                <StatementRow label="Cash and bank at the start" value={d.opening || 0} strong />
                <StatementSection title="Money in">
                  {ins.length === 0 && <p className="px-5 py-2 text-sm text-ink-3">No money came in during these dates.</p>}
                  {ins.map((s) => <StatementRow key={`i-${s.sourceType}`} label={IN_LABELS[s.sourceType] || sourceLabel(s.sourceType)} value={s.moneyIn} indent />)}
                  <StatementRow label="Total money in" value={d.totalIn || 0} strong />
                </StatementSection>
                <StatementSection title="Money out">
                  {outs.length === 0 && <p className="px-5 py-2 text-sm text-ink-3">No money went out during these dates.</p>}
                  {outs.map((s) => <StatementRow key={`o-${s.sourceType}`} label={OUT_LABELS[s.sourceType] || sourceLabel(s.sourceType)} value={s.moneyOut} indent />)}
                  <StatementRow label="Total money out" value={d.totalOut || 0} strong />
                </StatementSection>
                <StatementRow label="Cash and bank at the end" value={d.closing || 0} total tone={Number(d.closing) >= 0 ? undefined : 'bad'} />
              </Card>

              <Card>
                <CardHeader title="By account" />
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Account</Th>
                        <Th align="right" className="hidden sm:table-cell">Start</Th>
                        <Th align="right">In</Th>
                        <Th align="right">Out</Th>
                        <Th align="right">End</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {(d.accounts || []).map((a: any) => (
                        <Tr key={a.id}>
                          <Td>
                            <p className="font-medium">{a.name}</p>
                            <p className="text-xs text-ink-3">{a.code}</p>
                          </Td>
                          <Td align="right" className="hidden sm:table-cell">{money(a.opening)}</Td>
                          <Td align="right" className="text-good">{money(a.moneyIn)}</Td>
                          <Td align="right" className="text-bad">{money(a.moneyOut)}</Td>
                          <Td align="right" className="font-medium">{money(a.closing)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </Card>
            </div>

            <p className="max-w-3xl text-[13px] leading-relaxed text-ink-3">
              Built from the Cash in Hand and Bank Account entries in the books. Credit sales are not cash until the customer pays, and
              stock bought on credit is not cash out until you pay the supplier. Moving money between cash and bank does not count as in or out.
            </p>
          </>
        )}
      </div>
    </TenantLayout>
  )
}

function InOutChart({ days }: { days: { day: string; moneyIn: number; moneyOut: number }[] }) {
  if (!days.length) return <p className="px-5 py-12 text-center text-sm text-ink-3">No cash movement in these dates</p>
  const max = Math.max(...days.map((x) => Math.max(x.moneyIn, x.moneyOut)), 1)
  const every = Math.ceil(days.length / 10)
  return (
    <div className="px-4 pt-5 pb-4 sm:px-5">
      <div className="flex h-44 items-end gap-1 sm:gap-2" role="img" aria-label="Money in and out by day">
        {days.map((x) => (
          <div key={x.day} className="flex h-full min-w-0 flex-1 items-end gap-px" title={`${dayLabel(x.day)}: in ${money(x.moneyIn)}, out ${money(x.moneyOut)}`}>
            <div className="w-1/2 rounded-t-[2px] bg-good/80" style={{ height: `${Math.max((x.moneyIn / max) * 100, x.moneyIn > 0 ? 2 : 0)}%` }} />
            <div className="w-1/2 rounded-t-[2px] bg-bad/70" style={{ height: `${Math.max((x.moneyOut / max) * 100, x.moneyOut > 0 ? 2 : 0)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1 sm:gap-2">
        {days.map((x, i) => (
          <span key={x.day} className="min-w-0 flex-1 truncate text-center text-[11px] text-ink-3">{i % every === 0 ? dayLabel(x.day) : ''}</span>
        ))}
      </div>
    </div>
  )
}
