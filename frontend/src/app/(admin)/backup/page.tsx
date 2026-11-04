'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Download, HardDrive } from 'lucide-react'
import api from '@/lib/axios'
import AdminLayout from '@/components/layout/AdminLayout'
import Pagination from '@/components/common/Pagination'
import { Badge, Button, Card, CardHeader, Field, Select, Spinner, Table, TableWrap, Th, Td, Tr, EmptyState, IconAction } from '@/components/ui'
import { apiError } from '@/lib/tenantApi'

function when(v: string) {
  const d = new Date(v)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS: Record<string, { label: string; tone: 'good' | 'bad' | 'warn' | 'neutral' }> = {
  COMPLETED: { label: 'Done', tone: 'good' },
  SUCCESS: { label: 'Done', tone: 'good' },
  FAILED: { label: 'Failed', tone: 'bad' },
  PENDING: { label: 'Running', tone: 'warn' },
  IN_PROGRESS: { label: 'Running', tone: 'warn' },
}

export default function BackupsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [companies, setCompanies] = useState<any[]>([])
  const [slug, setSlug] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await api.get(`/backups?page=${p}&limit=20`)
      setRows(res.data.data || [])
      setMeta(res.data.meta)
    } catch (err) {
      toast.error(apiError(err, 'Could not load backups.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page)
  }, [load, page])

  useEffect(() => {
    api.get('/companies?limit=100').then((r) => setCompanies((r.data.data || []).filter((c: any) => c.status !== 'DELETED'))).catch(() => {})
  }, [])

  async function run() {
    if (!slug) return toast.error('Choose a company first.')
    setRunning(true)
    try {
      await api.post(`/backups/company/${slug}`)
      toast.success('Backup finished')
      setPage(1)
      load(1)
    } catch (err) {
      toast.error(apiError(err, 'The backup failed.'))
      load(page)
    } finally {
      setRunning(false)
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

  return (
    <AdminLayout title="Backups" subtitle="Copies of each company’s database, stored in cloud storage">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Back up a company now" description="Automatic backups also run on a schedule. Download links work for one hour." />
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
            <Field label="Company" className="sm:w-80">
              {(id) => (
                <Select id={id} value={slug} onChange={(e) => setSlug(e.target.value)}>
                  <option value="">Choose company</option>
                  {companies.map((c) => <option key={c.id} value={c.slug}>{c.name} ({c.slug})</option>)}
                </Select>
              )}
            </Field>
            <Button icon={<HardDrive className="size-4" />} loading={running} onClick={run}>{running ? 'Backing up' : 'Back up now'}</Button>
            {running && <p className="text-[13px] text-ink-3">This can take a minute for large companies.</p>}
          </div>
        </Card>

        <Card>
          <CardHeader title="History" />
          {loading ? (
            <Spinner label="Loading backups" />
          ) : rows.length === 0 ? (
            <EmptyState icon={<HardDrive />} title="No backups yet" />
          ) : (
            <>
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Company</Th>
                      <Th className="hidden sm:table-cell">When</Th>
                      <Th className="hidden md:table-cell">Type</Th>
                      <Th align="right" className="hidden md:table-cell">Size</Th>
                      <Th>Status</Th>
                      <Th align="right"><span className="sr-only">Download</span></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => {
                      const st = STATUS[b.status] || { label: b.status, tone: 'neutral' as const }
                      const ok = st.tone === 'good' && b.fileKey !== null
                      return (
                        <Tr key={b.id}>
                          <Td>
                            <p className="font-medium">{b.company?.name || '—'}</p>
                            <p className="text-xs text-ink-3"><span className="sm:hidden">{when(b.createdAt)}, </span>{b.company?.slug}</p>
                          </Td>
                          <Td className="hidden whitespace-nowrap text-ink-2 sm:table-cell">{when(b.createdAt)}</Td>
                          <Td className="hidden capitalize md:table-cell">{String(b.type || '').toLowerCase()}</Td>
                          <Td align="right" className="hidden md:table-cell">{b.fileSizeMb ? `${Number(b.fileSizeMb).toFixed(2)} MB` : '—'}</Td>
                          <Td>
                            <Badge tone={st.tone}>{st.label}</Badge>
                            {b.status === 'FAILED' && b.errorMsg && <p className="mt-0.5 max-w-60 truncate text-xs text-bad" title={b.errorMsg}>{b.errorMsg}</p>}
                          </Td>
                          <Td align="right">{ok && <IconAction label="Download backup" onClick={() => download(b)}><Download /></IconAction>}</Td>
                        </Tr>
                      )
                    })}
                  </tbody>
                </Table>
              </TableWrap>
              {meta && meta.totalPages > 1 && <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={20} onPageChange={setPage} onLimitChange={() => {}} />}
            </>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}
