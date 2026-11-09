'use client'

// Company pages used to carry ?company=slug in every link. The company is now
// remembered after sign-in, so links stay clean: /erp/invoices.
// Kept as a hook so the many pages that call it do not need to change.
export function useCompanyHref() {
  return (path: string) => path
}
