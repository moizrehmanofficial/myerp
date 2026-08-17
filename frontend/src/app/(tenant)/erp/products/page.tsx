'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import Pagination from '@/components/common/Pagination'
import { getTenantSlug } from '@/lib/getTenantSlug'

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [subdomain, setSubdomain] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [meta, setMeta] = useState<any>(null)

  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    unit: 'pcs',
    purchasePrice: '',
    salePrice: '',
    minStock: '0',
    maxStock: '0',
  })

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchProducts(sub)
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
      put: (url: string, data: any) => axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}${url}`, data,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      ),
      delete: (url: string) => axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}${url}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      ),
    }
  }

  async function fetchProducts(sub: string, searchTerm = '', p = 1, l = 25) {
    try {
      const res = await getApi(sub).get(`/erp/products?search=${searchTerm}&page=${p}&limit=${l}`)
      setProducts(res.data.data)
      setMeta(res.data.meta)
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  function generateSKU() {
    const sku = 'SKU-' + Date.now().toString().slice(-6)
    setForm((prev) => ({ ...prev, sku }))
  }

  function openCreate() {
    setEditingProduct(null)
    setForm({ name: '', sku: '', barcode: '', unit: 'pcs', purchasePrice: '', salePrice: '', minStock: '0', maxStock: '0' })
    setShowModal(true)
  }

  function openEdit(product: any) {
    setEditingProduct(product)
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      unit: product.unit || 'pcs',
      purchasePrice: product.purchasePrice?.toString() || '',
      salePrice: product.salePrice?.toString() || '',
      minStock: product.minStock?.toString() || '0',
      maxStock: product.maxStock?.toString() || '0',
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.sku) {
      toast.error('Name and SKU are required')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        purchasePrice: parseFloat(form.purchasePrice) || 0,
        salePrice: parseFloat(form.salePrice) || 0,
        minStock: parseFloat(form.minStock) || 0,
        maxStock: parseFloat(form.maxStock) || 0,
      }
      if (editingProduct) {
        await getApi(subdomain).put(`/erp/products/${editingProduct.id}`, payload)
        toast.success('Product updated')
      } else {
        await getApi(subdomain).post('/erp/products', payload)
        toast.success('Product created')
      }
      setShowModal(false)
      fetchProducts(subdomain, search, page, limit)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save product')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product?')) return
    try {
      await getApi(subdomain).delete(`/erp/products/${id}`)
      toast.success('Product deleted')
      fetchProducts(subdomain, search, page, limit)
    } catch {
      toast.error('Failed to delete product')
    }
  }

  const units = ['pcs', 'kg', 'g', 'ltr', 'ml', 'm', 'cm', 'box', 'dozen', 'pair']

  return (
    <TenantLayout
      title="Products"
      subtitle="Manage your product catalog"
      requiredModule="products"
      headerRight={
        <div style={{ display: 'flex', gap: '8px' }}>
          <ExportButton
            data={products}
            filename={`products-${subdomain}`}
            title="Products Report"
            subtitle={`${subdomain} ERP • ${new Date().toLocaleDateString()}`}
            columns={[
              { header: 'Name', value: (r) => r.name, width: 28 },
              { header: 'SKU', value: (r) => r.sku || '', width: 18 },
              { header: 'Unit', value: (r) => r.unit || '', width: 10 },
              { header: 'Purchase Price', value: (r) => parseFloat(r.purchasePrice || 0).toFixed(2), width: 18 },
              { header: 'Sale Price', value: (r) => parseFloat(r.salePrice || 0).toFixed(2), width: 15 },
              { header: 'Stock', value: (r) => parseFloat(r.stock || 0).toFixed(2), width: 12 },
            ]}
          />
          <button onClick={openCreate} style={{
            padding: '10px 18px', background: '#1E3A5F',
            color: '#fff', border: 'none', borderRadius: '10px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>➕ Add Product</button>
        </div>
      }
    >
      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); setPage(1); setLoading(true); fetchProducts(subdomain, search, 1, limit) }}
        style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU..."
          style={{
            flex: 1, padding: '10px 16px',
            border: '1.5px solid #E2E8F0', borderRadius: '10px',
            fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
          }}
        />
        <button type="submit" style={{
          padding: '10px 20px', background: '#1E3A5F',
          color: '#fff', border: 'none', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}>Search</button>
      </form>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F',
            borderRadius: '50%', animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      ) : products.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: '16px',
          border: '1px solid #E2E8F0', padding: '80px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
            No products yet
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>
            Add your first product to get started
          </p>
          <button onClick={openCreate} style={{
            padding: '10px 24px', background: '#1E3A5F',
            color: '#fff', border: 'none', borderRadius: '10px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>➕ Add First Product</button>
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: '16px',
          border: '1px solid #E2E8F0', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Product', 'SKU', 'Unit', 'Purchase Price', 'Sale Price', 'Stock', 'Actions'].map((h) => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: '12px', fontWeight: 600,
                    color: '#64748B', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id} style={{
                  borderBottom: i < products.length - 1 ? '1px solid #F1F5F9' : 'none',
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
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      fontSize: '12px', color: '#7C3AED',
                      fontFamily: 'monospace', background: '#FAF5FF',
                      padding: '2px 8px', borderRadius: '6px',
                    }}>{p.sku}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{p.unit}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                      PKR {parseFloat(p.purchasePrice || 0).toLocaleString()}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#16A34A' }}>
                      PKR {parseFloat(p.salePrice || 0).toLocaleString()}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      fontSize: '13px', fontWeight: 700,
                      color: parseFloat(p.stock) <= parseFloat(p.minStock) ? '#DC2626' : '#0F172A',
                    }}>
                      {parseFloat(p.stock || 0).toLocaleString()}
                    </span>
                    {parseFloat(p.stock) <= parseFloat(p.minStock) && (
                      <span style={{
                        marginLeft: '6px', fontSize: '10px',
                        background: '#FEF2F2', color: '#DC2626',
                        padding: '2px 6px', borderRadius: '99px', fontWeight: 600,
                      }}>Low</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => openEdit(p)} style={{
                        padding: '6px 12px', background: '#EFF6FF',
                        color: '#1D4ED8', border: '1px solid #BFDBFE',
                        borderRadius: '8px', fontSize: '12px',
                        fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}>Edit</button>
                      <button onClick={() => handleDelete(p.id)} style={{
                        padding: '6px 12px', background: '#FEF2F2',
                        color: '#DC2626', border: '1px solid #FECACA',
                        borderRadius: '8px', fontSize: '12px',
                        fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && (
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={limit}
          onPageChange={(p) => {
            setPage(p)
            setLoading(true)
            fetchProducts(subdomain, search, p, limit)
          }}
          onLimitChange={(l) => {
            setLimit(l)
            setPage(1)
            setLoading(true)
            fetchProducts(subdomain, search, 1, l)
          }}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200,
        }}>
          <div style={{
            background: '#fff', borderRadius: '20px',
            padding: '32px', width: '100%', maxWidth: '540px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '24px' }}>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Name */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Product Name *
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Samsung Galaxy A54"
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: '1.5px solid #E2E8F0', borderRadius: '10px',
                      fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                    onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>

                {/* SKU */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    SKU *
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      placeholder="SKU-001"
                      style={{
                        flex: 1, padding: '10px 14px',
                        border: '1.5px solid #E2E8F0', borderRadius: '10px',
                        fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                      onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                    />
                    <button
                      type="button"
                      onClick={generateSKU}
                      style={{
                        padding: '10px 12px', background: '#F1F5F9',
                        border: '1.5px solid #E2E8F0', borderRadius: '10px',
                        fontSize: '12px', fontWeight: 600, color: '#374151',
                        cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                        whiteSpace: 'nowrap',
                      }}
                    >Auto</button>
                  </div>
                </div>

                {/* Barcode */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Barcode
                  </label>
                  <input
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="Optional"
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: '1.5px solid #E2E8F0', borderRadius: '10px',
                      fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                    onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>

                {/* Unit */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Unit
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: '1.5px solid #E2E8F0', borderRadius: '10px',
                      fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
                      background: '#fff',
                    }}
                  >
                    {units.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                {/* Purchase Price */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Purchase Price (PKR)
                  </label>
                  <input
                    type="number"
                    value={form.purchasePrice}
                    onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                    placeholder="0"
                    min="0"
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: '1.5px solid #E2E8F0', borderRadius: '10px',
                      fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                    onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>

                {/* Sale Price */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Sale Price (PKR)
                  </label>
                  <input
                    type="number"
                    value={form.salePrice}
                    onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                    placeholder="0"
                    min="0"
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: '1.5px solid #E2E8F0', borderRadius: '10px',
                      fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                    onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>

                {/* Min Stock */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Min Stock (Alert Level)
                  </label>
                  <input
                    type="number"
                    value={form.minStock}
                    onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                    placeholder="0"
                    min="0"
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: '1.5px solid #E2E8F0', borderRadius: '10px',
                      fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                    onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>

                {/* Max Stock */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Max Stock
                  </label>
                  <input
                    type="number"
                    value={form.maxStock}
                    onChange={(e) => setForm({ ...form, maxStock: e.target.value })}
                    placeholder="0"
                    min="0"
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: '1.5px solid #E2E8F0', borderRadius: '10px',
                      fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                    onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1, padding: '12px', background: '#F1F5F9',
                    color: '#64748B', border: 'none', borderRadius: '10px',
                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >Cancel</button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1, padding: '12px',
                    background: submitting ? '#94A3B8' : '#1E3A5F',
                    color: '#fff', border: 'none', borderRadius: '10px',
                    fontSize: '14px', fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {submitting ? 'Saving...' : (editingProduct ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </TenantLayout>
  )
}