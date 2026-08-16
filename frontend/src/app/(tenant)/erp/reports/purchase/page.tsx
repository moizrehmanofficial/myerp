'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'

function getDefaultDates() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

export default function PurchaseReportPage() {
  const [subdomain, setSubdomain] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const defaults = getDefaultDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchReport(sub, defaults.from, defaults.to)
  }, [])

  async function fetchReport(sub: string, f: string, t: string) {
    setLoading(true)
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/reports/purchase?from=${f}&to=${t}T23:59:59`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const s = data?.summary

  return (
    <TenantLayout
      title="Purchase Report"
      subtitle="Stock buying overview by supplier"
      requiredModule="reports"
      headerRight={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
          <span style={{ color: '#94A3B8', fontSize: '13px' }}>to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
          <button onClick={() => fetchReport(subdomain, from, to)} style={{ padding: '8px 16px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Apply</button>
        </div>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px', maxWidth: '600px' }}>
            <div style={{ background: '#fff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #E2E8F0' }}>
              <div style={{ width: '38px', height: '38px', background: '#EFF6FF', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '12px' }}>🛒</div>
              <p style={{ fontSize: '20px', fontWeight: 800, color: '#1D4ED8', marginBottom: '4px' }}>{(s?.totalOrders || 0).toLocaleString()}</p>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Total Purchase Orders</p>
            </div>
            <div style={{ background: '#fff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #E2E8F0' }}>
              <div style={{ width: '38px', height: '38px', background: '#FFF7ED', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '12px' }}>💰</div>
              <p style={{ fontSize: '20px', fontWeight: 800, color: '#EA580C', marginBottom: '4px' }}>PKR {(s?.totalPurchases || 0).toLocaleString()}</p>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Total Spent on Stock</p>
            </div>
          </div>

          {/* By Supplier */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', maxWidth: '700px' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>🏭 Spending by Supplier</h3>
            </div>
            {(!data?.bySupplier || data.bySupplier.length === 0) ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No purchases in this period</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {data.bySupplier.map((sup: any, i: number) => (
                    <tr key={i} style={{ borderBottom: i < data.bySupplier.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                      <td style={{ padding: '12px 20px', fontSize: '12px', color: '#94A3B8', fontWeight: 700, width: '30px' }}>#{i + 1}</td>
                      <td style={{ padding: '12px 0' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{sup.name}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>{sup.phone || ''} • {sup.orderCount} orders</div>
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#EA580C' }}>
                        PKR {sup.totalSpent.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}