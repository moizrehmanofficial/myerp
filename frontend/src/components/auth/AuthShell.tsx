'use client'

import { Toaster } from 'react-hot-toast'
import { Layers } from 'lucide-react'

// Shared sign-in layout.
// Right: a card with the company's logo and name, then the form (all screens).
// Left (laptop and up): the MyERP product panel. Plain navy, no patterns.
export function AuthShell({
  brand,
  brandSub,
  logoUrl,
  icon,
  headline = 'Run sales, stock, accounts and people from one place.',
  points,
  children,
}: {
  brand: string
  brandSub: string
  logoUrl?: string
  icon?: React.ReactNode
  headline?: string
  points: { icon: React.ReactNode; title: string; text: string }[]
  children: React.ReactNode
}) {
  const initials = brand
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex min-h-screen bg-canvas">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '14px', borderRadius: '10px' } }} />

      {/* Product panel */}
      <aside className="hidden w-[42%] max-w-[600px] flex-col justify-between bg-nav px-12 py-10 text-white lg:flex xl:px-16 xl:py-14">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
            <Layers className="size-[18px]" strokeWidth={1.8} aria-hidden />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">MyERP</span>
        </div>

        <div>
          <h2 className="max-w-md text-[32px] leading-[1.2] font-semibold tracking-tight xl:text-[36px]">
            {headline}
          </h2>
          <ul className="mt-10 flex flex-col gap-6">
            {points.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-white [&>svg]:size-5">
                  {p.icon}
                </span>
                <div>
                  <p className="text-[15px] font-medium text-white">{p.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-nav-text">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-nav-muted">© {new Date().getFullYear()} MyERP. All rights reserved.</p>
      </aside>

      {/* Sign-in */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[440px]">
          <div className="rounded-2xl border border-line bg-surface px-6 py-8 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.06)] sm:px-10 sm:py-10">
            {/* Who you are signing in to */}
            <div className="mb-8 flex flex-col items-center text-center">
              <span className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={`${brand} logo`} className="size-full object-contain p-2.5" />
                ) : icon ? (
                  <span className="flex size-full items-center justify-center bg-nav text-white [&>svg]:size-8">{icon}</span>
                ) : (
                  <span className="flex size-full items-center justify-center bg-nav text-2xl font-semibold text-white">{initials || 'M'}</span>
                )}
              </span>
              <p className="mt-4 text-2xl leading-tight font-semibold tracking-tight text-ink">{brand}</p>
              <p className="mt-1 text-sm text-ink-3">{brandSub}</p>
            </div>
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-ink-3 lg:hidden">© {new Date().getFullYear()} MyERP</p>
        </div>
      </main>
    </div>
  )
}