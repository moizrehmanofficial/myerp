'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'

const ALL_MODULES = [
  { key: 'contacts',      label: 'Customers & Suppliers' },
  { key: 'products',      label: 'Products' },
  { key: 'inventory',     label: 'Inventory' },
  { key: 'purchase',      label: 'Purchase' },
  { key: 'sales',         label: 'Sales' },
  { key: 'invoices',      label: 'Invoices' },
  { key: 'finance',       label: 'Finance' },
  { key: 'ledger',        label: 'Ledger' },
  { key: 'hr',            label: 'HR' },
  { key: 'payroll',       label: 'Payroll' },
  { key: 'reports',       label: 'Reports' },
  { key: 'manufacturing', label: 'Manufacturing' },
  { key: 'settings',      label: 'Settings' },
]

const PERMISSIONS = ['read', 'write', 'modify', 'delete', 'print', 'export', 'approve'] as const
type Permission = typeof PERMISSIONS[number]

const PERM_LABELS: Record<Permission, string> = {
  read: 'Read', write: 'Write', modify: 'Modify',
  delete: 'Delete', print: 'Print', export: 'Export', approve: 'Approve',
}

// Default permission matrix per module (matches doc section 6.2)
const DEFAULT_MODULE_PERMISSIONS: Record<string, Record<Permission, boolean>> = {
  dashboard:    { read: true,  write: false, modify: false, delete: false, print: false, export: false, approve: false },
  users:        { read: true,  write: true,  modify: true,  delete: true,  print: false, export: false, approve: false },
  contacts:     { read: true,  write: true,  modify: true,  delete: true,  print: false, export: true,  approve: false },
  products:     { read: true,  write: true,  modify: true,  delete: true,  print: false, export: true,  approve: false },
  inventory:    { read: true,  write: true,  modify: true,  delete: false, print: false, export: false, approve: false },
  purchase:     { read: true,  write: true,  modify: true,  delete: false, print: true,  export: true,  approve: true  },
  sales:        { read: true,  write: true,  modify: true,  delete: false, print: true,  export: true,  approve: false },
  invoices:     { read: true,  write: true,  modify: true,  delete: false, print: true,  export: true,  approve: false },
  finance:      { read: true,  write: true,  modify: true,  delete: false, print: true,  export: true,  approve: true  },
  ledger:       { read: true,  write: false, modify: false, delete: false, print: true,  export: true,  approve: false },
  hr:           { read: true,  write: true,  modify: true,  delete: true,  print: false, export: true,  approve: false },
  payroll:      { read: true,  write: true,  modify: false, delete: false, print: true,  export: true,  approve: true  },
  reports:      { read: true,  write: false, modify: false, delete: false, print: true,  export: true,  approve: false },
  manufacturing:{ read: true,  write: true,  modify: true,  delete: false, print: true,  export: true,  approve: true  },
  settings:     { read: true,  write: true,  modify: true,  delete: false, print: false, export: false, approve: false },
}

type PermissionMatrix = Record<string, Record<Permission, boolean>>

