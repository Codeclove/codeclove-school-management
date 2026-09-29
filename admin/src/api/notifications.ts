/**
 * TanStack Query hooks for the In-App Notifications API.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/query-keys'
import { api } from '@/lib/api-client'

export interface NotificationItem {
  id: number
  title: string
  content: string
  event_type: string
  is_read: boolean
  url: string | null
  created_at: string
}

export interface NotificationResponse {
  items: NotificationItem[]
  unread_count: number
  pagination: {
    total: number
    per_page: number
    current_page: number
    total_pages: number
  }
}

export function useNotifications(page = 1, perPage = 20, pollInterval = 30000) {
  return useQuery<NotificationResponse>({
    queryKey: queryKeys.notifications.list(page, perPage),
    queryFn: async () => {
      const res = await api.get<NotificationResponse>(`notifications?page=${page}&per_page=${perPage}`)
      return res.data
    },
    refetchInterval: pollInterval,
    staleTime: 15 * 1000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post<{ success: boolean }>(`notifications/${id}/read`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean }>(`notifications/read-all`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
  })
}

// ─── Announcement / Noticeboard CRUD Hooks ───────────────────────────────────

export interface AnnouncementItem {
  id: number
  title: string
  content: string
  audience: string
  event_type: string
  url: string | null
  created_at: string
  is_read: boolean
}

export interface AnnouncementListResponse {
  items: AnnouncementItem[]
  total: number
}

export interface CreateAnnouncementInput {
  title: string
  content: string
  audience?: 'portal' | 'staff' | 'all'
  event_type?: string
  url?: string | null
}

export interface UpdateAnnouncementInput {
  title?: string
  content?: string
  audience?: string
  event_type?: string
  url?: string | null
}

export interface AnnouncementFilters {
  page?: number
  per_page?: number
  search?: string
  audience?: string
  event_type?: string
}

export function useAnnouncements(filters?: AnnouncementFilters) {
  const clean = Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, v]) => v !== undefined && v !== '' && v !== 'all')
  )
  const qs = new URLSearchParams(clean as Record<string, string>).toString()

  return useQuery<AnnouncementListResponse>({
    queryKey: queryKeys.announcements.list(filters),
    queryFn: async () => {
      const res = await api.get<AnnouncementListResponse>(`announcements${qs ? `?${qs}` : ''}`)
      return res.data
    },
    staleTime: 15 * 1000,
  })
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateAnnouncementInput) => {
      const res = await api.post<{ id: number; created: boolean }>('announcements', data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
  })
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateAnnouncementInput }) => {
      const res = await api.put<{ updated: boolean }>(`announcements/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete<{ deleted: boolean }>(`announcements/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}
