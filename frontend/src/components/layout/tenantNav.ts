import {
  LayoutDashboard, UserCog, Contact, Package, ShoppingCart, Truck, Receipt,
  Landmark, Factory, Briefcase, ChartColumn, Settings, type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  ownerOrModuleOnly?: boolean // hidden unless owner or the role has this module
}

export interface NavGroup {
  key: string
  moduleKey: string // company module that must be enabled
  label: string
  icon: LucideIcon
  path?: string // single link
  children?: NavItem[]
}

// Sidebar menu. Labels describe what people do, in plain words.
export const TENANT_NAV: NavGroup[] = [
  { key: 'dashboard', moduleKey: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/erp/dashboard' },
  {
    key: 'sales', moduleKey: 'sales', label: 'Sales', icon: Truck,
    children: [
      { label: 'Sales orders', path: '/erp/sales/orders' },
      { label: 'Sale returns', path: '/erp/sales/returns' },
    ],
  },
  {
    key: 'invoices', moduleKey: 'invoices', label: 'Invoices', icon: Receipt,
    children: [
      { label: 'All invoices', path: '/erp/invoices' },
      { label: 'New invoice', path: '/erp/invoices/create' },
    ],
  },
  {
    key: 'purchase', moduleKey: 'purchase', label: 'Purchases', icon: ShoppingCart,
    children: [
      { label: 'Purchase orders', path: '/erp/purchase/orders' },
      { label: 'Purchase returns', path: '/erp/purchase/returns' },
    ],
  },
  {
    key: 'products', moduleKey: 'products', label: 'Products & stock', icon: Package,
    children: [
      { label: 'Products', path: '/erp/products' },
      { label: 'Stock levels', path: '/erp/inventory' },
      { label: 'Stock adjustment', path: '/erp/stock-adjustment' },
      { label: 'Categories', path: '/erp/categories' },
      { label: 'Brands', path: '/erp/brands' },
    ],
  },
  {
    key: 'contacts', moduleKey: 'contacts', label: 'Customers & suppliers', icon: Contact,
    children: [
      { label: 'Customers', path: '/erp/customers' },
      { label: 'Suppliers', path: '/erp/suppliers' },
    ],
  },
  {
    key: 'finance', moduleKey: 'finance', label: 'Accounts', icon: Landmark,
    children: [
      { label: 'Chart of accounts', path: '/erp/finance/accounts' },
      { label: 'Ledger & trial balance', path: '/erp/finance/ledger' },
      { label: 'Journal entries', path: '/erp/finance/journal' },
      { label: 'Payments (money out)', path: '/erp/finance/payments' },
      { label: 'Receipts (money in)', path: '/erp/finance/receipts' },
    ],
  },
  { key: 'manufacturing', moduleKey: 'manufacturing', label: 'Manufacturing', icon: Factory, path: '/erp/manufacturing' },
  {
    key: 'hr', moduleKey: 'hr', label: 'HR & payroll', icon: Briefcase,
    children: [
      { label: 'Employees', path: '/erp/hr/employees' },
      { label: 'Attendance', path: '/erp/hr/attendance' },
      { label: 'Leave', path: '/erp/hr/leave' },
      { label: 'Payroll', path: '/erp/hr/payroll' },
    ],
  },
  {
    key: 'reports', moduleKey: 'reports', label: 'Reports', icon: ChartColumn,
    children: [
      { label: 'Profit & loss', path: '/erp/reports/profit-loss' },
      { label: 'Balance sheet', path: '/erp/reports/balance-sheet' },
      { label: 'Sales', path: '/erp/reports/sales' },
      { label: 'Purchases', path: '/erp/reports/purchase' },
      { label: 'Invoices', path: '/erp/reports/invoices' },
      { label: 'Receivables', path: '/erp/reports/ar' },
      { label: 'Payables', path: '/erp/reports/ap' },
      { label: 'Customer ledger', path: '/erp/reports/customer-ledger' },
      { label: 'Supplier ledger', path: '/erp/reports/supplier-ledger' },
      { label: 'Stock', path: '/erp/reports/stock' },
      { label: 'Stock movement', path: '/erp/reports/stock-movement' },
      { label: 'Attendance', path: '/erp/reports/attendance' },
      { label: 'Payroll', path: '/erp/reports/payroll-report' },
    ],
  },
  { key: 'users', moduleKey: 'users', label: 'Users & roles', icon: UserCog, path: '/erp/users' },
  {
    key: 'settings', moduleKey: 'settings', label: 'Settings', icon: Settings,
    children: [
      { label: 'Company settings', path: '/erp/settings' },
      { label: 'Activity log', path: '/erp/audit-logs', ownerOrModuleOnly: true },
    ],
  },
]

// Shown to everyone, whatever the plan
export const ALWAYS_VISIBLE = ['dashboard', 'settings']
