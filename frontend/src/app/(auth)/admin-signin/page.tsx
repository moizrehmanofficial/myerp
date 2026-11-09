'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ShieldCheck, Building2, Puzzle, HardDrive } from 'lucide-react'
import api from '@/lib/axios'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm, loginErrorMessage } from '@/components/auth/LoginForm'
import { wakeServer } from '@/lib/tenantApi'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    wakeServer()
    // On a company sub-domain, send people to the company sign-in
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
      router.replace('/signin')
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
      headline="Manage every company on MyERP from one place."
      points={[
        { icon: <Building2 />, title: 'Company workspaces', text: 'Create a separate, private workspace for each client company.' },
        { icon: <Puzzle />, title: 'Modules per company', text: 'Choose exactly which parts of the ERP every company gets.' },
        { icon: <HardDrive />, title: 'Backups in one list', text: 'See every backup and download one when you need it.' },
      ]}
    >
      <LoginForm
        title="Admin sign in"
        description="For MyERP platform administrators only. Company staff sign in on the main sign-in page with their login ID."
        loading={loading}
        onSubmit={handleLogin}
      />
    </AuthShell>
  )
}
