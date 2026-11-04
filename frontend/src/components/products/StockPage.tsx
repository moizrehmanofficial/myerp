'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Boxes, CircleDollarSign, PackageX, SlidersHorizontal, TriangleAlert, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Button, Card, Stat, Table, TableWrap, Th, Td, Tr, Spinner, EmptyState, SearchInput, ListToolbar, Tabs, Badge } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, number, date } from '@/lib/format'
import { AdjustStockModal, StockStatus, isStockIn, movementLabel } from './stock'
import { cn } from '@/utils/utils'

type Mode = 'levels' | 'adjust'
type Filter = 'all' | 'low' | 'out'

// mode="levels": Inventory page (overview + movements)
// mode="adjust": Stock adjustment page (pick a product, correct the count, see the history)
export default function StockPage({ mode }: { mode: Mode }) {
  const [data, setData] = useState<any>(null)
  const [moves, setMoves] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stock' | 'moves'>('stock')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [adjusting, setAdjusting] = useState<any>(null)
  const { canWrite } = usePermission()
  const canAdjust = canWrite('stock_adjust') || canWrite('inventory')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, tx] = await Promise.all([
        tenantApi.get('/erp/inventory/overview'),
        tenantApi.get(`/erp/inventory/transactions?limit=${mode === 'adjust' ? 100 : 50}`),
      ])
      setData(ov.data.data)
      setMoves(tx.data.data || [])
    } catch (err) {
      toast.error(apiError(err, 'Could not load stock.'))
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => {
    load()
  }, [load])

  const products: any[] = data?.products || []
  const stats = data?.stats || {}

  const shown = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter((p) => {
      const stock = Number(p.stock || 0)
      const min = Number(p.minStock || 0)
      if (filter === 'out' && stock > 0) return false
      if (filter === 'low' && !(stock > 0 && min > 0 && stock <= min)) return false
      return !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    })
  }, [products, search, filter])

  const shownMoves = mode === 'adjust' ? moves.filter((m) => String(m.type).startsWith('ADJUSTMENT')) : moves

  const title = mode === 'levels' ? 'Stock levels' : 'Stock adjustment'
  const subtitle = mode === 'levels' ? 'How much of each product you have, and its value' : 'Correct stock counts by hand, with a reason for each change'

  return (
    <TenantLayout
      title={title}
      subtitle={subtitle}
      requiredModule={mode === 'levels' ? 'inventory' : 'stock_adjust'}
      headerRight={
        <ExportButton
          data={shown}
          filename="stock"
          title="Stock levels"
          subtitle={new Date().toLocaleDateString('en-GB')}
          columns={[
            { header: 'Product', value: (r) => r.name, width: 28 },
            { header: 'Code', value: (r) => r.sku || '', width: 16 },
            { header: 'In stock', value: (r) => Number(r.stock || 0), width: 12 },
            { header: 'Unit', value: (r) => r.unit || '', width: 8 },
            { header: 'Low stock alert', value: (r) => Number(r.minStock || 0), width: 14 },
            { header: 'Stock value (PKR)', value: (r) => (Number(r.stock || 0) * Number(r.purchasePrice || 0)).toFixed(2), width: 18 },
          ]}
        />
      }
    >
      {loading ? (
        <Spinner label="Loading stock" />
      ) : (
        <div className="flex flex-col gap-5">
          {mode === 'levels' && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Products" icon={<Boxes />} value={number(stats.totalProducts)} sub={`${number(stats.totalStock)} units in total`} />
              <Stat label="Stock value" icon={<CircleDollarSign />} tone="brand" value={money(stats.stockValue)} sub="At cost price" />
              <Stat label="Low on stock" icon={<TriangleAlert />} tone={Number(stats.lowStockCount) > 0 ? 'warn' : 'neutral'} value={number(stats.lowStockCount)} sub="At or below the alert level" />
              <Stat label="Out of stock" icon={<PackageX />} tone={Number(stats.outOfStockCount) > 0 ? 'bad' : 'neutral'} value={number(stats.outOfStockCount)} sub="Cannot be invoiced" />
            </div>
          )}

          <Card>
            <Tabs
              tabs={[
                { key: 'stock', label: mode === 'levels' ? 'Products' : 'Choose a product', count: products.length },
                { key: 'moves', label: mode === 'levels' ? 'Recent movements' : 'Adjustment history', count: shownMoves.length },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === 'stock' ? (
              <>
                <ListToolbar>
                  <SearchInput placeholder="Search by name or code" onSearch={setSearch} />
                  <div className="flex gap-1.5" role="group" aria-label="Filter">
                    {[
                      { key: 'all' as Filter, label: 'All' },
                      { key: 'low' as Filter, label: 'Low stock' },
                      { key: 'out' as Filter, label: 'Out of stock' },
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFilter(f.key)}
                        aria-pressed={filter === f.key}
                        className={cn(
                          'h-8 rounded-full border px-3 text-[13px] transition-colors',
                          filter === f.key ? 'border-brand bg-brand-soft font-medium text-brand-ink' : 'border-line-strong text-ink-2 hover:bg-subtle',
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </ListToolbar>
                {shown.length === 0 ? (
                  <EmptyState icon={<Boxes />} title={products.length ? 'No products match' : 'No products yet'} description={products.length ? 'Change the search or filter.' : 'Add products first, then their stock shows here.'} />
                ) : (
                  <TableWrap>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Product</Th>
                          <Th align="right">In stock</Th>
                          <Th className="hidden sm:table-cell">Status</Th>
                          <Th align="right" className="hidden md:table-cell">Value</Th>
                          {canAdjust && <Th align="right"><span className="sr-only">Actions</span></Th>}
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((p) => {
                          const stock = Number(p.stock || 0)
                          return (
                            <Tr key={p.id}>
                              <Td>
                                <p className="font-medium">{p.name}</p>
                                <p className="text-xs text-ink-3">
                                  {p.sku}
                                  {p.categoryName ? `, ${p.categoryName}` : ''}
                                </p>
                              </Td>
                              <Td align="right">
                                <span className={cn('font-medium', stock <= 0 && 'text-bad')}>{number(stock)}</span> <span className="text-xs text-ink-3">{p.unit}</span>
                                <div className="mt-1 sm:hidden"><StockStatus stock={stock} min={Number(p.minStock || 0)} /></div>
                              </Td>
                              <Td className="hidden sm:table-cell"><StockStatus stock={stock} min={Number(p.minStock || 0)} /></Td>
                              <Td align="right" className="hidden text-ink-2 md:table-cell">{money(stock * Number(p.purchasePrice || 0))}</Td>
                              {canAdjust && (
                                <Td align="right" className="w-28">
                                  <Button size="sm" variant="secondary" icon={<SlidersHorizontal className="size-3.5" />} onClick={() => setAdjusting(p)}>
                                    Adjust
                                  </Button>
                                </Td>
                              )}
                            </Tr>
                          )
                        })}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </>
            ) : shownMoves.length === 0 ? (
              <EmptyState icon={<SlidersHorizontal />} title="No movements yet" description={mode === 'adjust' ? 'Corrections you make will be listed here with their reason.' : 'Purchases, sales and corrections will appear here.'} />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Product</Th>
                      <Th className="hidden md:table-cell">What happened</Th>
                      <Th align="right">Quantity</Th>
                      <Th className="hidden sm:table-cell">Date</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownMoves.map((t) => {
                      const label = movementLabel(t.type, t.reference)
                      const inflow = isStockIn(t.type)
                      const ref = t.reference && !['MANUAL_ADJUSTMENT', 'SALES_ORDER'].includes(t.reference) ? t.reference : ''
                      return (
                        <Tr key={t.id}>
                          <Td>
                            <p className="font-medium">{t.productName}</p>
                            <p className="text-xs text-ink-3 md:hidden">{label.text}{ref ? `, ${ref}` : ''}</p>
                          </Td>
                          <Td className="hidden md:table-cell">
                            <Badge tone={label.tone}>{label.text}</Badge>
                            {(ref || t.notes) && <p className="mt-1 text-xs text-ink-3">{[ref, t.notes].filter(Boolean).join(', ')}</p>}
                          </Td>
                          <Td align="right">
                            <span className={cn('inline-flex items-center gap-1 font-medium', inflow ? 'text-good' : 'text-bad')}>
                              {inflow ? <ArrowDownLeft className="size-3.5" aria-hidden /> : <ArrowUpRight className="size-3.5" aria-hidden />}
                              {inflow ? '+' : '−'}
                              {number(t.quantity)}
                            </span>
                          </Td>
                          <Td className="hidden whitespace-nowrap text-ink-2 sm:table-cell">{date(t.createdAt)}</Td>
                        </Tr>
                      )
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </div>
      )}

      <AdjustStockModal product={adjusting} onClose={() => setAdjusting(null)} onDone={load} />
    </TenantLayout>
  )
}
