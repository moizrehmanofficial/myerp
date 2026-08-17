'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import { getTenantSlug } from '@/lib/getTenantSlug'

export default function ManufacturingPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const [form, setForm] = useState({
    productId: '',
    quantity: '1',
    startDate: '',
    endDate: '',
    notes: '',
  })

  const [materials, setMaterials] = useState([
    { productId: '', requiredQuantity: '1' }
  ])

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchData(sub)
  }, [])

  function getApi(sub: string) {
    return {
      get: (url: string) => axios.get(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      post: (url: string, data: any) => axios.post(`${process.env.NEXT_PUBLIC_API_URL}${url}`, data, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      patch: (url: string, data: any) => axios.patch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, data, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      delete: (url: string) => axios.delete(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
    }
  }

  async function fetchData(sub: string) {
    setLoading(true)
    try {
      const [oRes, pRes] = await Promise.all([
        getApi(sub).get('/erp/manufacturing/orders'),
        getApi(sub).get('/erp/manufacturing/products'),
      ])
      setOrders(oRes.data.data)
      setProducts(pRes.data.data)
    } catch {
      toast.error('Failed to load manufacturing orders')
    } finally {
      setLoading(false)
    }
  }

  function addMaterial() {
    setMaterials([...materials, { productId: '', requiredQuantity: '1' }])
  }

  function removeMaterial(index: number) {
    if (materials.length === 1) return
    setMaterials(materials.filter((_, i) => i !== index))
  }

  function updateMaterial(index: number, field: string, value: string) {
    const updated = [...materials]
    updated[index] = { ...updated[index], [field]: value }
    setMaterials(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.productId) { toast.error('Select a finished product'); return }
    if (!form.quantity || parseFloat(form.quantity) <= 0) { toast.error('Enter valid quantity'); return }
    setSubmitting(true)
    try {
      await getApi(subdomain).post('/erp/manufacturing/orders', {
        ...form,
        materials: materials.filter((m) => m.productId),
      })
      toast.success('Manufacturing order created!')
      setShowModal(false)
      setForm({ productId: '', quantity: '1', startDate: '', endDate: '', notes: '' })
      setMaterials([{ productId: '', requiredQuantity: '1' }])
      fetchData(subdomain)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create order')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusUpdate(id: string, status: string) {
    const confirmMsg = status === 'COMPLETED'
      ? 'Mark as COMPLETED? This will deduct raw materials and add finished product to stock.'
      : `Mark as ${status}?`
    if (!confirm(confirmMsg)) return
    setUpdating(id)
    try {
      await getApi(subdomain).patch(`/erp/manufacturing/orders/${id}/status`, { status })
      toast.success(status === 'COMPLETED' ? 'Order completed — stock updated!' : 'Status updated')
      fetchData(subdomain)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setUpdating(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this order?')) return
    try {
      await getApi(subdomain).delete(`/erp/manufacturing/orders/${id}`)
      toast.success('Order deleted')
      fetchData(subdomain)
    } catch {
      toast.error('Failed to delete')
    }
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'COMPLETED':   return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' }
      case 'IN_PROGRESS': return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
      case 'PLANNED':     return { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' }
      case 'CANCELLED':   return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' }
      default:            return { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
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
      title="Manufacturing"
      subtitle="Manage production orders"
      requiredModule="manufacturing"
      headerRight={
        <button
          onClick={() => setShowModal(true)}
          style={{ padding: '10px 18px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
        >➕ New Production Order</button>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : orders.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '80px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏭</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No production orders yet</h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>Create a production order to start manufacturing</p>
          <button onClick={() => setShowModal(true)} style={{ padding: '10px 24px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>➕ Create First Order</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Order #', 'Finished Product', 'Quantity', 'Start Date', 'End Date', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order: any, i: number) => {
                const ss = getStatusStyle(order.status)
                return (
                  <tr key={order.id} style={{ borderBottom: i < orders.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#1E3A5F', background: '#EFF6FF', padding: '3px 8px', borderRadius: '6px' }}>{order.orderNumber}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{order.productName}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>{order.productSku}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                      {parseFloat(order.quantity).toLocaleString()} {order.productUnit}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>
                      {order.startDate ? new Date(order.startDate).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>
                      {order.endDate ? new Date(order.endDate).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => router.push(`/erp/manufacturing/${order.id}`)}
                          style={{ padding: '6px 10px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                        >View</button>
                        {order.status === 'PLANNED' && (
                          <button
                            onClick={() => handleStatusUpdate(order.id, 'IN_PROGRESS')}
                            disabled={updating === order.id}
                            style={{ padding: '6px 10px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                          >▶ Start</button>
                        )}
                        {order.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleStatusUpdate(order.id, 'COMPLETED')}
                            disabled={updating === order.id}
                            style={{ padding: '6px 10px', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                          >✓ Complete</button>
                        )}
                        {order.status === 'PLANNED' && (
                          <button
                            onClick={() => handleDelete(order.id)}
                            style={{ padding: '6px 10px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                          >Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Order Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '24px' }}>🏭 New Production Order</h3>
            <form onSubmit={handleSubmit}>

              {/* Finished Product */}
              <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '12px' }}>✅ Finished Product (Output)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Product to Manufacture *</label>
                    <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} style={inputStyle}>
                      <option value="">Select Product...</option>
                      {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Stock: {parseFloat(p.stock || 0)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Quantity to Produce *</label>
                    <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} min="1" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Start Date</label>
                    <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>End Date</label>
                    <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Raw Materials */}
              <div style={{ background: '#FFF7ED', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#EA580C' }}>📦 Raw Materials (Input)</h4>
                  <button type="button" onClick={addMaterial} style={{ padding: '5px 12px', background: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>+ Add Material</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 36px', gap: '8px', padding: '6px 4px', background: 'rgba(0,0,0,0.04)', borderRadius: '6px', marginBottom: '8px' }}>
                  {['Raw Material Product', 'Required Qty', ''].map((h) => (
                    <div key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', paddingLeft: '4px' }}>{h}</div>
                  ))}
                </div>

                {materials.map((mat, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 36px', gap: '8px', marginBottom: '8px' }}>
                    <select value={mat.productId} onChange={(e) => updateMaterial(index, 'productId', e.target.value)} style={inputStyle}>
                      <option value="">Select Product...</option>
                      {products.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Available: {parseFloat(p.stock || 0)}</option>
                      ))}
                    </select>
                    <input type="number" value={mat.requiredQuantity} min="0.01" onChange={(e) => updateMaterial(index, 'requiredQuantity', e.target.value)} style={inputStyle} />
                    <button type="button" onClick={() => removeMaterial(index)} disabled={materials.length === 1} style={{ width: '36px', height: '36px', background: materials.length === 1 ? '#F1F5F9' : '#FEF2F2', color: materials.length === 1 ? '#CBD5E1' : '#DC2626', border: 'none', borderRadius: '8px', cursor: materials.length === 1 ? 'not-allowed' : 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional production notes..." rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 2, padding: '12px', background: submitting ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {submitting ? 'Creating...' : '🏭 Create Production Order'}
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