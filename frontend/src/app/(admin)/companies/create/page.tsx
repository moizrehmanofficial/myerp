'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, Building2, CircleCheck, Copy } from 'lucide-react'
import api from '@/lib/axios'
import AdminLayout from '@/components/layout/AdminLayout'
import { Button, Card, Spinner, buttonStyles } from '@/components/ui'
import CompanyForm, { type CompanyFormValue, validateCompany } from '@/components/admin/CompanyForm'
import { apiError } from '@/lib/tenantApi'

const EMPTY: CompanyFormValue = { name: '', slug: '', ceoName: '', ceoEmail: '', ceoPassword: '', plan: 'FREE', moduleKeys: [] }

export default function CreateCompanyPage() {
  const [modules, setModules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [value, setValue] = useState(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyFormValue, string>>>({})
  const [logo, setLogo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<{ name: string; url: string; email: string; password: string } | null>(null)

  useEffect(() => {
    api
      .get('/companies/modules')
      .then((r) => {
        const list = r.data.data || []
        setModules(list)
        setValue((v) => ({ ...v, moduleKeys: list.map((m: any) => m.key) }))
      })
      .catch((err) => toast.error(apiError(err, 'Could not load modules.')))
      .finally(() => setLoading(false))
  }, [])

  async function create(e?: React.FormEvent) {
    e?.preventDefault()
    const errs = validateCompany(value, true)
    setErrors(errs)
    if (Object.keys(errs).length) return toast.error('Check the highlighted fields.')
    setSaving(true)
    try {
      const res = await api.post('/companies', { ...value, name: value.name.trim(), ceoName: value.ceoName.trim(), ceoEmail: value.ceoEmail.trim().toLowerCase() })
      const company = res.data.data
      if (logo && company?.id) {
        try {
          const fd = new FormData()
          fd.append('logo', logo)
          await api.post(`/companies/${company.id}/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        } catch {
          toast.error('Company created, but the logo did not upload. Add it from the company page.')
        }
      }
      setCreated({
        name: value.name.trim(),
        url: `${window.location.origin}/erp-login?company=${value.slug}`,
        email: value.ceoEmail.trim().toLowerCase(),
        password: value.ceoPassword,
      })
    } catch (err) {
      toast.error(apiError(err, 'Could not create the company.'))
    } finally {
      setSaving(false)
    }
  }

  function copy(text: string, what: string) {
    navigator.clipboard?.writeText(text).then(() => toast.success(`${what} copied`), () => toast.error('Could not copy'))
  }

  if (created) {
    const all = `${created.name}\nLogin: ${created.url}\nEmail: ${created.email}\nPassword: ${created.password}`
    return (
      <AdminLayout title="Company created">
        <Card className="mx-auto max-w-xl">
          <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-good-soft text-good"><CircleCheck className="size-6" aria-hidden /></span>
            <h2 className="mt-3 text-lg font-semibold text-ink">{created.name} is ready</h2>
            <p className="mt-1 text-sm text-ink-3">Send these sign-in details to the owner. The password is not shown again.</p>
          </div>
          <dl className="mx-5 mb-5 divide-y divide-line rounded-[var(--radius-control)] border border-line text-sm">
            {[
              ['Login page', created.url],
              ['Email', created.email],
              ['Password', created.password],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 px-4 py-3">
                <dt className="w-24 shrink-0 text-ink-3">{k}</dt>
                <dd className="num min-w-0 flex-1 truncate font-medium text-ink" title={v}>{v}</dd>
                <button type="button" onClick={() => copy(v, k)} className="rounded p-1 text-ink-3 hover:bg-subtle hover:text-ink" aria-label={`Copy ${k.toLowerCase()}`}>
                  <Copy className="size-4" />
                </button>
              </div>
            ))}
          </dl>
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
            <Link href="/companies" className={buttonStyles({ variant: 'secondary' })}>Back to companies</Link>
            <Button icon={<Copy className="size-4" />} onClick={() => copy(all, 'All details')}>Copy all details</Button>
          </div>
        </Card>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title="New company"
      subtitle="Creates the company’s own database, its owner login and default accounts"
      headerRight={
        <Link href="/companies" className={buttonStyles({ variant: 'ghost' })}>
          <ArrowLeft className="size-4" aria-hidden />
          Companies
        </Link>
      }
    >
      {loading ? (
        <Spinner label="Loading" />
      ) : (
        <form onSubmit={create} className="mx-auto flex max-w-4xl flex-col gap-5">
          <CompanyForm value={value} onChange={setValue} modules={modules} errors={errors} creating onLogo={setLogo} />
          <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-[var(--radius-panel)] sm:border">
            <p className="hidden text-[13px] text-ink-3 sm:block">This takes a few seconds.</p>
            <Button type="submit" icon={<Building2 className="size-4" />} loading={saving} className="w-full sm:w-auto">
              {saving ? 'Creating company' : 'Create company'}
            </Button>
          </div>
        </form>
      )}
    </AdminLayout>
  )
}
