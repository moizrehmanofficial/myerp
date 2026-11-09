'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import axios from 'axios'
import { ChartColumn, CircleCheck, Package, Receipt } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { loginErrorMessage } from '@/components/auth/LoginForm'
import { Button, Field, Input, buttonStyles } from '@/components/ui'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  )
}

function ResetPassword() {
  const params = useSearchParams()
  const slug = params.get('company') || ''
  const token = params.get('token') || ''
  const [company, setCompany] = useState({ name: '', logoUrl: '' })
  const [pw, setPw] = useState({ a: '', b: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!slug) return
    setCompany({ name: slug.charAt(0).toUpperCase() + slug.slice(1), logoUrl: '' })
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/tenant-auth/company-info`, { headers: { 'x-tenant-slug': slug } })
      .then((r) => r.data.data && setCompany({ name: r.data.data.name || slug, logoUrl: r.data.data.logoUrl || '' }))
      .catch(() => {})
  }, [slug])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (pw.a.length < 8) return setError('The password must be at least 8 characters.')
    if (pw.a !== pw.b) return setError('The two passwords are not the same.')
    setError('')
    setSaving(true)
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/tenant-auth/reset-password`, { token, password: pw.a }, { headers: { 'x-tenant-slug': slug } })
      setDone(true)
    } catch (err: any) {
      setError(loginErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const loginUrl = `/erp-login?company=${encodeURIComponent(slug)}`

  return (
    <AuthShell
      brand={company.name || 'MyERP'}
      brandSub="Company workspace"
      logoUrl={company.logoUrl || undefined}
      points={[
        { icon: <Receipt />, title: 'Invoices and payments', text: 'Bill customers and see at once who still owes you.' },
        { icon: <Package />, title: 'Stock you can trust', text: 'Every sale, purchase and return updates stock by itself.' },
        { icon: <ChartColumn />, title: 'Books that keep themselves', text: 'Ledger, profit and loss and balance sheet, always up to date.' },
      ]}
    >
      {!slug || !token ? (
        <div className="border-t border-line pt-6 text-center">
          <h1 className="text-[17px] font-semibold text-ink">This link is not complete</h1>
          <p className="mt-2 text-[13px] text-ink-3">Open the link from your email again, or ask for a new one on the sign-in page.</p>
        </div>
      ) : done ? (
        <div className="border-t border-line pt-6 text-center">
          <CircleCheck className="mx-auto size-8 text-good" aria-hidden />
          <h1 className="mt-2 text-[17px] font-semibold text-ink">Password changed</h1>
          <p className="mt-1 text-[13px] text-ink-3">Sign in with your new password.</p>
          <Link href={loginUrl} className={buttonStyles({ size: 'lg', className: 'mt-6 w-full' })}>Go to sign in</Link>
        </div>
      ) : (
        <form onSubmit={save} noValidate>
          <div className="border-t border-line pt-6 text-center">
            <h1 className="text-[17px] font-semibold text-ink">Choose a new password</h1>
            <p className="mt-1 text-[13px] text-ink-3">At least 8 characters.</p>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            <Field label="New password">{(id) => <Input id={id} type="password" autoComplete="new-password" className="h-11" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} autoFocus />}</Field>
            <Field label="New password again" error={error || undefined}>{(id) => <Input id={id} type="password" autoComplete="new-password" className="h-11" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />}</Field>
            <Button type="submit" size="lg" loading={saving} className="w-full">Save new password</Button>
          </div>
          <p className="mt-6 text-center text-[13px]"><Link href={loginUrl} className="font-medium text-brand hover:underline">Back to sign in</Link></p>
        </form>
      )}
    </AuthShell>
  )
}
