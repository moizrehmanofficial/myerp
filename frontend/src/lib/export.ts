import * as XLSX from 'xlsx'

// ── CSV EXPORT ─────────────────────────────────────────
export function exportToCSV(data: any[], filename: string, columns: ExportColumn[]) {
  if (!data || data.length === 0) {
    alert('No data to export')
    return
  }

  const headers = columns.map((c) => c.header)
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = col.value(row)
      return val !== null && val !== undefined ? String(val) : ''
    })
  )

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

// ── EXCEL EXPORT ───────────────────────────────────────
export function exportToExcel(data: any[], filename: string, columns: ExportColumn[], sheetName = 'Sheet1') {
  if (!data || data.length === 0) {
    alert('No data to export')
    return
  }

  const headers = columns.map((c) => c.header)
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = col.value(row)
      return val !== null && val !== undefined ? val : ''
    })
  )

  const wsData = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = columns.map((col) => ({ wch: col.width || 20 }))

  // Header style
  const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col })
    if (!ws[cellRef]) continue
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1E3A5F' } },
      alignment: { horizontal: 'center' },
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ── PDF EXPORT ─────────────────────────────────────────
export async function exportToPDF(
  data: any[],
  filename: string,
  columns: ExportColumn[],
  title: string,
  subtitle?: string,
) {
  if (!data || data.length === 0) {
    alert('No data to export')
    return
  }

  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' })

  // Header
  doc.setFillColor(30, 58, 95)
  doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 12)

  if (subtitle) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(subtitle, 14, 20)
  }

  doc.setFontSize(8)
  doc.text(`Generated: ${new Date().toLocaleString()}`, doc.internal.pageSize.width - 14, 20, { align: 'right' })

  // Table
  autoTable(doc, {
    startY: 36,
    head: [columns.map((c) => c.header)],
    body: data.map((row) =>
      columns.map((col) => {
        const val = col.value(row)
        return val !== null && val !== undefined ? String(val) : ''
      })
    ),
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  })

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Page ${i} of ${pageCount} | MyERP`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 8,
      { align: 'center' }
    )
  }

  doc.save(`${filename}.pdf`)
}

// ── TYPES ──────────────────────────────────────────────
export interface ExportColumn {
  header: string
  value: (row: any) => any
  width?: number
}

// ── HELPER ─────────────────────────────────────────────
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}