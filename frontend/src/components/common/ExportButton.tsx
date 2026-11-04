'use client'

import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ChevronDown, Download, FileSpreadsheet, FileText, FileType2 } from 'lucide-react'
import { exportToCSV, exportToExcel, exportToPDF, ExportColumn } from '@/lib/export'
import { Button } from '@/components/ui'

interface ExportButtonProps {
  data: any[]
  filename: string
  columns: ExportColumn[]
  title: string
  subtitle?: string
  disabled?: boolean
}

export default function ExportButton({ data, filename, columns, title, subtitle, disabled = false }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  async function run(type: 'csv' | 'excel' | 'pdf') {
    setOpen(false)
    if (!data?.length) {
      toast.error('There is nothing to export yet.')
      return
    }
    setExporting(true)
    try {
      if (type === 'csv') exportToCSV(data, filename, columns)
      else if (type === 'excel') exportToExcel(data, filename, columns, title)
      else await exportToPDF(data, filename, columns, title, subtitle)
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Export failed. Try again.')
    } finally {
      setExporting(false)
    }
  }

  const options = [
    { type: 'excel' as const, label: 'Excel (.xlsx)', icon: FileSpreadsheet },
    { type: 'pdf' as const, label: 'PDF', icon: FileText },
    { type: 'csv' as const, label: 'CSV', icon: FileType2 },
  ]

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        loading={exporting}
        icon={<Download className="size-4" />}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Export
        <ChevronDown className="-mr-1 size-4 text-ink-3" />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1.5 w-48 overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface py-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.type}
              role="menuitem"
              type="button"
              onClick={() => run(o.type)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-subtle"
            >
              <o.icon className="size-4 text-ink-3" />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
