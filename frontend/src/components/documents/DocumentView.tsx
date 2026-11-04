'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, Banknote, PackageCheck, Pencil, Printer } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import { Button, Card, Field, Input, Select, Textarea, Modal, Table, TableWrap, Th, Td, Tr, Spinner, EmptyState, StatusBadge, useConfirm, buttonStyles } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, number, date } from '@/lib/format'
import { useCompanyHref } from '@/lib/useCompanyHref'
import { getTenantSlug } from '@/lib/getTenantSlug'
import type { DocKind } from './DocumentEditor'

const CONFIG = {
  invoice: { module: 'invoices', url: '/erp/invoices', label: 'Invoice', numberKey: 'invoiceNumber', party: 'Bill to', prefix: 'customer' },
  sales: { module: 'sales', url: '/erp/sales/orders', label: 'Sales order', numberKey: 'orderNumber', party: 'Customer', prefix: 'customer' },
  purchase: { module: 'purchase', url: '/erp/purchase/orders', label: 'Purchase order', numberKey: 'orderNumber', party: 'Supplier', prefix: 'supplier' },
}

const SALES_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'DELIVERED', 'CANCELLED']
const PURCHASE_STATUSES = [
  { value: 'PENDING', label: 'Draft' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export default function DocumentView({ kind, id }: { kind: DocKind; id: string }) {
  const c = CONFIG[kind]
  const href = useCompanyHref()
  const [doc, setDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [companyName, setCompanyName] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirm, confirmDialog] = useConfirm()
  const { canModify, canPrint } = usePermission()

  const load = useCallback(async () => {
    try {
      const res = await tenantApi.get(`${c.url}/${id}`)
      setDoc(res.data.data)
    } catch (err) {
      toast.error(apiError(err, `Could not load this ${c.label.toLowerCase()}.`))
    } finally {
      setLoading(false)
    }
  }, [c.url, c.label, id])

  useEffect(() => {
    load()
    setCompanyName(sessionStorage.getItem(`tenant_company_${getTenantSlug()}`) || '')
  }, [load])

  async function changeStatus(status: string) {
    if (kind === 'purchase') {
      const toReceived = status === 'RECEIVED'
      const fromReceived = doc.status === 'RECEIVED'
      if (toReceived || fromReceived) {
        const ok = await confirm({
          title: toReceived ? 'Mark as received?' : `Change to ${status.toLowerCase()}?`,
          message: toReceived
            ? 'The quantities will be added to stock and the amount added to what you owe the supplier.'
            : 'The stock this order added will be removed again. This is blocked if it has already been sold.',
          confirmLabel: toReceived ? 'Mark received' : 'Change status',
          danger: !toReceived,
        })
        if (!ok) return
      }
    }
    setBusy(true)
    try {
      await tenantApi.patch(`${c.url}/${id}/status`, { status })
      toast.success('Status updated')
      load()
    } catch (err) {
      toast.error(apiError(err, 'Could not change the status.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <TenantLayout title={c.label} requiredModule={c.module}>
        <Spinner />
      </TenantLayout>
    )
  }

  if (!doc) {
    return (
      <TenantLayout title={c.label} requiredModule={c.module}>
        <Card>
          <EmptyState
            title={`${c.label} not found`}
            description="It may have been deleted."
            action={<Link href={href(c.url)} className={buttonStyles({ variant: 'secondary' })}>Back to list</Link>}
          />
        </Card>
      </TenantLayout>
    )
  }

  const p = c.prefix
  const party = {
    name: doc[`${p}Name`],
    phone: doc[`${p}Phone`],
    email: doc[`${p}Email`],
    address: doc[`${p}Address`],
  }
  const items: any[] = doc.items || []
  const hasLineDiscount = kind !== 'purchase'
  const itemsTotal = items.reduce((s, it) => s + Number(it.totalPrice || 0), 0)
  const due = Number(doc.dueAmount || 0)
  const status = kind === 'invoice' ? doc.paymentStatus : doc.status

  return (
    <TenantLayout
      title={doc[c.numberKey]}
      subtitle={`${c.label} for ${party.name || '—'}`}
      requiredModule={c.module}
      headerRight={
        <>
          <Link href={href(c.url)} className={buttonStyles({ variant: 'ghost' })}>
            <ArrowLeft className="size-4" aria-hidden />
            All {kind === 'invoice' ? 'invoices' : 'orders'}
          </Link>
          {canPrint(c.module) && (
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Print
            </Button>
          )}
          {kind === 'invoice' && canModify('invoices') && (
            <Link href={href(`${c.url}/${id}/edit`)} className={buttonStyles({ variant: 'secondary' })}>
              <Pencil className="size-4" aria-hidden />
              Edit
            </Link>
          )}
          {kind === 'invoice' && due > 0 && canModify('invoices') && (
            <Button icon={<Banknote className="size-4" />} onClick={() => setPayOpen(true)}>
              Record payment
            </Button>
          )}
          {kind === 'purchase' && doc.status !== 'RECEIVED' && doc.status !== 'CANCELLED' && canModify('purchase') && (
            <Button icon={<PackageCheck className="size-4" />} onClick={() => changeStatus('RECEIVED')} loading={busy}>
              Mark received
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* The document itself (this is what prints) */}
        <Card className="overflow-hidden print:border-0">
          <div className="flex flex-col gap-6 border-b border-line p-5 sm:flex-row sm:justify-between sm:p-7">
            <div>
              <p className="text-lg font-semibold text-ink capitalize">{companyName || getTenantSlug()}</p>
              <p className="mt-0.5 text-[13px] text-ink-3">{c.label}</p>
            </div>
            <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm sm:text-right">
              <dt className="text-ink-3">Number</dt>
              <dd className="font-medium">{doc[c.numberKey]}</dd>
              <dt className="text-ink-3">Date</dt>
              <dd>{date(doc.createdAt)}</dd>
              {doc.dueDate && (
                <>
                  <dt className="text-ink-3">Due by</dt>
                  <dd>{date(doc.dueDate)}</dd>
                </>
              )}
              <dt className="text-ink-3">Status</dt>
              <dd><StatusBadge status={status} /></dd>
            </dl>
          </div>

          <div className="border-b border-line p-5 sm:px-7">
            <p className="text-[13px] font-medium text-ink-3">{c.party}</p>
            <p className="mt-1 font-semibold text-ink">{party.name || '—'}</p>
            <div className="mt-0.5 text-sm text-ink-2">
              {party.phone && <p>{party.phone}</p>}
              {party.email && <p>{party.email}</p>}
              {party.address && <p className="max-w-sm whitespace-pre-line">{party.address}</p>}
            </div>
          </div>

          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th className="sm:pl-7">Item</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right" className="hidden sm:table-cell">Price</Th>
                  {hasLineDiscount && <Th align="right" className="hidden md:table-cell">Discount</Th>}
                  <Th align="right" className="sm:pr-7">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <Tr key={it.id || i}>
                    <Td className="sm:pl-7">
                      <p className="font-medium">{it.productName || 'Product'}</p>
                      <p className="text-xs text-ink-3">
                        {it.productSku}
                        <span className="sm:hidden">, {money(it.unitPrice)} each</span>
                      </p>
                    </Td>
                    <Td align="right">{number(it.quantity)}</Td>
                    <Td align="right" className="hidden sm:table-cell">{money(it.unitPrice)}</Td>
                    {hasLineDiscount && <Td align="right" className="hidden text-ink-2 md:table-cell">{Number(it.discount) ? money(it.discount) : '—'}</Td>}
                    <Td align="right" className="font-medium sm:pr-7">{money(it.totalPrice)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>

          <div className="flex flex-col gap-6 border-t border-line p-5 sm:flex-row sm:justify-between sm:p-7">
            <div className="max-w-sm text-sm text-ink-2">
              {doc.notes && (
                <>
                  <p className="text-[13px] font-medium text-ink-3">Notes</p>
                  <p className="mt-1 whitespace-pre-line">{doc.notes}</p>
                </>
              )}
            </div>
            <dl className="flex w-full flex-col gap-1.5 text-sm sm:w-72">
              <Line label="Items total" value={money(kind === 'purchase' ? doc.totalAmount : doc.subtotal ?? itemsTotal)} />
              {kind !== 'purchase' && Number(doc.discount) > 0 && <Line label="Discount" value={`− ${money(doc.discount)}`} />}
              {kind !== 'purchase' && Number(doc.tax) > 0 && <Line label="Tax" value={money(doc.tax)} />}
              <div className="mt-1 flex justify-between border-t border-line pt-2.5">
                <dt className="font-semibold">Total</dt>
                <dd className="num text-lg font-semibold">{money(doc.totalAmount)}</dd>
              </div>
              {kind === 'invoice' && (
                <>
                  <Line label="Received" value={money(doc.paidAmount)} />
                  <div className="flex justify-between">
                    <dt className={due > 0 ? 'font-medium text-warn' : 'text-good'}>{due > 0 ? 'Balance due' : 'Paid in full'}</dt>
                    <dd className={`num font-semibold ${due > 0 ? 'text-warn' : 'text-good'}`}>{money(due)}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </Card>

        {/* Side panel (not printed) */}
        <div className="flex flex-col gap-5 print:hidden">
          {kind !== 'invoice' && canModify(c.module) && (
            <Card className="p-4">
              <Field label="Status" hint={kind === 'sales' ? 'Sales orders do not change stock. Create an invoice to sell.' : 'Received adds stock. Moving away from received removes it.'}>
                {(fid) => (
                  <Select id={fid} value={doc.status} onChange={(e) => changeStatus(e.target.value)} disabled={busy}>
                    {kind === 'sales'
                      ? SALES_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)
                      : PURCHASE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                )}
              </Field>
            </Card>
          )}
          {kind === 'sales' && (
            <Card className="p-4 text-sm text-ink-2">
              Ready to bill this order?{' '}
              <Link href={href('/erp/invoices/create')} className="font-medium text-brand hover:text-brand-hover">
                Create an invoice
              </Link>
            </Card>
          )}
        </div>
      </div>

      {kind === 'invoice' && (
        <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} invoice={doc} onDone={load} />
      )}
      {confirmDialog}
    </TenantLayout>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-2">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  )
}

function PaymentModal({ open, onClose, invoice, onDone }: { open: boolean; onClose: () => void; invoice: any; onDone: () => void }) {
  const due = Number(invoice?.dueAmount || 0)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(due.toFixed(2))
      setMethod('CASH')
      setNotes('')
      setError('')
    }
  }, [open, due])

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    const a = Number(amount)
    if (!(a > 0)) return setError('Enter the amount received.')
    if (a > due + 1) return setError(`The balance due is only ${money(due)}.`)
    setSaving(true)
    try {
      await tenantApi.patch(`/erp/invoices/${invoice.id}/payment`, { amount: a, method, notes })
      toast.success('Payment recorded')
      onDone()
      onClose()
    } catch (err) {
      toast.error(apiError(err, 'Could not record the payment.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      description={`${invoice?.invoiceNumber}: ${money(due)} still due`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save()} loading={saving}>Record payment</Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Amount received (PKR)" required error={error || undefined}>
          {(id) => <Input id={id} type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="num" autoFocus />}
        </Field>
        <Field label="Paid by">
          {(id) => (
            <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="ONLINE">Online / card</option>
            </Select>
          )}
        </Field>
        <Field label="Note" hint="Optional, e.g. cheque number">
          {(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  )
}
