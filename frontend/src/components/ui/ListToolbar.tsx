'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/utils/utils'

// Search box that searches on Enter (and clears with the X)
export function SearchInput({
  placeholder,
  onSearch,
  initial = '',
  className,
}: {
  placeholder: string
  onSearch: (q: string) => void
  initial?: string
  className?: string
}) {
  const [q, setQ] = useState(initial)
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(q.trim())
      }}
      className={cn('relative w-full sm:max-w-sm', className)}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface pr-9 pl-9 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:ring-3 focus:ring-brand/15 focus:outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ('')
            onSearch('')
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </form>
  )
}

// Row of filters / search above a table
export function ListToolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5', className)}>{children}</div>
}

// Small icon button for table rows (edit / delete / view)
export function IconAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-subtle [&>svg]:size-4',
        danger ? 'hover:bg-bad-soft hover:text-bad' : 'hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
