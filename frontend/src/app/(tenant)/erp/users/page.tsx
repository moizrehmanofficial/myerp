'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Crown, KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import {
  Badge, Button, Card, Field, Input, Modal, Segmented, Select, Spinner, Table, TableWrap, Tabs, Th, Td, Tr,
  EmptyState, IconAction, StatusBadge, useConfirm,
} from '@/components/ui'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { getTenantSlug } from '@/lib/getTenantSlug'
import { date } from '@/lib/format'
import { cn } from '@/utils/utils'

const ALL_MODULES = [
  { key: 'contacts', label: 'Customers & suppliers' },
  { key: 'products', label: 'Products' },
  { key: 'inventory', label: 'Stock' },
  { key: 'purchase', label: 'Purchases' },
  { key: 'sales', label: 'Sales' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'finance', label: 'Accounts' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'hr', label: 'HR' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'reports', label: 'Reports' },
  { key: 'manufacturing', label: 'Manufacturing' },
  { key: 'settings', label: 'Settings' },
]

const PERMS = ['read', 'write', 'modify', 'delete', 'print', 'export', 'approve'] as const
type Perm = (typeof PERMS)[number]
type Matrix = Record<string, Record<Perm, boolean>>

const PERM_LABEL: Record<Perm, { short: string; long: string }> = {
  read: { short: 'View', long: 'See records' },
  write: { short: 'Add', long: 'Create new records' },
  modify: { short: 'Edit', long: 'Change existing records' },
  delete: { short: 'Delete', long: 'Delete records' },
  print: { short: 'Print', long: 'Print documents' },
  export: { short: 'Export', long: 'Download Excel, PDF or CSV' },
  approve: { short: 'Approve', long: 'Approve, e.g. leave or posting' },
}

const none = (): Record<Perm, boolean> => ({ read: false, write: false, modify: false, delete: false, print: false, export: false, approve: false })
const all = (): Record<Perm, boolean> => ({ read: true, write: true, modify: true, delete: true, print: true, export: true, approve: true })
const viewOnly = (): Record<Perm, boolean> => ({ ...none(), read: true, print: true, export: true })

