/**
 * TanStack Query hooks for the Settings and Presets API.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SchoolSettings {
  name: string
  code: string
  logo: string
  signature: string
  email: string
  phone: string
  website: string
  address: string
}

export interface EducationSystemSettings {
  preset: string | null
  preset_name: string | null
  preset_version: string | null
  customized: boolean
  academic_year_start_month: number
  academic_year_end_month: number
  default_number_terms: number
  grading_default: string
  default_academic_units: string[]
  default_groups_per_unit: string[]
  new_session_classes_creation?: string
}

export interface TerminologyLabel {
  singular: string
  plural: string
}

export interface TerminologyLabels {
  academic_session: TerminologyLabel
  academic_term: TerminologyLabel
  academic_unit: TerminologyLabel
  academic_group: TerminologyLabel
  subject: TerminologyLabel
  assessment: TerminologyLabel
  guardian: TerminologyLabel
  student_guardian: TerminologyLabel
  admission_application: TerminologyLabel
  admission_status: TerminologyLabel
  staff_application: TerminologyLabel
  staff_application_status: TerminologyLabel
  student: TerminologyLabel
  staff_member: TerminologyLabel
  fee_type: TerminologyLabel
  invoice_line_item: TerminologyLabel
  invoice: TerminologyLabel
  payment: TerminologyLabel
  attendance_record: TerminologyLabel
}

export interface AdmissionSettings {
  enable_public_form: boolean
  enable_status_lookup: boolean
  require_approval: boolean
  default_status: string
  allowed_statuses: string[]
  required_documents: string[]
  notification_recipients: string
  verification_fields: string[]
  auto_convert: boolean
}

export interface StaffOnboardingSettings {
  enable_form: boolean
  enable_status_lookup: boolean
  require_approval: boolean
  default_status: string
  allowed_statuses: string[]
  required_documents: string[]
  notification_recipients: string
  verification_fields: string[]
  login_creation_behavior: 'immediate' | 'invite' | 'profile_only'
  default_role: string
}

export interface IdentifierFormat {
  prefix: string
  year_token: string
  sequence_padding: number
  next_number: number
  reset_rule: string
  separator: string
}

export interface IdentifierSettings {
  admission_application: IdentifierFormat
  staff_application: IdentifierFormat
  admission_number: IdentifierFormat
  student_number: IdentifierFormat
  staff_member: IdentifierFormat
  roll_number: IdentifierFormat
  invoice_number: IdentifierFormat
  payment_number: IdentifierFormat
}

export interface LocalizationSettings {
  language: string
  date_format: string
  time_format: string
  week_start_day: number
  timezone: string
  currency: string
  currency_position: 'left' | 'right' | 'left_space' | 'right_space'
  decimal_precision: number
  number_format: string
  rtl: boolean
}

export interface AppearanceSettings {
  mode: 'light' | 'dark' | 'system'
  layout: 'fluid' | 'boxed'
  sidebar_density: 'comfortable' | 'compact'
  table_density: 'comfortable' | 'compact'
  theme_color: 'classic_indigo' | 'sky_blue' | 'sunset_orange' | 'sunny_gold' | 'fresh_mint' | 'playful_violet' | 'fun_pink'
  ui_scale?: '80%' | '90%' | '100%' | '110%' | '125%' | '150%'
}

export interface SystemSettings {
  debug_logging: boolean
  log_retention_days: number
}

export interface NotificationTemplate {
  enabled: boolean
  subject: string
  body: string
  send_to_student?: boolean
  send_to_guardian?: boolean
}

export interface NotificationSettings {
  in_app_events: {
    notify_admission_received: boolean
    notify_admission_status: boolean
    notify_invoice_issued: boolean
    notify_payment_recorded: boolean
    notify_invoice_overdue: boolean
    notify_attendance_taken: boolean
  }
  mail_driver: 'wp_mail' | 'smtp'
  sender_name: string
  sender_email: string
  smtp_host: string
  smtp_port: number
  smtp_secure: 'none' | 'ssl' | 'tls'
  smtp_auth: boolean
  smtp_username: string
  smtp_password?: string
  templates: {
    admission_received: NotificationTemplate
    admission_status_changed: NotificationTemplate
    payment_recorded: NotificationTemplate
    attendance_alert: NotificationTemplate
    fee_reminder: NotificationTemplate
    invoice_issued: NotificationTemplate
    invoice_overdue: NotificationTemplate
    payment_reversed: NotificationTemplate
  }
  sms_enabled: boolean
  sms_provider: 'none' | 'twilio' | 'msg91' | 'fast2sms' | 'vonage'
  twilio_account_sid: string
  twilio_auth_token?: string
  twilio_from_number: string
  msg91_auth_key?: string
  msg91_sender_id: string
  fast2sms_api_key?: string
  vonage_api_key: string
  vonage_api_secret?: string
  vonage_from: string
  sms_templates: {
    admission_received: Omit<NotificationTemplate, 'subject'>
    admission_status_changed: Omit<NotificationTemplate, 'subject'>
    payment_recorded: Omit<NotificationTemplate, 'subject'>
    attendance_alert: Omit<NotificationTemplate, 'subject'>
    fee_reminder: Omit<NotificationTemplate, 'subject'>
    invoice_issued: Omit<NotificationTemplate, 'subject'>
    invoice_overdue: Omit<NotificationTemplate, 'subject'>
    payment_reversed: Omit<NotificationTemplate, 'subject'>
  }
}

export interface CodeCloveSettings {
  schema_version: string
  plugin_version: string
  school: SchoolSettings
  education_system: EducationSystemSettings
  labels: TerminologyLabels
  admissions: AdmissionSettings
  staff_onboarding: StaffOnboardingSettings
  identifiers: IdentifierSettings
  localization: LocalizationSettings
  appearance: AppearanceSettings
  system: SystemSettings
  notifications: NotificationSettings
}

export interface CountryPreset {
  code: string
  name: string
}

export interface DiagnosticData {
  generated_at: string
  plugin_version: string
  schema_version: string
  wordpress_version: string
  php_version: string
  site_url: string
  rest_url: string
  debug_logging: boolean
  active_preset: string | null
  active_preset_name: string | null
}

export interface PreviewData {
  current: {
    education_system: EducationSystemSettings
    labels: Partial<TerminologyLabels>
    localization: Partial<LocalizationSettings>
  }
  preset: {
    education_system: EducationSystemSettings
    labels: Partial<TerminologyLabels>
    localization: Partial<LocalizationSettings>
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Hook to retrieve active CodeClove settings.
 */
