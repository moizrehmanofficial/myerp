'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'

export default function BrandsPage() {
  const [brands, setBrands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchBrands(sub)
  }, [])

  function getApi(sub: string) {
    return {
      get: (url: string) => axios.get(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      post: (url: string, data: any) => axios.post(`${process.env.NEXT_PUBLIC_API_URL}${url}`, data, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      delete: (url: string) => axios.delete(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
    }
  }

  async function fetchBrands(sub: string) {
    try {
      const res = await getApi(sub).get('/erp/products/brands')
      setBrands(res.data.data)
    } catch {
      toast.error('Failed to load brands')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Brand name is required'); return }
    setSubmitting(true)
    try {
      await getApi(subdomain).post('/erp/products/brands', { name })
      toast.success('Brand created')
      setShowModal(false)
      setName('')
      fetchBrands(subdomain)
    } catch {
      toast.error('Failed to create brand')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this brand?')) return
    try {
      await getApi(subdomain).delete(`/erp/products/brands/${id}`)
      toast.success('Brand deleted')
      fetchBrands(subdomain)
    } catch {
      toast.error('Failed to delete brand')
    }
  }

  return (
    <TenantLayout
      title="Brands"
      subtitle="Manage product brands"
      requiredModule="products"
      headerRight={
        <button onClick={() => setShowModal(true)} style={{
          padding: '10px 18px', background: '#1E3A5F',
          color: '#fff', border: 'none', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}>➕ Add Brand</button>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : brands.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '80px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏭</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No brands yet</h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>Add brands to organize your products</p>
          <button onClick={() => setShowModal(true)} style={{ padding: '10px 24px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>➕ Add First Brand</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
          {brands.map((b) => (
            <div key={b.id} style={{
              background: '#fff', borderRadius: '14px',
              border: '1px solid #E2E8F0', padding: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#FAF5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏭</div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{b.name}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#94A3B8' }}>{b.productCount} products</p>
              </div>
              <button onClick={() => handleDelete(b.id)} style={{
                padding: '6px 10px', background: '#FEF2F2',
                color: '#DC2626', border: '1px solid #FECACA',
                borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '20px' }}>➕ Add Brand</h3>
            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Brand Name</label>
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Samsung" autoFocus
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}
                onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '12px', background: submitting ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>{submitting ? 'Saving...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}