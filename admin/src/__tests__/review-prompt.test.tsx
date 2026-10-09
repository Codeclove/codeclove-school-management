import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ReviewPromptBanner } from '../modules/dashboard/components/ReviewPromptBanner'
import { dismissReviewPrompt, type DismissReviewPromptResponse } from '../api/review-prompt'
import { api, type ApiSuccessResponse } from '../lib/api-client'

vi.mock('../lib/api-client', () => ({
  api: {
    post: vi.fn(),
  },
}))

describe('ReviewPromptBanner & dismissReviewPrompt API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.CodeCloveConfig
    // @ts-expect-error test mock window
    globalThis.window = {
      open: vi.fn(),
      CodeCloveConfig: undefined,
    }
  })

  describe('Banner Rendering Logic', () => {
    it('does not render when reviewPrompt config is absent or shouldShow is false', () => {
      // @ts-expect-error test mock
      window.CodeCloveConfig = {
        reviewPrompt: {
          shouldShow: false,
        },
      }

      const html = renderToString(<ReviewPromptBanner />)
      expect(html).toBe('')
    })

    it('renders banner with 5 golden stars and student count message when triggered by students_count', () => {
      // @ts-expect-error test mock
      window.CodeCloveConfig = {
        reviewPrompt: {
          shouldShow: true,
          triggerReason: 'students_count',
          studentsCount: 8,
          daysPassed: 2,
          reviewUrl: 'https://wordpress.org/support/plugin/codeclove-school-management/reviews/#new-post',
        },
      }

      const html = renderToString(<ReviewPromptBanner />)

      expect(html).toContain('Loving CodeClove? ⭐')
      expect(html).toContain('Congratulations on enrolling 8 students!')
      expect(html).toContain('Leave a 5-Star Review')
      expect(html).toContain('Remind me in 2 weeks')
      expect(html).toContain('Already Reviewed')
      expect(html).toContain('Don&#x27;t Ask Again')
      expect(html).toContain('Need Help?')
      // Golden stars
      expect(html).toContain('text-amber-400')
      expect(html).toContain('fill-amber-400')
    })

    it('renders banner with days passed message when triggered by days_passed', () => {
      // @ts-expect-error test mock
      window.CodeCloveConfig = {
        reviewPrompt: {
          shouldShow: true,
          triggerReason: 'days_passed',
          studentsCount: 2,
          daysPassed: 7,
          reviewUrl: 'https://wordpress.org/support/plugin/codeclove-school-management/reviews/#new-post',
        },
      }

      const html = renderToString(<ReviewPromptBanner />)

      expect(html).toContain('Loving CodeClove? ⭐')
      expect(html).toContain("You&#x27;ve been using CodeClove for 7 days!")
      expect(html).toContain('Leave a 5-Star Review')
      expect(html).toContain('Remind me in 2 weeks')
      expect(html).toContain('Already Reviewed')
      expect(html).toContain('Don&#x27;t Ask Again')
      expect(html).toContain('Need Help?')
    })

    it('supports snake_case keys in window.CodeCloveConfig.reviewPrompt', () => {
      // @ts-expect-error test mock
      window.CodeCloveConfig = {
        reviewPrompt: {
          should_show: true,
          trigger_reason: 'students_count',
          students_count: 12,
          days_passed: 1,
        },
      }

      const html = renderToString(<ReviewPromptBanner />)

      expect(html).toContain('Loving CodeClove? ⭐')
      expect(html).toContain('Congratulations on enrolling 12 students!')
    })
  })

  describe('dismissReviewPrompt API function', () => {
    it('sends POST request to review-prompt/dismiss with reviewed action', async () => {
      const mockResponse: ApiSuccessResponse<DismissReviewPromptResponse> = {
        success: true,
        data: { dismissed: true, action: 'reviewed' },
      }
      vi.mocked(api.post).mockResolvedValueOnce(mockResponse)

      const result = await dismissReviewPrompt('reviewed')

      expect(api.post).toHaveBeenCalledWith('review-prompt/dismiss', {
        action: 'reviewed',
      })
      expect(result).toEqual({ dismissed: true, action: 'reviewed' })
    })

    it('sends POST request with maybe_later action', async () => {
      const mockResponse: ApiSuccessResponse<DismissReviewPromptResponse> = {
        success: true,
        data: { dismissed: true, action: 'maybe_later' },
      }
      vi.mocked(api.post).mockResolvedValueOnce(mockResponse)

      const result = await dismissReviewPrompt('maybe_later')

      expect(api.post).toHaveBeenCalledWith('review-prompt/dismiss', {
        action: 'maybe_later',
      })
      expect(result).toEqual({ dismissed: true, action: 'maybe_later' })
    })

    it('sends POST request with never action', async () => {
      const mockResponse: ApiSuccessResponse<DismissReviewPromptResponse> = {
        success: true,
        data: { dismissed: true, action: 'never' },
      }
      vi.mocked(api.post).mockResolvedValueOnce(mockResponse)

      const result = await dismissReviewPrompt('never')

      expect(api.post).toHaveBeenCalledWith('review-prompt/dismiss', {
        action: 'never',
      })
      expect(result).toEqual({ dismissed: true, action: 'never' })
    })
  })
})
