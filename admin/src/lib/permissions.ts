/**
 * Permissions — role-based access control for the admin frontend.
 *
 * The backend injects the current user's permissions into window.CodeCloveConfig.
 * This hook reads them and exposes a single `can(permission)` check.
 *
 * Usage:
 *   const { can } = usePermissions()
 *   if (!can(PERMISSIONS.STUDENTS_ADD)) return null
 *
 * The WordPress admin is always treated as a super-admin with all permissions.
 */
import { useCallback, useMemo } from 'react'
import { PERMISSIONS } from './constants'

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS]

export function usePermissions() {
  const config = window.CodeCloveConfig

  const permissions = useMemo<Set<string>>(() => {
    if (!config) return new Set()
    // WordPress admins bypass all checks
    if (config.currentUser?.isAdmin) return new Set(['*'])
    const raw = (config as any).permissions
    if (Array.isArray(raw)) return new Set(raw as string[])
    return new Set()
  }, [config])

  const can = useCallback(
    (permission: PermissionKey): boolean => {
      return permissions.has('*') || permissions.has(permission)
    },
    [permissions]
  )

  const canAny = useCallback(
    (...perms: PermissionKey[]): boolean => {
      return perms.some((p) => can(p))
    },
    [can]
  )

  return { can, canAny }
}
