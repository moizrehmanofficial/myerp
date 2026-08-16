'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/axios'
import toast, { Toaster } from 'react-hot-toast'

const SIDEBAR_WIDTH = 240

export default function CompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activePath, setActivePath] = useState('/companies')
  const [admin, setAdmin] = useState<any>(null)

  useEffect(() => {
    fetchProfile()
    fetchCompanies()
  }, [])

  async function fetchProfile() {
  try {
    const res = await api.get('/super-admin/me')
    setAdmin(res.data.data)
  } catch (err: any) {
    if (err?.response?.status === 401) {
      router.push('/login')
    }
  }
}

  async function fetchCompanies() {
    try {
      const res = await api.get('/companies')
      setCompanies(res.data.data)
    } catch {
      toast.error('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }

  async function handleSuspend(id: string) {
    setActionLoading(id)
    try {
      await api.patch(`/companies/${id}/suspend`)
      toast.success('Company suspended')
      fetchCompanies()
    } catch {
      toast.error('Failed to suspend company')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleActivate(id: string) {
    setActionLoading(id)
    try {
      await api.patch(`/companies/${id}/activate`)
      toast.success('Company activated')
      fetchCompanies()
    } catch {
      toast.error('Failed to activate company')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this company?')) return
    setActionLoading(id)
    try {
      await api.delete(`/companies/${id}`)
      toast.success('Company deleted')
      fetchCompanies()
    } catch {
      toast.error('Failed to delete company')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleLogout() {
    try {
      await api.post('/auth/logout')
      router.push('/login')
    } catch {
      router.push('/login')
    }
  }

  function navigate(path: string) {
    setActivePath(path)
    router.push(path)
  }

  const navItems = [
    { label: 'Dashboard', icon: '📊', path: '/dashboard' },
    { label: 'Companies', icon: '🏢', path: '/companies' },
    { label: 'Modules', icon: '📦', path: '/modules' },
    { label: 'Users', icon: '👥', path: '/users' },
    { label: 'Settings', icon: '⚙️', path: '/settings' },
  ]

  function getStatusStyle(status: string) {
    switch (status) {
      case 'ACTIVE':
        return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' }
      case 'SUSPENDED':
        return { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' }
      case 'DELETED':
        return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' }
      default:
        return { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
    }
  }

  function getPlanStyle(plan: string) {
    switch (plan) {
      case 'ENTERPRISE':
        return { bg: '#FAF5FF', color: '#7C3AED' }
      case 'PROFESSIONAL':
        return { bg: '#EFF6FF', color: '#1D4ED8' }
      case 'STARTER':
        return { bg: '#F0FDF4', color: '#16A34A' }
      default:
        return { bg: '#F1F5F9', color: '#64748B' }
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, sans-serif', background: '#F8FAFC' }}>
      <Toaster position="top-right" />

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: `${SIDEBAR_WIDTH}px`, minHeight: '100vh',
        background: '#1E3A5F', position: 'fixed',
        left: 0, top: 0, display: 'flex', flexDirection: 'column', zIndex: 100,
      }}>
        <div style={{
          padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div style={{
            width: '38px', height: '38px', background: 'rgba(255,255,255,0.15)',
            borderRadius: '10px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '18px',
          }}>🛡️</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', lineHeight: 1 }}>MyERP</div>
            <div style={{ color: '#93C5FD', fontSize: '11px', marginTop: '3px' }}>Super Admin</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px' }}>
          <p style={{ color: '#64748B', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px', marginBottom: '8px' }}>
            Navigation
          </p>
          {navItems.map((item) => {
            const isActive = activePath === item.path
            return (
              <button key={item.path} onClick={() => navigate(item.path)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '10px', border: 'none',
                cursor: 'pointer', marginBottom: '4px',
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: isActive ? '#fff' : '#94A3B8',
                fontSize: '14px', fontWeight: isActive ? 600 : 400,
                fontFamily: 'Inter, sans-serif', textAlign: 'left', transition: 'all 0.15s',
              }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.color = '#fff'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#94A3B8'
                  }
                }}
              >
                <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                {item.label}
                {isActive && <span style={{ marginLeft: 'auto', fontSize: '12px' }}>›</span>}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', marginBottom: '8px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%', background: '#2E86AB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '14px',
            }}>{admin?.name?.charAt(0) || 'A'}</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{admin?.name}</div>
              <div style={{ color: '#64748B', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{admin?.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '9px 12px', background: 'transparent',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px',
            color: '#FCA5A5', fontSize: '13px', fontWeight: 500,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, marginLeft: `${SIDEBAR_WIDTH}px`, display: 'flex', flexDirection: 'column' }}>

        {/* Topbar */}
        <header style={{
          background: '#fff', borderBottom: '1px solid #E2E8F0',
          padding: '0 32px', height: '64px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>Companies</h2>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>
              Manage all company ERP systems
            </p>
          </div>
          <button
            onClick={() => navigate('/companies/create')}
            style={{
              padding: '10px 20px', background: '#1E3A5F',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            ➕ Create Company
          </button>
        </header>

        {/* Content */}
        <main style={{ padding: '32px', flex: 1 }}>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
              <div style={{
                width: '40px', height: '40px',
                border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F',
                borderRadius: '50%', animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          ) : companies.length === 0 ? (

            /* Empty State */
            <div style={{
              background: '#fff', borderRadius: '20px',
              border: '1px solid #E2E8F0', padding: '80px 32px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏢</div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                No companies yet
              </h3>
              <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '28px' }}>
                Create your first company ERP to get started
              </p>
              <button
                onClick={() => navigate('/companies/create')}
                style={{
                  padding: '12px 28px', background: '#1E3A5F',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                ➕ Create First Company
              </button>
            </div>

          ) : (

            /* Companies Table */
            <div style={{
              background: '#fff', borderRadius: '16px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['Company', 'Slug', 'CEO', 'Plan', 'Modules', 'Status', 'Actions'].map((h) => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: 'left',
                        fontSize: '12px', fontWeight: 600,
                        color: '#64748B', textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company, i) => {
                    const statusStyle = getStatusStyle(company.status)
                    const planStyle = getPlanStyle(company.plan)
                    return (
                      <tr key={company.id} style={{
                        borderBottom: i < companies.length - 1 ? '1px solid #F1F5F9' : 'none',
                        transition: 'background 0.1s',
                      }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '38px', height: '38px', borderRadius: '10px',
                              background: '#EFF6FF', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                            }}>🏢</div>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{company.name}</div>
                              <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                                {new Date(company.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{
                            fontSize: '13px', color: '#2E86AB',
                            fontFamily: 'monospace', background: '#EFF6FF',
                            padding: '2px 8px', borderRadius: '6px',
                          }}>
                            {company.slug}.myerp.com
                          </span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{company.ceoName}</div>
                          <div style={{ fontSize: '12px', color: '#94A3B8' }}>{company.ceoEmail}</div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: '99px',
                            fontSize: '12px', fontWeight: 600,
                            background: planStyle.bg, color: planStyle.color,
                          }}>{company.plan}</span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                            {company._count?.modules || 0}
                          </span>
                          <span style={{ fontSize: '12px', color: '#94A3B8', marginLeft: '4px' }}>modules</span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: '99px',
                            fontSize: '12px', fontWeight: 600,
                            background: statusStyle.bg, color: statusStyle.color,
                            border: `1px solid ${statusStyle.border}`,
                          }}>{company.status}</span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => router.push(`/companies/${company.id}`)}
                              style={{
                                padding: '6px 12px', background: '#EFF6FF',
                                color: '#1D4ED8', border: '1px solid #BFDBFE',
                                borderRadius: '8px', fontSize: '12px',
                                fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'Inter, sans-serif',
                              }}
                            >
                              Edit
                            </button>
                            {company.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleSuspend(company.id)}
                                disabled={actionLoading === company.id}
                                style={{
                                  padding: '6px 12px', background: '#FFF7ED',
                                  color: '#EA580C', border: '1px solid #FED7AA',
                                  borderRadius: '8px', fontSize: '12px',
                                  fontWeight: 600, cursor: 'pointer',
                                  fontFamily: 'Inter, sans-serif',
                                }}
                              >
                                Suspend
                              </button>
                            ) : company.status === 'SUSPENDED' ? (
                              <button
                                onClick={() => handleActivate(company.id)}
                                disabled={actionLoading === company.id}
                                style={{
                                  padding: '6px 12px', background: '#F0FDF4',
                                  color: '#16A34A', border: '1px solid #BBF7D0',
                                  borderRadius: '8px', fontSize: '12px',
                                  fontWeight: 600, cursor: 'pointer',
                                  fontFamily: 'Inter, sans-serif',
                                }}
                              >
                                Activate
                              </button>
                            ) : null}
                            <button
                              onClick={() => handleDelete(company.id)}
                              disabled={actionLoading === company.id}
                              style={{
                                padding: '6px 12px', background: '#FEF2F2',
                                color: '#DC2626', border: '1px solid #FECACA',
                                borderRadius: '8px', fontSize: '12px',
                                fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'Inter, sans-serif',
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}