// What to show as a document's status (one place for lists, views and reports)

const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// Invoice: Draft / Cancelled / Overdue, otherwise Paid / Partial / Unpaid
export function invoiceState(inv: any): string {
  if (inv?.status === 'DRAFT') return 'DRAFT'
  if (inv?.status === 'CANCELLED') return 'CANCELLED'
  if (Number(inv?.dueAmount) > 0 && inv?.dueDate && String(inv.dueDate).slice(0, 10) < today()) return 'OVERDUE'
  return inv?.paymentStatus || 'UNPAID'
}

// Quotation: Expired when its date has passed and it was not answered yet
export function quotationState(q: any): string {
  if ((q?.status === 'DRAFT' || q?.status === 'SENT') && q?.validUntil && String(q.validUntil).slice(0, 10) < today()) return 'EXPIRED'
  return q?.status || 'DRAFT'
}
