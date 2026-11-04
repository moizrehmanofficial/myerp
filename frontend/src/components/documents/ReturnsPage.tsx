'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2, Undo2 } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import { Button, Card, Field, Input, Select, Modal, Table, TableWrap, Th, Td, Tr, Spinner, EmptyState, StatusBadge } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, number, date } from '@/lib/format'

const CONFIG = {
  sale: {
    module: 'sales', title: 'Sale returns', subtitle: 'Goods customers have brought back',
    url: '/erp/returns/sale', partiesUrl: '/erp/returns/customers', partyKey: 'customerId', partyName: 'customerName',
    party: 'Customer', price: 'salePrice', add: 'Record sale return',
    effect: 'Stock goes back up and the customer owes you less (or gets credit).',
  },
  purchase: {
    module: 'purchase', title: 'Purchase returns', subtitle: 'Goods you have sent back to suppliers',
    url: '/erp/returns/purchase', partiesUrl: '/erp/returns/suppliers', partyKey: 'supplierId', partyName: 'supplierName',
    party: 'Supplier', price: 'purchasePrice', add: 'Record purchase return',
    effect: 'Stock goes down and you owe the supplier less.',
  },
}

interface Line { productId: string; quantity: string; unitPrice: string }
const EMPTY: Line = { productId: '', quantity: '1', unitPrice: '' }

export default function ReturnsPage({ kind }: { kind: 'sale' | 'purchase' }) {
  const c = CONFIG[kind]
  const [rows, setRows] = useState<any[]>([])
  const [parties, setParties] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [partyId, setPartyId] = useState('')
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY }])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const { canWrite } = usePermission()

  const load = useCallback(async () => {
    try {
      const [r, p, pr] = await Promise.all([tenantApi.get(c.url), tenantApi.get(c.partiesUrl), tenantApi.get('/erp/returns/products')])
      setRows(r.data.data || [])
      setParties(p.data.data || [])
      setProducts(pr.data.data || [])
    } catch (err) {
      toast.error(apiError(err, 'Could not load returns.'))
    } finally {
      setLoading(false)
    }
  }, [c.url, c.partiesUrl])

  useEffect(() => {
    load()
  }, [load])

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0)

  function update(i: number, field: keyof Line, v: string) {
    setLines((ls) => {
      const next = [...ls]
      next[i] = { ...next[i], [field]: v }
      if (field === 'productId') next[i].unitPrice = String(Number(byId.get(v)?.[c.price] || 0))
      return next
    })
  }

  function openForm() {
    setPartyId('')
    setReason('')
    setLines([{ ...EMPTY }])
    setError('')
    setOpen(true)
  }

  async function save() {
    const valid = lines.filter((l) => l.productId)
    if (!partyId) return setError(`Choose the ${c.party.toLowerCase()}.`)
    if (!valid.length) return setError('Add at least one product.')
    if (valid.some((l) => !(Number(l.quantity) > 0))) return setError('Every quantity must be more than 0.')
    if (kind === 'purchase') {
      const tooMany = valid.find((l) => Number(l.quantity) > Number(byId.get(l.productId)?.stock || 0))
      if (tooMany) return setError(`Only ${number(byId.get(tooMany.productId)?.stock)} of ${byId.get(tooMany.productId)?.name} in stock.`)
    }
    setError('')
    setSaving(true)
    try {
      await tenantApi.post(c.url, { [c.partyKey]: partyId, reason, items: valid })
      toast.success('Return recorded')
      setOpen(false)
      load()
    } catch (err) {
      toast.error(apiError(err, 'Could not record the return.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TenantLayout
      title={c.title}
      subtitle={c.subtitle}
      requiredModule={c.module}
      headerRight={canWrite(c.module) ? <Button icon={<Plus className="size-4" />} onClick={openForm}>{c.add}</Button> : undefined}
    >
      <Card>
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Undo2 />} title="No returns yet" description={c.effect} />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Return</Th>
                  <Th className="hidden sm:table-cell">{c.party}</Th>
                  <Th className="hidden md:table-cell">Reason</Th>
                  <Th align="right">Amount</Th>
                  <Th className="hidden sm:table-cell">Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <p className="font-medium">{r.returnNumber}</p>
                      <p className="text-xs text-ink-3">
                        <span className="sm:hidden">{r[c.partyName]}, </span>
                        {date(r.createdAt)}
                      </p>
                    </Td>
                    <Td className="hidden sm:table-cell">{r[c.partyName] || '—'}</Td>
                    <Td className="hidden max-w-xs truncate text-ink-2 md:table-cell">{r.reason || '—'}</Td>
                    <Td align="right" className="font-medium">{money(r.totalAmount)}</Td>
                    <Td className="hidden sm:table-cell"><StatusBadge status={r.status === 'PENDING' ? 'COMPLETED' : r.status} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={c.add}
        description={c.effect}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save return</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <p className="rounded-[var(--radius-control)] bg-bad-soft px-3 py-2 text-[13px] text-bad" role="alert">{error}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={c.party} required>
              {(id) => (
                <Select id={id} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                  <option value="">Choose a {c.party.toLowerCase()}</option>
                  {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Reason" hint="e.g. Damaged, wrong item">
              {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
            </Field>
          </div>

          <div className="flex flex-col gap-3">
            {lines.map((l, i) => {
              const p = byId.get(l.productId)
              return (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-[var(--radius-control)] border border-line p-3 sm:grid-cols-[minmax(0,1fr)_90px_120px_auto] sm:items-start sm:border-0 sm:p-0">
                  <div className="col-span-2 sm:col-span-1">
                    <Select aria-label={`Product ${i + 1}`} value={l.productId} onChange={(e) => update(i, 'productId', e.target.value)}>
                      <option value="">Choose a product</option>
                      {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name} ({pr.sku})</option>)}
                    </Select>
                    {p && kind === 'purchase' && <p className="mt-1 text-xs text-ink-3">{number(p.stock)} {p.unit} in stock</p>}
                  </div>
                  <Input aria-label="Quantity" type="number" min="0" inputMode="decimal" value={l.quantity} onChange={(e) => update(i, 'quantity', e.target.value)} className="num text-right" placeholder="Qty" />
                  <Input aria-label="Price" type="number" min="0" inputMode="decimal" value={l.unitPrice} onChange={(e) => update(i, 'unitPrice', e.target.value)} className="num text-right" placeholder="Price" />
                  <button
                    type="button"
                    onClick={() => setLines((ls) => (ls.length === 1 ? [{ ...EMPTY }] : ls.filter((_, j) => j !== i)))}
                    className="flex size-9 items-center justify-center rounded-md text-ink-3 hover:bg-bad-soft hover:text-bad"
                    aria-label={`Remove line ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )
            })}
            <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => setLines((ls) => [...ls, { ...EMPTY }])} className="self-start">
              Add line
            </Button>
          </div>

          <div className="flex justify-between border-t border-line pt-3">
            <span className="font-medium">Return total</span>
            <span className="num text-lg font-semibold">{money(total)}</span>
          </div>
        </div>
      </Modal>
    </TenantLayout>
  )
}
