'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'

export default function JournalPage() {
  const router = useRouter()
  const [journals, setJournals] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [items, setItems] = useState([
    { accountId: '', debit: '0', credit: '0', description: '' },
    { accountId: '', debit: '0', credit: '0', description: '' },
  ])

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchData(sub)
  }, [])

  function getApi(sub: string) {
    return {
      get: (url: string) => axios.get(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      post: (url: string, data: any) => axios.post(`${process.env.NEXT_PUBLIC_API_URL}${url}`, data, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
    }
  }

  async function fetchData(sub: string) {
    try {
      const [jRes, aRes] = await Promise.all([
        getApi(sub).get('/erp/finance/journals'),
        getApi(sub).get('/erp/finance/accounts'),
      ])
      setJournals(jRes.data.data)
      setAccounts(aRes.data.data.accounts)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function updateItem(index: number, field: string, value: string) {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  function addRow() {
    setItems([...items, { accountId: '', debit: '0', credit: '0', description: '' }])
  }

  function removeRow(index: number) {
    if (items.length <= 2) return
    setItems(items.filter((_, i) => i !== index))
  }

  const totalDebit = items.reduce((sum, i) => sum + (parseFloat(i.debit) || 0), 0)
  const totalCredit = items.reduce((sum, i) => sum + (parseFloat(i.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description) { toast.error('Description is required'); return }
    if (!isBalanced) { toast.error(`Journal not balanced! Debit: ${totalDebit}, Credit: ${totalCredit}`); return }
    setSubmitting(true)
    try {
      await getApi(subdomain).post('/erp/finance/journals', { description, reference, items })
      toast.success('Journal entry created!')
      setShowModal(false)
      setDescription('')
      setReference('')
      setItems([
        { accountId: '', debit: '0', credit: '0', description: '' },
        { accountId: '', debit: '0', credit: '0', description: '' },
      ])
      fetchData(subdomain)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create journal')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    border: '1.5px solid #E2E8F0', borderRadius: '8px',
    fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, sans-serif', background: '#fff',
    boxSizing: 'border-box',
  }

  return (
    <TenantLayout
      title="Journal Vouchers"
      subtitle="Double-entry bookkeeping"
      requiredModule="finance"
      headerRight={
        <button onClick={() => setShowModal(true)} style={{ padding: '10px 18px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          ➕ New Journal Entry
        </button>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : journals.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '80px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📒</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No journal entries yet</h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>Create your first double-entry journal voucher</p>
          <button onClick={() => setShowModal(true)} style={{ padding: '10px 24px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>➕ Create First Entry</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Entry No', 'Date', 'Description', 'Reference', 'Total Debit', 'Total Credit', 'Action'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {journals.map((j: any, i: number) => (
                <tr key={j.id} style={{ borderBottom: i < journals.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#7C3AED', background: '#FAF5FF', padding: '3px 8px', borderRadius: '6px' }}>{j.entryNumber}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>{new Date(j.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{j.description}</td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94A3B8', fontFamily: 'monospace' }}>{j.reference || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>PKR {Number(j.totalDebit || 0).toLocaleString()}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>PKR {Number(j.totalCredit || 0).toLocaleString()}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <button onClick={() => router.push(`/erp/finance/journal/${j.id}`)} style={{ padding: '6px 12px', background: '#FAF5FF', color: '#7C3AED', border: '1px solid #E9D5FF', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Journal Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>📒 New Journal Entry</h3>
              <div style={{
                padding: '6px 14px', borderRadius: '99px', fontSize: '12px', fontWeight: 700,
                background: isBalanced ? '#F0FDF4' : '#FEF2F2',
                color: isBalanced ? '#16A34A' : '#DC2626',
                border: `1px solid ${isBalanced ? '#BBF7D0' : '#FECACA'}`,
              }}>
                {isBalanced ? '✓ Balanced' : `⚠ Diff: PKR ${Math.abs(totalDebit - totalCredit).toLocaleString()}`}
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Description *</label>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Office rent paid for June" style={{ ...inputStyle, padding: '10px 12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Reference</label>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Receipt #123" style={{ ...inputStyle, padding: '10px 12px' }} />
                </div>
              </div>

              {/* Items Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 120px 120px 2fr 32px', gap: '8px', padding: '8px 4px', background: '#F8FAFC', borderRadius: '8px', marginBottom: '8px' }}>
                {['Account', 'Debit (PKR)', 'Credit (PKR)', 'Description', ''].map((h) => (
                  <div key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', paddingLeft: '4px' }}>{h}</div>
                ))}
              </div>

              {/* Items */}
              {items.map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '3fr 120px 120px 2fr 32px', gap: '8px', marginBottom: '8px' }}>
                  <select
                    value={item.accountId}
                    onChange={(e) => updateItem(index, 'accountId', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Select Account...</option>
                    {accounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                  <input
                    type="number" value={item.debit} min="0"
                    onChange={(e) => updateItem(index, 'debit', e.target.value)}
                    style={inputStyle} placeholder="0"
                  />
                  <input
                    type="number" value={item.credit} min="0"
                    onChange={(e) => updateItem(index, 'credit', e.target.value)}
                    style={inputStyle} placeholder="0"
                  />
                  <input
                    type="text" value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    style={inputStyle} placeholder="Note..."
                  />
                  <button
                    type="button" onClick={() => removeRow(index)}
                    disabled={items.length <= 2}
                    style={{
                      width: '32px', height: '36px',
                      background: items.length <= 2 ? '#F1F5F9' : '#FEF2F2',
                      color: items.length <= 2 ? '#CBD5E1' : '#DC2626',
                      border: 'none', borderRadius: '8px', cursor: items.length <= 2 ? 'not-allowed' : 'pointer',
                      fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >×</button>
                </div>
              ))}

              {/* Totals Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 120px 120px 2fr 32px', gap: '8px', padding: '10px 4px', borderTop: '2px dashed #E2E8F0', marginTop: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', paddingLeft: '4px' }}>Total</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#16A34A' }}>PKR {totalDebit.toLocaleString()}</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#DC2626' }}>PKR {totalCredit.toLocaleString()}</div>
                <div />
                <div />
              </div>

              <button
                type="button" onClick={addRow}
                style={{ marginTop: '8px', padding: '8px 16px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >+ Add Row</button>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={submitting || !isBalanced} style={{ flex: 2, padding: '12px', background: !isBalanced ? '#94A3B8' : submitting ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: !isBalanced || submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {submitting ? 'Saving...' : '📒 Post Journal Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}