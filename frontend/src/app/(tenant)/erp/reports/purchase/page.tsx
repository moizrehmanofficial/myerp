'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ShoppingCart } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Card, CardHeader, Spinner, Stat, Table, TableWrap, Th, Td, Tr, EmptyState } from '@/components/ui'
import { BarChart, DateRangeBar, dayLabel, presetRange, type Range } from '@/components/reports/ReportBits'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, number, date } from '@/lib/format'

export default function PurchaseReportPage() {
  const [range, setRange] = useState<Range>(() => presetRange('month'))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (r: Range) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/reports/purchase?from=${r.from}&to=${r.to}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load the purchase report.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = data?.summary || {}
  const rows: any[] = data?.bySupplier || []
  const daily = (data?.dailyPurchases || []).map((x: any) => ({ label: dayLabel(x.date), value: Number(x.total), title: `${date(x.date)}: ${money(x.total)} in ${x.count} order${x.count === 1 ? '' : 's'}` }))
  const avg = Number(s.totalOrders) ? Number(s.totalPurchases) / Number(s.totalOrders) : 0

  return (
    <TenantLayout
      title="Purchase report"
      subtitle="Purchase orders placed and the suppliers you buy from most"
      requiredModule="reports"
      headerRight={
        <ExportButton
          data={rows}
          filename={`purchases-${range.from}-${range.to}`}
          title="Purchases by supplier"
          subtitle={`${date(range.from)} to ${date(range.to)}. Total ${money(s.totalPurchases)}`}
          disabled={!data}
          columns={[
            { header: 'Supplier', value: (r: any) => r.name, width: 30 },
            { header: 'Orders', value: (r: any) => r.orderCount, width: 10 },
            { header: 'Amount (PKR)', value: (r: any) => Number(r.totalSpent || 0).toFixed(2), width: 18 },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <DateRangeBar initial={range} onApply={(r) => { setRange(r); load(r) }} />
        {loading && !data ? (
          <Spinner label="Loading purchases" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Stat label="Purchase orders" value={number(s.totalOrders)} sub="Cancelled orders not counted" />
              <Stat label="Total ordered" value={money(s.totalPurchases)} />
              <Stat label="Average order" value={money(avg)} className="col-span-2 lg:col-span-1" />
            </div>
            <Card>
              <CardHeader title="Purchases by day" />
              <BarChart data={daily} label="Purchases by day" empty="No purchase orders in these dates." />
            </Card>
            <Card>
              <CardHeader title="By supplier" description="Top 10 by amount" />
              {rows.length === 0 ? (
                <EmptyState icon={<ShoppingCart />} title="No purchases in these dates" />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Supplier</Th>
                        <Th align="right">Orders</Th>
                        <Th align="right">Amount</Th>
                        <Th align="right" className="hidden sm:table-cell">Share</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const share = Number(s.totalPurchases) ? (Number(r.totalSpent) / Number(s.totalPurchases)) * 100 : 0
                        return (
                          <Tr key={i}>
                            <Td>
                              <p className="font-medium">{r.name}</p>
                              {r.phone && <p className="text-xs text-ink-3">{r.phone}</p>}
                            </Td>
                            <Td align="right">{number(r.orderCount)}</Td>
                            <Td align="right" className="font-medium">{money(r.totalSpent)}</Td>
                            <Td align="right" className="hidden sm:table-cell">
                              <div className="ml-auto flex w-36 items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
                                  <div className="h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                                </div>
                                <span className="w-11 text-xs text-ink-3">{share.toFixed(0)}%</span>
                              </div>
                            </Td>
                          </Tr>
                        )
                      })}
                    </tbody>
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
