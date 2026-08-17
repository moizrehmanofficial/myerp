'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

    if (isTenantSubdomain) {
      router.replace('/erp-login')
    } else {
      router.replace('/login')
    }
  }, [router])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: '#F8FAFC',
    }}>
      <div style={{
        width: '40px', height: '40px',
        border: '3px solid #E2E8F0', borderTopColor: '#1E3A5F',
        borderRadius: '50%', animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}