'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Receipt } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Card, Spinner, Stat, Table, TableWrap, Th, Td, Tr, EmptyState, ListToolbar, FilterChips, StatusBadge } from '@/components/ui'
import { DateRangeBar, presetRange, type Range } from '@/components/reports/ReportBits'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, number, date } from '@/lib/format'
import { useCompanyHref } from '@/lib/useCompanyHref'

type Status = '' | 'PAID' | 'PARTIAL' | 'UNPAID'

export default function InvoiceReportPage() {
  const router = useRouter()
  const href = useCompanyHref()
  const [range, setRange] = useState<Range>(() => presetRange('month'))
  const [status, setStatus] = useState<Status>('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (r: Range, st: Status) => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ from: r.from, to: r.to })
      if (st) q.set('status', st)
      const res = await tenantApi.get(`/erp/reports/invoices?${q}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load the invoice report.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(range, status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = data?.summary || {}
  const rows: any[] = data?.invoices || []

  return (
    <TenantLayout
      title="Invoice report"
      subtitle="Every invoice in a period, and how much of it is paid"
      requiredModule="reports"
      headerRight={
        <ExportButton
          data={rows}
          filename={`invoices-${range.from}-${range.to}`}
          title="Invoice report"
          subtitle={`${date(range.from)} to ${date(range.to)}`}
          disabled={!data}
          columns={[
            { header: 'Invoice', value: (r: any) => r.invoiceNumber, width: 14 },
            { header: 'Customer', value: (r: any) => r.customerName || '', width: 26 },
            { header: 'Date', value: (r: any) => date(r.createdAt), width: 14 },
            { header: 'Total', value: (r: any) => Number(r.totalAmount || 0).toFixed(2), width: 14 },
            { header: 'Received', value: (r: any) => Number(r.paidAmount || 0).toFixed(2), width: 14 },
            { header: 'Due', value: (r: any) => Number(r.dueAmount || 0).toFixed(2), width: 14 },
            { header: 'Status', value: (r: any) => r.paymentStatus, width: 10 },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <DateRangeBar initial={range} onApply={(r) => { setRange(r); load(r, status) }} />
        {loading && !data ? (
          <Spinner label="Loading invoices" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Invoices" value={number(s.totalInvoices)} sub={`${s.paidCount || 0} paid, ${s.partialCount || 0} part paid, ${s.unpaidCount || 0} unpaid`} />
              <Stat label="Invoiced" value={money(s.totalAmount)} />
              <Stat label="Received" value={money(s.totalPaid)} />
              <Stat label="Still due" value={<span className={Number(s.totalDue) > 0 ? 'text-warn' : ''}>{money(s.totalDue)}</span>} />
            </div>
            <Card>
              <ListToolbar>
                <FilterChips<Status>
                  options={[
                    { key: '', label: 'All', count: s.totalInvoices },
                    { key: 'UNPAID', label: 'Unpaid', count: s.unpaidCount },
                    { key: 'PARTIAL', label: 'Part paid', count: s.partialCount },
                    { key: 'PAID', label: 'Paid', count: s.paidCount },
                  ]}
                  value={status}
                  onChange={(st) => { setStatus(st); load(range, st) }}
                />
              </ListToolbar>
              {rows.length === 0 ? (
                <EmptyState icon={<Receipt />} title="No invoices" description="Try other dates or another status." />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Invoice</Th>
                        <Th className="hidden sm:table-cell">Customer</Th>
                        <Th align="right">Total</Th>
                        <Th align="right" className="hidden lg:table-cell">Received</Th>
                        <Th align="right" className="hidden md:table-cell">Due</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <Tr key={r.id} onClick={() => router.push(href(`/erp/invoices/${r.id}`))}>
                          <Td>
                            <p className="font-medium">{r.invoiceNumber}</p>
                            <p className="text-xs text-ink-3"><span className="sm:hidden">{r.customerName}, </span>{date(r.createdAt)}</p>
                          </Td>
                          <Td className="hidden sm:table-cell">{r.customerName}</Td>
                          <Td align="right" className="font-medium">{money(r.totalAmount)}</Td>
                          <Td align="right" className="hidden text-ink-2 lg:table-cell">{money(r.paidAmount)}</Td>
                          <Td align="right" className={`hidden md:table-cell ${Number(r.dueAmount) > 0 ? 'font-medium text-warn' : 'text-ink-3'}`}>{money(r.dueAmount)}</Td>
                          <Td><StatusBadge status={r.paymentStatus} /></Td>
                        </Tr>
                      ))}
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
