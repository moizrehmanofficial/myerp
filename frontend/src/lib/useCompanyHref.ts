'use client'

import { useSyncExternalStore } from 'react'

// The URL doesn't change without a navigation, so there is nothing to subscribe to
const subscribe = () => () => {}
const readCompany = () => new URLSearchParams(window.location.search).get('company')
const serverCompany = () => null

// Adds ?company=slug to internal links (needed on Vercel URLs without
// subdomains). Server and first browser render match, so no hydration warning.
export function useCompanyHref() {
  const company = useSyncExternalStore(subscribe, readCompany, serverCompany)
  return (path: string) => (company ? `${path}?company=${encodeURIComponent(company)}` : path)
}
