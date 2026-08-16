'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/axios'
import toast, { Toaster } from 'react-hot-toast'

const SIDEBAR_WIDTH = 240

export default function CreateCompanyPage() {
  const router = useRouter()
  const [admin, setAdmin] = useState<any>(null)
  const [activePath, setActivePath] = useState('/companies')
  const [modules, setModules] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modulesLoading, setModulesLoading] = useState(true)

  const [form, setForm] = useState({
    name: '',
    slug: '',
    ceoName: '',
    ceoEmail: '',
    ceoPassword: '',
    plan: 'FREE',
    moduleKeys: [] as string[],
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')

  useEffect(() => {
    fetchProfile()
    fetchModules()
  }, [])

  // Auto generate slug from company name
  useEffect(() => {
    const slug = form.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    setForm((prev) => ({ ...prev, slug }))
  }, [form.name])

  async function fetchProfile() {
    const cached = sessionStorage.getItem('admin_user')
    if (cached) {
      try { setAdmin(JSON.parse(cached)); return } catch {}
    }
    try {
      const res = await api.get('/super-admin/me')
      setAdmin(res.data.data)
      sessionStorage.setItem('admin_user', JSON.stringify(res.data.data))
    } catch {
      router.push('/login')
    }
  }

  async function fetchModules() {
    try {
      const res = await api.get('/companies/modules')
      setModules(res.data.data)
    } catch {
      toast.error('Failed to load modules')
    } finally {
      setModulesLoading(false)
    }
  }

  function toggleModule(key: string) {
    setForm((prev) => ({
      ...prev,
      moduleKeys: prev.moduleKeys.includes(key)
        ? prev.moduleKeys.filter((k) => k !== key)
        : [...prev.moduleKeys, key],
    }))
  }

  function selectAllModules() {
    setForm((prev) => ({
      ...prev,
      moduleKeys: modules.map((m) => m.key),
    }))
  }

  function clearAllModules() {
    setForm((prev) => ({ ...prev, moduleKeys: [] }))
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#!'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setForm((prev) => ({ ...prev, ceoPassword: password }))
    toast.success('Password generated!')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name || !form.slug || !form.ceoName || !form.ceoEmail || !form.ceoPassword) {
      toast.error('Please fill all required fields')
      return
    }

    if (form.moduleKeys.length === 0) {
      toast.error('Please select at least one module')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/companies', form)
      if (res.data.success) {
        const companyId = res.data.data.id
        if (logoFile && companyId) {
          try {
            const formData = new FormData()
            formData.append('logo', logoFile)
            await api.post(`/companies/${companyId}/logo`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
          } catch {
            toast.error('Company created but logo upload failed')
          }
        }
        toast.success('Company ERP created successfully!')
        setTimeout(() => router.push('/companies'), 1500)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create company')
    } finally {
      setLoading(false)
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

  const plans = [
    { value: 'FREE', label: 'Free', color: '#64748B' },
    { value: 'STARTER', label: 'Starter', color: '#16A34A' },
    { value: 'PROFESSIONAL', label: 'Professional', color: '#1D4ED8' },
    { value: 'ENTERPRISE', label: 'Enterprise', color: '#7C3AED' },
  ]

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
                fontFamily: 'Inter, sans-serif', textAlign: 'left',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/companies')}
              style={{
                padding: '8px 12px', background: '#F1F5F9',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontSize: '14px', color: '#64748B', fontFamily: 'Inter, sans-serif',
              }}
            >
              ← Back
            </button>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>Create Company ERP</h2>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>
                Setup a new company ERP system
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ padding: '32px', flex: 1 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '1100px' }}>

              {/* ── LEFT COLUMN ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Company Info */}
                <div style={{
                  background: '#fff', borderRadius: '16px',
                  border: '1px solid #E2E8F0', padding: '24px',
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🏢 Company Information
                  </h3>

                  {/* Logo Upload */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                      Company Logo <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional, max 2MB)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '72px', height: '72px', borderRadius: '12px',
                        border: '2px dashed #E2E8F0', background: '#F8FAFC',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0,
                      }}>
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: '28px' }}>🏢</span>
                        )}
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/svg+xml"
                          id="logo-upload"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setLogoFile(file)
                            const reader = new FileReader()
                            reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
                            reader.readAsDataURL(file)
                          }}
                        />
                        <label htmlFor="logo-upload" style={{
                          display: 'inline-block', padding: '8px 16px',
                          background: '#EFF6FF', color: '#1D4ED8',
                          border: '1px solid #BFDBFE', borderRadius: '8px',
                          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        }}>
                          📁 Choose Logo
                        </label>
                        {logoFile && (
                          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                            {logoFile.name} ({(logoFile.size / 1024).toFixed(0)} KB)
                            <button type="button" onClick={() => { setLogoFile(null); setLogoPreview('') }} style={{ marginLeft: '8px', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✕ Remove</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Company Name */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Company Name <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Vertex Solutions"
                      style={{
                        width: '100%', padding: '11px 14px',
                        border: '1.5px solid #E2E8F0', borderRadius: '10px',
                        fontSize: '14px', color: '#0F172A', background: '#F8FAFC',
                        outline: 'none', fontFamily: 'Inter, sans-serif',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                      onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                    />
                  </div>

                  {/* Subdomain */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Subdomain <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #E2E8F0', borderRadius: '10px', background: '#F8FAFC', overflow: 'hidden' }}>
                      <input
                        type="text"
                        value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                        placeholder="vertex-solutions"
                        style={{
                          flex: 1, padding: '11px 14px',
                          border: 'none', fontSize: '14px',
                          color: '#0F172A', background: 'transparent',
                          outline: 'none', fontFamily: 'Inter, sans-serif',
                        }}
                      />
                      <span style={{
                        padding: '11px 14px', background: '#E2E8F0',
                        fontSize: '13px', color: '#64748B', whiteSpace: 'nowrap',
                      }}>
                        .myerp.com
                      </span>
                    </div>
                    {form.slug && (
                      <p style={{ fontSize: '12px', color: '#2E86AB', marginTop: '4px' }}>
                        URL: {form.slug}.myerp.com
                      </p>
                    )}
                  </div>

                  {/* Plan */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                      Subscription Plan
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {plans.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setForm({ ...form, plan: p.value })}
                          style={{
                            padding: '10px', border: `2px solid ${form.plan === p.value ? p.color : '#E2E8F0'}`,
                            borderRadius: '10px', background: form.plan === p.value ? `${p.color}10` : '#fff',
                            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                            fontSize: '13px', fontWeight: 600,
                            color: form.plan === p.value ? p.color : '#64748B',
                            transition: 'all 0.15s',
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* CEO Info */}
                <div style={{
                  background: '#fff', borderRadius: '16px',
                  border: '1px solid #E2E8F0', padding: '24px',
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    👤 CEO Account
                  </h3>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      CEO Name <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={form.ceoName}
                      onChange={(e) => setForm({ ...form, ceoName: e.target.value })}
                      placeholder="e.g. Ahmed Khan"
                      style={{
                        width: '100%', padding: '11px 14px',
                        border: '1.5px solid #E2E8F0', borderRadius: '10px',
                        fontSize: '14px', color: '#0F172A', background: '#F8FAFC',
                        outline: 'none', fontFamily: 'Inter, sans-serif',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                      onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      CEO Email <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="email"
                      value={form.ceoEmail}
                      onChange={(e) => setForm({ ...form, ceoEmail: e.target.value })}
                      placeholder="ceo@company.com"
                      style={{
                        width: '100%', padding: '11px 14px',
                        border: '1.5px solid #E2E8F0', borderRadius: '10px',
                        fontSize: '14px', color: '#0F172A', background: '#F8FAFC',
                        outline: 'none', fontFamily: 'Inter, sans-serif',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                      onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      CEO Password <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={form.ceoPassword}
                        onChange={(e) => setForm({ ...form, ceoPassword: e.target.value })}
                        placeholder="Min 6 characters"
                        style={{
                          flex: 1, padding: '11px 14px',
                          border: '1.5px solid #E2E8F0', borderRadius: '10px',
                          fontSize: '14px', color: '#0F172A', background: '#F8FAFC',
                          outline: 'none', fontFamily: 'Inter, sans-serif',
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
                        onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                      />
                      <button
                        type="button"
                        onClick={generatePassword}
                        style={{
                          padding: '11px 14px', background: '#F1F5F9',
                          border: '1.5px solid #E2E8F0', borderRadius: '10px',
                          fontSize: '13px', fontWeight: 600, color: '#374151',
                          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Auto Generate
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── RIGHT COLUMN — Modules ── */}
              <div style={{
                background: '#fff', borderRadius: '16px',
                border: '1px solid #E2E8F0', padding: '24px',
                height: 'fit-content',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📦 Select Modules
                    <span style={{
                      fontSize: '12px', background: '#EFF6FF',
                      color: '#1D4ED8', padding: '2px 8px',
                      borderRadius: '99px', fontWeight: 600,
                    }}>
                      {form.moduleKeys.length} selected
                    </span>
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={selectAllModules}
                      style={{
                        padding: '6px 12px', background: '#F0FDF4',
                        border: '1px solid #BBF7D0', borderRadius: '8px',
                        fontSize: '12px', fontWeight: 600, color: '#16A34A',
                        cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={clearAllModules}
                      style={{
                        padding: '6px 12px', background: '#FEF2F2',
                        border: '1px solid #FECACA', borderRadius: '8px',
                        fontSize: '12px', fontWeight: 600, color: '#DC2626',
                        cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {modulesLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{
                      width: '32px', height: '32px', margin: '0 auto',
                      border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F',
                      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                    }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {modules.map((module) => {
                      const isSelected = form.moduleKeys.includes(module.key)
                      return (
                        <button
                          key={module.key}
                          type="button"
                          onClick={() => toggleModule(module.key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 14px', border: `1.5px solid ${isSelected ? '#2E86AB' : '#E2E8F0'}`,
                            borderRadius: '10px', background: isSelected ? '#EFF6FF' : '#F8FAFC',
                            cursor: 'pointer', textAlign: 'left',
                            fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                          }}
                        >
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '6px',
                            border: `2px solid ${isSelected ? '#2E86AB' : '#CBD5E1'}`,
                            background: isSelected ? '#2E86AB' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'all 0.15s',
                          }}>
                            {isSelected && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>✓</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#1E3A5F' : '#374151' }}>
                              {module.name}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ maxWidth: '1100px', marginTop: '24px' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '16px',
                  background: loading ? '#94A3B8' : '#1E3A5F',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '16px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  transition: 'background 0.2s',
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: '18px', height: '18px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      display: 'inline-block', animation: 'spin 0.7s linear infinite',
                    }} />
                    Creating Company ERP...
                  </>
                ) : '🚀 Create Company ERP'}
              </button>
            </div>
          </form>
        </main>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}