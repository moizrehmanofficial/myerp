'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Printer } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Button, Card, CardHeader, Spinner, Stat } from '@/components/ui'
import { DateRangeBar, StatementRow, StatementSection, presetRange, type Range } from '@/components/reports/ReportBits'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, date } from '@/lib/format'

const pct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`

export default function ProfitLossPage() {
  const [range, setRange] = useState<Range>(() => presetRange('month'))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (r: Range) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/reports/profit-loss?from=${r.from}&to=${r.to}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load the profit and loss report.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const d = data || {}
  const net = Number(d.netProfit || 0)
  const period = `${date(range.from)} to ${date(range.to)}`
  const exportRows = [
    ...(d.incomeAccounts || []).map((a: any) => ({ section: 'Income', ...a })),
    { section: 'Cost of goods sold', code: '5000', name: 'Cost of goods sold', amount: d.totalCOGS || 0 },
    { section: 'Gross profit', code: '', name: 'Gross profit', amount: d.grossProfit || 0 },
    ...(d.expenseAccounts || []).map((a: any) => ({ section: 'Expenses', ...a })),
    { section: 'Net profit', code: '', name: 'Net profit', amount: net },
  ]

  return (
    <TenantLayout
      title="Profit & loss"
      subtitle="What you earned, what it cost, and what is left"
      requiredModule="reports"
      headerRight={
        <>
          <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print</Button>
          <ExportButton
            data={exportRows}
            filename={`profit-loss-${range.from}-${range.to}`}
            title="Profit & loss"
            subtitle={period}
            disabled={!data}
            columns={[
              { header: 'Section', value: (r: any) => r.section, width: 20 },
              { header: 'Account', value: (r: any) => `${r.code ? r.code + ' ' : ''}${r.name}`, width: 32 },
              { header: 'Amount (PKR)', value: (r: any) => Number(r.amount || 0).toFixed(2), width: 18 },
            ]}
          />
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <DateRangeBar initial={range} onApply={(r) => { setRange(r); load(r) }} />

        {loading && !data ? (
          <Spinner label="Working out profit" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Sales" value={money(d.totalRevenue)} sub="Before sales tax" />
              <Stat label="Gross profit" value={money(d.grossProfit)} sub={`${pct(d.grossMargin)} of sales`} />
              <Stat label="Running costs" value={money(d.totalExpenses)} sub="Rent, salaries and other expenses" />
              <Stat
                label={net >= 0 ? 'Net profit' : 'Net loss'}
                value={<span className={net >= 0 ? 'text-good' : 'text-bad'}>{money(Math.abs(net))}</span>}
                sub={`${pct(d.netMargin)} of sales`}
              />
            </div>

            <Card className="mx-auto w-full max-w-3xl">
              <CardHeader title="Profit and loss statement" description={period} />
              <StatementSection title="Income">
                {(d.incomeAccounts || []).length === 0 && <p className="px-5 py-2 text-sm text-ink-3">No sales in these dates.</p>}
                {(d.incomeAccounts || []).map((a: any) => <StatementRow key={a.id} label={a.name} sub={a.code} value={a.amount} indent />)}
                <StatementRow label="Total income" value={d.totalRevenue || 0} strong />
              </StatementSection>
              <StatementSection title="Cost of goods sold">
                <StatementRow label="Purchase cost of the items sold" value={d.totalCOGS || 0} indent />
                <StatementRow label="Gross profit" value={d.grossProfit || 0} total />
              </StatementSection>
              <StatementSection title="Expenses">
                {(d.expenseAccounts || []).length === 0 && <p className="px-5 py-2 text-sm text-ink-3">No expenses posted in these dates.</p>}
                {(d.expenseAccounts || []).map((a: any) => <StatementRow key={a.id} label={a.name} sub={a.code} value={a.amount} indent />)}
                <StatementRow label="Total expenses" value={d.totalExpenses || 0} strong />
              </StatementSection>
              <StatementRow label={net >= 0 ? 'Net profit' : 'Net loss'} value={net} total tone={net >= 0 ? 'good' : 'bad'} />
            </Card>

            <p className="mx-auto max-w-3xl text-[13px] leading-relaxed text-ink-3">
              Figures come from the books: invoices, cost of goods sold, and every expense posted through payments or journal entries.
              Stock bought in these dates ({money(d.totalPurchases)}) is not an expense until it is sold, so it is not subtracted here.
            </p>
          </>
        )}
      </div>
    </TenantLayout>
  )
}
