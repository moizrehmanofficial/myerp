'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import axios from 'axios'

export default function TenantLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [companyLogo, setCompanyLogo] = useState('')

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    if (parts.length >= 2) {
      const sub = parts[0]
      setSubdomain(sub)
      setCompanyName(sub.charAt(0).toUpperCase() + sub.slice(1))

      axios.get(`${process.env.NEXT_PUBLIC_API_URL}/tenant-auth/company-info`, {
        headers: { 'x-tenant-slug': sub }
      }).then((res) => {
        if (res.data.data?.logoUrl) setCompanyLogo(res.data.data.logoUrl)
        if (res.data.data?.name) setCompanyName(res.data.data.name)
      }).catch(() => {})
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }

    // Get subdomain fresh from hostname
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : subdomain

    setLoading(true)
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/tenant-auth/login`,
        { email, password },
        {
          withCredentials: true,
          headers: {
            'x-tenant-slug': sub,
          },
        }
      )

      if (res.data.success) {
        toast.success(`Welcome back, ${res.data.data.name}!`)
        sessionStorage.setItem(`tenant_user_${sub}`, JSON.stringify(res.data.data))
        sessionStorage.setItem('tenant_slug_current', sub)
        setTimeout(() => {
          window.location.href = '/erp/dashboard'
        }, 800)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      fontFamily: 'Inter, sans-serif', background: '#F8FAFC',
    }}>
      <Toaster position="top-right" />

      {/* Left Panel */}
      <div style={{
        width: '45%',
        background: 'linear-gradient(135deg, #1E3A5F 0%, #2E86AB 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-80px', left: '-80px',
          width: '300px', height: '300px',
          background: 'rgba(255,255,255,0.05)', borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', right: '-60px',
          width: '250px', height: '250px',
          background: 'rgba(255,255,255,0.05)', borderRadius: '50%',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            width: '80px', height: '80px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: '36px',
            border: '1px solid rgba(255,255,255,0.2)',
            overflow: 'hidden',
          }}>
            {companyLogo ? (
              <img src={companyLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }} />
            ) : (
              <span>🏢</span>
            )}
          </div>

          <h1 style={{ fontSize: '42px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            {companyName || 'MyERP'}
          </h1>
          <p style={{ color: '#93C5FD', fontSize: '16px', marginBottom: '8px' }}>
            Company ERP System
          </p>
          <p style={{
            color: 'rgba(255,255,255,0.4)', fontSize: '13px',
            fontFamily: 'monospace',
            background: 'rgba(255,255,255,0.05)',
            padding: '4px 12px', borderRadius: '99px',
            display: 'inline-block',
          }}>
            {subdomain}.myerp.com
          </p>

          <div style={{
            marginTop: '48px', display: 'flex',
            flexDirection: 'column', gap: '14px', textAlign: 'left',
          }}>
            {[
              'Powered by MyERP Platform',
              'Secure & encrypted access',
              'Role-based permissions',
            ].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#4ADE80', fontSize: '14px' }}>✓</span>
                <span style={{ color: '#BFDBFE', fontSize: '14px' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{
          position: 'absolute', bottom: '24px',
          color: '#60A5FA', fontSize: '12px',
        }}>
          Powered by MyERP v1.0
        </p>
      </div>

      {/* Right Panel */}
      <div style={{
        flex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '48px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{
            background: '#fff', borderRadius: '24px', padding: '40px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
            border: '1px solid #E2E8F0',
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
              Sign In
            </h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '32px' }}>
              Enter your credentials to access the ERP
            </p>

            <form onSubmit={handleLogin}>

              {/* Email */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: 600, color: '#374151', marginBottom: '8px',
                }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '14px',
                    top: '50%', transform: 'translateY(-50%)', fontSize: '16px',
                  }}>📧</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
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

              {/* Password */}
              <div style={{ marginBottom: '28px' }}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: 600, color: '#374151', marginBottom: '8px',
                }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '14px',
                    top: '50%', transform: 'translateY(-50%)', fontSize: '16px',
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
                      position: 'absolute', right: '14px',
                      top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: '16px',
                    }}
                  >{showPassword ? '🙈' : '👁️'}</button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
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
                ) : 'Sign In to ERP'}
              </button>

            </form>

            <div style={{
              marginTop: '20px', padding: '12px 16px',
              background: '#EFF6FF', borderRadius: '10px',
              border: '1px solid #DBEAFE', textAlign: 'center',
            }}>
              <p style={{ fontSize: '12px', color: '#3B82F6' }}>
                🔒 Your session is encrypted and secure
              </p>
            </div>

          </div>

          <p style={{
            textAlign: 'center', color: '#94A3B8',
            fontSize: '12px', marginTop: '20px',
          }}>
            Having trouble? Contact your system administrator
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}