'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Check, CircleAlert, Factory, Play, Printer, RotateCcw, Trash2, X } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import { Badge, Button, Card, CardHeader, Spinner, Table, TableWrap, Th, Td, Tr, EmptyState, buttonStyles, useConfirm } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { number, date } from '@/lib/format'
import { useCompanyHref } from '@/lib/useCompanyHref'
import { cn } from '@/utils/utils'
import { MFG_STEPS, MFG_TONE, mfgStatusLabel } from './mfg'

export default function ManufacturingDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const href = useCompanyHref()
  const { canModify, canDelete } = usePermission()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [confirm, confirmDialog] = useConfirm()

  const load = useCallback(async () => {
    try {
      const res = await tenantApi.get(`/erp/manufacturing/orders/${id}`)
      setOrder(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load this production order.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const status: string = order?.status || ''
  const mats: any[] = order?.materials || []
  const done = status === 'COMPLETED'
  const short = mats.filter((m) => !done && Number(m.requiredQuantity) > Number(m.availableStock))

  async function setStatus(next: string) {
    const msgs: Record<string, { title: string; message: string; label: string; danger?: boolean }> = {
      IN_PROGRESS: done
        ? { title: 'Undo completion?', message: `${number(order.quantity)} ${order.productName} leave stock again and the raw materials are put back.`, label: 'Undo completion', danger: true }
        : { title: 'Start production?', message: 'Nothing changes in stock yet.', label: 'Start' },
      COMPLETED: { title: `Complete ${order.orderNumber}?`, message: `The raw materials below leave stock and ${number(order.quantity)} ${order.productName} are added to stock.`, label: 'Complete and update stock' },
      CANCELLED: { title: `Cancel ${order.orderNumber}?`, message: 'The order stays on file as cancelled.', label: 'Cancel order', danger: true },
      PLANNED: { title: 'Move back to planned?', message: 'Nothing changes in stock.', label: 'Move back' },
    }
    const m = msgs[next]
    if (!(await confirm({ title: m.title, message: m.message, confirmLabel: m.label, danger: m.danger }))) return
    setBusy(next)
    try {
      await tenantApi.patch(`/erp/manufacturing/orders/${id}/status`, { status: next })
      toast.success(next === 'COMPLETED' ? 'Completed. Stock updated.' : `Marked ${mfgStatusLabel(next).toLowerCase()}`)
      load()
    } catch (err) {
      toast.error(apiError(err, 'Could not change the status.'))
    } finally {
      setBusy('')
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete ${order.orderNumber}?`,
      message: done ? 'The finished goods are taken out of stock and the raw materials put back.' : undefined,
      confirmLabel: 'Delete order',
      danger: true,
    })
    if (!ok) return
    try {
      await tenantApi.delete(`/erp/manufacturing/orders/${id}`)
      toast.success(`${order.orderNumber} deleted`)
      router.push(href('/erp/manufacturing'))
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the order.'))
    }
  }

  const stepIndex = MFG_STEPS.findIndex((s) => s.key === status)

  return (
    <TenantLayout
      title={order ? order.orderNumber : 'Production order'}
      subtitle={order ? `${number(order.quantity)} ${order.productUnit || 'pcs'} of ${order.productName}` : undefined}
      requiredModule="manufacturing"
      headerRight={
        <>
          <Link href={href('/erp/manufacturing')} className={buttonStyles({ variant: 'ghost' })}>
            <ArrowLeft className="size-4" aria-hidden />
            All orders
          </Link>
          {order && <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print</Button>}
          {order && canModify('manufacturing') && status === 'PLANNED' && (
            <Button variant="secondary" icon={<Play className="size-4" />} loading={busy === 'IN_PROGRESS'} onClick={() => setStatus('IN_PROGRESS')}>Start</Button>
          )}
          {order && canModify('manufacturing') && (status === 'PLANNED' || status === 'IN_PROGRESS') && (
            <Button icon={<Check className="size-4" />} loading={busy === 'COMPLETED'} disabled={short.length > 0} onClick={() => setStatus('COMPLETED')}>Complete</Button>
          )}
        </>
      }
    >
      {loading ? (
        <Spinner label="Loading order" />
      ) : !order ? (
        <Card><EmptyState icon={<Factory />} title="Order not found" /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div className="flex flex-col gap-5">
            {/* Progress */}
            <Card className="p-4 sm:p-5">
              {status === 'CANCELLED' ? (
                <p className="flex items-center gap-2 text-sm text-bad"><X className="size-4" aria-hidden /> This order was cancelled.</p>
              ) : (
                <ol className="flex items-center gap-2">
                  {MFG_STEPS.map((s, i) => {
                    const reached = i <= stepIndex
                    return (
                      <li key={s.key} className="flex flex-1 items-center gap-2 last:flex-none">
                        <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', reached ? 'bg-brand text-white' : 'border border-line-strong text-ink-3')}>
                          {i < stepIndex || (i === stepIndex && done) ? <Check className="size-4" aria-hidden /> : i + 1}
                        </span>
                        <span className={cn('text-[13px] whitespace-nowrap', reached ? 'font-medium text-ink' : 'text-ink-3')}>{s.label}</span>
                        {i < MFG_STEPS.length - 1 && <span className={cn('mx-1 h-px flex-1', i < stepIndex ? 'bg-brand' : 'bg-line-strong')} aria-hidden />}
                      </li>
                    )
                  })}
                </ol>
              )}
            </Card>

            {short.length > 0 && (status === 'PLANNED' || status === 'IN_PROGRESS') && (
              <div className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-warn/25 bg-warn-soft px-4 py-3 text-sm">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
                <div>
                  <p className="font-medium text-warn">Not enough raw material to complete</p>
                  <p className="text-ink-2">Buy or adjust stock for: {short.map((m) => m.productName).join(', ')}.</p>
                </div>
              </div>
            )}

            <Card>
              <CardHeader title="Raw materials" description={done ? 'Taken out of stock when the order was completed' : 'Taken out of stock when you complete the order'} />
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Material</Th>
                      <Th align="right">{done ? 'Used' : 'Needed'}</Th>
                      <Th align="right" className="hidden sm:table-cell">In stock now</Th>
                      {!done && <Th>Ready</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {mats.map((m) => {
                      const enough = Number(m.availableStock) >= Number(m.requiredQuantity)
                      return (
                        <Tr key={m.id}>
                          <Td>
                            <p className="font-medium">{m.productName}</p>
                            {m.productSku && <p className="text-xs text-ink-3">{m.productSku}</p>}
                          </Td>
                          <Td align="right">{number(done ? m.usedQuantity || m.requiredQuantity : m.requiredQuantity)} <span className="text-xs text-ink-3">{m.unit || 'pcs'}</span></Td>
                          <Td align="right" className="hidden text-ink-2 sm:table-cell">{number(m.availableStock)}</Td>
                          {!done && <Td>{enough ? <Badge tone="good">Enough</Badge> : <Badge tone="bad">Short {number(Number(m.requiredQuantity) - Number(m.availableStock))}</Badge>}</Td>}
                        </Tr>
                      )
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            </Card>
          </div>

          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-line text-sm">
              {[
                ['Status', <Badge key="s" tone={MFG_TONE[status]}>{mfgStatusLabel(status)}</Badge>],
                ['Product', order.productName],
                ['Quantity', `${number(order.quantity)} ${order.productUnit || 'pcs'}`],
                ['In stock now', `${number(order.currentStock)} ${order.productUnit || 'pcs'}`],
                ['Start', order.startDate ? date(order.startDate) : '—'],
                ['Finish by', order.endDate ? date(order.endDate) : '—'],
                ['Created', date(order.createdAt)],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-center justify-between gap-4 px-4 py-2.5 sm:px-5">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {order.notes && <p className="border-t border-line px-4 py-3 text-sm text-ink-2 sm:px-5">{order.notes}</p>}
            {canModify('manufacturing') && (
              <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3 sm:px-5 print:hidden">
                {done && <Button size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} loading={busy === 'IN_PROGRESS'} onClick={() => setStatus('IN_PROGRESS')}>Undo completion</Button>}
                {status === 'IN_PROGRESS' && <Button size="sm" variant="ghost" onClick={() => setStatus('PLANNED')}>Back to planned</Button>}
                {status === 'CANCELLED' && <Button size="sm" variant="secondary" onClick={() => setStatus('PLANNED')}>Reopen</Button>}
                {(status === 'PLANNED' || status === 'IN_PROGRESS') && <Button size="sm" variant="danger-soft" onClick={() => setStatus('CANCELLED')}>Cancel order</Button>}
                {canDelete('manufacturing') && <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={remove} className="ml-auto text-bad hover:text-bad">Delete</Button>}
              </div>
            )}
          </Card>
        </div>
      )}
      {confirmDialog}
    </TenantLayout>
  )
}
