'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Package } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Card, Spinner, Stat, Table, TableWrap, Th, Td, Tr, EmptyState, ListToolbar, SearchInput, FilterChips } from '@/components/ui'
import { StockStatus } from '@/components/products/stock'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, number } from '@/lib/format'

type Filter = 'all' | 'low' | 'out'

export default function StockReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    tenantApi
      .get('/erp/reports/stock')
      .then((r) => setData(r.data.data))
      .catch((err) => toast.error(apiError(err, 'Could not load the stock report.')))
      .finally(() => setLoading(false))
  }, [])

  const s = data?.summary || {}
  const all: any[] = data?.products || []
  const isLow = (p: any) => Number(p.stock) > 0 && Number(p.minStock) > 0 && Number(p.stock) <= Number(p.minStock)
  const counts = { all: all.length, low: all.filter(isLow).length, out: all.filter((p) => Number(p.stock) <= 0).length }
  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return all.filter((p) => {
      if (filter === 'low' && !isLow(p)) return false
      if (filter === 'out' && Number(p.stock) > 0) return false
      return !q || String(p.name).toLowerCase().includes(q) || String(p.sku || '').toLowerCase().includes(q)
    })
  }, [all, search, filter])
  const profit = Number(s.totalSaleValue || 0) - Number(s.totalCostValue || 0)

  return (
    <TenantLayout
      title="Stock report"
      subtitle="What is in stock now and what it is worth"
      requiredModule="reports"
      headerRight={
        <ExportButton
          data={rows}
          filename="stock-report"
          title="Stock report"
          subtitle={`Stock value at cost ${money(s.totalCostValue)}`}
          disabled={!data}
          columns={[
            { header: 'Product', value: (r: any) => r.name, width: 30 },
            { header: 'Code', value: (r: any) => r.sku || '', width: 14 },
            { header: 'Category', value: (r: any) => r.categoryName || '', width: 18 },
            { header: 'In stock', value: (r: any) => Number(r.stock || 0), width: 10 },
            { header: 'Cost price', value: (r: any) => Number(r.purchasePrice || 0).toFixed(2), width: 14 },
            { header: 'Value at cost', value: (r: any) => (Number(r.stock || 0) * Number(r.purchasePrice || 0)).toFixed(2), width: 16 },
          ]}
        />
      }
    >
      {loading ? (
        <Spinner label="Loading stock" />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Products" value={number(s.totalProducts)} sub={`${number(s.totalUnits)} units in total`} />
            <Stat label="Value at cost" value={money(s.totalCostValue)} sub="What you paid for it" />
            <Stat label="Value at sale price" value={money(s.totalSaleValue)} sub="If everything sells" />
            <Stat label="Expected profit" value={money(profit)} sub="Sale value minus cost" />
          </div>
          <Card>
            <ListToolbar>
              <SearchInput placeholder="Search by name or code" onSearch={setSearch} />
              <FilterChips<Filter>
                options={[
                  { key: 'all', label: 'All', count: counts.all },
                  { key: 'low', label: 'Low stock', count: counts.low },
                  { key: 'out', label: 'Out of stock', count: counts.out },
                ]}
                value={filter}
                onChange={setFilter}
              />
            </ListToolbar>
            {rows.length === 0 ? (
              <EmptyState icon={<Package />} title="No products match" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Product</Th>
                      <Th align="right">In stock</Th>
                      <Th className="hidden md:table-cell">Status</Th>
                      <Th align="right" className="hidden lg:table-cell">Cost price</Th>
                      <Th align="right" className="hidden lg:table-cell">Sale price</Th>
                      <Th align="right">Value at cost</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <Tr key={p.id}>
                        <Td>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-ink-3">{[p.sku, p.categoryName].filter(Boolean).join(', ')}</p>
                        </Td>
                        <Td align="right">
                          <span className={Number(p.stock) <= 0 ? 'font-medium text-bad' : 'font-medium'}>{number(p.stock)}</span>{' '}
                          <span className="text-xs text-ink-3">{p.unit || 'pcs'}</span>
                        </Td>
                        <Td className="hidden md:table-cell"><StockStatus stock={Number(p.stock)} min={Number(p.minStock)} /></Td>
                        <Td align="right" className="hidden text-ink-2 lg:table-cell">{money(p.purchasePrice)}</Td>
                        <Td align="right" className="hidden text-ink-2 lg:table-cell">{money(p.salePrice)}</Td>
                        <Td align="right" className="font-medium">{money(Number(p.stock) * Number(p.purchasePrice))}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </div>
      )}
    </TenantLayout>
  )
}
