'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2, TriangleAlert, Info } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import { Button, Card, CardHeader, CardBody, Field, Input, Select, Textarea, Spinner, buttonStyles } from '@/components/ui'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, number } from '@/lib/format'
import { useCompanyHref } from '@/lib/useCompanyHref'
import { cn } from '@/utils/utils'

export type DocKind = 'invoice' | 'sales' | 'purchase' | 'quotation'

interface Line {
  productId: string
  quantity: string
  unitPrice: string
  discount: string
}

const EMPTY_LINE: Line = { productId: '', quantity: '1', unitPrice: '', discount: '0' }

// Everything that differs between the three documents lives here
const CONFIG = {
  invoice: {
    module: 'invoices',
    titleNew: 'New invoice',
    titleEdit: 'Edit invoice',
    subtitle: 'Bill a customer. Stock goes down and the customer balance updates when you save.',
    party: 'Customer',
    partiesUrl: '/erp/invoices/customers',
    productsUrl: '/erp/invoices/products',
    price: 'salePrice' as const,
    lineDiscount: true,
    totals: true,
    payment: true,
    checkStock: true,
    statuses: null as null | { value: string; label: string; hint: string }[],
    saveUrl: '/erp/invoices',
    listUrl: '/erp/invoices',
    saveLabel: 'Create invoice',
    drafts: true,
    validity: false,
  },
  sales: {
    module: 'sales',
    titleNew: 'New sales order',
    titleEdit: 'Edit sales order',
    subtitle: 'Record what a customer has ordered. Stock changes only when you invoice it.',
    party: 'Customer',
    partiesUrl: '/erp/sales/customers',
    productsUrl: '/erp/sales/products',
    price: 'salePrice' as const,
    lineDiscount: true,
    totals: true,
    payment: false,
    checkStock: false,
    statuses: [
      { value: 'PENDING', label: 'Pending', hint: 'Order received, not confirmed yet' },
      { value: 'CONFIRMED', label: 'Confirmed', hint: 'You have accepted the order' },
      { value: 'PROCESSING', label: 'Processing', hint: 'Being prepared' },
      { value: 'DELIVERED', label: 'Delivered', hint: 'Handed over to the customer' },
    ],
    saveUrl: '/erp/sales/orders',
    listUrl: '/erp/sales/orders',
    saveLabel: 'Create sales order',
    drafts: false,
    validity: false,
  },
  purchase: {
    module: 'purchase',
    titleNew: 'New purchase order',
    titleEdit: 'Edit purchase order',
    subtitle: 'Order stock from a supplier. Stock goes up when you mark it received.',
    party: 'Supplier',
    partiesUrl: '/erp/purchase/suppliers',
    productsUrl: '/erp/purchase/products',
    price: 'purchasePrice' as const,
    lineDiscount: false,
    totals: false,
    payment: false,
    checkStock: false,
    statuses: [
      { value: 'PENDING', label: 'Draft', hint: 'Not sent to the supplier yet' },
      { value: 'ORDERED', label: 'Ordered', hint: 'Sent, waiting for delivery' },
      { value: 'RECEIVED', label: 'Received', hint: 'Goods arrived: adds to stock now' },
    ],
    saveUrl: '/erp/purchase/orders',
    listUrl: '/erp/purchase/orders',
    saveLabel: 'Create purchase order',
    drafts: false,
    validity: false,
  },
  quotation: {
    module: 'sales',
    titleNew: 'New quotation',
    titleEdit: 'Edit quotation',
    subtitle: 'A price offer for a customer. Nothing changes in stock or accounts until it becomes an invoice.',
    party: 'Customer',
    partiesUrl: '/erp/quotations/customers',
    productsUrl: '/erp/quotations/products',
    price: 'salePrice' as const,
    lineDiscount: true,
    totals: true,
    payment: false,
    checkStock: false,
    statuses: null as null | { value: string; label: string; hint: string }[],
    saveUrl: '/erp/quotations',
    listUrl: '/erp/quotations',
    saveLabel: 'Save quotation',
    drafts: false,
    validity: true,
  },
}

const METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'ONLINE', label: 'Online / card' },
]

