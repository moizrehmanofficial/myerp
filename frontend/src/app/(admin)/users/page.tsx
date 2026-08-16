'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/axios'
import toast from 'react-hot-toast'
import AdminLayout from '@/components/layout/AdminLayout'

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  useEffect(() => {
    fetchAdmins()
  }, [])

  async function fetchAdmins() {
    try {
      const res = await api.get('/super-admin/admins')
      setAdmins(res.data.data)
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      toast.error('All fields required')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/super-admin/admins', form)
      toast.success('Admin user created!')
      setShowModal(false)
      setForm({ name: '', email: '', password: '' })
      fetchAdmins()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(id: string, status: string) {
    try {
      await api.patch(`/super-admin/admins/${id}`, {
        status: status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      })
      toast.success('Status updated')
      fetchAdmins()
    } catch {
      toast.error('Failed to update')
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
    <AdminLayout
      title="Admin Users"
      subtitle="Manage Super Admin accounts"
      headerRight={
        <button onClick={() => setShowModal(true)} style={{ padding: '10px 18px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          ➕ Add Admin User
        </button>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['User', 'Email', 'Role', 'Status', 'Created', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map((admin, i) => (
                <tr key={admin.id} style={{ borderBottom: i < admins.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: '#1D4ED8' }}>
                        {admin.name?.charAt(0)}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{admin.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{admin.email}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '4px 10px', background: '#FFF7ED', color: '#EA580C', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>
                      {admin.role}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                      background: admin.status === 'ACTIVE' ? '#F0FDF4' : '#FEF2F2',
                      color: admin.status === 'ACTIVE' ? '#16A34A' : '#DC2626',
                      border: `1px solid ${admin.status === 'ACTIVE' ? '#BBF7D0' : '#FECACA'}`,
                    }}>{admin.status}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94A3B8' }}>
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {admin.role !== 'SUPER_ADMIN' && (
                      <button
                        onClick={() => handleToggle(admin.id, admin.status)}
                        style={{
                          padding: '6px 14px',
                          background: admin.status === 'ACTIVE' ? '#FEF2F2' : '#F0FDF4',
                          color: admin.status === 'ACTIVE' ? '#DC2626' : '#16A34A',
                          border: `1px solid ${admin.status === 'ACTIVE' ? '#FECACA' : '#BBF7D0'}`,
                          borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {admin.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '24px' }}>➕ Add Admin User</h3>
            <form onSubmit={handleCreate}>
              {[
                { label: 'Full Name', key: 'name', type: 'text', placeholder: 'e.g. John Admin' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'admin@myerp.com' },
                { label: 'Password', key: 'password', type: 'password', placeholder: 'Min 8 characters' },
              ].map((field) => (
                <div key={field.key} style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>{field.label}</label>
                  <input
                    type={field.type}
                    value={(form as any)[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                    onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '12px', background: submitting ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AdminLayout>
  )
}