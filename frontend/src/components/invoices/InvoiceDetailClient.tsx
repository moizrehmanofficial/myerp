"use client"

import TenantLayout from '@/components/layout/TenantLayout'
import { getTenantSlug } from '@/lib/getTenantSlug'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export default function InvoiceDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [subdomain, setSubdomain] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    const sub = getTenantSlug()
    setSubdomain(sub)
    fetchInvoice(sub)
  }, [id])

  async function fetchInvoice(sub: string) {
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/invoices/${id}`,
        { withCredentials: true, headers: { 'x-tenant-slug': sub } }
      )
      setInvoice(res.data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invoice not found')
    } finally {
      setLoading(false)
    }
  }

  async function handlePayment() {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setPaying(true)
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/erp/invoices/${id}/payment`,
        { amount: parseFloat(paymentAmount) },
        { withCredentials: true, headers: { 'x-tenant-slug': subdomain } }
      )
      toast.success('Payment recorded!')
      setShowPaymentModal(false)
      setPaymentAmount('')
      fetchInvoice(subdomain)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to record payment')
    } finally {
      setPaying(false)
    }
  }

  async function handlePrint() {
    window.print()
  }

  function getPaymentStyle(status: string) {
    switch (status) {
      case 'PAID':    return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: '✓ PAID' }
      case 'PARTIAL': return { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA', label: '◐ PARTIAL' }
      default:        return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: '✗ UNPAID' }
    }
  }

  if (loading) {
    return (
      <TenantLayout title="Invoice" subtitle="">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F',
            borderRadius: '50%', animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      </TenantLayout>
    )
  }

  if (!invoice) {
    return (
      <TenantLayout title="Invoice" subtitle="">
        <div style={{ textAlign: 'center', padding: '80px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧾</div>
          <h3 style={{ color: '#0F172A' }}>Invoice not found</h3>
          <button onClick={() => router.push('/erp/invoices')} style={{
            marginTop: '16px', padding: '10px 20px',
            background: '#1E3A5F', color: '#fff',
            border: 'none', borderRadius: '8px',
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>← Back to Invoices</button>
        </div>
      </TenantLayout>
    )
  }

  const ps = getPaymentStyle(invoice.paymentStatus)

  return (
    <TenantLayout
      title={invoice.invoiceNumber}
      subtitle={`Created on ${new Date(invoice.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
      requiredModule="invoices"
      headerRight={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => router.push('/erp/invoices')}
            style={{
              padding: '8px 16px', background: '#F1F5F9',
              color: '#64748B', border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >← Back</button>
          {invoice.paymentStatus !== 'PAID' && (
            <button
              onClick={() => setShowPaymentModal(true)}
              style={{
                padding: '8px 16px', background: '#F0FDF4',
                color: '#16A34A', border: '1px solid #BBF7D0',
                borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >💳 Record Payment</button>
          )}
          <button
            onClick={handlePrint}
            style={{
              padding: '8px 16px', background: '#EFF6FF',
              color: '#1D4ED8', border: '1px solid #BFDBFE',
              borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >🖨️ Print</button>
          <button
            onClick={() => router.push(`/erp/invoices/${id}/edit`)}
            style={{
              padding: '8px 16px', background: '#1E3A5F',
              color: '#fff', border: 'none',
              borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >✏️ Edit</button>
        </div>
      }
    >
      {/* Invoice Card */}
      <div style={{
        maxWidth: '860px', margin: '0 auto',
        background: '#fff', borderRadius: '20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1E3A5F, #2E86AB)',
          padding: '32px 40px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{
                width: '44px', height: '44px', background: 'rgba(255,255,255,0.2)',
                borderRadius: '12px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '22px',
              }}>🏢</div>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '20px', textTransform: 'capitalize' }}>
                  {subdomain}
                </div>
                <div style={{ color: '#93C5FD', fontSize: '12px' }}>ERP System</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '28px', fontWeight: 900, color: '#fff',
              letterSpacing: '-0.5px', marginBottom: '6px',
            }}>
              {invoice.invoiceNumber}
            </div>
            <span style={{
              padding: '4px 14px', borderRadius: '99px',
              fontSize: '12px', fontWeight: 700,
              background: ps.bg, color: ps.color,
              border: `1px solid ${ps.border}`,
            }}>{ps.label}</span>
          </div>
        </div>

        {/* Bill To + Invoice Info */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '0', borderBottom: '1px solid #F1F5F9',
        }}>
          <div style={{ padding: '28px 40px', borderRight: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
              Bill To
            </p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
              {invoice.customerName || '—'}
            </p>
            {invoice.customerPhone && (
              <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '2px' }}>📞 {invoice.customerPhone}</p>
            )}
            {invoice.customerEmail && (
              <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '2px' }}>✉️ {invoice.customerEmail}</p>
            )}
            {invoice.customerAddress && (
              <p style={{ fontSize: '13px', color: '#64748B' }}>📍 {invoice.customerAddress}</p>
            )}
          </div>

          <div style={{ padding: '28px 40px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
              Invoice Details
            </p>
            {[
              { label: 'Invoice No', value: invoice.invoiceNumber },
              { label: 'Issue Date', value: new Date(invoice.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
              { label: 'Due Date', value: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set' },
              { label: 'Status', value: invoice.paymentStatus },
            ].map((row) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between',
                marginBottom: '8px',
              }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>{row.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Items Table */}
        <div style={{ padding: '0 40px 28px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '28px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['#', 'Product', 'SKU', 'Qty', 'Unit Price', 'Discount', 'Total'].map((h) => (
                  <th key={h} style={{
                    padding: '12px 14px', textAlign: h === '#' ? 'center' : 'left',
                    fontSize: '11px', fontWeight: 700,
                    color: '#64748B', textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '2px solid #E2E8F0',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((item: any, i: number) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <td style={{ padding: '14px', textAlign: 'center', fontSize: '13px', color: '#94A3B8', fontWeight: 600 }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: '14px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                      {item.productName || '—'}
                    </div>
                  </td>
                  <td style={{ padding: '14px' }}>
                    <span style={{
                      fontSize: '11px', color: '#7C3AED',
                      fontFamily: 'monospace', background: '#FAF5FF',
                      padding: '2px 8px', borderRadius: '6px',
                    }}>{item.productSku || '—'}</span>
                  </td>
                  <td style={{ padding: '14px', fontSize: '14px', color: '#374151', fontWeight: 600 }}>
                    {parseFloat(item.quantity).toLocaleString()}
                  </td>
                  <td style={{ padding: '14px', fontSize: '14px', color: '#374151' }}>
                    PKR {parseFloat(item.unitPrice || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '14px', fontSize: '14px', color: '#16A34A' }}>
                    {parseFloat(item.discount || 0) > 0 ? `PKR ${parseFloat(item.discount).toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '14px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                    PKR {parseFloat(item.totalPrice || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals + Notes */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 320px',
          borderTop: '1px solid #F1F5F9',
        }}>
          {/* Notes */}
          <div style={{ padding: '28px 40px' }}>
            {invoice.notes && (
              <>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Notes
                </p>
                <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6 }}>
                  {invoice.notes}
                </p>
              </>
            )}
          </div>

          {/* Totals */}
          <div style={{ padding: '28px 40px', borderLeft: '1px solid #F1F5F9' }}>
            {[
              { label: 'Subtotal', value: parseFloat(invoice.subtotal || 0), color: '#374151' },
              { label: 'Discount', value: -parseFloat(invoice.discount || 0), color: '#16A34A' },
              { label: 'Tax', value: parseFloat(invoice.tax || 0), color: '#EA580C' },
            ].map((row) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between',
                marginBottom: '10px',
              }}>
                <span style={{ fontSize: '13px', color: '#64748B' }}>{row.label}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: row.color }}>
                  PKR {Math.abs(row.value).toLocaleString()}
                </span>
              </div>
            ))}

            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '14px 16px', background: '#1E3A5F',
              borderRadius: '10px', marginTop: '8px', marginBottom: '12px',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Total</span>
              <span style={{ fontSize: '16px', fontWeight: 900, color: '#fff' }}>
                PKR {parseFloat(invoice.totalAmount || 0).toLocaleString()}
              </span>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>Amount Paid</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>
                PKR {parseFloat(invoice.paidAmount || 0).toLocaleString()}
              </span>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '10px 14px',
              background: parseFloat(invoice.dueAmount) <= 0 ? '#F0FDF4' : '#FEF2F2',
              borderRadius: '8px',
            }}>
              <span style={{
                fontSize: '13px', fontWeight: 700,
                color: parseFloat(invoice.dueAmount) <= 0 ? '#16A34A' : '#DC2626',
              }}>
                {parseFloat(invoice.dueAmount) <= 0 ? '✓ Fully Paid' : 'Balance Due'}
              </span>
              <span style={{
                fontSize: '14px', fontWeight: 800,
                color: parseFloat(invoice.dueAmount) <= 0 ? '#16A34A' : '#DC2626',
              }}>
                PKR {parseFloat(invoice.dueAmount || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 40px',
          borderTop: '1px solid #F1F5F9',
          background: '#F8FAFC',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '12px', color: '#94A3B8' }}>
            Thank you for your business! • Generated by MyERP
          </p>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 300,
        }}>
          <div style={{
            background: '#fff', borderRadius: '20px',
            padding: '32px', width: '100%', maxWidth: '400px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
              💳 Record Payment
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>
              Balance Due: <strong style={{ color: '#DC2626' }}>
                PKR {parseFloat(invoice.dueAmount || 0).toLocaleString()}
              </strong>
            </p>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Payment Amount (PKR)
            </label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Enter amount..."
              min="1"
              max={invoice.dueAmount}
              style={{
                width: '100%', padding: '12px 14px',
                border: '1.5px solid #E2E8F0', borderRadius: '10px',
                fontSize: '14px', outline: 'none',
                fontFamily: 'Inter, sans-serif', marginBottom: '20px',
              }}
              onFocus={(e) => e.target.style.borderColor = '#2E86AB'}
              onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
              autoFocus
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setShowPaymentModal(false); setPaymentAmount('') }}
                style={{
                  flex: 1, padding: '12px', background: '#F1F5F9',
                  color: '#64748B', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >Cancel</button>
              <button
                onClick={handlePayment}
                disabled={paying}
                style={{
                  flex: 1, padding: '12px',
                  background: paying ? '#94A3B8' : '#16A34A',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 600,
                  cursor: paying ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {paying ? 'Processing...' : '✓ Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          aside, header, button { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </TenantLayout>
  )
}