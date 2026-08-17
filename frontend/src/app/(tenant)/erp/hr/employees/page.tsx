'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import Pagination from '@/components/common/Pagination'
import { getTenantSlug } from '@/lib/getTenantSlug'

const DEPARTMENTS = ['Management', 'Sales', 'Accounts', 'Operations', 'HR', 'IT', 'Warehouse', 'Other']
const DESIGNATIONS = ['Manager', 'Supervisor', 'Officer', 'Executive', 'Assistant', 'Intern', 'Director', 'Other']

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [meta, setMeta] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '', email: '', phone: '', cnic: '',
    department: '', designation: '',
    joiningDate: '', salary: '',
    status: 'ACTIVE',
  })

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchEmployees(sub)
  }, [])

  function getApi(sub: string) {
    return {
      get: (url: string) => axios.get(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      post: (url: string, data: any) => axios.post(`${process.env.NEXT_PUBLIC_API_URL}${url}`, data, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      put: (url: string, data: any) => axios.put(`${process.env.NEXT_PUBLIC_API_URL}${url}`, data, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
      delete: (url: string) => axios.delete(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { withCredentials: true, headers: { 'x-tenant-slug': sub } }),
    }
  }

  async function fetchEmployees(sub: string, searchTerm = '', p = 1, l = 25) {
    try {
      const res = await getApi(sub).get(`/erp/hr/employees?search=${searchTerm}&page=${p}&limit=${l}`)
      setEmployees(res.data.data)
      setMeta(res.data.meta)
    } catch {
      toast.error('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingEmployee(null)
    setForm({ name: '', email: '', phone: '', cnic: '', department: '', designation: '', joiningDate: '', salary: '', status: 'ACTIVE' })
    setShowModal(true)
  }

  function openEdit(emp: any) {
    setEditingEmployee(emp)
    setForm({
      name: emp.name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      cnic: emp.cnic || '',
      department: emp.department || '',
      designation: emp.designation || '',
      joiningDate: emp.joiningDate ? emp.joiningDate.split('T')[0] : '',
      salary: emp.salary?.toString() || '',
      status: emp.status || 'ACTIVE',
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { toast.error('Employee name is required'); return }
    setSubmitting(true)
    try {
      if (editingEmployee) {
        await getApi(subdomain).put(`/erp/hr/employees/${editingEmployee.id}`, form)
        toast.success('Employee updated')
      } else {
        await getApi(subdomain).post('/erp/hr/employees', form)
        toast.success('Employee created')
      }
      setShowModal(false)
      fetchEmployees(subdomain, search, page, limit)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save employee')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this employee?')) return
    try {
      await getApi(subdomain).delete(`/erp/hr/employees/${id}`)
      toast.success('Employee deleted')
      fetchEmployees(subdomain, search, page, limit)
    } catch {
      toast.error('Failed to delete')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #E2E8F0', borderRadius: '8px',
    fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, sans-serif', background: '#fff',
    boxSizing: 'border-box',
  }

  return (
    <TenantLayout
      title="Employees"
      subtitle="Manage your workforce"
      requiredModule="hr"
      headerRight={
        <div style={{ display: 'flex', gap: '8px' }}>
          <ExportButton
            data={employees}
            filename={`employees-${subdomain}`}
            title="Employees Report"
            subtitle={`${subdomain} ERP • ${new Date().toLocaleDateString()}`}
            columns={[
              { header: 'Code', value: (r) => r.employeeCode, width: 12 },
              { header: 'Name', value: (r) => r.name, width: 25 },
              { header: 'Email', value: (r) => r.email || '', width: 28 },
              { header: 'Phone', value: (r) => r.phone || '', width: 18 },
              { header: 'CNIC', value: (r) => r.cnic || '', width: 18 },
              { header: 'Department', value: (r) => r.department || '', width: 18 },
              { header: 'Designation', value: (r) => r.designation || '', width: 18 },
              { header: 'Salary (PKR)', value: (r) => parseFloat(r.salary || 0).toFixed(2), width: 15 },
              { header: 'Status', value: (r) => r.status, width: 10 },
            ]}
          />
          <button onClick={openCreate} style={{
            padding: '10px 18px', background: '#1E3A5F',
            color: '#fff', border: 'none', borderRadius: '10px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>➕ Add Employee</button>
        </div>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); setLoading(true); fetchEmployees(subdomain, search, 1, limit) }} style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, code or department..." style={{ flex: 1, padding: '10px 16px', border: '1.5px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
        <button type="submit" style={{ padding: '10px 20px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Search</button>
      </form>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : employees.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '80px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>👤</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No employees yet</h3>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px' }}>Add your first employee to get started</p>
          <button onClick={openCreate} style={{ padding: '10px 24px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>➕ Add First Employee</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Employee', 'Code', 'Department', 'Designation', 'Salary', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => (
                <tr key={emp.id} style={{ borderBottom: i < employees.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#1D4ED8' }}>{emp.name?.charAt(0)}</div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{emp.name}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>{emp.email || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#374151', background: '#F1F5F9', padding: '2px 8px', borderRadius: '6px' }}>{emp.employeeCode}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{emp.department || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{emp.designation || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>PKR {Number(emp.salary || 0).toLocaleString()}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                      background: emp.status === 'ACTIVE' ? '#F0FDF4' : '#FEF2F2',
                      color: emp.status === 'ACTIVE' ? '#16A34A' : '#DC2626',
                      border: `1px solid ${emp.status === 'ACTIVE' ? '#BBF7D0' : '#FECACA'}`,
                    }}>{emp.status}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => openEdit(emp)} style={{ padding: '6px 12px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Edit</button>
                      <button onClick={() => handleDelete(emp.id)} style={{ padding: '6px 12px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && (
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={limit}
          onPageChange={(p) => {
            setPage(p)
            setLoading(true)
            fetchEmployees(subdomain, search, p, limit)
          }}
          onLimitChange={(l) => {
            setLimit(l)
            setPage(1)
            setLoading(true)
            fetchEmployees(subdomain, search, 1, l)
          }}
        />
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '24px' }}>
              {editingEmployee ? '✏️ Edit Employee' : '➕ Add Employee'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Full Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ahmed Khan" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="employee@email.com" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92 300 0000000" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>CNIC</label>
                  <input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} placeholder="42101-1234567-1" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Joining Date</label>
                  <input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Department</label>
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} style={inputStyle}>
                    <option value="">Select...</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Designation</label>
                  <select value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} style={inputStyle}>
                    <option value="">Select...</option>
                    {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Monthly Salary (PKR)</label>
                  <input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="0" min="0" style={inputStyle} />
                </div>
                {editingEmployee && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="TERMINATED">Terminated</option>
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '12px', background: submitting ? '#94A3B8' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>{submitting ? 'Saving...' : (editingEmployee ? 'Update' : 'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}