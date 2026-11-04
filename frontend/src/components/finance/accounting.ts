// Words and colours for accounting screens, in one place

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'

export const ACCOUNT_TYPES: { key: AccountType; label: string; plural: string; hint: string }[] = [
  { key: 'ASSET', label: 'Asset', plural: 'Assets', hint: 'What the business owns: cash, bank, stock, money customers owe' },
  { key: 'LIABILITY', label: 'Liability', plural: 'Liabilities', hint: 'What the business owes: suppliers, tax, loans' },
  { key: 'EQUITY', label: 'Equity', plural: 'Equity', hint: 'Owner’s capital and retained profit' },
  { key: 'INCOME', label: 'Income', plural: 'Income', hint: 'Money earned: sales, other income' },
  { key: 'EXPENSE', label: 'Expense', plural: 'Expenses', hint: 'Money spent to run the business: rent, salaries, cost of goods' },
]

export const TYPE_TONE: Record<string, 'info' | 'warn' | 'brand' | 'good' | 'bad' | 'neutral'> = {
  ASSET: 'info',
  LIABILITY: 'warn',
  EQUITY: 'brand',
  INCOME: 'good',
  EXPENSE: 'bad',
}

export function typeLabel(type: string) {
  return ACCOUNT_TYPES.find((t) => t.key === type)?.label || type
}

// Where a journal entry came from
const SOURCES: Record<string, string> = {
  invoice: 'Invoice',
  invoice_payment: 'Invoice payment',
  purchase: 'Purchase',
  payment: 'Payment',
  receipt: 'Receipt',
  sale_return: 'Sale return',
  purchase_return: 'Purchase return',
  payroll: 'Salary',
  opening_balance: 'Opening balance',
  manual: 'Manual',
}

export function sourceLabel(sourceType?: string | null) {
  if (!sourceType) return 'Manual'
  return SOURCES[sourceType] || sourceType.replace(/_/g, ' ')
}

export const PAY_METHODS = [
  { key: 'CASH', label: 'Cash' },
  { key: 'BANK', label: 'Bank' },
  { key: 'CHEQUE', label: 'Cheque' },
  { key: 'ONLINE', label: 'Online' },
] as const

export function methodLabel(m?: string) {
  return PAY_METHODS.find((x) => x.key === m)?.label || m || '—'
}
