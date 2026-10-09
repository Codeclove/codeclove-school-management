import { useState, useEffect } from 'react'
import {
  Modal,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  Badge,
  Spinner,
  EmptyState,
  FormField,
} from '@/components/ui'
import { useFeedbackModal } from '@/lib/feedback-context'
import { api } from '@/lib/api-client'
import { useToast } from '@/lib/toast'
import { __ } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Bug,
  Lightbulb,
  ExternalLink,
  Copy,
  Check,
  LifeBuoy,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Sparkles,
  Send,
  Mail,
  FileText,
  RefreshCw,
  Plus,
  Minus,
  History,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  MessageSquare,
  BookOpen,
  ArrowRight,
  Server,
} from 'lucide-react'

// ─── Clipboard Helper ─────────────────────────────────────────────────────────

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// ─── Options & Types ──────────────────────────────────────────────────────────

export const AREA_OPTIONS = [
  { value: 'General', label: 'General / Platform' },
  { value: 'Academics', label: 'Academics & Classes' },
  { value: 'Admissions', label: 'Admissions' },
  { value: 'Attendance', label: 'Attendance' },
  { value: 'Finance', label: 'Finance & Invoices' },
  { value: 'Staff', label: 'Staff & HR' },
  { value: 'Students', label: 'Students' },
  { value: 'Timetable', label: 'Timetable' },
  { value: 'Settings', label: 'Settings & Localization' },
]

export const VECTOR_OPTIONS = [
  { value: 'ux', label: 'UX Friction (Confusing, slow, or too many clicks)' },
  { value: 'capability', label: 'Capability Gap (Missing feature for your school)' },
  { value: 'compliance', label: 'Regional Compliance (Board or legal requirement)' },
  { value: 'integration', label: 'Integration (Payment, SMS, LMS, or API)' },
  { value: 'general', label: 'General Refinement' },
]

export type Priority = 'p0' | 'p1' | 'p2' | 'p3'

export const PRIORITY_OPTIONS = [
  { value: 'p2', label: 'Normal — Feature issue (workaround exists)' },
  { value: 'p1', label: 'High — Core workflow broken' },
  { value: 'p0', label: 'Blocker — System crash or data loss' },
  { value: 'p3', label: 'Minor — Cosmetic glitch or typo' },
]

const PRIORITY_LABELS: Record<string, string> = {
  p0: 'Blocker',
  p1: 'High',
  p2: 'Normal',
  p3: 'Minor',
}

interface TicketItem {
  ticket_id: number
  title: string
  type: 'bug' | 'feedback'
  priority: string
  area: string
  submitted_at: number
  state: 'open' | 'closed'
  state_reason?: string | null
}

interface DiagnosticsData {
  report: {
    codeclove?: { version?: string; preset?: string; edition?: string }
    license?: {
      status?: string
      label?: string
      type?: string
      is_valid?: boolean
      expires?: string
      masked_key?: string
    }
    environment?: { php_version?: string; wp_version?: string; server_software?: string }
  }
  markdown: string
}

function formatRelativeTime(timestampSeconds: number): string {
  const diffSec = Math.floor(Date.now() / 1000 - timestampSeconds)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (diffSec < 60) return rtf.format(-Math.max(1, diffSec), 'second')
  if (diffSec < 3600) return rtf.format(-Math.floor(diffSec / 60), 'minute')
  if (diffSec < 86400) return rtf.format(-Math.floor(diffSec / 3600), 'hour')
  if (diffSec < 604800) return rtf.format(-Math.floor(diffSec / 86400), 'day')
  return new Date(timestampSeconds * 1000).toLocaleDateString()
}

// ─── Main Modal Component ─────────────────────────────────────────────────────

