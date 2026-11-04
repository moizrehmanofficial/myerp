'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/utils'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

export default function Pagination({ page, totalPages, total, limit, onPageChange, onLimitChange }: PaginationProps) {
  if (!total) return null

  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  function pages() {
    const list: (number | '…')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) list.push(i)
    } else {
      list.push(1)
      if (page > 3) list.push('…')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) list.push(i)
      if (page < totalPages - 2) list.push('…')
      list.push(totalPages)
    }
    return list
  }

  const btn = 'flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-3">
        <span className="num">
          <span className="font-medium text-ink">
            {start}–{end}
          </span>{' '}
          of <span className="font-medium text-ink">{total}</span>
        </span>
        <label className="flex items-center gap-2">
          Rows
          <select
            value={limit}
            onChange={(e) => {
              onLimitChange(Number(e.target.value))
              onPageChange(1)
            }}
            className="h-8 rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink"
          >
            {[25, 50, 100].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pages">
          <button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1} className={cn(btn, 'border-line-strong bg-surface text-ink-2 hover:bg-subtle')} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          {pages().map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-ink-3">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(btn, 'num', p === page ? 'border-brand bg-brand font-medium text-white' : 'border-line-strong bg-surface text-ink-2 hover:bg-subtle', 'hidden sm:flex', (p === page || p === 1 || p === totalPages) && 'flex')}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages} className={cn(btn, 'border-line-strong bg-surface text-ink-2 hover:bg-subtle')} aria-label="Next page">
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  )
}
