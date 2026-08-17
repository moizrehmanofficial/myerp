'use client'

import { getTenantSlug } from '@/lib/getTenantSlug'

export type PermissionAction = 'read' | 'write' | 'modify' | 'delete' | 'print' | 'export' | 'approve'

export function usePermission() {
  function getPermissions(moduleKey: string): Record<PermissionAction, boolean> {
    if (typeof window === 'undefined') return getEmpty()

    const sub = getTenantSlug()

    const cached = sessionStorage.getItem(`tenant_user_${sub}`)
    if (!cached) return getEmpty()

    try {
      const user = JSON.parse(cached)
      if (user.isOwner) return getFull()
      return user.permissions?.[moduleKey] || getEmpty()
    } catch {
      return getEmpty()
    }
  }

  function can(moduleKey: string, action: PermissionAction): boolean {
    return getPermissions(moduleKey)[action] === true
  }

  function canRead(moduleKey: string): boolean { return can(moduleKey, 'read') }
  function canWrite(moduleKey: string): boolean { return can(moduleKey, 'write') }
  function canModify(moduleKey: string): boolean { return can(moduleKey, 'modify') }
  function canDelete(moduleKey: string): boolean { return can(moduleKey, 'delete') }
  function canPrint(moduleKey: string): boolean { return can(moduleKey, 'print') }
  function canExport(moduleKey: string): boolean { return can(moduleKey, 'export') }
  function canApprove(moduleKey: string): boolean { return can(moduleKey, 'approve') }

  return { can, canRead, canWrite, canModify, canDelete, canPrint, canExport, canApprove, getPermissions }
}

function getEmpty(): Record<PermissionAction, boolean> {
  return { read: false, write: false, modify: false, delete: false, print: false, export: false, approve: false }
}

function getFull(): Record<PermissionAction, boolean> {
  return { read: true, write: true, modify: true, delete: true, print: true, export: true, approve: true }
}