'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import TenantLayout from '@/components/layout/TenantLayout'

const TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  ASSET:     { bg: '#EFF6FF', color: '#1D4ED8', label: 'Asset' },
  LIABILITY: { bg: '#FEF2F2', color: '#DC2626', label: 'Liability' },
  EQUITY:    { bg: '#FAF5FF', color: '#7C3AED', label: 'Equity' },
  INCOME:    { bg: '#F0FDF4', color: '#16A34A', label: 'Income' },
  EXPENSE:   { bg: '#FFF7ED', color: '#EA580C', label: 'Expense' },
}

export default function LedgerPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState('ALL')
  const [activeTab, setActiveTab] = useState<'accounts' | 'trial'>('accounts')

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const sub = parts.length >= 2 ? parts[0] : 'localhost'
    setSubdomain(sub)
    fetchData(sub)
  }, [])

  async function fetchData(sub: string) {
    try {
      const [accountsRes, trialRes] = await Promise.all([
        axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/erp/finance/accounts`,
          { withCredentials: true, headers: { 'x-tenant-slug': sub } }
        ),
        axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/erp/finance/trial-balance`,
          { withCredentials: true, headers: { 'x-tenant-slug': sub } }
        ),
      ])
      setData({
        accounts: accountsRes.data.data.accounts,
        grouped: accountsRes.data.data.grouped,
        trial: trialRes.data.data,
      })
    } catch {
      toast.error('Failed to load ledger')
    } finally {
      setLoading(false)
    }
  }

  const accounts = data?.accounts || []
  const trialAccounts = data?.trial?.accounts || []

  const filtered = accounts.filter((a: any) => {
    const matchesType = activeType === 'ALL' || a.type === activeType
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase())
    return matchesType && matchesSearch
  })

  const totalAssets = (data?.grouped?.ASSET || []).reduce((s: number, a: any) => s + Number(a.balance || 0), 0)
  const totalLiabilities = (data?.grouped?.LIABILITY || []).reduce((s: number, a: any) => s + Number(a.balance || 0), 0)
  const totalEquity = (data?.grouped?.EQUITY || []).reduce((s: number, a: any) => s + Number(a.balance || 0), 0)
  const totalIncome = (data?.grouped?.INCOME || []).reduce((s: number, a: any) => s + Number(a.balance || 0), 0)
  const totalExpense = (data?.grouped?.EXPENSE || []).reduce((s: number, a: any) => s + Number(a.balance || 0), 0)

  return (
    <TenantLayout
      title="Accounts Ledger"
      subtitle="View all account balances and transactions"
      requiredModule="ledger"
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total Assets', value: totalAssets, color: '#1D4ED8', bg: '#EFF6FF' },
              { label: 'Total Liabilities', value: totalLiabilities, color: '#DC2626', bg: '#FEF2F2' },
              { label: 'Total Equity', value: totalEquity, color: '#7C3AED', bg: '#FAF5FF' },
              { label: 'Total Income', value: totalIncome, color: '#16A34A', bg: '#F0FDF4' },
              { label: 'Total Expenses', value: totalExpense, color: '#EA580C', bg: '#FFF7ED' },
            ].map((c) => (
              <div key={c.label} style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>{c.label}</p>
                <p style={{ fontSize: '16px', fontWeight: 800, color: c.color }}>
                  PKR {c.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F1F5F9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
            {[
              { key: 'accounts', label: '📒 Account Ledger' },
              { key: 'trial', label: '⚖️ Trial Balance' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: 'none',
                  background: activeTab === tab.key ? '#fff' : 'transparent',
                  color: activeTab === tab.key ? '#0F172A' : '#64748B',
                  fontSize: '13px', fontWeight: activeTab === tab.key ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >{tab.label}</button>
            ))}
          </div>

          {/* Account Ledger Tab */}
          {activeTab === 'accounts' && (
            <>
              {/* Filters */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or code..."
                  style={{
                    flex: 1, minWidth: '200px', padding: '9px 14px',
                    border: '1.5px solid #E2E8F0', borderRadius: '8px',
                    fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif',
                  }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setActiveType(type)}
                      style={{
                        padding: '8px 12px', borderRadius: '8px', border: 'none',
                        background: activeType === type ? '#1E3A5F' : '#F1F5F9',
                        color: activeType === type ? '#fff' : '#64748B',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >{type === 'ALL' ? 'All' : TYPE_STYLES[type]?.label}</button>
                  ))}
                </div>
              </div>

              {/* Accounts Table */}
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      {['Code', 'Account Name', 'Type', 'Balance', 'Actions'].map((h) => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
                          No accounts found
                        </td>
                      </tr>
                    ) : filtered.map((account: any, i: number) => {
                      const ts = TYPE_STYLES[account.type]
                      const balance = Number(account.balance || 0)
                      return (
                        <tr
                          key={account.id}
                          style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#374151', background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>
                              {account.code}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                            {account.name}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: ts.bg, color: ts.color }}>
                              {ts.label}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: balance === 0 ? '#94A3B8' : balance > 0 ? '#0F172A' : '#DC2626' }}>
                              {balance < 0 ? '-' : ''}PKR {Math.abs(balance).toLocaleString()}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <button
                              onClick={() => router.push(`/erp/finance/accounts/${account.id}/ledger`)}
                              style={{
                                padding: '7px 14px', background: '#EFF6FF',
                                color: '#1D4ED8', border: '1px solid #BFDBFE',
                                borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                              }}
                            >📋 View Ledger</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Trial Balance Tab */}
          {activeTab === 'trial' && (
            <>
              {/* Balance Check */}
              <div style={{
                padding: '14px 20px', borderRadius: '10px', marginBottom: '16px',
                background: data?.trial?.isBalanced ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${data?.trial?.isBalanced ? '#BBF7D0' : '#FECACA'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: data?.trial?.isBalanced ? '#16A34A' : '#DC2626' }}>
                  {data?.trial?.isBalanced ? '✓ Trial Balance is Balanced' : '⚠ Trial Balance is NOT Balanced'}
                </span>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <span style={{ fontSize: '13px', color: '#374151' }}>
                    Total Debit: <strong>PKR {(data?.trial?.totalDebit || 0).toLocaleString()}</strong>
                  </span>
                  <span style={{ fontSize: '13px', color: '#374151' }}>
                    Total Credit: <strong>PKR {(data?.trial?.totalCredit || 0).toLocaleString()}</strong>
                  </span>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      {['Code', 'Account Name', 'Type', 'Total Debit', 'Total Credit', 'Balance'].map((h) => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trialAccounts.map((account: any, i: number) => {
                      const ts = TYPE_STYLES[account.type]
                      return (
                        <tr
                          key={account.id}
                          style={{ borderBottom: i < trialAccounts.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#374151', background: '#F1F5F9', padding: '2px 8px', borderRadius: '6px' }}>
                              {account.code}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                            {account.name}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: ts.bg, color: ts.color }}>
                              {ts.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#16A34A' }}>
                            {account.totalDebit > 0 ? `PKR ${account.totalDebit.toLocaleString()}` : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#DC2626' }}>
                            {account.totalCredit > 0 ? `PKR ${account.totalCredit.toLocaleString()}` : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: Number(account.balance) >= 0 ? '#0F172A' : '#DC2626' }}>
                            PKR {Number(account.balance || 0).toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* Totals Row */}
                  <tfoot>
                    <tr style={{ background: '#1E3A5F', borderTop: '2px solid #E2E8F0' }}>
                      <td colSpan={3} style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                        TOTAL
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 800, color: '#86EFAC' }}>
                        PKR {(data?.trial?.totalDebit || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 800, color: '#FCA5A5' }}>
                        PKR {(data?.trial?.totalCredit || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px' }} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </TenantLayout>
  )
}