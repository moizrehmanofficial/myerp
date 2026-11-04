'use client'

import { Toaster } from 'react-hot-toast'
import { Building2 } from 'lucide-react'

// Shared sign-in layout. Left panel (laptop and up) carries the brand on a
// ledger-paper pattern; on phones only the form shows, with a compact header.
export function AuthShell({
  brand,
  brandSub,
  logoUrl,
  icon,
  points,
  children,
}: {
  brand: string
  brandSub: string
  logoUrl?: string
  icon?: React.ReactNode
  points: string[]
  children: React.ReactNode
}) {
  const mark = (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-white">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-full object-contain p-1.5" />
      ) : (
        icon || <Building2 className="size-5" strokeWidth={1.8} aria-hidden />
      )}
    </span>
  )

  return (
    <div className="flex min-h-screen bg-canvas">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '14px', borderRadius: '10px' } }} />

      <aside
        className="relative hidden w-[44%] max-w-[620px] flex-col justify-between overflow-hidden bg-nav p-10 text-white lg:flex xl:p-14"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(255,255,255,0.045) 31px, rgba(255,255,255,0.045) 32px)',
        }}
      >
        {/* ledger margin line */}
        <span className="pointer-events-none absolute inset-y-0 left-[76px] w-px bg-[#2dd4bf]/25" aria-hidden />
        <div className="relative flex items-center gap-3 pl-12">
          {mark}
          <div>
            <p className="text-lg leading-tight font-semibold capitalize">{brand}</p>
            <p className="text-[13px] text-nav-muted">{brandSub}</p>
          </div>
        </div>

        <div className="relative pl-12">
          <p className="max-w-md text-[28px] leading-[1.25] font-semibold xl:text-[32px]">
            Sales, stock, accounts and staff in one place.
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-[15px] text-nav-text">
                <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[#2dd4bf]" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative pl-12 text-xs text-nav-muted">© {new Date().getFullYear()} MyERP</p>
      </aside>

      <main className="flex flex-1 flex-col">
        {/* Phone / tablet header */}
        <div className="flex items-center gap-3 bg-nav px-5 py-4 text-white lg:hidden">
          {mark}
          <div className="min-w-0">
            <p className="truncate font-semibold capitalize">{brand}</p>
            <p className="text-xs text-nav-muted">{brandSub}</p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </main>
    </div>
  )
}
