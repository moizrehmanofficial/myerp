"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import { getTenantSlug } from '@/lib/getTenantSlug'

export default function InvoiceEditClient({ id }: { id: string }) {
  const router = useRouter()
  const [subdomain, setSubdomain] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    customerId: '',
    discount: '0',
    tax: '0',
    paidAmount: '0',
    dueDate: '',
    notes: '',
  })

  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchData(sub)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function getApi(sub: string) {
    return {
      get: (url: string) => axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${url}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      ),
      put: (url: string, data: any) => axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}${url}`, data,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      ),
    }
  }

  async function fetchData(sub: string) {
    try {
      const [invRes, custRes, prodRes] = await Promise.all([
        getApi(sub).get(`/erp/invoices/${id}`),
        getApi(sub).get('/erp/invoices/customers'),
        getApi(sub).get('/erp/invoices/products'),
      ])

      const inv = invRes.data.data
      setCustomers(custRes.data.data)
      setProducts(prodRes.data.data)

      setForm({
        customerId: inv.customerId || '',
        discount: (inv.discount || 0).toString(),
        tax: (inv.tax || 0).toString(),
        paidAmount: (inv.paidAmount || 0).toString(),
        dueDate: inv.dueDate ? inv.dueDate.split('T')[0] : '',
        notes: inv.notes || '',
      })

      setItems((inv.items || []).map((it: any) => ({
        productId: it.productId,
        productName: it.productName || '',
        quantity: (it.quantity || 1).toString(),
        unitPrice: (it.unitPrice || 0).toString(),
        discount: (it.discount || 0).toString(),
      })))

    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load invoice')
    } finally {
      setLoading(false)
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

  const subtotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
  }, 0)

  const discount = parseFloat(form.discount) || 0
  const tax = parseFloat(form.tax) || 0
  const totalAmount = subtotal - discount + tax
  const paidAmount = parseFloat(form.paidAmount) || 0
  const dueAmount = totalAmount - paidAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.customerId) {
      toast.error('Please select a customer')
      return
    }

    const validItems = items.filter((i) => i.productId)
    if (validItems.length === 0) {
      toast.error('Please add at least one product')
      return
    }

    setSubmitting(true)
    try {
      const res = await getApi(subdomain).put(`/erp/invoices/${id}`, {
        ...form,
        items: validItems,
      })
      if (res.data.success) {
        toast.success('Invoice updated successfully')
        setTimeout(() => router.push(`/erp/invoices/${id}`), 800)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update invoice')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #E2E8F0', borderRadius: '8px',
    fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, sans-serif', background: '#fff',
  }

  return (
    <TenantLayout
      title="Edit Invoice"
      subtitle="Modify invoice details"
      requiredModule="invoices"
      headerRight={<button onClick={() => router.push(`/erp/invoices/${id}`)} style={{ padding: '8px 16px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px' }}>← Back</button>}
    >
      {loading ? <div>Loading...</div> : (
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', maxWidth: '1100px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>👤 Customer</h3>
                <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} style={{ ...inputStyle }}>
                  <option value="">Select Customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} {c.phone ? `— ${c.phone}` : ''}</option>
                  ))}
                </select>
              </div>

              <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>📦 Products</h3>
                  <button type="button" onClick={addItem} style={{ padding: '6px 14px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>+ Add Row</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 100px 36px', gap: '8px', marginBottom: '8px', padding: '0 4px' }}>
                  {['Product', 'Qty', 'Price', 'Discount', ''].map((h) => (
                    <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>

                {items.map((item, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 100px 36px', gap: '8px', marginBottom: '8px' }}>
                    <select value={item.productId} onChange={(e) => updateItem(index, 'productId', e.target.value)} style={{ ...inputStyle, padding: '9px 10px' }}>
                      <option value="">Select Product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                    <input type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} min="1" style={{ ...inputStyle, padding: '9px 10px' }} />
                    <input type="number" value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} min="0" style={{ ...inputStyle, padding: '9px 10px' }} />
                    <input type="number" value={item.discount} onChange={(e) => updateItem(index, 'discount', e.target.value)} min="0" style={{ ...inputStyle, padding: '9px 10px' }} />
                    <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1} style={{ width: '36px', height: '36px', background: items.length === 1 ? '#F1F5F9' : '#FEF2F2', color: items.length === 1 ? '#CBD5E1' : '#DC2626', border: 'none', borderRadius: '8px', cursor: items.length === 1 ? 'not-allowed' : 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ))}

                <div style={{ marginTop: '12px', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Subtotal</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>PKR {subtotal.toLocaleString()}</span>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '12px' }}>📝 Notes</h3>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>🧮 Summary</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Discount (PKR)</label>
                    <input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} min="0" style={inputStyle} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Tax (PKR)</label>
                    <input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} min="0" style={inputStyle} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Due Date</label>
                    <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={inputStyle} />
                  </div>

                  <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: '12px' }}>
                    {[{ label: 'Subtotal', value: subtotal, color: '#374151' }, { label: 'Discount', value: -discount, color: '#16A34A' }, { label: 'Tax', value: tax, color: '#EA580C' }].map((row) => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>{row.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: row.color }}>PKR {Math.abs(row.value).toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#1E3A5F', borderRadius: '8px', marginTop: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Total</span>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>PKR {totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>💳 Payment</h3>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Amount Received (PKR)</label>
                  <input type="number" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} min="0" style={inputStyle} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', padding: '10px 12px', background: dueAmount <= 0 ? '#F0FDF4' : '#FEF2F2', borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: dueAmount <= 0 ? '#16A34A' : '#DC2626' }}>{dueAmount <= 0 ? '✓ Fully Paid' : 'Due Amount'}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: dueAmount <= 0 ? '#16A34A' : '#DC2626' }}>PKR {Math.max(0, dueAmount).toLocaleString()}</span>
                </div>
              </div>

              <button type="submit" disabled={submitting} style={{ width: '100%', padding: '14px', background: submitting ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {submitting ? (<><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />Saving...</>) : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </form>
      )}
    </TenantLayout>
  )
}
