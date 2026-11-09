'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Eye, Pencil, Plus, Trash2, PackageCheck, Receipt, Truck, ShoppingCart, FileText } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import Pagination from '@/components/common/Pagination'
import { Card, Table, TableWrap, Th, Td, Tr, Spinner, EmptyState, SearchInput, ListToolbar, IconAction, StatusBadge, FilterChips, useConfirm, buttonStyles } from '@/components/ui'
import { invoiceState, quotationState } from './docStatus'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, date } from '@/lib/format'
import { useCompanyHref } from '@/lib/useCompanyHref'
import type { DocKind } from './DocumentEditor'

const CONFIG = {
  invoice: {
    module: 'invoices', title: 'Invoices', subtitle: 'Bills you have sent to customers', url: '/erp/invoices',
    add: 'New invoice', one: 'invoice', party: 'Customer', partyKey: 'customerName', numberKey: 'invoiceNumber', statusKey: 'paymentStatus',
    icon: Receipt, search: 'Search by invoice number or customer',
  },
  sales: {
    module: 'sales', title: 'Sales orders', subtitle: 'Orders customers have placed', url: '/erp/sales/orders',
    add: 'New sales order', one: 'sales order', party: 'Customer', partyKey: 'customerName', numberKey: 'orderNumber', statusKey: 'status',
    icon: Truck, search: 'Search by order number or customer',
  },
  purchase: {
    module: 'purchase', title: 'Purchase orders', subtitle: 'Stock you have ordered from suppliers', url: '/erp/purchase/orders',
    add: 'New purchase order', one: 'purchase order', party: 'Supplier', partyKey: 'supplierName', numberKey: 'orderNumber', statusKey: 'status',
    icon: ShoppingCart, search: 'Search by order number or supplier',
  },
  quotation: {
    module: 'sales', title: 'Quotations', subtitle: 'Price offers sent to customers', url: '/erp/quotations',
    add: 'New quotation', one: 'quotation', party: 'Customer', partyKey: 'customerName', numberKey: 'quotationNumber', statusKey: 'status',
    icon: FileText, search: 'Search by quotation number or customer',
  },
}

// Quick filters (the server does the filtering)
const FILTERS: Partial<Record<DocKind, { key: string; label: string }[]>> = {
  invoice: [
    { key: '', label: 'All' },
    { key: 'unpaid', label: 'Unpaid' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'draft', label: 'Drafts' },
    { key: 'cancelled', label: 'Cancelled' },
  ],
  quotation: [
    { key: '', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'converted', label: 'Invoiced' },
    { key: 'expired', label: 'Expired' },
    { key: 'rejected', label: 'Rejected' },
  ],
}

