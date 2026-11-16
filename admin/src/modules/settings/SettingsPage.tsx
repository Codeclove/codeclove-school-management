/**
 * SettingsPage — lean orchestrator shell (Phase 2 refactor).
 *
 * This file owns ONLY:
 *   1. Data fetching (useSettings / usePresets / useApplyPreset)
 *   2. Form state (react-hook-form)
 *   3. Tab navigation state
 *   4. Preset apply modal + diff preview logic
 *   5. Save submit handler
 *
 * All visual tab content lives in /tabs/*.tsx
 * All form primitive components live in /components/SettingsFormPrimitives.tsx
 */
import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import {
  School,
  GraduationCap,
  ClipboardList,
  Briefcase,
  Fingerprint,
  Languages,
  Palette,
  Code as CodeIcon,
  Server,
  Save,
  Check,
  AlertTriangle,
  Mail,
  Smartphone,
  MessageCircle,
  RotateCcw,
  Bell,
  History,
  CreditCard,
  Lock,
  Sparkles,
  GitMerge,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Card, PageHeader, Spinner, Modal, ModalFooter, Skeleton } from '@/components/ui'
import { __ } from '@/lib/i18n'
import { onFormError } from '@/lib/form-errors'
import {
  useSettings,
  useUpdateSettings,
  usePresets,
  useApplyPreset,
  type CodeCloveSettings,
  type PreviewData,
} from '@/api/settings'
import { useTheme } from '@/lib/theme'
import { useToast } from '@/lib/toast'

// ── Tab components ────────────────────────────────────────────────────────────
import { GeneralTab }          from './tabs/GeneralTab'
import { EducationTab }        from './tabs/EducationTab'
import { AdmissionsTab }       from './tabs/AdmissionsTab'
import { StaffTab }            from './tabs/StaffTab'
import { IdentifiersTab }      from './tabs/IdentifiersTab'
import { LocalizationTab }     from './tabs/LocalizationTab'
import { AppearanceTab }       from './tabs/AppearanceTab'
import { ShortcodesTab }       from './tabs/ShortcodesTab'
import { SystemTab }           from './tabs/SystemTab'
import { NotificationsTab }    from './tabs/NotificationsTab'
import { proSettingsTabs } from '@/pro'
import { PRO_TAB_UPGRADE_MAP } from './constants'
// ─── Tab Config ───────────────────────────────────────────────────────────────

interface TabDefinition {
  id: string
  label: string
  icon: typeof School
  pro?: boolean
}

const TABS: TabDefinition[] = [
  { id: 'general',              label: __( 'School Profile', 'codeclove-school-management' ),    icon: School        },
  { id: 'education',            label: __( 'Academic Setup', 'codeclove-school-management' ),    icon: GraduationCap },
  { id: 'admissions',           label: __( 'Admissions', 'codeclove-school-management' ),        icon: ClipboardList },
  { id: 'staff',                label: __( 'Staff Onboarding', 'codeclove-school-management' ),  icon: Briefcase     },
  { id: 'identifiers',          label: __( 'ID Formats', 'codeclove-school-management' ),        icon: Fingerprint   },
  { id: 'localization',         label: __( 'Region & Language', 'codeclove-school-management' ), icon: Languages     },
  { id: 'appearance',           label: __( 'Appearance', 'codeclove-school-management' ),        icon: Palette       },
  { id: 'gateways',             label: __( 'Payment Gateways', 'codeclove-school-management' ),  icon: CreditCard, pro: true },
  { id: 'email_notifications',  label: __( 'Email Alerts', 'codeclove-school-management' ),      icon: Mail          },
  { id: 'sms_notifications',    label: __( 'SMS Alerts', 'codeclove-school-management' ),        icon: Smartphone,    pro: true },
  { id: 'whatsapp_notifications', label: __( 'WhatsApp Alerts', 'codeclove-school-management' ), icon: MessageCircle, pro: true },
  { id: 'in_app_notifications', label: __( 'In-App Alerts', 'codeclove-school-management' ),     icon: Bell,          pro: true },
  { id: 'shortcodes',           label: __( 'Shortcodes', 'codeclove-school-management' ),        icon: CodeIcon      },
  { id: 'system',               label: __( 'System', 'codeclove-school-management' ),            icon: Server        },
  { id: 'activity_log',         label: __( 'Activity Log', 'codeclove-school-management' ),      icon: History,    pro: true },
]

