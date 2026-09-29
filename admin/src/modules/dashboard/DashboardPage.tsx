/**
 * Dashboard: CodeClove Admin landing view.
 *
 * Layout:
 *   1. Page header: greeting, date, current term.
 *   2. Setup banner: onboarding checklist (dismissible).
 *   3. Operational strip: today's attendance + items needing attention.
 *   4. Core metrics: 4 standard cards (students, admissions, staff, fees).
 *   5. Analytics: fee collection and admissions trends.
 *   6. Recent activity: chronological event stream with relative timestamps.
 *
 * Designed for low cognitive load:
 *   - Unified action queue (no scattered alert badges).
 *   - Linear progress bars over radial dials.
 *   - Plain numbers with factual subtext (no ambiguous percentage badges).
 *   - Symmetrical 4-card grid across standard viewports.
 */
import {
  Users,
  ClipboardList,
  Briefcase,
  Wallet,
  Plus,
  ArrowRight,
  Sparkles,
  CalendarCheck,
  AlertCircle,
  Bell,
  Shield,
  BookOpen,
  X,
  Zap,
  FileText,
  Receipt,
  Sliders,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import {
  StatCard,
  Card,
  CardHeader,
  CardContent,
  EmptyState,
  Button,
  Alert,
  Skeleton,
} from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'
import { ROUTES, PERMISSIONS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/session-context'
import { usePermissions } from '@/lib/permissions'
import { useFormatter } from '@/lib/formatter'
import { useLabels } from '@/lib/labels'
import type { TerminologyLabels } from '@/api/settings'
import { useDashboardStats } from '@/api/dashboard'
import type { DashboardStats, TrendPoint, DashboardRange } from '@/api/dashboard'
import { useState } from 'react'

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user         = window.CodeCloveConfig?.currentUser
  const { session }  = useSession()
  const { getLabel } = useLabels()
  // ponytail: default to 'term' (school-native, not SaaS-generic '30days')
  const [range, setRange] = useState<DashboardRange>('term')

  const { data: stats, isLoading, isError, refetch } = useDashboardStats(session?.id, range)

  const termLabel    = getLabel('academic_term', false, 'Term')
  const sessionLabel = getLabel('academic_session', false, 'Session')

  const RANGES: { key: DashboardRange; label: string }[] = [
    { key: 'term',    label: sprintf( __( 'This %s', 'codeclove-school-management' ), termLabel ) },
    { key: 'session', label: sprintf( __( 'This %s', 'codeclove-school-management' ), sessionLabel ) },
    { key: '30days',  label: __( 'Last 30 days', 'codeclove-school-management' ) },
  ]

  const hasCharts = !!(stats?.admissions_trend?.length || stats?.finance_trend?.length)

  return (
    <div className="space-y-5 w-full">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <DashboardGreetingHeader
        user={user}
        roleName={stats?.user_role ?? null}
        isAdmin={!!user?.isAdmin}
        termName={stats?.current_term?.name}
      />

      {/* ── Setup Banner (onboarding only, dismissible) ──────────────────────── */}
      {stats?.setup_checklist && (
        <SetupBanner
          checklist={stats.setup_checklist as unknown as Record<string, boolean>}
          sessionLabel={sessionLabel}
          getLabel={getLabel}
        />
      )}

      {/* ── Operational Strip (Attendance & Action Queue) ───────────────────── */}
      <TodayStrip stats={stats} isLoading={isLoading} />

      {/* ── Error State ──────────────────────────────────────────────────────── */}
      {isError && (
        <Alert variant="danger" title={__( 'Failed to load dashboard statistics', 'codeclove-school-management' )}>
          <div className="flex items-center justify-between gap-4 mt-1">
            <span>{__( 'An error occurred while communicating with the database.', 'codeclove-school-management' )}</span>
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              {__( 'Retry', 'codeclove-school-management' )}
            </Button>
          </div>
        </Alert>
      )}

      {/* ── Core KPI Metrics ────────────────────────────────────────────────── */}
      <StatsRow stats={stats} isLoading={isLoading} />

      {/* ── Analytics Section ───────────────────────────────────────────────── */}
      {(hasCharts || isLoading) && (
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
            <h2 className="text-lg font-semibold text-text">{__( 'Analytics', 'codeclove-school-management' )}</h2>
            <div className="flex items-center gap-0.5 bg-bg-elevated border border-border rounded-lg p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 whitespace-nowrap',
                    range === r.key
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-text-muted hover:text-text hover:bg-bg-overlay'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <ChartsRow stats={stats} isLoading={isLoading} />
        </section>
      )}

      {/* ── Recent Activity ─────────────────────────────────────────────────── */}
      <RecentActivity events={stats?.recent_events} isLoading={isLoading} />

    </div>
  )
}

// ─── Page Header ─────────────────────────────────────────────────────────────

function DashboardGreetingHeader({
  user,
  roleName,
  isAdmin,
  termName,
}: {
  user?: { name?: string; isAdmin?: boolean }
  roleName: string | null
  isAdmin: boolean
  termName?: string
}) {
  const { formatDate } = useFormatter()
  const greeting = getGreeting()
  const appLocale = (window.CodeCloveConfig?.locale || 'en_US').replace('_', '-')
  const weekday = new Date().toLocaleDateString(appLocale, { weekday: 'long' })
  const dateStr = `${weekday}, ${formatDate(new Date())}`

  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-text">
            {greeting}, {(user?.name ?? __( 'Admin', 'codeclove-school-management' )).split(' ')[0]}
          </h1>
          {!isAdmin && roleName && (
            <span className="inline-flex items-center gap-1 bg-brand-dim border border-brand/20 rounded-full px-2.5 py-0.5">
              <Shield size={12} className="text-brand" />
              <span className="text-xs font-medium text-brand">{roleName}</span>
            </span>
          )}
        </div>
        <p className="text-sm text-text-muted mt-1">{dateStr}</p>
      </div>

      {termName && (
        <div className="hidden sm:flex items-center gap-1.5 bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text-muted shadow-sm">
          <BookOpen size={14} className="text-brand flex-shrink-0" />
          <span className="font-medium text-text">{termName}</span>
        </div>
      )}
    </div>
  )
}

