'use client'

import { cn } from '@/utils/utils'

// Underline tabs. Scrolls sideways on phones if there are many.
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { key: T; label: string; count?: number }[]
  value: T
  onChange: (key: T) => void
  className?: string
}) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-line px-2 sm:px-3', className)}>
      {tabs.map((t) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors',
              active ? 'border-brand font-medium text-ink' : 'border-transparent text-ink-3 hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('num rounded-full px-1.5 text-xs', active ? 'bg-brand-soft text-brand-ink' : 'bg-subtle text-ink-3')}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
