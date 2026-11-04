'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import axios from 'axios'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm, loginErrorMessage } from '@/components/auth/LoginForm'
import { Button, Field, Input } from '@/components/ui'
import { ChartColumn, Package, Receipt } from 'lucide-react'

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
  const [code, setCode] = useState('')

  useEffect(() => {
    // Company comes from ?company=, then the subdomain, then the last company used
    let sub = searchParams.get('company')
    if (!sub) {
      const host = window.location.hostname
      const parts = host.split('.')
      if (parts.length >= 3 && !host.includes('vercel.app')) sub = parts[0]
    }
    if (!sub) sub = sessionStorage.getItem('tenant_slug_current')

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
        sessionStorage.setItem(`tenant_user_${sub}`, JSON.stringify(res.data.data))
        sessionStorage.setItem('tenant_slug_current', sub)
        window.location.href = `/erp/dashboard?company=${encodeURIComponent(sub)}`
        return
      }
    } catch (err: any) {
      toast.error(loginErrorMessage(err))
    }
    setLoading(false)
  }

  function openCompany(e: React.FormEvent) {
    e.preventDefault()
    const c = code.trim().toLowerCase()
    if (c) window.location.href = `/erp-login?company=${encodeURIComponent(c)}`
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
      {!ready ? null : subdomain ? (
        <LoginForm
          title="Sign in"
          description="Use the email and password your company admin gave you."
          loading={loading}
          onSubmit={handleLogin}
          footer="Forgot your password? Ask your company owner to reset it."
        />
      ) : (
        <form onSubmit={openCompany}>
          <div className="border-t border-line pt-6 text-center">
            <h1 className="text-[17px] font-semibold text-ink">Find your company</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-3">Enter your company code. Your company admin can tell you what it is.</p>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            <Field label="Company code" hint="For example: vertex-solutions">
              {(id) => (
                <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} className="h-11" autoFocus autoCapitalize="none" />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full">
              Continue
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  )
}