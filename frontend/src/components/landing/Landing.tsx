'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import {
  BookOpen, Boxes, Building2, ChartColumn, Factory, FileText, Layers, Receipt,
  RotateCcw, ShieldCheck, ShoppingCart, Users,
} from 'lucide-react'
import { SignInForm } from '@/components/auth/SignInForm'
import { wakeServer } from '@/lib/tenantApi'

const MODULES = [
  { icon: <FileText />, title: 'Quotations and invoices', text: 'Quote a price, turn it into an invoice, record payments as they come in.' },
  { icon: <Boxes />, title: 'Stock', text: 'Every sale, purchase, return and production run moves stock, with a full history.' },
  { icon: <ShoppingCart />, title: 'Purchases', text: 'Order from suppliers, receive goods, and keep track of what you owe.' },
  { icon: <BookOpen />, title: 'Accounts', text: 'Double-entry books kept for you. Trial balance, ledgers and vouchers.' },
  { icon: <Users />, title: 'People', text: 'Employees, attendance, leave and payroll, with salaries posted to the books.' },
  { icon: <Factory />, title: 'Manufacturing', text: 'Turn raw materials into finished goods and carry their cost forward.' },
  { icon: <ChartColumn />, title: 'Reports', text: 'Profit and loss, balance sheet, cash flow, receivables and stock.' },
  { icon: <ShieldCheck />, title: 'Roles and audit log', text: 'Give each person only the screens they need. See who changed what.' },
]

export default function Landing() {
  // Start waking the server while the visitor reads the page
  useEffect(() => {
    wakeServer()
  }, [])

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* Top bar */}
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-nav text-white">
              <Layers className="size-[18px]" strokeWidth={1.8} aria-hidden />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">MyERP</span>
          </span>
          <Link href="/signin" className="text-sm font-medium text-brand hover:text-brand-hover">Sign in</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-line bg-canvas">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:py-20">
          <div>
            <h1 className="max-w-xl text-[34px] leading-[1.15] font-semibold tracking-tight sm:text-[44px]">
              One invoice. Stock, accounts and the customer’s balance all updated.
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-2">
              MyERP runs sales, purchases, stock, books and payroll for small and growing businesses in Pakistan.
              You do the work once, and every record that depends on it stays right.
            </p>

            <div id="signin" className="mt-9 max-w-md scroll-mt-6 rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
              <p className="mb-4 font-medium">Sign in to your company</p>
              <SignInForm compact />
            </div>
          </div>

          <FlowPreview />
        </div>
      </section>

      {/* Modules */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <h2 className="max-w-lg text-2xl font-semibold tracking-tight sm:text-[28px]">Everything a trading or manufacturing business keeps track of</h2>
        <p className="mt-3 max-w-xl text-ink-2">Each company gets its own separate database. Turn on only the parts you use.</p>
        <ul className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <li key={m.title}>
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand [&>svg]:size-[18px]">{m.icon}</span>
              <p className="mt-3 font-medium">{m.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{m.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-[13px] text-ink-3 sm:px-6">
          <p>© {new Date().getFullYear()} MyERP</p>
        </div>
      </footer>
    </div>
  )
}

// What happens when an invoice is issued, drawn with the app's own pieces
function FlowPreview() {
  const effects = [
    { icon: <Boxes />, title: 'Stock', line: 'Steel bracket', value: '−12 pcs', note: '148 left' },
    { icon: <BookOpen />, title: 'Accounts', line: 'Receivables  Dr', value: 'Rs 41,300', note: 'Sales and tax  Cr' },
    { icon: <Building2 />, title: 'Customer', line: 'Hamid Traders', value: 'Rs 41,300', note: 'Balance due' },
  ]
  return (
    <div aria-hidden className="select-none">
      <div className="rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-nav text-white"><Receipt className="size-[18px]" /></span>
            <div>
              <p className="text-sm font-semibold">INV-00128</p>
              <p className="text-xs text-ink-3">Hamid Traders</p>
            </div>
          </div>
          <span className="rounded-full bg-good-soft px-2.5 py-0.5 text-xs font-medium text-good">Issued</span>
        </div>
        <div className="flex items-center justify-between px-5 py-3 text-sm">
          <span className="text-ink-2">12 × Steel bracket</span>
          <span className="num font-semibold">Rs 41,300</span>
        </div>
      </div>

      <ul className="relative flex flex-col gap-2.5 pt-5 before:absolute before:top-0 before:bottom-[30px] before:left-4 before:border-l before:border-dashed before:border-line-strong">
        {effects.map((e) => (
          <li key={e.title} className="relative ml-9 flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 before:absolute before:top-1/2 before:-left-5 before:h-px before:w-5 before:border-t before:border-dashed before:border-line-strong">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand [&>svg]:size-4">{e.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink-3">{e.title}</p>
              <p className="truncate text-sm font-medium">{e.line}</p>
            </div>
            <div className="text-right">
              <p className="num text-sm font-semibold">{e.value}</p>
              <p className="text-xs text-ink-3">{e.note}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 ml-9 flex items-center gap-1.5 text-[13px] text-ink-3"><RotateCcw className="size-3.5" /> Cancel it later and all three go back.</p>
    </div>
  )
}
