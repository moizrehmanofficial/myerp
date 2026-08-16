'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'

function getDefaultDates() {
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  return { from, to }
}

export default function InvoiceReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const defaults = getDefaultDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchReport(sub, defaults.from, defaults.to, '')
  }, [])

  async function fetchReport(sub: string, f: string, t: string, s: string) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: f, to: `${t}T23:59:59`, ...(s && { status: s }) })
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/reports/invoices?${params}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)
    } catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
  }

  const s = data?.summary

  return (
    <TenantLayout
      title="Invoice Report"
      subtitle="Invoice summary with payment status"
      requiredModule="reports"
      headerRight={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
          <span style={{ color: '#94A3B8' }}>to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#fff' }}>
            <option value="">All Status</option>
            <option value="PAID">Paid</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIAL">Partial</option>
          </select>
          <button onClick={() => fetchReport(subdomain, from, to, status)}
            style={{ padding: '8px 16px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Apply</button>
          <ExportButton
            data={data?.invoices || []}
            filename={`invoice-report-${from}-${to}`}
            title="Invoice Report"
            subtitle={`Period: ${from} to ${to}`}
            columns={[
              { header: 'Invoice #', value: (r) => r.invoiceNumber, width: 15 },
              { header: 'Customer', value: (r) => r.customerName || '', width: 25 },
              { header: 'Date', value: (r) => new Date(r.createdAt).toLocaleDateString(), width: 15 },
              { header: 'Total (PKR)', value: (r) => Number(r.totalAmount || 0).toFixed(2), width: 15 },
              { header: 'Paid (PKR)', value: (r) => Number(r.paidAmount || 0).toFixed(2), width: 15 },
              { header: 'Due (PKR)', value: (r) => Number(r.dueAmount || 0).toFixed(2), width: 15 },
              { header: 'Status', value: (r) => r.paymentStatus, width: 12 },
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {[
              { label: 'Total Invoices', value: s?.totalInvoices || 0, color: '#1D4ED8', suffix: '' },
              { label: 'Total Amount', value: s?.totalAmount || 0, color: '#374151', suffix: 'PKR ' },
              { label: 'Total Paid', value: s?.totalPaid || 0, color: '#16A34A', suffix: 'PKR ' },
              { label: 'Total Due', value: s?.totalDue || 0, color: '#DC2626', suffix: 'PKR ' },
            ].map((c) => (
              <div key={c.label} style={{ background: '#fff', borderRadius: '12px', padding: '14px', border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>{c.label}</p>
                <p style={{ fontSize: '18px', fontWeight: 800, color: c.color }}>{c.suffix}{Number(c.value).toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: `Paid: ${s?.paidCount || 0}`, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
              { label: `Partial: ${s?.partialCount || 0}`, color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
              { label: `Unpaid: ${s?.unpaidCount || 0}`, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
            ].map((b) => (
              <span key={b.label} style={{ padding: '6px 14px', background: b.bg, color: b.color, border: `1px solid ${b.border}`, borderRadius: '99px', fontSize: '13px', fontWeight: 600 }}>{b.label}</span>
            ))}
          </div>

          {(!data?.invoices || data.invoices.length === 0) ? (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
              <p style={{ color: '#94A3B8' }}>No invoices in this period</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Invoice #', 'Customer', 'Date', 'Total', 'Paid', 'Due', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((inv: any, i: number) => {
                    const statusColor = inv.paymentStatus === 'PAID' ? '#16A34A' : inv.paymentStatus === 'PARTIAL' ? '#EA580C' : '#DC2626'
                    const statusBg = inv.paymentStatus === 'PAID' ? '#F0FDF4' : inv.paymentStatus === 'PARTIAL' ? '#FFF7ED' : '#FEF2F2'
                    return (
                      <tr key={inv.id} style={{ borderBottom: i < data.invoices.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#1E3A5F', background: '#EFF6FF', padding: '2px 8px', borderRadius: '6px' }}>{inv.invoiceNumber}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{inv.customerName}</td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>PKR {Number(inv.totalAmount || 0).toLocaleString()}</td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', color: '#16A34A' }}>PKR {Number(inv.paidAmount || 0).toLocaleString()}</td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: '#DC2626' }}>PKR {Number(inv.dueAmount || 0).toLocaleString()}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, color: statusColor, background: statusBg }}>{inv.paymentStatus}</span>
                        </td>
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