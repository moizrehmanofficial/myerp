import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/utils'

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-16 text-sm text-ink-3', className)} role="status">
      <Loader2 className="size-5 animate-spin text-brand" aria-hidden />
      {label}
    </div>
  )
}

// An empty screen tells people what to do next
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {icon && <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-subtle text-ink-3 [&>svg]:size-5">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
