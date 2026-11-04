'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2, Contact, Truck } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import Pagination from '@/components/common/Pagination'
import {
  Button, Card, Field, Input, Textarea, Modal, Table, TableWrap, Th, Td, Tr,
  Spinner, EmptyState, SearchInput, ListToolbar, IconAction, useConfirm,
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money } from '@/lib/format'
import { getTenantSlug } from '@/lib/getTenantSlug'

type Kind = 'customer' | 'supplier'

const TEXT = {
  customer: {
    title: 'Customers', subtitle: 'People and businesses you sell to', endpoint: '/erp/customers',
    one: 'customer', add: 'Add customer', icon: Contact,
    // Positive balance = they owe us; negative = they paid in advance
    balance: (b: number) => (b > 0 ? { text: 'Owes you', tone: 'text-warn' } : b < 0 ? { text: 'Advance paid', tone: 'text-good' } : null),
  },
  supplier: {
    title: 'Suppliers', subtitle: 'Businesses you buy from', endpoint: '/erp/suppliers',
    one: 'supplier', add: 'Add supplier', icon: Truck,
    // Positive balance = we owe them; negative = we paid in advance
    balance: (b: number) => (b > 0 ? { text: 'You owe', tone: 'text-warn' } : b < 0 ? { text: 'Advance given', tone: 'text-good' } : null),
  },
}

const EMPTY_FORM = { name: '', email: '', phone: '', address: '', openingBalance: '' }

