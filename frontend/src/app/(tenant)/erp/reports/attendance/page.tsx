'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'

export default function AttendanceReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [department, setDepartment] = useState('')

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchReport(sub, now.getMonth() + 1, now.getFullYear(), '')
  }, [])

  async function fetchReport(sub: string, m: number, y: number, dept: string) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ month: String(m), year: String(y), ...(dept && { department: dept }) })
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/reports/attendance?${params}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)
    } catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
  }

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' })

  return (
    <TenantLayout
      title="Attendance Report"
      subtitle="Monthly attendance summary by employee"
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
          <button onClick={() => fetchReport(subdomain, month, year, department)}
            style={{ padding: '8px 16px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Apply</button>
          <ExportButton
            data={data?.employees || []}
            filename={`attendance-${monthName}-${year}`}
            title={`Attendance Report — ${monthName} ${year}`}
            subtitle={`${subdomain} ERP`}
            columns={[
              { header: 'Code', value: (r) => r.employeeCode, width: 12 },
              { header: 'Employee', value: (r) => r.name, width: 25 },
              { header: 'Department', value: (r) => r.department || '', width: 18 },
              { header: 'Present', value: (r) => r.present, width: 10 },
              { header: 'Absent', value: (r) => r.absent, width: 10 },
              { header: 'Half Day', value: (r) => r.halfDay, width: 10 },
              { header: 'On Leave', value: (r) => r.onLeave, width: 10 },
              { header: 'Rate %', value: (r) => r.attendanceRate, width: 10 },
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
          <div style={{ padding: '12px 16px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', color: '#1D4ED8', fontWeight: 600 }}>
            📅 {monthName} {year} — {data?.daysInMonth} working days
          </div>

          {(!data?.employees || data.employees.length === 0) ? (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
              <p style={{ color: '#94A3B8' }}>No employees found</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Code', 'Employee', 'Department', 'Present', 'Absent', 'Half Day', 'On Leave', 'Rate'].map((h) => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((emp: any, i: number) => (
                    <tr key={emp.id} style={{ borderBottom: i < data.employees.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>{emp.employeeCode}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{emp.name}</td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>{emp.department || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 700, color: '#16A34A' }}>{emp.present}</td>
                      <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 700, color: '#DC2626' }}>{emp.absent}</td>
                      <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 700, color: '#EA580C' }}>{emp.halfDay}</td>
                      <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 700, color: '#1D4ED8' }}>{emp.onLeave}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', background: '#E2E8F0', borderRadius: '99px', overflow: 'hidden', maxWidth: '60px' }}>
                            <div style={{ height: '100%', width: `${emp.attendanceRate}%`, background: emp.attendanceRate >= 80 ? '#16A34A' : emp.attendanceRate >= 60 ? '#EA580C' : '#DC2626', borderRadius: '99px' }} />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: emp.attendanceRate >= 80 ? '#16A34A' : emp.attendanceRate >= 60 ? '#EA580C' : '#DC2626' }}>{emp.attendanceRate}%</span>
                        </div>
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