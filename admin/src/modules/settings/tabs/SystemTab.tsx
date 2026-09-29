/** Tab: System — settings section for system info, cache management, diagnostics, and debug logging */
import { useState } from 'react'
import { Server, Sliders, RefreshCw, AlertTriangle, Copy, Check } from 'lucide-react'
import type { Control, UseFormRegister } from 'react-hook-form'
import type { CodeCloveSettings } from '@/api/settings'
import { clearSettingsCache, getSettingsDiagnostics, resetAndSeedDatabase, useApiHealth } from '@/api/settings'
import { Button, Badge, Card, Spinner } from '@/components/ui'
import { FormGroupHeader, FormCheckbox, FormInput } from '../components/SettingsFormPrimitives'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/lib/confirm'
import { __ } from '@/lib/i18n'

interface SystemTabProps {
  settings: CodeCloveSettings
  control: Control<CodeCloveSettings>
  register: UseFormRegister<CodeCloveSettings>
}

export function SystemTab({ settings, control, register }: SystemTabProps) {
  const confirm = useConfirm()
  const [clearing,  setClearing]  = useState(false)
  const [exporting, setExporting] = useState(false)
  const [seeding,   setSeeding]   = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [msg,       setMsg]       = useState('')
  const [devMsg,    setDevMsg]    = useState('')

  const { data: health, isLoading: loadingHealth, isError: healthError, error: healthErrObj } = useApiHealth()

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

  async function handleExportDiagnostics() {
    setExporting(true)
    setMsg('')
    try {
      const data = await getSettingsDiagnostics()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `codeclove-diagnostics-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMsg(__( 'Diagnostic export downloaded.', 'codeclove-school-management' ))
    } catch {
      setMsg(__( 'Failed to export diagnostics.', 'codeclove-school-management' ))
    } finally {
      setExporting(false)
    }
  }

  const handleCopySummary = async () => {
    const summary = `### CodeClove Technical Summary
- CodeClove Plugin: v${settings.plugin_version} (DB: v${settings.schema_version})
- Environment: PHP ${health?.php_version || 'N/A'} (Memory: ${health?.php_memory_limit || 'N/A'})
- REST API State: ${healthError ? 'Blocked/Error' : health ? 'Online' : 'Checking...'}
- Mail Driver: ${health?.mail_driver || 'WP_MAIL'} | Preset: ${health?.active_preset_name || 'India'} (${health?.active_preset || 'IN'})
- Max Upload Size: ${health?.max_upload_size || 'N/A'}`

    const success = await copyToClipboard(summary)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } else {
      setMsg(__( 'Failed to copy to clipboard.', 'codeclove-school-management' ))
    }
  }

  async function handleResetAndSeed() {
    const isConfirmed = await confirm({
      title: __( 'Reset and Seed Database', 'codeclove-school-management' ),
      message: __( 'WARNING: This will delete ALL school data, sessions, classes, students, staff, and financial records from the database and seed fresh dummy test data. This action is irreversible. Do you want to proceed?', 'codeclove-school-management' ),
      variant: 'danger',
      confirmText: __( 'Reset & Seed', 'codeclove-school-management' )
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
          description={__( 'Internal plugin metrics and real-time server telemetry.', 'codeclove-school-management' )}
          icon={Server}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
          <SystemInfoCell label={__( 'Database Version', 'codeclove-school-management' )} value={settings.schema_version} />
          <SystemInfoCell label={__( 'Plugin Version', 'codeclove-school-management' )}   value={settings.plugin_version} />
          
          {/* Dynamic REST API State */}
          <div className="border border-border p-3 rounded-xl bg-bg-base/20 space-y-1">
            <span className="text-2xs uppercase font-semibold text-text-muted">{__( 'REST API State', 'codeclove-school-management' )}</span>
            <div>
              {loadingHealth ? (
                <Badge variant="info" className="gap-1">
                  <Spinner size="xs" /> {__( 'Ping...', 'codeclove-school-management' )}
                </Badge>
              ) : healthError ? (
                <Badge variant="danger" dot title={healthErrObj?.message || __( 'API Blocked', 'codeclove-school-management' )}>
                  {__( 'Blocked / Error', 'codeclove-school-management' )}
                </Badge>
              ) : health?.db_connected === false ? (
                <Badge variant="warning" dot>
                  {__( 'DB Disconnected', 'codeclove-school-management' )}
                </Badge>
              ) : (
                <Badge variant="success" dot>
                  {__( 'Online', 'codeclove-school-management' )}
                </Badge>
              )}
            </div>
          </div>

          <SystemInfoCell label={__( 'PHP Environment', 'codeclove-school-management' )} value={health ? `PHP ${health.php_version} (${health.php_memory_limit})` : __( 'Loading...', 'codeclove-school-management' )} />
          <SystemInfoCell label={__( 'Mail Delivery Driver', 'codeclove-school-management' )} value={health ? health.mail_driver : __( 'Loading...', 'codeclove-school-management' )} />
          <SystemInfoCell label={__( 'Active Preset', 'codeclove-school-management' )} value={health ? `${health.active_preset_name} (${health.active_preset})` : __( 'Loading...', 'codeclove-school-management' )} />
        </div>
      </Card>

      {/* Maintenance */}
      <Card className="p-6 space-y-4">
        <FormGroupHeader
          title={__( 'Diagnostic Maintenance Tools', 'codeclove-school-management' )}
          description={__( 'Purge temporary database caches, download diagnostic snapshots, and control server logging.', 'codeclove-school-management' )}
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

          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleExportDiagnostics()}
            disabled={exporting}
            className="gap-1.5"
          >
            {exporting ? <Spinner size="xs" /> : <Server size={13} />}
            {exporting ? __( 'Preparing Export…', 'codeclove-school-management' ) : __( 'Export Diagnostics', 'codeclove-school-management' )}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handleCopySummary}
            className="gap-1.5"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            {copied ? __( 'Copied Summary!', 'codeclove-school-management' ) : __( 'Copy Support Summary', 'codeclove-school-management' )}
          </Button>

          {msg && (
            <span className="text-xs font-semibold text-brand">{msg}</span>
          )}
        </div>

        <div className="border-t border-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <FormCheckbox
            label={__( 'Enable Debug Logging', 'codeclove-school-management' )}
            name="system.debug_logging"
            description={__( 'Writes detailed API execution traces and database errors to server logs. Keep disabled during normal operation to conserve disk space.', 'codeclove-school-management' )}
            control={control}
          />
          <FormInput
            label={__( 'Audit Log Retention (Days)', 'codeclove-school-management' )}
            name="system.log_retention_days"
            type="number"
            placeholder="0"
            className="h-8 max-w-[120px]"
            register={register}
            description={__( 'Number of days to keep audit logs. Enter 0 to retain logs indefinitely. Pruning runs daily in the background.', 'codeclove-school-management' )}
          />
        </div>
      </Card>

      {/* Developer Utilities (Controlled via CODECLOVE_DEV_TOOLS constant) */}
      {Boolean(window.CodeCloveConfig?.devMode) && (
        <Card className="p-6 space-y-4 border-danger/20">
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
              className="gap-1.5 border-danger/30 hover:bg-danger/10 hover:text-danger hover:border-danger transition-colors"
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
    <div className="border border-border p-3 rounded-xl bg-bg-base/20 space-y-1">
      <span className="text-2xs uppercase font-semibold text-text-muted">{label}</span>
      <p className="text-sm font-bold text-text">{value}</p>
    </div>
  )
}

function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text))
  }
  return Promise.resolve(fallbackCopy(text))
}

function fallbackCopy(text: string): boolean {
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch {
    return false
  }
}
