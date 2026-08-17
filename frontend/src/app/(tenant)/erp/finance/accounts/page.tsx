'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import { getTenantSlug } from '@/lib/getTenantSlug'

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']

const TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  ASSET:     { bg: '#EFF6FF', color: '#1D4ED8', label: 'Asset' },
  LIABILITY: { bg: '#FEF2F2', color: '#DC2626', label: 'Liability' },
  EQUITY:    { bg: '#FAF5FF', color: '#7C3AED', label: 'Equity' },
  INCOME:    { bg: '#F0FDF4', color: '#16A34A', label: 'Income' },
  EXPENSE:   { bg: '#FFF7ED', color: '#EA580C', label: 'Expense' },
}

export default function ChartOfAccountsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeType, setActiveType] = useState('ALL')
  const [form, setForm] = useState({ code: '', name: '', type: 'ASSET', parentId: '' })

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchAccounts(sub)
  }, [])

  function getApi(sub: string) {
    return {
      get: (url: string) => axios.get(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      post: (url: string, data: any) => axios.post(`${process.env.NEXT_PUBLIC_API_URL}${url}`, data, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
    }
  }

  async function fetchAccounts(sub: string) {
    try {
      const res = await getApi(sub).get('/erp/finance/accounts')
      setData(res.data.data)
    } catch {
      toast.error('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code || !form.name) { toast.error('Code and name required'); return }
    setSubmitting(true)
    try {
      await getApi(subdomain).post('/erp/finance/accounts', form)
      toast.success('Account created!')
      setShowModal(false)
      setForm({ code: '', name: '', type: 'ASSET', parentId: '' })
      fetchAccounts(subdomain)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create account')
    } finally {
      setSubmitting(false)
    }
  }

  const accounts = data?.accounts || []
  const filtered = activeType === 'ALL' ? accounts : accounts.filter((a: any) => a.type === activeType)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #E2E8F0', borderRadius: '8px',
    fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, sans-serif', background: '#fff',
    boxSizing: 'border-box',
  }

  return (
    <TenantLayout
      title="Chart of Accounts"
      subtitle="Manage your company accounts"
      requiredModule="finance"
      headerRight={
        <button onClick={() => setShowModal(true)} style={{ padding: '10px 18px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          ➕ Add Account
        </button>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {ACCOUNT_TYPES.map((type) => {
              const ts = TYPE_STYLES[type]
              const count = (data?.grouped?.[type] || []).length
              const total = (data?.grouped?.[type] || []).reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0)
              return (
                <button
                  key={type}
                  onClick={() => setActiveType(activeType === type ? 'ALL' : type)}
                  style={{
                    background: activeType === type ? ts.bg : '#fff',
                    border: `2px solid ${activeType === type ? ts.color : '#E2E8F0'}`,
                    borderRadius: '12px', padding: '14px',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: ts.color, textTransform: 'uppercase', marginBottom: '4px' }}>{ts.label}</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '2px' }}>{count} accounts</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>PKR {total.toLocaleString()}</div>
                </button>
              )
            })}
          </div>

          {/* Accounts Table */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Code', 'Account Name', 'Type', 'Balance', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((account: any, i: number) => {
                  const ts = TYPE_STYLES[account.type]
                  return (
                    <tr key={account.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#374151' }}>{account.code}</span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{account.name}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: ts.bg, color: ts.color }}>{ts.label}</span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 700, color: Number(account.balance) >= 0 ? '#0F172A' : '#DC2626' }}>
                        PKR {Number(account.balance || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <a href={`/erp/finance/accounts/${account.id}/ledger`} style={{
                          padding: '6px 12px', background: '#EFF6FF',
                          color: '#1D4ED8', border: '1px solid #BFDBFE',
                          borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                          cursor: 'pointer', textDecoration: 'none',
                          display: 'inline-block',
                        }}>View Ledger</a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '460px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '20px' }}>➕ Add Account</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Code *</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. 1002" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Account Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Petty Cash" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Account Type *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                  {ACCOUNT_TYPES.map((type) => {
                    const ts = TYPE_STYLES[type]
                    return (
                      <button key={type} type="button" onClick={() => setForm({ ...form, type })} style={{
                        padding: '8px 4px', border: `2px solid ${form.type === type ? ts.color : '#E2E8F0'}`,
                        borderRadius: '8px', background: form.type === type ? ts.bg : '#F8FAFC',
                        color: form.type === type ? ts.color : '#64748B',
                        fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      }}>{ts.label}</button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '12px', background: submitting ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>{submitting ? 'Saving...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}