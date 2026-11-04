'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowLeftRight } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Badge, Card, Spinner, Stat, Table, TableWrap, Th, Td, Tr, EmptyState, ListToolbar, SearchInput, FilterChips } from '@/components/ui'
import { DateRangeBar, presetRange, type Range } from '@/components/reports/ReportBits'
import { isStockIn, movementLabel } from '@/components/products/stock'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { number, date } from '@/lib/format'

type Dir = 'all' | 'in' | 'out'

export default function StockMovementPage() {
  const [range, setRange] = useState<Range>(() => presetRange('month'))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dir, setDir] = useState<Dir>('all')

  const load = useCallback(async (r: Range) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/reports/stock-movement?from=${r.from}&to=${r.to}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load stock movements.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = data?.summary || {}
  const all: any[] = data?.movements || []
  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return all.filter((m) => {
      if (dir === 'in' && !isStockIn(m.type)) return false
      if (dir === 'out' && isStockIn(m.type)) return false
      return !q || String(m.productName).toLowerCase().includes(q) || String(m.reference || '').toLowerCase().includes(q)
    })
  }, [all, search, dir])

  return (
    <TenantLayout
      title="Stock movement"
      subtitle="Every time stock came in or went out"
      requiredModule="reports"
      headerRight={
        <ExportButton
          data={rows}
          filename={`stock-movement-${range.from}-${range.to}`}
          title="Stock movement"
          subtitle={`${date(range.from)} to ${date(range.to)}`}
          disabled={!data}
          columns={[
            { header: 'Date', value: (r: any) => date(r.createdAt), width: 14 },
            { header: 'Product', value: (r: any) => r.productName, width: 28 },
            { header: 'What happened', value: (r: any) => movementLabel(r.type, r.reference).text, width: 20 },
            { header: 'Reference', value: (r: any) => r.reference || '', width: 16 },
            { header: 'Qty', value: (r: any) => (isStockIn(r.type) ? '+' : '-') + r.quantity, width: 10 },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <DateRangeBar initial={range} onApply={(r) => { setRange(r); load(r) }} />
        {loading && !data ? (
          <Spinner label="Loading movements" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Stat label="Units in" value={<span className="text-good">+{number(s.totalIn)}</span>} sub="Purchases, returns, added by hand" />
              <Stat label="Units out" value={<span className="text-bad">−{number(s.totalOut)}</span>} sub="Sales, returns, removed by hand" />
              <Stat label="Movements" value={number(s.totalTransactions)} className="col-span-2 lg:col-span-1" />
            </div>
            <Card>
              <ListToolbar>
                <SearchInput placeholder="Search product or reference" onSearch={setSearch} />
                <FilterChips<Dir>
                  options={[{ key: 'all', label: 'All' }, { key: 'in', label: 'Stock in' }, { key: 'out', label: 'Stock out' }]}
                  value={dir}
                  onChange={setDir}
                />
              </ListToolbar>
              {rows.length === 0 ? (
                <EmptyState icon={<ArrowLeftRight />} title="No stock movements" description="Try other dates." />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Product</Th>
                        <Th className="hidden md:table-cell">What happened</Th>
                        <Th className="hidden lg:table-cell">Reference</Th>
                        <Th align="right">Qty</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((m) => {
                        const inn = isStockIn(m.type)
                        const l = movementLabel(m.type, m.reference)
                        return (
                          <Tr key={m.id}>
                            <Td>
                              <p className="font-medium">{m.productName}</p>
                              <p className="text-xs text-ink-3">
                                {date(m.createdAt)}
                                <span className="md:hidden">, {l.text}</span>
                                {m.notes && m.notes !== l.text ? `, ${m.notes}` : ''}
                              </p>
                            </Td>
                            <Td className="hidden md:table-cell"><Badge tone={l.tone}>{l.text}</Badge></Td>
                            <Td className="hidden text-ink-2 lg:table-cell">{m.reference && m.reference !== 'MANUAL_ADJUSTMENT' ? m.reference : '—'}</Td>
                            <Td align="right" className={inn ? 'font-medium text-good' : 'font-medium text-bad'}>
                              {inn ? '+' : '−'}{number(m.quantity)} <span className="text-xs font-normal text-ink-3">{m.productUnit || 'pcs'}</span>
                            </Td>
                          </Tr>
                        )
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Card>
          </>
        )}
      </div>
    </TenantLayout>
  )
}
