'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import { getTenantSlug } from '@/lib/getTenantSlug'

function getDefaultDates() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

export default function ProfitLossPage() {
  const [subdomain, setSubdomain] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const defaults = getDefaultDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchReport(sub, defaults.from, defaults.to)
  }, [])

  async function fetchReport(sub: string, f: string, t: string) {
    setLoading(true)
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/reports/profit-loss?from=${f}&to=${t}T23:59:59`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <TenantLayout
      title="Profit & Loss"
      subtitle="Revenue, cost, and gross profit overview"
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
        <div style={{ maxWidth: '600px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>

            <div style={{ padding: '20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Total Revenue</span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#16A34A' }}>PKR {(data?.totalRevenue || 0).toLocaleString()}</span>
            </div>

            <div style={{ padding: '20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Cost of Goods Sold (COGS)</span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#DC2626' }}>− PKR {(data?.totalCOGS || 0).toLocaleString()}</span>
            </div>

            <div style={{ padding: '20px', background: '#1E3A5F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Gross Profit</span>
                <div style={{ fontSize: '12px', color: '#93C5FD', marginTop: '2px' }}>Margin: {(data?.grossMargin || 0).toFixed(1)}%</div>
              </div>
              <span style={{ fontSize: '22px', fontWeight: 900, color: '#fff' }}>
                PKR {(data?.grossProfit || 0).toLocaleString()}
              </span>
            </div>

            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <span style={{ fontSize: '13px', color: '#64748B' }}>Total Stock Purchases (period)</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#EA580C' }}>PKR {(data?.totalPurchases || 0).toLocaleString()}</span>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '16px', lineHeight: 1.6 }}>
            💡 COGS is calculated using the purchase price of products sold via invoices in this period.
            Stock Purchases shows total spending on new inventory (separate from COGS, as not all purchased stock may have been sold yet).
          </p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}