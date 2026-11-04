'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Minus, Plus } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, Textarea } from '@/components/ui'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { number, date } from '@/lib/format'
import { cn } from '@/utils/utils'

// What each stock movement means, in plain words
export function movementLabel(type: string, reference?: string) {
  const t = String(type || '').toUpperCase()
  const ref = String(reference || '')
  if (t === 'ADJUSTMENT_IN') return { text: 'Added by hand', tone: 'good' as const }
  if (t === 'ADJUSTMENT_OUT') return { text: 'Removed by hand', tone: 'bad' as const }
  if (t === 'IN') return { text: ref.startsWith('PO') ? 'Purchase received' : ref.startsWith('INV') ? 'Invoice cancelled' : ref.startsWith('SR') ? 'Customer return' : ref.startsWith('MO') ? 'Produced' : ref.startsWith('PR') ? 'Return cancelled' : 'Stock in', tone: 'good' as const }
  if (t === 'OUT') return { text: ref.startsWith('INV') ? 'Sold (invoice)' : ref.startsWith('PO') ? 'Purchase reversed' : ref.startsWith('PR') ? 'Returned to supplier' : ref.startsWith('MO') ? 'Used in production' : 'Stock out', tone: 'bad' as const }
  return { text: t || 'Movement', tone: 'neutral' as const }
}

export function isStockIn(type: string) {
  return ['IN', 'ADJUSTMENT_IN'].includes(String(type).toUpperCase())
}

export function StockStatus({ stock, min }: { stock: number; min: number }) {
  if (stock <= 0) return <Badge tone="bad">Out of stock</Badge>
  if (min > 0 && stock <= min) return <Badge tone="warn">Low stock</Badge>
  return <Badge tone="good">In stock</Badge>
}

// Add or remove stock by hand (count corrections, damage, samples...)
export function AdjustStockModal({
  product,
  onClose,
  onDone,
}: {
  product: any | null
  onClose: () => void
  onDone: () => void
}) {
  const [type, setType] = useState<'ADD' | 'SUBTRACT'>('ADD')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (product) {
      setType('ADD')
      setQuantity('')
      setNotes('')
      setError('')
    }
  }, [product])

  const current = Number(product?.stock || 0)
  const qty = Number(quantity) || 0
  const after = type === 'ADD' ? current + qty : current - qty

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!(qty > 0)) {
      setError('Enter how many to add or remove.')
      return
    }
    if (after < 0) {
      setError(`You can remove at most ${number(current)}.`)
      return
    }
    setSaving(true)
    try {
      await tenantApi.post('/erp/inventory/adjust', { productId: product.id, quantity, type, notes })
      toast.success('Stock updated')
      onDone()
      onClose()
    } catch (err) {
      toast.error(apiError(err, 'Could not update stock.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title="Adjust stock"
      description={product ? `${product.name} (${product.sku})` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save()} loading={saving}>Update stock</Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Add or remove">
          {[
            { key: 'ADD' as const, label: 'Add stock', icon: Plus },
            { key: 'SUBTRACT' as const, label: 'Remove stock', icon: Minus },
          ].map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={type === o.key}
              onClick={() => setType(o.key)}
              className={cn(
                'flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border text-sm font-medium transition-colors',
                type === o.key ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line-strong text-ink-2 hover:bg-subtle',
              )}
            >
              <o.icon className="size-4" />
              {o.label}
            </button>
          ))}
        </div>
        <Field label="Quantity" required error={error || undefined}>
          {(id) => <Input id={id} type="number" inputMode="decimal" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="num" autoFocus />}
        </Field>
        <Field label="Reason" hint="e.g. Counted stock, damaged items, free sample">
          {(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <div className="flex justify-between rounded-[var(--radius-control)] bg-subtle px-3 py-2.5 text-sm">
          <span className="text-ink-3">
            Now <span className="num font-medium text-ink">{number(current)}</span>
          </span>
          <span className="text-ink-3">
            After <span className={cn('num font-medium', after < 0 ? 'text-bad' : 'text-ink')}>{number(after)}</span> {product?.unit}
          </span>
        </div>
      </form>
    </Modal>
  )
}
