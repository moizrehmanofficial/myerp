// One place for how money, numbers and dates look across the app

export function money(value: unknown, currency = 'PKR') {
  const n = Number(value) || 0
  return `${currency} ${n.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`
}

export function number(value: unknown) {
  return (Number(value) || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
}

// Short amounts for small spaces: 6.4M, 365K
export function compact(value: unknown) {
  const n = Number(value) || 0
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function date(value: unknown) {
  if (!value) return '—'
  const d = new Date(String(value))
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
