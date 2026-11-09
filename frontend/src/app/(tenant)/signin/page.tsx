'use client'

import { useEffect } from 'react'
import { ChartColumn, Layers, Package, Receipt } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { SignInForm } from '@/components/auth/SignInForm'
import { wakeServer } from '@/lib/tenantApi'

// One sign-in page for every company
export default function SignInPage() {
  useEffect(() => {
    wakeServer()
  }, [])

  return (
    <AuthShell
      brand="MyERP"
      brandSub="Sign in to your company"
      icon={<Layers />}
      points={[
        { icon: <Receipt />, title: 'Invoices and payments', text: 'Bill customers and see at once who still owes you.' },
        { icon: <Package />, title: 'Stock you can trust', text: 'Every sale, purchase and return updates stock by itself.' },
        { icon: <ChartColumn />, title: 'Books that keep themselves', text: 'Ledger, profit and loss and balance sheet, always up to date.' },
      ]}
    >
      <SignInForm />
    </AuthShell>
  )
}
