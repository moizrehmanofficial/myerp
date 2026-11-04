'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import Pagination from '@/components/common/Pagination'
import { Badge, Button, Card, Field, Input, Modal, Segmented, Select, Table, TableWrap, Th, Td, Tr, Spinner, EmptyState } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, date } from '@/lib/format'
import { PAY_METHODS, methodLabel } from './accounting'

type Kind = 'payment' | 'receipt'
type Party = 'supplier' | 'customer' | 'other'
type Method = (typeof PAY_METHODS)[number]['key']

const TEXT = {
  payment: {
    title: 'Payments',
    subtitle: 'Money going out: paying suppliers, expenses and refunds',
    endpoint: '/erp/finance/payments',
    add: 'Record payment',
    done: 'Payment recorded',
    one: 'payment',
    icon: ArrowUpRight,
    parties: [
      { key: 'supplier' as Party, label: 'Pay a supplier' },
      { key: 'other' as Party, label: 'Pay an expense' },
      { key: 'customer' as Party, label: 'Refund a customer' },
    ],
    accountLabel: 'Paid from',
    otherLabel: 'Expense account',
    otherTypes: ['EXPENSE', 'LIABILITY', 'ASSET', 'EQUITY'],
  },
  receipt: {
    title: 'Receipts',
    subtitle: 'Money coming in: from customers, other income and refunds',
    endpoint: '/erp/finance/receipts',
    add: 'Record receipt',
    done: 'Receipt recorded',
    one: 'receipt',
    icon: ArrowDownLeft,
    parties: [
      { key: 'customer' as Party, label: 'From a customer' },
      { key: 'other' as Party, label: 'Other income' },
      { key: 'supplier' as Party, label: 'Refund from supplier' },
    ],
    accountLabel: 'Received into',
    otherLabel: 'Income account',
    otherTypes: ['INCOME', 'LIABILITY', 'EQUITY', 'ASSET'],
  },
}

const PARTY_HINT: Record<Kind, Record<Party, string>> = {
  payment: {
    supplier: 'Lowers what you owe this supplier.',
    customer: 'Money given back to a customer. Their balance goes up.',
    other: 'Rent, utilities, salaries and other running costs.',
  },
  receipt: {
    customer: 'Lowers what this customer owes. Their oldest unpaid invoices are marked paid first.',
    supplier: 'Money a supplier gave back to you.',
    other: 'Money earned outside of invoices, like interest or scrap sales.',
  },
}

