'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, ImageUp, KeyRound } from 'lucide-react'
import { Button, Card, CardHeader, Field, Input, Segmented } from '@/components/ui'
import { cn } from '@/utils/utils'

export const PLANS = [
  { key: 'FREE', label: 'Free' },
  { key: 'STARTER', label: 'Starter' },
  { key: 'PROFESSIONAL', label: 'Professional' },
  { key: 'ENTERPRISE', label: 'Enterprise' },
] as const

export type CompanyFormValue = {
  name: string
  slug: string
  ceoName: string
  ceoEmail: string
  ceoPassword: string
  plan: string
  moduleKeys: string[]
}

export function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
}

// Strong random password (crypto, not Math.random)
export function makePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#!'
  const bytes = new Uint32Array(14)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export function validateCompany(v: CompanyFormValue, creating: boolean) {
  const e: Partial<Record<keyof CompanyFormValue, string>> = {}
  if (v.name.trim().length < 2) e.name = 'Enter the company name'
  if (creating && !/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(v.slug)) e.slug = '3 to 30 lowercase letters, numbers or hyphens'
  if (!v.ceoName.trim()) e.ceoName = 'Enter the owner’s name'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.ceoEmail.trim())) e.ceoEmail = 'Enter a valid email'
  if ((creating || v.ceoPassword) && v.ceoPassword.length < 8) e.ceoPassword = 'At least 8 characters'
  if (!v.moduleKeys.length) e.moduleKeys = 'Pick at least one module'
  return e
}

export default function CompanyForm({
  value,
  onChange,
  modules,
  errors,
  creating,
  logoUrl,
  onLogo,
}: {
  value: CompanyFormValue
  onChange: (v: CompanyFormValue) => void
  modules: any[]
  errors: Partial<Record<keyof CompanyFormValue, string>>
  creating: boolean
  logoUrl?: string
  onLogo: (f: File | null) => void
}) {
  const [preview, setPreview] = useState(logoUrl || '')
  useEffect(() => setPreview(logoUrl || ''), [logoUrl])
  const set = (patch: Partial<CompanyFormValue>) => onChange({ ...value, ...patch })
  const toggle = (k: string) => set({ moduleKeys: value.moduleKeys.includes(k) ? value.moduleKeys.filter((x) => x !== k) : [...value.moduleKeys, k] })
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Company" />
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <Field label="Company name" required error={errors.name}>
            {(id) => <Input id={id} value={value.name} onChange={(e) => set(creating ? { name: e.target.value, slug: slugify(e.target.value) } : { name: e.target.value })} autoFocus={creating} />}
          </Field>
          <Field
            label="Login address"
            required={creating}
            error={errors.slug}
            hint={creating ? `${origin}/erp-login?company=${value.slug || 'your-company'}` : 'Cannot be changed after the company is created'}
          >
            {(id) => <Input id={id} value={value.slug} disabled={!creating} onChange={(e) => set({ slug: slugify(e.target.value) })} />}
          </Field>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[13px] font-medium text-ink-2">Plan</span>
            <Segmented label="Plan" options={[...PLANS]} value={value.plan as any} onChange={(v) => set({ plan: v })} />
          </div>
          <div className="flex items-center gap-4 sm:col-span-2">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] border border-line bg-subtle text-ink-3">
              {preview ? <img src={preview} alt="Company logo" className="size-full object-contain" /> : <ImageUp className="size-6" aria-hidden />}
            </div>
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-subtle">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    if (f && f.size > 2 * 1024 * 1024) return toast.error('The logo must be under 2 MB')
                    onLogo(f)
                    setPreview(f ? URL.createObjectURL(f) : logoUrl || '')
                  }}
                />
                {preview ? 'Change logo' : 'Upload logo'}
              </label>
              <p className="mt-1 text-xs text-ink-3">PNG, JPG, WebP or SVG, up to 2 MB. Optional.</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Owner login" description={creating ? 'The owner has full access and adds the rest of the team.' : 'Changes the owner’s sign-in for this company.'} />
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <Field label="Owner name" required error={errors.ceoName}>{(id) => <Input id={id} value={value.ceoName} onChange={(e) => set({ ceoName: e.target.value })} />}</Field>
          <Field label="Owner email" required error={errors.ceoEmail}>{(id) => <Input id={id} type="email" autoComplete="off" value={value.ceoEmail} onChange={(e) => set({ ceoEmail: e.target.value })} />}</Field>
          <Field label={creating ? 'Password' : 'New password'} required={creating} error={errors.ceoPassword} hint={creating ? 'At least 8 characters' : 'Leave empty to keep the current password'} className="sm:col-span-2">
            {(id) => (
              <div className="flex gap-2">
                <Input id={id} value={value.ceoPassword} autoComplete="new-password" onChange={(e) => set({ ceoPassword: e.target.value })} className="num" />
                <Button variant="secondary" icon={<KeyRound className="size-4" />} onClick={() => set({ ceoPassword: makePassword() })}>Generate</Button>
              </div>
            )}
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Modules"
          description={`${value.moduleKeys.length} of ${modules.length} turned on`}
          action={
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => set({ moduleKeys: modules.map((m) => m.key) })}>All</Button>
              <Button size="sm" variant="ghost" onClick={() => set({ moduleKeys: [] })}>None</Button>
            </div>
          }
        />
        {errors.moduleKeys && <p className="px-5 pt-3 text-xs text-bad">{errors.moduleKeys}</p>}
        <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {modules.map((m) => {
            const on = value.moduleKeys.includes(m.key)
            return (
              <button
                key={m.key}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(m.key)}
                className={cn(
                  'flex items-start gap-3 rounded-[var(--radius-control)] border p-3 text-left transition-colors',
                  on ? 'border-brand bg-brand-soft/60' : 'border-line hover:border-line-strong',
                )}
              >
                <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border', on ? 'border-brand bg-brand text-white' : 'border-line-strong')}>
                  {on && <Check className="size-3" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{m.name}</span>
                  {m.description && <span className="mt-0.5 block text-xs text-ink-3">{m.description}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
