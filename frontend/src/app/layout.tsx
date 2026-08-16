import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MyERP — Super Admin',
  description: 'Multi-Tenant ERP SaaS Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}