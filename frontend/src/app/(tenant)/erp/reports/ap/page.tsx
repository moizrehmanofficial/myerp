'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'

export default function APReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchReport(sub, new Date().toISOString().split('T')[0])
  }, [])

  async function fetchReport(sub: string, date: string) {
    setLoading(true)
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/reports/ap?asOf=${date}T23:59:59`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)
    } catch { toast.error('Failed to load AP report') }
    finally { setLoading(false) }
  }

  return (
    <TenantLayout
      title="Accounts Payable"
      subtitle="Outstanding amounts owed to suppliers"
      requiredModule="reports"
      headerRight={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)}
            style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
          <button onClick={() => fetchReport(subdomain, asOf)}
            style={{ padding: '8px 16px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Apply</button>
          <ExportButton
            data={data?.orders || []}
            filename={`ap-report-${asOf}`}
            title={`Accounts Payable — As of ${asOf}`}
            subtitle={`${subdomain} ERP`}
            columns={[
              { header: 'Order #', value: (r) => r.orderNumber, width: 15 },
              { header: 'Supplier', value: (r) => r.supplierName, width: 25 },
              { header: 'Date', value: (r) => new Date(r.createdAt).toLocaleDateString(), width: 15 },
              { header: 'Amount (PKR)', value: (r) => Number(r.totalAmount || 0).toFixed(2), width: 15 },
              { header: 'Age (Days)', value: (r) => r.ageDays, width: 12 },
              { header: 'Aging Bucket', value: (r) => r.agingBucket, width: 20 },
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total Payable', value: data?.summary?.total || 0, color: '#DC2626' },
              { label: 'Current (0-30)', value: data?.summary?.current || 0, color: '#16A34A' },
              { label: '31-60 Days', value: data?.summary?.days31_60 || 0, color: '#EA580C' },
              { label: '61-90 Days', value: data?.summary?.days61_90 || 0, color: '#DC2626' },
              { label: 'Over 90 Days', value: data?.summary?.over90 || 0, color: '#991B1B' },
            ].map((c) => (
              <div key={c.label} style={{ background: '#fff', borderRadius: '12px', padding: '14px', border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>{c.label}</p>
                <p style={{ fontSize: '16px', fontWeight: 800, color: c.color }}>PKR {Number(c.value).toLocaleString()}</p>
              </div>
            ))}
          </div>

          {(!data?.orders || data.orders.length === 0) ? (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#16A34A' }}>No outstanding payables!</h3>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Order #', 'Supplier', 'Date', 'Amount', 'Age', 'Bucket', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o: any, i: number) => (
                    <tr key={o.id} style={{ borderBottom: i < data.orders.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#EA580C', background: '#FFF7ED', padding: '2px 8px', borderRadius: '6px' }}>{o.orderNumber}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{o.supplierName}</td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>PKR {Number(o.totalAmount || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: o.ageDays > 60 ? '#DC2626' : '#EA580C' }}>{o.ageDays}d</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, color: o.ageDays <= 30 ? '#16A34A' : o.ageDays <= 60 ? '#EA580C' : '#DC2626', background: o.ageDays <= 30 ? '#F0FDF4' : o.ageDays <= 60 ? '#FFF7ED' : '#FEF2F2' }}>
                          {o.agingBucket}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '3px 8px', background: '#F1F5F9', color: '#374151', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>{o.status}</span>
                      </td>
                    </tr>
                  ))}
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