type TabId = (typeof TABS)[number]['id']
// ─── Diff Types ───────────────────────────────────────────────────────────────

interface DiffItem {
  category?: string
  label: string
  current: string
  preset: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const isPro = window.CodeCloveConfig?.isPro ?? false
  const visibleTabs = TABS
  const toast = useToast()
  const { data: settings, isLoading, isError } = useSettings()
  const updateSettingsMutation = useUpdateSettings()
  const { data: presets = [] } = usePresets()
  const applyPresetMutation = useApplyPreset()
  const { setTheme } = useTheme()

  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as TabId | null

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if ((tabFromUrl as string) === 'notifications') return 'email_notifications'
    const target = tabFromUrl ? TABS.find((t) => t.id === tabFromUrl) : null
    return target && (isPro || !target.pro) ? target.id : 'general'
  })

  useEffect(() => {
    if ((tabFromUrl as string) === 'notifications') {
      setActiveTab('email_notifications')
      return
    }
    if (tabFromUrl && visibleTabs.some((t) => t.id === tabFromUrl)) {
      if (tabFromUrl !== activeTab) {
        setActiveTab(tabFromUrl)
      }
    }
  }, [tabFromUrl, activeTab, visibleTabs])

  const currentTab = visibleTabs.find((t) => t.id === activeTab) ?? visibleTabs[0]

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId })
  }
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [showPresetModal, setShowPresetModal] = useState(false)
  const [saveStatus, setSaveStatus]     = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [previewData, setPreviewData]   = useState<PreviewData | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // ── React Hook Form ────────────────────────────────────────────────────────

  const { register, handleSubmit, watch, control, setValue, reset, formState: { isDirty } } =
    useForm<CodeCloveSettings>({ defaultValues: settings ?? {} })

  // Populate form once settings are loaded from API
  useEffect(() => {
    if (settings) reset(settings)
  }, [settings, reset])

  // ── Save ───────────────────────────────────────────────────────────────────

  const onSubmit = async (data: CodeCloveSettings) => {
    setSaveStatus('saving')
    try {
      await updateSettingsMutation.mutateAsync(data)
      setSaveStatus('idle')
      toast.success(__( 'Settings saved successfully!', 'codeclove-school-management' ))
      const isRtl = Boolean(data.localization?.rtl)
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
      if (globalThis.window?.CodeCloveConfig) globalThis.window.CodeCloveConfig.rtl = isRtl
      reset(data) // reset dirty state to new values
    } catch (err: unknown) {
      setSaveStatus('error')
      const msg = (err as Error)?.message || __( 'Failed to save settings.', 'codeclove-school-management' )
      toast.error(msg)
      setTimeout(() => setSaveStatus('idle'), 4000)
    }
  }

  // ── Preset preview ─────────────────────────────────────────────────────────

  const handleOpenPresetModal = () => {
    if (!selectedPreset) return
    setShowPresetModal(true)
    setLoadingPreview(true)
    setPreviewData(null)
    applyPresetMutation.mutate(
      { code: selectedPreset, mode: 'preview' },
      {
        onSuccess: (res) => { setPreviewData(res as PreviewData); setLoadingPreview(false) },
        onError:   ()    => { setLoadingPreview(false) },
      }
    )
  }

  const handleApplyPreset = (mode: 'replace_defaults' | 'missing_only') => {
    applyPresetMutation.mutate(
      { code: selectedPreset, mode },
      {
        onSuccess: () => {
          setShowPresetModal(false)
          setSelectedPreset('')
          toast.success(__( 'Curriculum preset applied successfully!', 'codeclove-school-management' ))
        },
        onError: (err: unknown) => {
          const msg = (err as { message?: string })?.message || __( 'Failed to apply preset.', 'codeclove-school-management' )
          toast.error(msg)
        },
      }
    )
  }

  const diffItems = useMemo<DiffItem[]>(() => {
    if (!previewData?.current || !previewData?.preset) return []
    const items: DiffItem[] = []

    const FIELD_LABELS: Record<string, string> = {
      academic_unit: __( 'Student Level (Class / Grade)', 'codeclove-school-management' ),
      academic_group: __( 'Classroom Group (Section / Form)', 'codeclove-school-management' ),
      academic_year: __( 'Academic Session / Year', 'codeclove-school-management' ),
      assessment: __( 'Assessment / Examination', 'codeclove-school-management' ),
      admission_application: __( 'Admission Application', 'codeclove-school-management' ),
      admission_status: __( 'Admission Status', 'codeclove-school-management' ),
      fee_invoice: __( 'Fee Invoice', 'codeclove-school-management' ),
      fee_receipt: __( 'Fee Receipt', 'codeclove-school-management' ),
      student: __( 'Student Label', 'codeclove-school-management' ),
      staff: __( 'Staff Member Label', 'codeclove-school-management' ),
      weekend_days: __( 'Weekend Days', 'codeclove-school-management' ),
      timezone: __( 'Timezone', 'codeclove-school-management' ),
      currency: __( 'Currency Code', 'codeclove-school-management' ),
      currency_symbol: __( 'Currency Symbol', 'codeclove-school-management' ),
      currency_position: __( 'Currency Position', 'codeclove-school-management' ),
      date_format: __( 'Date Format', 'codeclove-school-management' ),
      time_format: __( 'Time Format', 'codeclove-school-management' ),
      academic_year_start_month: __( 'Session Start Month', 'codeclove-school-management' ),
      academic_year_end_month: __( 'Session End Month', 'codeclove-school-management' ),
      default_grading_scheme: __( 'Grading Scheme', 'codeclove-school-management' ),
      terms_per_session: __( 'Terms Per Session', 'codeclove-school-management' ),
      class_seeding_strategy: __( 'Class Seeding Strategy', 'codeclove-school-management' ),
      student_id_prefix: __( 'Student ID Prefix', 'codeclove-school-management' ),
      staff_id_prefix: __( 'Staff ID Prefix', 'codeclove-school-management' ),
      receipt_number_prefix: __( 'Receipt Prefix', 'codeclove-school-management' ),
      invoice_number_prefix: __( 'Invoice Prefix', 'codeclove-school-management' ),
      admission_number_prefix: __( 'Admission Number Prefix', 'codeclove-school-management' ),
    }

    const formatKeyName = (key: string): string => {
      if (FIELD_LABELS[key]) return FIELD_LABELS[key]
      return key
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }

    const MONTH_NAMES = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]

    const WEEKEND_LABELS: Record<string, string> = {
      sunday_only: __( 'Sunday only', 'codeclove-school-management' ),
      saturday_sunday: __( 'Saturday & Sunday', 'codeclove-school-management' ),
      friday_saturday: __( 'Friday & Saturday', 'codeclove-school-management' ),
    }

    const GRADING_LABELS: Record<string, string> = {
      marks_percentage: __( 'Marks + Percentage (0–100)', 'codeclove-school-management' ),
      letter_grade: __( 'Letter Grade (A–F)', 'codeclove-school-management' ),
      gpa: __( 'GPA Scale (4.0)', 'codeclove-school-management' ),
      key_stages: __( 'Key Stages Assessment Levels', 'codeclove-school-management' ),
    }

    const formatPresetValue = (val: unknown, key?: string): string => {
      if (val == null) return '—'
      if (key && (key === 'academic_year_start_month' || key === 'academic_year_end_month')) {
        const m = Number(val)
        if (m >= 1 && m <= 12) {
          return `${MONTH_NAMES[m]}`
        }
      }
      if (key === 'weekend_days' && typeof val === 'string' && WEEKEND_LABELS[val]) {
        return WEEKEND_LABELS[val]
      }
      if (key === 'default_grading_scheme' && typeof val === 'string' && GRADING_LABELS[val]) {
        return GRADING_LABELS[val]
      }
      if (key === 'terms_per_session') {
        const t = Number(val)
        if (t === 3) return __( '3 Terms (Trimesters)', 'codeclove-school-management' )
        if (t === 2) return __( '2 Semesters', 'codeclove-school-management' )
        if (t === 4) return __( '4 Quarters', 'codeclove-school-management' )
        return `${t} Terms`
      }
      if (typeof val === 'boolean') {
        return val ? __( 'Yes', 'codeclove-school-management' ) : __( 'No', 'codeclove-school-management' )
      }
      if (Array.isArray(val)) {
        return val.length > 0 ? val.join(', ') : '—'
      }
      if (typeof val === 'object' && val !== null) {
        const obj = val as Record<string, unknown>
        if ('singular' in obj && 'plural' in obj) {
          return `${obj.singular} / ${obj.plural}`
        }
        return JSON.stringify(val)
      }
      return String(val)
    }

    const currentLabels = previewData.current.labels ?? {}
    const presetLabels  = previewData.preset.labels  ?? {}
    const currentLoc    = previewData.current.localization ?? {}
    const presetLoc     = previewData.preset.localization  ?? {}
    const currentEdu    = previewData.current.education_system ?? {}
    const presetEdu     = previewData.preset.education_system  ?? {}
    const currentIds    = (previewData.current as Record<string, unknown>).identifiers as Record<string, unknown> | undefined ?? {}
    const presetIds     = (previewData.preset as Record<string, unknown>).identifiers as Record<string, unknown> | undefined ?? {}

    const sections: Array<{
      category: string
      cur: Record<string, unknown>
      pre: Record<string, unknown>
      ignore?: Record<string, boolean>
    }> = [
      {
        category: __( 'Academic Terminology', 'codeclove-school-management' ),
        cur: currentLabels as Record<string, unknown>,
        pre: presetLabels as Record<string, unknown>,
      },
      {
        category: __( 'Regional & Localization', 'codeclove-school-management' ),
        cur: currentLoc as Record<string, unknown>,
        pre: presetLoc as Record<string, unknown>,
      },
      {
        category: __( 'Academic Cycle Defaults', 'codeclove-school-management' ),
        cur: currentEdu as unknown as Record<string, unknown>,
        pre: presetEdu as unknown as Record<string, unknown>,
        ignore: { preset: true, preset_name: true, preset_version: true, customized: true },
      },
      {
        category: __( 'Identifier Prefixes', 'codeclove-school-management' ),
        cur: currentIds,
        pre: presetIds,
      },
    ]

    for (const section of sections) {
      const keys = new Set([...Object.keys(section.cur), ...Object.keys(section.pre)])
      for (const key of keys) {
        if (section.ignore?.[key]) continue
        const curStr = formatPresetValue(section.cur[key], key)
        const preStr = formatPresetValue(section.pre[key], key)
        if (curStr !== preStr) {
          items.push({
            category: section.category,
            label: formatKeyName(key),
            current: curStr,
            preset: preStr,
          })
        }
      }
    }

    return items
  }, [previewData])

  // ── Loading / Error guards ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6 w-full relative pb-28">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <Skeleton className="w-full md:w-56 h-96 rounded-xl flex-shrink-0" />
          <Skeleton className="flex-1 w-full h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-danger mx-auto" />
          <p className="font-semibold text-text">{__( 'Error loading settings', 'codeclove-school-management' )}</p>
          <p className="text-sm text-text-muted">{__( 'Failed to retrieve system settings from server.', 'codeclove-school-management' )}</p>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 w-full relative pb-28">
      <PageHeader
        title={__( 'Settings', 'codeclove-school-management' )}
        breadcrumbs={[
          { label: __( 'Settings', 'codeclove-school-management' ) },
          { label: currentTab?.label ?? __( 'General Settings', 'codeclove-school-management' ) },
        ]}
        description={__( 'Manage education presets, dynamic labels, admissions, onboarding, and system configurations.', 'codeclove-school-management' )}
        actions={
          activeTab !== 'activity_log' ? (
            <Button
              type="button"
              onClick={handleSubmit(onSubmit, onFormError)}
              disabled={saveStatus === 'saving'}
              className="gap-2 shadow-md font-semibold text-xs animate-glow"
            >
              {saveStatus === 'saving' ? <Spinner size="xs" /> : <Save size={14} />}
              {saveStatus === 'saving' ? __( 'Saving...', 'codeclove-school-management' ) : __( 'Save Settings', 'codeclove-school-management' )}
            </Button>
          ) : undefined
        }
      />

      <form onSubmit={handleSubmit(onSubmit, onFormError)} className="flex flex-col md:flex-row gap-6 items-start">
        {/* ── Sidebar nav ────────────────────────────────────────────── */}
        <div className="w-full md:w-56 flex-shrink-0">
          <Card className="p-2 md:sticky md:top-6 border-border shadow-sm">
            <nav className="space-y-0.5">
              {visibleTabs.map((tab) => {
                const isProLocked = !isPro && tab.pro
                const upgradeHref = isProLocked
                  ? `/pro-upgrade?feature=${PRO_TAB_UPGRADE_MAP[tab.id] || ''}`
                  : undefined

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    data-pro-upgrade={upgradeHref}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-all duration-150 text-start font-medium select-none',
                      activeTab === tab.id
                        ? 'bg-brand-dim text-brand font-semibold shadow-2xs'
                        : 'text-text-muted hover:text-text hover:bg-bg-subtle/50'
                    )}
                  >
                    <tab.icon
                      size={15}
                      className={activeTab === tab.id ? 'text-brand' : 'text-text-subtle'}
                    />
                    <span className="flex-1 truncate">{tab.label}</span>
                    {isProLocked && (
                      <span className="ms-auto flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/25">
                        PRO
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </Card>
        </div>

        {/* ── Tab content ────────────────────────────────────────────── */}
        <div key={activeTab} className="flex-1 min-w-0 space-y-6 w-full animate-slide-up">
          {activeTab === 'general'      && <GeneralTab register={register} control={control} setValue={setValue} />}
          {activeTab === 'education'    && (
            <EducationTab
              register={register}
              presets={presets}
              selectedPreset={selectedPreset}
              setSelectedPreset={setSelectedPreset}
              onApplyPresetClick={handleOpenPresetModal}
              watch={watch}
              control={control}
            />
          )}
          {activeTab === 'admissions'   && <AdmissionsTab register={register} control={control} />}
          {activeTab === 'staff'        && <StaffTab register={register} control={control} />}
          {activeTab === 'identifiers'  && <IdentifiersTab register={register} control={control} />}
          {activeTab === 'localization' && <LocalizationTab register={register} control={control} />}
          {activeTab === 'appearance'   && (
            <AppearanceTab
              register={register}
              setValue={setValue}
              watch={watch}
              setTheme={setTheme as (theme: string) => void}
            />
          )}
          {activeTab === 'email_notifications' && (
            <NotificationsTab
              register={register}
              control={control}
              watch={watch}
            />
          )}
          {activeTab === 'shortcodes'   && <ShortcodesTab settings={settings} />}
          {activeTab === 'system'       && <SystemTab settings={settings} control={control} register={register} />}
          {isPro && proSettingsTabs[activeTab] && (
            (() => {
              const ProTabComponent = proSettingsTabs[activeTab]
              if (!ProTabComponent) return null
              return (
                <ProTabComponent
                  control={control}
                  register={register}
                  watch={watch}
                  setValue={setValue}
                />
              )
            })()
          )}
          {!isPro && TABS.find((t) => t.id === activeTab)?.pro && (
            <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500">
                <Lock size={22} />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <p className="text-base font-semibold text-text">
                  {__( 'Pro Feature', 'codeclove-school-management' )}
                </p>
                <p className="text-sm text-text-muted leading-relaxed">
                  {__( 'This settings tab is available in CodeClove Pro. Upgrade to configure payment gateways, SMS alerts, WhatsApp notifications, and activity logs.', 'codeclove-school-management' )}
                </p>
              </div>
              <a
                href={window.CodeCloveConfig?.proUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors shadow-sm"
              >
                {__( 'Upgrade to Pro', 'codeclove-school-management' )}
              </a>
            </div>
          )}
        </div>
      </form>

      {/* ── Sticky Floating Save Bar ───────────────────────────────── */}
      {(isDirty || saveStatus === 'saving') && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 md:right-10 z-[120] flex items-center justify-between gap-4 p-2.5 px-4 sm:px-5 w-auto max-w-[calc(100vw-2rem)] sm:max-w-none bg-bg-overlay/95 backdrop-blur-md border border-border rounded-xl shadow-modal animate-slide-up">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="text-xs font-semibold text-text whitespace-nowrap">
              {__( 'Unsaved settings changes', 'codeclove-school-management' )}
            </span>
          </div>
          <div className="flex items-center gap-2 pl-3 border-l border-border shrink-0">
            {isDirty && saveStatus !== 'saving' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => reset(settings)}
                className="h-8 text-xs font-semibold gap-1.5 hover:bg-bg-subtle whitespace-nowrap"
              >
                <RotateCcw size={12} /> {__( 'Discard', 'codeclove-school-management' )}
              </Button>
            )}
            <Button
              type="button"
              onClick={handleSubmit(onSubmit, onFormError)}
              disabled={saveStatus === 'saving'}
              size="sm"
              className="h-8 text-xs font-semibold gap-1.5 shadow-md animate-glow whitespace-nowrap"
            >
              {saveStatus === 'saving' ? <Spinner size="xs" /> : <Save size={13} />}
              {saveStatus === 'saving' ? __( 'Saving...', 'codeclove-school-management' ) : __( 'Save Settings', 'codeclove-school-management' )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Preset Apply Modal ─────────────────────────────────────── */}
      <PresetModal
        open={showPresetModal}
        onClose={() => setShowPresetModal(false)}
        loading={loadingPreview}
        diffItems={diffItems}
        presetName={presets.find((p) => p.code === selectedPreset)?.name}
        isPending={applyPresetMutation.isPending}
        onApply={handleApplyPreset}
      />
    </div>
  )
}

// ─── Preset Modal ─────────────────────────────────────────────────────────────

function PresetModal({
  open,
  onClose,
  loading,
  diffItems,
  presetName,
  isPending,
  onApply,
}: {
  open: boolean
  onClose: () => void
  loading: boolean
  diffItems: DiffItem[]
  presetName?: string
  isPending: boolean
  onApply: (mode: 'replace_defaults' | 'missing_only') => void
}) {
  const groupedItems = useMemo(() => {
    const groups: Record<string, DiffItem[]> = {}
    for (const item of diffItems) {
      const cat = item.category || __( 'General', 'codeclove-school-management' )
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }
    return groups
  }, [diffItems])

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      size="lg"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="text-base font-semibold text-text leading-tight">
              {__( 'Switch Academic Structure', 'codeclove-school-management' )}
            </div>
            {presetName && (
              <div className="text-xs font-normal text-text-muted mt-0.5">
                {presetName}
              </div>
            )}
          </div>
        </div>
      }
      description={__( 'Review configuration differences before updating your school’s academic structure defaults.', 'codeclove-school-management' )}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2.5">
          <Spinner size="md" />
          <p className="text-xs text-text-muted">{__( 'Fetching structure comparison differences…', 'codeclove-school-management' )}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Diff comparison table */}
          <div className="border border-border rounded-xl bg-bg-surface overflow-hidden shadow-xs">
            {/* Fixed Table Header */}
            <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-bg-base/70 border-b border-border text-xs font-semibold text-text-muted select-none">
              <div className="col-span-4">{__( 'Configuration Field', 'codeclove-school-management' )}</div>
              <div className="col-span-4">{__( 'Current Value', 'codeclove-school-management' )}</div>
              <div className="col-span-4">{__( 'New Structure Default', 'codeclove-school-management' )}</div>
            </div>

            {/* Scrollable Rows */}
            <div className="max-h-[260px] overflow-y-auto overscroll-contain divide-y divide-border/60">
              {diffItems.length > 0 ? (
                Object.entries(groupedItems).map(([category, items]) => (
                  <div key={category} className="divide-y divide-border/40">
                    <div className="bg-bg-base/40 px-4 py-1.5 text-[10px] font-bold text-text-subtle uppercase tracking-wider">
                      {category}
                    </div>
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-3 px-4 py-2.5 text-xs items-center hover:bg-hover-bg/30 transition-colors"
                      >
                        <div className="col-span-4 font-medium text-text pr-2 leading-snug">
                          {item.label}
                        </div>
                        <div className="col-span-4 min-w-0 pr-2">
                          <span
                            className="inline-block max-w-full px-2.5 py-1 rounded-md text-xs font-normal text-text-muted bg-bg-base/80 border border-border/80 break-words leading-normal"
                            title={item.current}
                          >
                            {item.current}
                          </span>
                        </div>
                        <div className="col-span-4 min-w-0">
                          <span
                            className="inline-block max-w-full px-2.5 py-1 rounded-md text-xs font-medium text-brand-text bg-brand-subtle/40 border border-brand/20 break-words leading-normal"
                            title={item.preset}
                          >
                            {item.preset}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-success-dim/40 border border-success/20 flex items-center justify-center text-success">
                    <Check size={20} />
                  </div>
                  <p className="text-sm font-semibold text-text">
                    {__( 'No Differences Found', 'codeclove-school-management' )}
                  </p>
                  <p className="text-xs text-text-muted max-w-sm">
                    {__( 'Your current configuration already matches this academic structure default settings.', 'codeclove-school-management' )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Mode Explanation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-bg-surface border border-border text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-text">
                <GitMerge size={14} className="text-text-muted shrink-0" />
                <span>{__( 'Merge Missing Only', 'codeclove-school-management' )}</span>
              </div>
              <p className="text-text-muted text-[11px] leading-relaxed">
                {__( 'Fills in unset fields while safely preserving any customized labels and settings you already edited.', 'codeclove-school-management' )}
              </p>
            </div>
            <div className="space-y-1 sm:border-l sm:border-border sm:pl-3">
              <div className="flex items-center gap-1.5 font-semibold text-text">
                <RefreshCw size={14} className="text-brand shrink-0" />
                <span>{__( 'Overwrite All Defaults', 'codeclove-school-management' )}</span>
              </div>
              <p className="text-text-muted text-[11px] leading-relaxed">
                {__( 'Replaces all current labels and academic cycle defaults with this structure’s preset standards.', 'codeclove-school-management' )}
              </p>
            </div>
          </div>

          {/* Action Footer */}
          <ModalFooter className="sticky bottom-0 -mx-6 -mb-5 px-6 py-3.5 bg-bg-overlay/95 backdrop-blur-xs border-t border-border mt-4 z-10 flex-col sm:flex-row gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isPending}
              className="w-full sm:w-auto order-last sm:order-first text-xs"
            >
              {__( 'Cancel', 'codeclove-school-management' )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onApply('missing_only')}
              disabled={isPending}
              className="w-full sm:w-auto text-xs font-medium gap-1.5"
            >
              <GitMerge size={13} className="text-text-muted shrink-0" />
              {__( 'Merge Missing Only', 'codeclove-school-management' )}
            </Button>
            <Button
              size="sm"
              onClick={() => onApply('replace_defaults')}
              disabled={isPending}
              className="w-full sm:w-auto text-xs font-semibold gap-1.5"
            >
              {isPending ? <Spinner size="xs" /> : <RefreshCw size={13} className="shrink-0" />}
              {__( 'Overwrite All Defaults', 'codeclove-school-management' )}
            </Button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  )
}
