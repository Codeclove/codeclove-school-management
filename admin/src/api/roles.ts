/**
 * TanStack Query hooks for the Roles and Permissions API.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'
// ─── Types ────────────────────────────────────────────────────────────────────

export interface Role {
  id: number
  slug: string
  name: string
  description: string
  is_system: boolean
  is_locked: boolean
  permission_count?: number
  permissions?: string[]
}

export type GroupedPermissions = Record<string, Record<string, string>>

export interface CreateRolePayload {
  name: string
  description?: string
  permissions: string[]
}

export interface UpdateRolePayload {
  name?: string
  description?: string
  permissions?: string[]
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Hook to retrieve all CodeClove roles.
 */
export function useRoles() {
  return useQuery<Role[]>({
    queryKey: queryKeys.roles.list(),
    queryFn: async () => {
      const response = await api.get<Role[]>('roles')
      return response.data
    },
  })
}

/**
 * Hook to retrieve a single role details by ID.
 */
export function useRole(id: number) {
  return useQuery<Role>({
    queryKey: queryKeys.roles.detail(id),
    queryFn: async () => {
      const response = await api.get<Role>(`roles/${id}`)
      return response.data
    },
    enabled: id > 0,
  })
}

/**
 * Hook to retrieve all available system permission definitions.
 */
export function useSystemPermissions() {
  return useQuery<GroupedPermissions>({
    queryKey: queryKeys.roles.systemPermissions(),
    queryFn: async () => {
      const response = await api.get<GroupedPermissions>('roles/permissions')
      return response.data
    },
  })
}

/**
 * Hook to create a new custom role.
 */
export function useCreateRole() {
  const queryClient = useQueryClient()

  return useMutation<Role, Error, CreateRolePayload>({
    mutationFn: async (payload) => {
      const response = await api.post<Role>('roles', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all })
    },
  })
}

/**
 * Hook to update an existing role's settings and permissions.
 */
export function useUpdateRole(id: number) {
  const queryClient = useQueryClient()

  return useMutation<Role, Error, UpdateRolePayload>({
    mutationFn: async (payload) => {
      const response = await api.patch<Role>(`roles/${id}`, payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.detail(id) })
      // If the currently logged-in user's roles changed, invalidate settings to refresh permission tokens
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
    },
  })
}

/**
 * Hook to delete a custom role.
 */
export function useDeleteRole() {
  const queryClient = useQueryClient()

  return useMutation<{ deleted: boolean }, Error, number>({
    mutationFn: async (id) => {
      const response = await api.delete<{ deleted: boolean }>(`roles/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all })
    },
  })
}
