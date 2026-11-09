'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Building2, Coins, Hash, Package, Save } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import { Button, Card, CardHeader, Field, Input, Select, Spinner, Textarea } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { MONTHS } from '@/components/reports/ReportBits'
import { cn } from '@/utils/utils'

const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR']
const TIMEZONES = ['Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'Europe/London', 'America/New_York']
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

const DEFAULTS = {
  company_name: '', company_email: '', company_phone: '', company_address: '',
  company_currency: 'PKR', company_timezone: 'Asia/Karachi', date_format: 'DD/MM/YYYY',
  invoice_prefix: 'INV-', quotation_prefix: 'QT-', purchase_prefix: 'PO-', sales_prefix: 'SO-', employee_prefix: 'EMP-',
  tax_name: 'GST', tax_rate: '0', low_stock_alert: '10', fiscal_year_start: '01',
}
type Settings = typeof DEFAULTS
type Section = 'company' | 'money' | 'numbers' | 'stock'

const SECTIONS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'company', label: 'Company details', icon: <Building2 /> },
  { key: 'money', label: 'Money and tax', icon: <Coins /> },
  { key: 'numbers', label: 'Document numbers', icon: <Hash /> },
  { key: 'stock', label: 'Stock', icon: <Package /> },
]

export default function SettingsPage() {
  const { canModify } = usePermission()
  const editable = canModify('settings')
  const [s, setS] = useState<Settings>(DEFAULTS)
  const [saved, setSaved] = useState<Settings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [section, setSection] = useState<Section>('company')

  useEffect(() => {
    tenantApi
      .get('/erp/settings')
      .then((r) => {
        const next = { ...DEFAULTS, ...(r.data.data || {}) }
        setS(next)
        setSaved(next)
      })
      .catch((err) => toast.error(apiError(err, 'Could not load settings.')))
      .finally(() => setLoading(false))
  }, [])

  const dirty = JSON.stringify(s) !== JSON.stringify(saved)
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value })

  async function save() {
    setSaving(true)
    try {
      await tenantApi.post('/erp/settings', s)
      setSaved(s)
      toast.success('Settings saved')
    } catch (err) {
      toast.error(apiError(err, 'Could not save settings.'))
    } finally {
      setSaving(false)
    }
  }

  const sample = (prefix: string) => `${prefix || ''}00042`

  return (
    <TenantLayout
      title="Settings"
      subtitle="Company details and defaults used across the app"
    >
      {loading ? (
        <Spinner label="Loading settings" />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          {/* Section list: a row of chips on phones, a side list on large screens */}
          <nav aria-label="Settings sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
            {SECTIONS.map((x) => (
              <button
                key={x.key}
                type="button"
                aria-current={section === x.key ? 'page' : undefined}
                onClick={() => setSection(x.key)}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm whitespace-nowrap transition-colors [&>svg]:size-4',
                  section === x.key ? 'bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-ink-2 hover:bg-surface/70 hover:text-ink',
                )}
              >
                {x.icon}
                {x.label}
              </button>
            ))}
          </nav>

          <Card className="max-w-3xl">
            {section === 'company' && (
              <>
                <CardHeader title="Company details" description="Shown on invoices, orders and salary slips" />
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
                  <Field label="Company name" className="sm:col-span-2">{(id) => <Input id={id} value={s.company_name} onChange={set('company_name')} disabled={!editable} />}</Field>
                  <Field label="Email">{(id) => <Input id={id} type="email" value={s.company_email} onChange={set('company_email')} disabled={!editable} />}</Field>
                  <Field label="Phone">{(id) => <Input id={id} type="tel" value={s.company_phone} onChange={set('company_phone')} disabled={!editable} />}</Field>
                  <Field label="Address" className="sm:col-span-2">{(id) => <Textarea id={id} rows={3} value={s.company_address} onChange={set('company_address')} disabled={!editable} />}</Field>
                  <Field label="Time zone">
                    {(id) => <Select id={id} value={s.company_timezone} onChange={set('company_timezone')} disabled={!editable}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</Select>}
                  </Field>
                  <Field label="Date format">
                    {(id) => <Select id={id} value={s.date_format} onChange={set('date_format')} disabled={!editable}>{DATE_FORMATS.map((t) => <option key={t}>{t}</option>)}</Select>}
                  </Field>
                </div>
              </>
            )}

            {section === 'money' && (
              <>
                <CardHeader title="Money and tax" />
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
                  <Field label="Currency" hint="Used on salary slips">
                    {(id) => <Select id={id} value={s.company_currency} onChange={set('company_currency')} disabled={!editable}>{CURRENCIES.map((t) => <option key={t}>{t}</option>)}</Select>}
                  </Field>
                  <Field label="Financial year starts in">
                    {(id) => (
                      <Select id={id} value={s.fiscal_year_start} onChange={set('fiscal_year_start')} disabled={!editable}>
                        {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                      </Select>
                    )}
                  </Field>
                  <Field label="Tax name" hint="e.g. GST or Sales tax">{(id) => <Input id={id} value={s.tax_name} onChange={set('tax_name')} disabled={!editable} />}</Field>
                  <Field label="Default tax rate (%)" hint="Filled in for you on new invoices and sales orders">
                    {(id) => <Input id={id} type="number" min="0" max="100" step="0.01" className="num" value={s.tax_rate} onChange={set('tax_rate')} disabled={!editable} />}
                  </Field>
                </div>
              </>
            )}

            {section === 'numbers' && (
              <>
                <CardHeader title="Document numbers" description="The letters in front of each number. Numbers keep counting up and never repeat." />
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
                  {([
                    ['invoice_prefix', 'Invoices'],
                    ['quotation_prefix', 'Quotations'],
                    ['sales_prefix', 'Sales orders'],
                    ['purchase_prefix', 'Purchase orders'],
                    ['employee_prefix', 'Employee codes'],
                  ] as [keyof Settings, string][]).map(([k, label]) => (
                    <Field key={k} label={label} hint={`Next one looks like ${sample(s[k])}`}>
                      {(id) => <Input id={id} value={s[k]} maxLength={10} onChange={set(k)} disabled={!editable} />}
                    </Field>
                  ))}
                </div>
              </>
            )}

            {section === 'stock' && (
              <>
                <CardHeader title="Stock" />
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
                  <Field label="Low stock level for new products" hint="A product shows as Low stock at or below this. You can change it per product.">
                    {(id) => <Input id={id} type="number" min="0" className="num" value={s.low_stock_alert} onChange={set('low_stock_alert')} disabled={!editable} />}
                  </Field>
                </div>
              </>
            )}

            {editable && (
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
                <p className="text-[13px] text-ink-3">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</p>
                <Button icon={<Save className="size-4" />} onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </TenantLayout>
  )
}
