'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { getTenantSlug } from '@/lib/getTenantSlug'

const TYPE_STYLES: Record<string, { color: string; bg: string }> = {
  ASSET:     { color: '#1D4ED8', bg: '#EFF6FF' },
  LIABILITY: { color: '#DC2626', bg: '#FEF2F2' },
  EQUITY:    { color: '#7C3AED', bg: '#FAF5FF' },
}

export default function BalanceSheetPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchReport(sub, new Date().toISOString().split('T')[0])
  }, [])

  async function fetchReport(sub: string, date: string) {
    setLoading(true)
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/reports/balance-sheet?asOf=${date}T23:59:59`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)
    } catch { toast.error('Failed to load balance sheet') }
    finally { setLoading(false) }
  }

  // Flatten for export
  const exportData = data ? [
    ...( data.assets || []).map((a: any) => ({ ...a, section: 'Assets' })),
    ...(data.liabilities || []).map((a: any) => ({ ...a, section: 'Liabilities' })),
    ...(data.equity || []).map((a: any) => ({ ...a, section: 'Equity' })),
  ] : []

  return (
    <TenantLayout
      title="Balance Sheet"
      subtitle="Financial position as of a date"
      requiredModule="reports"
      headerRight={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)}
            style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
          <button onClick={() => fetchReport(subdomain, asOf)}
            style={{ padding: '8px 16px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Apply
          </button>
          <ExportButton
            data={exportData}
            filename={`balance-sheet-${asOf}`}
            title={`Balance Sheet — As of ${asOf}`}
            subtitle={`${subdomain} ERP`}
            columns={[
              { header: 'Section', value: (r) => r.section, width: 15 },
              { header: 'Code', value: (r) => r.code, width: 10 },
              { header: 'Account', value: (r) => r.name, width: 30 },
              { header: 'Balance (PKR)', value: (r) => Number(r.balance || 0).toFixed(2), width: 18 },
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
        <div style={{ maxWidth: '800px' }}>
          {/* Balance check */}
          <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', background: data?.isBalanced ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${data?.isBalanced ? '#BBF7D0' : '#FECACA'}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: data?.isBalanced ? '#16A34A' : '#DC2626' }}>
              {data?.isBalanced ? '✓ Balance Sheet is Balanced' : '⚠ Balance Sheet is NOT Balanced'}
            </span>
            <span style={{ fontSize: '13px', color: '#64748B' }}>As of {asOf}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Assets */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: '#EFF6FF', borderBottom: '1px solid #BFDBFE' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1D4ED8' }}>Assets</h3>
              </div>
              <div style={{ padding: '0' }}>
                {(data?.assets || []).map((a: any) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #F8FAFC' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{a.name}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>{a.code}</div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1D4ED8' }}>PKR {Number(a.balance || 0).toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', background: '#EFF6FF' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#1D4ED8' }}>Total Assets</span>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: '#1D4ED8' }}>PKR {(data?.totalAssets || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Liabilities + Equity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Liabilities */}
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#DC2626' }}>Liabilities</h3>
                </div>
                {(data?.liabilities || []).map((a: any) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #F8FAFC' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{a.name}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>{a.code}</div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>PKR {Number(a.balance || 0).toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', background: '#FEF2F2' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>Total Liabilities</span>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#DC2626' }}>PKR {(data?.totalLiabilities || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Equity */}
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: '#FAF5FF', borderBottom: '1px solid #E9D5FF' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#7C3AED' }}>Equity</h3>
                </div>
                {(data?.equity || []).map((a: any) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #F8FAFC' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{a.name}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>{a.code}</div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#7C3AED' }}>PKR {Number(a.balance || 0).toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', background: '#FAF5FF' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#7C3AED' }}>Total Equity</span>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#7C3AED' }}>PKR {(data?.totalEquity || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Total L + E */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', background: '#1E3A5F', borderRadius: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Total Liabilities + Equity</span>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#fff' }}>PKR {((data?.totalLiabilities || 0) + (data?.totalEquity || 0)).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}