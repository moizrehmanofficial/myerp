'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CircleAlert, CircleCheck, Printer } from 'lucide-react'
import TenantLayout from '@/components/layout/TenantLayout'
import ExportButton from '@/components/common/ExportButton'
import { Button, Card, CardHeader, Spinner } from '@/components/ui'
import { AsOfBar, StatementRow, StatementSection, isoDate } from '@/components/reports/ReportBits'
import { tenantApi, apiError } from '@/lib/tenantApi'
import { money, date } from '@/lib/format'
import { cn } from '@/utils/utils'

export default function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(() => isoDate(new Date()))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await tenantApi.get(`/erp/reports/balance-sheet?asOf=${d}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiError(err, 'Could not load the balance sheet.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(asOf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hide accounts that have never been used
  const show = (list: any[]) => (list || []).filter((a) => Math.abs(Number(a.balance)) > 0.004 || a.id === 'current-period-profit')
  const d = data || {}
  const balanced = !!d.isBalanced
  const exportRows = [
    ...show(d.assets).map((a: any) => ({ ...a, section: 'Assets' })),
    ...show(d.liabilities).map((a: any) => ({ ...a, section: 'Liabilities' })),
    ...show(d.equity).map((a: any) => ({ ...a, section: 'Equity' })),
  ]
  const line = (a: any) => (
    <StatementRow key={a.id} label={a.id === 'current-period-profit' ? 'Profit to date (not yet closed)' : a.name} sub={a.code !== '—' ? a.code : undefined} value={Number(a.balance)} indent />
  )

  return (
    <TenantLayout
      title="Balance sheet"
      subtitle="What the business owns and owes on a date"
      requiredModule="reports"
      headerRight={
        <>
          <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print</Button>
          <ExportButton
            data={exportRows}
            filename={`balance-sheet-${asOf}`}
            title="Balance sheet"
            subtitle={`As of ${date(asOf)}`}
            disabled={!data}
            columns={[
              { header: 'Section', value: (r: any) => r.section, width: 15 },
              { header: 'Code', value: (r: any) => r.code, width: 10 },
              { header: 'Account', value: (r: any) => r.name, width: 32 },
              { header: 'Balance (PKR)', value: (r: any) => Number(r.balance || 0).toFixed(2), width: 18 },
            ]}
          />
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <AsOfBar initial={asOf} onApply={(x) => { setAsOf(x); load(x) }} />

        {loading && !data ? (
          <Spinner label="Loading balance sheet" />
        ) : (
          <>
            <div className={cn('flex items-start gap-3 rounded-[var(--radius-panel)] border px-4 py-3', balanced ? 'border-good/25 bg-good-soft' : 'border-bad/25 bg-bad-soft')}>
              {balanced ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-good" aria-hidden /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />}
              <div className="text-sm">
                <p className={cn('font-medium', balanced ? 'text-good' : 'text-bad')}>{balanced ? 'Balanced' : 'Not balanced'}</p>
                <p className="text-ink-2">
                  Assets {money(d.totalAssets)} {balanced ? '=' : '≠'} liabilities and equity {money(Number(d.totalLiabilities || 0) + Number(d.totalEquity || 0))}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:items-start">
              <Card>
                <CardHeader title="Assets" description="What the business owns" />
                <StatementSection title="Accounts">{show(d.assets).map(line)}</StatementSection>
                <StatementRow label="Total assets" value={d.totalAssets || 0} total />
              </Card>
              <Card>
                <CardHeader title="Liabilities and equity" description="What the business owes, and the owner’s share" />
                <StatementSection title="Liabilities">
                  {show(d.liabilities).length === 0 && <p className="px-5 py-2 text-sm text-ink-3">Nothing owed.</p>}
                  {show(d.liabilities).map(line)}
                  <StatementRow label="Total liabilities" value={d.totalLiabilities || 0} strong />
                </StatementSection>
                <StatementSection title="Equity">
                  {show(d.equity).map(line)}
                  <StatementRow label="Total equity" value={d.totalEquity || 0} strong />
                </StatementSection>
                <StatementRow label="Total liabilities and equity" value={Number(d.totalLiabilities || 0) + Number(d.totalEquity || 0)} total />
              </Card>
            </div>
          </>
        )}
      </div>
    </TenantLayout>
  )
}
