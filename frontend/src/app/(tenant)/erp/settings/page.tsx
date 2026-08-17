'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'
import { getTenantSlug } from '@/lib/getTenantSlug'

const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR']
const TIMEZONES = ['Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'Europe/London', 'America/New_York']
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subdomain, setSubdomain] = useState('')
  const [activeTab, setActiveTab] = useState('general')

  const [settings, setSettings] = useState({
    company_name: '',
    company_email: '',
    company_phone: '',
    company_address: '',
    company_currency: 'PKR',
    company_timezone: 'Asia/Karachi',
    date_format: 'DD/MM/YYYY',
    invoice_prefix: 'INV-',
    purchase_prefix: 'PO-',
    sales_prefix: 'SO-',
    employee_prefix: 'EMP-',
    tax_name: 'GST',
    tax_rate: '0',
    low_stock_alert: '10',
    fiscal_year_start: '01',
  })

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchSettings(sub)
  }, [])

  async function fetchSettings(sub: string) {
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/settings`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      const data = res.data.data
      setSettings((prev) => ({ ...prev, ...data }))
    } catch {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/settings`,
        settings,
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } }
      )
      toast.success('Settings saved successfully!')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #E2E8F0', borderRadius: '8px',
    fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, sans-serif', background: '#fff',
    boxSizing: 'border-box',
  }

  const tabs = [
    { key: 'general', label: '🏢 General' },
    { key: 'finance', label: '💰 Finance' },
    { key: 'prefixes', label: '🔢 Numbering' },
    { key: 'inventory', label: '📦 Inventory' },
  ]

  return (
    <TenantLayout
      title="Settings"
      subtitle="Configure your ERP system"
      headerRight={
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 24px',
            background: saving ? '#94A3B8' : 'linear-gradient(135deg, #1E3A5F, #2E86AB)',
            color: '#fff', border: 'none', borderRadius: '10px',
            fontSize: '13px', fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif',
            boxShadow: saving ? 'none' : '0 4px 14px rgba(30,58,95,0.3)',
          }}
        >
          {saving ? 'Saving...' : '💾 Save Changes'}
        </button>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '24px', maxWidth: '900px' }}>

          {/* Sidebar Tabs */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '8px', height: 'fit-content' }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  width: '100%', padding: '10px 14px', border: 'none',
                  borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                  background: activeTab === tab.key ? '#EFF6FF' : 'transparent',
                  color: activeTab === tab.key ? '#1D4ED8' : '#64748B',
                  fontSize: '13px', fontWeight: activeTab === tab.key ? 700 : 500,
                  fontFamily: 'Inter, sans-serif', marginBottom: '2px',
                }}
              >{tab.label}</button>
            ))}
          </div>

          {/* Content */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '28px' }}>

            {/* General Tab */}
            {activeTab === 'general' && (
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '20px' }}>🏢 Company Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Company Name</label>
                    <input value={settings.company_name} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} placeholder="Your company name" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Email</label>
                    <input type="email" value={settings.company_email} onChange={(e) => setSettings({ ...settings, company_email: e.target.value })} placeholder="company@email.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Phone</label>
                    <input value={settings.company_phone} onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })} placeholder="+92 300 0000000" style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Address</label>
                    <textarea value={settings.company_address} onChange={(e) => setSettings({ ...settings, company_address: e.target.value })} placeholder="Company address" rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Timezone</label>
                    <select value={settings.company_timezone} onChange={(e) => setSettings({ ...settings, company_timezone: e.target.value })} style={inputStyle}>
                      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Date Format</label>
                    <select value={settings.date_format} onChange={(e) => setSettings({ ...settings, date_format: e.target.value })} style={inputStyle}>
                      {DATE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Finance Tab */}
            {activeTab === 'finance' && (
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '20px' }}>💰 Finance Settings</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Currency</label>
                    <select value={settings.company_currency} onChange={(e) => setSettings({ ...settings, company_currency: e.target.value })} style={inputStyle}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Fiscal Year Start Month</label>
                    <select value={settings.fiscal_year_start} onChange={(e) => setSettings({ ...settings, fiscal_year_start: e.target.value })} style={inputStyle}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={String(m).padStart(2, '0')}>
                          {new Date(2024, m - 1).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Tax Name</label>
                    <input value={settings.tax_name} onChange={(e) => setSettings({ ...settings, tax_name: e.target.value })} placeholder="e.g. GST, VAT" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Default Tax Rate (%)</label>
                    <input type="number" value={settings.tax_rate} onChange={(e) => setSettings({ ...settings, tax_rate: e.target.value })} min="0" max="100" placeholder="0" style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {/* Prefixes Tab */}
            {activeTab === 'prefixes' && (
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>🔢 Document Numbering</h3>
                <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '20px' }}>Prefixes used when generating document numbers</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {[
                    { label: 'Invoice Prefix', key: 'invoice_prefix', placeholder: 'INV-', example: 'INV-00001' },
                    { label: 'Purchase Order Prefix', key: 'purchase_prefix', placeholder: 'PO-', example: 'PO-00001' },
                    { label: 'Sales Order Prefix', key: 'sales_prefix', placeholder: 'SO-', example: 'SO-00001' },
                    { label: 'Employee Prefix', key: 'employee_prefix', placeholder: 'EMP-', example: 'EMP-0001' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>{field.label}</label>
                      <input
                        value={(settings as any)[field.key]}
                        onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        style={inputStyle}
                      />
                      <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>e.g. {field.example}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '20px' }}>📦 Inventory Settings</h3>
                <div style={{ maxWidth: '400px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                    Default Low Stock Alert Level
                  </label>
                  <input
                    type="number"
                    value={settings.low_stock_alert}
                    onChange={(e) => setSettings({ ...settings, low_stock_alert: e.target.value })}
                    min="0"
                    placeholder="10"
                    style={inputStyle}
                  />
                  <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>
                    Products with stock at or below this level will show a "Low Stock" warning
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}