const EMPTY_USER = { name: '', email: '', phone: '', password: '', roleId: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' }

function initials(name: string) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function UsersRolesPage() {
  const [tab, setTab] = useState<'users' | 'roles'>('users')
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [companyModules, setCompanyModules] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [confirm, confirmDialog] = useConfirm()

  const [editingUser, setEditingUser] = useState<any>(null)
  const [showUser, setShowUser] = useState(false)
  const [userForm, setUserForm] = useState(EMPTY_USER)
  const [userErr, setUserErr] = useState('')
  const [savingUser, setSavingUser] = useState(false)

  const [editingRole, setEditingRole] = useState<any>(null)
  const [showRole, setShowRole] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [roleDesc, setRoleDesc] = useState('')
  const [matrix, setMatrix] = useState<Matrix>({})
  const [roleErr, setRoleErr] = useState('')
  const [savingRole, setSavingRole] = useState(false)

  const load = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([tenantApi.get('/erp/users/list'), tenantApi.get('/erp/users/roles')])
      setUsers(u.data.data || [])
      setRoles(r.data.data || [])
    } catch (err) {
      toast.error(apiError(err, 'Could not load users.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`tenant_user_${getTenantSlug()}`)
      if (cached) setCompanyModules(JSON.parse(cached).moduleKeys || [])
    } catch {}
    load()
  }, [load])

  // Only modules this company has
  const modules = ALL_MODULES.filter((m) => companyModules.length === 0 || companyModules.includes(m.key))

  // ── Users ──
  function openUser(u?: any) {
    setEditingUser(u || null)
    setUserErr('')
    setUserForm(u ? { name: u.name, email: u.email, phone: u.phone || '', password: '', roleId: u.roleId || '', status: u.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' } : { ...EMPTY_USER, roleId: roles[0]?.id || '' })
    setShowUser(true)
  }

  async function saveUser(e?: React.FormEvent) {
    e?.preventDefault()
    if (!userForm.name.trim()) return setUserErr('Enter their name.')
    if (!editingUser && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email.trim())) return setUserErr('Enter a valid email address.')
    if (!userForm.roleId) return setUserErr('Choose a role. It decides what they can see and do.')
    if (!editingUser && userForm.password.length < 8) return setUserErr('The password must be at least 8 characters.')
    if (editingUser && userForm.password && userForm.password.length < 8) return setUserErr('The new password must be at least 8 characters.')
    setUserErr('')
    setSavingUser(true)
    try {
      if (editingUser) await tenantApi.put(`/erp/users/list/${editingUser.id}`, userForm)
      let emailed = false
      if (!editingUser) {
        const r = await tenantApi.post('/erp/users/list', { ...userForm, email: userForm.email.trim() })
        emailed = !!r.data.data?.emailSent
      }
      toast.success(editingUser ? 'Changes saved' : `${userForm.name.trim()} can now sign in${emailed ? '. We emailed them the sign-in link.' : ''}`)
      setShowUser(false)
      load()
    } catch (err) {
      setUserErr(apiError(err, 'Could not save.'))
    } finally {
      setSavingUser(false)
    }
  }

  async function deleteUser(u: any) {
    const ok = await confirm({ title: `Remove ${u.name}?`, message: 'They will not be able to sign in. Their past activity stays in the activity log.', confirmLabel: 'Remove user', danger: true })
    if (!ok) return
    try {
      await tenantApi.delete(`/erp/users/list/${u.id}`)
      toast.success(`${u.name} removed`)
      load()
    } catch (err) {
      toast.error(apiError(err, 'Could not remove the user.'))
    }
  }

  // ── Roles ──
  function openRole(r?: any) {
    setEditingRole(r || null)
    setRoleErr('')
    setRoleName(r?.name || '')
    setRoleDesc(r?.description || '')
    const m: Matrix = {}
    for (const mod of modules) m[mod.key] = { ...none(), ...(r?.permissions?.[mod.key] || {}) }
    setMatrix(m)
    setShowRole(true)
  }

  const setRow = (key: string, v: Record<Perm, boolean>) => setMatrix((x) => ({ ...x, [key]: v }))
  function toggle(key: string, p: Perm) {
    setMatrix((x) => {
      const row = { ...x[key], [p]: !x[key]?.[p] }
      // Any other permission needs View; turning View off turns the rest off
      if (p !== 'read' && row[p]) row.read = true
      if (p === 'read' && !row.read) return { ...x, [key]: none() }
      return { ...x, [key]: row }
    })
  }

  async function saveRole(e?: React.FormEvent) {
    e?.preventDefault()
    if (!roleName.trim()) return setRoleErr('Give the role a name, like Cashier or Store keeper.')
    const moduleKeys = modules.filter((m) => matrix[m.key]?.read).map((m) => m.key)
    if (!moduleKeys.length) return setRoleErr('Allow at least one area to be viewed.')
    setRoleErr('')
    setSavingRole(true)
    try {
      const body = { name: roleName.trim(), description: roleDesc.trim(), moduleKeys, permissions: matrix }
      if (editingRole) await tenantApi.put(`/erp/users/roles/${editingRole.id}`, body)
      else await tenantApi.post('/erp/users/roles', body)
      toast.success(editingRole ? 'Role saved. Changes apply within a minute.' : `${body.name} role added`)
      setShowRole(false)
      load()
    } catch (err) {
      setRoleErr(apiError(err, 'Could not save the role.'))
    } finally {
      setSavingRole(false)
    }
  }

  async function deleteRole(r: any) {
    if (r.userCount > 0) return toast.error(`${r.userCount} user${r.userCount === 1 ? ' has' : 's have'} this role. Give them another role first.`)
    const ok = await confirm({ title: `Delete the ${r.name} role?`, confirmLabel: 'Delete role', danger: true })
    if (!ok) return
    try {
      await tenantApi.delete(`/erp/users/roles/${r.id}`)
      toast.success(`${r.name} deleted`)
      load()
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the role.'))
    }
  }

  const accessSummary = (r: any) => {
    const keys: string[] = r.moduleKeys || []
    if (!keys.length) return 'No access yet'
    const names = keys.map((k) => ALL_MODULES.find((m) => m.key === k)?.label || k)
    return names.length > 4 ? `${names.slice(0, 4).join(', ')} and ${names.length - 4} more` : names.join(', ')
  }

  return (
    <TenantLayout
      title="Users & roles"
      subtitle="Who can sign in, and what each person can see and do"
      requiredModule="users"
      headerRight={
        tab === 'users'
          ? <Button icon={<UserPlus className="size-4" />} onClick={() => openUser()}>Add user</Button>
          : <Button icon={<Plus className="size-4" />} onClick={() => openRole()}>Add role</Button>
      }
    >
      <Card>
        <Tabs tabs={[{ key: 'users', label: 'Users', count: users.length }, { key: 'roles', label: 'Roles', count: roles.length }]} value={tab} onChange={setTab} />
        {loading ? (
          <Spinner label="Loading" />
        ) : tab === 'users' ? (
          users.length === 0 ? (
            <EmptyState icon={<Users />} title="No users yet" />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th className="hidden sm:table-cell">Role</Th>
                    <Th>Status</Th>
                    <Th className="hidden lg:table-cell">Added</Th>
                    <Th align="right"><span className="sr-only">Actions</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <Tr key={u.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold', u.isOwner ? 'bg-nav text-white' : 'bg-brand-soft text-brand-ink')} aria-hidden>
                            {initials(u.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{u.name}</p>
                            <p className="truncate text-xs text-ink-3">{u.email}</p>
                            <p className="text-xs text-ink-3 sm:hidden">{u.isOwner ? 'Owner' : u.roleName || 'No role'}</p>
                          </div>
                        </div>
                      </Td>
                      <Td className="hidden sm:table-cell">
                        {u.isOwner ? (
                          <span className="inline-flex items-center gap-1.5 font-medium"><Crown className="size-3.5 text-warn" aria-hidden />Owner</span>
                        ) : u.roleName ? (
                          u.roleName
                        ) : (
                          <span className="text-bad">No role</span>
                        )}
                      </Td>
                      <Td><StatusBadge status={u.status} /></Td>
                      <Td className="hidden text-ink-2 lg:table-cell">{date(u.createdAt)}</Td>
                      <Td align="right" className="whitespace-nowrap">
                        {u.isOwner ? (
                          <span className="text-xs text-ink-3">Full access</span>
                        ) : (
                          <>
                            <IconAction label={`Edit ${u.name}`} onClick={() => openUser(u)}><Pencil /></IconAction>
                            <IconAction label={`Remove ${u.name}`} onClick={() => deleteUser(u)} danger><Trash2 /></IconAction>
                          </>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )
        ) : roles.length === 0 ? (
          <EmptyState icon={<ShieldCheck />} title="No roles yet" description="A role is a set of permissions, like Cashier or Store keeper. Give one to each user." action={<Button icon={<Plus className="size-4" />} onClick={() => openRole()}>Add role</Button>} />
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((r) => (
              <div key={r.id} className="flex flex-col rounded-[var(--radius-control)] border border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{r.name}</p>
                    {r.description && <p className="mt-0.5 text-[13px] text-ink-3">{r.description}</p>}
                  </div>
                  <Badge>{r.userCount} user{r.userCount === 1 ? '' : 's'}</Badge>
                </div>
                <p className="mt-3 flex-1 text-[13px] text-ink-2">{accessSummary(r)}</p>
                <div className="mt-3 flex gap-2 border-t border-line pt-3">
                  <Button size="sm" variant="secondary" icon={<KeyRound className="size-3.5" />} onClick={() => openRole(r)}>Permissions</Button>
                  <Button size="sm" variant="ghost" className="ml-auto text-bad hover:text-bad" icon={<Trash2 className="size-3.5" />} onClick={() => deleteRole(r)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* User */}
      <Modal
        open={showUser}
        onClose={() => setShowUser(false)}
        title={editingUser ? `Edit ${editingUser.name}` : 'Add user'}
        description={editingUser ? editingUser.email : 'They sign in with this email and password on your company login page.'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowUser(false)}>Cancel</Button>
            <Button onClick={() => saveUser()} loading={savingUser}>{editingUser ? 'Save changes' : 'Add user'}</Button>
          </>
        }
      >
        <form onSubmit={saveUser} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" required className="sm:col-span-2">{(id) => <Input id={id} value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} autoFocus />}</Field>
          {!editingUser && (
            <Field label="Email" required className="sm:col-span-2">{(id) => <Input id={id} type="email" autoComplete="off" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />}</Field>
          )}
          <Field label="Phone">{(id) => <Input id={id} type="tel" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />}</Field>
          <Field label="Role" required>
            {(id) => (
              <Select id={id} value={userForm.roleId} onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}>
                <option value="">Choose role</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label={editingUser ? 'New password' : 'Password'} required={!editingUser} hint={editingUser ? 'Leave empty to keep their current password' : 'At least 8 characters. Share it with them privately.'} className="sm:col-span-2">
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />}
          </Field>
          {editingUser && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[13px] font-medium text-ink-2">Status</span>
              <Segmented label="Status" options={[{ key: 'ACTIVE', label: 'Can sign in' }, { key: 'INACTIVE', label: 'Blocked' }]} value={userForm.status} onChange={(v) => setUserForm({ ...userForm, status: v })} />
            </div>
          )}
          {userErr && <p className="rounded-[var(--radius-control)] bg-bad-soft px-3 py-2 text-[13px] text-bad sm:col-span-2">{userErr}</p>}
          <button type="submit" className="hidden" />
        </form>
      </Modal>

      {/* Role */}
      <Modal
        open={showRole}
        onClose={() => setShowRole(false)}
        size="xl"
        title={editingRole ? `Permissions: ${editingRole.name}` : 'Add role'}
        description="Tick what people with this role may do in each area."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRole(false)}>Cancel</Button>
            <Button onClick={() => saveRole()} loading={savingRole}>{editingRole ? 'Save role' : 'Add role'}</Button>
          </>
        }
      >
        <form onSubmit={saveRole} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Role name" required>{(id) => <Input id={id} value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Cashier" autoFocus />}</Field>
            <Field label="Description">{(id) => <Input id={id} value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} placeholder="What this person does" />}</Field>
          </div>
          <div className="overflow-x-auto rounded-[var(--radius-control)] border border-line">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-subtle">
                  <th scope="col" className="border-b border-line px-3 py-2 text-left text-[13px] font-semibold text-ink-2">Area</th>
                  {PERMS.map((p) => (
                    <th key={p} scope="col" title={PERM_LABEL[p].long} className="border-b border-line px-1 py-2 text-center text-[13px] font-semibold text-ink-2">{PERM_LABEL[p].short}</th>
                  ))}
                  <th scope="col" className="border-b border-line px-3 py-2 text-right text-[13px] font-semibold text-ink-2">Quick set</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => {
                  const row = matrix[m.key] || none()
                  return (
                    <tr key={m.key} className={cn('border-b border-line last:border-b-0', !row.read && 'text-ink-3')}>
                      <th scope="row" className="px-3 py-2 text-left font-medium">{m.label}</th>
                      {PERMS.map((p) => (
                        <td key={p} className="px-1 py-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${m.label}: ${PERM_LABEL[p].long}`}
                            checked={!!row[p]}
                            onChange={() => toggle(m.key, p)}
                            className="size-4 cursor-pointer accent-[var(--color-brand)]"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <button type="button" className="rounded px-1.5 py-1 text-xs text-ink-2 hover:bg-subtle hover:text-ink" onClick={() => setRow(m.key, all())}>All</button>
                        <button type="button" className="rounded px-1.5 py-1 text-xs text-ink-2 hover:bg-subtle hover:text-ink" onClick={() => setRow(m.key, viewOnly())}>View only</button>
                        <button type="button" className="rounded px-1.5 py-1 text-xs text-ink-2 hover:bg-subtle hover:text-ink" onClick={() => setRow(m.key, none())}>None</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-3">Dashboard is open to everyone. Users &amp; roles can only be managed by the owner.</p>
          {roleErr && <p className="rounded-[var(--radius-control)] bg-bad-soft px-3 py-2 text-[13px] text-bad">{roleErr}</p>}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
      {confirmDialog}
    </TenantLayout>
  )
}
