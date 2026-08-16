'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/axios'
import toast from 'react-hot-toast'
import AdminLayout from '@/components/layout/AdminLayout'

export default function BackupPage() {
  const [backups, setBackups] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<any>(null)

  useEffect(() => {
    fetchBackups()
    fetchCompanies()
  }, [])

  async function fetchBackups(p = 1) {
    setLoading(true)
    try {
      const res = await api.get(`/backups?page=${p}&limit=20`)
      setBackups(res.data.data)
      setMeta(res.data.meta)
      setPage(p)
    } catch {
      toast.error('Failed to load backups')
    } finally {
      setLoading(false)
    }
  }

  async function fetchCompanies() {
    try {
      const res = await api.get('/companies?limit=100')
      setCompanies(res.data.data || [])
    } catch {}
  }

  async function triggerBackup(slug: string) {
    if (!confirm(`Trigger manual backup for "${slug}"? This may take a few minutes.`)) return
    setTriggering(slug)
    try {
      await api.post(`/backups/company/${slug}`)
      toast.success(`Backup started for ${slug}!`)
      setTimeout(() => fetchBackups(), 2000)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Backup failed')
    } finally {
      setTriggering(null)
    }
  }

  async function downloadBackup(backupId: string) {
    try {
      const res = await api.get(`/backups/${backupId}/download`)
      window.open(res.data.data.url, '_blank')
    } catch {
      toast.error('Failed to get download link')
    }
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'SUCCESS': return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' }
      case 'FAILED':  return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' }
      case 'PENDING': return { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' }
      default:        return { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
    }
  }

  function getTypeStyle(type: string) {
    switch (type) {
      case 'MANUAL':  return { bg: '#EFF6FF', color: '#1D4ED8' }
      case 'DAILY':   return { bg: '#F0FDF4', color: '#16A34A' }
      case 'WEEKLY':  return { bg: '#FAF5FF', color: '#7C3AED' }
      case 'MONTHLY': return { bg: '#FFF7ED', color: '#EA580C' }
      default:        return { bg: '#F1F5F9', color: '#64748B' }
    }
  }

  return (
    <AdminLayout
      title="Backup Management"
      subtitle="Manage and monitor company database backups"
    >
      {/* Trigger Backup Section */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
          ⚡ Trigger Manual Backup
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
          {companies.map((company: any) => (
            <div key={company.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{company.name}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>{company.slug}</div>
              </div>
              <button
                onClick={() => triggerBackup(company.slug)}
                disabled={triggering === company.slug}
                style={{
                  padding: '6px 12px',
                  background: triggering === company.slug ? '#94A3B8' : '#1E3A5F',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  fontSize: '12px', fontWeight: 600,
                  cursor: triggering === company.slug ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {triggering === company.slug ? '...' : '💾 Backup'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Backup Logs */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>📋 Backup History</h3>
          <button onClick={() => fetchBackups()} style={{ padding: '6px 14px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : backups.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💾</div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No backups yet</h3>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>Trigger a manual backup above or wait for scheduled backups</p>
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Company', 'Type', 'Status', 'Size', 'Created', 'Completed', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.map((backup: any, i: number) => {
                  const ss = getStatusStyle(backup.status)
                  const ts = getTypeStyle(backup.type)
                  return (
                    <tr key={backup.id} style={{ borderBottom: i < backups.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{backup.company?.name}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>{backup.company?.slug}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ padding: '3px 10px', background: ts.bg, color: ts.color, borderRadius: '99px', fontSize: '11px', fontWeight: 700 }}>{backup.type}</span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ padding: '3px 10px', background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, borderRadius: '99px', fontSize: '11px', fontWeight: 700 }}>{backup.status}</span>
                        {backup.status === 'FAILED' && backup.errorMsg && (
                          <div style={{ fontSize: '10px', color: '#DC2626', marginTop: '3px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={backup.errorMsg}>
                            {backup.errorMsg}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>
                        {backup.fileSizeMb ? `${backup.fileSizeMb} MB` : '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>
                        {new Date(backup.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>
                        {backup.completedAt ? new Date(backup.completedAt).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {backup.status === 'SUCCESS' && backup.fileKey && (
                          <button
                            onClick={() => downloadBackup(backup.id)}
                            style={{ padding: '6px 12px', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                          >⬇️ Download</button>
                        )}
                        {backup.status === 'FAILED' && (
                          <button
                            onClick={() => triggerBackup(backup.company?.slug)}
                            style={{ padding: '6px 12px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                          >🔄 Retry</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '16px' }}>
                <button onClick={() => fetchBackups(page - 1)} disabled={page === 1}
                  style={{ padding: '7px 14px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#CBD5E1' : '#374151', fontFamily: 'Inter, sans-serif' }}>
                  ← Prev
                </button>
                <span style={{ padding: '7px 14px', fontSize: '13px', color: '#64748B' }}>
                  Page {page} of {meta.totalPages}
                </span>
                <button onClick={() => fetchBackups(page + 1)} disabled={page === meta.totalPages}
                  style={{ padding: '7px 14px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', cursor: page === meta.totalPages ? 'not-allowed' : 'pointer', color: page === meta.totalPages ? '#CBD5E1' : '#374151', fontFamily: 'Inter, sans-serif' }}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AdminLayout>
  )
}