'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'

export default function AccountLedgerClient({ id }: { id: string }) {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchLedger(sub, monthAgo, today)
  }, [id])

  async function fetchLedger(sub: string, f: string, t: string) {
    setLoading(true)
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/finance/accounts/${id}/ledger?from=${f}&to=${t}T23:59:59`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)
    } catch {
      toast.error('Failed to load ledger')
    } finally {
      setLoading(false)
    }
  }

  const TYPE_COLORS: Record<string, string> = {
    ASSET: '#1D4ED8', LIABILITY: '#DC2626', EQUITY: '#7C3AED', INCOME: '#16A34A', EXPENSE: '#EA580C',
  }

  return (
    <TenantLayout
      title={data?.account?.name || 'Account Ledger'}
      subtitle={`Code: ${data?.account?.code || ''} • ${data?.account?.type || ''}`}
      requiredModule="finance"
      headerRight={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
          <span style={{ color: '#94A3B8' }}>to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
          <button onClick={() => fetchLedger(subdomain, from, to)} style={{ padding: '8px 14px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Apply</button>
          <button onClick={() => router.push('/erp/finance/accounts')} style={{ padding: '8px 14px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Back</button>
        </div>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Account Summary */}
          <div style={{ background: '#1E3A5F', borderRadius: '14px', padding: '20px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{data?.account?.name}</div>
              <div style={{ fontSize: '13px', color: '#93C5FD' }}>Code: {data?.account?.code} • Type: {data?.account?.type}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#93C5FD', marginBottom: '4px' }}>Current Balance</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#fff' }}>PKR {Number(data?.account?.balance || 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Entries Table */}
          {(!data?.entries || data.entries.length === 0) ? (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
              <p style={{ color: '#94A3B8', fontSize: '14px' }}>No transactions in this period</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Date', 'Entry No', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry: any, i: number) => (
                    <tr key={entry.id} style={{ borderBottom: i < data.entries.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748B' }}>
                        {new Date(entry.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '2px 8px', borderRadius: '6px' }}>{entry.entryNumber}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{entry.description}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#94A3B8', fontFamily: 'monospace' }}>{entry.reference || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#16A34A' }}>
                        {entry.debit > 0 ? `PKR ${entry.debit.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#DC2626' }}>
                        {entry.credit > 0 ? `PKR ${entry.credit.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: entry.runningBalance >= 0 ? '#0F172A' : '#DC2626' }}>
                        PKR {entry.runningBalance.toLocaleString()}
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