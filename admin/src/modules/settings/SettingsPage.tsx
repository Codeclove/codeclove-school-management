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
  Globe,
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
  Info,
  AlertTriangle,
  Mail,
  Smartphone,
  RotateCcw,
  Bell,
  History,
  CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Card, PageHeader, Spinner, Modal, ModalFooter, Skeleton } from '@/components/ui'
import { __ } from '@/lib/i18n'
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
  { id: 'sms_notifications',    label: __( 'SMS Alerts', 'codeclove-school-management' ),        icon: Smartphone, pro: true },
  { id: 'in_app_notifications', label: __( 'In-App Alerts', 'codeclove-school-management' ),     icon: Bell,       pro: true },
  { id: 'shortcodes',           label: __( 'Shortcodes', 'codeclove-school-management' ),        icon: CodeIcon      },
  { id: 'system',               label: __( 'System', 'codeclove-school-management' ),            icon: Server        },
  { id: 'activity_log',         label: __( 'Activity Log', 'codeclove-school-management' ),      icon: History,    pro: true },
]

type TabId = (typeof TABS)[number]['id']

// ─── Diff Types ───────────────────────────────────────────────────────────────

interface DiffItem {
  label: string
  current: string
  preset: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const isPro = window.CodeCloveConfig?.isPro ?? false
  const visibleTabs = TABS.filter((t) => !t.pro || isPro)
  const toast = useToast()
  const { data: settings, isLoading, isError } = useSettings()
  const updateSettingsMutation = useUpdateSettings()
  const { data: presets = [] } = usePresets()
  const applyPresetMutation = useApplyPreset()
  const { setTheme } = useTheme()

  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as TabId | null

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if ((tabFromUrl as string) === 'notifications') {
      return 'email_notifications'
    }
    if (tabFromUrl && visibleTabs.some((t) => t.id === tabFromUrl)) {
      return tabFromUrl
    }
    return 'general'
  })

  useEffect(() => {
    if ((tabFromUrl as string) === 'notifications') {
      setActiveTab('email_notifications')
      return
    }
    if (tabFromUrl && visibleTabs.some((t) => t.id === tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl, activeTab, isPro])

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
      setSaveStatus('saved')
      toast.success('Settings saved successfully!')
      reset(data) // reset dirty state to new values
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
      toast.error('Failed to save settings.')
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
          toast.success('Curriculum preset applied successfully!')
        },
        onError: (err: unknown) => {
          const msg = (err as { message?: string })?.message || 'Failed to apply preset.'
          toast.error(msg)
        },
      }
    )
  }

  const diffItems = useMemo<DiffItem[]>(() => {
    if (!previewData?.current || !previewData?.preset) return []
    const currentLabels = previewData.current.labels ?? {}
    const presetLabels  = previewData.preset.labels  ?? {}
    const allKeys = new Set([...Object.keys(currentLabels), ...Object.keys(presetLabels)])
    const items: DiffItem[] = []

    const formatKeyName = (key: string): string => {
      return key
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }

    const formatPresetValue = (val: unknown): string => {
      if (val == null) return '—'
      if (typeof val === 'object' && val !== null) {
        const obj = val as Record<string, unknown>
        if ('singular' in obj && 'plural' in obj) {
          return `${obj.singular} / ${obj.plural}`
        }
        return JSON.stringify(val)
      }
      return String(val)
    }

    for (const key of allKeys) {
      const cur = (currentLabels as Record<string, unknown>)[key]
      const pre = (presetLabels  as Record<string, unknown>)[key]
      const curStr = formatPresetValue(cur)
      const preStr = formatPresetValue(pre)
      if (curStr !== preStr) {
        items.push({ label: formatKeyName(key), current: curStr, preset: preStr })
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
          <p className="font-semibold text-text">Error loading settings</p>
          <p className="text-sm text-text-muted">Failed to retrieve system settings from server.</p>
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
              onClick={handleSubmit(onSubmit)}
              disabled={saveStatus === 'saving'}
              className="gap-2 shadow-md font-semibold text-xs animate-glow"
            >
              {saveStatus === 'saving' ? <Spinner size="xs" /> : <Save size={14} />}
              {saveStatus === 'saving' ? __( 'Saving...', 'codeclove-school-management' ) : __( 'Save Settings', 'codeclove-school-management' )}
            </Button>
          ) : undefined
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col md:flex-row gap-6 items-start">
        {/* ── Sidebar nav ────────────────────────────────────────────── */}
        <div className="w-full md:w-56 flex-shrink-0">
          <Card className="p-2 md:sticky md:top-6 border-border/60 shadow-sm">
            <nav className="space-y-0.5">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
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
                </button>
              ))}
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
        </div>
      </form>

      {/* ── Sticky Floating Save Bar ───────────────────────────────── */}
      {(isDirty || saveStatus === 'saving' || saveStatus === 'saved') && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 md:right-10 z-[120] flex items-center justify-between gap-4 p-2.5 px-4 sm:px-5 w-auto max-w-[calc(100vw-2rem)] sm:max-w-none bg-bg-overlay/95 backdrop-blur-md border border-border/80 rounded-2xl shadow-modal animate-slide-up">
          <div className="flex items-center gap-2.5 shrink-0">
            {saveStatus === 'saved' ? (
              <Check size={16} className="text-emerald-500 shrink-0" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            )}
            <span className="text-xs font-semibold text-text whitespace-nowrap">
              {saveStatus === 'saved' ? __( 'Settings saved successfully!', 'codeclove-school-management' ) : __( 'Unsaved settings changes', 'codeclove-school-management' )}
            </span>
          </div>
          <div className="flex items-center gap-2 pl-3 border-l border-border/60 shrink-0">
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
              onClick={handleSubmit(onSubmit)}
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
  isPending,
  onApply,
}: {
  open: boolean
  onClose: () => void
  loading: boolean
  diffItems: DiffItem[]
  isPending: boolean
  onApply: (mode: 'replace_defaults' | 'missing_only') => void
}) {
  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title={
        <span className="flex items-center gap-2">
          <Globe size={16} className="text-brand" />
          Apply Preset
        </span>
      }
      description="Compare and review the differences before switching default cycles and terminologies."
      size="lg"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2.5">
          <Spinner size="md" />
          <p className="text-xs text-text-muted">Fetching preset comparison differences…</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Diff table */}
          <div className="border border-border rounded-xl divide-y divide-border bg-bg-base/20 max-h-[35vh] overflow-y-auto">
            {diffItems.length > 0 ? (
              diffItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-4 p-3 text-xs items-center">
                  <span className="font-semibold text-text-muted">{item.label}</span>
                  <span className="text-danger bg-danger/5 px-2 py-1 rounded truncate line-through" title={item.current}>
                    {item.current}
                  </span>
                  <span className="text-success bg-success/5 px-2 py-1 rounded truncate font-medium" title={item.preset}>
                    {item.preset}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <Check size={20} className="text-success mb-1.5" />
                <p className="text-xs font-semibold text-text">No Configuration Differences</p>
                <p className="text-2xs text-text-muted mt-0.5">
                  The selected preset matches your current settings terminology exactly.
                </p>
              </div>
            )}
          </div>

          {/* Mode Explanation & Info banner */}
          <div className="bg-bg-elevated border border-border rounded-lg p-3.5 space-y-2 text-xs">
            <div className="flex gap-2 text-text font-semibold">
              <Info size={14} className="text-brand flex-shrink-0 mt-0.5" />
              <span>Choosing an Apply Mode:</span>
            </div>
            <ul className="list-disc list-inside pl-1 space-y-1 text-text-muted leading-relaxed text-xs">
              <li>
                <strong className="text-text font-medium">Merge Missing Only</strong>: Fills in new or unset terminology labels while preserving any manual overrides you have already saved.
              </li>
              <li>
                <strong className="text-text font-medium">Overwrite All Defaults</strong>: Resets all terminology singular and plural values back to the regional defaults.
              </li>
            </ul>
          </div>

          <ModalFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
              className="w-full sm:w-auto order-last sm:order-first"
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => onApply('missing_only')}
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              Merge Missing Only
            </Button>
            <Button
              onClick={() => onApply('replace_defaults')}
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              {isPending && <Spinner size="xs" />}
              Overwrite All Defaults
            </Button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  )
}
