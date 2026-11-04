'use client'

import { cn } from '@/utils/utils'

// Pick one of a few options (e.g. Cash / Bank / Cheque). Buttons, so it
// works with the keyboard and screen readers like a radio group.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (key: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap rounded-[var(--radius-control)] border border-line-strong bg-subtle p-0.5', className)}>
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            className={cn(
              'h-8 flex-1 rounded-md px-3 text-[13px] whitespace-nowrap transition-colors',
              active ? 'bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--color-line-strong)]' : 'text-ink-2 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// Filter pills above a list (All / Low stock / Out of stock)
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { key: T; label: string; count?: number }[]
  value: T
  onChange: (key: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors',
              active ? 'border-brand bg-brand-soft font-medium text-brand-ink' : 'border-line-strong text-ink-2 hover:bg-subtle',
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="num text-xs text-ink-3">{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
