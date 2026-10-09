/**
 * Global TypeScript declarations for runtime values injected by WordPress.
 *
 * PHP passes these via wp_localize_script() in Core/Assets.php.
 * Access anywhere via: window.CodeCloveConfig
 */

export interface CodeCloveCurrentUser {
  id: number
  name: string
  email: string
  avatar: string
  isAdmin: boolean
}

export interface CodeCloveConfigType {
  /** Base REST API URL, e.g. https://example.com/wp-json/codeclove/v1/ */
  restUrl: string
  /** WordPress REST nonce for X-WP-Nonce header */
  nonce: string
  /** WordPress admin URL for the CodeClove page */
  adminUrl: string
  /** Root WordPress admin URL (e.g. /wp-admin/) */
  wpAdminUrl?: string
  /** URL to log out of WordPress */
  logoutUrl: string
  /** Plugin assets URL */
  pluginUrl: string
  /** Plugin version string */
  version: string
  /** Whether CODECLOVE_DEV_TOOLS or CODECLOVE_DEV is active */
  devMode?: boolean
  /** Whether running as full Pro plugin */
  isPro?: boolean
  /** Active license state and summary */
  license?: {
    status: string
    label: string
    type: string
    is_valid: boolean
    expires?: string
    masked_key?: string
  }
  /** Upgrade to Pro target URL */
  proUrl?: string
  /** RBAC permissions list for the current user */
  permissions: string[]
  /** Current locale code, e.g. en_US, ar */
  locale: string
  /** Whether the layout direction is RTL */
  rtl: boolean
  /** URL of the JED translation JSON file, or null if default English */
  i18nUrl: string | null
  /** Currently authenticated WordPress user */
  currentUser: CodeCloveCurrentUser
  /** Milestone review prompt status */
  reviewPrompt?: {
    shouldShow?: boolean
    should_show?: boolean
    triggerReason?: string
    trigger_reason?: string
    studentsCount?: number
    students_count?: number
    daysPassed?: number
    days_passed?: number
    reviewUrl?: string
    review_url?: string
    supportUrl?: string
    support_url?: string
  }
  /** Demo data status */
  demoData?: {
    imported?: boolean
    prompt_dismissed?: boolean
    student_count?: number
    session_count?: number
    should_show_prompt?: boolean
    has_demo_data?: boolean
  }
  /** WordPress core environment settings */
  wpSettings?: {
    timezone: string
    currentTime?: string
    locale: string
    localeName?: string
    startOfWeek: number
    dateFormat: string
    timeFormat: string
    generalSettingsUrl: string
  }
}

export interface CodeClovePortalConfigType {
  restUrl: string
  nonce: string
  locale?: string
  rtl?: boolean
  i18n?: { locale_data: Record<string, Record<string, unknown>> } | null
  currentUser: {
    id: number
    name: string
    email: string
    roles: string[]
    role: string
    guardian: unknown
    student: unknown
  }
  context: unknown
  logoutUrl: string
  siteName: string
  logoUrl?: string
  version: string
  settings?: {
    school?: Record<string, any>
    appearance?: Record<string, any>
    localization?: Record<string, any>
    labels?: Record<string, any>
    finance?: {
      allow_partial_payments?: boolean
      min_partial_amount?: number
    }
  }
}

declare global {
  interface Window {
    CodeCloveConfig?: CodeCloveConfigType
    CodeClovePortalConfig?: CodeClovePortalConfigType
  }
}

export {}
