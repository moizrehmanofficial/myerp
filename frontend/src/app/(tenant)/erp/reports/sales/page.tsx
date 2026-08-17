'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
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

export default function SalesReportPage() {
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
        `${process.env.NEXT_PUBLIC_API_URL}/erp/reports/sales?from=${f}&to=${t}T23:59:59`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  function handleFilter() {
    fetchReport(subdomain, from, to)
  }

  const s = data?.summary

  return (
    <TenantLayout
      title="Sales Report"
      subtitle="Revenue breakdown and top performers"
      requiredModule="reports"
      headerRight={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
          <span style={{ color: '#94A3B8', fontSize: '13px' }}>to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
          <button onClick={handleFilter} style={{ padding: '8px 16px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Apply</button>
          <ExportButton
            data={data?.topProducts || []}
            filename={`sales-report-${from}-${to}`}
            title="Sales Report"
            subtitle={`Period: ${from} to ${to}`}
            columns={[
              { header: 'Product', value: (r) => r.name, width: 28 },
              { header: 'SKU', value: (r) => r.sku || '', width: 15 },
              { header: 'Qty Sold', value: (r) => r.totalQty, width: 12 },
              { header: 'Revenue (PKR)', value: (r) => parseFloat(r.totalRevenue || 0).toFixed(2), width: 18 },
            ]}
            disabled={!data}
          />
        </div>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Total Invoices', value: (s?.totalInvoices || 0).toLocaleString(), icon: '🧾', bg: '#EFF6FF', color: '#1D4ED8' },
              { label: 'Total Sales', value: `PKR ${(s?.totalSales || 0).toLocaleString()}`, icon: '💰', bg: '#F0FDF4', color: '#16A34A' },
              { label: 'Collected', value: `PKR ${(s?.totalCollected || 0).toLocaleString()}`, icon: '✓', bg: '#FAF5FF', color: '#7C3AED' },
              { label: 'Outstanding', value: `PKR ${(s?.totalDue || 0).toLocaleString()}`, icon: '⏳', bg: '#FEF2F2', color: '#DC2626' },
            ].map((c) => (
              <div key={c.label} style={{ background: '#fff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ width: '38px', height: '38px', background: c.bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '12px' }}>{c.icon}</div>
                <p style={{ fontSize: '18px', fontWeight: 800, color: c.color, marginBottom: '4px' }}>{c.value}</p>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{c.label}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Top Products */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>🏆 Top Selling Products</h3>
              </div>
              {(!data?.topProducts || data.topProducts.length === 0) ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No sales in this period</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {data.topProducts.map((p: any, i: number) => (
                      <tr key={i} style={{ borderBottom: i < data.topProducts.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                        <td style={{ padding: '12px 20px', fontSize: '12px', color: '#94A3B8', fontWeight: 700, width: '30px' }}>#{i + 1}</td>
                        <td style={{ padding: '12px 0' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>{p.sku} • Qty sold: {p.totalQty}</div>
                        </td>
                        <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>
                          PKR {p.totalRevenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top Customers */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>👥 Top Customers</h3>
              </div>
              {(!data?.topCustomers || data.topCustomers.length === 0) ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No sales in this period</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {data.topCustomers.map((c: any, i: number) => (
                      <tr key={i} style={{ borderBottom: i < data.topCustomers.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                        <td style={{ padding: '12px 20px', fontSize: '12px', color: '#94A3B8', fontWeight: 700, width: '30px' }}>#{i + 1}</td>
                        <td style={{ padding: '12px 0' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{c.name}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>{c.phone || ''} • {c.orderCount} orders</div>
                        </td>
                        <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#1D4ED8' }}>
                          PKR {c.totalSpent.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}