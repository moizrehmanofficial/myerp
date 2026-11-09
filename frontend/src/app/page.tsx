'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui'
import Landing from '@/components/landing/Landing'

export default function Home() {
  const router = useRouter()
  const [show, setShow] = useState<'wait' | 'landing'>('wait')

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

    // A company's own address goes straight to its sign-in; the main site shows the landing page
    if (isTenantSubdomain) router.replace('/erp-login')
    else setShow('landing')
  }, [router])

  if (show === 'landing') return <Landing />

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner label="Opening MyERP" />
    </div>
  )
}
