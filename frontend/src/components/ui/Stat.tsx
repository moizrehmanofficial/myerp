import { cn } from '@/utils/utils'

// A key number. Tone colours only the small marker, not the whole card,
// so a screen full of numbers stays calm and readable.
export function Stat({
  label,
  value,
  sub,
  icon,
  tone = 'neutral',
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: React.ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'brand' | 'info'
  className?: string
}) {
  const marker = {
    neutral: 'bg-subtle text-ink-2',
    good: 'bg-good-soft text-good',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
    brand: 'bg-brand-soft text-brand',
    info: 'bg-info-soft text-info',
  }[tone]

  return (
    <div className={cn('rounded-[var(--radius-panel)] border border-line bg-surface p-4', className)}>
      <div className="flex items-center gap-2.5">
        {icon && <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4', marker)}>{icon}</span>}
        <p className="text-[13px] font-medium text-ink-2">{label}</p>
      </div>
      <p className="num mt-3 text-[22px] leading-tight font-semibold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-3">{sub}</p>}
    </div>
  )
}
