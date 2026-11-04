'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { BookText, ChevronDown, ChevronRight, CircleCheck, CircleAlert, Plus, Trash2 } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import Pagination from '@/components/common/Pagination'
import { Badge, Button, Card, Field, Input, Modal, Select, Table, TableWrap, Th, Td, Tr, Spinner, EmptyState, IconAction } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, date } from '@/lib/format'
import { cn } from '@/utils/utils'
import { ACCOUNT_TYPES, sourceLabel } from './accounting'

type Line = { accountId: string; debit: string; credit: string; description: string }
const blank = (): Line => ({ accountId: '', debit: '', credit: '', description: '' })

export default function JournalPage() {
  const { canWrite } = usePermission()
  const [rows, setRows] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [lines, setLines] = useState<Line[]>([blank(), blank()])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (p: number, l: number) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/finance/journals?page=${p}&limit=${l}`)
      setRows(res.data.data || [])
      setMeta(res.data.meta)
    } catch (err) {
      toast.error(apiError(err, 'Could not load journal entries.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page, limit)
  }, [load, page, limit])

  useEffect(() => {
    tenantApi
      .get('/erp/finance/accounts')
      .then((r) => setAccounts(r.data.data?.accounts || []))
      .catch(() => {})
  }, [])

  const num = (v: string) => Math.round((parseFloat(v) || 0) * 100) / 100
  const totalDr = lines.reduce((s, l) => s + num(l.debit), 0)
  const totalCr = lines.reduce((s, l) => s + num(l.credit), 0)
  const diff = Math.round((totalDr - totalCr) * 100) / 100
  const balanced = diff === 0 && totalDr > 0

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }

  function openForm() {
    setDescription('')
    setReference('')
    setLines([blank(), blank()])
    setError('')
    setShowForm(true)
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!description.trim()) return setError('Write what this entry is for.')
    const used = lines.filter((l) => l.accountId || num(l.debit) || num(l.credit))
    if (used.length < 2) return setError('An entry needs at least two lines.')
    if (used.some((l) => !l.accountId)) return setError('Pick an account on every line.')
    if (used.some((l) => num(l.debit) > 0 && num(l.credit) > 0)) return setError('A line is either a debit or a credit, not both.')
    if (!balanced) return setError('Total debits must equal total credits.')
    setError('')
    setSaving(true)
    try {
      await tenantApi.post('/erp/finance/journals', {
        description: description.trim(),
        reference: reference.trim(),
        items: used.map((l) => ({ accountId: l.accountId, debit: num(l.debit), credit: num(l.credit), description: l.description })),
      })
      toast.success('Journal entry posted')
      setShowForm(false)
      setPage(1)
      load(1, limit)
    } catch (err) {
      setError(apiError(err, 'Could not post the entry.'))
    } finally {
      setSaving(false)
    }
  }

  const totalOf = (j: any, k: 'debit' | 'credit') => (j.items || []).reduce((s: number, i: any) => s + Number(i[k] || 0), 0)

  return (
    <TenantLayout
      title="Journal entries"
      subtitle="Every posting in the books. Invoices, purchases and vouchers add entries here by themselves."
      requiredModule="finance"
      headerRight={
        <>
          <ExportButton
            data={rows}
            filename="journal-entries"
            title="Journal entries"
            subtitle={new Date().toLocaleDateString('en-GB')}
            columns={[
              { header: 'Entry', value: (r: any) => r.entryNumber, width: 14 },
              { header: 'Date', value: (r: any) => date(r.createdAt), width: 14 },
              { header: 'Description', value: (r: any) => r.description || '', width: 36 },
              { header: 'Source', value: (r: any) => sourceLabel(r.sourceType), width: 16 },
              { header: 'Amount', value: (r: any) => totalOf(r, 'debit').toFixed(2), width: 16 },
            ]}
          />
          {canWrite('finance') && (
            <Button icon={<Plus className="size-4" />} onClick={openForm}>
              New journal entry
            </Button>
          )}
        </>
      }
    >
      <Card>
        {loading ? (
          <Spinner label="Loading journal entries" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<BookText />}
            title="No journal entries yet"
            description="They appear when you create invoices, receive purchases or record payments. You can also post one by hand."
            action={canWrite('finance') ? <Button icon={<Plus className="size-4" />} onClick={openForm}>New journal entry</Button> : undefined}
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th className="w-10"><span className="sr-only">Show lines</span></Th>
                    <Th>Entry</Th>
                    <Th className="hidden md:table-cell">Source</Th>
                    <Th align="right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((j) => {
                    const isOpen = !!open[j.id]
                    return (
                      <Fragment key={j.id}>
                        <Tr onClick={() => setOpen((o) => ({ ...o, [j.id]: !isOpen }))}>
                          <Td className="pr-0 text-ink-3">
                            <span aria-hidden>{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</span>
                            <span className="sr-only">{isOpen ? 'Hide lines' : 'Show lines'}</span>
                          </Td>
                          <Td>
                            <p className="font-medium">{j.description || 'Journal entry'}</p>
                            <p className="mt-0.5 text-xs text-ink-3">
                              <span className="num">{j.entryNumber}</span>, {date(j.createdAt)}
                              {j.reference ? `, ref ${j.reference}` : ''}
                              <span className="md:hidden">, {sourceLabel(j.sourceType)}</span>
                            </p>
                          </Td>
                          <Td className="hidden md:table-cell">
                            <Badge tone={j.sourceType && j.sourceType !== 'manual' ? 'neutral' : 'brand'}>{sourceLabel(j.sourceType)}</Badge>
                          </Td>
                          <Td align="right" className="font-medium">{money(totalOf(j, 'debit'))}</Td>
                        </Tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={4} className="border-b border-line bg-subtle/60 px-4 py-3 sm:pl-14">
                              <table className="w-full text-[13px]">
                                <thead>
                                  <tr className="text-ink-3">
                                    <th className="pb-1.5 text-left font-medium">Account</th>
                                    <th className="pb-1.5 text-right font-medium">Debit</th>
                                    <th className="pb-1.5 text-right font-medium">Credit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(j.items || []).map((it: any) => (
                                    <tr key={it.id} className="border-t border-line">
                                      <td className={cn('py-1.5', Number(it.credit) > 0 && 'pl-6')}>
                                        <span className="num text-ink-3">{it.accountCode}</span> {it.accountName}
                                        {it.description && <span className="block text-xs text-ink-3">{it.description}</span>}
                                      </td>
                                      <td className="num py-1.5 text-right">{Number(it.debit) > 0 ? money(it.debit) : ''}</td>
                                      <td className="num py-1.5 text-right">{Number(it.credit) > 0 ? money(it.credit) : ''}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </Table>
            </TableWrap>
            {meta && <Pagination page={page} totalPages={meta.totalPages || 1} total={meta.total || 0} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />}
          </>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        size="xl"
        title="New journal entry"
        description="For things no other screen records, like depreciation or the owner putting in capital."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} loading={saving} disabled={!balanced}>Post entry</Button>
          </>
        }
      >
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Description" required className="sm:col-span-2">
              {(id) => <Input id={id} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Owner added capital" autoFocus />}
            </Field>
            <Field label="Reference">
              {(id) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />}
            </Field>
          </div>

          <div className="@container rounded-[var(--radius-control)] border border-line">
            <div className="hidden grid-cols-[minmax(0,1fr)_130px_130px_32px] gap-2 border-b border-line bg-subtle px-3 py-2 text-[13px] font-semibold text-ink-2 @2xl:grid">
              <span>Account</span>
              <span className="text-right">Debit</span>
              <span className="text-right">Credit</span>
              <span />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 border-b border-line px-3 py-3 last:border-b-0 @2xl:grid-cols-[minmax(0,1fr)_130px_130px_32px] @2xl:py-2">
                <div className="col-span-2 flex flex-col gap-2 @2xl:col-span-1">
                  <label className="sr-only" htmlFor={`acc-${i}`}>Account for line {i + 1}</label>
                  <Select id={`acc-${i}`} value={l.accountId} onChange={(e) => setLine(i, { accountId: e.target.value })}>
                    <option value="">Choose account</option>
                    {ACCOUNT_TYPES.map((t) => (
                      <optgroup key={t.key} label={t.plural}>
                        {accounts.filter((a) => a.type === t.key).map((a) => (
                          <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                  <Input aria-label={`Note for line ${i + 1}`} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Line note (optional)" className="h-8 text-[13px]" />
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-3 @2xl:sr-only">Debit</span>
                  <Input type="number" min="0" step="0.01" inputMode="decimal" className="num text-right" value={l.debit} placeholder="0"
                    onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-3 @2xl:sr-only">Credit</span>
                  <Input type="number" min="0" step="0.01" inputMode="decimal" className="num text-right" value={l.credit} placeholder="0"
                    onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} />
                </label>
                <div className="col-span-2 flex justify-end @2xl:col-span-1 @2xl:items-start">
                  <IconAction label={`Remove line ${i + 1}`} onClick={() => lines.length > 2 && setLines(lines.filter((_, j) => j !== i))} danger>
                    <Trash2 />
                  </IconAction>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle px-3 py-2.5">
              <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => setLines([...lines, blank()])}>
                Add line
              </Button>
              <div className="num flex gap-5 text-[13px]">
                <span>Debit <strong className="text-ink">{money(totalDr)}</strong></span>
                <span>Credit <strong className="text-ink">{money(totalCr)}</strong></span>
              </div>
            </div>
          </div>

          <p className={cn('flex items-center gap-2 text-[13px]', balanced ? 'text-good' : 'text-ink-3')}>
            {balanced ? <CircleCheck className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
            {balanced ? 'Debits equal credits. Ready to post.' : totalDr || totalCr ? `Difference ${money(Math.abs(diff))}. Debits must equal credits.` : 'Enter the amounts. Debits must equal credits.'}
          </p>
          {error && <p className="rounded-[var(--radius-control)] bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
    </TenantLayout>
  )
}
