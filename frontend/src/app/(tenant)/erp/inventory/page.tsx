'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { getTenantSlug } from '@/lib/getTenantSlug'

export default function InventoryPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [activeTab, setActiveTab] = useState<'stock' | 'transactions'>('stock')
  const [transactions, setTransactions] = useState<any[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [adjustForm, setAdjustForm] = useState({
    quantity: '1',
    type: 'ADD',
    notes: '',
  })
  const [adjusting, setAdjusting] = useState(false)

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchOverview(sub)
    fetchTransactions(sub)
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

  async function fetchOverview(sub: string) {
    try {
      const res = await getApi(sub).get('/erp/inventory/overview')
      setData(res.data.data)
    } catch {
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  async function fetchTransactions(sub: string) {
    setTxLoading(true)
    try {
      const res = await getApi(sub).get('/erp/inventory/transactions?limit=50')
      setTransactions(res.data.data)
    } catch {
      toast.error('Failed to load transactions')
    } finally {
      setTxLoading(false)
    }
  }

  function openAdjust(product: any) {
    setSelectedProduct(product)
    setAdjustForm({ quantity: '1', type: 'ADD', notes: '' })
    setShowAdjustModal(true)
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!adjustForm.quantity || parseFloat(adjustForm.quantity) <= 0) {
      toast.error('Enter valid quantity')
      return
    }
    setAdjusting(true)
    try {
      await getApi(subdomain).post('/erp/inventory/adjust', {
        productId: selectedProduct.id,
        quantity: adjustForm.quantity,
        type: adjustForm.type,
        notes: adjustForm.notes,
      })
      toast.success('Stock adjusted successfully!')
      setShowAdjustModal(false)
      fetchOverview(subdomain)
      fetchTransactions(subdomain)
    } catch {
      toast.error('Failed to adjust stock')
    } finally {
      setAdjusting(false)
    }
  }

  const filteredProducts = data?.products?.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  ) || []

  function getStockStatus(product: any) {
    const stock = parseFloat(product.stock || 0)
    const minStock = parseFloat(product.minStock || 0)
    if (stock === 0) return { label: 'Out of Stock', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }
    if (stock <= minStock) return { label: 'Low Stock', color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' }
    return { label: 'In Stock', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' }
  }

  function getTxTypeStyle(type: string) {
    if (type === 'IN' || type === 'ADJUSTMENT_IN') return { color: '#16A34A', bg: '#F0FDF4', label: '↑ IN' }
    return { color: '#DC2626', bg: '#FEF2F2', label: '↓ OUT' }
  }

  return (
    <TenantLayout
      title="Inventory"
      subtitle="Track stock levels and movements"
      requiredModule="inventory"
      headerRight={
        <ExportButton
          data={data?.products || []}
          filename={`inventory-${subdomain}`}
          title="Inventory Report"
          subtitle={`${subdomain} ERP • ${new Date().toLocaleDateString()}`}
          columns={[
            { header: 'Product', value: (r) => r.name, width: 28 },
            { header: 'SKU', value: (r) => r.sku || '', width: 15 },
            { header: 'Category', value: (r) => r.categoryName || '', width: 18 },
            { header: 'Stock', value: (r) => parseFloat(r.stock || 0).toFixed(2), width: 12 },
            { header: 'Unit', value: (r) => r.unit || '', width: 10 },
            { header: 'Min Stock', value: (r) => parseFloat(r.minStock || 0).toFixed(2), width: 12 },
            { header: 'Cost Value (PKR)', value: (r) => (parseFloat(r.stock || 0) * parseFloat(r.purchasePrice || 0)).toFixed(2), width: 18 },
          ]}
          disabled={!data}
        />
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F',
            borderRadius: '50%', animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      ) : (
        <>
          {/* Stats Row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px', marginBottom: '24px',
          }}>
            {[
              {
                label: 'Total Products',
                value: parseInt(data?.stats?.totalProducts || 0).toLocaleString(),
                icon: '📦', bg: '#EFF6FF', color: '#1D4ED8',
              },
              {
                label: 'Total Stock Units',
                value: parseFloat(data?.stats?.totalStock || 0).toLocaleString(),
                icon: '🏪', bg: '#F0FDF4', color: '#16A34A',
              },
              {
                label: 'Stock Value',
                value: `PKR ${parseFloat(data?.stats?.stockValue || 0).toLocaleString()}`,
                icon: '💰', bg: '#FFF7ED', color: '#EA580C',
              },
              {
                label: 'Low Stock Items',
                value: parseInt(data?.stats?.lowStockCount || 0).toLocaleString(),
                icon: '⚠️', bg: '#FEF2F2', color: '#DC2626',
              },
            ].map((s) => (
              <div key={s.label} style={{
                background: '#fff', borderRadius: '14px',
                padding: '18px 20px', border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{
                    width: '38px', height: '38px', background: s.bg,
                    borderRadius: '10px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                  }}>{s.icon}</div>
                </div>
                <p style={{ fontSize: '20px', fontWeight: 800, color: s.color, marginBottom: '4px' }}>{s.value}</p>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F1F5F9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
            {[
              { key: 'stock', label: '📦 Stock Levels' },
              { key: 'transactions', label: '📋 Transactions' },
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

          {/* Stock Levels Tab */}
          {activeTab === 'stock' && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products..."
                  style={{
                    width: '320px', padding: '10px 16px',
                    border: '1.5px solid #E2E8F0', borderRadius: '10px',
                    fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
                  }}
                />
              </div>

              {filteredProducts.length === 0 ? (
                <div style={{
                  background: '#fff', borderRadius: '16px',
                  border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>No products found</h3>
                  <p style={{ fontSize: '14px', color: '#94A3B8' }}>Add products first to track inventory</p>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        {['Product', 'SKU', 'Category', 'Current Stock', 'Min Stock', 'Stock Value', 'Status', 'Action'].map((h) => (
                          <th key={h} style={{
                            padding: '12px 16px', textAlign: 'left',
                            fontSize: '12px', fontWeight: 600,
                            color: '#64748B', textTransform: 'uppercase',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product: any, i: number) => {
                        const status = getStockStatus(product)
                        const stockValue = parseFloat(product.stock || 0) * parseFloat(product.purchasePrice || 0)
                        return (
                          <tr key={product.id} style={{
                            borderBottom: i < filteredProducts.length - 1 ? '1px solid #F1F5F9' : 'none',
                          }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '36px', height: '36px', borderRadius: '10px',
                                  background: '#FAF5FF', display: 'flex',
                                  alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                                }}>📦</div>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{product.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                fontSize: '12px', color: '#7C3AED',
                                fontFamily: 'monospace', background: '#FAF5FF',
                                padding: '2px 8px', borderRadius: '6px',
                              }}>{product.sku}</span>
                            </td>
                            <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>
                              {product.categoryName || '—'}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                fontSize: '16px', fontWeight: 800,
                                color: parseFloat(product.stock) === 0 ? '#DC2626' : '#0F172A',
                              }}>
                                {parseFloat(product.stock || 0).toLocaleString()}
                              </span>
                              <span style={{ fontSize: '12px', color: '#94A3B8', marginLeft: '4px' }}>
                                {product.unit}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>
                              {parseFloat(product.minStock || 0).toLocaleString()} {product.unit}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                                PKR {stockValue.toLocaleString()}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                padding: '4px 10px', borderRadius: '99px',
                                fontSize: '11px', fontWeight: 600,
                                background: status.bg, color: status.color,
                                border: `1px solid ${status.border}`,
                              }}>{status.label}</span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <button
                                onClick={() => openAdjust(product)}
                                style={{
                                  padding: '6px 12px', background: '#EFF6FF',
                                  color: '#1D4ED8', border: '1px solid #BFDBFE',
                                  borderRadius: '8px', fontSize: '12px',
                                  fontWeight: 600, cursor: 'pointer',
                                  fontFamily: 'Inter, sans-serif',
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

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <>
              {txLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                  <div style={{
                    width: '36px', height: '36px',
                    border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F',
                    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                  }} />
                </div>
              ) : transactions.length === 0 ? (
                <div style={{
                  background: '#fff', borderRadius: '16px',
                  border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>No transactions yet</h3>
                  <p style={{ fontSize: '14px', color: '#94A3B8' }}>Transactions will appear when you receive or sell stock</p>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        {['Date', 'Product', 'SKU', 'Type', 'Quantity', 'Reference'].map((h) => (
                          <th key={h} style={{
                            padding: '12px 16px', textAlign: 'left',
                            fontSize: '12px', fontWeight: 600,
                            color: '#64748B', textTransform: 'uppercase',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx: any, i: number) => {
                        const ts = getTxTypeStyle(tx.type)
                        return (
                          <tr key={tx.id} style={{
                            borderBottom: i < transactions.length - 1 ? '1px solid #F1F5F9' : 'none',
                          }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>
                              {new Date(tx.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric', month: 'short', day: 'numeric',
                              })}
                              <div style={{ fontSize: '11px', color: '#CBD5E1' }}>
                                {new Date(tx.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                              {tx.productName || '—'}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                fontSize: '12px', color: '#7C3AED',
                                fontFamily: 'monospace', background: '#FAF5FF',
                                padding: '2px 8px', borderRadius: '6px',
                              }}>{tx.productSku || '—'}</span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                padding: '4px 10px', borderRadius: '99px',
                                fontSize: '11px', fontWeight: 700,
                                background: ts.bg, color: ts.color,
                              }}>{ts.label}</span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                fontSize: '15px', fontWeight: 800,
                                color: tx.type === 'IN' || tx.type === 'ADJUSTMENT_IN' ? '#16A34A' : '#DC2626',
                              }}>
                                {tx.type === 'IN' || tx.type === 'ADJUSTMENT_IN' ? '+' : '-'}
                                {parseFloat(tx.quantity).toLocaleString()}
                              </span>
                              <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '4px' }}>
                                {tx.productUnit || 'pcs'}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                fontSize: '12px', color: '#64748B',
                                background: '#F8FAFC', padding: '3px 8px',
                                borderRadius: '6px', fontFamily: 'monospace',
                              }}>{tx.reference || '—'}</span>
                              {tx.notes && (
                                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{tx.notes}</div>
                              )}
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
        </>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedProduct && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200,
        }}>
          <div style={{
            background: '#fff', borderRadius: '20px', padding: '32px',
            width: '100%', maxWidth: '440px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
              ⚖️ Adjust Stock
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>
              {selectedProduct.name} — Current: <strong style={{ color: '#0F172A' }}>
                {parseFloat(selectedProduct.stock || 0).toLocaleString()} {selectedProduct.unit}
              </strong>
            </p>

            <form onSubmit={handleAdjust}>
              {/* Type */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                  Adjustment Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { value: 'ADD', label: '➕ Add Stock', bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
                    { value: 'SUBTRACT', label: '➖ Remove Stock', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
                  ].map((opt) => (
                    <button
                      key={opt.value} type="button"
                      onClick={() => setAdjustForm({ ...adjustForm, type: opt.value })}
                      style={{
                        padding: '12px', border: `2px solid ${adjustForm.type === opt.value ? opt.border : '#E2E8F0'}`,
                        borderRadius: '10px',
                        background: adjustForm.type === opt.value ? opt.bg : '#F8FAFC',
                        color: adjustForm.type === opt.value ? opt.color : '#64748B',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Quantity ({selectedProduct.unit})
                </label>
                <input
                  type="number"
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                  min="0.01" step="0.01"
                  style={{
                    width: '100%', padding: '11px 14px',
                    border: '1.5px solid #E2E8F0', borderRadius: '10px',
                    fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                  onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                />
                {adjustForm.quantity && (
                  <p style={{ fontSize: '12px', marginTop: '4px', color: adjustForm.type === 'ADD' ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
                    New stock will be: {adjustForm.type === 'ADD'
                      ? parseFloat(selectedProduct.stock || 0) + parseFloat(adjustForm.quantity || '0')
                      : Math.max(0, parseFloat(selectedProduct.stock || 0) - parseFloat(adjustForm.quantity || '0'))
                    } {selectedProduct.unit}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  placeholder="e.g. Damaged goods, Stock count correction..."
                  style={{
                    width: '100%', padding: '11px 14px',
                    border: '1.5px solid #E2E8F0', borderRadius: '10px',
                    fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                  onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  style={{
                    flex: 1, padding: '12px', background: '#F1F5F9',
                    color: '#64748B', border: 'none', borderRadius: '10px',
                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >Cancel</button>
                <button
                  type="submit"
                  disabled={adjusting}
                  style={{
                    flex: 1, padding: '12px',
                    background: adjusting ? '#94A3B8' : '#1E3A5F',
                    color: '#fff', border: 'none', borderRadius: '10px',
                    fontSize: '14px', fontWeight: 600,
                    cursor: adjusting ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {adjusting ? 'Adjusting...' : '✓ Confirm Adjustment'}
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