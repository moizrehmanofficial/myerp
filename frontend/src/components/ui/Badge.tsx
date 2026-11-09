import { cn } from '@/utils/utils'

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'brand'

const tones: Record<Tone, string> = {
  neutral: 'bg-subtle text-ink-2 border-line',
  good: 'bg-good-soft text-good border-good/20',
  warn: 'bg-warn-soft text-warn border-warn/20',
  bad: 'bg-bad-soft text-bad border-bad/20',
  info: 'bg-info-soft text-info border-info/20',
  brand: 'bg-brand-soft text-brand-ink border-brand/20',
}

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  )
}

// Common ERP statuses → one consistent colour everywhere
const STATUS_TONES: Record<string, Tone> = {
  PAID: 'good', RECEIVED: 'good', DELIVERED: 'good', COMPLETED: 'good', ACTIVE: 'good', APPROVED: 'good', PRESENT: 'good',
  PARTIAL: 'warn', PENDING: 'warn', IN_PROGRESS: 'warn', LATE: 'warn', DRAFT: 'neutral', ORDERED: 'info', CONFIRMED: 'info', SHIPPED: 'info',
  SENT: 'info', ACCEPTED: 'good', CONVERTED: 'brand', EXPIRED: 'warn',
  UNPAID: 'bad', OVERDUE: 'bad', CANCELLED: 'bad', REJECTED: 'bad', SUSPENDED: 'bad', INACTIVE: 'neutral', ABSENT: 'bad',
}

export function StatusBadge({ status }: { status?: string | null }) {
  const s = String(status || '').toUpperCase()
  if (!s) return null
  const label = s === 'CONVERTED' ? 'Invoiced' : s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')
  return <Badge tone={STATUS_TONES[s] || 'neutral'}>{label}</Badge>
}
