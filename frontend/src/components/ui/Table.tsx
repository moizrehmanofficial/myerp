import { cn } from '@/utils/utils'

// Plain, consistent data table. Wrap in <TableWrap> so wide tables
// scroll sideways on phones instead of breaking the page.
export function TableWrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('overflow-x-auto', className)}>{children}</div>
}

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
}

export function Th({ className, align = 'left', children }: { className?: string; align?: 'left' | 'right' | 'center'; children?: React.ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-line bg-subtle px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap text-ink-2',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ className, align = 'left', children, colSpan }: { className?: string; align?: 'left' | 'right' | 'center'; children?: React.ReactNode; colSpan?: number }) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        'border-b border-line px-4 py-3 align-middle text-ink',
        align === 'right' ? 'num text-right whitespace-nowrap' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      {children}
    </td>
  )
}

export function Tr({ className, children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={cn('last:[&>td]:border-b-0 hover:bg-subtle/70', onClick && 'cursor-pointer', className)}>
      {children}
    </tr>
  )
}
