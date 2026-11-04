'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Puzzle } from 'lucide-react'
import api from '@/lib/axios'
import AdminLayout from '@/components/layout/AdminLayout'
import { Button, Card, Field, Input, Modal, Spinner, Table, TableWrap, Th, Td, Tr, EmptyState, useConfirm } from '@/components/ui'
import { apiError } from '@/lib/tenantApi'
import { cn } from '@/utils/utils'

const EMPTY = { key: '', name: '', description: '', sortOrder: '99' }

export default function ModulesPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  const load = useCallback(async () => {
    try {
      const r = await api.get('/super-admin/modules')
      setRows(r.data.data || [])
    } catch (err) {
      toast.error(apiError(err, 'Could not load modules.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggle(m: any) {
    if (m.isActive) {
      const ok = await confirm({ title: `Turn off ${m.name}?`, message: 'New companies cannot pick it. Companies that already have it keep it.', confirmLabel: 'Turn off' })
      if (!ok) return
    }
    setBusy(m.id)
    try {
      await api.patch(`/super-admin/modules/${m.id}`, { isActive: !m.isActive })
      toast.success(`${m.name} turned ${m.isActive ? 'off' : 'on'}`)
      load()
    } catch (err) {
      toast.error(apiError(err, 'Could not change the module.'))
    } finally {
      setBusy('')
    }
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!form.name.trim()) return setError('Enter a name.')
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(form.key.trim())) return setError('Key: lowercase letters, numbers and _ only, starting with a letter.')
    setError('')
    setSaving(true)
    try {
      await api.post('/super-admin/modules', { ...form, key: form.key.trim() })
      toast.success(`${form.name.trim()} added`)
      setShowForm(false)
      load()
    } catch (err) {
      setError(apiError(err, 'Could not add the module.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout
      title="Modules"
      subtitle="Parts of the ERP that companies can be given"
      headerRight={<Button icon={<Plus className="size-4" />} onClick={() => { setForm(EMPTY); setError(''); setShowForm(true) }}>Add module</Button>}
    >
      <Card>
        {loading ? (
          <Spinner label="Loading modules" />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Puzzle />} title="No modules" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th className="w-12">#</Th>
                  <Th>Module</Th>
                  <Th className="hidden md:table-cell">Key</Th>
                  <Th align="right">Available</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <Tr key={m.id}>
                    <Td className="num text-ink-3">{m.sortOrder}</Td>
                    <Td>
                      <p className="font-medium">{m.name}</p>
                      {m.description && <p className="text-xs text-ink-3">{m.description}</p>}
                      <p className="num text-xs text-ink-3 md:hidden">{m.key}</p>
                    </Td>
                    <Td className="num hidden text-ink-2 md:table-cell">{m.key}</Td>
                    <Td align="right">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={m.isActive}
                        aria-label={`${m.name} available`}
                        disabled={busy === m.id}
                        onClick={() => toggle(m)}
                        className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', m.isActive ? 'bg-brand' : 'bg-line-strong')}
                      >
                        <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', m.isActive ? 'translate-x-5.5' : 'translate-x-0.5')} />
                      </button>
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
        title="Add module"
        description="The key must match what the app checks for, so add one only when its pages exist."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} loading={saving}>Add module</Button>
          </>
        }
      >
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required>{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />}</Field>
          <Field label="Key" required hint="e.g. pos or crm">{(id) => <Input id={id} className="num" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase() })} />}</Field>
          <Field label="Description" className="sm:col-span-2">{(id) => <Input id={id} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}</Field>
          <Field label="Order in lists">{(id) => <Input id={id} type="number" className="num" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />}</Field>
          {error && <p className="rounded-[var(--radius-control)] bg-bad-soft px-3 py-2 text-[13px] text-bad sm:col-span-2">{error}</p>}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
      {confirmDialog}
    </AdminLayout>
  )
}
