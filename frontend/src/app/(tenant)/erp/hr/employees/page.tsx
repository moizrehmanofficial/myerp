'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import Pagination from '@/components/common/Pagination'
import {
  Button, Card, Field, Input, Modal, Segmented, Table, TableWrap, Th, Td, Tr,
  Spinner, EmptyState, SearchInput, ListToolbar, IconAction, StatusBadge, useConfirm,
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, date } from '@/lib/format'

const DEPARTMENTS = ['Management', 'Sales', 'Accounts', 'Operations', 'HR', 'IT', 'Warehouse']
const DESIGNATIONS = ['Manager', 'Supervisor', 'Officer', 'Executive', 'Assistant', 'Intern', 'Director']

const EMPTY = { name: '', email: '', phone: '', cnic: '', department: '', designation: '', joiningDate: '', salary: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' }

function initials(name: string) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function EmployeesPage() {
  const { canWrite, canModify, canDelete } = usePermission()
  const [rows, setRows] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [editing, setEditing] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  const load = useCallback(async (q: string, p: number, l: number) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/hr/employees?search=${encodeURIComponent(q)}&page=${p}&limit=${l}`)
      setRows(res.data.data || [])
      setMeta(res.data.meta)
    } catch (err) {
      toast.error(apiError(err, 'Could not load employees.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(search, page, limit)
  }, [load, search, page, limit])

  function openForm(emp?: any) {
    setEditing(emp || null)
    setNameError('')
    setForm(
      emp
        ? {
            name: emp.name || '', email: emp.email || '', phone: emp.phone || '', cnic: emp.cnic || '',
            department: emp.department || '', designation: emp.designation || '',
            joiningDate: emp.joiningDate ? String(emp.joiningDate).slice(0, 10) : '',
            salary: emp.salary ? String(Number(emp.salary)) : '', status: emp.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          }
        : EMPTY,
    )
    setShowForm(true)
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!form.name.trim()) return setNameError('Enter the employee’s name')
    setSaving(true)
    try {
      const body = { ...form, name: form.name.trim() }
      if (editing) await tenantApi.put(`/erp/hr/employees/${editing.id}`, body)
      else await tenantApi.post('/erp/hr/employees', body)
      toast.success(editing ? 'Changes saved' : `${body.name} added`)
      setShowForm(false)
      load(search, page, limit)
    } catch (err) {
      toast.error(apiError(err, 'Could not save the employee.'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(emp: any) {
    const ok = await confirm({
      title: `Delete ${emp.name}?`,
      message: 'Their attendance and payroll history stays in reports. To keep them on file, set their status to Inactive instead.',
      confirmLabel: 'Delete employee',
      danger: true,
    })
    if (!ok) return
    try {
      await tenantApi.delete(`/erp/hr/employees/${emp.id}`)
      toast.success(`${emp.name} deleted`)
      load(search, page, limit)
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the employee.'))
    }
  }

  return (
    <TenantLayout
      title="Employees"
      subtitle="Everyone on your payroll"
      requiredModule="hr"
      headerRight={
        <>
          <ExportButton
            data={rows}
            filename="employees"
            title="Employees"
            subtitle={new Date().toLocaleDateString('en-GB')}
            columns={[
              { header: 'Code', value: (r: any) => r.employeeCode, width: 12 },
              { header: 'Name', value: (r: any) => r.name, width: 24 },
              { header: 'Phone', value: (r: any) => r.phone || '', width: 16 },
              { header: 'Email', value: (r: any) => r.email || '', width: 24 },
              { header: 'CNIC', value: (r: any) => r.cnic || '', width: 18 },
              { header: 'Department', value: (r: any) => r.department || '', width: 16 },
              { header: 'Designation', value: (r: any) => r.designation || '', width: 16 },
              { header: 'Joined', value: (r: any) => (r.joiningDate ? date(r.joiningDate) : ''), width: 14 },
              { header: 'Salary (PKR)', value: (r: any) => Number(r.salary || 0).toFixed(2), width: 14 },
              { header: 'Status', value: (r: any) => r.status, width: 10 },
            ]}
          />
          {canWrite('hr') && <Button icon={<Plus className="size-4" />} onClick={() => openForm()}>Add employee</Button>}
        </>
      }
    >
      <Card>
        <ListToolbar>
          <SearchInput placeholder="Search by name, code or department" onSearch={(q) => { setPage(1); setSearch(q) }} />
        </ListToolbar>
        {loading ? (
          <Spinner label="Loading employees" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={search ? `Nobody matches "${search}"` : 'No employees yet'}
            description={search ? 'Try the name or employee code.' : 'Add your staff to mark attendance and run payroll.'}
            action={!search && canWrite('hr') ? <Button icon={<Plus className="size-4" />} onClick={() => openForm()}>Add employee</Button> : undefined}
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Employee</Th>
                    <Th className="hidden md:table-cell">Department</Th>
                    <Th className="hidden lg:table-cell">Contact</Th>
                    <Th align="right" className="hidden sm:table-cell">Monthly salary</Th>
                    <Th>Status</Th>
                    <Th align="right"><span className="sr-only">Actions</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <Tr key={e.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink" aria-hidden>
                            {initials(e.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{e.name}</p>
                            <p className="text-xs text-ink-3">
                              <span className="num">{e.employeeCode}</span>
                              {e.designation ? `, ${e.designation}` : ''}
                              <span className="md:hidden">{e.department ? `, ${e.department}` : ''}</span>
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td className="hidden md:table-cell">
                        <p>{e.department || '—'}</p>
                        {e.joiningDate && <p className="text-xs text-ink-3">Joined {date(e.joiningDate)}</p>}
                      </Td>
                      <Td className="hidden lg:table-cell">
                        <p className="text-ink-2">{e.phone || '—'}</p>
                        {e.email && <p className="text-xs text-ink-3">{e.email}</p>}
                      </Td>
                      <Td align="right" className="hidden font-medium sm:table-cell">{money(e.salary)}</Td>
                      <Td><StatusBadge status={e.status} /></Td>
                      <Td align="right" className="whitespace-nowrap">
                        {canModify('hr') && <IconAction label={`Edit ${e.name}`} onClick={() => openForm(e)}><Pencil /></IconAction>}
                        {canDelete('hr') && <IconAction label={`Delete ${e.name}`} onClick={() => remove(e)} danger><Trash2 /></IconAction>}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            {meta && <Pagination page={page} totalPages={meta.totalPages || 1} total={meta.total || 0} limit={limit} onPageChange={setPage} onLimitChange={(l) => { setPage(1); setLimit(l) }} />}
          </>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        size="lg"
        title={editing ? `Edit ${editing.name}` : 'Add employee'}
        description={editing ? `Employee code ${editing.employeeCode}` : 'An employee code is given automatically.'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} loading={saving}>{editing ? 'Save changes' : 'Add employee'}</Button>
          </>
        }
      >
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={nameError || undefined} className="sm:col-span-2">
            {(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />}
          </Field>
          <Field label="Phone">
            {(id) => <Input id={id} type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0300 1234567" />}
          </Field>
          <Field label="Email">
            {(id) => <Input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
          </Field>
          <Field label="CNIC">
            {(id) => <Input id={id} value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} placeholder="12345-1234567-1" inputMode="numeric" />}
          </Field>
          <Field label="Joining date">
            {(id) => <Input id={id} type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />}
          </Field>
          <Field label="Department" hint="Pick one or type your own">
            {(id) => (
              <>
                <Input id={id} list="dept-list" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                <datalist id="dept-list">{DEPARTMENTS.map((d) => <option key={d} value={d} />)}</datalist>
              </>
            )}
          </Field>
          <Field label="Designation" hint="Pick one or type your own">
            {(id) => (
              <>
                <Input id={id} list="desig-list" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
                <datalist id="desig-list">{DESIGNATIONS.map((d) => <option key={d} value={d} />)}</datalist>
              </>
            )}
          </Field>
          <Field label="Monthly salary (PKR)" hint="Used when payroll is generated">
            {(id) => <Input id={id} type="number" min="0" inputMode="decimal" className="num" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />}
          </Field>
          {editing && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">Status</span>
              <Segmented label="Status" options={[{ key: 'ACTIVE', label: 'Active' }, { key: 'INACTIVE', label: 'Inactive' }]} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
              <p className="text-xs text-ink-3">Inactive staff are left out of attendance and payroll.</p>
            </div>
          )}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
      {confirmDialog}
    </TenantLayout>
  )
}
