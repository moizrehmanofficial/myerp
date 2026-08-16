'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'

export default function StockAdjustmentPage() {
  const [products, setProducts] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'adjust' | 'history'>('adjust')

  const [form, setForm] = useState({
    quantity: '',
    type: 'ADD',
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

  async function fetchData(sub: string) {
    setLoading(true)
    try {
      const [prodRes, txRes] = await Promise.all([
        getApi(sub).get('/erp/inventory/overview'),
        getApi(sub).get('/erp/inventory/transactions?limit=100'),
      ])
      setProducts(prodRes.data.data.products || [])
      setTransactions(txRes.data.data || [])
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function openAdjust(product: any) {
    setSelectedProduct(product)
    setForm({ quantity: '', type: 'ADD', notes: '' })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.quantity || parseFloat(form.quantity) <= 0) {
      toast.error('Enter a valid quantity')
      return
    }
    setSubmitting(true)
    try {
      await getApi(subdomain).post('/erp/inventory/adjust', {
        productId: selectedProduct.id,
        quantity: form.quantity,
        type: form.type,
        notes: form.notes,
      })
      toast.success('Stock adjusted successfully!')
      setShowModal(false)
      fetchData(subdomain)
    } catch {
      toast.error('Failed to adjust stock')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredProducts = products.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  )

  function getStockStatus(p: any) {
    const stock = parseFloat(p.stock || 0)
    const min = parseFloat(p.minStock || 0)
    if (stock === 0) return { label: 'Out of Stock', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }
    if (stock <= min) return { label: 'Low Stock', color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' }
    return { label: 'In Stock', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' }
  }

  function getTxStyle(type: string) {
    const isIn = type === 'IN' || type === 'ADJUSTMENT_IN'
    return {
      color: isIn ? '#16A34A' : '#DC2626',
      bg: isIn ? '#F0FDF4' : '#FEF2F2',
      label: isIn ? '↑ IN' : '↓ OUT',
      sign: isIn ? '+' : '-',
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #E2E8F0', borderRadius: '8px',
    fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, sans-serif', background: '#fff',
    boxSizing: 'border-box',
  }

  return (
    <TenantLayout
      title="Stock Adjustment"
      subtitle="Manually adjust product stock levels"
      requiredModule="stock_adjust"
    >
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F1F5F9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {[
          { key: 'adjust', label: '⚖️ Adjust Stock' },
          { key: 'history', label: '📋 Adjustment History' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '8px 20px', borderRadius: '8px', border: 'none',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#0F172A' : '#64748B',
              fontSize: '13px', fontWeight: activeTab === tab.key ? 700 : 500,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >{tab.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Adjust Stock Tab */}
          {activeTab === 'adjust' && (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name or SKU..."
                style={{
                  width: '360px', padding: '10px 16px',
                  border: '1.5px solid #E2E8F0', borderRadius: '10px',
                  fontSize: '14px', outline: 'none',
                  fontFamily: 'Inter, sans-serif', marginBottom: '16px',
                  display: 'block',
                }}
              />

              {filteredProducts.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📦</div>
                  <p style={{ color: '#94A3B8', fontSize: '14px' }}>No products found. Add products first.</p>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        {['Product', 'SKU', 'Current Stock', 'Min Stock', 'Status', 'Action'].map((h) => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p: any, i: number) => {
                        const status = getStockStatus(p)
                        return (
                          <tr
                            key={p.id}
                            style={{ borderBottom: i < filteredProducts.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FAF5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>📦</div>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{p.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#7C3AED', background: '#FAF5FF', padding: '2px 8px', borderRadius: '6px' }}>{p.sku}</span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{ fontSize: '16px', fontWeight: 800, color: parseFloat(p.stock) === 0 ? '#DC2626' : '#0F172A' }}>
                                {parseFloat(p.stock || 0).toLocaleString()}
                              </span>
                              <span style={{ fontSize: '12px', color: '#94A3B8', marginLeft: '4px' }}>{p.unit}</span>
                            </td>
                            <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>
                              {parseFloat(p.minStock || 0).toLocaleString()} {p.unit}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
                                {status.label}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <button
                                onClick={() => openAdjust(p)}
                                style={{
                                  padding: '7px 16px', background: '#EFF6FF',
                                  color: '#1D4ED8', border: '1px solid #BFDBFE',
                                  borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                                }}
                              >⚖️ Adjust</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <>
              {/* Filter to show only manual adjustments */}
              {(() => {
                const adjustments = transactions.filter((tx: any) =>
                  tx.type === 'ADJUSTMENT_IN' || tx.type === 'ADJUSTMENT_OUT'
                )
                return adjustments.length === 0 ? (
                  <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                    <p style={{ color: '#94A3B8', fontSize: '14px' }}>No stock adjustments yet</p>
                  </div>
                ) : (
                  <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                          {['Date & Time', 'Product', 'SKU', 'Type', 'Quantity', 'Reason'].map((h) => (
                            <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {adjustments.map((tx: any, i: number) => {
                          const ts = getTxStyle(tx.type)
                          return (
                            <tr
                              key={tx.id}
                              style={{ borderBottom: i < adjustments.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{ padding: '14px 16px' }}>
                                <div style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>
                                  {new Date(tx.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </div>
                                <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                                  {new Date(tx.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                              <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                                {tx.productName || '—'}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#7C3AED', background: '#FAF5FF', padding: '2px 8px', borderRadius: '6px' }}>
                                  {tx.productSku || '—'}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, background: ts.bg, color: ts.color }}>
                                  {ts.label}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{ fontSize: '16px', fontWeight: 800, color: ts.color }}>
                                  {ts.sign}{parseFloat(tx.quantity).toLocaleString()}
                                </span>
                                <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '4px' }}>
                                  {tx.productUnit || 'pcs'}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>
                                {tx.notes || '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </>
          )}
        </>
      )}

      {/* Adjust Modal */}
      {showModal && selectedProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
              ⚖️ Adjust Stock
            </h3>
            <div style={{ marginBottom: '20px', padding: '12px 14px', background: '#F8FAFC', borderRadius: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>{selectedProduct.name}</div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  SKU: <strong style={{ color: '#7C3AED' }}>{selectedProduct.sku}</strong>
                </span>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Current Stock: <strong style={{ color: '#0F172A' }}>{parseFloat(selectedProduct.stock || 0).toLocaleString()} {selectedProduct.unit}</strong>
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Adjustment Type */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                  Adjustment Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { value: 'ADD', label: '➕ Add Stock', bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
                    { value: 'SUBTRACT', label: '➖ Remove Stock', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, type: opt.value })}
                      style={{
                        padding: '12px', border: `2px solid ${form.type === opt.value ? opt.border : '#E2E8F0'}`,
                        borderRadius: '10px',
                        background: form.type === opt.value ? opt.bg : '#F8FAFC',
                        color: form.type === opt.value ? opt.color : '#64748B',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                  Quantity ({selectedProduct.unit})
                </label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  min="0.01" step="0.01"
                  placeholder="Enter quantity"
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                  onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  autoFocus
                />
                {form.quantity && parseFloat(form.quantity) > 0 && (
                  <p style={{ fontSize: '12px', marginTop: '4px', fontWeight: 600, color: form.type === 'ADD' ? '#16A34A' : '#DC2626' }}>
                    New stock will be: {
                      form.type === 'ADD'
                        ? parseFloat(selectedProduct.stock || 0) + parseFloat(form.quantity)
                        : Math.max(0, parseFloat(selectedProduct.stock || 0) - parseFloat(form.quantity))
                    } {selectedProduct.unit}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                  Reason <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Damaged goods, Stock count correction..."
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                  onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                >Cancel</button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1, padding: '12px',
                    background: submitting ? '#94A3B8' : form.type === 'ADD' ? '#16A34A' : '#DC2626',
                    color: '#fff', border: 'none', borderRadius: '10px',
                    fontSize: '14px', fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {submitting ? 'Adjusting...' : `✓ Confirm ${form.type === 'ADD' ? 'Addition' : 'Removal'}`}
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