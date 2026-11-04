'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ShieldCheck } from 'lucide-react'
import api from '@/lib/axios'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm, loginErrorMessage } from '@/components/auth/LoginForm'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // If accessed from a tenant subdomain, redirect to erp-login
    const host = window.location.hostname
    const parts = host.split('.')
    const subdomain = parts[0]
    const isTenant =
      parts.length >= 3 &&
      !host.includes('vercel.app') &&
      subdomain !== 'localhost' &&
      subdomain !== 'www' &&
      subdomain !== 'admin'

    if (isTenant) {
      router.replace('/erp-login')
      return
    }
    setChecking(false)
  }, [router])

  async function handleLogin(email: string, password: string) {
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      if (res.data.success) {
        sessionStorage.setItem('admin_user', JSON.stringify(res.data.data))
        router.push('/dashboard')
        return
      }
    } catch (err: any) {
      toast.error(loginErrorMessage(err))
    }
    setLoading(false)
  }

  if (checking) return null

  return (
    <AuthShell
      brand="MyERP"
      brandSub="Platform administration"
      icon={<ShieldCheck className="size-5" strokeWidth={1.8} aria-hidden />}
      points={[
        'Create a workspace for each client company',
        'Choose which modules every company gets',
        'Watch backups and subscriptions in one list',
      ]}
    >
      <LoginForm
        title="Admin sign in"
        description="For MyERP platform administrators only. Company staff sign in from their company link."
        loading={loading}
        onSubmit={handleLogin}
      />
    </AuthShell>
  )
}