export default function ContactListPage({ kind }: { kind: Kind }) {
  const t = TEXT[kind]
  const [rows, setRows] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [editing, setEditing] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const [confirm, confirmDialog] = useConfirm()
  const { canWrite, canModify, canDelete } = usePermission()

  const load = useCallback(
    async (q: string, p: number, l: number) => {
      setLoading(true)
      try {
        const res = await tenantApi.get(`${t.endpoint}?search=${encodeURIComponent(q)}&page=${p}&limit=${l}`)
        setRows(res.data.data || [])
        setMeta(res.data.meta)
      } catch (err) {
        toast.error(apiError(err, `Could not load ${t.title.toLowerCase()}.`))
      } finally {
        setLoading(false)
      }
    },
    [t.endpoint, t.title],
  )

  useEffect(() => {
    load(search, page, limit)
  }, [load, search, page, limit])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setNameError('')
    setShowForm(true)
  }

  function openEdit(row: any) {
    setEditing(row)
    setForm({ name: row.name || '', email: row.email || '', phone: row.phone || '', address: row.address || '', openingBalance: '' })
    setNameError('')
    setShowForm(true)
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!form.name.trim()) {
      setNameError('Enter a name.')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const { openingBalance: _ob, ...edit } = form
        await tenantApi.put(`${t.endpoint}/${editing.id}`, edit)
        toast.success(`${capital(t.one)} saved`)
      } else {
        await tenantApi.post(t.endpoint, { ...form, openingBalance: Number(form.openingBalance) || 0 })
        toast.success(`${capital(t.one)} added`)
      }
      setShowForm(false)
      load(search, page, limit)
    } catch (err) {
      toast.error(apiError(err, `Could not save the ${t.one}.`))
    } finally {
      setSaving(false)
    }
  }

  async function remove(row: any) {
    const ok = await confirm({
      title: `Delete ${row.name}?`,
      message: `The ${t.one} will be removed from lists. Their past invoices and orders stay in your records.`,
      confirmLabel: `Delete ${t.one}`,
      danger: true,
    })
    if (!ok) return
    try {
      await tenantApi.delete(`${t.endpoint}/${row.id}`)
      toast.success(`${capital(t.one)} deleted`)
      load(search, page, limit)
    } catch (err) {
      toast.error(apiError(err, `Could not delete the ${t.one}.`))
    }
  }

  const slug = typeof window !== 'undefined' ? getTenantSlug() : ''
  const showActions = canModify('contacts') || canDelete('contacts')
  const Icon = t.icon

  return (
    <TenantLayout
      title={t.title}
      subtitle={t.subtitle}
      requiredModule="contacts"
      headerRight={
        <>
          <ExportButton
            data={rows}
            filename={`${t.title.toLowerCase()}-${slug}`}
            title={t.title}
            subtitle={new Date().toLocaleDateString('en-GB')}
            columns={[
              { header: 'Name', value: (r) => r.name, width: 25 },
              { header: 'Email', value: (r) => r.email || '', width: 28 },
              { header: 'Phone', value: (r) => r.phone || '', width: 18 },
              { header: 'Address', value: (r) => r.address || '', width: 30 },
              { header: 'Balance (PKR)', value: (r) => Number(r.balance || 0).toFixed(2), width: 18 },
            ]}
          />
          {canWrite('contacts') && (
            <Button icon={<Plus className="size-4" />} onClick={openCreate}>
              {t.add}
            </Button>
          )}
        </>
      }
    >
      <Card>
        <ListToolbar>
          <SearchInput
            placeholder="Search by name, email or phone"
            onSearch={(q) => {
              setPage(1)
              setSearch(q)
            }}
          />
        </ListToolbar>

        {loading ? (
          <Spinner label={`Loading ${t.title.toLowerCase()}`} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icon />}
            title={search ? `No ${t.title.toLowerCase()} match "${search}"` : `No ${t.title.toLowerCase()} yet`}
            description={search ? 'Try a different name or phone number.' : `Add your first ${t.one} to use them on orders and invoices.`}
            action={!search && canWrite('contacts') ? <Button icon={<Plus className="size-4" />} onClick={openCreate}>{t.add}</Button> : undefined}
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th className="hidden md:table-cell">Phone</Th>
                    <Th className="hidden lg:table-cell">Email</Th>
                    <Th className="hidden xl:table-cell">Address</Th>
                    <Th align="right">Balance</Th>
                    {showActions && <Th align="right"><span className="sr-only">Actions</span></Th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const b = Number(r.balance || 0)
                    const label = t.balance(b)
                    return (
                      <Tr key={r.id}>
                        <Td>
                          <p className="font-medium text-ink">{r.name}</p>
                          <p className="text-xs text-ink-3 md:hidden">{r.phone || r.email || ''}</p>
                        </Td>
                        <Td className="hidden text-ink-2 md:table-cell">{r.phone || '—'}</Td>
                        <Td className="hidden text-ink-2 lg:table-cell">{r.email || '—'}</Td>
                        <Td className="hidden max-w-[260px] truncate text-ink-2 xl:table-cell">{r.address || '—'}</Td>
                        <Td align="right">
                          <p className={`font-medium ${label ? label.tone : 'text-ink-3'}`}>{money(Math.abs(b))}</p>
                          {label && <p className="text-xs text-ink-3">{label.text}</p>}
                        </Td>
                        {showActions && (
                          <Td align="right" className="w-24 whitespace-nowrap">
                            {canModify('contacts') && (
                              <IconAction label={`Edit ${r.name}`} onClick={() => openEdit(r)}>
                                <Pencil />
                              </IconAction>
                            )}
                            {canDelete('contacts') && (
                              <IconAction label={`Delete ${r.name}`} onClick={() => remove(r)} danger>
                                <Trash2 />
                              </IconAction>
                            )}
                          </Td>
                        )}
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableWrap>
            {meta && (
              <Pagination
                page={page}
                totalPages={meta.totalPages || 1}
                total={meta.total || 0}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
              />
            )}
          </>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `Edit ${t.one}` : t.add}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={() => save()} loading={saving}>
              {editing ? 'Save changes' : t.add}
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required error={nameError || undefined} className="sm:col-span-2">
            {(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />}
          </Field>
          <Field label="Phone">
            {(id) => <Input id={id} type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0300 1234567" />}
          </Field>
          <Field label="Email">
            {(id) => <Input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
          </Field>
          <Field label="Address" className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />}
          </Field>
          {!editing && (
            <Field
              label="Opening balance (PKR)"
              className="sm:col-span-2"
              hint={kind === 'customer'
                ? 'What they already owed you before MyERP. Enter a minus amount if they paid you in advance. Leave empty if nothing.'
                : 'What you already owed them before MyERP. Enter a minus amount if you paid them in advance. Leave empty if nothing.'}
            >
              {(id) => <Input id={id} type="number" step="0.01" inputMode="decimal" className="num" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} placeholder="0" />}
            </Field>
          )}
          <button type="submit" className="hidden" />
        </form>
      </Modal>

      {confirmDialog}
    </TenantLayout>
  )
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
