'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import axios from 'axios'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm, loginErrorMessage } from '@/components/auth/LoginForm'
import { Button, Field, Input } from '@/components/ui'
import { ChartColumn, Package, Receipt } from 'lucide-react'
import { wakeServer } from '@/lib/tenantApi'
import { NEW_LOGIN_ID_KEY, saveTenantSession } from '@/lib/tenantSession'
import Link from 'next/link'

export default function TenantLoginPage() {
  return (
    <Suspense fallback={null}>
      <TenantLoginForm />
    </Suspense>
  )
}

function TenantLoginForm() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [companyLogo, setCompanyLogo] = useState('')
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent'>('login')
  const [resetEmail, setResetEmail] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    wakeServer()
    // Company comes from ?company=, then the subdomain, then the last company used
    let sub = searchParams.get('company')
    if (!sub) {
      const host = window.location.hostname
      const parts = host.split('.')
      if (parts.length >= 3 && !host.includes('vercel.app')) sub = parts[0]
    }
    // No company in the address: everyone uses the new sign-in page now
    if (!sub) {
      window.location.replace('/signin')
      return
    }

    if (sub) {
      setSubdomain(sub)
      setCompanyName(sub.charAt(0).toUpperCase() + sub.slice(1))
      axios
        .get(`${process.env.NEXT_PUBLIC_API_URL}/tenant-auth/company-info`, { headers: { 'x-tenant-slug': sub } })
        .then((res) => {
          if (res.data.data?.logoUrl) setCompanyLogo(res.data.data.logoUrl)
          if (res.data.data?.name) setCompanyName(res.data.data.name)
        })
        .catch(() => {})
    }
    setReady(true)
  }, [searchParams])

  async function handleLogin(email: string, password: string) {
    const sub = subdomain
    setLoading(true)
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/tenant-auth/login`,
        { email, password },
        { withCredentials: true, headers: { 'x-tenant-slug': sub } },
      )
      if (res.data.success) {
        const d = res.data.data
        saveTenantSession(sub, d, d.companyName)
        // Tell them their new login ID once, on the dashboard
        if (d.loginId) {
          try { sessionStorage.setItem(NEW_LOGIN_ID_KEY, d.loginId) } catch {}
        }
        window.location.href = '/erp/dashboard'
        return
      }
    } catch (err: any) {
      toast.error(loginErrorMessage(err))
    }
    setLoading(false)
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) return toast.error('Enter the email you sign in with.')
    setSending(true)
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/tenant-auth/forgot-password`,
        { email: resetEmail.trim() },
        { headers: { 'x-tenant-slug': subdomain } },
      )
      setMode('sent')
    } catch (err: any) {
      toast.error(loginErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthShell
      brand={companyName || 'MyERP'}
      brandSub={companyName ? 'Company workspace' : 'Business management software'}
      logoUrl={companyLogo || undefined}
      points={[
        { icon: <Receipt />, title: 'Invoices and payments', text: 'Bill customers and see at once who still owes you.' },
        { icon: <Package />, title: 'Stock you can trust', text: 'Every sale, purchase and return updates stock by itself.' },
        { icon: <ChartColumn />, title: 'Books that keep themselves', text: 'Ledger, profit and loss and balance sheet, always up to date.' },
      ]}
    >
      {!ready ? null : subdomain && mode === 'login' ? (
        <LoginForm
          title="Sign in"
          description="Sign-in has changed: you now use a login ID like name@company. This old email sign-in still works for a short time."
          loading={loading}
          onSubmit={handleLogin}
          notice={
            <Link href="/signin" className="font-medium text-brand hover:underline">Use the new sign-in with your login ID</Link>
          }
          footer={
            <button type="button" onClick={() => setMode('forgot')} className="font-medium text-brand hover:underline">
              Forgot your password?
            </button>
          }
        />
      ) : subdomain && mode === 'forgot' ? (
        <form onSubmit={sendReset} noValidate>
          <div className="border-t border-line pt-6 text-center">
            <h1 className="text-[17px] font-semibold text-ink">Reset your password</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-3">Enter the email you sign in with. We will send you a link to choose a new password.</p>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            <Field label="Email">
              {(id) => <Input id={id} type="email" autoComplete="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="h-11" autoFocus />}
            </Field>
            <Button type="submit" size="lg" loading={sending} className="w-full">Send reset link</Button>
          </div>
          <p className="mt-6 text-center text-[13px]">
            <button type="button" onClick={() => setMode('login')} className="font-medium text-brand hover:underline">Back to sign in</button>
          </p>
        </form>
      ) : subdomain && mode === 'sent' ? (
        <div className="border-t border-line pt-6 text-center">
          <h1 className="text-[17px] font-semibold text-ink">Check your email</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
            If <span className="font-medium text-ink-2">{resetEmail.trim()}</span> has an account here, a reset link is on its way. It works for one hour.
            Not there? Check spam, or ask your company owner to reset your password.
          </p>
          <Button variant="secondary" className="mt-6 w-full" onClick={() => setMode('login')}>Back to sign in</Button>
        </div>
      ) : null}
    </AuthShell>
  )
}