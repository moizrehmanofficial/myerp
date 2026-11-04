'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarOff, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import Pagination from '@/components/common/Pagination'
import {
  Badge, Button, Card, Field, Input, Modal, Segmented, Select, Spinner, Table, TableWrap, Tabs, Textarea, Th, Td, Tr,
  EmptyState, IconAction, ListToolbar, FilterChips, StatusBadge, useConfirm,
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { date } from '@/lib/format'
import { cn } from '@/utils/utils'

type Tab = 'requests' | 'balance' | 'types'
type Status = '' | 'PENDING' | 'APPROVED' | 'REJECTED'

const EMPTY_REQ = { employeeId: '', leaveTypeId: '', startDate: '', endDate: '', reason: '' }

const daysBetween = (a: string, b: string) =>
  a && b && b >= a ? Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000) + 1 : 0

export default function LeavePage() {
  const { canWrite, canModify, canDelete, canApprove } = usePermission()
  const [tab, setTab] = useState<Tab>('requests')
  const [requests, setRequests] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [types, setTypes] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<Status>('PENDING')
  const [who, setWho] = useState('')
  const [confirm, confirmDialog] = useConfirm()

  const [showReq, setShowReq] = useState(false)
  const [req, setReq] = useState(EMPTY_REQ)
  const [reqError, setReqError] = useState('')
  const [reqBalance, setReqBalance] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const [rejecting, setRejecting] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')

  const [typeForm, setTypeForm] = useState<{ id?: string; name: string; daysAllowed: string; isPaid: 'yes' | 'no' } | null>(null)

  const [balanceFor, setBalanceFor] = useState('')
  const [balance, setBalance] = useState<any[]>([])
  const [loadingBalance, setLoadingBalance] = useState(false)

  const loadRequests = useCallback(async (p: number, st: Status, emp: string) => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: String(p), limit: '25' })
      if (st) q.set('status', st)
      if (emp) q.set('employeeId', emp)
      const res = await tenantApi.get(`/erp/hr/leave/requests?${q}`)
      setRequests(res.data.data || [])
      setMeta(res.data.meta)
    } catch (err) {
      toast.error(apiError(err, 'Could not load leave requests.'))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTypes = useCallback(async () => {
    try {
      const r = await tenantApi.get('/erp/hr/leave/types')
      setTypes(r.data.data || [])
    } catch {}
  }, [])

  useEffect(() => {
    loadRequests(page, status, who)
  }, [loadRequests, page, status, who])

  useEffect(() => {
    loadTypes()
    tenantApi.get('/erp/hr/leave/employees').then((r) => setEmployees(r.data.data || [])).catch(() => {})
  }, [loadTypes])

  async function getBalance(empId: string) {
    if (!empId) return []
    const r = await tenantApi.get(`/erp/hr/leave/balance/${empId}?year=${new Date().getFullYear()}`)
    return r.data.data || []
  }

  async function showBalance(empId: string) {
    setBalanceFor(empId)
    if (!empId) return setBalance([])
    setLoadingBalance(true)
    try {
      setBalance(await getBalance(empId))
    } catch (err) {
      toast.error(apiError(err, 'Could not load the leave balance.'))
    } finally {
      setLoadingBalance(false)
    }
  }

  const reqDays = daysBetween(req.startDate, req.endDate)
  const chosenBal = reqBalance.find((b) => b.leaveTypeId === req.leaveTypeId)

  async function submitReq(e?: React.FormEvent) {
    e?.preventDefault()
    if (!req.employeeId) return setReqError('Choose the employee.')
    if (!req.leaveTypeId) return setReqError('Choose the type of leave.')
    if (!req.startDate || !req.endDate) return setReqError('Choose the first and last day.')
    if (req.endDate < req.startDate) return setReqError('The last day is before the first day.')
    setReqError('')
    setSaving(true)
    try {
      await tenantApi.post('/erp/hr/leave/requests', req)
      toast.success('Leave request added')
      setShowReq(false)
      setStatus('PENDING')
      setPage(1)
      loadRequests(1, 'PENDING', who)
    } catch (err) {
      setReqError(apiError(err, 'Could not add the request.'))
    } finally {
      setSaving(false)
    }
  }

  async function approve(r: any) {
    const ok = await confirm({
      title: `Approve ${r.employeeName}'s leave?`,
      message: `${r.totalDays} day${Number(r.totalDays) === 1 ? '' : 's'} of ${r.leaveTypeName}, ${date(r.startDate)} to ${date(r.endDate)}. These days are marked as Leave in attendance.`,
      confirmLabel: 'Approve',
    })
    if (!ok) return
    try {
      await tenantApi.patch(`/erp/hr/leave/requests/${r.id}/approve`)
      toast.success('Approved. Attendance updated.')
      loadRequests(page, status, who)
    } catch (err) {
      toast.error(apiError(err, 'Could not approve.'))
    }
  }

  async function reject() {
    if (!rejectReason.trim()) return toast.error('Write a short reason for the employee.')
    try {
      await tenantApi.patch(`/erp/hr/leave/requests/${rejecting.id}/reject`, { reason: rejectReason.trim() })
      toast.success('Request rejected')
      setRejecting(null)
      loadRequests(page, status, who)
    } catch (err) {
      toast.error(apiError(err, 'Could not reject.'))
    }
  }

  async function saveType(e?: React.FormEvent) {
    e?.preventDefault()
    if (!typeForm || !typeForm.name.trim()) return toast.error('Enter a name for this leave type.')
    const body = { name: typeForm.name.trim(), daysAllowed: Number(typeForm.daysAllowed) || 0, isPaid: typeForm.isPaid === 'yes' }
    try {
      if (typeForm.id) await tenantApi.put(`/erp/hr/leave/types/${typeForm.id}`, body)
      else await tenantApi.post('/erp/hr/leave/types', body)
      toast.success(typeForm.id ? 'Leave type saved' : 'Leave type added')
      setTypeForm(null)
      loadTypes()
    } catch (err) {
      toast.error(apiError(err, 'Could not save the leave type.'))
    }
  }

  async function deleteType(t: any) {
    const ok = await confirm({ title: `Delete "${t.name}"?`, message: 'Requests already made with this type are kept.', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    try {
      await tenantApi.delete(`/erp/hr/leave/types/${t.id}`)
      toast.success(`${t.name} deleted`)
      loadTypes()
    } catch (err) {
      toast.error(apiError(err, 'Could not delete. It may still be in use.'))
    }
  }

  return (
    <TenantLayout
      title="Leave"
      subtitle="Leave requests, approvals and how many days each person has left"
      requiredModule="hr"
      headerRight={
        tab === 'types'
          ? canWrite('hr') && <Button icon={<Plus className="size-4" />} onClick={() => setTypeForm({ name: '', daysAllowed: '0', isPaid: 'yes' })}>Add leave type</Button>
          : canWrite('hr') && (
              <Button icon={<Plus className="size-4" />} onClick={() => { setReq(EMPTY_REQ); setReqBalance([]); setReqError(''); setShowReq(true) }}>
                New leave request
              </Button>
            )
      }
    >
      <Card>
        <Tabs
          tabs={[
            { key: 'requests', label: 'Requests' },
            { key: 'balance', label: 'Days left' },
            { key: 'types', label: 'Leave types', count: types.length },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'requests' && (
          <>
            <ListToolbar>
              <FilterChips<Status>
                options={[{ key: 'PENDING', label: 'Waiting' }, { key: 'APPROVED', label: 'Approved' }, { key: 'REJECTED', label: 'Rejected' }, { key: '', label: 'All' }]}
                value={status}
                onChange={(s) => { setPage(1); setStatus(s) }}
              />
              <Select aria-label="Employee" value={who} onChange={(e) => { setPage(1); setWho(e.target.value) }} className="sm:ml-auto sm:w-56">
                <option value="">All employees</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            </ListToolbar>
            {loading ? (
              <Spinner label="Loading requests" />
            ) : requests.length === 0 ? (
              <EmptyState icon={<CalendarOff />} title={status === 'PENDING' ? 'Nothing waiting for approval' : 'No leave requests'} />
            ) : (
              <>
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Employee</Th>
                        <Th>Dates</Th>
                        <Th className="hidden md:table-cell">Type</Th>
                        <Th>Status</Th>
                        <Th align="right"><span className="sr-only">Actions</span></Th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((r) => (
                        <Tr key={r.id}>
                          <Td>
                            <p className="font-medium">{r.employeeName}</p>
                            <p className="text-xs text-ink-3">{[r.employeeCode, r.department].filter(Boolean).join(', ')}</p>
                          </Td>
                          <Td>
                            <p className="whitespace-nowrap">{date(r.startDate)}{r.totalDays > 1 ? ` to ${date(r.endDate)}` : ''}</p>
                            <p className="text-xs text-ink-3">
                              {r.totalDays} day{Number(r.totalDays) === 1 ? '' : 's'}
                              <span className="md:hidden">, {r.leaveTypeName}</span>
                            </p>
                            {r.reason && <p className="mt-0.5 max-w-xs truncate text-xs text-ink-3" title={r.reason}>{r.reason}</p>}
                          </Td>
                          <Td className="hidden md:table-cell">
                            <p>{r.leaveTypeName}</p>
                            <p className="text-xs text-ink-3">{r.isPaid ? 'Paid' : 'Unpaid'}</p>
                          </Td>
                          <Td>
                            <StatusBadge status={r.status} />
                            {r.status === 'REJECTED' && r.rejectionReason && <p className="mt-0.5 max-w-48 truncate text-xs text-ink-3" title={r.rejectionReason}>{r.rejectionReason}</p>}
                          </Td>
                          <Td align="right" className="whitespace-nowrap">
                            {r.status === 'PENDING' && canApprove('hr') && (
                              <div className="flex justify-end gap-1.5">
                                <Button size="sm" variant="secondary" icon={<Check className="size-3.5" />} onClick={() => approve(r)}>Approve</Button>
                                <Button size="sm" variant="danger-soft" icon={<X className="size-3.5" />} onClick={() => { setRejecting(r); setRejectReason('') }}>Reject</Button>
                              </div>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
                {meta && meta.totalPages > 1 && <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={25} onPageChange={setPage} onLimitChange={() => {}} />}
              </>
            )}
          </>
        )}

        {tab === 'balance' && (
          <>
            <ListToolbar>
              <Select aria-label="Employee" value={balanceFor} onChange={(e) => showBalance(e.target.value)} className="sm:w-72">
                <option value="">Choose an employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>)}
              </Select>
              <p className="text-[13px] text-ink-3">For {new Date().getFullYear()}. Only approved leave counts.</p>
            </ListToolbar>
            {!balanceFor ? (
              <EmptyState icon={<CalendarOff />} title="Choose an employee" description="See how many days of each leave type they have used and have left." />
            ) : loadingBalance ? (
              <Spinner label="Loading" />
            ) : (
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
                {balance.map((b) => {
                  const limited = b.allowed > 0
                  const pct = limited ? Math.min((b.used / b.allowed) * 100, 100) : 0
                  return (
                    <div key={b.leaveTypeId} className="rounded-[var(--radius-control)] border border-line p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-ink">{b.leaveTypeName}</p>
                        <Badge tone={b.isPaid ? 'good' : 'neutral'}>{b.isPaid ? 'Paid' : 'Unpaid'}</Badge>
                      </div>
                      <p className="num mt-3 text-2xl font-semibold text-ink">
                        {limited ? b.remaining : '—'}
                        {limited && <span className="ml-1 text-sm font-normal text-ink-3">of {b.allowed} days left</span>}
                      </p>
                      {limited ? (
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle">
                          <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-bad' : pct >= 75 ? 'bg-warn' : 'bg-brand')} style={{ width: `${pct}%` }} />
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-ink-3">No yearly limit</p>
                      )}
                      <p className="mt-2 text-xs text-ink-3">{b.used} day{b.used === 1 ? '' : 's'} used</p>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'types' &&
          (types.length === 0 ? (
            <EmptyState icon={<CalendarOff />} title="No leave types" description="Add the kinds of leave your company gives, like Annual or Sick leave." />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Leave type</Th>
                    <Th align="right">Days a year</Th>
                    <Th>Pay</Th>
                    <Th align="right"><span className="sr-only">Actions</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((t) => (
                    <Tr key={t.id}>
                      <Td className="font-medium">{t.name}</Td>
                      <Td align="right">{Number(t.daysAllowed) > 0 ? t.daysAllowed : 'No limit'}</Td>
                      <Td><Badge tone={t.isPaid ? 'good' : 'neutral'}>{t.isPaid ? 'Paid' : 'Unpaid'}</Badge></Td>
                      <Td align="right" className="whitespace-nowrap">
                        {canModify('hr') && <IconAction label={`Edit ${t.name}`} onClick={() => setTypeForm({ id: t.id, name: t.name, daysAllowed: String(t.daysAllowed), isPaid: t.isPaid ? 'yes' : 'no' })}><Pencil /></IconAction>}
                        {canDelete('hr') && <IconAction label={`Delete ${t.name}`} onClick={() => deleteType(t)} danger><Trash2 /></IconAction>}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ))}
      </Card>

      {/* New request */}
      <Modal
        open={showReq}
        onClose={() => setShowReq(false)}
        title="New leave request"
        description="It waits for approval. Once approved, attendance is marked for those days."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowReq(false)}>Cancel</Button>
            <Button onClick={() => submitReq()} loading={saving}>Add request</Button>
          </>
        }
      >
        <form onSubmit={submitReq} className="grid grid-cols-2 gap-4">
          <Field label="Employee" required className="col-span-2">
            {(id) => (
              <Select id={id} value={req.employeeId} onChange={async (e) => {
                const v = e.target.value
                setReq({ ...req, employeeId: v })
                setReqBalance(v ? await getBalance(v).catch(() => []) : [])
              }}>
                <option value="">Choose employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>)}
              </Select>
            )}
          </Field>
          <Field
            label="Type of leave"
            required
            className="col-span-2"
            hint={chosenBal ? (chosenBal.allowed > 0 ? `${chosenBal.remaining} of ${chosenBal.allowed} days left this year` : 'No yearly limit') : undefined}
          >
            {(id) => (
              <Select id={id} value={req.leaveTypeId} onChange={(e) => setReq({ ...req, leaveTypeId: e.target.value })}>
                <option value="">Choose type</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isPaid ? '' : ' (unpaid)'}</option>)}
              </Select>
            )}
          </Field>
          <Field label="First day" required>{(id) => <Input id={id} type="date" value={req.startDate} onChange={(e) => setReq({ ...req, startDate: e.target.value, endDate: req.endDate && req.endDate < e.target.value ? e.target.value : req.endDate })} />}</Field>
          <Field label="Last day" required hint={reqDays ? `${reqDays} day${reqDays === 1 ? '' : 's'}` : undefined}>
            {(id) => <Input id={id} type="date" min={req.startDate || undefined} value={req.endDate} onChange={(e) => setReq({ ...req, endDate: e.target.value })} />}
          </Field>
          <Field label="Reason" className="col-span-2">{(id) => <Textarea id={id} rows={3} value={req.reason} onChange={(e) => setReq({ ...req, reason: e.target.value })} />}</Field>
          {reqError && <p className="col-span-2 rounded-[var(--radius-control)] bg-bad-soft px-3 py-2 text-[13px] text-bad">{reqError}</p>}
          <button type="submit" className="hidden" />
        </form>
      </Modal>

      {/* Reject */}
      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        size="sm"
        title="Reject this request?"
        description={rejecting ? `${rejecting.employeeName}, ${date(rejecting.startDate)} to ${date(rejecting.endDate)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" onClick={reject}>Reject</Button>
          </>
        }
      >
        <Field label="Reason" required hint="The employee will see this.">
          {(id) => <Textarea id={id} rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} autoFocus />}
        </Field>
      </Modal>

      {/* Leave type */}
      <Modal
        open={!!typeForm}
        onClose={() => setTypeForm(null)}
        title={typeForm?.id ? 'Edit leave type' : 'Add leave type'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTypeForm(null)}>Cancel</Button>
            <Button onClick={() => saveType()}>{typeForm?.id ? 'Save' : 'Add leave type'}</Button>
          </>
        }
      >
        {typeForm && (
          <form onSubmit={saveType} className="grid grid-cols-2 gap-4">
            <Field label="Name" required className="col-span-2">{(id) => <Input id={id} value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="e.g. Annual leave" autoFocus />}</Field>
            <Field label="Days a year" hint="0 means no limit">{(id) => <Input id={id} type="number" min="0" className="num" value={typeForm.daysAllowed} onChange={(e) => setTypeForm({ ...typeForm, daysAllowed: e.target.value })} />}</Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">Pay</span>
              <Segmented label="Pay" options={[{ key: 'yes', label: 'Paid' }, { key: 'no', label: 'Unpaid' }]} value={typeForm.isPaid} onChange={(v) => setTypeForm({ ...typeForm, isPaid: v })} />
            </div>
            <button type="submit" className="hidden" />
          </form>
        )}
      </Modal>
      {confirmDialog}
    </TenantLayout>
  )
}
