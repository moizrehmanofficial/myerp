'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ShieldCheck, UserPlus } from 'lucide-react'
import api from '@/lib/axios'
import AdminLayout from '@/components/layout/AdminLayout'
import { Button, Card, Field, Input, Modal, Spinner, Table, TableWrap, Th, Td, Tr, EmptyState, StatusBadge, useConfirm } from '@/components/ui'
import { makePassword } from '@/components/admin/CompanyForm'
import { apiError } from '@/lib/tenantApi'
import { date } from '@/lib/format'

const EMPTY = { name: '', email: '', password: '' }

export default function AdminUsersPage() {
  const [rows, setRows] = useState<any[]>([])
  const [me, setMe] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  const load = useCallback(async () => {
    try {
      const r = await api.get('/super-admin/admins')
      setRows(r.data.data || [])
    } catch (err) {
      toast.error(apiError(err, 'Could not load admins.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    try {
      setMe(JSON.parse(sessionStorage.getItem('admin_user') || '{}').id || '')
    } catch {}
    load()
  }, [load])

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!form.name.trim()) return setError('Enter a name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('Enter a valid email.')
    if (form.password.length < 8) return setError('The password must be at least 8 characters.')
    setError('')
    setSaving(true)
    try {
      await api.post('/super-admin/admins', form)
      toast.success(`${form.name.trim()} can now sign in to the admin panel`)
      setShowForm(false)
      load()
    } catch (err) {
      setError(apiError(err, 'Could not add the admin.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggle(a: any) {
    const block = a.status === 'ACTIVE'
    if (block) {
      const ok = await confirm({ title: `Block ${a.name}?`, message: 'They will not be able to sign in to the admin panel.', confirmLabel: 'Block', danger: true })
      if (!ok) return
    }
    try {
      await api.patch(`/super-admin/admins/${a.id}`, { status: block ? 'INACTIVE' : 'ACTIVE' })
      toast.success(block ? `${a.name} blocked` : `${a.name} can sign in again`)
      load()
    } catch (err) {
      toast.error(apiError(err, 'Could not change access.'))
    }
  }

  return (
    <AdminLayout
      title="Admin users"
      subtitle="People who can manage companies, modules and backups"
      headerRight={<Button icon={<UserPlus className="size-4" />} onClick={() => { setForm(EMPTY); setError(''); setShowForm(true) }}>Add admin</Button>}
    >
      <Card>
        {loading ? (
          <Spinner label="Loading" />
        ) : rows.length === 0 ? (
          <EmptyState icon={<ShieldCheck />} title="No admins" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Admin</Th>
                  <Th className="hidden md:table-cell">Added</Th>
                  <Th>Status</Th>
                  <Th align="right"><span className="sr-only">Actions</span></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <Tr key={a.id}>
                    <Td>
                      <p className="font-medium">{a.name}{a.id === me && <span className="ml-2 text-xs font-normal text-ink-3">(you)</span>}</p>
                      <p className="text-xs text-ink-3">{a.email}</p>
                    </Td>
                    <Td className="hidden text-ink-2 md:table-cell">{date(a.createdAt)}</Td>
                    <Td><StatusBadge status={a.status} /></Td>
                    <Td align="right">
                      {a.id !== me && (
                        <Button size="sm" variant={a.status === 'ACTIVE' ? 'danger-soft' : 'secondary'} onClick={() => toggle(a)}>
                          {a.status === 'ACTIVE' ? 'Block' : 'Unblock'}
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add admin"
        description="Admins have full control over every company. Add only people you trust."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} loading={saving}>Add admin</Button>
          </>
        }
      >
        <form onSubmit={save} className="grid grid-cols-1 gap-4">
          <Field label="Name" required>{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />}</Field>
          <Field label="Email" required>{(id) => <Input id={id} type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
          <Field label="Password" required hint="At least 8 characters">
            {(id) => (
              <div className="flex gap-2">
                <Input id={id} className="num" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <Button variant="secondary" onClick={() => setForm({ ...form, password: makePassword() })}>Generate</Button>
              </div>
            )}
          </Field>
          {error && <p className="rounded-[var(--radius-control)] bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
      {confirmDialog}
    </AdminLayout>
  )
}
