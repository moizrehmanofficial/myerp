'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'

export default function PurchaseReturnsPage() {
  const [returns, setReturns] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    supplierId: '',
    purchaseOrderId: '',
    reason: '',
  })

  const [items, setItems] = useState([
    { productId: '', quantity: '1', unitPrice: '0' }
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
      const [rRes, sRes, pRes] = await Promise.all([
        getApi(sub).get('/erp/returns/purchase'),
        getApi(sub).get('/erp/returns/suppliers'),
        getApi(sub).get('/erp/returns/products'),
      ])
      setReturns(rRes.data.data)
      setSuppliers(sRes.data.data)
      setProducts(pRes.data.data)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function addItem() {
    setItems([...items, { productId: '', quantity: '1', unitPrice: '0' }])
  }

  function removeItem(index: number) {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: string, value: string) {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'productId') {
      const product = products.find((p) => p.id === value)
      if (product) updated[index].unitPrice = product.purchasePrice?.toString() || '0'
    }
    setItems(updated)
  }

  const total = items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
  }, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.supplierId) { toast.error('Select a supplier'); return }
    const validItems = items.filter((i) => i.productId)
    if (validItems.length === 0) { toast.error('Add at least one product'); return }
    setSubmitting(true)
    try {
      await getApi(subdomain).post('/erp/returns/purchase', { ...form, items: validItems })
      toast.success('Purchase return created — stock deducted!')
      setShowModal(false)
      setForm({ supplierId: '', purchaseOrderId: '', reason: '' })
      setItems([{ productId: '', quantity: '1', unitPrice: '0' }])
      fetchData(subdomain)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create return')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 10px',
    border: '1.5px solid #E2E8F0', borderRadius: '8px',
    fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, sans-serif', background: '#fff',
    boxSizing: 'border-box',
  }

  return (
    <TenantLayout
      title="Purchase Returns"
      subtitle="Record goods returned to suppliers"
      requiredModule="purchase"
      headerRight={
        <button onClick={() => setShowModal(true)} style={{ padding: '10px 18px', background: '#EA580C', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          ➕ New Return
        </button>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : returns.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '80px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>↩️</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No purchase returns yet</h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>Record goods returned to suppliers</p>
          <button onClick={() => setShowModal(true)} style={{ padding: '10px 24px', background: '#EA580C', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>➕ Create First Return</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Return #', 'Supplier', 'Date', 'Total Amount', 'Reason', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {returns.map((r: any, i: number) => (
                <tr key={r.id} style={{ borderBottom: i < returns.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#EA580C', background: '#FFF7ED', padding: '3px 8px', borderRadius: '6px' }}>{r.returnNumber}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{r.supplierName || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 700, color: '#EA580C' }}>PKR {Number(r.totalAmount || 0).toLocaleString()}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{r.reason || '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '4px 10px', background: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '24px' }}>↩️ New Purchase Return</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Supplier *</label>
                  <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} style={inputStyle}>
                    <option value="">Select Supplier...</option>
                    {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Reason</label>
                  <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Damaged goods" style={inputStyle} />
                </div>
              </div>

              {/* Items */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Products to Return</label>
                  <button type="button" onClick={addItem} style={{ padding: '6px 12px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>+ Add Row</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '3fr 80px 110px 36px', gap: '8px', padding: '8px 4px', background: '#F8FAFC', borderRadius: '8px', marginBottom: '8px' }}>
                  {['Product', 'Qty', 'Purchase Price', ''].map((h) => (
                    <div key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', paddingLeft: '4px' }}>{h}</div>
                  ))}
                </div>

                {items.map((item, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '3fr 80px 110px 36px', gap: '8px', marginBottom: '8px' }}>
                    <select value={item.productId} onChange={(e) => updateItem(index, 'productId', e.target.value)} style={inputStyle}>
                      <option value="">Select Product...</option>
                      {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                    <input type="number" value={item.quantity} min="1" onChange={(e) => updateItem(index, 'quantity', e.target.value)} style={inputStyle} />
                    <input type="number" value={item.unitPrice} min="0" onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} style={inputStyle} />
                    <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1} style={{ width: '36px', height: '36px', background: items.length === 1 ? '#F1F5F9' : '#FEF2F2', color: items.length === 1 ? '#CBD5E1' : '#DC2626', border: 'none', borderRadius: '8px', cursor: items.length === 1 ? 'not-allowed' : 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#FFF7ED', borderRadius: '8px', marginTop: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#EA580C' }}>Total Return Amount</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#EA580C' }}>PKR {total.toLocaleString()}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 2, padding: '12px', background: submitting ? '#94A3B8' : '#EA580C', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {submitting ? 'Creating...' : '↩️ Create Purchase Return'}
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