'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarCheck, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Button, Card, CardHeader, Input, Spinner, EmptyState, Tabs } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { isoDate, MONTHS } from '@/components/reports/ReportBits'
import { cn } from '@/utils/utils'

type Status = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'

const STATUSES: { key: Status; label: string; short: string; on: string; cell: string }[] = [
  { key: 'PRESENT', label: 'Present', short: 'P', on: 'border-good bg-good-soft text-good', cell: 'bg-good-soft text-good' },
  { key: 'HALF_DAY', label: 'Half day', short: 'H', on: 'border-warn bg-warn-soft text-warn', cell: 'bg-warn-soft text-warn' },
  { key: 'LEAVE', label: 'Leave', short: 'L', on: 'border-info bg-info-soft text-info', cell: 'bg-info-soft text-info' },
  { key: 'ABSENT', label: 'Absent', short: 'A', on: 'border-bad bg-bad-soft text-bad', cell: 'bg-bad-soft text-bad' },
]
const byKey = Object.fromEntries(STATUSES.map((s) => [s.key, s])) as Record<Status, (typeof STATUSES)[number]>

const dayOf = (v: unknown) => String(v || '').slice(0, 10)

export default function AttendancePage() {
  const { canWrite } = usePermission()
  const [day, setDay] = useState(() => isoDate(new Date()))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [marks, setMarks] = useState<Record<string, Status>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'day' | 'month'>('day')

  const [y, m] = day.split('-').map(Number)

  const load = useCallback(async (month: number, year: number) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/hr/attendance?month=${month}&year=${year}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load attendance.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(m, y)
  }, [load, m, y])

  // Marks already saved for the chosen day
  useEffect(() => {
    const map: Record<string, Status> = {}
    for (const r of data?.records || []) if (dayOf(r.date) === day) map[r.employeeId] = r.status
    setMarks(map)
    setDirty(false)
  }, [data, day])

  const employees: any[] = data?.summary || []
  const records: any[] = data?.records || []
  const counts = STATUSES.map((s) => ({ ...s, n: Object.values(marks).filter((v) => v === s.key).length }))
  const unmarked = employees.length - Object.keys(marks).length
  const today = isoDate(new Date())

  function shift(days: number) {
    const d = new Date(`${day}T12:00:00`)
    d.setDate(d.getDate() + days)
    const next = isoDate(d)
    if (next <= today) setDay(next)
  }

  function mark(id: string, s: Status) {
    setMarks((x) => ({ ...x, [id]: s }))
    setDirty(true)
  }

  async function save() {
    const list = Object.entries(marks).map(([employeeId, status]) => ({ employeeId, status }))
    if (!list.length) return toast.error('Mark at least one employee first.')
    setSaving(true)
    try {
      await tenantApi.post('/erp/hr/attendance/bulk', { date: day, records: list })
      toast.success(`Attendance saved for ${new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`)
      load(m, y)
    } catch (err) {
      toast.error(apiError(err, 'Could not save attendance.'))
    } finally {
      setSaving(false)
    }
  }

  // Month grid: employee → day → status
  const daysInMonth = new Date(y, m, 0).getDate()
  const grid = useMemo(() => {
    const g: Record<string, Record<number, Status>> = {}
    for (const r of records) {
      const d = Number(dayOf(r.date).slice(8, 10))
      ;(g[r.employeeId] ||= {})[d] = r.status
    }
    return g
  }, [records])

  const pretty = new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <TenantLayout
      title="Attendance"
      subtitle="Mark who came in each day"
      requiredModule="hr"
      headerRight={
        <ExportButton
          data={employees}
          filename={`attendance-${y}-${m}`}
          title={`Attendance: ${MONTHS[m - 1]} ${y}`}
          columns={[
            { header: 'Employee', value: (r: any) => r.name, width: 26 },
            { header: 'Code', value: (r: any) => r.employeeCode, width: 12 },
            { header: 'Present', value: (r: any) => r.present, width: 10 },
            { header: 'Half day', value: (r: any) => r.halfDay, width: 10 },
            { header: 'Leave', value: (r: any) => r.onLeave, width: 10 },
            { header: 'Absent', value: (r: any) => r.absent, width: 10 },
          ]}
        />
      }
    >
      <Card>
        <Tabs tabs={[{ key: 'day', label: 'Mark a day' }, { key: 'month', label: `${MONTHS[m - 1]} at a glance` }]} value={tab} onChange={setTab} />

        {/* Day picker */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
          <Button variant="secondary" size="sm" onClick={() => shift(-1)} aria-label="Previous day"><ChevronLeft className="size-4" /></Button>
          <Input type="date" aria-label="Date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} className="w-40" />
          <Button variant="secondary" size="sm" onClick={() => shift(1)} disabled={day >= today} aria-label="Next day"><ChevronRight className="size-4" /></Button>
          {day !== today && <Button variant="ghost" size="sm" onClick={() => setDay(today)}>Today</Button>}
          <p className="text-sm text-ink-2 sm:ml-2">{pretty}</p>
        </div>

        {loading && !data ? (
          <Spinner label="Loading attendance" />
        ) : employees.length === 0 ? (
          <EmptyState icon={<CalendarCheck />} title="No active employees" description="Add employees first, then mark their attendance here." />
        ) : tab === 'day' ? (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-subtle px-4 py-2.5 text-[13px] sm:px-5">
              {counts.map((c) => (
                <span key={c.key} className="flex items-center gap-1.5 text-ink-2">
                  <span className={cn('flex size-5 items-center justify-center rounded text-[11px] font-semibold', c.cell)}>{c.short}</span>
                  {c.label} <span className="num font-medium text-ink">{c.n}</span>
                </span>
              ))}
              {unmarked > 0 && <span className="text-ink-3">{unmarked} not marked</span>}
              {canWrite('hr') && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="sm:ml-auto"
                  icon={<CheckCheck className="size-4" />}
                  onClick={() => {
                    const all: Record<string, Status> = { ...marks }
                    for (const e of employees) if (!all[e.id]) all[e.id] = 'PRESENT'
                    setMarks(all)
                    setDirty(true)
                  }}
                >
                  Mark the rest present
                </Button>
              )}
            </div>
            <ul className="divide-y divide-line">
              {employees.map((e) => (
                <li key={e.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{e.name}</p>
                    <p className="num text-xs text-ink-3">{e.employeeCode}</p>
                  </div>
                  <div role="radiogroup" aria-label={`Attendance for ${e.name}`} className="grid grid-cols-4 gap-1.5 sm:flex">
                    {STATUSES.map((s) => {
                      const on = marks[e.id] === s.key
                      return (
                        <button
                          key={s.key}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={!canWrite('hr')}
                          onClick={() => mark(e.id, s.key)}
                          className={cn(
                            'h-8 rounded-[var(--radius-control)] border px-3 text-[13px] transition-colors disabled:cursor-not-allowed',
                            on ? `${s.on} font-medium` : 'border-line-strong text-ink-2 hover:bg-subtle',
                          )}
                        >
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
            {canWrite('hr') && (
              <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 sm:px-5">
                <p className="text-[13px] text-ink-3">{dirty ? 'You have unsaved changes.' : 'Saved marks show as selected.'}</p>
                <Button onClick={save} loading={saving} disabled={!dirty}>Save attendance</Button>
              </div>
            )}
          </>
        ) : (
          <>
            <CardHeader
              title={`${MONTHS[m - 1]} ${y}`}
              description="Each square is one day. Pick a date above to see another month."
              action={
                <div className="flex flex-wrap gap-3 text-xs text-ink-2">
                  {STATUSES.map((s) => (
                    <span key={s.key} className="flex items-center gap-1">
                      <span className={cn('flex size-4 items-center justify-center rounded-sm text-[10px] font-semibold', s.cell)}>{s.short}</span>
                      {s.label}
                    </span>
                  ))}
                </div>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 min-w-40 border-b border-line bg-subtle px-4 py-2 text-left text-[13px] font-semibold text-ink-2">Employee</th>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const wd = new Date(y, m - 1, i + 1).getDay()
                      return (
                        <th key={i} scope="col" className={cn('border-b border-line bg-subtle px-0.5 py-2 text-center font-medium', wd === 0 ? 'text-bad' : 'text-ink-3')}>
                          {i + 1}
                        </th>
                      )
                    })}
                    <th scope="col" className="border-b border-line bg-subtle px-3 py-2 text-right text-[13px] font-semibold text-ink-2">Present</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className="hover:bg-subtle/60">
                      <th scope="row" className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-2 text-left text-[13px] font-medium text-ink">{e.name}</th>
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const st = grid[e.id]?.[i + 1]
                        return (
                          <td key={i} className="border-b border-line px-0.5 py-1.5 text-center">
                            <span
                              title={st ? `${i + 1} ${MONTHS[m - 1]}: ${byKey[st]?.label}` : undefined}
                              className={cn('mx-auto flex size-6 items-center justify-center rounded-sm font-semibold', st ? byKey[st]?.cell : 'bg-subtle text-transparent')}
                            >
                              {st ? byKey[st]?.short : '·'}
                            </span>
                          </td>
                        )
                      })}
                      <td className="num border-b border-line px-3 py-2 text-right text-[13px] font-medium">{e.present + e.halfDay / 2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </TenantLayout>
  )
}