export default function UsersRolesPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [companyModules, setCompanyModules] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')

  // User modal
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [userForm, setUserForm] = useState({
    name: '', email: '', phone: '',
    password: '', roleId: '', status: 'ACTIVE',
  })
  const [savingUser, setSavingUser] = useState(false)

  // Role modal
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<any>(null)
  const [roleName, setRoleName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [permMatrix, setPermMatrix] = useState<PermissionMatrix>({})
  const [savingRole, setSavingRole] = useState(false)

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    const cached = sessionStorage.getItem(`tenant_user_${sub}`)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setCompanyModules(parsed.moduleKeys || [])
      } catch {}
    }
    fetchData(sub)
  }, [])

  function getApi(sub: string) {
    return {
      get: (url: string) => axios.get(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      post: (url: string, data: any) => axios.post(`${process.env.NEXT_PUBLIC_API_URL}${url}`, data, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      put: (url: string, data: any) => axios.put(`${process.env.NEXT_PUBLIC_API_URL}${url}`, data, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      delete: (url: string) => axios.delete(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
    }
  }

  async function fetchData(sub: string) {
    try {
      const [uRes, rRes] = await Promise.all([
        getApi(sub).get('/erp/users/list'),
        getApi(sub).get('/erp/users/roles'),
      ])
      setUsers(uRes.data.data)
      setRoles(rRes.data.data)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // ── PERMISSION MATRIX HELPERS ──────────────────────────
  const availableModules = ALL_MODULES.filter((m) =>
    companyModules.includes(m.key) || companyModules.length === 0
  )

  function buildEmptyMatrix(): PermissionMatrix {
    const matrix: PermissionMatrix = {}
    availableModules.forEach((mod) => {
      matrix[mod.key] = DEFAULT_MODULE_PERMISSIONS[mod.key] || {
        read: true, write: false, modify: false,
        delete: false, print: false, export: false, approve: false,
      }
    })
    return matrix
  }

  function togglePermission(moduleKey: string, perm: Permission) {
    setPermMatrix((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [perm]: !prev[moduleKey]?.[perm],
      },
    }))
  }

  function toggleAllForModule(moduleKey: string, value: boolean) {
    setPermMatrix((prev) => ({
      ...prev,
      [moduleKey]: Object.fromEntries(
        PERMISSIONS.map((p) => [p, value])
      ) as Record<Permission, boolean>,
    }))
  }

  function toggleAllForPermission(perm: Permission, value: boolean) {
    setPermMatrix((prev) => {
      const updated = { ...prev }
      availableModules.forEach((mod) => {
        updated[mod.key] = { ...updated[mod.key], [perm]: value }
      })
      return updated
    })
  }

  // ── USER HANDLERS ──────────────────────────────────────
  function openCreateUser() {
    setEditingUser(null)
    setUserForm({ name: '', email: '', phone: '', password: '', roleId: '', status: 'ACTIVE' })
    setShowUserModal(true)
  }

  function openEditUser(user: any) {
    setEditingUser(user)
    setUserForm({ name: user.name, email: user.email, phone: user.phone || '', password: '', roleId: user.roleId || '', status: user.status })
    setShowUserModal(true)
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault()
    if (!userForm.name || !userForm.email) { toast.error('Name and email required'); return }
    if (!editingUser && !userForm.password) { toast.error('Password required for new user'); return }
    setSavingUser(true)
    try {
      if (editingUser) {
        await getApi(subdomain).put(`/erp/users/list/${editingUser.id}`, userForm)
        toast.success('User updated')
      } else {
        await getApi(subdomain).post('/erp/users/list', userForm)
        toast.success('User created')
      }
      setShowUserModal(false)
      fetchData(subdomain)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save user')
    } finally {
      setSavingUser(false)
    }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('Delete this user?')) return
    try {
      await getApi(subdomain).delete(`/erp/users/list/${id}`)
      toast.success('User deleted')
      fetchData(subdomain)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete user')
    }
  }

  // ── ROLE HANDLERS ──────────────────────────────────────
  function openCreateRole() {
    setEditingRole(null)
    setRoleName('')
    setRoleDescription('')
    setPermMatrix(buildEmptyMatrix())
    setShowRoleModal(true)
  }

  function openEditRole(role: any) {
    setEditingRole(role)
    setRoleName(role.name)
    setRoleDescription(role.description || '')
    // Load existing permissions or build defaults
    const existing = role.permissions || {}
    const matrix: PermissionMatrix = {}
    availableModules.forEach((mod) => {
      matrix[mod.key] = existing[mod.key] || DEFAULT_MODULE_PERMISSIONS[mod.key] || {
        read: false, write: false, modify: false,
        delete: false, print: false, export: false, approve: false,
      }
    })
    setPermMatrix(matrix)
    setShowRoleModal(true)
  }

  async function handleSaveRole(e: React.FormEvent) {
    e.preventDefault()
    if (!roleName) { toast.error('Role name required'); return }

    // moduleKeys derived from modules where at least read=true
    const moduleKeys = availableModules
      .filter((mod) => permMatrix[mod.key]?.read)
      .map((mod) => mod.key)

    setSavingRole(true)
    try {
      const payload = {
        name: roleName,
        description: roleDescription,
        moduleKeys,
        permissions: permMatrix,
      }
      if (editingRole) {
        await getApi(subdomain).put(`/erp/users/roles/${editingRole.id}`, payload)
        toast.success('Role updated')
      } else {
        await getApi(subdomain).post('/erp/users/roles', payload)
        toast.success('Role created')
      }
      setShowRoleModal(false)
      fetchData(subdomain)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save role')
    } finally {
      setSavingRole(false)
    }
  }

  async function handleDeleteRole(id: string) {
    if (!confirm('Delete this role?')) return
    try {
      await getApi(subdomain).delete(`/erp/users/roles/${id}`)
      toast.success('Role deleted')
      fetchData(subdomain)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete role')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #E2E8F0', borderRadius: '8px',
    fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, sans-serif', background: '#fff',
    boxSizing: 'border-box',
  }

  return (
    <TenantLayout
      title="Users & Roles"
      subtitle="Manage team members and permissions"
      requiredModule="users"
      headerRight={
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'users' ? (
            <button onClick={openCreateUser} style={{ padding: '10px 18px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              ➕ Add User
            </button>
          ) : (
            <button onClick={openCreateRole} style={{ padding: '10px 18px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              ➕ Add Role
            </button>
          )}
        </div>
      }
    >
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F1F5F9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {[{ key: 'users', label: '👥 Users' }, { key: 'roles', label: '🔐 Roles & Permissions' }].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} style={{
            padding: '8px 24px', borderRadius: '8px', border: 'none',
            background: activeTab === tab.key ? '#fff' : 'transparent',
            color: activeTab === tab.key ? '#0F172A' : '#64748B',
            fontSize: '13px', fontWeight: activeTab === tab.key ? 700 : 500,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>{tab.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* ── USERS TAB ── */}
          {activeTab === 'users' && (
            <>
              {users.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '80px', textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No users yet</h3>
                  <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>Add team members to give them ERP access</p>
                  <button onClick={openCreateUser} style={{ padding: '10px 24px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>➕ Add First User</button>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        {['User', 'Email', 'Role', 'Status', 'Type', 'Actions'].map((h) => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user, i) => (
                        <tr key={user.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: user.isOwner ? '#FFF7ED' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: user.isOwner ? '#EA580C' : '#1D4ED8' }}>
                                {user.name?.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{user.name}</div>
                                <div style={{ fontSize: '11px', color: '#94A3B8' }}>{user.phone || ''}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{user.email}</td>
                          <td style={{ padding: '14px 16px' }}>
                            {user.roleName ? (
                              <span style={{ padding: '4px 10px', background: '#FAF5FF', color: '#7C3AED', borderRadius: '99px', fontSize: '12px', fontWeight: 600 }}>{user.roleName}</span>
                            ) : <span style={{ fontSize: '12px', color: '#94A3B8' }}>—</span>}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: user.status === 'ACTIVE' ? '#F0FDF4' : '#FEF2F2', color: user.status === 'ACTIVE' ? '#16A34A' : '#DC2626', border: `1px solid ${user.status === 'ACTIVE' ? '#BBF7D0' : '#FECACA'}` }}>{user.status}</span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {user.isOwner
                              ? <span style={{ padding: '4px 10px', background: '#FFF7ED', color: '#EA580C', borderRadius: '99px', fontSize: '11px', fontWeight: 700, border: '1px solid #FED7AA' }}>👑 Owner</span>
                              : <span style={{ padding: '4px 10px', background: '#F1F5F9', color: '#64748B', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>Staff</span>
                            }
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {!user.isOwner && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => openEditUser(user)} style={{ padding: '6px 12px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Edit</button>
                                <button onClick={() => handleDeleteUser(user.id)} style={{ padding: '6px 12px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Delete</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── ROLES TAB ── */}
          {activeTab === 'roles' && (
            <>
              {roles.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '80px', textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No roles yet</h3>
                  <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>Create roles to control what each team member can access</p>
                  <button onClick={openCreateRole} style={{ padding: '10px 24px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>➕ Create First Role</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {roles.map((role) => {
                    const perms = role.permissions || {}
                    const enabledModules = availableModules.filter((m) => perms[m.key]?.read)
                    return (
                      <div key={role.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                        {/* Role Header */}
                        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FAF5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🔐</div>
                            <div>
                              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>{role.name}</div>
                              {role.description && <div style={{ fontSize: '12px', color: '#94A3B8' }}>{role.description}</div>}
                            </div>
                            <span style={{ padding: '4px 10px', background: '#FAF5FF', color: '#7C3AED', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>
                              {role.userCount} users
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => openEditRole(role)} style={{ padding: '8px 16px', background: '#FAF5FF', color: '#7C3AED', border: '1px solid #E9D5FF', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>✏️ Edit Permissions</button>
                            <button onClick={() => handleDeleteRole(role.id)} style={{ padding: '8px 12px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Delete</button>
                          </div>
                        </div>

                        {/* Permission Matrix Preview */}
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                            <thead>
                              <tr style={{ background: '#F8FAFC' }}>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', width: '180px' }}>Module</th>
                                {PERMISSIONS.map((p) => (
                                  <th key={p} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{PERM_LABELS[p]}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {enabledModules.map((mod, i) => (
                                <tr key={mod.key} style={{ borderTop: '1px solid #F1F5F9' }}>
                                  <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>{mod.label}</td>
                                  {PERMISSIONS.map((perm) => {
                                    const has = perms[mod.key]?.[perm]
                                    return (
                                      <td key={perm} style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '14px', color: has ? '#16A34A' : '#E2E8F0' }}>
                                          {has ? '✓' : '—'}
                                        </span>
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))}
                              {enabledModules.length === 0 && (
                                <tr>
                                  <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No module access assigned</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── USER MODAL ── */}
      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '24px' }}>
              {editingUser ? '✏️ Edit User' : '➕ Add User'}
            </h3>
            <form onSubmit={handleSaveUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Full Name *</label>
                  <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="e.g. Ahmed Khan" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Email *</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="user@email.com" disabled={!!editingUser} style={{ ...inputStyle, background: editingUser ? '#F8FAFC' : '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Phone</label>
                  <input value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} placeholder="+92 300 0000000" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                    Password {editingUser && <span style={{ color: '#94A3B8', fontWeight: 400 }}>(leave blank to keep current)</span>}
                  </label>
                  <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Min 6 characters" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Role</label>
                  <select value={userForm.roleId} onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })} style={inputStyle}>
                    <option value="">No Role</option>
                    {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                {editingUser && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Status</label>
                    <select value={userForm.status} onChange={(e) => setUserForm({ ...userForm, status: e.target.value })} style={inputStyle}>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowUserModal(false)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={savingUser} style={{ flex: 1, padding: '12px', background: savingUser ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: savingUser ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {savingUser ? 'Saving...' : editingUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ROLE MODAL (Permission Matrix) ── */}
      {showRoleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '0', width: '100%', maxWidth: '900px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>

            {/* Modal Header */}
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
                {editingRole ? '✏️ Edit Role Permissions' : '➕ Create Role'}
              </h3>
              <button onClick={() => setShowRoleModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
            </div>

            {/* Role Name + Description */}
            <div style={{ padding: '20px 32px', borderBottom: '1px solid #F1F5F9', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Role Name *</label>
                <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Accountant" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Description</label>
                <input value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} placeholder="What does this role do?" style={inputStyle} />
              </div>
            </div>

            {/* Permission Matrix */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ background: '#1E3A5F' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#fff', width: '200px' }}>Module / Page</th>
                      {PERMISSIONS.map((p) => (
                        <th key={p} style={{ padding: '12px 8px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                          <div>{PERM_LABELS[p]}</div>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
                            <button type="button" onClick={() => toggleAllForPermission(p, true)} style={{ fontSize: '9px', padding: '1px 4px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>All</button>
                            <button type="button" onClick={() => toggleAllForPermission(p, false)} style={{ fontSize: '9px', padding: '1px 4px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>None</button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {availableModules.map((mod, i) => {
                      const modPerms = permMatrix[mod.key] || {}
                      const allEnabled = PERMISSIONS.every((p) => modPerms[p])
                      const noneEnabled = PERMISSIONS.every((p) => !modPerms[p])
                      return (
                        <tr key={mod.key} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{mod.label}</span>
                              <div style={{ display: 'flex', gap: '3px', marginLeft: 'auto' }}>
                                <button type="button" onClick={() => toggleAllForModule(mod.key, true)} style={{ fontSize: '9px', padding: '1px 5px', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '3px', cursor: 'pointer' }}>All</button>
                                <button type="button" onClick={() => toggleAllForModule(mod.key, false)} style={{ fontSize: '9px', padding: '1px 5px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '3px', cursor: 'pointer' }}>None</button>
                              </div>
                            </div>
                          </td>
                          {PERMISSIONS.map((perm) => {
                            const checked = !!modPerms[perm]
                            return (
                              <td key={perm} style={{ padding: '12px 8px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => togglePermission(mod.key, perm)}
                                  style={{
                                    width: '28px', height: '28px', borderRadius: '6px',
                                    border: `2px solid ${checked ? '#7C3AED' : '#E2E8F0'}`,
                                    background: checked ? '#7C3AED' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', margin: '0 auto',
                                    fontSize: '14px', color: '#fff',
                                  }}
                                >
                                  {checked ? '✓' : ''}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '20px 32px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowRoleModal(false)} style={{ padding: '12px 24px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={handleSaveRole} disabled={savingRole} style={{ padding: '12px 32px', background: savingRole ? '#94A3B8' : '#7C3AED', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: savingRole ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {savingRole ? 'Saving...' : editingRole ? '💾 Update Role' : '🔐 Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}