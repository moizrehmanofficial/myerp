'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import { getTenantSlug } from '@/lib/getTenantSlug'

type DiscountType = 'fixed' | 'percent'
type TaxType = 'fixed' | 'percent'
type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID'

export default function CreateInvoicePage() {
  const router = useRouter()
  const [subdomain, setSubdomain] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    customerId: '',
    discount: '0',
    discountType: 'fixed' as DiscountType,
    tax: '0',
    taxType: 'percent' as TaxType,
    paidAmount: '0',
    paymentStatus: 'UNPAID' as PaymentStatus,
    dueDate: '',
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
        getApi(sub).get('/erp/invoices/customers'),
        getApi(sub).get('/erp/invoices/products'),
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

  // ── Calculations ──────────────────────────────────────
  const itemsSubtotal = items.reduce((sum, item) => {
    const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
    const lineDiscount = parseFloat(item.discount) || 0
    return sum + lineTotal - lineDiscount
  }, 0)

  const discountValue = form.discountType === 'percent'
    ? (itemsSubtotal * (parseFloat(form.discount) || 0)) / 100
    : parseFloat(form.discount) || 0

  const afterDiscount = itemsSubtotal - discountValue

  const taxValue = form.taxType === 'percent'
    ? (afterDiscount * (parseFloat(form.tax) || 0)) / 100
    : parseFloat(form.tax) || 0

  const totalAmount = afterDiscount + taxValue
  const paidAmount = parseFloat(form.paidAmount) || 0
  const dueAmount = totalAmount - paidAmount

  // Auto-set payment status based on amounts
  function getAutoPaymentStatus(): PaymentStatus {
    if (paidAmount <= 0) return 'UNPAID'
    if (paidAmount >= totalAmount) return 'PAID'
    return 'PARTIAL'
  }

  function handlePaymentStatusClick(status: PaymentStatus) {
    setForm((prev) => {
      const newForm = { ...prev, paymentStatus: status }
      if (status === 'PAID') newForm.paidAmount = totalAmount.toFixed(0)
      if (status === 'UNPAID') newForm.paidAmount = '0'
      return newForm
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customerId) { toast.error('Please select a customer'); return }
    const validItems = items.filter((i) => i.productId)
    if (validItems.length === 0) { toast.error('Please add at least one product'); return }

    setSubmitting(true)
    try {
      const res = await getApi(subdomain).post('/erp/invoices', {
        customerId: form.customerId,
        discount: discountValue.toFixed(2),
        tax: taxValue.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        dueDate: form.dueDate || null,
        notes: form.notes,
        items: validItems,
      })
      if (res.data.success) {
        toast.success('Invoice created successfully!')
        setTimeout(() => router.push('/erp/invoices'), 1000)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create invoice')
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

  const autoStatus = getAutoPaymentStatus()

  return (
    <TenantLayout
      title="Create Invoice"
      subtitle="Generate a new invoice"
      requiredModule="invoices"
      headerRight={
        <button onClick={() => router.push('/erp/invoices')} style={{
          padding: '8px 16px', background: '#F1F5F9',
          color: '#64748B', border: 'none', borderRadius: '8px',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}>← Back</button>
      }
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', maxWidth: '1140px' }}>

          {/* ── LEFT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Customer */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                👤 Bill To
              </h3>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                style={{ ...inputStyle }}
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
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📦 Products
                </h3>
                <button type="button" onClick={addItem} style={{
                  padding: '6px 14px', background: '#EFF6FF',
                  color: '#1D4ED8', border: '1px solid #BFDBFE',
                  borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>+ Add Row</button>
              </div>

              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2.5fr 70px 110px 100px 36px',
                gap: '8px', padding: '8px 4px',
                background: '#F8FAFC', borderRadius: '8px', marginBottom: '8px',
              }}>
                {['Product', 'Qty', 'Unit Price', 'Discount', ''].map((h) => (
                  <div key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', paddingLeft: '4px' }}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {items.map((item, index) => {
                const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0) - (parseFloat(item.discount) || 0)
                return (
                  <div key={index} style={{ marginBottom: '10px' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '2.5fr 70px 110px 100px 36px',
                      gap: '8px', marginBottom: '4px',
                    }}>
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(index, 'productId', e.target.value)}
                        style={{ ...inputStyle, padding: '9px 10px' }}
                      >
                        <option value="">Select Product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
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
                    {/* Line Total */}
                    {item.productId && (
                      <div style={{ textAlign: 'right', fontSize: '12px', color: '#64748B', paddingRight: '44px' }}>
                        Line total: <strong style={{ color: '#0F172A' }}>PKR {lineTotal.toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Subtotal */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '12px 14px', background: '#F8FAFC',
                borderRadius: '8px', marginTop: '8px',
                borderTop: '2px dashed #E2E8F0',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Items Subtotal</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                  PKR {itemsSubtotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Notes + Due Date */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    📅 Due Date
                  </label>
                  <input
                    type="date" value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    📝 Notes
                  </label>
                  <input
                    type="text" value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optional notes..."
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Discount & Tax */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
                🧮 Discount & Tax
              </h3>

              {/* Discount */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Discount
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number" value={form.discount} min="0"
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="0"
                  />
                  <div style={{ display: 'flex', border: '1.5px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                    {(['fixed', 'percent'] as DiscountType[]).map((t) => (
                      <button
                        key={t} type="button"
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
                {discountValue > 0 && (
                  <p style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px' }}>
                    = PKR {discountValue.toLocaleString()} off
                  </p>
                )}
              </div>

              {/* Tax */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Tax
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number" value={form.tax} min="0"
                    onChange={(e) => setForm({ ...form, tax: e.target.value })}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="0"
                  />
                  <div style={{ display: 'flex', border: '1.5px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                    {(['fixed', 'percent'] as TaxType[]).map((t) => (
                      <button
                        key={t} type="button"
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
                {taxValue > 0 && (
                  <p style={{ fontSize: '11px', color: '#EA580C', marginTop: '4px' }}>
                    = PKR {taxValue.toLocaleString()} tax
                  </p>
                )}
              </div>
            </div>

            {/* Totals Summary */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                📋 Summary
              </h3>

              {[
                { label: 'Subtotal', value: itemsSubtotal, color: '#374151' },
                { label: `Discount${form.discountType === 'percent' ? ` (${form.discount}%)` : ''}`, value: discountValue, neg: true, color: '#16A34A' },
                { label: `Tax${form.taxType === 'percent' ? ` (${form.tax}%)` : ''}`, value: taxValue, color: '#EA580C' },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>{row.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: row.color }}>
                    {row.neg ? '− ' : ''}PKR {row.value.toLocaleString()}
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

            {/* Payment Status */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                💳 Payment
              </h3>

              {/* Status Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {[
                  { status: 'UNPAID' as PaymentStatus, label: '✗ Unpaid', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
                  { status: 'PARTIAL' as PaymentStatus, label: '◐ Partial', bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
                  { status: 'PAID' as PaymentStatus, label: '✓ Paid', bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
                ].map((btn) => {
                  const isActive = form.paymentStatus === btn.status || autoStatus === btn.status
                  const selected = form.paymentStatus === btn.status
                  return (
                    <button
                      key={btn.status}
                      type="button"
                      onClick={() => handlePaymentStatusClick(btn.status)}
                      style={{
                        padding: '10px 6px',
                        background: selected ? btn.bg : '#F8FAFC',
                        color: selected ? btn.color : '#94A3B8',
                        border: `2px solid ${selected ? btn.border : '#E2E8F0'}`,
                        borderRadius: '8px',
                        fontSize: '12px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                        transition: 'all 0.15s',
                      }}
                    >{btn.label}</button>
                  )
                })}
              </div>

              {/* Amount Received */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                    Amount Received (PKR)
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paidAmount: totalAmount.toFixed(0), paymentStatus: 'PAID' })}
                    style={{
                      fontSize: '11px', color: '#16A34A', fontWeight: 600,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >Fill Full Amount</button>
                </div>
                <input
                  type="number"
                  value={form.paidAmount}
                  onChange={(e) => {
                    const val = e.target.value
                    const paid = parseFloat(val) || 0
                    let status: PaymentStatus = 'UNPAID'
                    if (paid >= totalAmount && totalAmount > 0) status = 'PAID'
                    else if (paid > 0) status = 'PARTIAL'
                    setForm({ ...form, paidAmount: val, paymentStatus: status })
                  }}
                  min="0"
                  max={totalAmount}
                  style={inputStyle}
                  placeholder="0"
                />
              </div>

              {/* Due Amount Display */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: '12px', padding: '12px 14px',
                background: dueAmount <= 0 ? '#F0FDF4' : '#FEF2F2',
                borderRadius: '10px',
              }}>
                <span style={{
                  fontSize: '13px', fontWeight: 700,
                  color: dueAmount <= 0 ? '#16A34A' : '#DC2626',
                }}>
                  {dueAmount <= 0 ? '✓ Fully Paid' : 'Balance Due'}
                </span>
                <span style={{
                  fontSize: '16px', fontWeight: 900,
                  color: dueAmount <= 0 ? '#16A34A' : '#DC2626',
                }}>
                  PKR {Math.max(0, dueAmount).toLocaleString()}
                </span>
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
                  Creating Invoice...
                </>
              ) : '🧾 Create Invoice'}
            </button>
          </div>
        </div>
      </form>
    </TenantLayout>
  )
}