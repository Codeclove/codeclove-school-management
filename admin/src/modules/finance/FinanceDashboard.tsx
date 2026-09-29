// ponytail: modern executive finance dashboard, high craft, zero fluff, native tokens
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Receipt,
  HandCoins,
  CalendarClock,
  AlertCircle,
  Plus,
  ArrowRight,
  ShieldAlert,
  TrendingUp,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
} from 'lucide-react'
import { useFinanceSummary } from '@/api/finance'
import { useSettings } from '@/api/settings'
import { getStatusVariant, getMethodLabel } from './finance-utils'
import { useSession } from '@/lib/session-context'
import { useFormatter } from '@/lib/formatter'
import { useLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'
import {
  Button,
  PageHeader,
  EmptyState,
  PersonAvatar,
  Badge,
  Skeleton,
  Card,
  CardHeader,
  CardContent,
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableEmpty,
} from '@/components/ui'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface ActivityRow {
  id: string
  rawId: number
  type: 'invoice' | 'payment'
  reference: string
  studentName: string
  studentNumber?: string
  date: string
  dueDate?: string | null
  amount: number
  status: string
  method?: string
  targetUrl: string
}

export default function FinanceDashboard() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { formatCurrency, formatDate } = useFormatter()
  const { getLabel } = useLabels()

  const { data: settings } = useSettings()
  const localization = settings?.localization
  const date_format = localization?.date_format || 'd/m/Y'
  const isUS = localization?.currency === 'USD' || date_format.toLowerCase().startsWith('m')

  const reportLabel = isUS ? __('Past Due Report', 'codeclove-school-management') : __('Defaulters Report', 'codeclove-school-management')
  const invoiceLabel = getLabel('invoice', false, __('Invoice', 'codeclove-school-management'))
  const invoiceLabelPlural = getLabel('invoice', true, __('Invoices', 'codeclove-school-management'))
  const paymentLabelPlural = getLabel('payment', true, __('Payments', 'codeclove-school-management'))

  const ranges = useMemo<{ key: 'week' | 'month' | 'term' | 'year'; label: string }[]>(
    () => [
      { key: 'week', label: __('Week', 'codeclove-school-management') },
      { key: 'month', label: __('Month', 'codeclove-school-management') },
      { key: 'term', label: __('Term', 'codeclove-school-management') },
      { key: 'year', label: __('Session', 'codeclove-school-management') },
    ],
    []
  )

  // Dashboard state
  const [range, setRange] = useState<'week' | 'month' | 'term' | 'year'>('month')
  const [ledgerTab, setLedgerTab] = useState<'all' | 'invoices' | 'payments'>('all')

  const { data: summary, isLoading, isError, refetch } = useFinanceSummary(session?.id, range)

  // Unified chronological activity stream
  const activityRows = useMemo<ActivityRow[]>(() => {
    if (!summary) return []

    const invoices: ActivityRow[] = (summary.recent_invoices || []).map((inv) => ({
      id: `inv-${inv.id}`,
      rawId: inv.id,
      type: 'invoice',
      reference: inv.invoice_number,
      studentName: `${inv.student_first_name || ''} ${inv.student_last_name || ''}`.trim() || __('Student', 'codeclove-school-management'),
      studentNumber: inv.student_number || undefined,
      date: inv.issue_date,
      dueDate: inv.due_date,
      amount: inv.total_minor,
      status: inv.status,
      targetUrl: `/finance/invoices/${inv.id}`,
    }))

    const payments: ActivityRow[] = (summary.recent_payments || []).map((p) => ({
      id: `pay-${p.id}`,
      rawId: p.id,
      type: 'payment',
      reference: p.payment_number,
      studentName: `${p.student_first_name || ''} ${p.student_last_name || ''}`.trim() || __('Student', 'codeclove-school-management'),
      studentNumber: p.student_number || undefined,
      date: p.paid_on,
      amount: p.amount_minor,
      status: p.status,
      method: p.method,
      targetUrl: '/finance/payments',
    }))

    if (ledgerTab === 'invoices') return invoices
    if (ledgerTab === 'payments') return payments

    return [...invoices, ...payments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [summary, ledgerTab])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={__('Finance', 'codeclove-school-management')}
          description={__('School fee billings, collections, and student account balances.', 'codeclove-school-management')}
          breadcrumbs={[{ label: __('Finance', 'codeclove-school-management') }, { label: __('Dashboard', 'codeclove-school-management') }]}
        />
        <div className="rounded-2xl border border-border/70 bg-bg-surface p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (isError || !summary) {
    return (
      <EmptyState
        title={__('Error loading finance summary', 'codeclove-school-management')}
        description={__('Could not retrieve financial metrics for this session. Check your connection or try again.', 'codeclove-school-management')}
        icon={ShieldAlert}
        action={
          <Button variant="secondary" onClick={() => refetch()}>
            {__('Try again', 'codeclove-school-management')}
          </Button>
        }
      />
    )
  }

  const collectionRate = summary.total_billed > 0
    ? ((summary.total_collected / summary.total_billed) * 100).toFixed(1)
    : '0.0'

  const outstandingRate = summary.total_billed > 0
    ? ((summary.total_outstanding / summary.total_billed) * 100).toFixed(1)
    : '0.0'

  const recoveryRate = summary.period_billed > 0
    ? Math.round((summary.period_collected / summary.period_billed) * 100)
    : 0

  const formatChartXAxis = (value: unknown) => {
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const d = new Date(value)
      if (isNaN(d.getTime())) return value
      if (range === 'year') return d.toLocaleDateString(undefined, { month: 'short' })
      return isUS
        ? `${d.toLocaleDateString(undefined, { month: 'short' })} ${d.getDate()}`
        : `${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'short' })}`
    }
    return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Page Header with Quick-Actions & Range Filter ───────── */}
      <PageHeader
        title={__('Finance', 'codeclove-school-management')}
        description={__('School fee billings, collections, and student account balances.', 'codeclove-school-management')}
        breadcrumbs={[{ label: __('Finance', 'codeclove-school-management') }, { label: __('Dashboard', 'codeclove-school-management') }]}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Timeframe pill selector */}
            <div className="inline-flex rounded-lg bg-bg-base border border-border/80 p-0.5">
              {ranges.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-all select-none',
                    range === r.key
                      ? 'bg-bg-surface text-brand font-semibold shadow-xs'
                      : 'text-text-muted hover:text-text'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Direct navigation shortcuts */}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/finance/invoices')}
              className="text-xs"
            >
              <Receipt className="h-3.5 w-3.5 mr-1.5" />
              {invoiceLabelPlural}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/finance/payments')}
              className="text-xs"
            >
              <HandCoins className="h-3.5 w-3.5 mr-1.5" />
              {paymentLabelPlural}
            </Button>

            {/* Primary Action */}
            <Button
              size="sm"
              onClick={() => navigate('/finance/invoices/new')}
              className="text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {sprintf(__('New %s', 'codeclove-school-management'), invoiceLabel)}
            </Button>
          </div>
        }
      />

      {/* ── 2. Executive Financial Overview (Mercury Style) ─────────── */}
      <div className="rounded-2xl border border-border/70 bg-bg-surface shadow-xs overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
          {/* Cell 1: Total Collected */}
          <div className="p-5 flex flex-col justify-between space-y-3 bg-gradient-to-b from-transparent to-success/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">
                {__('Total Collected', 'codeclove-school-management')}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success-dim text-success tabular-nums">
                <TrendingUp className="h-3 w-3" />
                {collectionRate}%
              </span>
            </div>
            <div>
              <p className="text-3xl font-bold tracking-tight text-text tabular-nums">
                {formatCurrency(summary.total_collected)}
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-bg-base overflow-hidden border border-border/40">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-500"
                    style={{ width: `${Math.min(100, parseFloat(collectionRate))}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-text-muted tabular-nums">
                  {sprintf(__('of %s', 'codeclove-school-management'), formatCurrency(summary.total_billed))}
                </span>
              </div>
            </div>
            <p className="text-xs text-text-subtle">
              {__('Active academic session revenue', 'codeclove-school-management')}
            </p>
          </div>

          {/* Cell 2: Total Invoiced / Billed */}
          <div className="p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">
                {isUS ? __('Total Invoiced', 'codeclove-school-management') : __('Total Billed', 'codeclove-school-management')}
              </span>
              <span className="p-1.5 rounded-lg bg-brand-dim text-brand">
                <Receipt className="h-4 w-4" />
              </span>
            </div>
            <div>
              <p className="text-3xl font-bold tracking-tight text-text tabular-nums">
                {formatCurrency(summary.total_billed)}
              </p>
              <p className="text-xs text-text-muted mt-1.5">
                {__('Full session charges issued', 'codeclove-school-management')}
              </p>
            </div>
            <p className="text-xs text-text-subtle">
              {__('Cumulative student fee billings', 'codeclove-school-management')}
            </p>
          </div>

          {/* Cell 3: Outstanding Receivables */}
          <div className="p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">
                {__('Outstanding Balance', 'codeclove-school-management')}
              </span>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums',
                summary.total_outstanding > 0 ? 'bg-danger-dim text-danger' : 'bg-bg-base text-text-muted'
              )}>
                {sprintf(__('%s%% unpaid', 'codeclove-school-management'), outstandingRate)}
              </span>
            </div>
            <div>
              <p className={cn(
                'text-3xl font-bold tracking-tight tabular-nums',
                summary.total_outstanding > 0 ? 'text-danger' : 'text-text'
              )}>
                {formatCurrency(summary.total_outstanding)}
              </p>
              <p className="text-xs text-text-muted mt-1.5">
                {__('Remaining session balance', 'codeclove-school-management')}
              </p>
            </div>
            <p className="text-xs text-text-subtle">
              {summary.total_outstanding > 0 ? __('Pending student payments', 'codeclove-school-management') : __('All accounts settled', 'codeclove-school-management')}
            </p>
          </div>

          {/* Cell 4: Overdue Invoices */}
          <div
            onClick={() => summary.overdue_count > 0 && navigate('/finance/invoices?status=overdue')}
            className={cn(
              'p-5 flex flex-col justify-between space-y-3 transition-colors',
              summary.overdue_count > 0
                ? 'cursor-pointer hover:bg-warning-dim/20 bg-warning-dim/5'
                : 'bg-transparent'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">
                {__('Past Due Invoices', 'codeclove-school-management')}
              </span>
              {summary.overdue_count > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/15 text-warning">
                  <AlertCircle className="h-3 w-3" />
                  {__('Action needed', 'codeclove-school-management')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success-dim text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  {__('On schedule', 'codeclove-school-management')}
                </span>
              )}
            </div>
            <div>
              <p className="text-3xl font-bold tracking-tight text-text tabular-nums flex items-baseline gap-2">
                {summary.overdue_count}
                <span className="text-xs font-normal text-text-muted">
                  {summary.overdue_count === 1 ? invoiceLabel.toLowerCase() : invoiceLabelPlural.toLowerCase()}
                </span>
              </p>
              <p className="text-xs text-text-muted mt-1.5">
                {summary.overdue_count > 0 ? __('Accounts past due deadline', 'codeclove-school-management') : __('No overdue accounts', 'codeclove-school-management')}
              </p>
            </div>
            <div className="flex items-center justify-between text-xs font-medium">
              <span className={summary.overdue_count > 0 ? 'text-warning' : 'text-text-subtle'}>
                {summary.overdue_count > 0 ? __('Review overdue accounts', 'codeclove-school-management') : __('Clean collection record', 'codeclove-school-management')}
              </span>
              {summary.overdue_count > 0 && (
                <ArrowRight className="h-3.5 w-3.5 text-warning" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Integrated Analytics & Cycle Performance ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left (2 cols): Inflow & Revenue Trajectory Area Chart */}
        <Card className="lg:col-span-2 flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
            <div>
              <h3 className="text-base font-semibold text-text">{__('Inflow & Collections', 'codeclove-school-management')}</h3>
              <p className="text-xs text-text-muted mt-0.5">
                {sprintf(
                  __('Billing volume compared with cash collections (%s)', 'codeclove-school-management'),
                  summary.period_label
                )}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-text-muted">
                <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                {isUS ? __('Invoiced', 'codeclove-school-management') : __('Billed', 'codeclove-school-management')}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-text-muted">
                <span className="w-2.5 h-2.5 rounded-full bg-success" />
                {__('Collected', 'codeclove-school-management')}
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-4 pb-2">
            {summary.chart_data.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-xs text-text-muted">
                {__('No transactions recorded in this period.', 'codeclove-school-management')}
              </div>
            ) : (
              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.chart_data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartBilledGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--brand)" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="chartCollectedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis
                      dataKey={range === 'term' ? 'label' : 'date'}
                      stroke="var(--text-subtle)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatChartXAxis}
                    />
                    <YAxis
                      stroke="var(--text-subtle)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatCurrency(v).split('.')[0] || ''}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--text)',
                        boxShadow: 'var(--shadow-card)',
                      }}
                      formatter={(value: unknown, name: unknown) => [
                        formatCurrency(Number(value) || 0),
                        name === 'billed' ? (isUS ? __('Invoiced', 'codeclove-school-management') : __('Billed', 'codeclove-school-management')) : __('Collected', 'codeclove-school-management'),
                      ]}
                    />
                    <Area
                      name="billed"
                      type="monotone"
                      dataKey="billed"
                      stroke="var(--brand)"
                      fillOpacity={1}
                      fill="url(#chartBilledGrad)"
                      strokeWidth={2}
                    />
                    <Area
                      name="collected"
                      type="monotone"
                      dataKey="collected"
                      stroke="var(--success)"
                      fillOpacity={1}
                      fill="url(#chartCollectedGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right (1 col): Cycle Performance Companion Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="border-b border-border/60 pb-3">
            <div>
              <h3 className="text-base font-semibold text-text">{__('Cycle Performance', 'codeclove-school-management')}</h3>
              <p className="text-xs text-text-muted mt-0.5">{summary.period_label}</p>
            </div>
          </CardHeader>

          <CardContent className="py-4 space-y-4 flex-1 flex flex-col justify-between">
            {/* Real-time Inflow Metrics */}
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-bg-base border border-border/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-text-muted">{__("Today's Inflow", 'codeclove-school-management')}</p>
                  <p className="text-lg font-bold text-text tabular-nums mt-0.5">
                    {formatCurrency(summary.today_collected)}
                  </p>
                </div>
                <span className="p-2 rounded-lg bg-success-dim text-success">
                  <HandCoins className="h-4 w-4" />
                </span>
              </div>

              <div className="p-3 rounded-xl bg-bg-base border border-border/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-text-muted">{__('30-Day Collections', 'codeclove-school-management')}</p>
                  <p className="text-lg font-bold text-text tabular-nums mt-0.5">
                    {formatCurrency(summary.month_collected)}
                  </p>
                </div>
                <span className="p-2 rounded-lg bg-brand-dim text-brand">
                  <CalendarClock className="h-4 w-4" />
                </span>
              </div>
            </div>

            {/* Cycle Recovery Meter */}
            <div className="pt-3 border-t border-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-text-muted">{__('Period Recovery', 'codeclove-school-management')}</span>
                <span className={cn(
                  'font-bold tabular-nums',
                  recoveryRate >= 90 ? 'text-success' : recoveryRate >= 50 ? 'text-warning' : 'text-danger'
                )}>
                  {recoveryRate}%
                </span>
              </div>
              <div className="h-2 w-full bg-bg-base border border-border/60 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    recoveryRate >= 90 ? 'bg-success' : recoveryRate >= 50 ? 'bg-warning' : 'bg-danger'
                  )}
                  style={{ width: `${Math.min(100, recoveryRate)}%` }}
                />
              </div>
              <p className="text-xs text-text-subtle leading-tight">
                {sprintf(
                  __('%1$s collected of %2$s billed in this period.', 'codeclove-school-management'),
                  formatCurrency(summary.period_collected),
                  formatCurrency(summary.period_billed)
                )}
              </p>
            </div>

            {/* Defaulter report shortcut */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/finance/reports/defaulters')}
              className="w-full text-xs justify-center gap-1.5 mt-2"
            >
              <FileText className="h-3.5 w-3.5" />
              {sprintf(__('View %s', 'codeclove-school-management'), reportLabel)}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── 4. High-Density Activity Ledger (Stripe Style) ─────────── */}
      <div className="rounded-2xl border border-border/70 bg-bg-surface shadow-xs overflow-hidden">
        {/* Ledger Header & Tab Switcher */}
        <div className="p-4 sm:p-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text">{__('Activity Ledger', 'codeclove-school-management')}</h3>
            <p className="text-xs text-text-muted mt-0.5">
              {__('Recent student billings and settlement receipts.', 'codeclove-school-management')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs: All Activity / Invoices / Payments */}
            <div className="inline-flex rounded-lg bg-bg-base border border-border/80 p-0.5">
              <button
                type="button"
                onClick={() => setLedgerTab('all')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all select-none',
                  ledgerTab === 'all'
                    ? 'bg-bg-surface text-text font-semibold shadow-xs'
                    : 'text-text-muted hover:text-text'
                )}
              >
                {__('All Activity', 'codeclove-school-management')}
              </button>
              <button
                type="button"
                onClick={() => setLedgerTab('invoices')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all select-none flex items-center gap-1.5',
                  ledgerTab === 'invoices'
                    ? 'bg-bg-surface text-brand font-semibold shadow-xs'
                    : 'text-text-muted hover:text-text'
                )}
              >
                <Receipt className="h-3.5 w-3.5" />
                {invoiceLabelPlural}
              </button>
              <button
                type="button"
                onClick={() => setLedgerTab('payments')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all select-none flex items-center gap-1.5',
                  ledgerTab === 'payments'
                    ? 'bg-bg-surface text-success font-semibold shadow-xs'
                    : 'text-text-muted hover:text-text'
                )}
              >
                <HandCoins className="h-3.5 w-3.5" />
                {paymentLabelPlural}
              </button>
            </div>

            {/* View Full Ledger Shortcut */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(ledgerTab === 'payments' ? '/finance/payments' : '/finance/invoices')}
              className="text-xs text-text-muted hover:text-brand hidden sm:flex items-center gap-1"
            >
              <span>{ledgerTab === 'payments' ? __('Manage payments', 'codeclove-school-management') : __('Manage invoices', 'codeclove-school-management')}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Tabular Ledger Table */}
        <TableRoot responsiveMode="scroll" containerClassName="border-0 rounded-none shadow-none">
          <Thead>
            <Tr>
              <Th className="w-[180px]">{__('Reference', 'codeclove-school-management')}</Th>
              <Th>{__('Student / Account', 'codeclove-school-management')}</Th>
              <Th className="w-[150px]">{__('Timeline', 'codeclove-school-management')}</Th>
              <Th className="w-[140px]">{__('Channel', 'codeclove-school-management')}</Th>
              <Th className="w-[140px] text-right">{__('Amount', 'codeclove-school-management')}</Th>
              <Th className="w-[120px] text-center">{__('Status', 'codeclove-school-management')}</Th>
              <Th className="w-[50px] text-right"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {activityRows.length === 0 ? (
              <TableEmpty
                colSpan={7}
                message={__('No transactions found', 'codeclove-school-management')}
                description={__('No billing or payment activity recorded for this period.', 'codeclove-school-management')}
              />
            ) : (
              activityRows.map((item) => (
                <Tr
                  key={item.id}
                  onClick={() => navigate(item.targetUrl)}
                  className="cursor-pointer hover:bg-bg-subtle/60 transition-colors"
                >
                  {/* Reference & Type Badge */}
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                        item.type === 'invoice' ? 'bg-brand-dim text-brand' : 'bg-success-dim text-success'
                      )}>
                        {item.type === 'invoice' ? (
                          <Receipt className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-text text-xs tracking-tight truncate">
                          {item.reference}
                        </p>
                        <p className="text-xs text-text-muted uppercase font-medium">
                          {item.type === 'invoice' ? invoiceLabel : __('Payment', 'codeclove-school-management')}
                        </p>
                      </div>
                    </div>
                  </Td>

                  {/* Student Avatar & ID */}
                  <Td>
                    <PersonAvatar
                      name={item.studentName}
                      idNumber={item.studentNumber}
                      size="sm"
                    />
                  </Td>

                  {/* Timeline (Date & Due Date) */}
                  <Td>
                    <div className="text-xs">
                      <p className="font-medium text-text">{formatDate(item.date)}</p>
                      {item.dueDate && (
                        <p className="text-xs text-text-subtle">
                          {sprintf(__('Due %s', 'codeclove-school-management'), formatDate(item.dueDate))}
                        </p>
                      )}
                    </div>
                  </Td>

                  {/* Payment Channel / Method */}
                  <Td>
                    {item.method ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-bg-base border border-border/60 text-text-muted">
                        {getMethodLabel(item.method)}
                      </span>
                    ) : (
                      <span className="text-xs text-text-subtle">{__('Direct billing', 'codeclove-school-management')}</span>
                    )}
                  </Td>

                  {/* Formatted Currency Amount */}
                  <Td className="text-right">
                    <span className={cn(
                      'text-sm font-semibold tabular-nums',
                      item.type === 'payment' ? 'text-success' : 'text-text'
                    )}>
                      {item.type === 'payment' ? `+${formatCurrency(item.amount)}` : formatCurrency(item.amount)}
                    </span>
                  </Td>

                  {/* Status Badge */}
                  <Td className="text-center">
                    <Badge variant={getStatusVariant(item.status)} size="sm">
                      {item.status}
                    </Badge>
                  </Td>

                  {/* Action Link Arrow */}
                  <Td className="text-right">
                    <div className="p-1 rounded text-text-muted hover:text-text inline-flex">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </TableRoot>
      </div>
    </div>
  )
}
