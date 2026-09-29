/**
 * Activity log API hook.
 *
 * Fetches paginated activity log entries from GET /codeclove/v1/activity-log.
 */
import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/api/query-keys'
import { api } from '@/lib/api-client'
import type { ApiPaginatedResponse } from '@/lib/api-client'

export interface ActivityLogEntry {
  id: number
  event_type: string
  event_category: string
  actor_type: string
  actor_id: number
  actor_name: string
  created_at: string
  label: string | null
  url: string | null
}

export interface ActivityLogParams {
  page?: number
  per_page?: number
  search?: string
  category?: string
  date_from?: string
  date_to?: string
}

export function useActivityLog(
  params?: ActivityLogParams,
  options?: Partial<UseQueryOptions<ApiPaginatedResponse<ActivityLogEntry[]>>>
) {
  return useQuery<ApiPaginatedResponse<ActivityLogEntry[]>>({
    queryKey: queryKeys.activity.list(params),
    queryFn: async () => {
      const qp = new URLSearchParams()
      if (params?.page) qp.set('page', String(params.page))
      if (params?.per_page) qp.set('per_page', String(params.per_page))
      if (params?.search) qp.set('search', params.search)
      if (params?.category && params.category !== 'all') qp.set('category', params.category)
      if (params?.date_from) qp.set('date_from', params.date_from)
      if (params?.date_to) qp.set('date_to', params.date_to)

      return api.list<ActivityLogEntry[]>(`activity-log?${qp.toString()}`)
    },
    staleTime: 30 * 1000, // 30s
    ...options,
  })
}