// ─── Setup Banner ─────────────────────────────────────────────────────────────

function SetupBanner({
  checklist,
  sessionLabel,
  getLabel,
}: {
  checklist: Record<string, boolean>
  sessionLabel: string
  getLabel: (key: keyof TerminologyLabels, plural?: boolean, defaultValue?: string) => string
}) {
  const navigate = useNavigate()
  // ponytail: localStorage dismiss, no API call
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('codeclove-setup-banner') === '1'
  )

  const steps: Array<{ key: string; label: string; to: string }> = [
    { key: 'preset',    label: __( 'Choose an education system preset', 'codeclove-school-management' ),                          to: ROUTES.SETTINGS },
    { key: 'session',   label: sprintf( __( 'Create your first %s', 'codeclove-school-management' ), sessionLabel.toLowerCase() ),            to: ROUTES.SESSIONS },
    { key: 'units',     label: sprintf( __( 'Set up %s', 'codeclove-school-management' ), getLabel('academic_unit', true, 'classes').toLowerCase() ), to: ROUTES.UNITS },
    { key: 'roles',     label: __( 'Configure staff roles and permissions', 'codeclove-school-management' ),                      to: ROUTES.ROLES_PERMISSIONS },
    { key: 'admission', label: __( 'Open admissions for enrolment', 'codeclove-school-management' ),                              to: ROUTES.ADMISSIONS },
  ]

  const completed = steps.filter((s) => checklist[s.key]).length
  const total     = steps.length
  const progress  = Math.round((completed / total) * 100)
  const nextStep  = steps.find((s) => !checklist[s.key])

  if (completed === total || dismissed) return null

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-lg bg-brand-dim border border-brand/20">
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0 w-full sm:w-auto">
        <Zap size={15} className="text-brand flex-shrink-0 mt-0.5 sm:mt-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-sm font-medium text-text">
              {sprintf( __( '%1$d of %2$d setup steps complete', 'codeclove-school-management' ), completed, total )}
            </span>
            <div className="flex-1 h-1.5 bg-bg-base rounded-full overflow-hidden min-w-[60px] max-w-[120px]">
              <div
                className="h-full bg-brand rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-bold text-brand">{progress}%</span>
          </div>
          {nextStep && (
            <p className="text-xs text-text-muted mt-0.5 truncate">
              {sprintf( __( 'Next: %s', 'codeclove-school-management' ), nextStep.label )}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
        {nextStep && (
          <Button
            variant="secondary"
            size="sm"
            className="text-xs flex-shrink-0"
            onClick={() => navigate(nextStep.to)}
          >
            {__( 'Continue setup', 'codeclove-school-management' )}
          </Button>
        )}
        <button
          onClick={() => {
            localStorage.setItem('codeclove-setup-banner', '1')
            setDismissed(true)
          }}
          className="text-text-subtle hover:text-text transition-colors flex-shrink-0"
          aria-label={__( 'Dismiss setup banner', 'codeclove-school-management' )}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Today Strip (Attendance & Action Items) ──────────────────────────────────

function TodayStrip({ stats, isLoading }: { stats?: DashboardStats; isLoading: boolean }) {
  const navigate = useNavigate()
  const s = stats?.today_summary
  const p = stats?.pending_approvals
  const staff = stats?.staff_attendance_today

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-[76px] rounded-2xl" />
        <Skeleton className="h-[76px] rounded-2xl" />
      </div>
    )
  }

  const studentPct = s?.attendance_pct !== null && s?.attendance_pct !== undefined
    ? `${s.attendance_pct}%`
    : '—'
  const staffPct = staff?.pct !== null && staff?.pct !== undefined
    ? `${staff.pct}%`
    : '—'

  const pendingAdmissions = p?.admissions ?? 0
  const pendingStaff = p?.staff_apps ?? 0
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* ── Today's Attendance ────────────────────────────────────────────── */}
      <div
        onClick={() => navigate(ROUTES.ATTENDANCE)}
        className="rounded-2xl bg-bg-elevated border border-border p-4 sm:p-5 flex items-center gap-4 transition-all duration-150 hover:border-border-strong hover:shadow-card cursor-pointer group"
      >
        <div className="w-11 h-11 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
          <CalendarCheck size={19} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-text-muted tracking-wider uppercase">
            {__( "Today's Attendance", 'codeclove-school-management' )}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm text-text-muted mt-0.5 font-normal">
            <span>{__( 'Students:', 'codeclove-school-management' )} <span className="font-bold text-text tabular-nums">{studentPct}</span></span>
            <span className="hidden sm:inline text-border-strong">·</span>
            <span>{__( 'Staff:', 'codeclove-school-management' )} <span className="font-bold text-text tabular-nums">{staffPct}</span></span>
          </p>
        </div>
      </div>

      {/* ── Action Items Pending ─────────────────────────────────────────── */}
      <div
        onClick={() => navigate(ROUTES.ADMISSIONS)}
        className="rounded-2xl bg-bg-elevated border border-border p-4 sm:p-5 flex items-center gap-4 transition-all duration-150 hover:border-border-strong hover:shadow-card cursor-pointer group"
      >
        <div className="w-11 h-11 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
          <Bell size={19} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-text-muted tracking-wider uppercase">
            {__( 'Action Items Pending', 'codeclove-school-management' )}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm text-text-muted mt-0.5 font-normal">
            <span>{__( 'Admissions:', 'codeclove-school-management' )} <span className="font-bold text-text tabular-nums">{sprintf( __( '%d Reviews', 'codeclove-school-management' ), pendingAdmissions )}</span></span>
            <span className="hidden sm:inline text-border-strong">·</span>
            <span>{__( 'Staff:', 'codeclove-school-management' )} <span className="font-bold text-text tabular-nums">{sprintf( __( '%d Profiles', 'codeclove-school-management' ), pendingStaff )}</span></span>
          </p>
        </div>
      </div>
    </div>
  )
}

