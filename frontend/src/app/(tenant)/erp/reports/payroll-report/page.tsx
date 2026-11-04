'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Wallet } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Card, Spinner, Stat, Table, TableWrap, Th, Td, Tr, EmptyState, StatusBadge } from '@/components/ui'
import { MONTHS, MonthBar } from '@/components/reports/ReportBits'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money } from '@/lib/format'

export default function PayrollReportPage() {
  const now = new Date()
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() })
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (m: number, y: number) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/reports/payroll-report?month=${m}&year=${y}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load the payroll report.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(period.month, period.year)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows: any[] = data?.payrolls || []
  const s = data?.summary || {}
  const label = `${MONTHS[period.month - 1]} ${period.year}`

  return (
    <TenantLayout
      title="Payroll report"
      subtitle="Salaries for a month: earnings, deductions and what was paid"
      requiredModule="reports"
      headerRight={
        <ExportButton
          data={rows}
          filename={`payroll-${period.year}-${period.month}`}
          title={`Payroll: ${label}`}
          subtitle={`Net pay ${money(s.totalNet)}`}
          disabled={!data}
          columns={[
            { header: 'Employee', value: (r: any) => r.employeeName, width: 24 },
            { header: 'Code', value: (r: any) => r.employeeCode || '', width: 10 },
            { header: 'Department', value: (r: any) => r.department || '', width: 16 },
            { header: 'Basic', value: (r: any) => Number(r.basicSalary || 0).toFixed(2), width: 12 },
            { header: 'Allowances', value: (r: any) => Number(r.allowances || 0).toFixed(2), width: 12 },
            { header: 'Deductions', value: (r: any) => Number(r.deductions || 0).toFixed(2), width: 12 },
            { header: 'Tax', value: (r: any) => Number(r.tax || 0).toFixed(2), width: 10 },
            { header: 'Net pay', value: (r: any) => Number(r.netSalary || 0).toFixed(2), width: 14 },
            { header: 'Status', value: (r: any) => r.status, width: 10 },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <MonthBar month={period.month} year={period.year} onApply={(m, y) => { setPeriod({ month: m, year: y }); load(m, y) }} />
        {loading && !data ? (
          <Spinner label="Loading payroll" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Employees paid" value={`${s.paidCount || 0} of ${s.totalEmployees || 0}`} sub={`${s.pendingCount || 0} still pending`} />
              <Stat label="Gross pay" value={money(Number(s.totalBasic || 0) + Number(s.totalAllowances || 0))} sub="Basic plus allowances" />
              <Stat label="Deductions and tax" value={money(Number(s.totalDeductions || 0) + Number(s.totalTax || 0))} />
              <Stat label="Net pay" value={money(s.totalNet)} sub={label} />
            </div>
            <Card>
              {rows.length === 0 ? (
                <EmptyState icon={<Wallet />} title={`No payroll for ${label}`} description="Generate payroll from HR, Payroll." />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Employee</Th>
                        <Th align="right" className="hidden md:table-cell">Basic</Th>
                        <Th align="right" className="hidden lg:table-cell">Allowances</Th>
                        <Th align="right" className="hidden lg:table-cell">Deductions</Th>
                        <Th align="right" className="hidden lg:table-cell">Tax</Th>
                        <Th align="right">Net pay</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <Tr key={p.id}>
                          <Td>
                            <p className="font-medium">{p.employeeName}</p>
                            <p className="text-xs text-ink-3">{[p.employeeCode, p.designation || p.department].filter(Boolean).join(', ')}</p>
                          </Td>
                          <Td align="right" className="hidden md:table-cell">{money(p.basicSalary)}</Td>
                          <Td align="right" className="hidden text-ink-2 lg:table-cell">{money(p.allowances)}</Td>
                          <Td align="right" className="hidden text-ink-2 lg:table-cell">{money(p.deductions)}</Td>
                          <Td align="right" className="hidden text-ink-2 lg:table-cell">{money(p.tax)}</Td>
                          <Td align="right" className="font-semibold">{money(p.netSalary)}</Td>
                          <Td><StatusBadge status={p.status} /></Td>
                        </Tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-subtle">
                        <td className="px-4 py-3 text-sm font-semibold">Total</td>
                        <td className="num hidden px-4 py-3 text-right text-sm font-semibold md:table-cell">{money(s.totalBasic)}</td>
                        <td className="num hidden px-4 py-3 text-right text-sm font-semibold lg:table-cell">{money(s.totalAllowances)}</td>
                        <td className="num hidden px-4 py-3 text-right text-sm font-semibold lg:table-cell">{money(s.totalDeductions)}</td>
                        <td className="num hidden px-4 py-3 text-right text-sm font-semibold lg:table-cell">{money(s.totalTax)}</td>
                        <td className="num px-4 py-3 text-right text-sm font-semibold whitespace-nowrap">{money(s.totalNet)}</td>
                        <td />
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
