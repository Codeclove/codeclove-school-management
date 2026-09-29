import { queryKeys } from '@/api/query-keys'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Staff } from './staff'

export interface UpdateMePayload {
  first_name?: string
  last_name?: string
  preferred_name?: string | null
  phone?: string | null
  photo_id?: number | null
  current_password?: string
  new_password?: string
  notification_preferences?: Record<string, boolean>
}

export function useMe() {
  return useQuery<Staff>({
    queryKey: queryKeys.me.details(),
    queryFn: async () => {
      const response = await api.get<Staff>('me')
      return response.data
    },
  })
}

export function useUpdateMe() {
  const queryClient = useQueryClient()

  return useMutation<Staff, Error, UpdateMePayload>({
    mutationFn: async (payload) => {
      const response = await api.put<Staff>('me', payload)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me.all })
      if (data.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.staff.detail(data.id) })
        queryClient.invalidateQueries({ queryKey: queryKeys.staff.all })
      }
    },
  })
}