const pill = (text: string, color: string) => (
  <span className={cn('px-2 py-0.5 text-xs font-semibold rounded-full tabular-nums', color)}>
    {text}
  </span>
)

// ─── Stats Row (5-Card Row) ───────────────────────────────────────────────────

function StatsRow({ stats, isLoading }: { stats?: DashboardStats; isLoading: boolean }) {
  const navigate = useNavigate()
  const { formatCurrency, formatNumber } = useFormatter()
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <StatCard key={i} label="" value="" icon={Users} loading />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {/* 1. Enrolled Students */}
      <StatCard
        label={__( 'Enrolled Students', 'codeclove-school-management' )}
        value={stats?.total_students !== undefined ? formatNumber(stats.total_students) : '—'}
        icon={Users}
        iconColor="text-indigo-600 dark:text-indigo-400"
        iconBg="bg-indigo-50 dark:bg-indigo-950/50"
        badge={stats?.student_delta ? pill(stats.student_delta, 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300') : undefined}
        clickable
        onClick={() => navigate(ROUTES.STUDENT_DIRECTORY)}
      />

      {/* 2. Open Applications */}
      <StatCard
        label={__( 'Open Applications', 'codeclove-school-management' )}
        value={stats?.open_admissions !== undefined ? formatNumber(stats.open_admissions) : '—'}
        icon={ClipboardList}
        iconColor="text-sky-600 dark:text-sky-400"
        iconBg="bg-sky-50 dark:bg-sky-950/50"
        badge={stats?.admissions_delta ? pill(stats.admissions_delta, 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300') : undefined}
        clickable
        onClick={() => navigate(ROUTES.ADMISSIONS)}
      />

      {/* 3. Active Staff */}
      <StatCard
        label={__( 'Active Staff', 'codeclove-school-management' )}
        value={stats?.total_staff !== undefined ? formatNumber(stats.total_staff) : '—'}
        icon={Briefcase}
        iconColor="text-amber-600 dark:text-amber-400"
        iconBg="bg-amber-50 dark:bg-amber-950/50"
        badge={stats?.staff_delta ? pill(stats.staff_delta, 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300') : undefined}
        clickable
        onClick={() => navigate(ROUTES.STAFF_DIRECTORY)}
      />

      {/* 4. Outstanding Fees */}
      <StatCard
        label={__( 'Outstanding Fees', 'codeclove-school-management' )}
        value={stats?.outstanding_fees_minor !== undefined ? formatCurrency(stats.outstanding_fees_minor) : '—'}
        icon={Wallet}
        iconColor="text-emerald-600 dark:text-emerald-400"
        iconBg="bg-emerald-50 dark:bg-emerald-950/50"
        badge={stats?.fees_delta_minor && stats.fees_delta_minor > 0 ? pill(`+${formatCurrency(stats.fees_delta_minor)}`, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300') : undefined}
        clickable
        onClick={() => navigate(ROUTES.INVOICES)}
      />

      {/* 5. Overdue Invoices */}
      <StatCard
        label={__( 'Overdue Invoices', 'codeclove-school-management' )}
        value={stats?.overdue_invoices !== undefined ? formatNumber(stats.overdue_invoices) : '—'}
        icon={AlertCircle}
        iconColor="text-rose-600 dark:text-rose-400"
        iconBg="bg-rose-50 dark:bg-rose-950/50"
        badge={stats?.overdue_invoices && stats.overdue_invoices > 0 ? pill(__( 'Action', 'codeclove-school-management' ), 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300') : undefined}
        clickable
        onClick={() => navigate(ROUTES.INVOICES)}
      />
    </div>
  )
}

// ─── Charts Row ───────────────────────────────────────────────────────────────

function ChartsRow({ stats, isLoading }: { stats?: DashboardStats; isLoading: boolean }) {
  const { getLabel } = useLabels()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent className="pt-0">
              <Skeleton className="h-[200px] w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const charts: React.ReactNode[] = []

  if (stats?.finance_trend?.length) {
    charts.push(<FinanceChart key="fin" data={stats.finance_trend} />)
  }

  if (stats?.admissions_trend?.length) {
    charts.push(
      <AdmissionsChart
        key="adm"
        data={stats.admissions_trend}
        label={getLabel('admission_application', true, 'Admissions')}
      />
    )
  }

  if (!charts.length) return null

  return (
    <div className={cn(
      'grid gap-5',
      charts.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'
    )}>
      {charts}
    </div>
  )
}

// ─── Chart shared style ───────────────────────────────────────────────────────

const axisStyle = { fontSize: 11, fill: 'var(--text-muted)' }

function formatChartDate(value: string) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value)
    if (isNaN(date.getTime())) return value
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    const parts = value.split('-')
    const date = new Date(parseInt(parts[0] || '2026'), parseInt(parts[1] || '01') - 1, 1)
    if (isNaN(date.getTime())) return value
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  return value
}

const tooltipStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--text)',
  boxShadow: 'var(--shadow-card)',
}

// ─── Individual Charts ────────────────────────────────────────────────────────

function FinanceChart({ data }: { data: TrendPoint[] }) {
  const { formatCurrency, localization } = useFormatter()

  const totalBilled    = data.reduce((s, d) => s + (d.billed    ?? 0), 0)
  const totalCollected = data.reduce((s, d) => s + (d.collected ?? 0), 0)
  const rate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : null
  const isIndianFormat = localization?.number_format === 'indian'
  return (
    <Card>
      <CardHeader>
        <div>
          <h3 className="text-base font-semibold text-text">{__( 'Fee Collection', 'codeclove-school-management' )}</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {sprintf(
              __( '%1$s collected of %2$s billed', 'codeclove-school-management' ),
              formatCurrency(totalCollected),
              formatCurrency(totalBilled)
            )}
          </p>
        </div>
        {rate !== null && (
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded tabular-nums',
            rate >= 90 ? 'text-success bg-success/10' :
            rate >= 70 ? 'text-warning bg-warning/10' :
                         'text-danger bg-danger/10'
          )}>
            {sprintf( __( '%d%% collected', 'codeclove-school-management' ), rate )}
          </span>
        )}
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatChartDate} interval="preserveStartEnd" />
            <YAxis
              tick={axisStyle}
              axisLine={false}
              tickLine={false}
              width={28}
              tickFormatter={(v: number) => {
                if (isIndianFormat) {
                  return v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr`
                    : v >= 100000 ? `${(v / 100000).toFixed(1)}L`
                    : v >= 1000   ? `${(v / 1000).toFixed(0)}K`
                    : String(v)
                }
                return v >= 1000000 ? `${(v / 1000000).toFixed(1)}M`
                  : v >= 1000 ? `${(v / 1000).toFixed(0)}K`
                  : String(v)
              }}
            />
            <RechartsTooltip
              formatter={(v) => formatCurrency(Number(v))}
              contentStyle={tooltipStyle}
            />
            <Legend
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 8 }}
            />
            <Bar dataKey="billed"    name={__( 'Billed', 'codeclove-school-management' )}    fill="var(--brand)"   radius={[3,3,0,0]} maxBarSize={28} opacity={0.6} />
            <Bar dataKey="collected" name={__( 'Collected', 'codeclove-school-management' )} fill="var(--success)" radius={[3,3,0,0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function AdmissionsChart({ data, label }: { data: TrendPoint[]; label: string }) {
  const totalApplications = data.reduce((s, d) => s + (d.count ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <div>
          <h3 className="text-base font-semibold text-text">
            {sprintf( __( '%s Trend', 'codeclove-school-management' ), label )}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {sprintf( __( '%d total applications in selected period', 'codeclove-school-management' ), totalApplications )}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="dsh-adm-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--brand)" stopOpacity={0.18} />
                <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatChartDate} interval="preserveStartEnd" />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
            <RechartsTooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="count"
              name={__( 'Applications', 'codeclove-school-management' )}
              stroke="var(--brand)"
              strokeWidth={2}
              fill="url(#dsh-adm-grad)"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--brand)', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ─── Recent Activity ──────────────────────────────────────────────────────────

// ponytail: direct icon lookup map, zero abstraction
const EVENT_ICON: Record<string, typeof FileText> = {
  admission_created: FileText,
  admission_status_changed: FileText,
  status_change: FileText,
  'admissions_application.status_changed': FileText,
  'admissions_application.updated': FileText,
  payment_recorded: Receipt,
  'payment.recorded': Receipt,
  invoice_issued: Receipt,
  'invoice.issued': Receipt,
  attendance_taken: CalendarCheck,
  'attendance.staff_saved': CalendarCheck,
  'attendance.student_saved': CalendarCheck,
  settings_updated: Sliders,
  'settings.updated': Sliders,
  student_created: Users,
  'student.admitted': Users,
  staff_member_created: Briefcase,
}

function RecentActivity({
  events,
  isLoading,
}: {
  events?: DashboardStats['recent_events']
  isLoading: boolean
}) {
  const navigate = useNavigate()
  const { can }  = usePermissions()
  const { formatDate, formatTime } = useFormatter()

  // ponytail: format activity timestamp using configured date_format and time_format
  const formatActivityTimestamp = (dateStr: string): string => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr

    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const timeStr = formatTime(d)
    if (isToday) return sprintf( __( 'Today, %s', 'codeclove-school-management' ), timeStr )
    if (isYesterday) return sprintf( __( 'Yesterday, %s', 'codeclove-school-management' ), timeStr )

    return `${formatDate(d)}, ${timeStr}`
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <div className="divide-y divide-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-5 py-2.5 flex items-center gap-3">
              <Skeleton className="w-6 h-6 rounded-md flex-shrink-0" />
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-28 ms-auto" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-text">{__( 'Recent Activity', 'codeclove-school-management' )}</h2>
        {can(PERMISSIONS.SETTINGS_MANAGE) ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1 text-brand hover:text-brand-strong p-0 h-auto font-medium"
            onClick={() => navigate(ROUTES.ACTIVITY_LOG)}
          >
            {__( 'View all', 'codeclove-school-management' )} <ArrowRight size={12} className="rtl:rotate-180" />
          </Button>
        ) : (
          events && events.length > 0 && (
            <span className="text-xs text-text-muted">
              {sprintf( __( '%d events', 'codeclove-school-management' ), events.length )}
            </span>
          )
        )}
      </CardHeader>
      {!events?.length ? (
        <CardContent className="px-5 py-4">
          <EmptyState
            title={__( 'No activity yet', 'codeclove-school-management' )}
            description={__( 'Admissions, attendance records, payments, and staff events will appear here.', 'codeclove-school-management' )}
            icon={Sparkles}
            action={
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => navigate(ROUTES.ADMISSIONS)}
              >
                <Plus size={12} /> {__( 'Create first admission', 'codeclove-school-management' )}
              </Button>
            }
          />
        </CardContent>
      ) : (
        <div className="divide-y divide-border">
          {events.map((ev) => {
            const EventIcon = EVENT_ICON[ev.event_type] ?? FileText

            let prefix = ev.prefix
            let detail = ev.detail
            if (!prefix) {
              const label = ev.label ?? ev.event_type.replace(/[_.]/g, ' ')
              const colonIdx = label.indexOf(':')
              if (colonIdx !== -1) {
                prefix = label.slice(0, colonIdx + 1)
                detail = label.slice(colonIdx + 1).trim()
              } else {
                prefix = label
                detail = ''
              }
            }

            return (
              <div
                key={ev.id}
                className="px-5 py-3.5 flex items-center gap-3.5 hover:bg-bg-overlay transition-colors overflow-hidden"
              >
                <EventIcon size={16} className="text-text-muted flex-shrink-0" />

                <p className="text-xs text-text flex-1 min-w-0 truncate">
                  <span className="font-semibold text-text">{prefix} </span>
                  <span className="text-text-muted truncate inline-block max-w-[calc(100%-80px)] align-bottom">{detail}</span>
                </p>

                <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded text-xs font-medium bg-bg-base border border-border text-text-subtle flex-shrink-0">
                  {ev.actor_name || __( 'Administrator', 'codeclove-school-management' )}
                </span>

                <span className="text-xs text-text-muted flex-shrink-0 tabular-nums min-w-[85px] text-end">
                  {formatActivityTimestamp(ev.created_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return __( 'Good morning', 'codeclove-school-management' )
  if (h < 17) return __( 'Good afternoon', 'codeclove-school-management' )
  return __( 'Good evening', 'codeclove-school-management' )
}
