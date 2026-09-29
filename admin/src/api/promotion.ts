/**
 * TanStack Query hooks for the Student Promotion & Session Rollover module.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface EligibleStudent {
  student_id: number
  student_number: string
  first_name: string
  last_name: string
  student_status: string
  current_enrollment_id: number
  academic_unit_id: number
  academic_group_id: number | null
  roll_number?: string
  current_unit_name: string
  current_group_name: string
}

export interface PromotionPayloadItem {
  student_id: number
  current_enrollment_id: number
  action: 'promote' | 'detain' | 'graduate' | 'withdraw'
  target_unit_id?: number
  target_group_id?: number | null
  roll_number?: string
}

export interface ExecutePromotionPayload {
  source_session_id: number
  target_session_id: number
  promotions: PromotionPayloadItem[]
}

export interface CloneStructurePayload {
  source_session_id: number
  target_session_id: number
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePromotionEligible(filters: {
  session_id: number
  unit_id?: number
  group_id?: number
  student_id?: number
}) {
  return useQuery<EligibleStudent[]>({
    queryKey: queryKeys.promotion.eligible(filters),
    queryFn: async () => {
      let query = `promotion/eligible?session_id=${filters.session_id}`
      if (filters.unit_id) query += `&unit_id=${filters.unit_id}`
      if (filters.group_id) query += `&group_id=${filters.group_id}`
      if (filters.student_id) query += `&student_id=${filters.student_id}`

      const res = await api.get<EligibleStudent[]>(query)
      return res.data
    },
    enabled: !!filters.session_id,
  })
}

export function useCloneStructure() {
  return useMutation({
    mutationFn: async (payload: CloneStructurePayload) => {
      const res = await api.post<{
        success: boolean
        cloned_units_count: number
        cloned_groups_count: number
        cloned_subjects_count: number
      }>('promotion/clone-structure', payload)
      return res.data
    },
  })
}

export function useExecutePromotion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: ExecutePromotionPayload) => {
      const res = await api.post<{
        success: boolean
        processed_count: number
      }>('promotion/execute', payload)
      return res.data
    },
    onSuccess: () => {
      // Invalidate students lists and enrollment related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.promotion.all })
    },
  })
}
