'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import { getTenantSlug } from '@/lib/getTenantSlug'

export default function PurchaseOrderDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchOrder(sub)
  }, [id])

  async function fetchOrder(sub: string) {
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/purchase/orders/${id}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setOrder(res.data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load order')
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkReceived() {
    if (!confirm('Mark as RECEIVED? This will update product stock.')) return
    setUpdating(true)
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/purchase/orders/${id}/status`,
        { status: 'RECEIVED' },
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } }
      )
      toast.success('Order received — stock updated!')
      fetchOrder(subdomain)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'RECEIVED':  return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' }
      case 'ORDERED':   return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
      case 'PENDING':   return { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' }
      case 'CANCELLED': return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' }
      default:          return { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
    }
  }

  if (loading) {
    return (
      <TenantLayout title="Purchase Order" subtitle="">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F',
            borderRadius: '50%', animation: 'spin 0.7s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </TenantLayout>
    )
  }

  if (!order) {
    return (
      <TenantLayout title="Purchase Order" subtitle="">
        <div style={{ textAlign: 'center', padding: '80px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
          <h3>Order not found</h3>
          <button onClick={() => router.push('/erp/purchase/orders')} style={{
            marginTop: '16px', padding: '10px 20px',
            background: '#1E3A5F', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>← Back to Orders</button>
        </div>
      </TenantLayout>
    )
  }

  const ss = getStatusStyle(order.status)

  return (
    <TenantLayout
      title={order.orderNumber}
      subtitle={`Created on ${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
      requiredModule="purchase"
      headerRight={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => router.push('/erp/purchase/orders')}
            style={{
              padding: '8px 16px', background: '#F1F5F9',
              color: '#64748B', border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >← Back</button>
          {(order.status === 'PENDING' || order.status === 'ORDERED') && (
            <button
              onClick={handleMarkReceived}
              disabled={updating}
              style={{
                padding: '8px 16px', background: '#F0FDF4',
                color: '#16A34A', border: '1px solid #BBF7D0',
                borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                cursor: updating ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >{updating ? 'Processing...' : '✓ Mark as Received'}</button>
          )}
          <button
            onClick={() => window.print()}
            style={{
              padding: '8px 16px', background: '#EFF6FF',
              color: '#1D4ED8', border: '1px solid #BFDBFE',
              borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >🖨️ Print</button>
        </div>
      }
    >
      <div style={{
        maxWidth: '860px', margin: '0 auto',
        background: '#fff', borderRadius: '20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1E3A5F, #2E86AB)',
          padding: '32px 40px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{
                width: '44px', height: '44px', background: 'rgba(255,255,255,0.2)',
                borderRadius: '12px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '22px',
              }}>🛒</div>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}>
                  Purchase Order
                </div>
                <div style={{ color: '#93C5FD', fontSize: '12px' }}>
                  {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '28px', fontWeight: 900, color: '#fff',
              letterSpacing: '-0.5px', marginBottom: '8px',
            }}>
              {order.orderNumber}
            </div>
            <span style={{
              padding: '4px 14px', borderRadius: '99px',
              fontSize: '12px', fontWeight: 700,
              background: ss.bg, color: ss.color,
              border: `1px solid ${ss.border}`,
            }}>{order.status}</span>
          </div>
        </div>

        {/* Supplier Info + Order Info */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          borderBottom: '1px solid #F1F5F9',
        }}>
          <div style={{ padding: '28px 40px', borderRight: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
              Supplier
            </p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
              {order.supplierName || '—'}
            </p>
            {order.supplierPhone && (
              <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '2px' }}>📞 {order.supplierPhone}</p>
            )}
            {order.supplierEmail && (
              <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '2px' }}>✉️ {order.supplierEmail}</p>
            )}
            {order.supplierAddress && (
              <p style={{ fontSize: '13px', color: '#64748B' }}>📍 {order.supplierAddress}</p>
            )}
          </div>

          <div style={{ padding: '28px 40px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
              Order Details
            </p>
            {[
              { label: 'Order No', value: order.orderNumber },
              { label: 'Date', value: new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
              { label: 'Status', value: order.status },
              { label: 'Items', value: `${(order.items || []).length} products` },
            ].map((row) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between', marginBottom: '8px',
              }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>{row.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Items Table */}
        <div style={{ padding: '28px 40px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
            Products
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['#', 'Product', 'SKU', 'Unit', 'Qty', 'Unit Price', 'Total'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: h === '#' ? 'center' : 'left',
                    fontSize: '11px', fontWeight: 700, color: '#64748B',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '2px solid #E2E8F0',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item: any, i: number) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px', color: '#94A3B8', fontWeight: 600 }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                      {item.productName || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      fontSize: '11px', color: '#7C3AED',
                      fontFamily: 'monospace', background: '#FAF5FF',
                      padding: '2px 8px', borderRadius: '6px',
                    }}>{item.productSku || '—'}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', color: '#64748B' }}>
                    {item.productUnit || 'pcs'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                    {parseFloat(item.quantity).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '14px', color: '#374151' }}>
                    PKR {parseFloat(item.unitPrice || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                    PKR {parseFloat(item.totalPrice || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total + Notes */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 280px',
          borderTop: '1px solid #F1F5F9',
        }}>
          <div style={{ padding: '28px 40px' }}>
            {order.notes && (
              <>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Notes
                </p>
                <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6 }}>
                  {order.notes}
                </p>
              </>
            )}
            {order.status === 'RECEIVED' && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px', background: '#F0FDF4',
                border: '1px solid #BBF7D0', borderRadius: '99px',
                marginTop: order.notes ? '16px' : '0',
              }}>
                <span style={{ color: '#16A34A', fontSize: '14px' }}>✓</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#16A34A' }}>
                  Stock has been updated
                </span>
              </div>
            )}
          </div>

          <div style={{ padding: '28px 40px', borderLeft: '1px solid #F1F5F9' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '14px 16px', background: '#1E3A5F',
              borderRadius: '10px',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Total Amount</span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>
                PKR {parseFloat(order.totalAmount || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 40px', borderTop: '1px solid #F1F5F9',
          background: '#F8FAFC', textAlign: 'center',
        }}>
          <p style={{ fontSize: '12px', color: '#94A3B8' }}>
            Generated by MyERP • {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          aside, header, button { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </TenantLayout>
  )
}