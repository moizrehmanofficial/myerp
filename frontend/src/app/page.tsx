'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const host = window.location.hostname
    const parts = host.split('.')
    const subdomain = parts[0]

    const isTenantSubdomain =
      parts.length >= 3 &&
      !host.includes('vercel.app') &&
      subdomain !== 'localhost' &&
      subdomain !== 'www' &&
      subdomain !== 'admin'

    router.replace(isTenantSubdomain ? '/erp-login' : '/login')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner label="Opening MyERP" />
    </div>
  )
}