export function FeedbackModal() {
  const { isOpen, options, closeFeedback } = useFeedbackModal()
  const isPro = window.CodeCloveConfig?.isPro ?? false
  const proUrl = window.CodeCloveConfig?.proUrl || 'https://codeclove.com/?utm_source=wp_plugin&utm_medium=feedback_modal&utm_campaign=upgrade'
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<'bug' | 'feedback'>(options.type || 'bug')
  const [priority, setPriority] = useState<Priority>(options.priority || 'p2')
  const [area, setArea] = useState<string>(options.area || 'General')
  const [vector, setVector] = useState<string>('capability')
  const [title, setTitle] = useState<string>(options.initialTitle || '')
  const [description, setDescription] = useState<string>(options.initialDescription || '')
  const [expected, setExpected] = useState<string>('')
  const [showExpected, setShowExpected] = useState<boolean>(false)
  const [includeDiagnostics, setIncludeDiagnostics] = useState<boolean>(true)
  const [showPreview, setShowPreview] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isCopying, setIsCopying] = useState<boolean>(false)
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false)
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [view, setView] = useState<'form' | 'tickets'>('form')
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [isLoadingTickets, setIsLoadingTickets] = useState<boolean>(false)
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null)
  const [diagnosticsData, setDiagnosticsData] = useState<DiagnosticsData | null>(null)

  const licenseInfo = diagnosticsData?.report?.license || window.CodeCloveConfig?.license || {
    status: isPro ? 'active' : 'free',
    label: isPro ? __( 'Active License', 'codeclove-school-management' ) : __( 'Free Edition', 'codeclove-school-management' ),
    type: isPro ? __( 'Pro', 'codeclove-school-management' ) : __( 'Free', 'codeclove-school-management' ),
    is_valid: isPro,
  }

  function loadTickets() {
    setIsLoadingTickets(true)
    api.get<{ tickets: TicketItem[] }>('system/tickets')
      .then((res) => {
        if (res?.data?.tickets) {
          setTickets(res.data.tickets)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingTickets(false))
  }

  // Sync state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(options.type || 'bug')
      setPriority(options.priority || 'p2')
      setArea(options.area || 'General')
      setTitle(options.initialTitle || '')
      setDescription(options.initialDescription || '')
      setExpected('')
      setShowExpected(false)
      setIncludeDiagnostics(true)
      setShowPreview(false)
      setCopiedSuccess(false)
      setView('form')
      setExpandedTicketId(null)
      setSubmitError(null)
      if (isPro) {
        loadTickets()
      }

      // Pre-fetch diagnostics
      void api
        .get<DiagnosticsData>('system/diagnostics')
        .then((res) => {
          if (res?.data) {
            setDiagnosticsData(res.data)
          }
        })
        .catch(() => {})
    }
  }, [isOpen, options, isPro])

  // Check and countdown submission cooldown (30 seconds)
  useEffect(() => {
    if (!isOpen) return

    const updateCooldown = () => {
      try {
        const lastSub = Number(localStorage.getItem('codeclove_feedback_last_submitted') || 0)
        const elapsed = Math.floor((Date.now() - lastSub) / 1000)
        const remaining = Math.max(0, 30 - elapsed)
        setCooldownRemaining(remaining)
      } catch {
        // Ignore localStorage restrictions
      }
    }

    updateCooldown()
    const interval = setInterval(updateCooldown, 1000)
    return () => clearInterval(interval)
  }, [isOpen])

  function getClientInfo() {
    const m = typeof navigator !== 'undefined' ? navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/(\d+)/) : null
    const browser = m ? `${'Edg' === m[1] ? 'Edge' : m[1]} ${m[2]}` : 'Unknown'

    return {
      route: window.location.hash || window.location.pathname,
      browser,
      error_stack: options.errorStack,
    }
  }

  async function ensureDiagnostics(): Promise<string> {
    if (diagnosticsData?.markdown) {
      return diagnosticsData.markdown
    }
    const res = await api.get<DiagnosticsData>('system/diagnostics')
    if (res?.data) {
      setDiagnosticsData(res.data)
      return res.data.markdown || ''
    }
    return ''
  }

  async function handleSubmitReport() {
    if (!title.trim()) {
      toast.error(__('Please enter a title.', 'codeclove-school-management'))
      return
    }
    if (!description.trim()) {
      toast.error(__('Please enter a description.', 'codeclove-school-management'))
      return
    }
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const fullDesc =
        activeTab === 'feedback'
          ? `**Refinement Category:** ${VECTOR_OPTIONS.find((v) => v.value === vector)?.label || vector}\n\n${description}`
          : description

      const res = await api.post<{ ticket_id?: number; message?: string }>('system/feedback', {
        title: title.trim(),
        description: fullDesc.trim(),
        type: activeTab,
        priority: activeTab === 'bug' ? priority : 'p2',
        area,
        expected: activeTab === 'bug' && expected.trim() ? expected.trim() : undefined,
        include_diagnostics: includeDiagnostics,
        client_info: getClientInfo(),
      })

      const ticketId = res.data?.ticket_id
      if (ticketId) {
        toast.success(
          __('Report submitted successfully! Ticket #%d created.', 'codeclove-school-management').replace('%d', String(ticketId))
        )
      } else {
        toast.success(res.data?.message || __('Report submitted successfully!', 'codeclove-school-management'))
      }
      try {
        localStorage.setItem('codeclove_feedback_last_submitted', String(Date.now()))
      } catch {
        // Ignore localStorage restrictions
      }
      setCooldownRemaining(30)
      closeFeedback()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const displayMsg = msg || __('Failed to submit report.', 'codeclove-school-management')
      setSubmitError(displayMsg)
      toast.error(displayMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCopyFullReport() {
    setIsCopying(true)
    try {
      const md = includeDiagnostics ? await ensureDiagnostics() : ''
      const fullDesc =
        activeTab === 'feedback'
          ? `**Refinement Category:** ${VECTOR_OPTIONS.find((v) => v.value === vector)?.label || vector}\n\n${description}`
          : description

      const lines: string[] = [
        '### Description',
        fullDesc || __('No description provided.', 'codeclove-school-management'),
        '',
      ]

      if (activeTab === 'bug' && expected.trim()) {
        lines.push('### Expected Behavior', expected.trim(), '')
      }

      const clientInfo = getClientInfo()
      if (clientInfo.route || clientInfo.error_stack) {
        lines.push('### Client Context')
        if (clientInfo.route) lines.push(`- **Route:** \`${clientInfo.route}\``)
        if (clientInfo.browser && clientInfo.browser !== 'Unknown') lines.push(`- **Browser:** ${clientInfo.browser}`)
        if (clientInfo.error_stack) {
          lines.push('', '```', clientInfo.error_stack, '```')
        }
        lines.push('')
      }
      if (includeDiagnostics && md) {
        lines.push(md)
      }

      await copyToClipboard(lines.join('\n'))
      setCopiedSuccess(true)
      setTimeout(() => setCopiedSuccess(false), 2000)
      toast.success(__('Report copied to clipboard.', 'codeclove-school-management'))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg || __('Failed to generate report.', 'codeclove-school-management'))
    } finally {
      setIsCopying(false)
    }
  }

  async function handleCopyDiagnosticsFree() {
    setIsCopying(true)
    try {
      const md = await ensureDiagnostics()
      await copyToClipboard(md)
      setCopiedSuccess(true)
      setTimeout(() => setCopiedSuccess(false), 2000)
      toast.success(__('System diagnostics copied to clipboard.', 'codeclove-school-management'))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg || __('Failed to copy diagnostics.', 'codeclove-school-management'))
    } finally {
      setIsCopying(false)
    }
  }

  const tabsConfig = [
    {
      id: 'bug' as const,
      label: __('Report a Bug', 'codeclove-school-management'),
      shortLabel: __('Bug', 'codeclove-school-management'),
      icon: Bug,
      activeColor: 'text-rose-500',
    },
    {
      id: 'feedback' as const,
      label: __('Feature / Idea', 'codeclove-school-management'),
      shortLabel: __('Idea', 'codeclove-school-management'),
      icon: Lightbulb,
      activeColor: 'text-amber-500',
    },
    {
      id: 'tickets' as const,
      label: __('Submitted Tickets', 'codeclove-school-management'),
      shortLabel: __('Tickets', 'codeclove-school-management'),
      icon: History,
      activeColor: 'text-primary',
      badge: tickets.length,
    },
  ]

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeFeedback()
        }
      }}
      title={
        isPro ? (
          <div className="flex items-center gap-2.5 flex-wrap">
            <span>{__( 'Feedback & Bug Report', 'codeclove-school-management' )}</span>
            {licenseInfo.status === 'active' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20 tracking-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                {licenseInfo.type ? `${licenseInfo.type} • Active` : __( 'Active License', 'codeclove-school-management' )}
              </span>
            ) : licenseInfo.status === 'expired' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-danger/10 text-danger border border-danger/20 tracking-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                {__( 'License Expired', 'codeclove-school-management' )}
              </span>
            ) : licenseInfo.status === 'invalid' || licenseInfo.status === 'disabled' ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-danger/10 text-danger border border-danger/20 tracking-tight">
                {__( 'Invalid License', 'codeclove-school-management' )}
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20 tracking-tight">
                {__( 'License Inactive', 'codeclove-school-management' )}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <LifeBuoy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text">
                {__( 'Help & Support', 'codeclove-school-management' )}
              </h3>
            </div>
          </div>
        )
      }
      description={
        isPro
          ? __( 'Direct triage with CodeClove core engineering. Submissions create tracked issues.', 'codeclove-school-management' )
          : __( 'Get assistance through community forums and documentation, or upgrade for direct engineering support.', 'codeclove-school-management' )
      }
      size="lg"
    >
      {!isPro ? (
        /* ─── Free User View ────────────────────────────────────────── */
        <div className="space-y-4 py-1">
          {/* Support Resources Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: Official Forum */}
            <div className="p-4 rounded-xl border border-border bg-bg-surface hover:border-brand/40 transition-colors flex flex-col justify-between space-y-3 group shadow-2xs">
              <div className="space-y-1.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
                  {__( 'WordPress.org Forum', 'codeclove-school-management' )}
                </h4>
                <p className="text-xs text-text-muted leading-relaxed">
                  {__( 'Free community troubleshooting and answers from active plugin users and staff.', 'codeclove-school-management' )}
                </p>
              </div>
              <a
                href="https://wordpress.org/support/plugin/codeclove-school-management/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline pt-1"
              >
                <span>{__( 'Open Support Forum', 'codeclove-school-management' )}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Card 2: Documentation */}
            <div className="p-4 rounded-xl border border-border bg-bg-surface hover:border-emerald-500/40 transition-colors flex flex-col justify-between space-y-3 group shadow-2xs">
              <div className="space-y-1.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-semibold text-text group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {__( 'Documentation & Setup', 'codeclove-school-management' )}
                </h4>
                <p className="text-xs text-text-muted leading-relaxed">
                  {__( 'Step-by-step guides for student admissions, grading scales, attendance, and shortcodes.', 'codeclove-school-management' )}
                </p>
              </div>
              <a
                href="https://docs.codeclove.com/school-management-pro/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline pt-1"
              >
                <span>{__( 'Browse Documentation', 'codeclove-school-management' )}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* System Diagnostics Helper Row */}
          <div className="p-3.5 rounded-xl border border-border bg-bg-subtle/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-bg-surface border border-border text-text-muted shrink-0">
                <Server className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text">
                  {__( 'Posting in the forum? Attach system specs', 'codeclove-school-management' )}
                </p>
                <p className="text-[11px] text-text-muted truncate">
                  {__( 'Copies sanitized environment details (WP, PHP, active plugins) to paste into your ticket.', 'codeclove-school-management' )}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyDiagnosticsFree}
              disabled={isCopying}
              className="text-xs gap-1.5 shrink-0 w-full sm:w-auto justify-center shadow-2xs"
            >
              {copiedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-success" />
                  <span>{__( 'Copied Diagnostics!', 'codeclove-school-management' )}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{__( 'Copy System Info', 'codeclove-school-management' )}</span>
                </>
              )}
            </Button>
          </div>

          {/* Upgraded Pro Card */}
          <div className="relative overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/10 via-brand/5 to-transparent p-4 sm:p-5 space-y-3.5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-text">
                      {__( 'Upgrade to CodeClove Pro', 'codeclove-school-management' )}
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/15 text-brand border border-brand/25">
                      PRO
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    {__( 'Get priority engineering helpdesk, in-dashboard issue filing, automated data migration, and commercial modules.', 'codeclove-school-management' )}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-brand/15">
              <div className="flex items-center gap-2 text-xs text-text">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                <span>{__( 'Direct Ticket Tracking', 'codeclove-school-management' )}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                <span>{__( 'Stripe & PayPal Gateways', 'codeclove-school-management' )}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                <span>{__( 'Timetables & SMS Alerts', 'codeclove-school-management' )}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button
                type="button"
                onClick={() => {
                  closeFeedback()
                  window.location.hash = '#/pro-upgrade'
                }}
                className="bg-brand hover:bg-brand-strong text-white font-semibold text-xs px-4 py-2 gap-2 shadow-xs w-full sm:w-auto justify-center"
              >
                <span>{__( 'View Pro Features & Pricing', 'codeclove-school-management' )}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>

              <a
                href={proUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-brand font-medium transition-colors"
              >
                <span>{__( 'Learn more on codeclove.com', 'codeclove-school-management' )}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={closeFeedback}>
              {__( 'Close', 'codeclove-school-management' )}
            </Button>
          </ModalFooter>
        </div>
      ) : (
        /* ─── Pro User View (Professional Segmented Navigation) ─────── */
        <div className="space-y-3.5">
          {/* Prominent High-Contrast 3-Tab Segmented Control */}
          <div
            className="grid grid-cols-3 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs font-medium gap-1"
            role="tablist"
          >
            {tabsConfig.map((tab) => {
              const isActive = tab.id === 'tickets' ? view === 'tickets' : view === 'form' && activeTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    if (tab.id === 'tickets') {
                      setView('tickets')
                      loadTickets()
                    } else {
                      setView('form')
                      setActiveTab(tab.id)
                    }
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2 sm:px-3 rounded-lg transition-all cursor-pointer select-none text-xs font-medium min-w-0',
                    isActive
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/40 dark:hover:bg-slate-800/60'
                  )}
                >
                  <Icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? tab.activeColor : 'text-slate-400 dark:text-slate-500')} />
                  <span className="hidden sm:inline truncate">{tab.label}</span>
                  <span className="sm:hidden truncate">{tab.shortLabel}</span>
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      )}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {view === 'tickets' ? (
            /* ─── Submitted Tickets View ───────────────────────────────── */
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs text-text-muted px-0.5">
                <span>{__('Track resolution status of your direct submissions', 'codeclove-school-management')}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadTickets}
                  disabled={isLoadingTickets}
                  className="text-xs h-7.5 gap-1.5 text-text-muted hover:text-text px-2"
                >
                  <RefreshCw className={cn('w-3 h-3', isLoadingTickets && 'animate-spin')} />
                  <span>{__( 'Refresh', 'codeclove-school-management' )}</span>
                </Button>
              </div>

              {isLoadingTickets && tickets.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-text-muted">
                  <Spinner size="md" />
                  <p className="text-xs">{__( 'Checking ticket resolution status...', 'codeclove-school-management' )}</p>
                </div>
              ) : tickets.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={__( 'No tickets submitted yet', 'codeclove-school-management' )}
                  description={__( 'When you report bugs or share feedback, they will be listed here with real-time triage updates.', 'codeclove-school-management' )}
                  variant="dashed"
                  className="py-10"
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setView('form')} className="text-xs h-8">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      <span>{__( 'Submit Your First Report', 'codeclove-school-management' )}</span>
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {tickets.map((t) => {
                    const isExpanded = expandedTicketId === t.ticket_id
                    const isResolved = t.state === 'closed'

                    return (
                      <div
                        key={t.ticket_id}
                        className={cn(
                          'p-3.5 rounded-xl border transition-all text-xs space-y-2.5',
                          isExpanded
                            ? 'border-border bg-bg-surface shadow-xs ring-1 ring-border/50'
                            : 'border-border/80 bg-bg-surface hover:border-border hover:bg-bg-subtle/30'
                        )}
                      >
                        {/* Header Row */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={t.type === 'bug' ? 'danger' : 'warning'} size="sm" className="gap-1">
                              {t.type === 'bug' ? <Bug className="w-3 h-3" /> : <Lightbulb className="w-3 h-3" />}
                              <span>{t.type === 'bug' ? __( 'Bug', 'codeclove-school-management' ) : __( 'Feedback', 'codeclove-school-management' )}</span>
                            </Badge>

                            <span className="font-mono font-bold text-text">#{t.ticket_id}</span>
                            <span className="text-text-subtle">·</span>
                            <span className="text-text-secondary font-medium">{t.area}</span>
                            <span className="text-text-subtle">·</span>
                            <span className="text-text-muted text-[11px]">{formatRelativeTime(t.submitted_at)}</span>
                          </div>

                          <Badge variant={isResolved ? 'success' : 'info'} size="sm" className="gap-1.5">
                            {isResolved ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                            )}
                            <span>{isResolved ? __( 'Resolved', 'codeclove-school-management' ) : __( 'Open / In Triage', 'codeclove-school-management' )}</span>
                          </Badge>
                        </div>

                        {/* Title */}
                        <p className="font-semibold text-text text-sm leading-snug">{t.title}</p>

                        {/* Expandable Details */}
                        {isExpanded && (
                          <div className="pt-2 border-t border-border/70 text-xs text-text-secondary space-y-2 bg-bg-subtle/50 p-2.5 rounded-lg">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                              <div>
                                <span className="text-text-muted">{__( 'Severity:', 'codeclove-school-management' )}</span>{' '}
                                <span className="font-medium text-text">{PRIORITY_LABELS[t.priority] || t.priority}</span>
                              </div>
                              <div>
                                <span className="text-text-muted">{__( 'State:', 'codeclove-school-management' )}</span>{' '}
                                <span className="font-medium capitalize text-text">{t.state}</span>
                              </div>
                              <div>
                                <span className="text-text-muted">{__( 'Submitted:', 'codeclove-school-management' )}</span>{' '}
                                <span className="font-medium text-text">
                                  {new Date(t.submitted_at * 1000).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            {t.state_reason && (
                              <div className="text-[11px] text-text-subtle pt-1 border-t border-border/50">
                                <span className="font-medium text-text">{__( 'Resolution Note:', 'codeclove-school-management' )}</span>{' '}
                                {t.state_reason}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Card Actions Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setExpandedTicketId(isExpanded ? null : t.ticket_id)}
                            className="text-text-muted hover:text-text cursor-pointer inline-flex items-center gap-1 transition-colors select-none"
                          >
                            <span>{isExpanded ? __( 'Hide details', 'codeclove-school-management' ) : __( 'View details', 'codeclove-school-management' )}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                void copyToClipboard(`#${t.ticket_id}`)
                                toast.success(__('Ticket ID copied.', 'codeclove-school-management'))
                              }}
                              className="text-text-muted hover:text-text cursor-pointer inline-flex items-center gap-1 transition-colors select-none"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{__( 'Copy ID', 'codeclove-school-management' )}</span>
                            </button>

                            <a
                              href={`mailto:support@codeclove.com?subject=${encodeURIComponent(`[CodeClove Ticket #${t.ticket_id}] ${t.title}`)}&body=${encodeURIComponent(`Hi Codeclove Support,\n\nI am contacting you regarding Ticket #${t.ticket_id}: "${t.title}".\n\nSite: ${window.location.origin}\nCodeClove Version: ${window.CodeCloveConfig?.version || '1.0.0'}\n\n[Your question or follow-up details here]\n`)}`}
                              className="text-primary hover:underline cursor-pointer inline-flex items-center gap-1 font-medium"
                            >
                              <Mail className="w-3 h-3" />
                              <span>{__( 'Contact Support', 'codeclove-school-management' )}</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <ModalFooter className="pt-3 mt-3 flex-row justify-end">
                <Button variant="secondary" size="sm" onClick={() => setView('form')} className="text-xs h-8.5">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>{__( 'New Report', 'codeclove-school-management' )}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={closeFeedback} className="text-xs h-8.5">
                  {__( 'Close', 'codeclove-school-management' )}
                </Button>
              </ModalFooter>
            </div>
          ) : (
            /* ─── Spacious, Unified Responsive Form View ───────────────── */
            <div
              className="space-y-3.5 pt-1"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isSubmitting && cooldownRemaining === 0) {
                  e.preventDefault()
                  void handleSubmitReport()
                }
              }}
            >
              {/* Professional Submission Alert Banner */}
              {submitError && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200/90 dark:border-amber-800/50 text-xs animate-in fade-in slide-in-from-top-1 duration-150 shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                        {submitError.toLowerCase().includes('duplicate') || submitError.toLowerCase().includes('recently')
                          ? __( 'Duplicate Report Detected', 'codeclove-school-management' )
                          : submitError.toLowerCase().includes('too many') || submitError.toLowerCase().includes('rate limit')
                            ? __( 'Submission Limit Reached', 'codeclove-school-management' )
                            : __( 'Unable to Submit Report', 'codeclove-school-management' )}
                      </h5>
                      <button
                        type="button"
                        onClick={() => setSubmitError(null)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 rounded cursor-pointer"
                        aria-label={__( 'Dismiss notice', 'codeclove-school-management' )}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">
                      {submitError}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-amber-200/60 dark:border-amber-800/40 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{__( 'Your draft is saved below and will not be lost.', 'codeclove-school-management' )}</span>
                      <button
                        type="button"
                        onClick={handleCopyFullReport}
                        className="text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{__( 'Copy Report', 'codeclove-school-management' )}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 1: Dropdown Selects */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeTab === 'bug' ? (
                  <>
                    <FormField label={__( 'Module / Area', 'codeclove-school-management' )} labelClassName="text-xs font-semibold">
                      <Select value={area} onValueChange={setArea} options={AREA_OPTIONS} className="h-9 text-xs" />
                    </FormField>

                    <FormField label={__( 'Severity / Urgency', 'codeclove-school-management' )} labelClassName="text-xs font-semibold">
                      <Select value={priority} onValueChange={(val) => setPriority(val as Priority)} options={PRIORITY_OPTIONS} className="h-9 text-xs" />
                    </FormField>
                  </>
                ) : (
                  <>
                    <FormField label={__( 'Refinement Category', 'codeclove-school-management' )} labelClassName="text-xs font-semibold">
                      <Select value={vector} onValueChange={setVector} options={VECTOR_OPTIONS} className="h-9 text-xs" />
                    </FormField>

                    <FormField label={__( 'Module / Area', 'codeclove-school-management' )} labelClassName="text-xs font-semibold">
                      <Select value={area} onValueChange={setArea} options={AREA_OPTIONS} className="h-9 text-xs" />
                    </FormField>
                  </>
                )}
              </div>

              {/* Row 2: Title */}
              <FormField
                label={activeTab === 'bug' ? __( 'Issue Title', 'codeclove-school-management' ) : __( 'Suggestion Title', 'codeclove-school-management' )}
                required
                labelClassName="text-xs font-semibold"
              >
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    if (submitError) setSubmitError(null)
                  }}
                  placeholder={
                    activeTab === 'bug'
                      ? __( 'e.g. Attendance export throws error on Grade 10 filter', 'codeclove-school-management' )
                      : __( 'e.g. Bulk-assign substitute teachers for absent staff', 'codeclove-school-management' )
                  }
                  className="h-9 text-xs"
                />
              </FormField>

              {/* Row 3: Description & Steps */}
              <FormField
                label={
                  activeTab === 'bug'
                    ? __( 'Description & Steps to Reproduce', 'codeclove-school-management' )
                    : __( 'Description & School Use-Case', 'codeclove-school-management' )
                }
                required
                labelClassName="text-xs font-semibold"
                action={
                  activeTab === 'bug' && !showExpected && !expected ? (
                    <button
                      type="button"
                      onClick={() => setShowExpected(true)}
                      className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{__( 'Add expected outcome', 'codeclove-school-management' )}</span>
                    </button>
                  ) : null
                }
              >
                <Textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    if (submitError) setSubmitError(null)
                  }}
                  placeholder={
                    activeTab === 'bug'
                      ? __(
                          '1. What were you doing?\n2. What happened instead? (Include error messages if any)\n3. Does it happen every time or intermittently?',
                          'codeclove-school-management'
                        )
                      : __(
                          'Describe your administrative workflow and how this improvement will save time, eliminate friction, or assist board compliance...',
                          'codeclove-school-management'
                        )
                  }
                  rows={3}
                  className="min-h-[80px] h-[84px] text-xs py-2 px-3 resize-y leading-relaxed"
                />
              </FormField>

              {/* Optional Expected Outcome (Bug only) */}
              {activeTab === 'bug' && (showExpected || expected) && (
                <FormField
                  label={__( 'What did you expect to happen? (Optional)', 'codeclove-school-management' )}
                  labelClassName="text-xs font-semibold"
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        setExpected('')
                        setShowExpected(false)
                      }}
                      className="text-[11px] text-text-muted hover:text-text cursor-pointer inline-flex items-center gap-1"
                    >
                      <Minus className="w-3 h-3" />
                      <span>{__( 'Remove', 'codeclove-school-management' )}</span>
                    </button>
                  }
                >
                  <Input
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    placeholder={__( 'e.g. Total fee balance should update to 0', 'codeclove-school-management' )}
                    className="h-9 text-xs"
                  />
                </FormField>
              )}

              {/* Telemetry Context Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-text">
                  <input
                    type="checkbox"
                    checked={includeDiagnostics}
                    onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>{__( 'Include anonymous system diagnostics', 'codeclove-school-management' )}</span>
                </label>

                <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
                  {includeDiagnostics && (
                    <>
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-text-subtle">
                        <span className="px-1.5 py-0.5 rounded bg-bg-surface border border-border/70">
                          v{diagnosticsData?.report?.codeclove?.version || window.CodeCloveConfig?.version || '1.0.14'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-bg-surface border border-border/70">
                          {diagnosticsData?.report?.codeclove?.preset || 'IN'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-bg-surface border border-border/70">
                          PHP {diagnosticsData?.report?.environment?.php_version || '8.4.25'}
                        </span>
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded border text-[10px] font-semibold tracking-tight',
                            licenseInfo.status === 'active'
                              ? 'bg-success/10 text-success border-success/25'
                              : licenseInfo.status === 'expired'
                              ? 'bg-danger/10 text-danger border-danger/25'
                              : 'bg-bg-surface border-border/70 text-text-muted'
                          )}
                        >
                          {licenseInfo.status === 'active'
                            ? `${licenseInfo.type || 'Pro'} • Active`
                            : licenseInfo.label || 'Free'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowPreview(!showPreview)}
                        className="text-[11px] text-text-muted hover:text-text cursor-pointer underline decoration-dotted font-medium inline-flex items-center gap-0.5 transition-colors"
                      >
                        <span>{showPreview ? __( 'Hide', 'codeclove-school-management' ) : __( 'Inspect', 'codeclove-school-management' )}</span>
                        {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </>
                  )}

                  <span
                    className="inline-flex items-center text-text-muted cursor-help"
                    title={__( 'Student records, passwords, and sensitive keys are never collected.', 'codeclove-school-management' )}
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  </span>
                </div>
              </div>

              {/* Collapsible Monospace Breakdown */}
              {includeDiagnostics && showPreview && (
                <div className="p-2.5 rounded-lg bg-bg-base border border-border text-[11px] text-text-secondary space-y-1 font-mono max-h-28 overflow-y-auto">
                  <div className="flex justify-between">
                    <span className="text-text-muted">CodeClove:</span>
                    <span>v{diagnosticsData?.report?.codeclove?.version || window.CodeCloveConfig?.version || '1.0.0'} ({diagnosticsData?.report?.codeclove?.edition || 'pro'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">License:</span>
                    <span className="font-semibold text-text">
                      {licenseInfo.status === 'active'
                        ? `${licenseInfo.type || 'Pro'} (Active)`
                        : `${licenseInfo.label || licenseInfo.status}`}
                    </span>
                  </div>
                  {licenseInfo.expires && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">License Expiry:</span>
                      <span>
                        {licenseInfo.expires === 'lifetime'
                          ? __( 'Lifetime', 'codeclove-school-management' )
                          : licenseInfo.expires}
                      </span>
                    </div>
                  )}
                  {licenseInfo.masked_key && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">License Key:</span>
                      <span className="font-mono text-xs">{licenseInfo.masked_key}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-muted">Preset:</span>
                    <span>{diagnosticsData?.report?.codeclove?.preset || 'IN'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">PHP / WordPress:</span>
                    <span>PHP {diagnosticsData?.report?.environment?.php_version || '8.x'} / WP {diagnosticsData?.report?.environment?.wp_version || '6.x'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Client Browser:</span>
                    <span>{getClientInfo().browser}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Active Route:</span>
                    <span className="truncate max-w-[240px]">{window.location.hash || window.location.pathname}</span>
                  </div>
                </div>
              )}

              {/* Modal Actions Footer: Clean, Harmonized, Pixel-Aligned */}
              <ModalFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3.5 mt-4 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyFullReport}
                  disabled={isCopying || isSubmitting}
                  className="h-9 px-3 text-xs text-text-muted hover:text-text gap-1.5 rounded-lg justify-center sm:justify-start"
                  title={__( 'Copy markdown report to clipboard', 'codeclove-school-management' )}
                >
                  {copiedSuccess ? (
                    <>
                      <Check size={14} className="text-success" />
                      <span>{__( 'Report Copied!', 'codeclove-school-management' )}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>{__( 'Copy Report', 'codeclove-school-management' )}</span>
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={closeFeedback}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none h-9 px-4 text-xs font-medium rounded-lg"
                  >
                    {__( 'Cancel', 'codeclove-school-management' )}
                  </Button>

                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleSubmitReport}
                    disabled={isSubmitting || cooldownRemaining > 0}
                    className="flex-1 sm:flex-none h-9 px-5 text-xs font-semibold rounded-lg gap-2 border border-transparent shadow-xs"
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner size="sm" />
                        <span>{__( 'Submitting...', 'codeclove-school-management' )}</span>
                      </>
                    ) : cooldownRemaining > 0 ? (
                      <>
                        <Clock size={13} className="shrink-0" />
                        <span>
                          {__( 'Wait %ds', 'codeclove-school-management' ).replace('%d', String(cooldownRemaining))}
                        </span>
                      </>
                    ) : (
                      <>
                        <Send size={13} className="-rotate-12 -translate-y-px" />
                        <span>{__( 'Submit Report', 'codeclove-school-management' )}</span>
                      </>
                    )}
                  </Button>
                </div>
              </ModalFooter>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default FeedbackModal
