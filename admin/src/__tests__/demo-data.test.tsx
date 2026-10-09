import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { DemoDataActiveBanner } from '../modules/dashboard/components/DemoDataActiveBanner'
import {
  getDemoDataStatus,
  dismissDemoDataPrompt,
  type DemoDataStatus,
} from '../api/demo-data'
import { api, type ApiSuccessResponse } from '../lib/api-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('Demo Data API & DemoDataActiveBanner', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  describe('DemoDataActiveBanner Component', () => {
    it('does not render when imported is false', () => {
      const status: DemoDataStatus = {
        imported: false,
        prompt_dismissed: false,
        student_count: 0,
        session_count: 0,
        should_show_prompt: false,
        has_demo_data: false,
      }

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <DemoDataActiveBanner status={status} />
        </QueryClientProvider>
      )

      expect(html).toBe('')
    })

    it('does not render when prompt_dismissed is true', () => {
      const status: DemoDataStatus = {
        imported: true,
        prompt_dismissed: true,
        student_count: 10,
        session_count: 1,
        should_show_prompt: false,
        has_demo_data: true,
      }

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <DemoDataActiveBanner status={status} />
        </QueryClientProvider>
      )

      expect(html).toBe('')
    })

    it('renders amber banner with headline, description, and Clear Sample Data action when imported is true', () => {
      const status: DemoDataStatus = {
        imported: true,
        prompt_dismissed: false,
        student_count: 12,
        session_count: 1,
        should_show_prompt: true,
        has_demo_data: true,
      }

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <DemoDataActiveBanner status={status} />
        </QueryClientProvider>
      )

      expect(html).toContain('Sample School Records Active')
      expect(html).toContain(
        'You are currently exploring CodeClove with demo classes, students, and invoices. When ready for real school operations, wipe sample records in 1 click.'
      )
      expect(html).toContain('Clear Sample Data')
      expect(html).toContain('border-amber-500/30')
    })
  })

  describe('Demo Data API Functions', () => {
    it('getDemoDataStatus sends GET request to demo-data/status', async () => {
      const mockStatus: DemoDataStatus = {
        imported: true,
        prompt_dismissed: false,
        student_count: 10,
        session_count: 1,
        should_show_prompt: true,
        has_demo_data: true,
      }
      const mockResponse: ApiSuccessResponse<DemoDataStatus> = {
        success: true,
        data: mockStatus,
      }

      vi.mocked(api.get).mockResolvedValueOnce(mockResponse)

      const result = await getDemoDataStatus()

      expect(api.get).toHaveBeenCalledWith('demo-data/status')
      expect(result).toEqual(mockStatus)
    })

    it('dismissDemoDataPrompt sends POST request to demo-data/dismiss', async () => {
      const mockResponse: ApiSuccessResponse<{ success: boolean; message: string }> = {
        success: true,
        data: {
          success: true,
          message: 'Demo data prompt dismissed.',
        },
      }

      vi.mocked(api.post).mockResolvedValueOnce(mockResponse)

      const result = await dismissDemoDataPrompt()

      expect(api.post).toHaveBeenCalledWith('demo-data/dismiss', {})
      expect(result).toEqual({
        success: true,
        message: 'Demo data prompt dismissed.',
      })
    })
  })
})
