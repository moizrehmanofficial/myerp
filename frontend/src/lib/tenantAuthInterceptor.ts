'use client'

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

import { clearTenantSession } from './tenantSession'

const API_URL = process.env.NEXT_PUBLIC_API_URL

let installed = false
let refreshPromise: Promise<void> | null = null

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }

function getSlugFromRequest(config?: RetryConfig): string | null {
  const fromHeader = config?.headers?.get?.('x-tenant-slug')
  if (typeof fromHeader === 'string' && fromHeader) return fromHeader
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('tenant_slug_current')
}

function goToLogin(slug: string | null) {
  if (typeof window === 'undefined') return
  clearTenantSession(slug)
  if (window.location.pathname.startsWith('/signin') || window.location.pathname.startsWith('/erp-login')) return
  window.location.href = '/signin'
}

// All tenant pages use the default axios instance, so one global
// interceptor covers every page: on 401 -> refresh once -> retry request.
export function installTenantAuthInterceptor() {
  if (installed || typeof window === 'undefined') return
  installed = true

  axios.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as RetryConfig | undefined
      const url = original?.url || ''

      const shouldTryRefresh =
        error.response?.status === 401 &&
        original &&
        !original._retry &&
        !url.includes('/tenant-auth/')

      if (!shouldTryRefresh) return Promise.reject(error)

      original._retry = true
      const slug = getSlugFromRequest(original)

      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_URL}/tenant-auth/refresh`, {}, {
              withCredentials: true,
              headers: slug ? { 'x-tenant-slug': slug } : {},
            })
            .then(() => undefined)
            .finally(() => {
              refreshPromise = null
            })
        }
        await refreshPromise
        return axios(original)
      } catch (refreshError) {
        goToLogin(slug)
        return Promise.reject(refreshError)
      }
    },
  )
}