export default function VoucherPage({ kind }: { kind: Kind }) {
  const t = TEXT[kind]
  const { canWrite } = usePermission()
  const [rows, setRows] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [accounts, setAccounts] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [party, setParty] = useState<Party>(t.parties[0].key)
  const [form, setForm] = useState({ amount: '', method: 'CASH' as Method, partyId: '', otherAccountId: '', moneyAccountId: '', reference: '', notes: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (p: number, l: number) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`${t.endpoint}?page=${p}&limit=${l}`)
      setRows(res.data.data || [])
      setMeta(res.data.meta)
    } catch (err) {
      toast.error(apiError(err, `Could not load ${t.title.toLowerCase()}.`))
    } finally {
      setLoading(false)
    }
  }, [t.endpoint, t.title])

  useEffect(() => {
    load(page, limit)
  }, [load, page, limit])

  async function loadLookups() {
    const [a, s, c] = await Promise.allSettled([
      tenantApi.get('/erp/finance/accounts'),
      tenantApi.get('/erp/purchase/suppliers'),
      tenantApi.get('/erp/invoices/customers'),
    ])
    if (a.status === 'fulfilled') setAccounts(a.value.data.data?.accounts || [])
    if (s.status === 'fulfilled') setSuppliers(s.value.data.data || [])
    if (c.status === 'fulfilled') setCustomers(c.value.data.data || [])
  }

  function openForm() {
    setParty(t.parties[0].key)
    setForm({ amount: '', method: 'CASH', partyId: '', otherAccountId: '', moneyAccountId: '', reference: '', notes: '' })
    setError('')
    setShowForm(true)
    loadLookups()
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    const amount = Math.round((parseFloat(form.amount) || 0) * 100) / 100
    if (party !== 'other' && !form.partyId) return setError(`Choose the ${party}.`)
    if (party === 'other' && !form.otherAccountId) return setError(`Choose the ${t.otherLabel.toLowerCase()}.`)
    if (!(amount > 0)) return setError('Enter an amount above 0.')
    setError('')

    const body: any = { amount, method: form.method, reference: form.reference.trim(), notes: form.notes.trim() }
    if (party === 'supplier') body.supplierId = form.partyId
    if (party === 'customer') body.customerId = form.partyId
    // The cash/bank side, and the "other" side
    if (kind === 'payment') {
      if (form.moneyAccountId) body.creditAccountId = form.moneyAccountId
      if (party === 'other') body.debitAccountId = form.otherAccountId
    } else {
      if (form.moneyAccountId) body.debitAccountId = form.moneyAccountId
      if (party === 'other') body.creditAccountId = form.otherAccountId
    }

    setSaving(true)
    try {
      await tenantApi.post(t.endpoint, body)
      toast.success(`${t.done}: ${money(amount)}`)
      setShowForm(false)
      setPage(1)
      load(1, limit)
    } catch (err) {
      setError(apiError(err, `Could not record the ${t.one}.`))
    } finally {
      setSaving(false)
    }
  }

  const people = party === 'supplier' ? suppliers : customers
  const selected = people.find((p) => p.id === form.partyId)
  const bal = Number(selected?.balance || 0)
  const balText = selected
    ? party === 'supplier'
      ? bal > 0 ? `You owe ${money(bal)}` : bal < 0 ? `They owe you ${money(-bal)} (advance)` : 'Nothing owed'
      : bal > 0 ? `Owes you ${money(bal)}` : bal < 0 ? `Has ${money(-bal)} credit with you` : 'Nothing owed'
    : undefined
  const moneyAccounts = accounts.filter((a) => a.type === 'ASSET')
  const otherAccounts = t.otherTypes.flatMap((type) => accounts.filter((a) => a.type === type))
  const Icon = t.icon

  const who = (r: any) => r.supplierName || r.customerName || r.notes || 'Other'
  const whoKind = (r: any) => (r.supplierName ? 'Supplier' : r.customerName ? 'Customer' : kind === 'payment' ? 'Expense' : 'Other income')

  return (
    <TenantLayout
      title={t.title}
      subtitle={t.subtitle}
      requiredModule="finance"
      headerRight={
        <>
          <ExportButton
            data={rows}
            filename={t.title.toLowerCase()}
            title={t.title}
            subtitle={new Date().toLocaleDateString('en-GB')}
            columns={[
              { header: 'Date', value: (r: any) => date(r.createdAt), width: 14 },
              { header: kind === 'payment' ? 'Paid to' : 'Received from', value: who, width: 28 },
              { header: 'Method', value: (r: any) => methodLabel(r.method), width: 12 },
              { header: 'Reference', value: (r: any) => r.reference || '', width: 16 },
              { header: 'Amount (PKR)', value: (r: any) => Number(r.amount || 0).toFixed(2), width: 16 },
            ]}
          />
          {canWrite('finance') && (
            <Button icon={<Plus className="size-4" />} onClick={openForm}>
              {t.add}
            </Button>
          )}
        </>
      }
    >
      <div>
        <Card>
          {loading ? (
            <Spinner label={`Loading ${t.title.toLowerCase()}`} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Icon />}
              title={`No ${t.title.toLowerCase()} yet`}
              description={kind === 'payment' ? 'Record money paid to suppliers or spent on expenses.' : 'Record money received from customers or other income.'}
              action={canWrite('finance') ? <Button icon={<Plus className="size-4" />} onClick={openForm}>{t.add}</Button> : undefined}
            />
          ) : (
            <>
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>{kind === 'payment' ? 'Paid to' : 'Received from'}</Th>
                      <Th className="hidden md:table-cell">Method</Th>
                      <Th className="hidden lg:table-cell">Reference</Th>
                      <Th align="right">Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <Tr key={r.id}>
                        <Td>
                          <p className="font-medium">{who(r)}</p>
                          <p className="mt-0.5 text-xs text-ink-3">
                            {whoKind(r)}, {date(r.createdAt)}
                            <span className="md:hidden">, {methodLabel(r.method)}</span>
                          </p>
                          {(r.supplierName || r.customerName) && r.notes && <p className="mt-0.5 text-xs text-ink-3">{r.notes}</p>}
                        </Td>
                        <Td className="hidden md:table-cell"><Badge>{methodLabel(r.method)}</Badge></Td>
                        <Td className="hidden text-ink-2 lg:table-cell">{r.reference || '—'}</Td>
                        <Td align="right" className="font-semibold">{money(r.amount)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
              {meta && <Pagination page={page} totalPages={meta.totalPages || 1} total={meta.total || 0} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />}
            </>
          )}
        </Card>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        size="lg"
        title={t.add}
        description="The books are updated for you."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} loading={saving}>{t.add}</Button>
          </>
        }
      >
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Segmented
              label="What is this for"
              className="flex-col sm:flex-row"
              options={t.parties}
              value={party}
              onChange={(v) => { setParty(v); setForm({ ...form, partyId: '', otherAccountId: '' }) }}
            />
            <p className="text-xs text-ink-3">{PARTY_HINT[kind][party]}</p>
          </div>

          {party === 'other' ? (
            <Field label={t.otherLabel} required className="sm:col-span-2">
              {(id) => (
                <Select id={id} value={form.otherAccountId} onChange={(e) => setForm({ ...form, otherAccountId: e.target.value })}>
                  <option value="">Choose account</option>
                  {otherAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <Field label={party === 'supplier' ? 'Supplier' : 'Customer'} required hint={balText} className="sm:col-span-2">
              {(id) => (
                <Select id={id} value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
                  <option value="">Choose {party}</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.phone ? ` (${p.phone})` : ''}</option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          <Field label="Amount (PKR)" required>
            {(id) => <Input id={id} type="number" min="0" step="0.01" inputMode="decimal" className="num" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">Method</span>
            <Segmented label="Method" options={[...PAY_METHODS]} value={form.method} onChange={(v) => setForm({ ...form, method: v })} />
          </div>

          <Field label={t.accountLabel} hint="Leave on automatic to use Cash for cash, and Bank for everything else.">
            {(id) => (
              <Select id={id} value={form.moneyAccountId} onChange={(e) => setForm({ ...form, moneyAccountId: e.target.value })}>
                <option value="">Automatic</option>
                {moneyAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reference" hint="Cheque or transaction number">
            {(id) => <Input id={id} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />}
          </Field>
          <Field label="Note" className="sm:col-span-2">
            {(id) => <Input id={id} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={kind === 'payment' ? 'e.g. Office rent for November' : 'e.g. Advance for next order'} />}
          </Field>
          {error && <p className="rounded-[var(--radius-control)] bg-bad-soft px-3 py-2 text-[13px] text-bad sm:col-span-2">{error}</p>}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
    </TenantLayout>
  )
}
