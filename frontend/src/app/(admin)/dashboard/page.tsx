'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/axios'
import toast from 'react-hot-toast'
import AdminLayout from '@/components/layout/AdminLayout'

export default function DashboardPage() {
  const router = useRouter()
  const [admin, setAdmin] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
  totalCompanies: 0,
  activeCompanies: 0,
  totalModules: 0,
  activePlans: 0,
})

  useEffect(() => {
    const cached = sessionStorage.getItem('admin_user')
    if (cached) {
      try {
        setAdmin(JSON.parse(cached))
        setLoading(false)
        fetchStats()
        return
      } catch {}
    }
    fetchProfile()
    fetchStats()
  }, [])

  async function fetchProfile() {
    try {
      const res = await api.get('/super-admin/me')
      setAdmin(res.data.data)
      sessionStorage.setItem('admin_user', JSON.stringify(res.data.data))
    } catch {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

async function fetchStats() {
  try {
    const res = await api.get('/super-admin/stats')
    setStats(res.data.data)
  } catch {}
}

  async function handleLogout() {
    sessionStorage.removeItem('admin_user')
    try {
      await api.post('/auth/logout')
      toast.success('Logged out')
      setTimeout(() => router.push('/login'), 500)
    } catch {
      router.push('/login')
    }
  }

  function navigate(path: string) {
    router.push(path)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: '#F8FAFC',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '44px', height: '44px', margin: '0 auto 16px',
            border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F',
            borderRadius: '50%', animation: 'spin 0.7s linear infinite',
          }} />
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const statCards = [
  { label: 'Total Companies', value: stats.totalCompanies.toString(), icon: '🏢', bg: '#EFF6FF', color: '#1D4ED8' },
  { label: 'Active Companies', value: stats.activeCompanies.toString(), icon: '👥', bg: '#F0FDF4', color: '#16A34A' },
  { label: 'Total Modules', value: stats.totalModules.toString(), icon: '📦', bg: '#FAF5FF', color: '#7C3AED' },
  { label: 'Active Plans', value: stats.activePlans.toString(), icon: '📈', bg: '#FFF7ED', color: '#EA580C' },
]

  const quickActions = [
    { title: 'Create Company', desc: 'Setup new ERP', icon: '➕', color: '#1E3A5F', path: '/companies/create' },
    { title: 'All Companies', desc: 'View & manage', icon: '🏢', color: '#2E86AB', path: '/companies' },
    { title: 'Modules', desc: 'Enable/disable', icon: '📦', color: '#7C3AED', path: '/modules' },
    { title: 'Settings', desc: 'Configuration', icon: '⚙️', color: '#475569', path: '/settings' },
  ]

  return (
    <AdminLayout
      title="Dashboard"
      subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      headerRight={
        <div style={{
          padding: '6px 14px', background: '#F0FDF4',
          border: '1px solid #BBF7D0', borderRadius: '99px',
          fontSize: '12px', color: '#16A34A', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{ width: '6px', height: '6px', background: '#22C55E', borderRadius: '50%', display: 'inline-block' }} />
          System Online
        </div>
      }
    >
      <div style={{
        background: 'linear-gradient(135deg, #1E3A5F, #2E86AB)',
        borderRadius: '20px', padding: '28px 32px',
        marginBottom: '28px', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>
            Welcome back, {admin?.name} 👋
          </h3>
          <p style={{ color: '#BFDBFE', fontSize: '14px' }}>
            Here's what's happening on your platform today.
          </p>
        </div>
        <div style={{ fontSize: '48px' }}>🏢</div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px', marginBottom: '28px',
      }}>
        {statCards.map((s) => (
          <div key={s.label} style={{
            background: '#fff', borderRadius: '16px',
            padding: '20px 24px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{
                width: '42px', height: '42px', background: s.bg,
                borderRadius: '12px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '20px',
              }}>{s.icon}</div>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A' }}>{s.value}</span>
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {quickActions.map((a) => (
            <button
              key={a.title}
              onClick={() => navigate(a.path)}
              style={{
                background: '#fff', border: '1px solid #E2E8F0',
                borderRadius: '16px', padding: '20px',
                cursor: 'pointer', textAlign: 'left',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget).style.transform = 'translateY(-2px)'
                ;(e.currentTarget).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget).style.transform = 'translateY(0)'
                ;(e.currentTarget).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{
                width: '42px', height: '42px', background: a.color,
                borderRadius: '12px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', marginBottom: '14px',
              }}>{a.icon}</div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>{a.title}</p>
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>{a.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div style={{
        background: '#fff', borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Recent Activity</h3>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>Latest platform actions</p>
        </div>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
          <p style={{ fontSize: '14px', fontWeight: 500, color: '#64748B' }}>No activity yet</p>
          <p style={{ fontSize: '12px', color: '#CBD5E1', marginTop: '4px' }}>
            Activity will appear once you start using the platform
          </p>
        </div>
      </div>
    </AdminLayout>
  )
}