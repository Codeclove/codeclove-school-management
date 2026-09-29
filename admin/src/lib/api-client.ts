/**
 * CodeClove REST API client.
 *
 * Thin wrapper around the Fetch API that:
 *   - Injects the WordPress REST nonce (X-WP-Nonce header)
 *   - Prefixes all paths with the configured REST base URL
 *   - Throws structured ApiError instances for non-2xx responses
 *   - Handles JSON serialization/deserialization
 *
 * Usage:
 *   const students = await api.get('students?page=1')
 *   const result   = await api.post('students', { first_name: 'Riya' })
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
}

export interface ApiPaginatedResponse<T = unknown> extends ApiSuccessResponse<T> {
  pagination: {
    total: number
    per_page: number
    current_page: number
    total_pages: number
  }
}

export interface ApiErrorResponse {
  success: false
  code: string
  message: string
  data?: { status: number; [key: string]: unknown }
  details?: unknown
}

/**
 * Structured error thrown when the API returns a non-2xx response.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * Returns the base REST URL from the WordPress-injected config.
 * Falls back to a relative URL for development.
 */
function getBaseUrl(): string {
  const url = window.CodeCloveConfig?.restUrl ?? window.CodeClovePortalConfig?.restUrl ?? '/wp-json/codeclove/v1/'
  const clean = url.replace(/\/+$/, '')
  return clean.endsWith('/portal') ? clean.replace(/\/portal$/, '') : clean
}

/**
 * Returns the WP REST nonce for authenticated requests.
 */
function getNonce(): string {
  return window.CodeCloveConfig?.nonce ?? window.CodeClovePortalConfig?.nonce ?? ''
}

/**
 * Core fetch wrapper — handles nonce injection, JSON parsing, and error throwing.
 */
async function request<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getBaseUrl().replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`

  const headers = new Headers(options.headers)
  headers.set('X-WP-Nonce', getNonce())
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, { ...options, headers })

  // Parse response body.
  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const err = (typeof body === 'object' && body !== null ? body : {}) as Partial<ApiErrorResponse>
    throw new ApiError(
      err.code ?? 'unknown_error',
      err.message ?? `Request failed with status ${response.status}`,
      response.status,
      err.details ?? err.data
    )
  }

  return body as T
}

// ─── Exported Methods ─────────────────────────────────────────────────────────

export const api = {
  get<T = unknown>(path: string): Promise<ApiSuccessResponse<T>> {
    return request<ApiSuccessResponse<T>>(path)
  },

  post<T = unknown>(path: string, body?: unknown): Promise<ApiSuccessResponse<T>> {
    return request<ApiSuccessResponse<T>>(path, {
      method: 'POST',
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    })
  },

  patch<T = unknown>(path: string, body?: unknown): Promise<ApiSuccessResponse<T>> {
    return request<ApiSuccessResponse<T>>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  },

  put<T = unknown>(path: string, body?: unknown): Promise<ApiSuccessResponse<T>> {
    return request<ApiSuccessResponse<T>>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  },

  delete<T = unknown>(path: string): Promise<ApiSuccessResponse<T>> {
    return request<ApiSuccessResponse<T>>(path, { method: 'DELETE' })
  },

  upload<T = unknown>(path: string, formData: FormData): Promise<ApiSuccessResponse<T>> {
    return request<ApiSuccessResponse<T>>(path, {
      method: 'POST',
      body: formData,
    })
  },

  /** Convenience for paginated list endpoints — types .data and .pagination automatically. */
  list<T = unknown>(path: string): Promise<ApiPaginatedResponse<T>> {
    return request<ApiPaginatedResponse<T>>(path)
  },
}

