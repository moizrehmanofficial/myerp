'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { getTenantSlug } from '@/lib/getTenantSlug'

const MODULES = ['contacts', 'products', 'inventory', 'purchase', 'sales', 'invoices', 'finance', 'hr', 'payroll', 'users', 'auth', 'manufacturing', 'settings']
const ACTIONS = ['CREATED', 'UPDATED', 'DELETED', 'LOGIN', 'EXPORTED', 'APPROVED']

const ACTION_STYLES: Record<string, { bg: string; color: string }> = {
  CREATED:  { bg: '#F0FDF4', color: '#16A34A' },
  UPDATED:  { bg: '#EFF6FF', color: '#1D4ED8' },
  DELETED:  { bg: '#FEF2F2', color: '#DC2626' },
  LOGIN:    { bg: '#FAF5FF', color: '#7C3AED' },
  EXPORTED: { bg: '#FFF7ED', color: '#EA580C' },
  APPROVED: { bg: '#F0FDF4', color: '#16A34A' },
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<any>(null)

  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const [filters, setFilters] = useState({
    module: '',
    action: '',
    from: monthAgo,
    to: today,
  })

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchLogs(sub, 1, filters)
  }, [])

  async function fetchLogs(sub: string, p: number, f: typeof filters) {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '50',
        ...(f.module && { module: f.module }),
        ...(f.action && { action: f.action }),
        ...(f.from && { from: f.from }),
        ...(f.to && { to: f.to + 'T23:59:59' }),
      })
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/audit-logs?${params}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setLogs(res.data.data)
      setMeta(res.data.meta)
      setPage(p)
    } catch {
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  function handleFilter() {
    fetchLogs(subdomain, 1, filters)
  }

  function getActionStyle(action: string) {
    return ACTION_STYLES[action] || { bg: '#F1F5F9', color: '#64748B' }
  }

  return (
    <TenantLayout
      title="Audit Log"
      subtitle="Complete record of all system activities"
      requiredModule="settings"
      headerRight={
        <ExportButton
          data={logs}
          filename={`audit-log-${filters.from}-${filters.to}`}
          title="Audit Log Report"
          subtitle={`Period: ${filters.from} to ${filters.to}`}
          columns={[
            { header: 'Date', value: (r) => new Date(r.createdAt).toLocaleString(), width: 22 },
            { header: 'User', value: (r) => r.details?.userName || 'System', width: 20 },
            { header: 'Action', value: (r) => r.action, width: 12 },
            { header: 'Module', value: (r) => r.module, width: 15 },
            { header: 'Description', value: (r) => r.details?.description || '', width: 40 },
            { header: 'IP Address', value: (r) => r.ipAddress || '', width: 15 },
          ]}
          disabled={logs.length === 0}
        />
      }
    >
      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>From</label>
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>To</label>
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>Module</label>
          <select value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })} style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#fff' }}>
            <option value="">All Modules</option>
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>Action</label>
          <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} style={{ padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#fff' }}>
            <option value="">All Actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button onClick={handleFilter} style={{ padding: '9px 20px', background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          🔍 Apply Filter
        </button>
        {meta && (
          <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748B' }}>
            <strong style={{ color: '#0F172A' }}>{meta.total}</strong> total records
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : logs.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No audit logs found</h3>
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>Activities will appear here as users interact with the system</p>
        </div>
      ) : (
        <>
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Date & Time', 'User', 'Action', 'Module', 'Description', 'IP Address'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any, i: number) => {
                  const as = getActionStyle(log.action)
                  return (
                    <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                          {new Date(log.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                          {new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#1D4ED8' }}>
                            {(log.details?.userName || 'S')?.charAt(0)}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                            {log.details?.userName || 'System'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, background: as.bg, color: as.color }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#7C3AED', background: '#FAF5FF', padding: '2px 8px', borderRadius: '6px' }}>
                          {log.module}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>
                        {log.details?.description || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#94A3B8', fontFamily: 'monospace' }}>
                        {log.ipAddress || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
              <button
                onClick={() => fetchLogs(subdomain, page - 1, filters)}
                disabled={page === 1}
                style={{ padding: '8px 16px', background: page === 1 ? '#F1F5F9' : '#fff', color: page === 1 ? '#CBD5E1' : '#374151', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: page === 1 ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}
              >← Prev</button>

              {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                const p = Math.max(1, page - 2) + i
                if (p > meta.totalPages) return null
                return (
                  <button key={p} onClick={() => fetchLogs(subdomain, p, filters)} style={{ padding: '8px 14px', background: p === page ? '#1E3A5F' : '#fff', color: p === page ? '#fff' : '#374151', border: `1px solid ${p === page ? '#1E3A5F' : '#E2E8F0'}`, borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{p}</button>
                )
              })}

              <button
                onClick={() => fetchLogs(subdomain, page + 1, filters)}
                disabled={page === meta.totalPages}
                style={{ padding: '8px 16px', background: page === meta.totalPages ? '#F1F5F9' : '#fff', color: page === meta.totalPages ? '#CBD5E1' : '#374151', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: page === meta.totalPages ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}
              >Next →</button>

              <span style={{ fontSize: '13px', color: '#64748B', marginLeft: '8px' }}>
                Page {page} of {meta.totalPages}
              </span>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}