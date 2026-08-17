'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import { getTenantSlug } from '@/lib/getTenantSlug'

export default function StockReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const sub = getTenantSlug()
    fetchReport(sub)
  }, [])

  async function fetchReport(sub: string) {
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/reports/stock`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const filtered = data?.products?.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  ) || []

  const s = data?.summary

  return (
    <TenantLayout
      title="Stock Report"
      subtitle="Current inventory valuation"
      requiredModule="reports"
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Total Products', value: (s?.totalProducts || 0).toLocaleString(), bg: '#EFF6FF', color: '#1D4ED8' },
              { label: 'Total Units', value: (s?.totalUnits || 0).toLocaleString(), bg: '#F0FDF4', color: '#16A34A' },
              { label: 'Cost Value', value: `PKR ${(s?.totalCostValue || 0).toLocaleString()}`, bg: '#FFF7ED', color: '#EA580C' },
              { label: 'Potential Sale Value', value: `PKR ${(s?.totalSaleValue || 0).toLocaleString()}`, bg: '#FAF5FF', color: '#7C3AED' },
            ].map((c) => (
              <div key={c.label} style={{ background: '#fff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: '18px', fontWeight: 800, color: c.color, marginBottom: '4px' }}>{c.value}</p>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{c.label}</p>
              </div>
            ))}
          </div>

          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            style={{ width: '320px', padding: '10px 16px', border: '1.5px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif', marginBottom: '16px' }}
          />

          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Product', 'SKU', 'Category', 'Stock', 'Cost Price', 'Sale Price', 'Stock Value'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any, i: number) => (
                  <tr key={p.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{p.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', color: '#7C3AED', fontFamily: 'monospace', background: '#FAF5FF', padding: '2px 8px', borderRadius: '6px' }}>{p.sku}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748B' }}>{p.categoryName || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{parseFloat(p.stock || 0).toLocaleString()} {p.unit}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748B' }}>PKR {parseFloat(p.purchasePrice || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#16A34A' }}>PKR {parseFloat(p.salePrice || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: '#374151' }}>
                      PKR {(parseFloat(p.stock || 0) * parseFloat(p.purchasePrice || 0)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}