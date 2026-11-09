'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Copy, ExternalLink, HardDrive, Pause, Play, Save, Trash2 } from 'lucide-react'
import api from '@/lib/axios'
import AdminLayout from '@/components/layout/AdminLayout'
import { Badge, Button, Card, CardHeader, Spinner, StatusBadge, EmptyState, buttonStyles, useConfirm } from '@/components/ui'
import CompanyForm, { PLANS, type CompanyFormValue, validateCompany } from '@/components/admin/CompanyForm'
import { apiError } from '@/lib/tenantApi'
import { date } from '@/lib/format'

type Props = { params: Promise<{ id: string }> }

export default function CompanyDetailPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const [company, setCompany] = useState<any>(null)
  const [modules, setModules] = useState<any[]>([])
  const [value, setValue] = useState<CompanyFormValue | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyFormValue, string>>>({})
  const [logo, setLogo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirm, confirmDialog] = useConfirm()

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([api.get(`/companies/${id}`), api.get('/companies/modules')])
      const d = c.data.data
      setCompany(d)
      setModules(m.data.data || [])
      setValue({
        name: d.name, slug: d.slug, ceoName: d.ceoName, ceoEmail: d.ceoEmail, ceoPassword: '', plan: d.plan,
        moduleKeys: (d.modules || []).map((x: any) => x.module?.key).filter(Boolean),
      })
      setLogo(null)
    } catch (err) {
      toast.error(apiError(err, 'Could not load this company.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const url = typeof window !== 'undefined' ? `${window.location.origin}/signin` : '/signin'

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!value) return
    const errs = validateCompany(value, false)
    setErrors(errs)
    if (Object.keys(errs).length) return toast.error('Check the highlighted fields.')
    setSaving(true)
    try {
      const body: any = { name: value.name.trim(), ceoName: value.ceoName.trim(), ceoEmail: value.ceoEmail.trim().toLowerCase(), plan: value.plan, moduleKeys: value.moduleKeys }
      if (value.ceoPassword) body.ceoPassword = value.ceoPassword
      await api.patch(`/companies/${id}`, body)
      if (logo) {
        const fd = new FormData()
        fd.append('logo', logo)
        await api.post(`/companies/${id}/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).catch(() => toast.error('Saved, but the logo did not upload.'))
      }
      toast.success(value.ceoPassword ? 'Saved. The owner’s password was changed.' : 'Saved')
      load()
    } catch (err) {
      toast.error(apiError(err, 'Could not save.'))
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(next: 'suspend' | 'activate') {
    if (next === 'suspend') {
      const ok = await confirm({ title: `Suspend ${company.name}?`, message: 'Nobody in this company can sign in until you activate it again. Their data is kept.', confirmLabel: 'Suspend', danger: true })
      if (!ok) return
    }
    setBusy(next)
    try {
      await api.patch(`/companies/${id}/${next}`)
      toast.success(next === 'suspend' ? 'Company suspended' : 'Company active again')
      load()
    } catch (err) {
      toast.error(apiError(err, 'Could not change the status.'))
    } finally {
      setBusy('')
    }
  }

  async function backup() {
    setBusy('backup')
    try {
      await api.post(`/backups/company/${company.slug}`)
      toast.success('Backup finished')
      load()
    } catch (err) {
      toast.error(apiError(err, 'The backup failed.'))
    } finally {
      setBusy('')
    }
  }

  async function download(b: any) {
    try {
      const r = await api.get(`/backups/${b.id}/download`)
      window.open(r.data.data.url, '_blank', 'noopener')
    } catch (err) {
      toast.error(apiError(err, 'Could not get the download link.'))
    }
  }

  async function remove() {
    const ok = await confirm({ title: `Delete ${company.name}?`, message: 'The company disappears from the list and nobody can sign in. Its database is kept so it can be recovered.', confirmLabel: 'Delete company', danger: true })
    if (!ok) return
    try {
      await api.delete(`/companies/${id}`)
      toast.success(`${company.name} deleted`)
      router.push('/companies')
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the company.'))
    }
  }

  return (
    <AdminLayout
      title={company?.name || 'Company'}
      subtitle={company ? `${company.slug}, created ${date(company.createdAt)}` : undefined}
      headerRight={
        <>
          <Link href="/companies" className={buttonStyles({ variant: 'ghost' })}><ArrowLeft className="size-4" aria-hidden />Companies</Link>
          {company && <Button icon={<Save className="size-4" />} onClick={() => save()} loading={saving}>Save changes</Button>}
        </>
      }
    >
      {loading ? (
        <Spinner label="Loading company" />
      ) : !company || !value ? (
        <Card><EmptyState title="Company not found" /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <form onSubmit={save}>
            <CompanyForm value={value} onChange={setValue} modules={modules} errors={errors} creating={false} logoUrl={company.logoUrl || ''} onLogo={setLogo} />
            <button type="submit" className="hidden" />
          </form>

          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader title="Status" />
              <div className="flex flex-col gap-3 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <StatusBadge status={company.status} />
                  <Badge tone="brand">{PLANS.find((p) => p.key === company.plan)?.label || company.plan} plan</Badge>
                </div>
                <div className="rounded-[var(--radius-control)] bg-subtle px-3 py-2">
                  <p className="text-xs text-ink-3">Sign-in page (same for every company)</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="num min-w-0 flex-1 truncate text-[13px] font-medium text-ink" title={url}>{url}</p>
                    <button type="button" className="rounded p-1 text-ink-3 hover:bg-surface hover:text-ink" aria-label="Copy login link" onClick={() => navigator.clipboard?.writeText(url).then(() => toast.success('Link copied'))}><Copy className="size-4" /></button>
                    <a href={url} target="_blank" rel="noopener" className="rounded p-1 text-ink-3 hover:bg-surface hover:text-ink" aria-label="Open login page"><ExternalLink className="size-4" /></a>
                  </div>
                </div>
                <div className="rounded-[var(--radius-control)] bg-subtle px-3 py-2">
                  <p className="text-xs text-ink-3">Owner login ID</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="num min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{company.ownerLoginId || `name@${company.slug}`}</p>
                    {company.ownerLoginId && (
                      <button type="button" className="rounded p-1 text-ink-3 hover:bg-surface hover:text-ink" aria-label="Copy owner login ID" onClick={() => navigator.clipboard?.writeText(company.ownerLoginId).then(() => toast.success('Login ID copied'))}><Copy className="size-4" /></button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-3">Everyone in this company signs in as name@{company.slug}</p>
                </div>
                {company.status === 'ACTIVE' ? (
                  <Button variant="danger-soft" icon={<Pause className="size-4" />} loading={busy === 'suspend'} onClick={() => setStatus('suspend')}>Suspend company</Button>
                ) : (
                  <Button variant="secondary" icon={<Play className="size-4" />} loading={busy === 'activate'} onClick={() => setStatus('activate')}>Activate company</Button>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Backups" description="Latest 5" action={<Button size="sm" variant="secondary" icon={<HardDrive className="size-3.5" />} loading={busy === 'backup'} onClick={backup}>Back up now</Button>} />
              {(company.backupLogs || []).length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-ink-3">No backups yet</p>
              ) : (
                <ul className="divide-y divide-line">
                  {company.backupLogs.map((b: any) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                      <div>
                        <p className="text-sm text-ink">{date(b.createdAt)} <span className="text-xs text-ink-3">{String(b.type || '').toLowerCase()}</span></p>
                        <p className="text-xs text-ink-3">{b.status === 'COMPLETED' ? `${Number(b.fileSizeMb || 0).toFixed(2)} MB` : b.errorMsg || b.status}</p>
                      </div>
                      {b.status === 'COMPLETED' ? (
                        <Button size="sm" variant="ghost" onClick={() => download(b)}>Download</Button>
                      ) : (
                        <Badge tone={b.status === 'FAILED' ? 'bad' : 'warn'}>{b.status === 'FAILED' ? 'Failed' : 'Running'}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="border-bad/30">
              <CardHeader title="Delete company" description="Hides it and blocks sign-in. The data stays in the database." />
              <div className="p-4 sm:p-5">
                <Button variant="danger-soft" icon={<Trash2 className="size-4" />} onClick={remove}>Delete company</Button>
              </div>
            </Card>
          </div>
        </div>
      )}
      {confirmDialog}
    </AdminLayout>
  )
}