export function useSettings() {
  return useQuery<CodeCloveSettings>({
    queryKey: queryKeys.settings.detail(),
    queryFn: async () => {
      const response = await api.get<CodeCloveSettings>('settings')
      return response.data
    },
  })
}

/**
 * Hook to update settings.
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation<CodeCloveSettings, Error, Partial<CodeCloveSettings>>({
    mutationFn: async (settings) => {
      const response = await api.patch<CodeCloveSettings>('settings', settings)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.settings.detail(), data)
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
    },
  })
}

/**
 * Hook to retrieve available country presets.
 */
export function usePresets() {
  return useQuery<CountryPreset[]>({
    queryKey: queryKeys.presets.list(),
    queryFn: async () => {
      const response = await api.get<CountryPreset[]>('presets')
      return response.data
    },
  })
}

/**
 * Hook to apply a country preset (in replace, missing, or preview mode).
 */
export function useApplyPreset() {
  const queryClient = useQueryClient()

  return useMutation<
    CodeCloveSettings | PreviewData,
    Error,
    { code: string; mode: 'replace_defaults' | 'missing_only' | 'preview' }
  >({
    mutationFn: async ({ code, mode }) => {
      const response = await api.post<CodeCloveSettings | PreviewData>(`presets/${code}/apply`, { mode })
      return response.data
    },
    onSuccess: (_, variables) => {
      if (variables.mode !== 'preview') {
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
      }
    },
  })
}

/**
 * Clears the WordPress option cache used by settings.
 */
export async function clearSettingsCache(): Promise<string> {
  const response = await api.post<{ message: string }>('settings/clear-cache')
  return response.data.message
}

/**
 * Downloads a privacy-safe settings diagnostic snapshot.
 */
export async function getSettingsDiagnostics(): Promise<DiagnosticData> {
  const response = await api.get<DiagnosticData>('settings/diagnostics')
  return response.data
}

/**
 * Truncates and seeds all database tables with rich mock data.
 */
export async function resetAndSeedDatabase(): Promise<string> {
  const response = await api.post<{ message: string }>('dev/reset-and-seed')
  return response.data.message
}

/**
 * Hook to send a diagnostic test email.
 */
export function useSendTestEmail() {
  return useMutation<boolean, Error, { email: string }>({
    mutationFn: async ({ email }) => {
      const response = await api.post<{ sent: boolean }>('settings/notifications/test', { email })
      return response.data.sent
    },
  })
}

/**
 * Hook to send a diagnostic test SMS.
 */
export function useSendTestSms() {
  return useMutation<boolean, Error, { phone: string }>({
    mutationFn: async ({ phone }) => {
      const response = await api.post<{ sent: boolean }>('settings/notifications/test-sms', { phone })
      return response.data.sent
    },
  })
}

export interface SystemHealth {
  status: string
  db_connected: boolean
  php_version: string
  php_memory_limit: string
  max_upload_size: string
  mail_driver: string
  active_preset: string
  active_preset_name: string
  server_time: string
}

export function useApiHealth() {
  return useQuery<SystemHealth, Error>({
    queryKey: queryKeys.settings.health(),
    queryFn: async () => {
      const response = await api.get<SystemHealth>('settings/health')
      return response.data
    },
    staleTime: 30000,
    retry: 1,
  })
}

