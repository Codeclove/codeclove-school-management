/**
 * CodeClove Portal API Client.
 *
 * Lightweight, standard fetch wrapper injecting WordPress REST nonce
 * and handling portal endpoints.
 */

import { ApiError, type ApiSuccessResponse, type ApiErrorResponse } from '@/lib/api-client'
export { ApiError, type ApiSuccessResponse, type ApiErrorResponse }

function getBaseUrl(): string {
  const url = window.CodeClovePortalConfig?.restUrl ?? '/wp-json/codeclove/v1/portal/'
  const clean = url.replace(/\/+$/, '')
  return clean.endsWith('/portal') ? clean : `${clean}/portal`
}

function getNonce(): string {
  return window.CodeClovePortalConfig?.nonce ?? ''
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanPath = path.replace(/^\/+/, '')
  const baseUrl = getBaseUrl()
  const fullUrl = cleanPath ? `${baseUrl}/${cleanPath}` : baseUrl

  const headers = new Headers(options.headers)
  const nonce = getNonce()
  if (nonce) {
    headers.set('X-WP-Nonce', nonce)
  }

  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(fullUrl, { ...options, headers })

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const body = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    const errorObj = (typeof body === 'object' && body !== null ? body : {}) as Partial<ApiErrorResponse>
    throw new ApiError(
      errorObj.code ?? 'portal_error',
      errorObj.message ?? `Request failed with HTTP status ${response.status}`,
      response.status
    )
  }

  if (typeof body === 'object' && body !== null && 'data' in body && ('success' in body || 'status' in body)) {
    const envelope = body as ApiSuccessResponse<T>
    return envelope.data
  }

  return body as T
}

export const portalApi = {
  get<T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    let url = path
    if (params) {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          searchParams.append(key, String(value))
        }
      }
      const qs = searchParams.toString()
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs
      }
    }
    return request<T>(url)
  },

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  },
}
