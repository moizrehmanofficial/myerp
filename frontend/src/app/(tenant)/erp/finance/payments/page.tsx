'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    amount: '',
    method: 'CASH',
    supplierId: '',
    customerId: '',
    debitAccountId: '',
    creditAccountId: '',
    reference: '',
    notes: '',
  })

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
      const [pRes, aRes, sRes, cRes] = await Promise.all([
        getApi(sub).get('/erp/finance/payments'),
        getApi(sub).get('/erp/finance/accounts'),
        getApi(sub).get('/erp/purchase/suppliers'),
        getApi(sub).get('/erp/invoices/customers'),
      ])
      setPayments(pRes.data.data)
      setAccounts(aRes.data.data.accounts)
      setSuppliers(sRes.data.data)
      setCustomers(cRes.data.data)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter valid amount'); return }
    setSubmitting(true)
    try {
      await getApi(subdomain).post('/erp/finance/payments', form)
      toast.success('Payment recorded!')
      setShowModal(false)
      setForm({ amount: '', method: 'CASH', supplierId: '', customerId: '', debitAccountId: '', creditAccountId: '', reference: '', notes: '' })
      fetchData(subdomain)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #E2E8F0', borderRadius: '8px',
    fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, sans-serif', background: '#fff',
    boxSizing: 'border-box',
  }

  const methods = ['CASH', 'BANK', 'CHEQUE', 'ONLINE']

  return (
    <TenantLayout
      title="Payment Vouchers"
      subtitle="Record money going out"
      requiredModule="finance"
      headerRight={
        <button onClick={() => setShowModal(true)} style={{ padding: '10px 18px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          ➕ New Payment
        </button>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : payments.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '80px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💸</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No payments yet</h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>Record payments made to suppliers or others</p>
          <button onClick={() => setShowModal(true)} style={{ padding: '10px 24px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>➕ Record First Payment</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Date', 'To', 'Method', 'Amount', 'Reference', 'Notes'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any, i: number) => (
                <tr key={p.id} style={{ borderBottom: i < payments.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{p.supplierName || p.customerName || 'General'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '3px 8px', background: '#F1F5F9', color: '#374151', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{p.method}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 700, color: '#DC2626' }}>PKR {Number(p.amount || 0).toLocaleString()}</td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94A3B8', fontFamily: 'monospace' }}>{p.reference || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '24px' }}>💸 Record Payment</h3>
            <form onSubmit={handleSubmit}>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Amount (PKR) *</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} min="0" placeholder="0" style={inputStyle} />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Payment Method</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {methods.map((m) => (
                    <button key={m} type="button" onClick={() => setForm({ ...form, method: m })} style={{
                      flex: 1, padding: '8px 4px', border: `2px solid ${form.method === m ? '#1E3A5F' : '#E2E8F0'}`,
                      borderRadius: '8px', background: form.method === m ? '#EFF6FF' : '#F8FAFC',
                      color: form.method === m ? '#1E3A5F' : '#64748B',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    }}>{m}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Paid To (Supplier)</label>
                  <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value, customerId: '' })} style={inputStyle}>
                    <option value="">Select Supplier...</option>
                    {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Or Customer</label>
                  <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, supplierId: '' })} style={inputStyle}>
                    <option value="">Select Customer...</option>
                    {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Debit Account</label>
                  <select value={form.debitAccountId} onChange={(e) => setForm({ ...form, debitAccountId: e.target.value })} style={inputStyle}>
                    <option value="">Select Account...</option>
                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Credit Account</label>
                  <select value={form.creditAccountId} onChange={(e) => setForm({ ...form, creditAccountId: e.target.value })} style={inputStyle}>
                    <option value="">Select Account...</option>
                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Reference</label>
                  <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="e.g. Cheque #001" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Notes</label>
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Purpose of payment" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '12px', background: submitting ? '#94A3B8' : '#DC2626', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>{submitting ? 'Saving...' : '💸 Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}