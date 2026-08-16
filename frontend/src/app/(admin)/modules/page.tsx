'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/axios'
import toast from 'react-hot-toast'
import AdminLayout from '@/components/layout/AdminLayout'

export default function ModulesPage() {
  const [modules, setModules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    key: '',
    description: '',
    sortOrder: '',
  })

  useEffect(() => {
    fetchModules()
  }, [])

  async function fetchModules() {
    try {
      const res = await api.get('/super-admin/modules')
      setModules(res.data.data)
    } catch {
      toast.error('Failed to load modules')
    } finally {
      setLoading(false)
    }
  }

  async function toggleModule(id: string, isActive: boolean) {
    setSaving(id)
    try {
      await api.patch(`/super-admin/modules/${id}`, { isActive: !isActive })
      toast.success(`Module ${!isActive ? 'enabled' : 'disabled'}`)
      fetchModules()
    } catch {
      toast.error('Failed to update module')
    } finally {
      setSaving(null)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.key) { toast.error('Name and key required'); return }
    setSubmitting(true)
    try {
      await api.post('/super-admin/modules', form)
      toast.success('Module created!')
      setShowModal(false)
      setForm({ name: '', key: '', description: '', sortOrder: '' })
      fetchModules()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create module')
    } finally {
      setSubmitting(false)
    }
  }

  const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
    true:  { bg: '#F0FDF4', color: '#16A34A' },
    false: { bg: '#FEF2F2', color: '#DC2626' },
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
      title="Modules"
      subtitle="Manage available ERP modules"
      headerRight={
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '10px 18px', background: '#1E3A5F',
            color: '#fff', border: 'none', borderRadius: '10px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >➕ Add Module</button>
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
                {['Sort', 'Module Name', 'Key', 'Description', 'Status', 'Toggle'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((mod, i) => {
                const ts = TYPE_COLORS[String(mod.isActive)]
                return (
                  <tr key={mod.id}
                    style={{ borderBottom: i < modules.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#94A3B8', fontWeight: 600 }}>
                      {mod.sortOrder}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{mod.name}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#7C3AED', background: '#FAF5FF', padding: '3px 8px', borderRadius: '6px' }}>
                        {mod.key}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>
                      {mod.description || '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: ts.bg, color: ts.color, border: `1px solid ${mod.isActive ? '#BBF7D0' : '#FECACA'}` }}>
                        {mod.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => toggleModule(mod.id, mod.isActive)}
                        disabled={saving === mod.id}
                        style={{
                          padding: '7px 16px',
                          background: saving === mod.id ? '#94A3B8' : mod.isActive ? '#FEF2F2' : '#F0FDF4',
                          color: saving === mod.id ? '#fff' : mod.isActive ? '#DC2626' : '#16A34A',
                          border: `1px solid ${mod.isActive ? '#FECACA' : '#BBF7D0'}`,
                          borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                          cursor: saving === mod.id ? 'not-allowed' : 'pointer',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {saving === mod.id ? '...' : mod.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Module Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '460px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '24px' }}>➕ Add Module</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Module Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. CRM" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Key * (unique)</label>
                  <input
                    value={form.key}
                    onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    placeholder="e.g. crm"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Sort Order</label>
                  <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} placeholder="18" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Description</label>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this module does" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '12px', background: submitting ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {submitting ? 'Creating...' : 'Create Module'}
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