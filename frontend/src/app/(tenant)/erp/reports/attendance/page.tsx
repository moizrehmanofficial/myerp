'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarCheck } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Card, Field, Select, Spinner, Stat, Table, TableWrap, Th, Td, Tr, EmptyState } from '@/components/ui'
import { MONTHS, MonthBar } from '@/components/reports/ReportBits'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { cn } from '@/utils/utils'

// Present days (half days count half) out of the days that were marked
function rate(e: any) {
  const marked = e.present + e.absent + e.halfDay + e.onLeave
  return marked ? Math.round(((e.present + e.halfDay / 2) / marked) * 100) : null
}

export default function AttendanceReportPage() {
  const now = new Date()
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() })
  const [dept, setDept] = useState('')
  const [departments, setDepartments] = useState<string[]>([])
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (m: number, y: number, d: string) => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ month: String(m), year: String(y) })
      if (d) q.set('department', d)
      const res = await tenantApi.get(`/erp/reports/attendance?${q}`)
      setData(res.data.data)
      if (!d) setDepartments([...new Set<string>((res.data.data?.employees || []).map((e: any) => e.department).filter(Boolean))].sort())
    } catch (err) {
      toast.error(apiError(err, 'Could not load the attendance report.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(period.month, period.year, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows: any[] = data?.employees || []
  const sum = (k: string) => rows.reduce((s, e) => s + Number(e[k] || 0), 0)
  const label = `${MONTHS[period.month - 1]} ${period.year}`
  const overall = rate({ present: sum('present'), absent: sum('absent'), halfDay: sum('halfDay'), onLeave: sum('onLeave') })

  return (
    <TenantLayout
      title="Attendance report"
      subtitle="Days present, absent and on leave for each employee"
      requiredModule="reports"
      headerRight={
        <ExportButton
          data={rows}
          filename={`attendance-${period.year}-${period.month}`}
          title={`Attendance: ${label}`}
          disabled={!data}
          columns={[
            { header: 'Employee', value: (r: any) => r.name, width: 26 },
            { header: 'Code', value: (r: any) => r.employeeCode || '', width: 12 },
            { header: 'Department', value: (r: any) => r.department || '', width: 18 },
            { header: 'Present', value: (r: any) => r.present, width: 10 },
            { header: 'Half day', value: (r: any) => r.halfDay, width: 10 },
            { header: 'Leave', value: (r: any) => r.onLeave, width: 10 },
            { header: 'Absent', value: (r: any) => r.absent, width: 10 },
            { header: 'Attendance %', value: (r: any) => rate(r) ?? '', width: 14 },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <MonthBar month={period.month} year={period.year} onApply={(m, y) => { setPeriod({ month: m, year: y }); load(m, y, dept) }}>
          {departments.length > 0 && (
            <Field label="Department" className="w-48">
              {(id) => (
                <Select id={id} value={dept} onChange={(e) => { setDept(e.target.value); load(period.month, period.year, e.target.value) }}>
                  <option value="">All departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              )}
            </Field>
          )}
        </MonthBar>
        {loading && !data ? (
          <Spinner label="Loading attendance" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Employees" value={rows.length} sub={label} />
              <Stat label="Attendance" value={overall === null ? '—' : `${overall}%`} sub="Of the days marked" />
              <Stat label="Days absent" value={sum('absent')} />
              <Stat label="Days on leave" value={sum('onLeave')} />
            </div>
            <Card>
              {rows.length === 0 ? (
                <EmptyState icon={<CalendarCheck />} title="No active employees" />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Employee</Th>
                        <Th align="right">Present</Th>
                        <Th align="right" className="hidden sm:table-cell">Half day</Th>
                        <Th align="right" className="hidden sm:table-cell">Leave</Th>
                        <Th align="right">Absent</Th>
                        <Th className="w-44">Attendance</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((e) => {
                        const r = rate(e)
                        return (
                          <Tr key={e.id}>
                            <Td>
                              <p className="font-medium">{e.name}</p>
                              <p className="text-xs text-ink-3">{[e.employeeCode, e.department].filter(Boolean).join(', ')}</p>
                            </Td>
                            <Td align="right">{e.present}</Td>
                            <Td align="right" className="hidden sm:table-cell">{e.halfDay}</Td>
                            <Td align="right" className="hidden sm:table-cell">{e.onLeave}</Td>
                            <Td align="right" className={e.absent ? 'text-bad' : ''}>{e.absent}</Td>
                            <Td>
                              {r === null ? (
                                <span className="text-xs text-ink-3">Not marked</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
                                    <div className={cn('h-full rounded-full', r >= 90 ? 'bg-good' : r >= 75 ? 'bg-warn' : 'bg-bad')} style={{ width: `${r}%` }} />
                                  </div>
                                  <span className="num w-10 text-right text-xs font-medium text-ink-2">{r}%</span>
                                </div>
                              )}
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
