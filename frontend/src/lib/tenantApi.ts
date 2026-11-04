'use client'

import axios from 'axios'
import { getTenantSlug } from './getTenantSlug'

// One API helper for all company pages. Uses the default axios instance,
// so the auto-refresh login interceptor applies to every call.
function config() {
  return { withCredentials: true, headers: { 'x-tenant-slug': getTenantSlug() } }
}
const url = (path: string) => `${process.env.NEXT_PUBLIC_API_URL}${path}`

export const tenantApi = {
  get: (path: string) => axios.get(url(path), config()),
  post: (path: string, data?: unknown) => axios.post(url(path), data ?? {}, config()),
  put: (path: string, data?: unknown) => axios.put(url(path), data ?? {}, config()),
  patch: (path: string, data?: unknown) => axios.patch(url(path), data ?? {}, config()),
  delete: (path: string) => axios.delete(url(path), config()),
}

// The server's own message (e.g. "Not enough stock for …"), or a clear fallback
export function apiError(err: any, fallback: string) {
  const m = err?.response?.data?.message
  if (Array.isArray(m)) return m.join('. ')
  if (typeof m === 'string' && m) return m
  if (!err?.response) return 'Cannot reach the server. Check your internet connection.'
  return fallback
}
