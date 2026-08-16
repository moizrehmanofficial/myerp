'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/axios'
import toast, { Toaster } from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // If accessed from a tenant subdomain, redirect to erp-login
    const host = window.location.hostname
    const parts = host.split('.')
    const subdomain = parts[0]
    const isTenant =
      parts.length >= 2 &&
      subdomain !== 'localhost' &&
      subdomain !== 'www' &&
      subdomain !== 'admin'

    if (isTenant) {
      router.replace('/erp-login')
      return
    }
    setChecking(false)
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      if (res.data.success) {
  toast.success('Login successful!')
  sessionStorage.setItem('admin_user', JSON.stringify(res.data.data))
  setTimeout(() => router.push('/dashboard'), 800)
}
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F',
          borderRadius: '50%', animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      fontFamily: 'Inter, sans-serif',
    }}>
      <Toaster position="top-right" />

      {/* Left Panel */}
      <div style={{
        width: '50%',
        background: 'linear-gradient(135deg, #1E3A5F 0%, #2E86AB 50%, #1E3A5F 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-100px', left: '-100px',
          width: '350px', height: '350px',
          background: 'rgba(255,255,255,0.05)', borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: '-80px', right: '-80px',
          width: '280px', height: '280px',
          background: 'rgba(255,255,255,0.05)', borderRadius: '50%',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '360px' }}>
          <div style={{
            width: '80px', height: '80px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '24px', fontSize: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            border: '1px solid rgba(255,255,255,0.2)',
          }}>🛡️</div>

          <h1 style={{ fontSize: '48px', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
            MyERP
          </h1>
          <p style={{ fontSize: '16px', color: '#93C5FD', marginBottom: '48px' }}>
            Enterprise Resource Planning
          </p>

          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              'Multi-tenant company management',
              'Role-based access control',
              'Real-time analytics & reports',
              'Automated backups & security',
            ].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: '#22C55E', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: '12px', color: '#fff', fontWeight: 700,
                }}>✓</div>
                <span style={{ color: '#BFDBFE', fontSize: '14px' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{
          position: 'absolute', bottom: '24px',
          color: '#60A5FA', fontSize: '12px',
        }}>
          MyERP v1.0 © 2025 — All rights reserved
        </p>
      </div>

      {/* Right Panel */}
      <div style={{
        width: '50%', background: '#F8FAFC',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '48px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{
            background: '#fff', borderRadius: '24px', padding: '40px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
            border: '1px solid #E2E8F0',
          }}>
            <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '32px' }}>
              Sign in to your Super Admin account
            </p>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: 600, color: '#374151', marginBottom: '8px',
                }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '14px', top: '50%',
                    transform: 'translateY(-50%)', fontSize: '16px',
                  }}>📧</span>
                  <input
                    type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@myerp.com"
                    disabled={loading}
                    style={{
                      width: '100%', padding: '13px 16px 13px 42px',
                      border: '1.5px solid #E2E8F0', borderRadius: '12px',
                      fontSize: '14px', color: '#0F172A',
                      background: '#F8FAFC', outline: 'none',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                    onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '28px' }}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: 600, color: '#374151', marginBottom: '8px',
                }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '14px', top: '50%',
                    transform: 'translateY(-50%)', fontSize: '16px',
                  }}>🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={loading}
                    style={{
                      width: '100%', padding: '13px 44px 13px 42px',
                      border: '1.5px solid #E2E8F0', borderRadius: '12px',
                      fontSize: '14px', color: '#0F172A',
                      background: '#F8FAFC', outline: 'none',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                    onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '14px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: '16px',
                    }}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '14px',
                  background: loading ? '#94A3B8' : '#1E3A5F',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '15px', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.background = '#2E86AB'
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.background = '#1E3A5F'
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: '16px', height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    Signing in...
                  </>
                ) : 'Sign In to Dashboard'}
              </button>
            </form>

            <div style={{
              marginTop: '20px', padding: '12px 16px',
              background: '#EFF6FF', borderRadius: '10px',
              border: '1px solid #DBEAFE', textAlign: 'center',
            }}>
              <p style={{ fontSize: '12px', color: '#3B82F6' }}>
                🔒 Restricted area — Unauthorized access is prohibited
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}