export default function DocumentEditor({ kind, editId }: { kind: DocKind; editId?: string }) {
  const c = CONFIG[kind]
  const router = useRouter()
  const href = useCompanyHref()
  const [parties, setParties] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [partyId, setPartyId] = useState('')
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }])
  const [discount, setDiscount] = useState('0')
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed')
  const [tax, setTax] = useState('0')
  const [taxType, setTaxType] = useState<'fixed' | 'percent'>('percent')
  const [paid, setPaid] = useState('0')
  const [method, setMethod] = useState('CASH')
  const [status, setStatus] = useState(c.statuses?.[0].value || '')
  const [dueDate, setDueDate] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [docStatus, setDocStatus] = useState('') // DRAFT when editing a draft invoice
  const [notes, setNotes] = useState('')
  const [originalQty, setOriginalQty] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      try {
        const [pRes, prRes, docRes] = await Promise.all([
          tenantApi.get(c.partiesUrl),
          tenantApi.get(c.productsUrl),
          editId ? tenantApi.get(`${c.saveUrl}/${editId}`) : Promise.resolve(null),
        ])
        setParties(pRes.data.data || [])
        setProducts(prRes.data.data || [])
        const doc = docRes?.data?.data
        // New sale documents start with the company's default tax rate (Settings)
        if (!doc && c.totals && kind !== 'purchase') {
          tenantApi
            .get('/erp/settings')
            .then((r) => {
              const rate = Number(r.data.data?.tax_rate)
              if (rate > 0) setTax(String(rate))
            })
            .catch(() => {})
        }
        if (doc) {
          setPartyId(doc.customerId || doc.supplierId || '')
          setDiscount(String(Number(doc.discount || 0)))
          setDiscountType('fixed')
          setTax(String(Number(doc.tax || 0)))
          setTaxType('fixed')
          setPaid(String(Number(doc.paidAmount || 0)))
          setDueDate(doc.dueDate ? String(doc.dueDate).split('T')[0] : '')
          setValidUntil(doc.validUntil ? String(doc.validUntil).split('T')[0] : '')
          setDocStatus(doc.status || '')
          setNotes(doc.notes || '')
          const items = (doc.items || []).map((it: any) => ({
            productId: it.productId,
            quantity: String(Number(it.quantity || 1)),
            unitPrice: String(Number(it.unitPrice || 0)),
            discount: String(Number(it.discount || 0)),
          }))
          if (items.length) setLines(items)
          // When editing, the invoice's own quantity is given back first, so it counts as available
          const q: Record<string, number> = {}
          items.forEach((i: Line) => (q[i.productId] = (q[i.productId] || 0) + Number(i.quantity)))
          setOriginalQty(q)
        }
      } catch (err) {
        toast.error(apiError(err, 'Could not load the form. Refresh to try again.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [c.partiesUrl, c.productsUrl, c.saveUrl, editId])

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  function updateLine(i: number, field: keyof Line, value: string) {
    setLines((ls) => {
      const next = [...ls]
      next[i] = { ...next[i], [field]: value }
      if (field === 'productId') {
        const p = byId.get(value)
        next[i].unitPrice = p ? String(Number(p[c.price] || 0)) : ''
      }
      return next
    })
  }

  // ── Totals (same rules as the server) ──
  const lineTotal = (l: Line) => (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) - (c.lineDiscount ? Number(l.discount) || 0 : 0)
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0)
  const discountValue = c.totals ? (discountType === 'percent' ? (subtotal * (Number(discount) || 0)) / 100 : Number(discount) || 0) : 0
  const afterDiscount = subtotal - discountValue
  const taxValue = c.totals ? (taxType === 'percent' ? (afterDiscount * (Number(tax) || 0)) / 100 : Number(tax) || 0) : 0
  const total = afterDiscount + taxValue
  const paidValue = Number(paid) || 0
  const due = Math.max(total - paidValue, 0)

  // Stock needed per product across all lines
  const needed = useMemo(() => {
    const m: Record<string, number> = {}
    lines.forEach((l) => l.productId && (m[l.productId] = (m[l.productId] || 0) + (Number(l.quantity) || 0)))
    return m
  }, [lines])
  const available = (productId: string) => Number(byId.get(productId)?.stock || 0) + (originalQty[productId] || 0)
  const short = c.checkStock ? Object.keys(needed).filter((id) => needed[id] > available(id)) : []

  const editingDraft = kind === 'invoice' && docStatus === 'DRAFT'

  // asDraft: save an invoice without moving stock or money (it can be issued later)
  async function save(asDraft = false) {
    const errs: Record<string, string> = {}
    if (!partyId) errs.party = `Choose a ${c.party.toLowerCase()}.`
    const valid = lines.filter((l) => l.productId)
    if (!valid.length) errs.lines = 'Add at least one product.'
    if (valid.some((l) => !(Number(l.quantity) > 0))) errs.lines = 'Every quantity must be more than 0.'
    if (c.lineDiscount && valid.some((l) => (Number(l.discount) || 0) > (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)))
      errs.lines = 'A line discount is larger than the line amount.'
    if (discountValue > subtotal) errs.discount = 'Discount is larger than the subtotal.'
    if (c.payment && paidValue > total + 1) errs.paid = 'Amount received is more than the total.'
    if (asDraft && paidValue > 0) errs.paid = 'A draft cannot have a payment. Set it to 0, or create the invoice.'
    if (!asDraft && short.length) errs.lines = `Not enough stock for ${short.map((id) => byId.get(id)?.name).join(', ')}.`
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error(Object.values(errs)[0])
      return
    }

    const payload: any = {
      [kind === 'purchase' ? 'supplierId' : 'customerId']: partyId,
      notes,
      items: valid.map((l) => ({
        productId: l.productId,
        productName: byId.get(l.productId)?.name || '',
        quantity: l.quantity,
        unitPrice: l.unitPrice || '0',
        ...(c.lineDiscount ? { discount: l.discount || '0' } : {}),
      })),
    }
    if (c.totals) {
      payload.discount = discountValue.toFixed(2)
      payload.tax = taxValue.toFixed(2)
    }
    if (c.statuses) payload.status = status
    if (c.payment) {
      payload.paidAmount = asDraft || editingDraft ? '0' : Math.min(paidValue, total).toFixed(2)
      payload.paymentMethod = method
      payload.dueDate = dueDate || null
    }
    if (c.validity) payload.validUntil = validUntil || null
    if (asDraft && !editId) payload.draft = true

    setSaving(true)
    try {
      if (editId) {
        await tenantApi.put(`${c.saveUrl}/${editId}`, payload)
        // "Save and issue" on a draft: stock and accounts move now
        if (editingDraft && !asDraft) await tenantApi.patch(`${c.saveUrl}/${editId}/issue`)
        toast.success(editingDraft && !asDraft ? 'Invoice issued' : editingDraft ? 'Draft saved' : 'Changes saved')
        router.push(href(`${c.listUrl}/${editId}`))
      } else {
        const res = await tenantApi.post(c.saveUrl, payload)
        const id = res.data?.data?.id
        toast.success(
          asDraft ? 'Draft saved. Stock and accounts change when you issue it.'
            : kind === 'invoice' ? 'Invoice created'
            : kind === 'quotation' ? 'Quotation saved'
            : kind === 'sales' ? 'Sales order created'
            : status === 'RECEIVED' ? 'Purchase saved and stock added' : 'Purchase order created',
        )
        router.push(href(id ? `${c.listUrl}/${id}` : c.listUrl))
      }
    } catch (err) {
      toast.error(apiError(err, 'Could not save. Check the form and try again.'))
      setSaving(false)
    }
  }

  const backHref = href(editId ? `${c.listUrl}/${editId}` : c.listUrl)

  return (
    <TenantLayout
      title={editId ? c.titleEdit : c.titleNew}
      subtitle={c.subtitle}
      requiredModule={c.module}
      headerRight={
        <Link href={backHref} className={buttonStyles({ variant: 'secondary' })}>
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
      }
    >
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card>
              <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={c.party} required error={errors.party}>
                  {(id) => (
                    <Select id={id} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                      <option value="">Choose a {c.party.toLowerCase()}</option>
                      {parties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.phone ? ` (${p.phone})` : ''}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {c.validity ? (
                  <Field label="Valid until" hint="Optional. After this date the offer shows as expired.">
                    {(id) => <Input id={id} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />}
                  </Field>
                ) : c.payment ? (
                  <Field label="Payment due by" hint="Optional. After this date an unpaid invoice shows as overdue.">
                    {(id) => <Input id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
                  </Field>
                ) : c.statuses ? (
                  <Field label="Status" hint={c.statuses.find((s) => s.value === status)?.hint}>
                    {(id) => (
                      <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                        {c.statuses!.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                ) : null}
              </CardBody>
            </Card>

            <Card className="@container">
              <CardHeader
                title="Items"
                description={errors.lines ? undefined : `${lines.filter((l) => l.productId).length} of ${products.length} products added`}
                action={
                  <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => setLines((l) => [...l, { ...EMPTY_LINE }])}>
                    Add line
                  </Button>
                }
              />
              {errors.lines && (
                <p className="flex items-center gap-2 border-b border-line bg-bad-soft px-5 py-2.5 text-[13px] text-bad" role="alert">
                  <TriangleAlert className="size-4 shrink-0" />
                  {errors.lines}
                </p>
              )}

              {/* Column titles (tablet and up) */}
              <div
                className={cn(
                  'hidden gap-3 border-b border-line bg-subtle px-5 py-2 text-[13px] font-semibold text-ink-2 @3xl:grid',
                  c.lineDiscount ? '@3xl:grid-cols-[minmax(0,1fr)_88px_120px_100px_120px_36px]' : '@3xl:grid-cols-[minmax(0,1fr)_88px_120px_120px_36px]',
                )}
              >
                <span>Product</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price</span>
                {c.lineDiscount && <span className="text-right">Discount</span>}
                <span className="text-right">Amount</span>
                <span />
              </div>

              <ul className="divide-y divide-line">
                {lines.map((l, i) => {
                  const p = byId.get(l.productId)
                  const avail = l.productId ? available(l.productId) : 0
                  const over = c.checkStock && l.productId && needed[l.productId] > avail
                  return (
                    <li
                      key={i}
                      className={cn(
                        // Narrow: product on top, numbers below. Wide (@3xl): one row per line.
                        'grid grid-cols-2 gap-3 px-4 py-3 sm:px-5 @3xl:items-start',
                        c.lineDiscount
                          ? '@lg:grid-cols-[repeat(4,minmax(0,1fr))_36px] @3xl:grid-cols-[minmax(0,1fr)_88px_120px_100px_120px_36px]'
                          : '@lg:grid-cols-[repeat(3,minmax(0,1fr))_36px] @3xl:grid-cols-[minmax(0,1fr)_88px_120px_120px_36px]',
                      )}
                    >
                      <div className={cn('col-span-2 @3xl:col-span-1', c.lineDiscount ? '@lg:col-span-5' : '@lg:col-span-4')}>
                        <label className="sr-only" htmlFor={`p-${i}`}>Product {i + 1}</label>
                        <Select id={`p-${i}`} value={l.productId} onChange={(e) => updateLine(i, 'productId', e.target.value)}>
                          <option value="">Choose a product</option>
                          {products.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.name} ({pr.sku}){c.checkStock ? `, ${number(Number(pr.stock || 0) + (originalQty[pr.id] || 0))} in stock` : ''}
                            </option>
                          ))}
                        </Select>
                        {p && (
                          <p className={cn('mt-1 text-xs', over ? 'text-bad' : 'text-ink-3')}>
                            {c.checkStock ? (over ? `Only ${number(avail)} ${p.unit || ''} in stock` : `${number(avail)} ${p.unit || ''} in stock`) : `Unit: ${p.unit || 'pcs'}`}
                          </p>
                        )}
                      </div>
                      <NumberCell label="Qty" value={l.quantity} onChange={(v) => updateLine(i, 'quantity', v)} invalid={!!over} />
                      <NumberCell label="Price" value={l.unitPrice} onChange={(v) => updateLine(i, 'unitPrice', v)} />
                      {c.lineDiscount && <NumberCell label="Discount" value={l.discount} onChange={(v) => updateLine(i, 'discount', v)} />}
                      <div className="flex items-center justify-between @lg:flex-col @lg:items-end @lg:justify-start @lg:gap-1 @3xl:block @3xl:pt-2 @3xl:text-right">
                        <span className="text-[13px] text-ink-3 @3xl:hidden">Amount</span>
                        <span className="num font-medium text-ink">{money(lineTotal(l))}</span>
                      </div>
                      <div className="col-span-2 flex justify-end @lg:col-span-1 @lg:items-end @3xl:items-start @3xl:pt-0.5">
                        <button
                          type="button"
                          onClick={() => setLines((ls) => (ls.length === 1 ? [{ ...EMPTY_LINE }] : ls.filter((_, j) => j !== i)))}
                          className="inline-flex items-center gap-1.5 rounded-md p-2 text-[13px] text-ink-3 hover:bg-bad-soft hover:text-bad"
                          aria-label={`Remove line ${i + 1}`}
                        >
                          <Trash2 className="size-4" />
                          <span className="@lg:sr-only">Remove</span>
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="flex justify-between border-t border-line px-5 py-3 text-sm">
                <span className="text-ink-2">Items total</span>
                <span className="num font-semibold">{money(subtotal)}</span>
              </div>
            </Card>

            <Card>
              <CardBody>
                <Field label="Notes" hint="Shown on the document. Optional.">
                  {(id) => <Textarea id={id} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />}
                </Field>
              </CardBody>
            </Card>
          </div>

          {/* Summary */}
          <div className="flex flex-col gap-5 xl:sticky xl:top-24 xl:self-start">
            <Card>
              <CardHeader title="Summary" />
              <CardBody className="flex flex-col gap-4">
                {c.totals && (
                  <>
                    <AmountWithType
                      label="Discount"
                      value={discount}
                      onChange={setDiscount}
                      type={discountType}
                      onType={setDiscountType}
                      error={errors.discount}
                    />
                    <AmountWithType label="Tax" value={tax} onChange={setTax} type={taxType} onType={setTaxType} />
                  </>
                )}
                <dl className="flex flex-col gap-2 text-sm">
                  <Row label="Items total" value={money(subtotal)} />
                  {c.totals && <Row label="Discount" value={`− ${money(discountValue)}`} />}
                  {c.totals && <Row label="Tax" value={money(taxValue)} />}
                  <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3">
                    <dt className="font-semibold text-ink">Total</dt>
                    <dd className="num text-xl font-semibold text-ink">{money(total)}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            {c.payment && !editingDraft && (
              <Card>
                <CardHeader title="Payment received now" description="Leave 0 if the customer will pay later." />
                <CardBody className="flex flex-col gap-4">
                  <Field label="Amount received" error={errors.paid}>
                    {(id) => (
                      <div className="flex gap-2">
                        <Input id={id} type="number" inputMode="decimal" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} className="num" />
                        <Button variant="secondary" onClick={() => setPaid(total.toFixed(2))}>
                          Full
                        </Button>
                      </div>
                    )}
                  </Field>
                  {paidValue > 0 && (
                    <Field label="Paid by">
                      {(id) => (
                        <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
                          {METHODS.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  )}
                  <div className={cn('flex justify-between rounded-[var(--radius-control)] px-3 py-2.5 text-sm', due > 0 ? 'bg-warn-soft' : 'bg-good-soft')}>
                    <span className={due > 0 ? 'text-warn' : 'text-good'}>{due > 0 ? 'Still to pay' : 'Fully paid'}</span>
                    <span className={cn('num font-semibold', due > 0 ? 'text-warn' : 'text-good')}>{money(due)}</span>
                  </div>
                </CardBody>
              </Card>
            )}

            {kind === 'sales' && (
              <p className="flex gap-2 px-1 text-[13px] text-ink-3">
                <Info className="mt-0.5 size-4 shrink-0" />
                Sales orders do not change stock. Create an invoice for the sale to reduce stock.
              </p>
            )}

            {kind === 'quotation' && (
              <p className="flex gap-2 px-1 text-[13px] text-ink-3">
                <Info className="mt-0.5 size-4 shrink-0" />
                When the customer agrees, open the quotation and turn it into an invoice.
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Button size="lg" onClick={() => save(false)} loading={saving} className="w-full">
                {editingDraft ? 'Save and issue invoice' : editId ? 'Save changes' : c.saveLabel}
              </Button>
              {c.drafts && (!editId || editingDraft) && (
                <Button size="lg" variant="secondary" onClick={() => save(true)} disabled={saving} className="w-full">
                  {editingDraft ? 'Save draft' : 'Save as draft'}
                </Button>
              )}
              {c.drafts && (!editId || editingDraft) && (
                <p className="px-1 text-center text-xs text-ink-3">A draft does not change stock, balances or accounts until you issue it.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </TenantLayout>
  )
}

function NumberCell({ label, value, onChange, invalid }: { label: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] text-ink-3 @3xl:sr-only">{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('num text-right', invalid && 'border-bad focus:border-bad focus:ring-bad/15')}
        aria-invalid={invalid || undefined}
      />
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-2">{label}</dt>
      <dd className="num text-ink">{value}</dd>
    </div>
  )
}

function AmountWithType({
  label, value, onChange, type, onType, error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type: 'fixed' | 'percent'
  onType: (t: 'fixed' | 'percent') => void
  error?: string
}) {
  return (
    <Field label={label} error={error}>
      {(id) => (
        <div className="flex">
          <Input id={id} type="number" inputMode="decimal" min="0" value={value} onChange={(e) => onChange(e.target.value)} className="num rounded-r-none" />
          <div className="flex shrink-0 overflow-hidden rounded-r-[var(--radius-control)] border border-l-0 border-line-strong" role="group" aria-label={`${label} type`}>
            {(['fixed', 'percent'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onType(t)}
                aria-pressed={type === t}
                className={cn('h-9 w-12 text-[13px] font-medium', type === t ? 'bg-nav text-white' : 'bg-surface text-ink-2 hover:bg-subtle')}
              >
                {t === 'fixed' ? 'PKR' : '%'}
              </button>
            ))}
          </div>
        </div>
      )}
    </Field>
  )
}
