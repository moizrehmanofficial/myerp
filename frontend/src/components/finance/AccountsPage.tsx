'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { BookOpen, CircleCheck, CircleAlert, Plus, Scale } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import {
  Badge, Button, Card, Field, Input, Modal, Segmented, Table, TableWrap, Th, Td, Tr,
  Spinner, EmptyState, SearchInput, ListToolbar, Tabs, FilterChips, buttonStyles,
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money } from '@/lib/format'
import { useCompanyHref } from '@/lib/useCompanyHref'
import { cn } from '@/utils/utils'
import { ACCOUNT_TYPES, TYPE_TONE, typeLabel, type AccountType } from './accounting'

type Mode = 'chart' | 'ledger'
type TypeFilter = 'ALL' | AccountType

const EMPTY = { code: '', name: '', type: 'EXPENSE' as AccountType }

// "chart"  = Chart of accounts (add accounts)
// "ledger" = Ledger & trial balance (read only)
export default function AccountsPage({ mode }: { mode: Mode }) {
  const href = useCompanyHref()
  const { canWrite } = usePermission()
  const [accounts, setAccounts] = useState<any[]>([])
  const [trial, setTrial] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'accounts' | 'trial'>('accounts')
  const [type, setType] = useState<TypeFilter>('ALL')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({})
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const calls = [tenantApi.get('/erp/finance/accounts')]
      if (mode === 'ledger') calls.push(tenantApi.get('/erp/finance/trial-balance'))
      const [a, t] = await Promise.all(calls)
      setAccounts(a.data.data?.accounts || [])
      if (t) setTrial(t.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load accounts.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const totals = useMemo(() => {
    const t: Record<string, { count: number; total: number }> = {}
    for (const at of ACCOUNT_TYPES) t[at.key] = { count: 0, total: 0 }
    for (const a of accounts) {
      if (!t[a.type]) continue
      t[a.type].count++
      t[a.type].total += Number(a.balance || 0)
    }
    return t
  }, [accounts])

  const filtered = accounts.filter((a) => {
    if (type !== 'ALL' && a.type !== type) return false
    if (!search) return true
    const q = search.toLowerCase()
    return String(a.name).toLowerCase().includes(q) || String(a.code).toLowerCase().includes(q)
  })

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    const errs: typeof errors = {}
    if (!form.code.trim()) errs.code = 'Enter a code'
    else if (accounts.some((a) => String(a.code) === form.code.trim())) errs.code = 'This code is already used'
    if (!form.name.trim()) errs.name = 'Enter a name'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      await tenantApi.post('/erp/finance/accounts', { code: form.code.trim(), name: form.name.trim(), type: form.type })
      toast.success(`${form.name.trim()} added`)
      setShowForm(false)
      setForm(EMPTY)
      load()
    } catch (err) {
      toast.error(apiError(err, 'Could not add the account.'))
    } finally {
      setSaving(false)
    }
  }

  // Trial balance: each account's net, shown on its debit or credit side
  const trialRows = (trial?.accounts || [])
    .map((a: any) => {
      const net = Number(a.totalDebit || 0) - Number(a.totalCredit || 0)
      return { ...a, dr: net > 0 ? net : 0, cr: net < 0 ? -net : 0 }
    })
    .filter((a: any) => a.dr > 0.004 || a.cr > 0.004)
  const trialDr = trialRows.reduce((s: number, a: any) => s + a.dr, 0)
  const trialCr = trialRows.reduce((s: number, a: any) => s + a.cr, 0)
  const balanced = Math.abs(trialDr - trialCr) < 0.01

  const isChart = mode === 'chart'
  const exportCols =
    tab === 'trial'
      ? [
          { header: 'Code', value: (r: any) => r.code, width: 10 },
          { header: 'Account', value: (r: any) => r.name, width: 30 },
          { header: 'Debit (PKR)', value: (r: any) => r.dr.toFixed(2), width: 18 },
          { header: 'Credit (PKR)', value: (r: any) => r.cr.toFixed(2), width: 18 },
        ]
      : [
          { header: 'Code', value: (r: any) => r.code, width: 10 },
          { header: 'Account', value: (r: any) => r.name, width: 30 },
          { header: 'Type', value: (r: any) => typeLabel(r.type), width: 12 },
          { header: 'Balance (PKR)', value: (r: any) => Number(r.balance || 0).toFixed(2), width: 18 },
        ]

  return (
    <TenantLayout
      title={isChart ? 'Chart of accounts' : 'Ledger & trial balance'}
      subtitle={isChart ? 'The accounts your books are kept in' : 'Balance of every account, and a check that the books add up'}
      requiredModule={isChart ? 'finance' : 'ledger'}
      headerRight={
        <>
          <ExportButton
            data={tab === 'trial' ? trialRows : filtered}
            filename={tab === 'trial' ? 'trial-balance' : 'accounts'}
            title={tab === 'trial' ? 'Trial balance' : 'Chart of accounts'}
            subtitle={new Date().toLocaleDateString('en-GB')}
            columns={exportCols}
          />
          {isChart && canWrite('finance') && (
            <Button icon={<Plus className="size-4" />} onClick={() => { setForm(EMPTY); setErrors({}); setShowForm(true) }}>
              Add account
            </Button>
          )}
        </>
      }
    >
      {loading ? (
        <Spinner label="Loading accounts" />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Totals by type. Click one to show only those accounts. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {ACCOUNT_TYPES.map((t) => {
              const active = type === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={active}
                  title={t.hint}
                  onClick={() => { setTab('accounts'); setType(active ? 'ALL' : t.key) }}
                  className={cn(
                    'rounded-[var(--radius-panel)] border bg-surface p-4 text-left transition-colors',
                    active ? 'border-brand ring-3 ring-brand/15' : 'border-line hover:border-line-strong',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-ink-2">{t.plural}</span>
                    <span className="num text-xs text-ink-3">{totals[t.key].count}</span>
                  </div>
                  <p className="num mt-2 truncate text-lg font-semibold text-ink">{money(totals[t.key].total)}</p>
                </button>
              )
            })}
          </div>

          <Card>
            {!isChart && (
              <Tabs
                tabs={[
                  { key: 'accounts', label: 'Account balances', count: accounts.length },
                  { key: 'trial', label: 'Trial balance' },
                ]}
                value={tab}
                onChange={setTab}
              />
            )}

            {tab === 'accounts' ? (
              <>
                <ListToolbar>
                  <SearchInput placeholder="Search by code or name" onSearch={setSearch} />
                  <FilterChips
                    options={[{ key: 'ALL' as TypeFilter, label: 'All' }, ...ACCOUNT_TYPES.map((t) => ({ key: t.key as TypeFilter, label: t.plural }))]}
                    value={type}
                    onChange={setType}
                  />
                </ListToolbar>
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={<BookOpen />}
                    title={accounts.length ? 'No accounts match' : 'No accounts yet'}
                    description={accounts.length ? 'Clear the search or pick another type.' : 'Add the accounts you want to keep books in.'}
                  />
                ) : (
                  <TableWrap>
                    <Table>
                      <thead>
                        <tr>
                          <Th className="hidden w-24 sm:table-cell">Code</Th>
                          <Th>Account</Th>
                          <Th className="hidden sm:table-cell">Type</Th>
                          <Th align="right">Balance</Th>
                          <Th align="right"><span className="sr-only">Ledger</span></Th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((a) => (
                          <Tr key={a.id}>
                            <Td className="num hidden font-medium text-ink-2 sm:table-cell">{a.code}</Td>
                            <Td>
                              <p className="font-medium">{a.name}</p>
                              <p className="text-xs text-ink-3 sm:hidden"><span className="num">{a.code}</span>, {typeLabel(a.type)}</p>
                            </Td>
                            <Td className="hidden sm:table-cell">
                              <Badge tone={TYPE_TONE[a.type]}>{typeLabel(a.type)}</Badge>
                            </Td>
                            <Td align="right" className={cn('font-medium', Number(a.balance) < 0 && 'text-bad')}>
                              {money(a.balance)}
                            </Td>
                            <Td align="right">
                              <Link href={href(`/erp/finance/accounts/${a.id}/ledger`)} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                                <BookOpen className="size-3.5" aria-hidden />
                                <span className="hidden sm:inline">Ledger</span>
                                <span className="sr-only sm:hidden">Open ledger for {a.name}</span>
                              </Link>
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </>
            ) : (
              <>
                <div className={cn('flex items-start gap-3 border-b border-line px-4 py-3 sm:px-5', balanced ? 'bg-good-soft' : 'bg-bad-soft')}>
                  {balanced ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-good" aria-hidden /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />}
                  <div>
                    <p className={cn('text-sm font-medium', balanced ? 'text-good' : 'text-bad')}>
                      {balanced ? 'The books balance' : 'The books do not balance'}
                    </p>
                    <p className="text-[13px] text-ink-2">
                      {balanced
                        ? 'Total debits equal total credits.'
                        : `Debits and credits differ by ${money(Math.abs(trialDr - trialCr))}. Check recent manual journal entries.`}
                    </p>
                  </div>
                </div>
                {trialRows.length === 0 ? (
                  <EmptyState icon={<Scale />} title="Nothing posted yet" description="Invoices, purchases, payments and journal entries will appear here." />
                ) : (
                  <TableWrap>
                    <Table>
                      <thead>
                        <tr>
                          <Th className="w-24">Code</Th>
                          <Th>Account</Th>
                          <Th align="right">Debit</Th>
                          <Th align="right">Credit</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialRows.map((a: any) => (
                          <Tr key={a.id}>
                            <Td className="num font-medium text-ink-2">{a.code}</Td>
                            <Td>
                              <Link href={href(`/erp/finance/accounts/${a.id}/ledger`)} className="font-medium hover:text-brand hover:underline">
                                {a.name}
                              </Link>
                            </Td>
                            <Td align="right">{a.dr ? money(a.dr) : ''}</Td>
                            <Td align="right">{a.cr ? money(a.cr) : ''}</Td>
                          </Tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-subtle">
                          <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-ink">Total</td>
                          <td className="num px-4 py-3 text-right text-sm font-semibold text-ink">{money(trialDr)}</td>
                          <td className="num px-4 py-3 text-right text-sm font-semibold text-ink">{money(trialCr)}</td>
                        </tr>
                      </tfoot>
                    </Table>
                  </TableWrap>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add account"
        description="Use it in journal entries, payments and receipts."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} loading={saving}>Add account</Button>
          </>
        }
      >
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Code" required error={errors.code} hint="A number, e.g. 6100">
            {(id) => <Input id={id} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} inputMode="numeric" autoFocus />}
          </Field>
          <Field label="Name" required error={errors.name} className="sm:col-span-2">
            {(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Office rent" />}
          </Field>
          <div className="flex flex-col gap-1.5 sm:col-span-3">
            <span className="text-[13px] font-medium text-ink-2">Type</span>
            <Segmented
              label="Account type"
              options={ACCOUNT_TYPES.map((t) => ({ key: t.key, label: t.label }))}
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v })}
            />
            <p className="text-xs text-ink-3">{ACCOUNT_TYPES.find((t) => t.key === form.type)?.hint}</p>
          </div>
          <button type="submit" className="hidden" />
        </form>
      </Modal>
    </TenantLayout>
  )
}
