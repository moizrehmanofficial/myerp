'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'

export default function PayrollReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchReport(sub, now.getMonth() + 1, now.getFullYear())
  }, [])

  async function fetchReport(sub: string, m: number, y: number) {
    setLoading(true)
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/reports/payroll-report?month=${m}&year=${y}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)
    } catch { toast.error('Failed to load payroll report') }
    finally { setLoading(false) }
  }

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' })
  const s = data?.summary

  return (
    <TenantLayout
      title="Payroll Report"
      subtitle="Monthly salary summary"
      requiredModule="reports"
      headerRight={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={month} onChange={(e) => setMonth(+e.target.value)}
            style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#fff' }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{new Date(2024, m - 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(+e.target.value)}
            style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#fff' }}>
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => fetchReport(subdomain, month, year)}
            style={{ padding: '8px 16px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Apply</button>
          <ExportButton
            data={data?.payrolls || []}
            filename={`payroll-report-${monthName}-${year}`}
            title={`Payroll Report — ${monthName} ${year}`}
            subtitle={`${subdomain} ERP`}
            columns={[
              { header: 'Code', value: (r) => r.employeeCode, width: 12 },
              { header: 'Employee', value: (r) => r.employeeName, width: 25 },
              { header: 'Department', value: (r) => r.department || '', width: 18 },
              { header: 'Basic (PKR)', value: (r) => Number(r.basicSalary || 0).toFixed(2), width: 15 },
              { header: 'Allowances (PKR)', value: (r) => Number(r.allowances || 0).toFixed(2), width: 18 },
              { header: 'Deductions (PKR)', value: (r) => Number(r.deductions || 0).toFixed(2), width: 18 },
              { header: 'Tax (PKR)', value: (r) => Number(r.tax || 0).toFixed(2), width: 12 },
              { header: 'Net Salary (PKR)', value: (r) => Number(r.netSalary || 0).toFixed(2), width: 18 },
              { header: 'Status', value: (r) => r.status, width: 10 },
            ]}
            disabled={!data?.payrolls?.length}
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
          {s && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Employees', value: s.totalEmployees, color: '#1D4ED8', prefix: '' },
                { label: 'Total Basic', value: s.totalBasic, color: '#374151', prefix: 'PKR ' },
                { label: 'Total Allowances', value: s.totalAllowances, color: '#16A34A', prefix: 'PKR ' },
                { label: 'Total Deductions', value: s.totalDeductions, color: '#DC2626', prefix: 'PKR ' },
                { label: 'Total Net Payroll', value: s.totalNet, color: '#7C3AED', prefix: 'PKR ' },
              ].map((c) => (
                <div key={c.label} style={{ background: '#fff', borderRadius: '12px', padding: '14px', border: '1px solid #E2E8F0' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>{c.label}</p>
                  <p style={{ fontSize: '16px', fontWeight: 800, color: c.color }}>{c.prefix}{Number(c.value).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          {(!data?.payrolls || data.payrolls.length === 0) ? (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
              <p style={{ color: '#94A3B8' }}>No payroll generated for {monthName} {year}</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Code', 'Employee', 'Dept', 'Basic', 'Allowances', 'Deductions', 'Tax', 'Net Salary', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '12px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.payrolls.map((p: any, i: number) => (
                    <tr key={p.id} style={{ borderBottom: i < data.payrolls.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>{p.employeeCode}</span>
                      </td>
                      <td style={{ padding: '12px 12px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{p.employeeName}</td>
                      <td style={{ padding: '12px 12px', fontSize: '12px', color: '#64748B' }}>{p.department || '—'}</td>
                      <td style={{ padding: '12px 12px', fontSize: '12px', color: '#374151' }}>{Number(p.basicSalary || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px 12px', fontSize: '12px', color: '#16A34A' }}>{Number(p.allowances || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px 12px', fontSize: '12px', color: '#DC2626' }}>{Number(p.deductions || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px 12px', fontSize: '12px', color: '#EA580C' }}>{Number(p.tax || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px 12px', fontSize: '13px', fontWeight: 800, color: '#7C3AED' }}>PKR {Number(p.netSalary || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: p.status === 'PAID' ? '#F0FDF4' : '#FFF7ED', color: p.status === 'PAID' ? '#16A34A' : '#EA580C' }}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#1E3A5F' }}>
                    <td colSpan={3} style={{ padding: '12px 12px', fontSize: '13px', fontWeight: 700, color: '#fff' }}>TOTAL</td>
                    <td style={{ padding: '12px 12px', fontSize: '12px', fontWeight: 700, color: '#fff' }}>{(s?.totalBasic || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 12px', fontSize: '12px', fontWeight: 700, color: '#86EFAC' }}>{(s?.totalAllowances || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 12px', fontSize: '12px', fontWeight: 700, color: '#FCA5A5' }}>{(s?.totalDeductions || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 12px', fontSize: '12px', fontWeight: 700, color: '#FCA5A5' }}>{(s?.totalTax || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 12px', fontSize: '14px', fontWeight: 900, color: '#C4B5FD' }}>PKR {(s?.totalNet || 0).toLocaleString()}</td>
                    <td />
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