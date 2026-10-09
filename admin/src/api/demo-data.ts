/**
 * TanStack Query hooks and API client for Demo Data Management.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'

export interface DemoDataStatus {
  imported: boolean
  prompt_dismissed: boolean
  student_count: number
  session_count: number
  should_show_prompt: boolean
  has_demo_data: boolean
}

export interface DemoDataResult {
  success: boolean
  message: string
}

/**
 * Imports realistic sample school records.
 *
 * @param country Optional country preset ('IN', 'US', 'GB').
 */
export async function importDemoData(country?: string): Promise<DemoDataResult> {
  const response = await api.post<DemoDataResult>('demo-data/import', country ? { country } : {})
  return response.data
}

/**
 * Clears demo records and resets the demo data flag.
 */
export async function clearDemoData(): Promise<DemoDataResult> {
  const response = await api.post<DemoDataResult>('demo-data/clear', {})
  return response.data
}

/**
 * Gets the current status of demo data.
 */
export async function getDemoDataStatus(): Promise<DemoDataStatus> {
  const response = await api.get<DemoDataStatus>('demo-data/status')
  return response.data
}

/**
 * Dismisses the demo data notification / prompt.
 */
export async function dismissDemoDataPrompt(): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>('demo-data/dismiss', {})
  return response.data
}

/**
 * TanStack Query hook for demo data status.
 */
export function useDemoDataStatus(options?: { enabled?: boolean }) {
  return useQuery<DemoDataStatus, Error>({
    queryKey: queryKeys.demoData.status(),
    queryFn: getDemoDataStatus,
    staleTime: 5000,
    ...options,
  })
}
