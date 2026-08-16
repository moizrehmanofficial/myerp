export const APP_NAME = 'MyERP'
export const APP_VERSION = '1.0.0'

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  COMPANIES: '/companies',
  MODULES: '/modules',
  SETTINGS: '/settings',
}

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },
  COMPANIES: {
    LIST: '/companies',
    CREATE: '/companies',
    UPDATE: (id: string) => `/companies/${id}`,
    DELETE: (id: string) => `/companies/${id}`,
  },
  MODULES: {
    LIST: '/modules',
  },
}