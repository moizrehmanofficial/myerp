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

export default function CustomerLedgerReportPage() {
  const [data, setData] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [subdomain, setSubdomain] = useState('')
  const defaults = getDefaultDates()
  const [customerId, setCustomerId] = useState('')
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchCustomers(sub)
  }, [])

  async function fetchCustomers(sub: string) {
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/reports/customers-list`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setCustomers(res.data.data)
    } catch { toast.error('Failed to load customers') }
  }

  async function fetchReport() {
    if (!customerId) { toast.error('Select a customer'); return }
    setLoading(true)
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/reports/customer-ledger?customerId=${customerId}&from=${from}&to=${to}T23:59:59`,
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } }
      )
      setData(res.data.data)
    } catch { toast.error('Failed to load ledger') }
    finally { setLoading(false) }
  }

  return (
    <TenantLayout
      title="Customer Ledger"
      subtitle="Transaction history by customer"
      requiredModule="reports"
      headerRight={
        data && (
          <ExportButton
            data={data.entries || []}
            filename={`customer-ledger-${data.customer?.name}`}
            title={`Customer Ledger — ${data.customer?.name}`}
            subtitle={`Period: ${from} to ${to}`}
            columns={[
              { header: 'Date', value: (r) => new Date(r.date).toLocaleDateString(), width: 15 },
              { header: 'Reference', value: (r) => r.reference, width: 18 },
              { header: 'Type', value: (r) => r.type, width: 12 },
              { header: 'Debit (PKR)', value: (r) => Number(r.debit || 0).toFixed(2), width: 15 },
              { header: 'Credit (PKR)', value: (r) => Number(r.credit || 0).toFixed(2), width: 15 },
              { header: 'Balance (PKR)', value: (r) => Number(r.runningBalance || 0).toFixed(2), width: 15 },
            ]}
          />
        )
      }
    >
      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>Customer *</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#fff' }}>
            <option value="">Select Customer...</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '9px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '9px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
        </div>
        <button onClick={fetchReport} disabled={loading} style={{ padding: '9px 20px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          {loading ? 'Loading...' : '🔍 Generate'}
        </button>
      </div>

      {!data ? (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Select a customer and date range to generate ledger</p>
        </div>
      ) : (
        <>
          {/* Customer Summary */}
          <div style={{ background: '#1E3A5F', borderRadius: '14px', padding: '20px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{data.customer?.name}</div>
              <div style={{ fontSize: '13px', color: '#93C5FD' }}>{data.customer?.phone || ''} | Period: {from} to {to}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#93C5FD', marginBottom: '2px' }}>Closing Balance</div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: data.closingBalance >= 0 ? '#86EFAC' : '#FCA5A5' }}>
                PKR {Number(data.closingBalance || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {data.entries.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '40px', textAlign: 'center' }}>
              <p style={{ color: '#94A3B8' }}>No transactions in this period</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Date', 'Reference', 'Type', 'Status', 'Debit (PKR)', 'Credit (PKR)', 'Balance (PKR)'].map((h) => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry: any, i: number) => (
                    <tr key={i} style={{ borderBottom: i < data.entries.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>{new Date(entry.date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#1E3A5F', background: '#EFF6FF', padding: '2px 8px', borderRadius: '6px' }}>{entry.reference}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>{entry.type}</td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>{entry.status}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: '#DC2626' }}>
                        {entry.debit > 0 ? `PKR ${Number(entry.debit).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: '#16A34A' }}>
                        {entry.credit > 0 ? `PKR ${Number(entry.credit).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: entry.runningBalance >= 0 ? '#0F172A' : '#DC2626' }}>
                        PKR {Number(entry.runningBalance || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                    <td colSpan={4} style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>Totals</td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>PKR {data.totalDebit.toLocaleString()}</td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>PKR {data.totalCredit.toLocaleString()}</td>
                    <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 800, color: data.closingBalance >= 0 ? '#0F172A' : '#DC2626' }}>PKR {Number(data.closingBalance).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}