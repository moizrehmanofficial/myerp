'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import { getTenantSlug } from '@/lib/getTenantSlug'

const STATUS_OPTIONS = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE']

const STATUS_STYLES: Record<string, { bg: string; color: string; short: string }> = {
  PRESENT:  { bg: '#F0FDF4', color: '#16A34A', short: 'P' },
  ABSENT:   { bg: '#FEF2F2', color: '#DC2626', short: 'A' },
  HALF_DAY: { bg: '#FFF7ED', color: '#EA580C', short: 'H' },
  LEAVE:    { bg: '#EFF6FF', color: '#1D4ED8', short: 'L' },
}

export default function AttendancePage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [activeTab, setActiveTab] = useState<'mark' | 'summary'>('mark')
  const [saving, setSaving] = useState(false)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [selectedDate, setSelectedDate] = useState(now.toISOString().split('T')[0])

  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchAttendance(sub, month, year)
  }, [month, year])

  async function fetchAttendance(sub: string, m: number, y: number) {
    setLoading(true)
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/hr/attendance?month=${m}&year=${y}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)

      // Build map for selected date
      const map: Record<string, string> = {}
      res.data.data.records?.forEach((r: any) => {
        const d = r.date?.split('T')[0]
        if (d === selectedDate) {
          map[r.employeeId] = r.status
        }
      })
      setAttendanceMap(map)
    } catch {
      toast.error('Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  function updateStatus(empId: string, status: string) {
    setAttendanceMap((prev) => ({ ...prev, [empId]: status }))
  }

  async function saveBulkAttendance() {
    const records = Object.entries(attendanceMap).map(([employeeId, status]) => ({
      employeeId, status,
    }))

    if (records.length === 0) { toast.error('No attendance to save'); return }

    setSaving(true)
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/hr/attendance/bulk`,
        { date: selectedDate, records },
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } }
      )
      toast.success('Attendance saved!')
      fetchAttendance(subdomain, month, year)
    } catch {
      toast.error('Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  // Get all active employees from summary
  const employees = data?.summary || []

  return (
    <TenantLayout
      title="Attendance"
      subtitle="Track employee attendance"
      requiredModule="hr"
      headerRight={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={month} onChange={(e) => setMonth(+e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{new Date(2024, m - 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(+e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      }
    >
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F1F5F9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {[{ key: 'mark', label: '✏️ Mark Attendance' }, { key: 'summary', label: '📊 Monthly Summary' }].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none',
            background: activeTab === tab.key ? '#fff' : 'transparent',
            color: activeTab === tab.key ? '#0F172A' : '#64748B',
            fontSize: '13px', fontWeight: activeTab === tab.key ? 700 : 500,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>{tab.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Mark Attendance Tab */}
          {activeTab === 'mark' && (
            <>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Date</label>
                  <input type="date" value={selectedDate} onChange={(e) => {
                    setSelectedDate(e.target.value)
                    const map: Record<string, string> = {}
                    data?.records?.forEach((r: any) => {
                      if (r.date?.split('T')[0] === e.target.value) map[r.employeeId] = r.status
                    })
                    setAttendanceMap(map)
                  }} style={{ padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                  <button onClick={() => {
                    const map: Record<string, string> = {}
                    employees.forEach((emp: any) => map[emp.id] = 'PRESENT')
                    setAttendanceMap(map)
                  }} style={{ padding: '8px 14px', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    Mark All Present
                  </button>
                  <button onClick={saveBulkAttendance} disabled={saving} style={{ padding: '8px 20px', background: saving ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    {saving ? 'Saving...' : '💾 Save Attendance'}
                  </button>
                </div>
              </div>

              {employees.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
                  <p style={{ color: '#94A3B8' }}>No active employees found. Add employees first.</p>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        {['Employee', 'Code', 'Department', 'Status'].map((h) => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp: any, i: number) => {
                        const status = attendanceMap[emp.id] || ''
                        const ss = status ? STATUS_STYLES[status] : null
                        return (
                          <tr key={emp.id} style={{ borderBottom: i < employees.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                            <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{emp.name}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#F1F5F9', padding: '2px 8px', borderRadius: '6px' }}>{emp.employeeCode}</span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748B' }}>{emp.department || '—'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {STATUS_OPTIONS.map((s) => {
                                  const st = STATUS_STYLES[s]
                                  return (
                                    <button key={s} onClick={() => updateStatus(emp.id, s)} style={{
                                      padding: '6px 12px', borderRadius: '8px', border: `2px solid ${status === s ? st.color : '#E2E8F0'}`,
                                      background: status === s ? st.bg : '#F8FAFC',
                                      color: status === s ? st.color : '#94A3B8',
                                      fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                      fontFamily: 'Inter, sans-serif',
                                    }}>{st.short}</button>
                                  )
                                })}
                              </div>
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

          {/* Monthly Summary Tab */}
          {activeTab === 'summary' && (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Employee', 'Code', 'Present', 'Absent', 'Half Day', 'Leave'].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp: any, i: number) => (
                    <tr key={emp.id} style={{ borderBottom: i < employees.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{emp.name}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#F1F5F9', padding: '2px 8px', borderRadius: '6px' }}>{emp.employeeCode}</span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#16A34A' }}>{emp.present}</span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#DC2626' }}>{emp.absent}</span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#EA580C' }}>{emp.halfDay}</span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1D4ED8' }}>{emp.onLeave}</span>
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