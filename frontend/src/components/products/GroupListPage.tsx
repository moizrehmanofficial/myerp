'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Tags, Trash2, Award } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import { Button, Card, Field, Input, Modal, Table, TableWrap, Th, Td, Tr, Spinner, EmptyState, IconAction, useConfirm } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { number } from '@/lib/format'

const TEXT = {
  category: { title: 'Categories', subtitle: 'Groups that make products easier to find', one: 'category', endpoint: '/erp/products/categories', icon: Tags, example: 'e.g. Mobile phones' },
  brand: { title: 'Brands', subtitle: 'The makers of the products you sell', one: 'brand', endpoint: '/erp/products/brands', icon: Award, example: 'e.g. Samsung' },
}

// Categories and Brands work the same way: a name, and how many products use it
export default function GroupListPage({ kind }: { kind: 'category' | 'brand' }) {
  const t = TEXT[kind]
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirm, confirmDialog] = useConfirm()
  const { canWrite, canDelete } = usePermission()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await tenantApi.get(t.endpoint)
      setRows(res.data.data || [])
    } catch (err) {
      toast.error(apiError(err, `Could not load ${t.title.toLowerCase()}.`))
    } finally {
      setLoading(false)
    }
  }, [t.endpoint, t.title])

  useEffect(() => {
    load()
  }, [load])

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!name.trim()) {
      setError('Enter a name.')
      return
    }
    setSaving(true)
    try {
      await tenantApi.post(t.endpoint, { name: name.trim() })
      toast.success(`${t.one.charAt(0).toUpperCase() + t.one.slice(1)} added`)
      setShowForm(false)
      setName('')
      load()
    } catch (err) {
      toast.error(apiError(err, `Could not add the ${t.one}.`))
    } finally {
      setSaving(false)
    }
  }

  async function remove(row: any) {
    const used = Number(row.productCount || 0)
    const ok = await confirm({
      title: `Delete ${row.name}?`,
      message: used ? `${used} product${used > 1 ? 's use' : ' uses'} it. Those products will keep working without a ${t.one}.` : undefined,
      confirmLabel: `Delete ${t.one}`,
      danger: true,
    })
    if (!ok) return
    try {
      await tenantApi.delete(`${t.endpoint}/${row.id}`)
      toast.success('Deleted')
      load()
    } catch (err) {
      toast.error(apiError(err, `Could not delete the ${t.one}.`))
    }
  }

  const Icon = t.icon

  return (
    <TenantLayout
      title={t.title}
      subtitle={t.subtitle}
      requiredModule="products"
      headerRight={
        canWrite('products') ? (
          <Button icon={<Plus className="size-4" />} onClick={() => { setName(''); setError(''); setShowForm(true) }}>
            Add {t.one}
          </Button>
        ) : undefined
      }
    >
      <Card className="max-w-3xl">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Icon />} title={`No ${t.title.toLowerCase()} yet`} description={`Add a ${t.one}, then choose it when you add or edit a product.`} />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th align="right">Products</Th>
                  {canDelete('products') && <Th align="right"><span className="sr-only">Actions</span></Th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-medium">{r.name}</Td>
                    <Td align="right" className="text-ink-2">{number(r.productCount)}</Td>
                    {canDelete('products') && (
                      <Td align="right" className="w-16">
                        <IconAction label={`Delete ${r.name}`} onClick={() => remove(r)} danger>
                          <Trash2 />
                        </IconAction>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={`Add ${t.one}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} loading={saving}>Add {t.one}</Button>
          </>
        }
      >
        <form onSubmit={save}>
          <Field label="Name" required error={error || undefined}>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.example} autoFocus />}
          </Field>
        </form>
      </Modal>
      {confirmDialog}
    </TenantLayout>
  )
}
