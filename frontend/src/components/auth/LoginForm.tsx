'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui'

// Email + password form used by both the company and the admin sign-in
export function LoginForm({
  title,
  description,
  loading,
  onSubmit,
  footer,
  notice,
}: {
  title: string
  description: string
  loading: boolean
  onSubmit: (email: string, password: string) => void
  footer?: React.ReactNode
  notice?: React.ReactNode
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setError('')
    onSubmit(email.trim(), password)
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="border-t border-line pt-6 text-center">
        <h1 className="text-[17px] font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{description}</p>
        {notice && <p className="mt-2 text-[13px]">{notice}</p>}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <Field label="Email">
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              autoFocus
            />
          )}
        </Field>

        <Field label="Password" error={error || undefined}>
          {(id) => (
            <div className="relative">
              <Input
                id={id}
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

        <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
          Sign in
        </Button>
      </div>

      {footer && <div className="mt-6 text-center text-[13px] text-ink-3">{footer}</div>}
    </form>
  )
}

// Friendly text for login errors (incl. rate limiting)
export function loginErrorMessage(err: any) {
  const m = err?.response?.data?.message
  if (err?.response?.status === 429) {
    return typeof m === 'string' && m.startsWith('Too many wrong tries') ? m : 'Too many attempts. Wait a minute, then try again.'
  }
  if (err?.code === 'ECONNABORTED') return 'The server took too long to answer. Please try again.'
  if (!err?.response) return 'Cannot reach the server. Check your internet connection and try again.'
  return err?.response?.data?.message || 'Sign in failed. Check your email and password.'
}
