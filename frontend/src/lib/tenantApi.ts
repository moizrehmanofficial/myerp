'use client'

import axios from 'axios'
import toast from 'react-hot-toast'
import { getTenantSlug } from './getTenantSlug'

// One API helper for all company pages. Uses the default axios instance,
// so the auto-refresh login interceptor applies to every call.
// A request that never answers used to leave the page on "Loading" forever.
// Now it gives up after 60 seconds with a clear message.
const TIMEOUT_MS = 60_000
function config() {
  return { withCredentials: true, timeout: TIMEOUT_MS, headers: { 'x-tenant-slug': getTenantSlug() } }
}
const url = (path: string) => `${process.env.NEXT_PUBLIC_API_URL}${path}`

// If the server takes long to answer (it sleeps when unused and needs up to
// a minute to start), say so instead of showing a silent spinner.
let pending = 0
let slowTimer: ReturnType<typeof setTimeout> | null = null
const SLOW_TOAST = 'server-waking'
function track<T>(p: Promise<T>): Promise<T> {
  if (typeof window !== 'undefined') {
    pending++
    if (!slowTimer) {
      slowTimer = setTimeout(() => {
        if (pending > 0) toast.loading('The server is starting up. This can take up to a minute the first time.', { id: SLOW_TOAST })
      }, 6000)
    }
  }
  return p.finally(() => {
    if (typeof window === 'undefined') return
    pending = Math.max(0, pending - 1)
    if (pending === 0) {
      if (slowTimer) clearTimeout(slowTimer)
      slowTimer = null
      toast.dismiss(SLOW_TOAST)
    }
  })
}

export const tenantApi = {
  get: (path: string) => track(axios.get(url(path), config())),
  post: (path: string, data?: unknown) => track(axios.post(url(path), data ?? {}, config())),
  put: (path: string, data?: unknown) => track(axios.put(url(path), data ?? {}, config())),
  patch: (path: string, data?: unknown) => track(axios.patch(url(path), data ?? {}, config())),
  delete: (path: string) => track(axios.delete(url(path), config())),
}

// Wake the server early (e.g. while someone types their password)
export function wakeServer() {
  if (typeof window === 'undefined') return
  axios.get(url('/health'), { timeout: TIMEOUT_MS }).catch(() => {})
}

// The server's own message (e.g. "Not enough stock for …"), or a clear fallback
export function apiError(err: any, fallback: string) {
  const m = err?.response?.data?.message
  if (Array.isArray(m)) return m.join('. ')
  if (typeof m === 'string' && m) return m
  if (err?.code === 'ECONNABORTED') return 'The server took too long to answer. Please try again.'
  if (!err?.response) return 'Cannot reach the server. Check your internet connection.'
  return fallback
}
