'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import Pagination from '@/components/common/Pagination'
import { getTenantSlug } from '@/lib/getTenantSlug'

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [meta, setMeta] = useState<any>(null)

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchInvoices(sub)
  }, [])

  function getApi(sub: string) {
    return {
      get: (url: string) => axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${url}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      ),
      delete: (url: string) => axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}${url}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      ),
    }
  }

  async function fetchInvoices(sub: string, searchTerm = '', p = 1, l = 25) {
    try {
      const res = await getApi(sub).get(`/erp/invoices?search=${searchTerm}&page=${p}&limit=${l}`)
      setInvoices(res.data.data)
      setMeta(res.data.meta)
    } catch {
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this invoice?')) return
    try {
      await getApi(subdomain).delete(`/erp/invoices/${id}`)
      toast.success('Invoice deleted')
      fetchInvoices(subdomain, search, page, limit)
    } catch {
      toast.error('Failed to delete invoice')
    }
  }

  function getPaymentStyle(status: string) {
    switch (status) {
      case 'PAID':     return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' }
      case 'PARTIAL':  return { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' }
      case 'UNPAID':   return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' }
      default:         return { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
    }
  }

  return (
    <TenantLayout
      title="Invoices"
      subtitle="Manage your invoices"
      requiredModule="invoices"
      headerRight={
        <div style={{ display: 'flex', gap: '8px' }}>
          <ExportButton
            data={invoices}
            filename={`invoices-${subdomain}`}
            title="Invoices Report"
            subtitle={`${subdomain} ERP • ${new Date().toLocaleDateString()}`}
            columns={[
              { header: 'Invoice #', value: (r) => r.invoiceNumber, width: 15 },
              { header: 'Customer', value: (r) => r.customerName || '', width: 25 },
              { header: 'Date', value: (r) => new Date(r.createdAt).toLocaleDateString(), width: 15 },
              { header: 'Total (PKR)', value: (r) => parseFloat(r.totalAmount || 0).toFixed(2), width: 15 },
              { header: 'Paid (PKR)', value: (r) => parseFloat(r.paidAmount || 0).toFixed(2), width: 15 },
              { header: 'Due (PKR)', value: (r) => parseFloat(r.dueAmount || 0).toFixed(2), width: 15 },
              { header: 'Status', value: (r) => r.paymentStatus, width: 12 },
            ]}
          />
          <button onClick={() => router.push('/erp/invoices/create')} style={{
            padding: '10px 18px', background: '#1E3A5F',
            color: '#fff', border: 'none', borderRadius: '10px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>➕ Create Invoice</button>
        </div>
      }
    >
      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); setPage(1); setLoading(true); fetchInvoices(subdomain, search, 1, limit) }}
        style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice number or customer..."
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
      ) : invoices.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: '16px',
          border: '1px solid #E2E8F0', padding: '80px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🧾</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
            No invoices yet
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>
            Create your first invoice to get started
          </p>
          <button
            onClick={() => router.push('/erp/invoices/create')}
            style={{
              padding: '10px 24px', background: '#1E3A5F',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >➕ Create First Invoice</button>
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: '16px',
          border: '1px solid #E2E8F0', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Invoice #', 'Customer', 'Date', 'Total', 'Paid', 'Due', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: '12px', fontWeight: 600,
                    color: '#64748B', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => {
                const ps = getPaymentStyle(inv.paymentStatus)
                return (
                  <tr key={inv.id} style={{
                    borderBottom: i < invoices.length - 1 ? '1px solid #F1F5F9' : 'none',
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '13px', fontWeight: 700, color: '#1E3A5F',
                        fontFamily: 'monospace', background: '#EFF6FF',
                        padding: '3px 8px', borderRadius: '6px',
                      }}>{inv.invoiceNumber}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                        {inv.customerName || '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {inv.customerPhone || ''}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                        PKR {parseFloat(inv.totalAmount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#16A34A' }}>
                        PKR {parseFloat(inv.paidAmount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#DC2626' }}>
                        PKR {parseFloat(inv.dueAmount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: '99px',
                        fontSize: '11px', fontWeight: 600,
                        background: ps.bg, color: ps.color,
                        border: `1px solid ${ps.border}`,
                      }}>{inv.paymentStatus}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => router.push(`/erp/invoices/${inv.id}`)}
                          style={{
                            padding: '6px 10px', background: '#EFF6FF',
                            color: '#1D4ED8', border: '1px solid #BFDBFE',
                            borderRadius: '8px', fontSize: '12px',
                            fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >View</button>
                        <button
                          onClick={() => router.push(`/erp/invoices/${inv.id}/edit`)}
                          style={{
                            padding: '6px 10px', background: '#FFF7ED',
                            color: '#EA580C', border: '1px solid #FED7AA',
                            borderRadius: '8px', fontSize: '12px',
                            fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >Edit</button>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          style={{
                            padding: '6px 10px', background: '#FEF2F2',
                            color: '#DC2626', border: '1px solid #FECACA',
                            borderRadius: '8px', fontSize: '12px',
                            fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
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
            fetchInvoices(subdomain, search, p, limit)
          }}
          onLimitChange={(l) => {
            setLimit(l)
            setPage(1)
            setLoading(true)
            fetchInvoices(subdomain, search, 1, l)
          }}
        />
      )}
    </TenantLayout>
  )
}