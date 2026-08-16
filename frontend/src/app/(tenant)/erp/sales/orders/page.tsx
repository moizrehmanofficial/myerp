'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import Pagination from '@/components/common/Pagination'

export default function SalesOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [meta, setMeta] = useState<any>(null)

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchOrders(sub)
  }, [])

  function getApi(sub: string) {
    return {
      get: (url: string) => axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${url}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      ),
      patch: (url: string, data: any) => axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}${url}`, data,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      ),
      delete: (url: string) => axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}${url}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      ),
    }
  }

  async function fetchOrders(sub: string, searchTerm = '', p = 1, l = 25) {
    try {
      const res = await getApi(sub).get(`/erp/sales/orders?search=${searchTerm}&page=${p}&limit=${l}`)
      setOrders(res.data.data)
      setMeta(res.data.meta)
    } catch {
      toast.error('Failed to load sales orders')
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkDelivered(id: string) {
    if (!confirm('Mark as DELIVERED? This will deduct product stock.')) return
    try {
      await getApi(subdomain).patch(`/erp/sales/orders/${id}/status`, { status: 'DELIVERED' })
      toast.success('Order delivered — stock deducted!')
      fetchOrders(subdomain, search, page, limit)
    } catch {
      toast.error('Failed to update status')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this sales order?')) return
    try {
      await getApi(subdomain).delete(`/erp/sales/orders/${id}`)
      toast.success('Sales order deleted')
      fetchOrders(subdomain, search, page, limit)
    } catch {
      toast.error('Failed to delete')
    }
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'DELIVERED':  return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' }
      case 'CONFIRMED':  return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
      case 'PROCESSING': return { bg: '#FAF5FF', color: '#7C3AED', border: '#E9D5FF' }
      case 'PENDING':    return { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' }
      case 'CANCELLED':  return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' }
      default:           return { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
    }
  }

  return (
    <TenantLayout
      title="Sales Orders"
      subtitle="Manage customer orders"
      requiredModule="sales"
      headerRight={
        <div style={{ display: 'flex', gap: '8px' }}>
          <ExportButton
            data={orders}
            filename={`sales-orders-${subdomain}`}
            title="Sales Orders Report"
            subtitle={`${subdomain} ERP • ${new Date().toLocaleDateString()}`}
            columns={[
              { header: 'Order #', value: (r) => r.orderNumber, width: 15 },
              { header: 'Customer', value: (r) => r.customerName || '', width: 25 },
              { header: 'Date', value: (r) => new Date(r.createdAt).toLocaleDateString(), width: 15 },
              { header: 'Total (PKR)', value: (r) => parseFloat(r.totalAmount || 0).toFixed(2), width: 18 },
              { header: 'Status', value: (r) => r.status, width: 12 },
            ]}
          />
          <button onClick={() => router.push('/erp/sales/orders/create')} style={{
            padding: '10px 18px', background: '#1E3A5F',
            color: '#fff', border: 'none', borderRadius: '10px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>➕ New Sales Order</button>
        </div>
      }
    >
      <form
        onSubmit={(e) => { e.preventDefault(); setPage(1); setLoading(true); fetchOrders(subdomain, search, 1, limit) }}
        style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}
      >
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order number or customer..."
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F',
            borderRadius: '50%', animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      ) : orders.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: '16px',
          border: '1px solid #E2E8F0', padding: '80px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💰</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
            No sales orders yet
          </h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>
            Create your first sales order to start selling
          </p>
          <button
            onClick={() => router.push('/erp/sales/orders/create')}
            style={{
              padding: '10px 24px', background: '#1E3A5F',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >➕ Create First Order</button>
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: '16px',
          border: '1px solid #E2E8F0', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Order #', 'Customer', 'Date', 'Total Amount', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: '12px', fontWeight: 600,
                    color: '#64748B', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => {
                const ss = getStatusStyle(order.status)
                return (
                  <tr key={order.id} style={{
                    borderBottom: i < orders.length - 1 ? '1px solid #F1F5F9' : 'none',
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '13px', fontWeight: 700, color: '#16A34A',
                        fontFamily: 'monospace', background: '#F0FDF4',
                        padding: '3px 8px', borderRadius: '6px',
                      }}>{order.orderNumber}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                        {order.customerName || '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {order.customerPhone || ''}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        PKR {parseFloat(order.totalAmount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: '99px',
                        fontSize: '11px', fontWeight: 600,
                        background: ss.bg, color: ss.color,
                        border: `1px solid ${ss.border}`,
                      }}>{order.status}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => router.push(`/erp/sales/orders/${order.id}`)}
                          style={{
                            padding: '6px 10px', background: '#EFF6FF',
                            color: '#1D4ED8', border: '1px solid #BFDBFE',
                            borderRadius: '8px', fontSize: '12px',
                            fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >View</button>
                        {(order.status === 'PENDING' || order.status === 'CONFIRMED' || order.status === 'PROCESSING') && (
                          <button
                            onClick={() => handleMarkDelivered(order.id)}
                            style={{
                              padding: '6px 10px', background: '#F0FDF4',
                              color: '#16A34A', border: '1px solid #BBF7D0',
                              borderRadius: '8px', fontSize: '12px',
                              fontWeight: 600, cursor: 'pointer',
                              fontFamily: 'Inter, sans-serif',
                            }}
                          >✓ Deliver</button>
                        )}
                        <button
                          onClick={() => handleDelete(order.id)}
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
            fetchOrders(subdomain, search, p, limit)
          }}
          onLimitChange={(l) => {
            setLimit(l)
            setPage(1)
            setLoading(true)
            fetchOrders(subdomain, search, 1, l)
          }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}