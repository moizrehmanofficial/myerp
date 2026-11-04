'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Factory, Plus, Trash2 } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import Pagination from '@/components/common/Pagination'
import {
  Badge, Button, Card, Field, Input, Modal, Select, Spinner, Table, TableWrap, Textarea, Th, Td, Tr,
  EmptyState, IconAction, ListToolbar, FilterChips, useConfirm,
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { number, date } from '@/lib/format'
import { useCompanyHref } from '@/lib/useCompanyHref'
import { MFG_TONE, mfgStatusLabel } from '@/components/manufacturing/mfg'
import { cn } from '@/utils/utils'

type Filter = 'ALL' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type Line = { productId: string; requiredQuantity: string }

export default function ManufacturingPage() {
  const router = useRouter()
  const href = useCompanyHref()
  const { canWrite, canDelete } = usePermission()
  const [orders, setOrders] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ productId: '', quantity: '1', startDate: '', endDate: '', notes: '' })
  const [lines, setLines] = useState<Line[]>([{ productId: '', requiredQuantity: '' }])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  const load = useCallback(async (p: number, l: number) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/manufacturing/orders?page=${p}&limit=${l}`)
      setOrders(res.data.data || [])
      setMeta(res.data.meta)
    } catch (err) {
      toast.error(apiError(err, 'Could not load production orders.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page, limit)
  }, [load, page, limit])

  function openForm() {
    setForm({ productId: '', quantity: '1', startDate: '', endDate: '', notes: '' })
    setLines([{ productId: '', requiredQuantity: '' }])
    setError('')
    setShowForm(true)
    tenantApi.get('/erp/manufacturing/products').then((r) => setProducts(r.data.data || [])).catch(() => {})
  }

  const byId = (id: string) => products.find((p) => p.id === id)

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    const used = lines.filter((l) => l.productId)
    if (!form.productId) return setError('Choose the product you will make.')
    if (!(Number(form.quantity) > 0)) return setError('Quantity to make must be more than 0.')
    if (!used.length) return setError('Add at least one raw material.')
    if (used.some((l) => !(Number(l.requiredQuantity) > 0))) return setError('Every raw material needs a quantity.')
    if (used.some((l) => l.productId === form.productId)) return setError('The product you are making cannot also be a raw material.')
    setError('')
    setSaving(true)
    try {
      const res = await tenantApi.post('/erp/manufacturing/orders', { ...form, materials: used })
      toast.success(`${res.data.data?.orderNumber || 'Order'} created`)
      setShowForm(false)
      if (res.data.data?.id) router.push(href(`/erp/manufacturing/${res.data.data.id}`))
      else load(1, limit)
    } catch (err) {
      setError(apiError(err, 'Could not create the order.'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(o: any) {
    const ok = await confirm({
      title: `Delete ${o.orderNumber}?`,
      message: o.status === 'COMPLETED' ? 'The finished goods are taken out of stock and the raw materials put back.' : undefined,
      confirmLabel: 'Delete order',
      danger: true,
    })
    if (!ok) return
    try {
      await tenantApi.delete(`/erp/manufacturing/orders/${o.id}`)
      toast.success(`${o.orderNumber} deleted`)
      load(page, limit)
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the order.'))
    }
  }

  const rows = filter === 'ALL' ? orders : orders.filter((o) => o.status === filter)
  const count = (k: Filter) => (k === 'ALL' ? orders.length : orders.filter((o) => o.status === k).length)

  return (
    <TenantLayout
      title="Manufacturing"
      subtitle="Turn raw materials into finished products"
      requiredModule="manufacturing"
      headerRight={canWrite('manufacturing') && <Button icon={<Plus className="size-4" />} onClick={openForm}>New production order</Button>}
    >
      <Card>
        <ListToolbar>
          <FilterChips<Filter>
            options={(['ALL', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as Filter[]).map((k) => ({ key: k, label: k === 'ALL' ? 'All' : mfgStatusLabel(k), count: count(k) }))}
            value={filter}
            onChange={setFilter}
          />
        </ListToolbar>
        {loading ? (
          <Spinner label="Loading production orders" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Factory />}
            title={orders.length ? 'No orders with this status' : 'No production orders yet'}
            description={orders.length ? undefined : 'Plan what to make and which materials it uses. Stock moves when you mark it completed.'}
            action={!orders.length && canWrite('manufacturing') ? <Button icon={<Plus className="size-4" />} onClick={openForm}>New production order</Button> : undefined}
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th className="hidden sm:table-cell">Product</Th>
                    <Th align="right">Quantity</Th>
                    <Th className="hidden md:table-cell">Dates</Th>
                    <Th>Status</Th>
                    <Th align="right"><span className="sr-only">Actions</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <Tr key={o.id} onClick={() => router.push(href(`/erp/manufacturing/${o.id}`))}>
                      <Td>
                        <p className="font-medium">{o.orderNumber}</p>
                        <p className="text-xs text-ink-3"><span className="sm:hidden">{o.productName}, </span>{date(o.createdAt)}</p>
                      </Td>
                      <Td className="hidden sm:table-cell">
                        <p>{o.productName}</p>
                        {o.productSku && <p className="text-xs text-ink-3">{o.productSku}</p>}
                      </Td>
                      <Td align="right">{number(o.quantity)} <span className="text-xs text-ink-3">{o.productUnit || 'pcs'}</span></Td>
                      <Td className="hidden text-ink-2 md:table-cell">
                        {o.startDate || o.endDate ? `${o.startDate ? date(o.startDate) : '…'} to ${o.endDate ? date(o.endDate) : '…'}` : '—'}
                      </Td>
                      <Td><Badge tone={MFG_TONE[o.status]}>{mfgStatusLabel(o.status)}</Badge></Td>
                      <Td align="right">
                        {canDelete('manufacturing') && <IconAction label={`Delete ${o.orderNumber}`} onClick={() => remove(o)} danger><Trash2 /></IconAction>}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            {meta && <Pagination page={page} totalPages={meta.totalPages || 1} total={meta.total || 0} limit={limit} onPageChange={setPage} onLimitChange={(l) => { setPage(1); setLimit(l) }} />}
          </>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        size="lg"
        title="New production order"
        description="Nothing leaves stock until you mark the order completed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} loading={saving}>Create order</Button>
          </>
        }
      >
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Product to make" required className="sm:col-span-2">
              {(id) => (
                <Select id={id} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                  <option value="">Choose product</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Quantity" required hint={byId(form.productId)?.unit}>
              {(id) => <Input id={id} type="number" min="0" step="any" className="num" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />}
            </Field>
            <Field label="Start">{(id) => <Input id={id} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />}</Field>
            <Field label="Finish by">{(id) => <Input id={id} type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />}</Field>
          </div>

          <div className="rounded-[var(--radius-control)] border border-line">
            <div className="flex items-center justify-between border-b border-line bg-subtle px-3 py-2">
              <p className="text-[13px] font-semibold text-ink-2">Raw materials for the whole order</p>
              <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setLines([...lines, { productId: '', requiredQuantity: '' }])}>Add material</Button>
            </div>
            {lines.map((l, i) => {
              const p = byId(l.productId)
              const short = p && Number(l.requiredQuantity) > Number(p.stock)
              return (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_110px_32px] items-start gap-2 border-b border-line px-3 py-2.5 last:border-b-0">
                  <div>
                    <Select aria-label={`Material ${i + 1}`} value={l.productId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))}>
                      <option value="">Choose material</option>
                      {products.filter((x) => x.id !== form.productId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </Select>
                    {p && <p className={cn('mt-1 text-xs', short ? 'text-bad' : 'text-ink-3')}>{number(p.stock)} {p.unit || 'pcs'} in stock{short ? ', not enough yet' : ''}</p>}
                  </div>
                  <Input aria-label={`Quantity of material ${i + 1}`} type="number" min="0" step="any" className="num" placeholder="Qty" value={l.requiredQuantity}
                    onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, requiredQuantity: e.target.value } : x)))} />
                  <IconAction label={`Remove material ${i + 1}`} onClick={() => lines.length > 1 && setLines(lines.filter((_, j) => j !== i))} danger><Trash2 /></IconAction>
                </div>
              )
            })}
          </div>

          <Field label="Notes">{(id) => <Textarea id={id} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}</Field>
          {error && <p className="rounded-[var(--radius-control)] bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
      {confirmDialog}
    </TenantLayout>
  )
}
