/** Tab: System — settings section for system info, cache management, diagnostics, and debug logging */
import { useState } from 'react'
import { Server, Sliders, RefreshCw, AlertTriangle, LifeBuoy, FileText, Sparkles, Trash2 } from 'lucide-react'
import { useFeedbackModal } from '@/lib/feedback-context'
import type { Control, UseFormRegister } from 'react-hook-form'
import type { CodeCloveSettings } from '@/api/settings'
import { clearSettingsCache, resetAndSeedDatabase, useApiHealth, useTrashStats, usePurgeTrash } from '@/api/settings'
import { importDemoData, clearDemoData, useDemoDataStatus } from '@/api/demo-data'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/lib/toast'
import { Button, Card, Spinner } from '@/components/ui'
import { FormGroupHeader, FormCheckbox } from '../components/SettingsFormPrimitives'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/lib/confirm'
import { __, sprintf } from '@/lib/i18n'
interface SystemTabProps {
  settings: CodeCloveSettings
  control: Control<CodeCloveSettings>
  register: UseFormRegister<CodeCloveSettings>
}

export function SystemTab({ settings, control, register }: SystemTabProps) {
  const confirm = useConfirm()
  const { openFeedback } = useFeedbackModal()
   const isPro = window.CodeCloveConfig?.isPro ?? false
  const isPaid = window.CodeCloveConfig?.isPaid ?? false
  const isDemo = window.CodeCloveConfig?.isDemo ?? false
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: demoStatus } = useDemoDataStatus()
  const { data: trashStats } = useTrashStats()
  const purgeTrashMutation = usePurgeTrash()
  const [clearing, setClearing] = useState(false)
  const [seeding,  setSeeding]  = useState(false)
  const [msg,      setMsg]      = useState('')
  const [devMsg,   setDevMsg]   = useState('')
  const [importingDemo, setImportingDemo] = useState(false)
  const [clearingDemo,  setClearingDemo]  = useState(false)
  const [demoMsg,       setDemoMsg]       = useState<{ text: string; isError: boolean } | null>(null)
  async function handleImportDemoData() {
    setImportingDemo(true)
    setDemoMsg(null)
    try {
      const res = await importDemoData()
      const text = res.message || __( 'Demo data imported successfully.', 'codeclove-school-management' )
      setDemoMsg({ text, isError: !res.success })
      if (res.success) {
        toast.success(text)
        await queryClient.invalidateQueries({ queryKey: ['codeclove'] })
      } else {
        toast.error(text)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : __( 'Failed to import demo data.', 'codeclove-school-management' )
      toast.error(msg)
      setDemoMsg({ text: msg, isError: true })
    } finally {
      setImportingDemo(false)
    }
  }

  async function handleClearDemoData() {
    const isConfirmed = await confirm({
      title: __( 'Clear demo data?', 'codeclove-school-management' ),
      message: __( 'This will remove all generated demonstration records, students, and invoices while keeping your school configuration intact.', 'codeclove-school-management' ),
      variant: 'danger',
      confirmText: __( 'Clear Demo Data', 'codeclove-school-management' ),
    })
    if (!isConfirmed) return

    setClearingDemo(true)
    setDemoMsg(null)
    try {
      const res = await clearDemoData()
      const text = res.message || __( 'Demo data cleared successfully.', 'codeclove-school-management' )
      setDemoMsg({ text, isError: !res.success })
      if (res.success) {
        toast.success(text)
        await queryClient.invalidateQueries({ queryKey: ['codeclove'] })
      } else {
        toast.error(text)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : __( 'Failed to clear demo data.', 'codeclove-school-management' )
      toast.error(msg)
      setDemoMsg({ text: msg, isError: true })
    } finally {
      setClearingDemo(false)
    }
  }
  const { data: health } = useApiHealth()
  async function handleClearCache() {
    setClearing(true)
    setMsg('')
    try {
      const result = await clearSettingsCache()
      setMsg(result)
    } catch {
      setMsg(__( 'Network error clearing cache.', 'codeclove-school-management' ))
    } finally {
      setClearing(false)
    }
  }

  async function handlePurgeTrash() {
    const count = trashStats?.total || 0
    const isConfirmed = await confirm({
      title: __( 'Purge trashed records?', 'codeclove-school-management' ),
      message: sprintf(
        __( 'Are you sure you want to permanently erase %d trashed records from MySQL? This action is irreversible.', 'codeclove-school-management' ),
        count
      ),
      variant: 'danger',
      confirmText: __( 'Purge Records', 'codeclove-school-management' ),
    })
    if (!isConfirmed) return

    purgeTrashMutation.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(res.message || __( 'Successfully purged trashed records from database.', 'codeclove-school-management' ))
      },
      onError: (err) => {
        toast.error(err.message || __( 'Failed to purge database records.', 'codeclove-school-management' ))
      }
    })
  }

  async function handleResetAndSeed() {
    const isConfirmed = await confirm({
      title: __( 'Reset and seed database?', 'codeclove-school-management' ),
      message: __( 'This will delete all live school records and populate the database with fresh demonstration data. This action cannot be undone.', 'codeclove-school-management' ),
      variant: 'danger',
      confirmText: __( 'Reset & Seed', 'codeclove-school-management' ),
    })
    if (!isConfirmed) return

    setSeeding(true)
    setDevMsg('')
    try {
      const result = await resetAndSeedDatabase()
      setDevMsg(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : __( 'Failed to reset and seed database.', 'codeclove-school-management' )
      setDevMsg(msg)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* System Information */}
      <Card className="p-6 space-y-4">
        <FormGroupHeader
          title={__( 'Technical System Indicators', 'codeclove-school-management' )}
          description={__( 'Core server environment and CodeClove platform versions.', 'codeclove-school-management' )}
          icon={Server}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          <SystemInfoCell label={__( 'Database Schema', 'codeclove-school-management' )} value={`v${settings.schema_version}`} />
          <SystemInfoCell label={__( 'Plugin Version', 'codeclove-school-management' )}   value={`v${settings.plugin_version}`} />
          <SystemInfoCell label={__( 'PHP Runtime', 'codeclove-school-management' )}     value={health ? `PHP ${health.php_version} (${health.php_memory_limit})` : __( 'Loading...', 'codeclove-school-management' )} />
          <SystemInfoCell label={__( 'Max Upload Limit', 'codeclove-school-management' )} value={health ? health.max_upload_size : __( 'Loading...', 'codeclove-school-management' )} />
        </div>
      </Card>

      {/* Maintenance */}
      <Card className="p-6 space-y-4">
        <FormGroupHeader
          title={__( 'Maintenance & Cache Tools', 'codeclove-school-management' )}
          description={__( 'Purge temporary database caches or launch the system diagnostics and triage reporter.', 'codeclove-school-management' )}
          icon={Sliders}
        />
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleClearCache()}
            disabled={clearing}
            className="gap-1.5"
          >
            {clearing ? <Spinner size="xs" /> : <RefreshCw size={13} />}
            {clearing ? __( 'Clearing…', 'codeclove-school-management' ) : __( 'Purge Options Transients', 'codeclove-school-management' )}
          </Button>

          {!isDemo && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => openFeedback({ area: 'Settings' })}
              className="gap-1.5"
            >
              <LifeBuoy size={13} />
              {isPaid ? __( 'System Diagnostics & Feedback', 'codeclove-school-management' ) : __( 'Get Help & Support', 'codeclove-school-management' )}
            </Button>
          )}
          {msg && (
            <span className="text-xs font-semibold text-brand">{msg}</span>
          )}
        </div>
      </Card>

      {/* Database Cleanup & Trash Purge */}
      <Card className="p-6 space-y-4">
        <FormGroupHeader
          title={__( 'Database Cleanup & Trash Purge', 'codeclove-school-management' )}
          description={__( 'Permanently delete soft-deleted students, staff, and old invoices to free database storage and keep records clean.', 'codeclove-school-management' )}
          icon={Trash2}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-bg-surface-hover/50 rounded-lg border border-border">
          <div className="space-y-1">
            <div className="text-sm font-medium text-text">
              {trashStats?.total && trashStats.total > 0
                ? sprintf( __( '%d trashed records pending permanent cleanup', 'codeclove-school-management' ), trashStats.total )
                : __( 'No trashed records in database', 'codeclove-school-management' )
              }
            </div>
            <div className="text-xs text-text-muted flex items-center gap-3">
              <span>{sprintf( __( 'Students: %d', 'codeclove-school-management' ), trashStats?.students || 0 )}</span>
              <span>•</span>
              <span>{sprintf( __( 'Staff: %d', 'codeclove-school-management' ), trashStats?.staff || 0 )}</span>
              <span>•</span>
              <span>{sprintf( __( 'Invoices: %d', 'codeclove-school-management' ), trashStats?.invoices || 0 )}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => void handlePurgeTrash()}
            disabled={!trashStats?.total || trashStats.total === 0 || purgeTrashMutation.isPending}
            className="gap-1.5 flex-shrink-0"
          >
            {purgeTrashMutation.isPending ? <Spinner size="xs" /> : <Trash2 size={13} />}
            {purgeTrashMutation.isPending ? __( 'Purging…', 'codeclove-school-management' ) : __( 'Purge Trashed Records', 'codeclove-school-management' )}
          </Button>
        </div>
      </Card>

      {/* Demo Data Management */}
      <Card className="p-6 space-y-4">
        <FormGroupHeader
          title={__( 'Demo Data Management', 'codeclove-school-management' )}
          description={__( 'Populate your school with sample classes, students, staff, and invoices for testing, or clear all demo records.', 'codeclove-school-management' )}
          icon={Sparkles}
        />
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            variant="default"
            onClick={() => void handleImportDemoData()}
            disabled={importingDemo || clearingDemo}
            className="gap-1.5"
          >
            {importingDemo ? <Spinner size="xs" /> : <Sparkles size={13} />}
            {importingDemo ? __( 'Importing…', 'codeclove-school-management' ) : __( 'Import Demo Data', 'codeclove-school-management' )}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleClearDemoData()}
            disabled={importingDemo || clearingDemo}
            className="gap-1.5"
          >
            {clearingDemo ? <Spinner size="xs" /> : <Trash2 size={13} />}
            {clearingDemo ? __( 'Clearing…', 'codeclove-school-management' ) : __( 'Clear Demo Data', 'codeclove-school-management' )}
          </Button>

          {demoStatus?.imported && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success-dim text-success border border-success/20">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              {__( 'Demo data active', 'codeclove-school-management' )}
            </span>
          )}

          {demoMsg && (
            <span className={cn(
              "text-xs font-semibold",
              demoMsg.isError ? "text-danger" : "text-brand"
            )}>
              {demoMsg.text}
            </span>
          )}
        </div>
      </Card>
      {/* Logging & Retention Policy (Pro only) */}
      {isPro && (
        <Card className="p-6 space-y-4">
          <FormGroupHeader
            title={__( 'Logging & Data Retention', 'codeclove-school-management' )}
            description={__( 'Server execution tracing and automated activity log retention.', 'codeclove-school-management' )}
            icon={FileText}
          />

          <div className="divide-y divide-border">
            {/* Debug Logging Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 first:pt-1">
              <div className="space-y-0.5 pr-4">
                <label htmlFor="system.debug_logging" className="text-sm font-medium text-text cursor-pointer">
                  {__( 'Debug Execution Logging', 'codeclove-school-management' )}
                </label>
                <p className="text-xs text-text-muted leading-relaxed">
                  {__( 'Write detailed API execution traces and database errors to server logs. Keep disabled in production.', 'codeclove-school-management' )}
                </p>
              </div>
              <div className="shrink-0">
                <FormCheckbox
                  label=""
                  name="system.debug_logging"
                  control={control}
                />
              </div>
            </div>

            {/* Activity Log Retention Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 last:pb-1">
              <div className="space-y-0.5 pr-4">
                <label htmlFor="settings-input-system.log_retention_days" className="text-sm font-medium text-text">
                  {__( 'Activity Log Retention', 'codeclove-school-management' )}
                </label>
                <p className="text-xs text-text-muted leading-relaxed">
                  {__( 'Automatically prune activity logs older than specified days. Enter 0 to keep logs indefinitely.', 'codeclove-school-management' )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  id="settings-input-system.log_retention_days"
                  type="number"
                  min="0"
                  placeholder="0"
                  {...register('system.log_retention_days')}
                  className="w-20 h-8 px-2.5 rounded border border-border bg-bg-surface text-sm text-text text-center hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-brand-ring focus:border-brand transition-colors duration-100"
                />
                <span className="text-xs text-text-muted font-medium select-none">{__( 'days', 'codeclove-school-management' )}</span>
              </div>
            </div>
          </div>
        </Card>
      )}
      {/* Developer Utilities (Controlled via CODECLOVE_DEV_TOOLS constant) */}
      {Boolean(window.CodeCloveConfig?.devMode) && (
        <Card className="p-6 space-y-4 border-danger-dim">
          <FormGroupHeader
            title={__( 'Developer & Testing Utilities', 'codeclove-school-management' )}
            description={__( 'Wipes all student, academic, staff, and financial records and populates the database with fresh test data.', 'codeclove-school-management' )}
            icon={AlertTriangle}
          />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleResetAndSeed()}
              disabled={seeding}
              className="gap-1.5 border-danger-dim hover:bg-danger-dim hover:text-danger hover:border-danger transition-colors"
            >
              {seeding ? <Spinner size="xs" /> : <RefreshCw size={13} />}
              {seeding ? __( 'Resetting Database…', 'codeclove-school-management' ) : __( 'Reset & Seed Test Data', 'codeclove-school-management' )}
            </Button>

            {devMsg && (
              <span className={cn("text-xs font-semibold", devMsg.includes('Failed') ? "text-danger" : "text-success")}>
                {devMsg}
              </span>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

function SystemInfoCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border p-3 rounded-xl bg-bg-surface space-y-1">
      <span className="text-2xs uppercase font-semibold text-text-muted">{label}</span>
      <p className="text-sm font-bold text-text">{value}</p>
    </div>
  )
}

