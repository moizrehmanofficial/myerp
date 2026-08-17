'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import { getTenantSlug } from '@/lib/getTenantSlug'

export default function CreatePurchaseOrderPage() {
  const router = useRouter()
  const [subdomain, setSubdomain] = useState('')
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    supplierId: '',
    status: 'PENDING',
    notes: '',
  })

  const [items, setItems] = useState<any[]>([
    { productId: '', productName: '', quantity: '1', unitPrice: '0' }
  ])

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchDropdowns(sub)
  }, [])

  function getApi(sub: string) {
    return {
      get: (url: string) => axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${url}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      ),
      post: (url: string, data: any) => axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}${url}`, data,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      ),
    }
  }

  async function fetchDropdowns(sub: string) {
    try {
      const [suppRes, prodRes] = await Promise.all([
        getApi(sub).get('/erp/purchase/suppliers'),
        getApi(sub).get('/erp/purchase/products'),
      ])
      setSuppliers(suppRes.data.data)
      setProducts(prodRes.data.data)
    } catch {
      toast.error('Failed to load data')
    }
  }

  function addItem() {
    setItems([...items, { productId: '', productName: '', quantity: '1', unitPrice: '0' }])
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
      if (product) {
        updated[index].unitPrice = product.purchasePrice?.toString() || '0'
        updated[index].productName = product.name
      }
    }
    setItems(updated)
  }

  const totalAmount = items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
  }, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.supplierId) { toast.error('Please select a supplier'); return }
    const validItems = items.filter((i) => i.productId)
    if (validItems.length === 0) { toast.error('Please add at least one product'); return }

    setSubmitting(true)
    try {
      const res = await getApi(subdomain).post('/erp/purchase/orders', {
        ...form,
        items: validItems,
      })
      if (res.data.success) {
        toast.success('Purchase order created!')
        if (form.status === 'RECEIVED') {
          toast.success('Stock updated automatically!')
        }
        setTimeout(() => router.push('/erp/purchase/orders'), 1000)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create order')
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

  const statusOptions = [
    { value: 'PENDING', label: '⏳ Pending', bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
    { value: 'ORDERED', label: '📦 Ordered', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    { value: 'RECEIVED', label: '✓ Received', bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  ]

  return (
    <TenantLayout
      title="New Purchase Order"
      subtitle="Record stock purchased from supplier"
      requiredModule="purchase"
      headerRight={
        <button onClick={() => router.push('/erp/purchase/orders')} style={{
          padding: '8px 16px', background: '#F1F5F9',
          color: '#64748B', border: 'none', borderRadius: '8px',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}>← Back</button>
      }
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', maxWidth: '1100px' }}>

          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Supplier */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                🏭 Supplier
              </h3>
              <select
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                style={inputStyle}
              >
                <option value="">Select Supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.phone ? ` — ${s.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Products */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>📦 Products</h3>
                <button type="button" onClick={addItem} style={{
                  padding: '6px 14px', background: '#EFF6FF',
                  color: '#1D4ED8', border: '1px solid #BFDBFE',
                  borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>+ Add Row</button>
              </div>

              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2.5fr 80px 120px 36px',
                gap: '8px', padding: '8px 4px',
                background: '#F8FAFC', borderRadius: '8px', marginBottom: '8px',
              }}>
                {['Product', 'Qty', 'Purchase Price', ''].map((h) => (
                  <div key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', paddingLeft: '4px' }}>{h}</div>
                ))}
              </div>

              {items.map((item, index) => {
                const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
                return (
                  <div key={index} style={{ marginBottom: '10px' }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '2.5fr 80px 120px 36px',
                      gap: '8px',
                    }}>
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(index, 'productId', e.target.value)}
                        style={{ ...inputStyle, padding: '9px 10px' }}
                      >
                        <option value="">Select Product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku}) — Stock: {parseFloat(p.stock || 0)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number" value={item.quantity} min="1"
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        style={{ ...inputStyle, padding: '9px 10px' }}
                      />
                      <input
                        type="number" value={item.unitPrice} min="0"
                        onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                        style={{ ...inputStyle, padding: '9px 10px' }}
                      />
                      <button
                        type="button" onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                        style={{
                          width: '36px', height: '36px',
                          background: items.length === 1 ? '#F1F5F9' : '#FEF2F2',
                          color: items.length === 1 ? '#CBD5E1' : '#DC2626',
                          border: 'none', borderRadius: '8px',
                          cursor: items.length === 1 ? 'not-allowed' : 'pointer',
                          fontSize: '18px', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >×</button>
                    </div>
                    {item.productId && (
                      <div style={{ textAlign: 'right', fontSize: '12px', color: '#64748B', marginTop: '3px', paddingRight: '44px' }}>
                        Line total: <strong style={{ color: '#0F172A' }}>PKR {lineTotal.toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                )
              })}

              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '12px 14px', background: '#F8FAFC',
                borderRadius: '8px', marginTop: '8px',
                borderTop: '2px dashed #E2E8F0',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Total</span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                  PKR {totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                📝 Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes about this order..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
              />
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Order Summary */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                📋 Order Summary
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Items</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                  {items.filter(i => i.productId).length} products
                </span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '12px 14px', background: '#1E3A5F',
                borderRadius: '10px', marginTop: '8px',
              }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Total Amount</span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>
                  PKR {totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Order Status */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                📌 Order Status
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, status: opt.value })}
                    style={{
                      padding: '12px 16px', textAlign: 'left',
                      background: form.status === opt.value ? opt.bg : '#F8FAFC',
                      color: form.status === opt.value ? opt.color : '#64748B',
                      border: `2px solid ${form.status === opt.value ? opt.border : '#E2E8F0'}`,
                      borderRadius: '10px', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 600,
                      fontFamily: 'Inter, sans-serif',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                    {opt.value === 'RECEIVED' && (
                      <div style={{ fontSize: '11px', fontWeight: 400, marginTop: '2px', opacity: 0.8 }}>
                        Stock will be updated automatically
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '16px',
                background: submitting ? '#94A3B8' : 'linear-gradient(135deg, #1E3A5F, #2E86AB)',
                color: '#fff', border: 'none', borderRadius: '12px',
                fontSize: '15px', fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px',
                boxShadow: submitting ? 'none' : '0 4px 14px rgba(30,58,95,0.3)',
              }}
            >
              {submitting ? (
                <>
                  <span style={{
                    width: '18px', height: '18px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }} />
                  Creating...
                </>
              ) : '🛒 Create Purchase Order'}
            </button>
          </div>
        </div>
      </form>
    </TenantLayout>
  )
}