'use client'

import { useState } from 'react'
import axios from 'axios'
import { Eye, EyeOff } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui'
import { loginErrorMessage } from '@/components/auth/LoginForm'
import { LOGIN_ID_HINT, loginIdError } from '@/lib/loginId'
import { saveTenantSession } from '@/lib/tenantSession'

const API = process.env.NEXT_PUBLIC_API_URL

// One sign-in for every company: login ID (name@company) + password.
// Used on /signin and on the landing page.
export function SignInForm({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<'signin' | 'forgot' | 'sent'>('signin')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [idError, setIdError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  // ".com" is pointed out while typing, before anything is sent
  function onIdChange(v: string) {
    setLoginId(v)
    setFormError('')
    const at = v.lastIndexOf('@')
    setIdError(at > 0 && v.slice(at + 1).includes('.') ? loginIdError(v) || '' : '')
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    const err = loginIdError(loginId)
    if (err) return setIdError(err)
    if (!password) return setFormError('Enter your password.')
    setBusy(true)
    setFormError('')
    try {
      const res = await axios.post(
        `${API}/tenant-auth/signin`,
        { loginId: loginId.trim().toLowerCase(), password },
        { withCredentials: true, timeout: 60_000 },
      )
      const d = res.data?.data
      if (d?.slug) {
        saveTenantSession(d.slug, d, d.companyName)
        window.location.href = '/erp/dashboard'
        return
      }
      setFormError('Could not sign in. Please try again.')
    } catch (err) {
      setFormError(loginErrorMessage(err))
    }
    setBusy(false)
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault()
    const err = loginIdError(loginId)
    if (err) return setIdError(err)
    setBusy(true)
    try {
      await axios.post(`${API}/tenant-auth/forgot-password`, { loginId: loginId.trim().toLowerCase() }, { timeout: 60_000 })
      setMode('sent')
    } catch (err) {
      setFormError(loginErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const idField = (
    <Field label="Login ID" error={idError || undefined} hint={idError ? undefined : LOGIN_ID_HINT}>
      {(id) => (
        <Input
          id={id}
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="name@companyname"
          value={loginId}
          onChange={(e) => onIdChange(e.target.value)}
          onBlur={() => loginId.trim() && setIdError(loginIdError(loginId) || '')}
          aria-invalid={!!idError}
          className="h-11"
        />
      )}
    </Field>
  )

  if (mode === 'sent') {
    return (
      <div className={compact ? '' : 'border-t border-line pt-6'}>
        <h2 className="text-[17px] font-semibold text-ink">Check your email</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          If <span className="font-medium text-ink-2">{loginId.trim().toLowerCase()}</span> has an email on file, a reset link is on its way. It works for one hour.
          No email? Ask your company owner to set a new password for you.
        </p>
        <Button variant="secondary" className="mt-6 w-full" onClick={() => setMode('signin')}>Back to sign in</Button>
      </div>
    )
  }

  return (
    <form onSubmit={mode === 'signin' ? signIn : sendReset} noValidate>
      {!compact && (
        <div className="border-t border-line pt-6 text-center">
          <h1 className="text-[17px] font-semibold text-ink">{mode === 'signin' ? 'Sign in' : 'Reset your password'}</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
            {mode === 'signin'
              ? 'Use the login ID and password your company gave you.'
              : 'Enter your login ID. We will email a reset link to the address saved on your account.'}
          </p>
        </div>
      )}

      <div className={compact ? 'flex flex-col gap-4' : 'mt-6 flex flex-col gap-4'}>
        {idField}

        {mode === 'signin' && (
          <Field label="Password">
            {(id) => (
              <div className="relative">
                <Input
                  id={id}
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFormError('') }}
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-3 hover:text-ink"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </div>
            )}
          </Field>
        )}

        {formError && (
          <p role="alert" className="rounded-[var(--radius-control)] border border-bad/25 bg-bad-soft px-3 py-2 text-[13px] text-bad">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" loading={busy} className="w-full">
          {mode === 'signin' ? 'Sign in' : 'Send reset link'}
        </Button>
      </div>

      <p className="mt-5 text-center text-[13px]">
        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'forgot' : 'signin'); setFormError('') }}
          className="font-medium text-brand hover:underline"
        >
          {mode === 'signin' ? 'Forgot your password?' : 'Back to sign in'}
        </button>
      </p>
    </form>
  )
}
