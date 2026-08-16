'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)

    const cached = sessionStorage.getItem(`tenant_user_${sub}`)
    if (cached) {
      try { setUserName(JSON.parse(cached).name || '') } catch {}
    }

    fetchStats(sub)
  }, [])

  async function fetchStats(sub: string) {
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/dashboard/stats`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setStats(res.data.data)
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const now = new Date()
  const timeOfDay = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  if (loading) {
    return (
      <TenantLayout title="Dashboard" subtitle="">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </TenantLayout>
    )
  }

  const s = stats || {}

  return (
    <TenantLayout
      title="Dashboard"
      subtitle={`${timeOfDay}, ${userName || 'Welcome back'}! Here's your business overview.`}
    >
      {/* KPI Cards Row 1 — Revenue */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        {[
          {
            label: 'Total Revenue',
            value: `PKR ${(s.totalRevenue || 0).toLocaleString()}`,
            sub: `PKR ${(s.monthlyRevenue || 0).toLocaleString()} this month`,
            icon: '💰', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0',
          },
          {
            label: 'Total Collected',
            value: `PKR ${(s.totalCollected || 0).toLocaleString()}`,
            sub: `${s.totalInvoices || 0} total invoices`,
            icon: '✅', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE',
          },
          {
            label: 'Accounts Receivable',
            value: `PKR ${(s.accountsReceivable || 0).toLocaleString()}`,
            sub: `${s.unpaidInvoices || 0} unpaid invoices`,
            icon: '⏳', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA',
          },
          {
            label: 'Monthly Purchases',
            value: `PKR ${(s.monthlyPurchaseTotal || 0).toLocaleString()}`,
            sub: `${s.monthlyPurchaseCount || 0} purchase orders`,
            icon: '🛒', color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA',
          },
        ].map((card) => (
          <div key={card.label} style={{
            background: '#fff', borderRadius: '16px', padding: '20px',
            border: `1px solid ${card.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: card.bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                {card.icon}
              </div>
            </div>
            <p style={{ fontSize: '22px', fontWeight: 900, color: card.color, marginBottom: '4px', lineHeight: 1 }}>{card.value}</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>{card.label}</p>
            <p style={{ fontSize: '11px', color: '#94A3B8' }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* KPI Cards Row 2 — Operations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Customers', value: s.totalCustomers || 0, icon: '👥', color: '#1D4ED8', onClick: () => router.push('/erp/customers') },
          { label: 'Suppliers', value: s.totalSuppliers || 0, icon: '🏭', color: '#7C3AED', onClick: () => router.push('/erp/suppliers') },
          { label: 'Products', value: s.totalProducts || 0, icon: '📦', color: '#EA580C', onClick: () => router.push('/erp/products') },
          { label: 'Low Stock', value: s.lowStockCount || 0, icon: '⚠️', color: '#DC2626', onClick: () => router.push('/erp/inventory') },
          { label: 'Employees', value: s.activeEmployees || 0, icon: '👤', color: '#16A34A', onClick: () => router.push('/erp/hr/employees') },
        ].map((card) => (
          <div
            key={card.label}
            onClick={card.onClick}
            style={{
              background: '#fff', borderRadius: '14px', padding: '16px 18px',
              border: '1px solid #E2E8F0', cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1E3A5F'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{ fontSize: '22px', marginBottom: '8px' }}>{card.icon}</div>
            <p style={{ fontSize: '24px', fontWeight: 900, color: card.color, marginBottom: '2px' }}>{card.value.toLocaleString()}</p>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* Monthly Revenue Chart + Top Products */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', marginBottom: '20px' }}>

        {/* Revenue Trend */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '20px' }}>📈 Revenue Trend (Last 6 Months)</h3>
          {!s.monthlyRevenueTrend || s.monthlyRevenueTrend.length === 0 ? (
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>No revenue data yet</div>
          ) : (() => {
            const maxRevenue = Math.max(...s.monthlyRevenueTrend.map((m: any) => m.revenue), 1)
            return (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', paddingBottom: '24px', position: 'relative' }}>
                {s.monthlyRevenueTrend.map((m: any, i: number) => {
                  const height = Math.max((m.revenue / maxRevenue) * 130, 4)
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600, textAlign: 'center' }}>
                        {m.revenue > 0 ? `${(m.revenue / 1000).toFixed(0)}k` : ''}
                      </div>
                      <div
                        style={{
                          width: '100%', height: `${height}px`,
                          background: i === s.monthlyRevenueTrend.length - 1
                            ? 'linear-gradient(180deg, #2E86AB, #1E3A5F)'
                            : '#E2E8F0',
                          borderRadius: '6px 6px 0 0',
                          transition: 'height 0.5s ease',
                          position: 'relative',
                        }}
                        title={`PKR ${m.revenue.toLocaleString()}`}
                      />
                      <div style={{ fontSize: '10px', color: '#94A3B8', textAlign: 'center', position: 'absolute', bottom: 0 }}>{m.month}</div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Top Products */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>🏆 Top Products This Month</h3>
          </div>
          {!s.topProducts || s.topProducts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No sales this month</div>
          ) : (
            <div>
              {s.topProducts.map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: i < s.topProducts.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#64748B' }}>#{i + 1}</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>Sold: {p.soldQty} units</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>PKR {p.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Recent Invoices */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>🧾 Recent Invoices</h3>
            <button onClick={() => router.push('/erp/invoices')} style={{ fontSize: '12px', color: '#1D4ED8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>View All →</button>
          </div>
          {!s.recentInvoices || s.recentInvoices.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No invoices yet</div>
          ) : s.recentInvoices.map((inv: any, i: number) => {
            const statusColor = inv.paymentStatus === 'PAID' ? '#16A34A' : inv.paymentStatus === 'PARTIAL' ? '#EA580C' : '#DC2626'
            const statusBg = inv.paymentStatus === 'PAID' ? '#F0FDF4' : inv.paymentStatus === 'PARTIAL' ? '#FFF7ED' : '#FEF2F2'
            return (
              <div key={i} onClick={() => router.push(`/erp/invoices/${inv.id}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: i < s.recentInvoices.length - 1 ? '1px solid #F8FAFC' : 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{inv.invoiceNumber}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>{inv.customerName} • {new Date(inv.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>PKR {inv.totalAmount.toLocaleString()}</div>
                  <span style={{ padding: '2px 8px', background: statusBg, color: statusColor, borderRadius: '99px', fontSize: '10px', fontWeight: 600 }}>{inv.paymentStatus}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Recent Purchases */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>🛒 Recent Purchases</h3>
            <button onClick={() => router.push('/erp/purchase/orders')} style={{ fontSize: '12px', color: '#1D4ED8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>View All →</button>
          </div>
          {!s.recentPurchases || s.recentPurchases.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No purchases yet</div>
          ) : s.recentPurchases.map((po: any, i: number) => {
            const statusColor = po.status === 'RECEIVED' ? '#16A34A' : po.status === 'ORDERED' ? '#1D4ED8' : '#EA580C'
            const statusBg = po.status === 'RECEIVED' ? '#F0FDF4' : po.status === 'ORDERED' ? '#EFF6FF' : '#FFF7ED'
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: i < s.recentPurchases.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{po.orderNumber}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>{po.supplierName} • {new Date(po.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>PKR {po.totalAmount.toLocaleString()}</div>
                  <span style={{ padding: '2px 8px', background: statusBg, color: statusColor, borderRadius: '99px', fontSize: '10px', fontWeight: 600 }}>{po.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Low Stock Alert */}
      {s.lowStockCount > 0 && (
        <div style={{ marginTop: '20px', padding: '14px 20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#DC2626' }}>Low Stock Alert</div>
              <div style={{ fontSize: '12px', color: '#EF4444' }}>{s.lowStockCount} product{s.lowStockCount > 1 ? 's' : ''} at or below minimum stock level</div>
            </div>
          </div>
          <button onClick={() => router.push('/erp/inventory')} style={{ padding: '8px 16px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            View Inventory →
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}