'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Banknote, FileDown, FileText, Pencil, Wallet, WandSparkles } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import {
  Button, Card, Field, Input, Modal, Segmented, Spinner, Stat, Table, TableWrap, Th, Td, Tr,
  EmptyState, IconAction, StatusBadge, useConfirm,
} from '@/components/ui'
import { MONTHS, MonthBar } from '@/components/reports/ReportBits'
import { PAY_METHODS, methodLabel } from '@/components/finance/accounting'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, date } from '@/lib/format'

type Method = (typeof PAY_METHODS)[number]['key']

export default function PayrollPage() {
  const perm = usePermission()
  // Payroll follows the "payroll" permission, or "hr" for older roles
  const canWrite = () => perm.canWrite('payroll') || perm.canWrite('hr')
  const canModify = () => perm.canModify('payroll') || perm.canModify('hr')
  const now = new Date()
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() })
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ basicSalary: '', allowances: '', deductions: '', tax: '', status: 'PENDING' as 'PENDING' | 'PAID', method: 'BANK' as Method })
  const [saving, setSaving] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  const label = `${MONTHS[period.month - 1]} ${period.year}`

  const load = useCallback(async (m: number, y: number) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/hr/payroll?month=${m}&year=${y}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load payroll.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(period.month, period.year)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows: any[] = data?.payrolls || []
  const s = data?.summary || {}
  const paid = rows.filter((r) => r.status === 'PAID')
  const pendingTotal = rows.filter((r) => r.status !== 'PAID').reduce((t, r) => t + Number(r.netSalary || 0), 0)

  async function generate() {
    const ok = await confirm({
      title: `Generate payroll for ${label}?`,
      message: 'A salary line is made for every active employee who does not have one yet. Absent days are deducted from basic salary. You can edit each line afterwards.',
      confirmLabel: 'Generate payroll',
    })
    if (!ok) return
    setBusy('generate')
    try {
      const res = await tenantApi.post('/erp/hr/payroll/generate', { month: period.month, year: period.year })
      toast.success(res.data.message || 'Payroll generated')
      load(period.month, period.year)
    } catch (err) {
      toast.error(apiError(err, 'Could not generate payroll.'))
    } finally {
      setBusy('')
    }
  }

  async function slips() {
    setBusy('slips')
    try {
      const res = await tenantApi.post('/erp/hr/payroll/bulk-slips', { month: period.month, year: period.year })
      toast.success(res.data.message || 'Salary slips ready')
      load(period.month, period.year)
    } catch (err) {
      toast.error(apiError(err, 'Could not make salary slips.'))
    } finally {
      setBusy('')
    }
  }

  async function slip(p: any) {
    setBusy(p.id)
    try {
      const res = p.slipUrl
        ? await tenantApi.get(`/erp/hr/payroll/${p.id}/slip-url`)
        : await tenantApi.post(`/erp/hr/payroll/${p.id}/generate-slip`)
      const url = res.data.data?.downloadUrl
      if (url) window.open(url, '_blank', 'noopener')
      if (!p.slipUrl) load(period.month, period.year)
    } catch (err) {
      toast.error(apiError(err, 'Could not open the salary slip.'))
    } finally {
      setBusy('')
    }
  }

  function edit(p: any, payNow = false) {
    setEditing({ ...p, payNow })
    setForm({
      basicSalary: String(Number(p.basicSalary || 0)),
      allowances: String(Number(p.allowances || 0)),
      deductions: String(Number(p.deductions || 0)),
      tax: String(Number(p.tax || 0)),
      status: payNow ? 'PAID' : p.status === 'PAID' ? 'PAID' : 'PENDING',
      method: (p.paidMethod as Method) || 'BANK',
    })
  }

  const n = (v: string) => Math.round((parseFloat(v) || 0) * 100) / 100
  const net = Math.max(n(form.basicSalary) + n(form.allowances) - n(form.deductions) - n(form.tax), 0)

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    setSaving(true)
    try {
      await tenantApi.put(`/erp/hr/payroll/${editing.id}`, { ...form })
      toast.success(form.status === 'PAID' && editing.status !== 'PAID' ? `${editing.employeeName} marked paid` : 'Salary saved')
      setEditing(null)
      load(period.month, period.year)
    } catch (err) {
      toast.error(apiError(err, 'Could not save.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TenantLayout
      title="Payroll"
      subtitle="Monthly salaries. Paying a salary records it in the accounts."
      requiredModule="hr"
      headerRight={
        <>
          <ExportButton
            data={rows}
            filename={`payroll-${period.year}-${period.month}`}
            title={`Payroll: ${label}`}
            columns={[
              { header: 'Employee', value: (r: any) => r.employeeName, width: 24 },
              { header: 'Code', value: (r: any) => r.employeeCode, width: 10 },
              { header: 'Basic', value: (r: any) => Number(r.basicSalary || 0).toFixed(2), width: 12 },
              { header: 'Allowances', value: (r: any) => Number(r.allowances || 0).toFixed(2), width: 12 },
              { header: 'Deductions', value: (r: any) => Number(r.deductions || 0).toFixed(2), width: 12 },
              { header: 'Tax', value: (r: any) => Number(r.tax || 0).toFixed(2), width: 10 },
              { header: 'Net pay', value: (r: any) => Number(r.netSalary || 0).toFixed(2), width: 14 },
              { header: 'Status', value: (r: any) => r.status, width: 10 },
            ]}
          />
          {rows.length > 0 && <Button variant="secondary" icon={<FileText className="size-4" />} loading={busy === 'slips'} onClick={slips}>Salary slips</Button>}
          {canWrite() && <Button icon={<WandSparkles className="size-4" />} loading={busy === 'generate'} onClick={generate}>Generate payroll</Button>}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <MonthBar month={period.month} year={period.year} onApply={(m, y) => { setPeriod({ month: m, year: y }); load(m, y) }} />
        {loading && !data ? (
          <Spinner label="Loading payroll" />
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Wallet />}
              title={`No payroll for ${label} yet`}
              description="Generate it to make a salary line for every active employee, based on their salary and attendance."
              action={canWrite() ? <Button icon={<WandSparkles className="size-4" />} loading={busy === 'generate'} onClick={generate}>Generate payroll</Button> : undefined}
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Employees" value={s.totalEmployees} sub={label} />
              <Stat label="Total net pay" value={money(s.totalPayroll)} />
              <Stat label="Paid" value={`${paid.length} of ${rows.length}`} sub={money(paid.reduce((t, r) => t + Number(r.netSalary || 0), 0))} />
              <Stat label="Still to pay" value={<span className={pendingTotal > 0 ? 'text-warn' : ''}>{money(pendingTotal)}</span>} />
            </div>
            <Card>
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Employee</Th>
                      <Th align="right" className="hidden md:table-cell">Basic</Th>
                      <Th align="right" className="hidden xl:table-cell">Allowances</Th>
                      <Th align="right" className="hidden lg:table-cell">Deductions</Th>
                      <Th align="right" className="hidden xl:table-cell">Tax</Th>
                      <Th align="right">Net pay</Th>
                      <Th>Status</Th>
                      <Th align="right"><span className="sr-only">Actions</span></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <Tr key={p.id}>
                        <Td>
                          <p className="font-medium">{p.employeeName}</p>
                          <p className="text-xs text-ink-3">{[p.employeeCode, p.designation || p.department].filter(Boolean).join(', ')}</p>
                        </Td>
                        <Td align="right" className="hidden md:table-cell">{money(p.basicSalary)}</Td>
                        <Td align="right" className="hidden text-ink-2 xl:table-cell">{Number(p.allowances) ? money(p.allowances) : '—'}</Td>
                        <Td align="right" className="hidden text-ink-2 lg:table-cell">{Number(p.deductions) ? money(p.deductions) : '—'}</Td>
                        <Td align="right" className="hidden text-ink-2 xl:table-cell">{Number(p.tax) ? money(p.tax) : '—'}</Td>
                        <Td align="right" className="font-semibold">{money(p.netSalary)}</Td>
                        <Td>
                          <StatusBadge status={p.status} />
                          {p.status === 'PAID' && p.paidAt && <p className="mt-0.5 text-xs whitespace-nowrap text-ink-3">{methodLabel(p.paidMethod)}, {date(p.paidAt)}</p>}
                        </Td>
                        <Td align="right" className="whitespace-nowrap">
                          {p.status !== 'PAID' && canModify() && (
                            <Button size="sm" variant="secondary" icon={<Banknote className="size-3.5" />} onClick={() => edit(p, true)} className="mr-1">
                              Pay
                            </Button>
                          )}
                          <IconAction label={p.slipUrl ? 'Download salary slip' : 'Make salary slip'} onClick={() => slip(p)}>
                            <FileDown className={busy === p.id ? 'animate-pulse' : ''} />
                          </IconAction>
                          {canModify() && <IconAction label={`Edit ${p.employeeName}`} onClick={() => edit(p)}><Pencil /></IconAction>}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </Card>
          </>
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.payNow ? `Pay ${editing?.employeeName}` : `Salary: ${editing?.employeeName || ''}`}
        description={`${label}. Net pay is worked out for you.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => save()} loading={saving}>
              {form.status === 'PAID' && editing?.status !== 'PAID' ? `Pay ${money(net)}` : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="grid grid-cols-2 gap-4">
          <Field label="Basic salary">{(id) => <Input id={id} type="number" min="0" inputMode="decimal" className="num" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} />}</Field>
          <Field label="Allowances" hint="Bonus, overtime, travel">{(id) => <Input id={id} type="number" min="0" inputMode="decimal" className="num" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} />}</Field>
          <Field label="Deductions" hint="Absences, advances">{(id) => <Input id={id} type="number" min="0" inputMode="decimal" className="num" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} />}</Field>
          <Field label="Income tax">{(id) => <Input id={id} type="number" min="0" inputMode="decimal" className="num" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} />}</Field>
          <div className="col-span-2 flex items-center justify-between rounded-[var(--radius-control)] bg-subtle px-4 py-3">
            <span className="text-sm text-ink-2">Net pay</span>
            <span className="num text-lg font-semibold text-ink">{money(net)}</span>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">Status</span>
            <Segmented label="Status" options={[{ key: 'PENDING', label: 'Not paid yet' }, { key: 'PAID', label: 'Paid' }]} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
          </div>
          {form.status === 'PAID' && (
            <div className="col-span-2 flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">Paid by</span>
              <Segmented label="Paid by" options={[...PAY_METHODS]} value={form.method} onChange={(v) => setForm({ ...form, method: v })} />
              <p className="text-xs text-ink-3">Recorded in the accounts as salaries expense, paid from {form.method === 'CASH' ? 'Cash in hand' : 'the bank account'}.</p>
            </div>
          )}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
      {confirmDialog}
    </TenantLayout>
  )
}
