'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Receipt } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Card, CardHeader, Spinner, Stat, Table, TableWrap, Th, Td, Tr, EmptyState } from '@/components/ui'
import { BarChart, DateRangeBar, dayLabel, presetRange, type Range } from '@/components/reports/ReportBits'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, number, date } from '@/lib/format'

export default function SalesReportPage() {
  const [range, setRange] = useState<Range>(() => presetRange('month'))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (r: Range) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/reports/sales?from=${r.from}&to=${r.to}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load the sales report.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = data?.summary || {}
  const daily = (data?.dailySales || []).map((x: any) => ({ label: dayLabel(x.date), value: Number(x.total), title: `${date(x.date)}: ${money(x.total)} from ${x.count} invoice${x.count === 1 ? '' : 's'}` }))

  return (
    <TenantLayout
      title="Sales report"
      subtitle="Invoiced sales, money collected and best sellers"
      requiredModule="reports"
      headerRight={
        <ExportButton
          data={data?.topProducts || []}
          filename={`sales-${range.from}-${range.to}`}
          title="Sales report: best selling products"
          subtitle={`${date(range.from)} to ${date(range.to)}. Sales ${money(s.totalSales)}, collected ${money(s.totalCollected)}`}
          disabled={!data}
          columns={[
            { header: 'Product', value: (r: any) => r.name, width: 30 },
            { header: 'Code', value: (r: any) => r.sku || '', width: 14 },
            { header: 'Qty sold', value: (r: any) => r.totalQty, width: 12 },
            { header: 'Sales (PKR)', value: (r: any) => Number(r.totalRevenue || 0).toFixed(2), width: 18 },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <DateRangeBar initial={range} onApply={(r) => { setRange(r); load(r) }} />
        {loading && !data ? (
          <Spinner label="Loading sales" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Invoices" value={number(s.totalInvoices)} />
              <Stat label="Sales" value={money(s.totalSales)} />
              <Stat label="Collected" value={money(s.totalCollected)} />
              <Stat label="Still to collect" value={<span className={Number(s.totalDue) > 0 ? 'text-warn' : ''}>{money(s.totalDue)}</span>} />
            </div>
            <Card>
              <CardHeader title="Sales by day" />
              <BarChart data={daily} label="Sales by day" empty="No invoices in these dates." />
            </Card>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:items-start">
              <RankTable
                title="Best selling products"
                rows={data?.topProducts || []}
                cols={['Product', 'Qty', 'Sales']}
                render={(r: any) => [<><p className="font-medium">{r.name}</p><p className="text-xs text-ink-3">{r.sku}</p></>, number(r.totalQty), money(r.totalRevenue)]}
              />
              <RankTable
                title="Top customers"
                rows={data?.topCustomers || []}
                cols={['Customer', 'Invoices', 'Bought']}
                render={(r: any) => [<><p className="font-medium">{r.name}</p>{r.phone && <p className="text-xs text-ink-3">{r.phone}</p>}</>, number(r.orderCount), money(r.totalSpent)]}
              />
            </div>
          </>
        )}
      </div>
    </TenantLayout>
  )
}

function RankTable({ title, rows, cols, render }: { title: string; rows: any[]; cols: [string, string, string]; render: (r: any) => React.ReactNode[] }) {
  return (
    <Card>
      <CardHeader title={title} />
      {rows.length === 0 ? (
        <EmptyState icon={<Receipt />} title="Nothing yet" description="Nothing was sold in these dates." />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th className="w-10">#</Th>
                <Th>{cols[0]}</Th>
                <Th align="right">{cols[1]}</Th>
                <Th align="right">{cols[2]}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const [a, b, c] = render(r)
                return (
                  <Tr key={i}>
                    <Td className="num text-ink-3">{i + 1}</Td>
                    <Td>{a}</Td>
                    <Td align="right">{b}</Td>
                    <Td align="right" className="font-medium">{c}</Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </Card>
  )
}
