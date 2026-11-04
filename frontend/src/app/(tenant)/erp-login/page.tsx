'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import axios from 'axios'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm, loginErrorMessage } from '@/components/auth/LoginForm'
import { Button, Field, Input } from '@/components/ui'

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
      brandSub={companyName ? 'Company workspace' : 'Business management'}
      logoUrl={companyLogo || undefined}
      points={[
        'Create invoices and track who has paid',
        'Know your stock levels at a glance',
        'Accounts and reports that update themselves',
      ]}
    >
      {!ready ? null : subdomain ? (
        <LoginForm
          title="Sign in"
          description={`Use the email and password your ${companyName || 'company'} admin gave you.`}
          loading={loading}
          onSubmit={handleLogin}
          footer="Forgot your password? Ask your company owner to reset it."
        />
      ) : (
        <form onSubmit={openCompany}>
          <h1 className="text-[22px] font-semibold text-ink">Find your company</h1>
          <p className="mt-1 text-sm text-ink-3">
            Enter your company code. It is the first part of your company&apos;s MyERP link.
          </p>
          <div className="mt-7 flex flex-col gap-4">
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
