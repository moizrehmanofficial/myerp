'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'

export default function PayrollPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [subdomain, setSubdomain] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [generatingSlip, setGeneratingSlip] = useState<string | null>(null)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchPayroll(sub, now.getMonth() + 1, now.getFullYear())
  }, [])

  async function fetchPayroll(sub: string, m: number, y: number) {
    setLoading(true)
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/hr/payroll?month=${m}&year=${y}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setData(res.data.data)
    } catch {
      toast.error('Failed to load payroll')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    if (!confirm(`Generate payroll for ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}? This will calculate salaries based on attendance.`)) return
    setGenerating(true)
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/hr/payroll/generate`,
        { month, year },
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } }
      )
      toast.success(res.data.message)
      fetchPayroll(subdomain, month, year)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate payroll')
    } finally {
      setGenerating(false)
    }
  }

  async function handleUpdate(id: string) {
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/hr/payroll/${id}`,
        editForm,
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } }
      )
      toast.success('Payroll updated')
      setEditingId(null)
      fetchPayroll(subdomain, month, year)
    } catch {
      toast.error('Failed to update')
    }
  }

  async function handleGenerateSlip(payrollId: string) {
    setGeneratingSlip(payrollId)
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/hr/payroll/${payrollId}/generate-slip`,
        {},
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } }
      )
      toast.success(`Salary slip generated for ${res.data.data.employeeName}!`)
      window.open(res.data.data.downloadUrl, '_blank')
      fetchPayroll(subdomain, month, year)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate slip')
    } finally {
      setGeneratingSlip(null)
    }
  }

  async function handleDownloadSlip(payrollId: string) {
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/hr/payroll/${payrollId}/slip-url`,
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } }
      )
      window.open(res.data.data.downloadUrl, '_blank')
    } catch {
      toast.error('Slip not generated yet. Click Generate first.')
    }
  }

  async function handleBulkGenerate() {
    if (!confirm(`Generate salary slips for ALL employees for ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}?`)) return
    setGenerating(true)
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/hr/payroll/bulk-slips`,
        { month, year },
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } }
      )
      toast.success(res.data.message)
      fetchPayroll(subdomain, month, year)
    } catch {
      toast.error('Failed to generate bulk slips')
    } finally {
      setGenerating(false)
    }
  }

  const s = data?.summary
  const payrolls = data?.payrolls || []

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 8px',
    border: '1.5px solid #E2E8F0', borderRadius: '6px',
    fontSize: '12px', outline: 'none',
    fontFamily: 'Inter, sans-serif', background: '#fff',
    boxSizing: 'border-box',
  }

  return (
    <TenantLayout
      title="Payroll"
      subtitle="Monthly salary processing"
      requiredModule="hr"
      headerRight={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={month} onChange={(e) => { setMonth(+e.target.value); fetchPayroll(subdomain, +e.target.value, year) }}
            style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{new Date(2024, m - 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => { setYear(+e.target.value); fetchPayroll(subdomain, month, +e.target.value) }}
            style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <ExportButton
            data={payrolls}
            filename={`payroll-${month}-${year}`}
            title={`Payroll Report — ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`}
            subtitle={`${subdomain} ERP`}
            columns={[
              { header: 'Code', value: (r) => r.employeeCode, width: 12 },
              { header: 'Employee', value: (r) => r.employeeName, width: 25 },
              { header: 'Department', value: (r) => r.department || '', width: 18 },
              { header: 'Basic (PKR)', value: (r) => parseFloat(r.basicSalary || 0).toFixed(2), width: 15 },
              { header: 'Allowances (PKR)', value: (r) => parseFloat(r.allowances || 0).toFixed(2), width: 18 },
              { header: 'Deductions (PKR)', value: (r) => parseFloat(r.deductions || 0).toFixed(2), width: 18 },
              { header: 'Tax (PKR)', value: (r) => parseFloat(r.tax || 0).toFixed(2), width: 12 },
              { header: 'Net Salary (PKR)', value: (r) => parseFloat(r.netSalary || 0).toFixed(2), width: 18 },
              { header: 'Status', value: (r) => r.status, width: 10 },
            ]}
            disabled={payrolls.length === 0}
          />
          <button onClick={handleBulkGenerate} disabled={generating || payrolls.length === 0} style={{
            padding: '8px 18px', background: payrolls.length === 0 ? '#94A3B8' : '#7C3AED',
            color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px',
            fontWeight: 600, cursor: payrolls.length === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>📄 Generate All Slips</button>
          <button onClick={handleGenerate} disabled={generating} style={{
            padding: '8px 18px', background: generating ? '#94A3B8' : '#1E3A5F',
            color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px',
            fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
          }}>{generating ? 'Generating...' : '⚡ Generate Payroll'}</button>
        </div>
      }
    >
      {/* Summary */}
      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Employees', value: s.totalEmployees, icon: '👤', color: '#1D4ED8', bg: '#EFF6FF' },
            { label: 'Basic Salary', value: `PKR ${s.totalBasic?.toLocaleString()}`, icon: '💰', color: '#374151', bg: '#F1F5F9' },
            { label: 'Allowances', value: `PKR ${s.totalAllowances?.toLocaleString()}`, icon: '➕', color: '#16A34A', bg: '#F0FDF4' },
            { label: 'Deductions', value: `PKR ${s.totalDeductions?.toLocaleString()}`, icon: '➖', color: '#DC2626', bg: '#FEF2F2' },
            { label: 'Net Payroll', value: `PKR ${s.totalPayroll?.toLocaleString()}`, icon: '✓', color: '#7C3AED', bg: '#FAF5FF' },
          ].map((c) => (
            <div key={c.label} style={{ background: '#fff', borderRadius: '12px', padding: '14px', border: '1px solid #E2E8F0' }}>
              <div style={{ width: '32px', height: '32px', background: c.bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', marginBottom: '8px' }}>{c.icon}</div>
              <p style={{ fontSize: '14px', fontWeight: 800, color: c.color, marginBottom: '2px' }}>{c.value}</p>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8' }}>{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : payrolls.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '80px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💵</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No payroll generated</h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>Click "Generate Payroll" to calculate salaries for this month</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Employee', 'Dept', 'Basic', 'Allowances', 'Deductions', 'Tax', 'Net Salary', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payrolls.map((p: any, i: number) => {
                const isEditing = editingId === p.id
                return (
                  <tr key={p.id} style={{ borderBottom: i < payrolls.length - 1 ? '1px solid #F1F5F9' : 'none', background: isEditing ? '#F8FAFC' : 'transparent' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{p.employeeName}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>{p.employeeCode}</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>{p.department || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {isEditing ? <input type="number" value={editForm.basicSalary} onChange={(e) => setEditForm({ ...editForm, basicSalary: e.target.value })} style={{ ...inputStyle, width: '90px' }} /> : <span style={{ fontSize: '13px', fontWeight: 600 }}>{Number(p.basicSalary || 0).toLocaleString()}</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {isEditing ? <input type="number" value={editForm.allowances} onChange={(e) => setEditForm({ ...editForm, allowances: e.target.value })} style={{ ...inputStyle, width: '80px' }} /> : <span style={{ fontSize: '13px', color: '#16A34A', fontWeight: 600 }}>{Number(p.allowances || 0).toLocaleString()}</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {isEditing ? <input type="number" value={editForm.deductions} onChange={(e) => setEditForm({ ...editForm, deductions: e.target.value })} style={{ ...inputStyle, width: '80px' }} /> : <span style={{ fontSize: '13px', color: '#DC2626', fontWeight: 600 }}>{Number(p.deductions || 0).toLocaleString()}</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {isEditing ? <input type="number" value={editForm.tax} onChange={(e) => setEditForm({ ...editForm, tax: e.target.value })} style={{ ...inputStyle, width: '70px' }} /> : <span style={{ fontSize: '13px', color: '#EA580C' }}>{Number(p.tax || 0).toLocaleString()}</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 800, color: '#7C3AED' }}>
                      PKR {Number(p.netSalary || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {isEditing ? (
                        <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} style={{ ...inputStyle, width: '100px' }}>
                          <option value="PENDING">Pending</option>
                          <option value="PAID">Paid</option>
                        </select>
                      ) : (
                        <span style={{
                          padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                          background: p.status === 'PAID' ? '#F0FDF4' : '#FFF7ED',
                          color: p.status === 'PAID' ? '#16A34A' : '#EA580C',
                          border: `1px solid ${p.status === 'PAID' ? '#BBF7D0' : '#FED7AA'}`,
                        }}>{p.status}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handleUpdate(p.id)} style={{ padding: '5px 10px', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Save</button>
                          <button onClick={() => setEditingId(null)} style={{ padding: '5px 10px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <button onClick={() => {
                            setEditingId(p.id)
                            setEditForm({ basicSalary: p.basicSalary, allowances: p.allowances, deductions: p.deductions, tax: p.tax, status: p.status })
                          }} style={{ padding: '5px 10px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Edit</button>
                          <button
                            onClick={() => handleGenerateSlip(p.id)}
                            disabled={generatingSlip === p.id}
                            style={{ padding: '5px 10px', background: '#FAF5FF', color: '#7C3AED', border: '1px solid #E9D5FF', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: generatingSlip === p.id ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}
                          >
                            {generatingSlip === p.id ? '...' : '📄 Slip'}
                          </button>
                          {p.slipUrl && (
                            <button
                              onClick={() => handleDownloadSlip(p.id)}
                              style={{ padding: '5px 10px', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                            >⬇️</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}