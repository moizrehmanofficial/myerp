'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import { usePermission } from '@/hooks/usePermission'
import ExportButton from '@/components/common/ExportButton'
import Pagination from '@/components/common/Pagination'
import { getTenantSlug } from '@/lib/getTenantSlug'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [subdomain, setSubdomain] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [meta, setMeta] = useState<any>(null)
  const { canWrite, canModify, canDelete } = usePermission()

  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '',
  })

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchCustomers(sub)
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

  async function fetchCustomers(sub: string, searchTerm = '', p = 1, l = 25) {
    try {
      const res = await getApi(sub).get(
        `/erp/customers?search=${searchTerm}&page=${p}&limit=${l}`
      )
      setCustomers(res.data.data)
      setMeta(res.data.meta)
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setLoading(true)
    await fetchCustomers(subdomain, search, 1, limit)
  }

  function openCreate() {
    setEditingCustomer(null)
    setForm({ name: '', email: '', phone: '', address: '' })
    setShowModal(true)
  }

  function openEdit(customer: any) {
    setEditingCustomer(customer)
    setForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) {
      toast.error('Customer name is required')
      return
    }
    setSubmitting(true)
    try {
      if (editingCustomer) {
        await getApi(subdomain).put(`/erp/customers/${editingCustomer.id}`, form)
        toast.success('Customer updated')
      } else {
        await getApi(subdomain).post('/erp/customers', form)
        toast.success('Customer created')
      }
      setShowModal(false)
      fetchCustomers(subdomain, search, page, limit)
    } catch {
      toast.error('Failed to save customer')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this customer?')) return
    try {
      await getApi(subdomain).delete(`/erp/customers/${id}`)
      toast.success('Customer deleted')
      fetchCustomers(subdomain, search, page, limit)
    } catch {
      toast.error('Failed to delete customer')
    }
  }

  return (
    <TenantLayout
      title="Customers"
      subtitle="Manage your customer list"
      requiredModule="contacts"
      headerRight={
        <div style={{ display: 'flex', gap: '8px' }}>
          <ExportButton
            data={customers}
            filename={`customers-${subdomain}`}
            title="Customers Report"
            subtitle={`${subdomain} ERP • ${new Date().toLocaleDateString()}`}
            columns={[
              { header: 'Name', value: (r) => r.name, width: 25 },
              { header: 'Email', value: (r) => r.email || '', width: 28 },
              { header: 'Phone', value: (r) => r.phone || '', width: 18 },
              { header: 'Address', value: (r) => r.address || '', width: 30 },
              { header: 'Balance (PKR)', value: (r) => parseFloat(r.balance || 0).toFixed(2), width: 18 },
            ]}
          />
          {canWrite('contacts') && (
            <button onClick={openCreate} style={{
              padding: '10px 18px', background: '#1E3A5F',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>➕ Add Customer</button>
          )}
        </div>
      }
    >

          {/* Search */}
          <form onSubmit={handleSearch} style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or phone..."
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
          ) : customers.length === 0 ? (
            <div style={{
              background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0',
              padding: '80px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                No customers yet
              </h3>
              <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>
                Add your first customer to get started
              </p>
              {canWrite('contacts') && (
                <button onClick={openCreate} style={{
                  padding: '10px 24px', background: '#1E3A5F',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}>➕ Add First Customer</button>
              )}
            </div>
          ) : (
            <div style={{
              background: '#fff', borderRadius: '16px',
              border: '1px solid #E2E8F0', overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Name', 'Email', 'Phone', 'Address', 'Balance', 'Actions'].map((h) => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: 'left',
                        fontSize: '12px', fontWeight: 600,
                        color: '#64748B', textTransform: 'uppercase',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, i) => (
                    <tr key={c.id} style={{
                      borderBottom: i < customers.length - 1 ? '1px solid #F1F5F9' : 'none',
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: '#EFF6FF', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: '16px', fontWeight: 700, color: '#1D4ED8',
                          }}>{c.name?.charAt(0)}</div>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{c.email || '—'}</td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{c.phone || '—'}</td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{c.address || '—'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          fontSize: '13px', fontWeight: 600,
                          color: parseFloat(c.balance) > 0 ? '#DC2626' : '#16A34A',
                        }}>
                          PKR {parseFloat(c.balance || 0).toLocaleString()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {canModify('contacts') && (
                            <button onClick={() => openEdit(c)} style={{
                              padding: '6px 12px', background: '#EFF6FF',
                              color: '#1D4ED8', border: '1px solid #BFDBFE',
                              borderRadius: '8px', fontSize: '12px',
                              fontWeight: 600, cursor: 'pointer',
                              fontFamily: 'Inter, sans-serif',
                            }}>Edit</button>
                          )}
                          {canDelete('contacts') && (
                            <button onClick={() => handleDelete(c.id)} style={{
                              padding: '6px 12px', background: '#FEF2F2',
                              color: '#DC2626', border: '1px solid #FECACA',
                              borderRadius: '8px', fontSize: '12px',
                              fontWeight: 600, cursor: 'pointer',
                              fontFamily: 'Inter, sans-serif',
                            }}>Delete</button>
                          )}
                          {!canModify('contacts') && !canDelete('contacts') && (
                            <span style={{ fontSize: '12px', color: '#94A3B8' }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {meta && (
                <div style={{ padding: '0 16px' }}>
                  <Pagination
                    page={page}
                    totalPages={meta.totalPages}
                    total={meta.total}
                    limit={limit}
                    onPageChange={(p) => {
                      setPage(p)
                      setLoading(true)
                      fetchCustomers(subdomain, search, p, limit)
                    }}
                    onLimitChange={(l) => {
                      setLimit(l)
                      setPage(1)
                      setLoading(true)
                      fetchCustomers(subdomain, search, 1, l)
                    }}
                  />
                </div>
              )}
            </div>
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
            padding: '32px', width: '100%', maxWidth: '480px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '24px' }}>
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h3>

            <form onSubmit={handleSubmit}>
              {[
                { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'e.g. Ahmed Khan' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'customer@email.com' },
                { label: 'Phone', key: 'phone', type: 'text', placeholder: '+92 300 0000000' },
                { label: 'Address', key: 'address', type: 'text', placeholder: 'City, Country' },
              ].map((field) => (
                <div key={field.key} style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block', fontSize: '13px',
                    fontWeight: 600, color: '#374151', marginBottom: '6px',
                  }}>{field.label}</label>
                  <input
                    type={field.type}
                    value={(form as any)[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: '1.5px solid #E2E8F0', borderRadius: '10px',
                      fontSize: '14px', outline: 'none',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                    onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>
              ))}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{
                  flex: 1, padding: '12px', background: '#F1F5F9',
                  color: '#64748B', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{
                  flex: 1, padding: '12px',
                  background: submitting ? '#94A3B8' : '#1E3A5F',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {submitting ? 'Saving...' : (editingCustomer ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </TenantLayout>
  )
}