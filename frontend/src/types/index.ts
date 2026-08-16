export interface SuperAdmin {
  id: string
  name: string
  email: string
  type: 'super_admin'
}

export interface Company {
  id: string
  name: string
  slug: string
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED'
  ceoName: string
  ceoEmail: string
  plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'
  createdAt: string
}

export interface Module {
  id: string
  name: string
  key: string
  icon: string
  isActive: boolean
  sortOrder: number
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}