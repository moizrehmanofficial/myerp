'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { getTenantSlug } from '@/lib/getTenantSlug'

function getDefaultDates() {
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  return { from, to }
}

export default function StockMovementReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
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
        `${process.env.NEXT_PUBLIC_API_URL}/erp/reports/stock-movement?from=${f}&to=${t}T23:59:59`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)
    } catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
  }

  function getTxStyle(type: string) {
    const isIn = type === 'IN' || type === 'ADJUSTMENT_IN'
    return { color: isIn ? '#16A34A' : '#DC2626', label: isIn ? '↑ IN' : '↓ OUT', sign: isIn ? '+' : '-' }
  }

  return (
    <TenantLayout
      title="Stock Movement Report"
      subtitle="All inventory transactions by date range"
      requiredModule="reports"
      headerRight={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
          <span style={{ color: '#94A3B8' }}>to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
          <button onClick={() => fetchReport(subdomain, from, to)}
            style={{ padding: '8px 16px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Apply</button>
          <ExportButton
            data={data?.movements || []}
            filename={`stock-movement-${from}-${to}`}
            title="Stock Movement Report"
            subtitle={`Period: ${from} to ${to}`}
            columns={[
              { header: 'Date', value: (r) => new Date(r.createdAt).toLocaleDateString(), width: 15 },
              { header: 'Product', value: (r) => r.productName, width: 25 },
              { header: 'SKU', value: (r) => r.productSku || '', width: 15 },
              { header: 'Type', value: (r) => r.type, width: 15 },
              { header: 'Quantity', value: (r) => Number(r.quantity || 0), width: 12 },
              { header: 'Reference', value: (r) => r.reference || '', width: 20 },
              { header: 'Notes', value: (r) => r.notes || '', width: 25 },
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
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px', maxWidth: '600px' }}>
            {[
              { label: 'Total Transactions', value: data?.summary?.totalTransactions || 0, color: '#1D4ED8' },
              { label: 'Total Stock IN', value: `+${(data?.summary?.totalIn || 0).toLocaleString()}`, color: '#16A34A' },
              { label: 'Total Stock OUT', value: `-${(data?.summary?.totalOut || 0).toLocaleString()}`, color: '#DC2626' },
            ].map((c) => (
              <div key={c.label} style={{ background: '#fff', borderRadius: '12px', padding: '14px', border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>{c.label}</p>
                <p style={{ fontSize: '18px', fontWeight: 800, color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          {(!data?.movements || data.movements.length === 0) ? (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
              <p style={{ color: '#94A3B8' }}>No stock movements in this period</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Date', 'Product', 'SKU', 'Type', 'Quantity', 'Reference', 'Notes'].map((h) => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.movements.map((tx: any, i: number) => {
                    const ts = getTxStyle(tx.type)
                    return (
                      <tr key={tx.id} style={{ borderBottom: i < data.movements.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{tx.productName}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#7C3AED', background: '#FAF5FF', padding: '2px 6px', borderRadius: '4px' }}>{tx.productSku}</span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, color: ts.color, background: ts.color === '#16A34A' ? '#F0FDF4' : '#FEF2F2' }}>{ts.label}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 800, color: ts.color }}>
                          {ts.sign}{Number(tx.quantity || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>{tx.reference || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>{tx.notes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}