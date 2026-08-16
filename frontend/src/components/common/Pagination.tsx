'use client'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

export default function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
}: PaginationProps) {
  if (total === 0) return null

  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  // Generate page numbers to show
  function getPageNumbers() {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('...')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i)
      }
      if (page < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  const btnStyle = (active: boolean, disabled = false): React.CSSProperties => ({
    padding: '7px 12px',
    background: active ? '#1E3A5F' : '#fff',
    color: active ? '#fff' : disabled ? '#CBD5E1' : '#374151',
    border: `1px solid ${active ? '#1E3A5F' : '#E2E8F0'}`,
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: active ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Inter, sans-serif',
    minWidth: '36px',
    textAlign: 'center' as const,
    opacity: disabled ? 0.5 : 1,
  })

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 0', marginTop: '12px', flexWrap: 'wrap', gap: '12px',
    }}>
      {/* Left — Records info + limit selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', color: '#64748B' }}>
          Showing <strong style={{ color: '#0F172A' }}>{start}–{end}</strong> of <strong style={{ color: '#0F172A' }}>{total}</strong> records
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>Per page:</span>
          {[25, 50, 100].map((l) => (
            <button
              key={l}
              onClick={() => { onLimitChange(l); onPageChange(1) }}
              style={{
                padding: '4px 10px',
                background: limit === l ? '#1E3A5F' : '#F1F5F9',
                color: limit === l ? '#fff' : '#64748B',
                border: 'none', borderRadius: '6px',
                fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* Right — Page buttons */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            style={btnStyle(false, page === 1)}
          >← Prev</button>

          {getPageNumbers().map((p, i) =>
            p === '...' ? (
              <span key={`dots-${i}`} style={{ padding: '0 4px', color: '#94A3B8', fontSize: '13px' }}>...</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                style={btnStyle(p === page)}
              >{p}</button>
            )
          )}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            style={btnStyle(false, page === totalPages)}
          >Next →</button>
        </div>
      )}
    </div>
  )
}