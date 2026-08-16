'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'

export default function ManufacturingDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchOrder(sub)
  }, [id])

  async function fetchOrder(sub: string) {
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/manufacturing/orders/${id}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setOrder(res.data.data)
    } catch {
      toast.error('Failed to load order')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusUpdate(status: string) {
    const confirmMsg = status === 'COMPLETED'
      ? 'Mark as COMPLETED? Raw materials will be deducted and finished product added to stock.'
      : `Change status to ${status}?`
    if (!confirm(confirmMsg)) return
    setUpdating(true)
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/manufacturing/orders/${id}/status`,
        { status },
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } }
      )
      toast.success(status === 'COMPLETED' ? 'Production completed — stock updated!' : 'Status updated')
      fetchOrder(subdomain)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'COMPLETED':   return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' }
      case 'IN_PROGRESS': return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
      case 'PLANNED':     return { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' }
      case 'CANCELLED':   return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' }
      default:            return { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
    }
  }

  if (loading) return (
    <TenantLayout title="Production Order" subtitle="" requiredModule="manufacturing">
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </TenantLayout>
  )

  if (!order) return (
    <TenantLayout title="Production Order" subtitle="" requiredModule="manufacturing">
      <div style={{ textAlign: 'center', padding: '80px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏭</div>
        <h3>Order not found</h3>
        <button onClick={() => router.push('/erp/manufacturing')} style={{ marginTop: '16px', padding: '10px 20px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Back</button>
      </div>
    </TenantLayout>
  )

  const ss = getStatusStyle(order.status)

  return (
    <TenantLayout
      title={order.orderNumber}
      subtitle={`Production order for ${order.productName}`}
      requiredModule="manufacturing"
      headerRight={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => router.push('/erp/manufacturing')} style={{ padding: '8px 16px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Back</button>
          {order.status === 'PLANNED' && (
            <button onClick={() => handleStatusUpdate('IN_PROGRESS')} disabled={updating} style={{ padding: '8px 16px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>▶ Start Production</button>
          )}
          {order.status === 'IN_PROGRESS' && (
            <button onClick={() => handleStatusUpdate('COMPLETED')} disabled={updating} style={{ padding: '8px 16px', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>✓ Mark Complete</button>
          )}
          <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>🖨️ Print</button>
        </div>
      }
    >
      <div style={{ maxWidth: '860px', margin: '0 auto', background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1E3A5F, #2E86AB)', padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🏭</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}>Production Order</div>
              <div style={{ color: '#93C5FD', fontSize: '12px' }}>{new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>{order.orderNumber}</div>
            <span style={{ padding: '4px 14px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>{order.status}</span>
          </div>
        </div>

        {/* Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ padding: '28px 40px', borderRight: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Finished Product</p>
            <p style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>{order.productName}</p>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>{order.productSku}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#64748B' }}>Quantity to produce:</span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#1E3A5F' }}>{parseFloat(order.quantity).toLocaleString()} {order.productUnit}</span>
            </div>
            {order.status === 'COMPLETED' && (
              <div style={{ marginTop: '8px', padding: '6px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#16A34A', fontSize: '12px' }}>✓</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#16A34A' }}>Added to stock</span>
              </div>
            )}
          </div>
          <div style={{ padding: '28px 40px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Schedule</p>
            {[
              { label: 'Start Date', value: order.startDate ? new Date(order.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set' },
              { label: 'End Date', value: order.endDate ? new Date(order.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set' },
              { label: 'Current Stock', value: `${parseFloat(order.currentStock || 0).toLocaleString()} ${order.productUnit}` },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>{row.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Raw Materials */}
        <div style={{ padding: '28px 40px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
            Raw Materials Required
          </p>
          {(!order.materials || order.materials.length === 0) ? (
            <p style={{ color: '#94A3B8', fontSize: '13px' }}>No raw materials specified for this order.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Product', 'SKU', 'Available Stock', 'Required Qty', 'Used Qty', 'Status'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.materials.map((mat: any, i: number) => {
                  const available = parseFloat(mat.availableStock || 0)
                  const required = parseFloat(mat.requiredQuantity || 0)
                  const sufficient = available >= required
                  return (
                    <tr key={mat.id} style={{ borderBottom: i < order.materials.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                      <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{mat.productName}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#7C3AED', background: '#FAF5FF', padding: '2px 8px', borderRadius: '6px' }}>{mat.productSku}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: sufficient ? '#16A34A' : '#DC2626' }}>
                        {available.toLocaleString()} {mat.unit}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                        {required.toLocaleString()} {mat.unit}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#64748B' }}>
                        {parseFloat(mat.usedQuantity || 0) > 0 ? `${parseFloat(mat.usedQuantity).toLocaleString()} ${mat.unit}` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {order.status === 'COMPLETED' ? (
                          <span style={{ padding: '3px 8px', background: '#F0FDF4', color: '#16A34A', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>✓ Used</span>
                        ) : sufficient ? (
                          <span style={{ padding: '3px 8px', background: '#F0FDF4', color: '#16A34A', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>✓ Sufficient</span>
                        ) : (
                          <span style={{ padding: '3px 8px', background: '#FEF2F2', color: '#DC2626', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>⚠ Insufficient</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Notes + Footer */}
        {order.notes && (
          <div style={{ padding: '0 40px 24px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Notes</p>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6 }}>{order.notes}</p>
          </div>
        )}

        <div style={{ padding: '16px 40px', borderTop: '1px solid #F1F5F9', background: '#F8FAFC', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#94A3B8' }}>Generated by MyERP • {new Date().toLocaleDateString()}</p>
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