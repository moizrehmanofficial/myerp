'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  PENDING:  { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
  APPROVED: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  REJECTED: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
}

export default function LeavePage() {
  const [activeTab, setActiveTab] = useState<'requests' | 'types' | 'balance'>('requests')
  const [requests, setRequests] = useState<any[]>([])
  const [leaveTypes, setLeaveTypes] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [meta, setMeta] = useState<any>(null)
  const [page, setPage] = useState(1)

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')

  // Leave balance
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [balance, setBalance] = useState<any[]>([])
  const [loadingBalance, setLoadingBalance] = useState(false)

  // Request modal
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [requestForm, setRequestForm] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  })

  // Leave type modal
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editingType, setEditingType] = useState<any>(null)
  const [typeForm, setTypeForm] = useState({ name: '', daysAllowed: '0', isPaid: true })
  const [savingType, setSavingType] = useState(false)

  // Reject modal
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchAll(sub)
  }, [])

  function getApi(sub: string) {
    return {
      get: (url: string) => axios.get(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      post: (url: string, data: any) => axios.post(`${process.env.NEXT_PUBLIC_API_URL}${url}`, data, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      put: (url: string, data: any) => axios.put(`${process.env.NEXT_PUBLIC_API_URL}${url}`, data, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      patch: (url: string, data: any) => axios.patch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, data, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      delete: (url: string) => axios.delete(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
    }
  }

  async function fetchAll(sub: string) {
    setLoading(true)
    try {
      const [reqRes, typRes, empRes] = await Promise.all([
        getApi(sub).get('/erp/hr/leave/requests?page=1&limit=25'),
        getApi(sub).get('/erp/hr/leave/types'),
        getApi(sub).get('/erp/hr/leave/employees'),
      ])
      setRequests(reqRes.data.data)
      setMeta(reqRes.data.meta)
      setLeaveTypes(typRes.data.data)
      setEmployees(empRes.data.data)
    } catch {
      toast.error('Failed to load leave data')
    } finally {
      setLoading(false)
    }
  }

  async function fetchRequests(sub: string, p = 1) {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(p), limit: '25',
        ...(filterStatus && { status: filterStatus }),
        ...(filterEmployee && { employeeId: filterEmployee }),
      })
      const res = await getApi(sub).get(`/erp/hr/leave/requests?${params}`)
      setRequests(res.data.data)
      setMeta(res.data.meta)
      setPage(p)
    } catch {
      toast.error('Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: string) {
    if (!confirm('Approve this leave request? Attendance will be updated automatically.')) return
    try {
      await getApi(subdomain).patch(`/erp/hr/leave/requests/${id}/approve`, {})
      toast.success('Leave approved — attendance updated!')
      fetchRequests(subdomain, page)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve')
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) { toast.error('Please provide a rejection reason'); return }
    try {
      await getApi(subdomain).patch(`/erp/hr/leave/requests/${id}/reject`, { reason: rejectReason })
      toast.success('Leave rejected')
      setRejectingId(null)
      setRejectReason('')
      fetchRequests(subdomain, page)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reject')
    }
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!requestForm.employeeId || !requestForm.leaveTypeId || !requestForm.startDate || !requestForm.endDate) {
      toast.error('Please fill all required fields')
      return
    }
    setSubmitting(true)
    try {
      await getApi(subdomain).post('/erp/hr/leave/requests', requestForm)
      toast.success('Leave request submitted!')
      setShowRequestModal(false)
      setRequestForm({ employeeId: '', leaveTypeId: '', startDate: '', endDate: '', reason: '' })
      fetchRequests(subdomain, 1)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveType(e: React.FormEvent) {
    e.preventDefault()
    if (!typeForm.name) { toast.error('Name required'); return }
    setSavingType(true)
    try {
      if (editingType) {
        await getApi(subdomain).put(`/erp/hr/leave/types/${editingType.id}`, typeForm)
        toast.success('Leave type updated')
      } else {
        await getApi(subdomain).post('/erp/hr/leave/types', typeForm)
        toast.success('Leave type created')
      }
      setShowTypeModal(false)
      setTypeForm({ name: '', daysAllowed: '0', isPaid: true })
      setEditingType(null)
      const res = await getApi(subdomain).get('/erp/hr/leave/types')
      setLeaveTypes(res.data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSavingType(false)
    }
  }

  async function handleDeleteType(id: string) {
    if (!confirm('Delete this leave type?')) return
    try {
      await getApi(subdomain).delete(`/erp/hr/leave/types/${id}`)
      toast.success('Leave type deleted')
      const res = await getApi(subdomain).get('/erp/hr/leave/types')
      setLeaveTypes(res.data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete')
    }
  }

  async function fetchBalance(empId: string) {
    setLoadingBalance(true)
    try {
      const res = await getApi(subdomain).get(`/erp/hr/leave/balance/${empId}?year=${new Date().getFullYear()}`)
      setBalance(res.data.data)
    } catch {
      toast.error('Failed to load balance')
    } finally {
      setLoadingBalance(false)
    }
  }

  // Calculate leave days preview
  const leaveDays = requestForm.startDate && requestForm.endDate
    ? Math.ceil((new Date(requestForm.endDate).getTime() - new Date(requestForm.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #E2E8F0', borderRadius: '8px',
    fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, sans-serif', background: '#fff',
    boxSizing: 'border-box',
  }

  const tabs = [
    { key: 'requests', label: '📋 Leave Requests' },
    { key: 'types', label: '⚙️ Leave Types' },
    { key: 'balance', label: '📊 Leave Balance' },
  ]

  return (
    <TenantLayout
      title="Leave Management"
      subtitle="Manage employee leave requests and policies"
      requiredModule="hr"
      headerRight={
        activeTab === 'requests' ? (
          <button onClick={() => setShowRequestModal(true)} style={{ padding: '10px 18px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            ➕ New Leave Request
          </button>
        ) : activeTab === 'types' ? (
          <button onClick={() => { setEditingType(null); setTypeForm({ name: '', daysAllowed: '0', isPaid: true }); setShowTypeModal(true) }} style={{ padding: '10px 18px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            ➕ Add Leave Type
          </button>
        ) : null
      }
    >
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F1F5F9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {tabs.map((tab) => (
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

      {loading && activeTab === 'requests' ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* ── REQUESTS TAB ── */}
          {activeTab === 'requests' && (
            <>
              {/* Filters */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#fff' }}>
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}
                  style={{ padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#fff', minWidth: '200px' }}>
                  <option value="">All Employees</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <button onClick={() => fetchRequests(subdomain, 1)} style={{ padding: '9px 18px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  🔍 Filter
                </button>
              </div>

              {requests.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No leave requests</h3>
                  <p style={{ color: '#94A3B8', fontSize: '13px' }}>Leave requests will appear here</p>
                </div>
              ) : (
                <>
                  <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                          {['Employee', 'Leave Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map((h) => (
                            <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map((req: any, i: number) => {
                          const ss = STATUS_STYLES[req.status] || STATUS_STYLES.PENDING
                          return (
                            <tr key={req.id} style={{ borderBottom: i < requests.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{req.employeeName}</div>
                                <div style={{ fontSize: '11px', color: '#94A3B8' }}>{req.department || ''}</div>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{req.leaveTypeName}</div>
                                <div style={{ fontSize: '11px', color: req.isPaid ? '#16A34A' : '#EA580C' }}>{req.isPaid ? 'Paid' : 'Unpaid'}</div>
                              </td>
                              <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>{new Date(req.startDate).toLocaleDateString()}</td>
                              <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>{new Date(req.endDate).toLocaleDateString()}</td>
                              <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 800, color: '#1E3A5F' }}>{req.totalDays}d</td>
                              <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason || '—'}</td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>
                                  {req.status}
                                </span>
                                {req.status === 'REJECTED' && req.rejectionReason && (
                                  <div style={{ fontSize: '10px', color: '#DC2626', marginTop: '2px' }} title={req.rejectionReason}>
                                    {req.rejectionReason.slice(0, 30)}...
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {req.status === 'PENDING' && (
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button onClick={() => handleApprove(req.id)} style={{ padding: '5px 10px', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>✓ Approve</button>
                                    <button onClick={() => { setRejectingId(req.id); setRejectReason('') }} style={{ padding: '5px 10px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>✕ Reject</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {meta && meta.totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '16px' }}>
                      <button onClick={() => fetchRequests(subdomain, page - 1)} disabled={page === 1} style={{ padding: '7px 14px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#CBD5E1' : '#374151', fontFamily: 'Inter, sans-serif' }}>← Prev</button>
                      <span style={{ padding: '7px 14px', fontSize: '13px', color: '#64748B' }}>Page {page} of {meta.totalPages} ({meta.total} total)</span>
                      <button onClick={() => fetchRequests(subdomain, page + 1)} disabled={page === meta.totalPages} style={{ padding: '7px 14px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', cursor: page === meta.totalPages ? 'not-allowed' : 'pointer', color: page === meta.totalPages ? '#CBD5E1' : '#374151', fontFamily: 'Inter, sans-serif' }}>Next →</button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── LEAVE TYPES TAB ── */}
          {activeTab === 'types' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {leaveTypes.map((lt: any) => (
                <div key={lt.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>{lt.name}</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ padding: '2px 8px', background: lt.isPaid ? '#F0FDF4' : '#FFF7ED', color: lt.isPaid ? '#16A34A' : '#EA580C', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>
                          {lt.isPaid ? '💰 Paid' : '📋 Unpaid'}
                        </span>
                        <span style={{ padding: '2px 8px', background: '#EFF6FF', color: '#1D4ED8', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>
                          {lt.daysAllowed > 0 ? `${lt.daysAllowed} days/year` : 'Unlimited'}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: '#1E3A5F' }}>{lt.requestCount}</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8' }}>requests</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setEditingType(lt); setTypeForm({ name: lt.name, daysAllowed: String(lt.daysAllowed), isPaid: lt.isPaid }); setShowTypeModal(true) }} style={{ flex: 1, padding: '8px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>✏️ Edit</button>
                    <button onClick={() => handleDeleteType(lt.id)} style={{ padding: '8px 12px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── BALANCE TAB ── */}
          {activeTab === 'balance' && (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, maxWidth: '300px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Select Employee</label>
                  <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#fff' }}>
                    <option value="">Select Employee...</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>)}
                  </select>
                </div>
                <button
                  onClick={() => selectedEmployee && fetchBalance(selectedEmployee)}
                  disabled={!selectedEmployee || loadingBalance}
                  style={{ padding: '10px 20px', background: !selectedEmployee ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: !selectedEmployee ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}
                >
                  {loadingBalance ? 'Loading...' : '📊 Check Balance'}
                </button>
              </div>

              {balance.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
                  {balance.map((b: any) => {
                    const pct = b.allowed > 0 ? Math.round((b.used / b.allowed) * 100) : 0
                    return (
                      <div key={b.leaveTypeId} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>{b.leaveTypeName}</div>
                            <span style={{ padding: '2px 8px', background: b.isPaid ? '#F0FDF4' : '#FFF7ED', color: b.isPaid ? '#16A34A' : '#EA580C', borderRadius: '99px', fontSize: '10px', fontWeight: 600 }}>
                              {b.isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                          </div>
                        </div>

                        {b.allowed > 0 ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ fontSize: '12px', color: '#64748B' }}>Used: <strong style={{ color: '#DC2626' }}>{b.used}d</strong></span>
                              <span style={{ fontSize: '12px', color: '#64748B' }}>Allowed: <strong>{b.allowed}d</strong></span>
                              <span style={{ fontSize: '12px', color: '#64748B' }}>Left: <strong style={{ color: '#16A34A' }}>{b.remaining}d</strong></span>
                            </div>
                            <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '99px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: pct >= 80 ? '#DC2626' : pct >= 50 ? '#EA580C' : '#16A34A', borderRadius: '99px', transition: 'width 0.5s ease' }} />
                            </div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', textAlign: 'right' }}>{pct}% used</div>
                          </>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#94A3B8', textAlign: 'center', padding: '8px 0' }}>
                            {b.used > 0 ? `${b.used} days taken` : 'No limit set'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── REQUEST MODAL ── */}
      {showRequestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '24px' }}>📋 New Leave Request</h3>
            <form onSubmit={handleSubmitRequest}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Employee *</label>
                  <select value={requestForm.employeeId} onChange={(e) => setRequestForm({ ...requestForm, employeeId: e.target.value })} style={inputStyle}>
                    <option value="">Select Employee...</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Leave Type *</label>
                  <select value={requestForm.leaveTypeId} onChange={(e) => setRequestForm({ ...requestForm, leaveTypeId: e.target.value })} style={inputStyle}>
                    <option value="">Select Leave Type...</option>
                    {leaveTypes.map((lt: any) => <option key={lt.id} value={lt.id}>{lt.name} ({lt.daysAllowed > 0 ? `${lt.daysAllowed} days/yr` : 'Unlimited'})</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Start Date *</label>
                    <input type="date" value={requestForm.startDate} onChange={(e) => setRequestForm({ ...requestForm, startDate: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>End Date *</label>
                    <input type="date" value={requestForm.endDate} onChange={(e) => setRequestForm({ ...requestForm, endDate: e.target.value })} style={inputStyle} />
                  </div>
                </div>
                {leaveDays > 0 && (
                  <div style={{ padding: '10px 14px', background: '#EFF6FF', borderRadius: '8px', fontSize: '13px', color: '#1D4ED8', fontWeight: 600 }}>
                    📅 Total: <strong>{leaveDays} day{leaveDays > 1 ? 's' : ''}</strong>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Reason</label>
                  <textarea value={requestForm.reason} onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })} placeholder="Reason for leave..." rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowRequestModal(false)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '12px', background: submitting ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── LEAVE TYPE MODAL ── */}
      {showTypeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '24px' }}>
              {editingType ? '✏️ Edit Leave Type' : '➕ Add Leave Type'}
            </h3>
            <form onSubmit={handleSaveType}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Type Name *</label>
                  <input value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="e.g. Annual Leave" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Days Allowed Per Year <span style={{ color: '#94A3B8', fontWeight: 400 }}>(0 = unlimited)</span></label>
                  <input type="number" value={typeForm.daysAllowed} onChange={(e) => setTypeForm({ ...typeForm, daysAllowed: e.target.value })} min="0" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Leave Category</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { value: true, label: '💰 Paid Leave' },
                      { value: false, label: '📋 Unpaid Leave' },
                    ].map((opt) => (
                      <button key={String(opt.value)} type="button" onClick={() => setTypeForm({ ...typeForm, isPaid: opt.value })} style={{
                        padding: '10px', border: `2px solid ${typeForm.isPaid === opt.value ? (opt.value ? '#16A34A' : '#EA580C') : '#E2E8F0'}`,
                        borderRadius: '8px', background: typeForm.isPaid === opt.value ? (opt.value ? '#F0FDF4' : '#FFF7ED') : '#F8FAFC',
                        color: typeForm.isPaid === opt.value ? (opt.value ? '#16A34A' : '#EA580C') : '#64748B',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      }}>{opt.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowTypeModal(false)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={savingType} style={{ flex: 1, padding: '12px', background: savingType ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: savingType ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {savingType ? 'Saving...' : (editingType ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REJECT MODAL ── */}
      {rejectingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#DC2626', marginBottom: '8px' }}>✕ Reject Leave Request</h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>Please provide a reason for rejection.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5', marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setRejectingId(null)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={() => handleReject(rejectingId)} style={{ flex: 1, padding: '12px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>✕ Reject</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}