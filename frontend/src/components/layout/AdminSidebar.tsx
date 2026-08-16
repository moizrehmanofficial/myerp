'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import api from '@/lib/axios'

interface AdminSidebarProps {
  activePath: string
  admin: any
}

const navItems = [
  { label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { label: 'Companies', icon: '🏢', path: '/companies' },
  { label: 'Modules', icon: '📦', path: '/modules' },
  { label: 'Users', icon: '👥', path: '/users' },
  { label: 'Settings', icon: '⚙️', path: '/settings' },
  { label: 'Backup', path: '/backup', icon: '💾' }
]

export default function AdminSidebar({ activePath, admin }: AdminSidebarProps) {
  const router = useRouter()

  async function handleLogout() {
    sessionStorage.removeItem('admin_user')
    try {
      await api.post('/auth/logout')
    } catch {}
    router.push('/login')
  }

  return (
    <aside style={{
      width: '240px', minHeight: '100vh',
      background: '#1E3A5F', position: 'fixed',
      left: 0, top: 0, display: 'flex',
      flexDirection: 'column', zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{
          width: '38px', height: '38px',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: '10px', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: '18px',
        }}>🛡️</div>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', lineHeight: 1 }}>MyERP</div>
          <div style={{ color: '#93C5FD', fontSize: '11px', marginTop: '3px' }}>Super Admin</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        <p style={{
          color: '#64748B', fontSize: '10px', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          padding: '0 8px', marginBottom: '8px',
        }}>Navigation</p>
        {navItems.map((item) => {
          const isActive = activePath === item.path
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '10px', border: 'none',
                cursor: 'pointer', marginBottom: '4px',
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: isActive ? '#fff' : '#94A3B8',
                fontSize: '14px', fontWeight: isActive ? 600 : 400,
                fontFamily: 'Inter, sans-serif', textAlign: 'left',
                transition: 'all 0.15s',
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

      {/* User + Logout */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', marginBottom: '8px',
        }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: '#2E86AB', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: '14px',
          }}>
            {admin?.name?.charAt(0) || 'A'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              color: '#fff', fontSize: '13px', fontWeight: 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{admin?.name}</div>
            <div style={{
              color: '#64748B', fontSize: '11px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{admin?.email}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '9px 12px',
            background: 'transparent',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px', color: '#FCA5A5',
            fontSize: '13px', fontWeight: 500,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '6px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#FCA5A5'
          }}
        >
          🚪 Sign Out
        </button>
      </div>
    </aside>
  )
}