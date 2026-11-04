'use client'

import { useState } from 'react'
import { Button, Card, Field, Input, Select } from '@/components/ui'
import { compact, money } from '@/lib/format'
import { cn } from '@/utils/utils'

// yyyy-mm-dd in the user's own time zone (toISOString would use UTC)
export function isoDate(d: Date) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}

export type Range = { from: string; to: string }

export function presetRange(kind: 'month' | 'last' | 'days30' | 'year' | 'all'): Range {
  const d = new Date()
  const today = isoDate(d)
  switch (kind) {
    case 'month':
      return { from: isoDate(new Date(d.getFullYear(), d.getMonth(), 1)), to: today }
    case 'last':
      return { from: isoDate(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: isoDate(new Date(d.getFullYear(), d.getMonth(), 0)) }
    case 'days30':
      return { from: isoDate(new Date(d.getTime() - 29 * 86400000)), to: today }
    case 'year':
      return { from: isoDate(new Date(d.getFullYear(), 0, 1)), to: today }
    case 'all':
      return { from: '2000-01-01', to: today }
  }
}

const PRESETS = [
  ['month', 'This month'],
  ['last', 'Last month'],
  ['days30', 'Last 30 days'],
  ['year', 'This year'],
] as const

// From / To dates with quick picks. Calls onApply when the user is done.
export function DateRangeBar({ initial, onApply, children }: { initial: Range; onApply: (r: Range) => void; children?: React.ReactNode }) {
  const [r, setR] = useState(initial)
  return (
    <Card className="p-4 sm:p-5 print:hidden">
      <form
        className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (r.from && r.to && r.from > r.to) return onApply({ from: r.to, to: r.from })
          onApply(r)
        }}
      >
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Field label="From">{(id) => <Input id={id} type="date" value={r.from} max={r.to || undefined} onChange={(e) => setR({ ...r, from: e.target.value })} />}</Field>
          <Field label="To">{(id) => <Input id={id} type="date" value={r.to} onChange={(e) => setR({ ...r, to: e.target.value })} />}</Field>
        </div>
        {children}
        <Button type="submit" variant="secondary">Show</Button>
        <div className="flex flex-wrap gap-1 lg:ml-auto">
          {PRESETS.map(([k, l]) => (
            <Button
              key={k}
              size="sm"
              variant="ghost"
              onClick={() => {
                const next = presetRange(k)
                setR(next)
                onApply(next)
              }}
            >
              {l}
            </Button>
          ))}
        </div>
      </form>
    </Card>
  )
}

// One date ("as of")
export function AsOfBar({ initial, onApply, label = 'As of', children }: { initial: string; onApply: (d: string) => void; label?: string; children?: React.ReactNode }) {
  const [d, setD] = useState(initial)
  return (
    <Card className="p-4 sm:p-5 print:hidden">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); onApply(d) }}>
        <Field label={label}>{(id) => <Input id={id} type="date" value={d} onChange={(e) => setD(e.target.value)} />}</Field>
        {children}
        <Button type="submit" variant="secondary">Show</Button>
        <Button size="sm" variant="ghost" onClick={() => { const t = isoDate(new Date()); setD(t); onApply(t) }}>Today</Button>
      </form>
    </Card>
  )
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Month + year
export function MonthBar({ month, year, onApply, children }: { month: number; year: number; onApply: (m: number, y: number) => void; children?: React.ReactNode }) {
  const [m, setM] = useState(month)
  const [y, setY] = useState(year)
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => thisYear - 4 + i)
  return (
    <Card className="p-4 sm:p-5 print:hidden">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); onApply(m, y) }}>
        <Field label="Month" className="w-40">
          {(id) => (
            <Select id={id} value={m} onChange={(e) => setM(+e.target.value)}>
              {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Year" className="w-28">
          {(id) => (
            <Select id={id} value={y} onChange={(e) => setY(+e.target.value)}>
              {years.map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          )}
        </Field>
        {children}
        <Button type="submit" variant="secondary">Show</Button>
      </form>
    </Card>
  )
}

// Bars over time, in plain HTML. Labels thin out when there are many bars.
export function BarChart({ data, label, empty = 'Nothing in these dates' }: { data: { label: string; value: number; title?: string }[]; label: string; empty?: string }) {
  if (!data.length) return <p className="px-5 py-12 text-center text-sm text-ink-3">{empty}</p>
  const max = Math.max(...data.map((d) => d.value), 1)
  const every = Math.ceil(data.length / 10)
  return (
    <div className="px-4 pt-5 pb-4 sm:px-5">
      <div className="flex h-44 items-end gap-[3px] sm:gap-1.5" role="img" aria-label={label}>
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t-[3px] bg-brand/80 transition-colors group-hover:bg-brand"
              style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0.5)}%` }}
              title={d.title || `${d.label}: ${money(d.value)}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px] border-t border-line pt-1.5 sm:gap-1.5">
        {data.map((d, i) => (
          <span key={i} className="min-w-0 flex-1 text-center text-[11px] whitespace-nowrap text-ink-3">
            {i % every === 0 ? d.label : ''}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-3">Highest: <span className="num font-medium text-ink-2">{money(max)}</span> ({compact(max)})</p>
    </div>
  )
}

// A line in a financial statement (P&L, balance sheet)
export function StatementRow({
  label,
  value,
  sub,
  strong,
  total,
  indent,
  tone,
}: {
  label: React.ReactNode
  value: number
  sub?: string
  strong?: boolean
  total?: boolean
  indent?: boolean
  tone?: 'good' | 'bad'
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 px-4 py-2.5 sm:px-5',
        total && 'border-t border-line bg-subtle',
        indent && 'pl-8 sm:pl-9',
      )}
    >
      <div className="min-w-0">
        <p className={cn('text-sm', strong || total ? 'font-semibold text-ink' : 'text-ink-2')}>{label}</p>
        {sub && <p className="text-xs text-ink-3">{sub}</p>}
      </div>
      <p
        className={cn(
          'num shrink-0 text-sm whitespace-nowrap',
          strong || total ? 'font-semibold' : '',
          tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink',
          total && 'text-[15px]',
        )}
      >
        {value < 0 ? `(${money(-value)})` : money(value)}
      </p>
    </div>
  )
}

export function StatementSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line last:border-b-0">
      <p className="px-4 pt-4 pb-1 text-[13px] font-semibold text-ink-3 sm:px-5">{title}</p>
      {children}
    </div>
  )
}

export function dayLabel(d: unknown) {
  const x = new Date(String(d))
  if (isNaN(x.getTime())) return ''
  return x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
