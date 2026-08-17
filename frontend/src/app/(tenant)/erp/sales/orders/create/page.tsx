'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import { getTenantSlug } from '@/lib/getTenantSlug'

type DiscountType = 'fixed' | 'percent'
type TaxType = 'fixed' | 'percent'

export default function CreateSalesOrderPage() {
  const router = useRouter()
  const [subdomain, setSubdomain] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    customerId: '',
    status: 'PENDING',
    discount: '0',
    discountType: 'fixed' as DiscountType,
    tax: '0',
    taxType: 'percent' as TaxType,
    notes: '',
  })

  const [items, setItems] = useState<any[]>([
    { productId: '', productName: '', quantity: '1', unitPrice: '0', discount: '0' }
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
      const [custRes, prodRes] = await Promise.all([
        getApi(sub).get('/erp/sales/customers'),
        getApi(sub).get('/erp/sales/products'),
      ])
      setCustomers(custRes.data.data)
      setProducts(prodRes.data.data)
    } catch {
      toast.error('Failed to load data')
    }
  }

  function addItem() {
    setItems([...items, { productId: '', productName: '', quantity: '1', unitPrice: '0', discount: '0' }])
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
        updated[index].unitPrice = product.salePrice?.toString() || '0'
        updated[index].productName = product.name
      }
    }
    setItems(updated)
  }

  const itemsSubtotal = items.reduce((sum, item) => {
    const line = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
    const lineDiscount = parseFloat(item.discount) || 0
    return sum + line - lineDiscount
  }, 0)

  const discountValue = form.discountType === 'percent'
    ? (itemsSubtotal * (parseFloat(form.discount) || 0)) / 100
    : parseFloat(form.discount) || 0

  const afterDiscount = itemsSubtotal - discountValue

  const taxValue = form.taxType === 'percent'
    ? (afterDiscount * (parseFloat(form.tax) || 0)) / 100
    : parseFloat(form.tax) || 0

  const totalAmount = afterDiscount + taxValue

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customerId) { toast.error('Please select a customer'); return }
    const validItems = items.filter((i) => i.productId)
    if (validItems.length === 0) { toast.error('Please add at least one product'); return }

    setSubmitting(true)
    try {
      const res = await getApi(subdomain).post('/erp/sales/orders', {
        customerId: form.customerId,
        status: form.status,
        discount: discountValue.toFixed(2),
        tax: taxValue.toFixed(2),
        notes: form.notes,
        items: validItems,
      })
      if (res.data.success) {
        toast.success('Sales order created!')
        if (form.status === 'DELIVERED') toast.success('Stock deducted automatically!')
        setTimeout(() => router.push('/erp/sales/orders'), 1000)
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
    { value: 'PENDING',    label: '⏳ Pending',    bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
    { value: 'CONFIRMED',  label: '✓ Confirmed',   bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    { value: 'PROCESSING', label: '⚙️ Processing', bg: '#FAF5FF', color: '#7C3AED', border: '#E9D5FF' },
    { value: 'DELIVERED',  label: '🚚 Delivered',  bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  ]

  return (
    <TenantLayout
      title="New Sales Order"
      subtitle="Record a customer order"
      requiredModule="sales"
      headerRight={
        <button onClick={() => router.push('/erp/sales/orders')} style={{
          padding: '8px 16px', background: '#F1F5F9',
          color: '#64748B', border: 'none', borderRadius: '8px',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}>← Back</button>
      }
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', maxWidth: '1140px' }}>

          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Customer */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                👤 Customer
              </h3>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                style={inputStyle}
              >
                <option value="">Select Customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.phone ? ` — ${c.phone}` : ''}
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

              <div style={{
                display: 'grid', gridTemplateColumns: '2.5fr 70px 110px 90px 36px',
                gap: '8px', padding: '8px 4px',
                background: '#F8FAFC', borderRadius: '8px', marginBottom: '8px',
              }}>
                {['Product', 'Qty', 'Sale Price', 'Discount', ''].map((h) => (
                  <div key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', paddingLeft: '4px' }}>{h}</div>
                ))}
              </div>

              {items.map((item, index) => {
                const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0) - (parseFloat(item.discount) || 0)
                const product = products.find((p) => p.id === item.productId)
                return (
                  <div key={index} style={{ marginBottom: '10px' }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '2.5fr 70px 110px 90px 36px',
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
                      <input
                        type="number" value={item.discount} min="0"
                        onChange={(e) => updateItem(index, 'discount', e.target.value)}
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginTop: '3px', paddingRight: '44px' }}>
                        {product && (
                          <span style={{ color: parseFloat(item.quantity) > parseFloat(product.stock || 0) ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
                            {parseFloat(item.quantity) > parseFloat(product.stock || 0) ? '⚠️ Insufficient stock!' : `✓ Available: ${parseFloat(product.stock || 0)}`}
                          </span>
                        )}
                        <span>Line total: <strong style={{ color: '#0F172A' }}>PKR {lineTotal.toLocaleString()}</strong></span>
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
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Items Subtotal</span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                  PKR {itemsSubtotal.toLocaleString()}
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
                placeholder="Optional notes..."
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
              />
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Discount & Tax */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
                🧮 Discount & Tax
              </h3>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Discount</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="number" value={form.discount} min="0"
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    style={{ ...inputStyle, flex: 1 }} placeholder="0"
                  />
                  <div style={{ display: 'flex', border: '1.5px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                    {(['fixed', 'percent'] as DiscountType[]).map((t) => (
                      <button key={t} type="button"
                        onClick={() => setForm({ ...form, discountType: t })}
                        style={{
                          padding: '0 12px', border: 'none',
                          background: form.discountType === t ? '#1E3A5F' : '#F8FAFC',
                          color: form.discountType === t ? '#fff' : '#64748B',
                          fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >{t === 'fixed' ? 'PKR' : '%'}</button>
                    ))}
                  </div>
                </div>
                {discountValue > 0 && <p style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px' }}>= PKR {discountValue.toLocaleString()} off</p>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Tax</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="number" value={form.tax} min="0"
                    onChange={(e) => setForm({ ...form, tax: e.target.value })}
                    style={{ ...inputStyle, flex: 1 }} placeholder="0"
                  />
                  <div style={{ display: 'flex', border: '1.5px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                    {(['fixed', 'percent'] as TaxType[]).map((t) => (
                      <button key={t} type="button"
                        onClick={() => setForm({ ...form, taxType: t })}
                        style={{
                          padding: '0 12px', border: 'none',
                          background: form.taxType === t ? '#1E3A5F' : '#F8FAFC',
                          color: form.taxType === t ? '#fff' : '#64748B',
                          fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >{t === 'fixed' ? 'PKR' : '%'}</button>
                    ))}
                  </div>
                </div>
                {taxValue > 0 && <p style={{ fontSize: '11px', color: '#EA580C', marginTop: '4px' }}>= PKR {taxValue.toLocaleString()} tax</p>}
              </div>
            </div>

            {/* Summary */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>📋 Summary</h3>
              {[
                { label: 'Subtotal', value: itemsSubtotal, color: '#374151' },
                { label: `Discount${form.discountType === 'percent' ? ` (${form.discount}%)` : ''}`, value: discountValue, neg: true, color: '#16A34A' },
                { label: `Tax${form.taxType === 'percent' ? ` (${form.tax}%)` : ''}`, value: taxValue, color: '#EA580C' },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>{row.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: row.color }}>
                    {(row as any).neg ? '− ' : ''}PKR {row.value.toLocaleString()}
                  </span>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '12px 14px', background: '#1E3A5F',
                borderRadius: '10px', marginTop: '8px',
              }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Total</span>
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
                    key={opt.value} type="button"
                    onClick={() => setForm({ ...form, status: opt.value })}
                    style={{
                      padding: '10px 14px', textAlign: 'left',
                      background: form.status === opt.value ? opt.bg : '#F8FAFC',
                      color: form.status === opt.value ? opt.color : '#64748B',
                      border: `2px solid ${form.status === opt.value ? opt.border : '#E2E8F0'}`,
                      borderRadius: '10px', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 600,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {opt.label}
                    {opt.value === 'DELIVERED' && (
                      <div style={{ fontSize: '11px', fontWeight: 400, marginTop: '2px', opacity: 0.8 }}>
                        Stock will be deducted automatically
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={submitting}
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
              ) : '💰 Create Sales Order'}
            </button>
          </div>
        </div>
      </form>
    </TenantLayout>
  )
}