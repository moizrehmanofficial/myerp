'use client'

import { useState, useRef, useEffect } from 'react'
import { exportToCSV, exportToExcel, exportToPDF, ExportColumn } from '@/lib/export'

interface ExportButtonProps {
  data: any[]
  filename: string
  columns: ExportColumn[]
  title: string
  subtitle?: string
  disabled?: boolean
}

export default function ExportButton({
  data,
  filename,
  columns,
  title,
  subtitle,
  disabled = false,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleExport(type: 'csv' | 'excel' | 'pdf') {
    setExporting(type)
    setOpen(false)
    try {
      if (type === 'csv') exportToCSV(data, filename, columns)
      else if (type === 'excel') exportToExcel(data, filename, columns, title)
      else await exportToPDF(data, filename, columns, title, subtitle)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  const options = [
    { type: 'csv' as const, label: '📄 Export CSV', desc: 'Comma-separated values' },
    { type: 'excel' as const, label: '📊 Export Excel', desc: 'Formatted .xlsx file' },
    { type: 'pdf' as const, label: '📋 Export PDF', desc: 'Printable document' },
  ]

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled || !!exporting}
        style={{
          padding: '9px 16px',
          background: disabled ? '#F1F5F9' : '#F0FDF4',
          color: disabled ? '#94A3B8' : '#16A34A',
          border: `1px solid ${disabled ? '#E2E8F0' : '#BBF7D0'}`,
          borderRadius: '10px', fontSize: '13px', fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'Inter, sans-serif',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}
      >
        {exporting ? (
          <>
            <span style={{ width: '14px', height: '14px', border: '2px solid #BBF7D0', borderTopColor: '#16A34A', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            Exporting...
          </>
        ) : (
          <>⬇️ Export ▾</>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)',
          background: '#fff', borderRadius: '12px',
          border: '1px solid #E2E8F0', padding: '6px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 100, minWidth: '200px',
        }}>
          {options.map((opt) => (
            <button
              key={opt.type}
              onClick={() => handleExport(opt.type)}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'transparent', border: 'none',
                borderRadius: '8px', cursor: 'pointer',
                textAlign: 'left', fontFamily: 'Inter, sans-serif',
                display: 'flex', flexDirection: 'column', gap: '2px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{opt.label}</span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>{opt.desc}</span>
            </button>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}