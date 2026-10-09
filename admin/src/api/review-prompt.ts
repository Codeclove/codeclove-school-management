/**
 * API client functions for milestone review prompt dismissal.
 */
import { api } from '@/lib/api-client'

export type ReviewPromptAction = 'reviewed' | 'maybe_later' | 'never'

export interface ReviewPromptStatus {
  should_show?: boolean
  shouldShow?: boolean
  trigger_reason?: string
  triggerReason?: string
  students_count?: number
  studentsCount?: number
  days_passed?: number
  daysPassed?: number
  review_url?: string
  reviewUrl?: string
  support_url?: string
  supportUrl?: string
  [key: string]: unknown
}

export interface DismissReviewPromptResponse {
  dismissed: boolean
  action: ReviewPromptAction
}

/**
 * Dismisses or snoozes the review prompt banner.
 *
 * @param action 'reviewed', 'maybe_later', or 'never'
 */
export async function dismissReviewPrompt(
  action: ReviewPromptAction
): Promise<DismissReviewPromptResponse> {
  const response = await api.post<DismissReviewPromptResponse>('review-prompt/dismiss', {
    action,
  })
  return response.data
}