export default function DocumentList({ kind }: { kind: DocKind }) {
  const c = CONFIG[kind]
  const router = useRouter()
  const href = useCompanyHref()
  const [rows, setRows] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [filter, setFilter] = useState('')
  const [confirm, confirmDialog] = useConfirm()
  const { canWrite, canModify, canDelete } = usePermission()

  const load = useCallback(async (q: string, p: number, l: number, f = '') => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`${c.url}?search=${encodeURIComponent(q)}&page=${p}&limit=${l}${f ? `&status=${f}` : ''}`)
      setRows(res.data.data || [])
      setMeta(res.data.meta)
    } catch (err) {
      toast.error(apiError(err, `Could not load ${c.title.toLowerCase()}.`))
    } finally {
      setLoading(false)
    }
  }, [c.url, c.title])

  useEffect(() => {
    load(search, page, limit, filter)
  }, [load, search, page, limit, filter])

  async function markReceived(row: any) {
    const ok = await confirm({
      title: `Mark ${row.orderNumber} as received?`,
      message: 'The ordered quantities will be added to stock and the amount added to what you owe the supplier.',
      confirmLabel: 'Mark received',
    })
    if (!ok) return
    try {
      await tenantApi.patch(`${c.url}/${row.id}/status`, { status: 'RECEIVED' })
      toast.success('Received. Stock updated.')
      load(search, page, limit, filter)
    } catch (err) {
      toast.error(apiError(err, 'Could not update the order.'))
    }
  }

  async function remove(row: any) {
    const no = row[c.numberKey]
    const msg =
      kind === 'invoice'
        ? 'Stock goes back and the sale is reversed in the accounts. Money already received stays as the customer’s credit.'
        : kind === 'quotation'
          ? undefined
          : kind === 'purchase' && row.status === 'RECEIVED'
          ? 'Its stock will be removed again. This is blocked if the stock has already been sold.'
          : undefined
    const ok = await confirm({ title: `Delete ${no}?`, message: msg, confirmLabel: `Delete ${c.one}`, danger: true })
    if (!ok) return
    try {
      await tenantApi.delete(`${c.url}/${row.id}`)
      toast.success(`${no} deleted`)
      load(search, page, limit, filter)
    } catch (err) {
      toast.error(apiError(err, `Could not delete ${no}.`))
    }
  }

  const Icon = c.icon
  const exportCols =
    kind === 'invoice'
      ? [
          { header: 'Invoice', value: (r: any) => r.invoiceNumber, width: 15 },
          { header: 'Customer', value: (r: any) => r.customerName || '', width: 25 },
          { header: 'Date', value: (r: any) => date(r.createdAt), width: 15 },
          { header: 'Total (PKR)', value: (r: any) => Number(r.totalAmount || 0).toFixed(2), width: 15 },
          { header: 'Paid (PKR)', value: (r: any) => Number(r.paidAmount || 0).toFixed(2), width: 15 },
          { header: 'Due (PKR)', value: (r: any) => Number(r.dueAmount || 0).toFixed(2), width: 15 },
          { header: 'Status', value: (r: any) => r.paymentStatus, width: 12 },
        ]
      : [
          { header: 'Order', value: (r: any) => r.orderNumber, width: 15 },
          { header: c.party, value: (r: any) => r[c.partyKey] || '', width: 25 },
          { header: 'Date', value: (r: any) => date(r.createdAt), width: 15 },
          { header: 'Total (PKR)', value: (r: any) => Number(r.totalAmount || 0).toFixed(2), width: 18 },
          { header: 'Status', value: (r: any) => r.status, width: 12 },
        ]

  return (
    <TenantLayout
      title={c.title}
      subtitle={c.subtitle}
      requiredModule={c.module}
      headerRight={
        <>
          <ExportButton data={rows} filename={c.title.toLowerCase().replace(/\s/g, '-')} title={c.title} subtitle={new Date().toLocaleDateString('en-GB')} columns={exportCols} />
          {canWrite(c.module) && (
            <Link href={href(`${c.url}/create`)} className={buttonStyles()}>
              <Plus className="size-4" aria-hidden />
              {c.add}
            </Link>
          )}
        </>
      }
    >
      <Card>
        <ListToolbar>
          <SearchInput placeholder={c.search} onSearch={(q) => { setPage(1); setSearch(q) }} />
          {FILTERS[kind] && <FilterChips options={FILTERS[kind]!} value={filter} onChange={(f) => { setPage(1); setFilter(f) }} />}
        </ListToolbar>

        {loading ? (
          <Spinner label={`Loading ${c.title.toLowerCase()}`} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icon />}
            title={search ? `Nothing matches "${search}"` : filter ? `No ${c.title.toLowerCase()} here` : `No ${c.title.toLowerCase()} yet`}
            description={search ? 'Try the number or the name only.' : filter ? 'Pick another filter.' : `Create your first ${c.one}.`}
            action={
              !search && !filter && canWrite(c.module) ? (
                <Link href={href(`${c.url}/create`)} className={buttonStyles()}>
                  <Plus className="size-4" aria-hidden />
                  {c.add}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>{kind === 'invoice' ? 'Invoice' : kind === 'quotation' ? 'Quotation' : 'Order'}</Th>
                    <Th className="hidden sm:table-cell">{c.party}</Th>
                    <Th align="right">Total</Th>
                    {kind === 'invoice' && <Th align="right" className="hidden lg:table-cell">Received</Th>}
                    {kind === 'invoice' && <Th align="right" className="hidden md:table-cell">Due</Th>}
                    <Th>Status</Th>
                    <Th align="right"><span className="sr-only">Actions</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Tr key={r.id} onClick={() => router.push(href(`${c.url}/${r.id}`))}>
                      <Td>
                        <p className="font-medium text-ink">{r[c.numberKey]}</p>
                        <p className="text-xs text-ink-3">
                          <span className="sm:hidden">{r[c.partyKey]}, </span>
                          {date(r.createdAt)}
                        </p>
                      </Td>
                      <Td className="hidden sm:table-cell">{r[c.partyKey] || '—'}</Td>
                      <Td align="right" className="font-medium">{money(r.totalAmount)}</Td>
                      {kind === 'invoice' && <Td align="right" className="hidden text-ink-2 lg:table-cell">{money(r.paidAmount)}</Td>}
                      {kind === 'invoice' && (
                        <Td align="right" className={`hidden md:table-cell ${Number(r.dueAmount) > 0 && r.status !== 'DRAFT' ? 'font-medium text-warn' : 'text-ink-3'}`}>
                          {r.status === 'DRAFT' || r.status === 'CANCELLED' ? '—' : money(r.dueAmount)}
                        </Td>
                      )}
                      <Td>
                        <StatusBadge status={kind === 'invoice' ? invoiceState(r) : kind === 'quotation' ? quotationState(r) : r[c.statusKey]} />
                        {kind === 'quotation' && r.invoiceNumber && <p className="mt-0.5 text-xs text-ink-3">{r.invoiceNumber}</p>}
                      </Td>
                      <Td align="right" className="whitespace-nowrap">
                        {kind === 'purchase' && r.status !== 'RECEIVED' && r.status !== 'CANCELLED' && canModify('purchase') && (
                          <IconAction label="Mark received" onClick={() => markReceived(r)}>
                            <PackageCheck />
                          </IconAction>
                        )}
                        <IconAction label="Open" onClick={() => router.push(href(`${c.url}/${r.id}`))}>
                          <Eye />
                        </IconAction>
                        {((kind === 'invoice' && r.status !== 'CANCELLED') || (kind === 'quotation' && r.status !== 'CONVERTED')) && canModify(c.module) && (
                          <IconAction label="Edit" onClick={() => router.push(href(`${c.url}/${r.id}/edit`))}>
                            <Pencil />
                          </IconAction>
                        )}
                        {canDelete(c.module) && (
                          <IconAction label="Delete" onClick={() => remove(r)} danger>
                            <Trash2 />
                          </IconAction>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            {meta && <Pagination page={page} totalPages={meta.totalPages || 1} total={meta.total || 0} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />}
          </>
        )}
      </Card>
      {confirmDialog}
    </TenantLayout>
  )
}
