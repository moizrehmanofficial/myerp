'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Package, Pencil, Plus, Trash2, Wand2 } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import Pagination from '@/components/common/Pagination'
import {
  Badge, Button, Card, Field, Input, Select, Modal, Table, TableWrap, Th, Td, Tr,
  Spinner, EmptyState, SearchInput, ListToolbar, IconAction, useConfirm,
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, number } from '@/lib/format'
import { getTenantSlug } from '@/lib/getTenantSlug'

const UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'm', 'cm', 'box', 'dozen', 'pair']
const EMPTY = { name: '', sku: '', barcode: '', unit: 'pcs', categoryId: '', brandId: '', purchasePrice: '', salePrice: '', minStock: '0', maxStock: '0' }

export default function ProductsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [categories, setCategories] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [confirm, confirmDialog] = useConfirm()
  const { canWrite, canModify, canDelete } = usePermission()

  const load = useCallback(async (q: string, p: number, l: number) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/products?search=${encodeURIComponent(q)}&page=${p}&limit=${l}`)
      setRows(res.data.data || [])
      setMeta(res.data.meta)
    } catch (err) {
      toast.error(apiError(err, 'Could not load products.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(search, page, limit)
  }, [load, search, page, limit])

  // Category and brand lists for the form
  useEffect(() => {
    tenantApi.get('/erp/products/categories').then((r) => setCategories(r.data.data || [])).catch(() => {})
    tenantApi.get('/erp/products/brands').then((r) => setBrands(r.data.data || [])).catch(() => {})
  }, [])

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    // Low-stock level for new products comes from Settings
    tenantApi
      .get('/erp/settings')
      .then((r) => {
        const d = Number(r.data.data?.low_stock_alert)
        if (d > 0) setForm((f) => (f.minStock === '0' ? { ...f, minStock: String(d) } : f))
      })
      .catch(() => {})
    setErrors({})
    setShowForm(true)
  }

  function openEdit(p: any) {
    setEditing(p)
    setForm({
      name: p.name || '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      unit: p.unit || 'pcs',
      categoryId: p.categoryId || '',
      brandId: p.brandId || '',
      purchasePrice: p.purchasePrice?.toString() || '',
      salePrice: p.salePrice?.toString() || '',
      minStock: p.minStock?.toString() || '0',
      maxStock: p.maxStock?.toString() || '0',
    })
    setErrors({})
    setShowForm(true)
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Enter the product name.'
    if (!form.sku.trim()) errs.sku = 'Enter a product code, or press Generate.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || null,
        brandId: form.brandId || null,
        purchasePrice: parseFloat(form.purchasePrice) || 0,
        salePrice: parseFloat(form.salePrice) || 0,
        minStock: parseFloat(form.minStock) || 0,
        maxStock: parseFloat(form.maxStock) || 0,
      }
      if (editing) {
        await tenantApi.put(`/erp/products/${editing.id}`, payload)
        toast.success('Product saved')
      } else {
        await tenantApi.post('/erp/products', payload)
        toast.success('Product added')
      }
      setShowForm(false)
      load(search, page, limit)
    } catch (err) {
      toast.error(apiError(err, 'Could not save the product.'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(p: any) {
    const ok = await confirm({
      title: `Delete ${p.name}?`,
      message: 'It will no longer appear when creating orders or invoices. Past records keep it.',
      confirmLabel: 'Delete product',
      danger: true,
    })
    if (!ok) return
    try {
      await tenantApi.delete(`/erp/products/${p.id}`)
      toast.success('Product deleted')
      load(search, page, limit)
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the product.'))
    }
  }

  const showActions = canModify('products') || canDelete('products')
  const margin = (Number(form.salePrice) || 0) - (Number(form.purchasePrice) || 0)

  return (
    <TenantLayout
      title="Products"
      subtitle="Everything you buy and sell"
      requiredModule="products"
      headerRight={
        <>
          <ExportButton
            data={rows}
            filename={`products-${typeof window !== 'undefined' ? getTenantSlug() : ''}`}
            title="Products"
            subtitle={new Date().toLocaleDateString('en-GB')}
            columns={[
              { header: 'Name', value: (r) => r.name, width: 28 },
              { header: 'Code (SKU)', value: (r) => r.sku || '', width: 18 },
              { header: 'Category', value: (r) => r.categoryName || '', width: 18 },
              { header: 'Unit', value: (r) => r.unit || '', width: 10 },
              { header: 'Cost price', value: (r) => Number(r.purchasePrice || 0).toFixed(2), width: 16 },
              { header: 'Sale price', value: (r) => Number(r.salePrice || 0).toFixed(2), width: 16 },
              { header: 'In stock', value: (r) => Number(r.stock || 0).toFixed(2), width: 12 },
            ]}
          />
          {canWrite('products') && (
            <Button icon={<Plus className="size-4" />} onClick={openCreate}>
              Add product
            </Button>
          )}
        </>
      }
    >
      <Card>
        <ListToolbar>
          <SearchInput
            placeholder="Search by name, code or barcode"
            onSearch={(q) => {
              setPage(1)
              setSearch(q)
            }}
          />
        </ListToolbar>

        {loading ? (
          <Spinner label="Loading products" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title={search ? `No products match "${search}"` : 'No products yet'}
            description={search ? 'Check the spelling or search by product code.' : 'Add the items you sell so you can use them on invoices and orders.'}
            action={!search && canWrite('products') ? <Button icon={<Plus className="size-4" />} onClick={openCreate}>Add product</Button> : undefined}
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th className="hidden lg:table-cell">Category</Th>
                    <Th align="right" className="hidden md:table-cell">Cost price</Th>
                    <Th align="right">Sale price</Th>
                    <Th align="right">In stock</Th>
                    {showActions && <Th align="right"><span className="sr-only">Actions</span></Th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const stock = Number(p.stock || 0)
                    const min = Number(p.minStock || 0)
                    const low = stock <= 0 ? 'out' : min > 0 && stock <= min ? 'low' : null
                    return (
                      <Tr key={p.id}>
                        <Td>
                          <p className="font-medium text-ink">{p.name}</p>
                          <p className="text-xs text-ink-3">
                            {p.sku}
                            {p.brandName ? `, ${p.brandName}` : ''}
                          </p>
                        </Td>
                        <Td className="hidden text-ink-2 lg:table-cell">{p.categoryName || '—'}</Td>
                        <Td align="right" className="hidden text-ink-2 md:table-cell">{money(p.purchasePrice)}</Td>
                        <Td align="right" className="font-medium">{money(p.salePrice)}</Td>
                        <Td align="right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={low === 'out' ? 'font-medium text-bad' : 'font-medium'}>
                              {number(stock)} <span className="text-xs font-normal text-ink-3">{p.unit}</span>
                            </span>
                            {low === 'out' && <Badge tone="bad">Out of stock</Badge>}
                            {low === 'low' && <Badge tone="warn">Low stock</Badge>}
                          </div>
                        </Td>
                        {showActions && (
                          <Td align="right" className="w-24 whitespace-nowrap">
                            {canModify('products') && (
                              <IconAction label={`Edit ${p.name}`} onClick={() => openEdit(p)}>
                                <Pencil />
                              </IconAction>
                            )}
                            {canDelete('products') && (
                              <IconAction label={`Delete ${p.name}`} onClick={() => remove(p)} danger>
                                <Trash2 />
                              </IconAction>
                            )}
                          </Td>
                        )}
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableWrap>
            {meta && (
              <Pagination page={page} totalPages={meta.totalPages || 1} total={meta.total || 0} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />
            )}
          </>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit product' : 'Add product'}
        description={editing ? undefined : 'New products start with 0 in stock. Stock goes up when a purchase is received.'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={() => save()} loading={saving}>
              {editing ? 'Save changes' : 'Add product'}
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Product name" required error={errors.name} className="sm:col-span-2">
            {(id) => <Input id={id} value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />}
          </Field>
          <Field label="Product code (SKU)" required error={errors.sku}>
            {(id) => (
              <div className="flex gap-2">
                <Input id={id} value={form.sku} onChange={(e) => set('sku', e.target.value)} />
                <Button variant="secondary" icon={<Wand2 className="size-4" />} onClick={() => set('sku', 'SKU-' + Date.now().toString().slice(-6))}>
                  Generate
                </Button>
              </div>
            )}
          </Field>
          <Field label="Barcode" hint="Optional">
            {(id) => <Input id={id} value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />}
          </Field>
          <Field label="Category">
            {(id) => (
              <Select id={id} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Brand">
            {(id) => (
              <Select id={id} value={form.brandId} onChange={(e) => set('brandId', e.target.value)}>
                <option value="">No brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Cost price (PKR)" hint="What you pay the supplier">
            {(id) => <Input id={id} type="number" inputMode="decimal" min="0" value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} className="num" />}
          </Field>
          <Field label="Sale price (PKR)" hint={form.salePrice && form.purchasePrice ? `Profit per unit: ${money(margin)}` : 'What the customer pays'}>
            {(id) => <Input id={id} type="number" inputMode="decimal" min="0" value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} className="num" />}
          </Field>
          <Field label="Unit">
            {(id) => (
              <Select id={id} value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Low stock alert" hint="Warn at or below">
              {(id) => <Input id={id} type="number" min="0" value={form.minStock} onChange={(e) => set('minStock', e.target.value)} className="num" />}
            </Field>
            <Field label="Maximum stock">
              {(id) => <Input id={id} type="number" min="0" value={form.maxStock} onChange={(e) => set('maxStock', e.target.value)} className="num" />}
            </Field>
          </div>
          <button type="submit" className="hidden" />
        </form>
      </Modal>

      {confirmDialog}
    </TenantLayout>
  )
}
