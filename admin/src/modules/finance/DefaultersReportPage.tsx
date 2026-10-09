import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, FileText, Search, X, Lock, CheckCircle2, TrendingUp, Clock, Calendar, Users, Sparkles, ArrowRight } from 'lucide-react'
import { __, _n, sprintf } from '@/lib/i18n'
import { useDefaultersReport, type DefaulterRow } from '@/api/finance'
import { useUnits } from '@/api/academics'
import { useFormatter } from '@/lib/formatter'
import { useSession } from '@/lib/session-context'
import { useLabels } from '@/lib/labels'
import { useDebounce } from '@/lib/useDebounce'
import { useTableState } from '@/lib/useTableState'
import {
  Button,
  PageHeader,
  Card,
  FormField,
  Input,
  Select,
  DataTable,
  StatCard,
  type DataTableColumn,
} from '@/components/ui'

export default function DefaultersReportPage() {
  const isPro = window.CodeCloveConfig?.isPro ?? false
  const navigate = useNavigate()
  const { formatCurrency, formatDate } = useFormatter()
  const { session } = useSession()
  const { getLabel } = useLabels()
  const unitLabelSingular = getLabel('academic_unit', false, __('Class / Grade', 'codeclove-school-management'))
  const unitLabelPlural = getLabel('academic_unit', true, __('Classes', 'codeclove-school-management'))
  const invoiceLabel = getLabel('invoice', false, __('Invoice', 'codeclove-school-management'))
  const pageTitle = sprintf(__('%s Defaulters Report', 'codeclove-school-management'), invoiceLabel)
  const pageBreadcrumb = __('Defaulters Report', 'codeclove-school-management')
  const [unitId, setUnitId] = useState('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [daysOverdueMin, setDaysOverdueMin] = useState('30')
  const table = useTableState({ defaultPerPage: 25 })

  // Fetch Class Levels
  const { data: unitsData } = useUnits({
    session_id: session?.id,
    per_page: 100,
  })
  const units = unitsData?.data || []

  // Reset filters on session change
  useEffect(() => {
    setUnitId('all')
    setSearch('')
    setDaysOverdueMin('30')
    table.resetPage()
  }, [session?.id])

  // Reset page when debounced search changes
  useEffect(() => {
    table.resetPage()
  }, [debouncedSearch])

  // Queries
  const { data: reportData, isLoading, isError, refetch } = useDefaultersReport(
    {
      academic_session_id: session?.id,
      academic_unit_id: unitId && unitId !== 'all' ? Number(unitId) : undefined,
      days_overdue_min: daysOverdueMin ? Number(daysOverdueMin) : undefined,
      search: debouncedSearch || undefined,
      page: table.page,
      per_page: table.perPage === 'all' ? -1 : table.perPage,
    },
    { enabled: isPro }
  )
  const defaulters = reportData?.data || []
  const total = reportData?.total || 0

  const columns = useMemo<DataTableColumn<DefaulterRow>[]>(
    () => [
      {
        key: 'student_name',
        header: __('Student Name', 'codeclove-school-management'),
        type: 'primary',
        render: (row) => (
          <div>
            <span>{row.student_first_name} {row.student_last_name}</span>
            <div className="text-2xs text-text-muted font-mono">{row.student_number}</div>
          </div>
        ),
      },
      {
        key: 'academic_unit_name',
        header: unitLabelSingular,
        render: (row) => row.academic_unit_name || 'N/A',
      },
      {
        key: 'invoice_number',
        header: __('Invoice #', 'codeclove-school-management'),
        type: 'code',
      },
      {
        key: 'due_date',
        header: __('Due Date', 'codeclove-school-management'),
        type: 'date',
        render: (row) => formatDate(row.due_date),
      },
      {
        key: 'days_overdue',
        header: __('Days Overdue', 'codeclove-school-management'),
        type: 'number',
        className: 'text-danger font-medium',
        render: (row) => sprintf(_n('%d day', '%d days', row.days_overdue, 'codeclove-school-management'), row.days_overdue),
      },
      {
        key: 'total_minor',
        header: __('Total Billed', 'codeclove-school-management'),
        type: 'number',
        render: (row) => formatCurrency(row.total_minor),
      },
      {
        key: 'balance_minor',
        header: __('Outstanding Balance', 'codeclove-school-management'),
        type: 'number',
        className: 'text-danger font-semibold',
        render: (row) => formatCurrency(row.balance_minor),
      },
      {
        key: 'actions',
        header: __('Actions', 'codeclove-school-management'),
        type: 'actions',
        render: (row) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/finance/invoices/' + row.invoice_id)}
              className="h-8 w-8 text-text-subtle hover:text-brand"
              title={__('View Invoice Details', 'codeclove-school-management')}
            >
              <Eye size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [unitLabelSingular, formatDate, formatCurrency, navigate]
  )

  if (!isPro) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={__('Fee Defaulters Report', 'codeclove-school-management')}
          description={__('Identify overdue student balances, aging receivables, and collection arrears across classes.', 'codeclove-school-management')}
          breadcrumbs={[
            { label: __('Finance', 'codeclove-school-management'), href: '/finance' },
            { label: __('Invoices', 'codeclove-school-management'), href: '/finance/invoices' },
            { label: pageBreadcrumb },
          ]}
          onBack={() => navigate('/finance/invoices')}
          actions={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/25">
              <Lock className="w-3.5 h-3.5" />
              {__('Pro Feature', 'codeclove-school-management')}
            </span>
          }
        />

        {/* Preview KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={__('Total Overdue', 'codeclove-school-management')}
            value={formatCurrency(4825000)}
            icon={TrendingUp}
            iconBg="bg-danger-dim"
            iconColor="text-danger"
            subtext={__('Across all academic classes', 'codeclove-school-management')}
          />
          <StatCard
            label={__('30+ Days Arrears', 'codeclove-school-management')}
            value={formatCurrency(2850000)}
            icon={Clock}
            iconBg="bg-amber-500/15"
            iconColor="text-amber-500"
            subtext={__('Short-term pending invoices', 'codeclove-school-management')}
          />
          <StatCard
            label={__('60+ Days Arrears', 'codeclove-school-management')}
            value={formatCurrency(1975000)}
            icon={Calendar}
            iconBg="bg-danger-dim"
            iconColor="text-danger"
            subtext={__('Critical recovery threshold', 'codeclove-school-management')}
          />
          <StatCard
            label={__('Defaulters Count', 'codeclove-school-management')}
            value={sprintf(__('%d Students', 'codeclove-school-management'), 34)}
            icon={Users}
            iconBg="bg-brand-dim"
            iconColor="text-brand"
            subtext={__('Students with unpaid terms', 'codeclove-school-management')}
          />
        </div>

        {/* Blurred Sample Table with In-Flow Glassmorphism Lock Card */}
        <div className="relative rounded-2xl border border-border bg-bg-elevated overflow-hidden shadow-xs p-4 sm:p-8 flex items-center justify-center min-h-[520px]">
          {/* Blurred Background Table Mockup */}
          <div className="absolute inset-0 p-5 sm:p-6 filter blur-[6px] opacity-30 select-none pointer-events-none space-y-3" aria-hidden="true" tabIndex={-1}>
            <div className="flex items-center justify-between pb-4 border-b border-border/80">
              <div className="h-8 w-48 bg-bg-surface rounded-lg" />
              <div className="flex gap-2">
                <div className="h-8 w-24 bg-bg-surface rounded-lg" />
                <div className="h-8 w-24 bg-bg-surface rounded-lg" />
              </div>
            </div>
            <div className="space-y-2.5 pt-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-bg-surface/70 rounded-lg flex items-center justify-between px-4">
                  <div className="h-4 w-32 bg-border/80 rounded" />
                  <div className="h-4 w-20 bg-border/60 rounded" />
                  <div className="h-4 w-24 bg-border/60 rounded" />
                  <div className="h-4 w-16 bg-danger/40 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Semi-transparent Backdrop Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-bg-base/30 via-bg-base/50 to-bg-base/70 backdrop-blur-[1px] pointer-events-none" />

          {/* In-Flow Active Lock Card (Never Clipped) */}
          <div className="relative z-10 max-w-xl w-full p-6 sm:p-8 rounded-2xl bg-bg-elevated/95 border border-border shadow-2xl text-center backdrop-blur-md my-2">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mx-auto mb-4 text-amber-500 shadow-xs">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-text mb-2 tracking-tight">
              {__('Fee Defaulters & Overdue Auditing is a Pro Feature', 'codeclove-school-management')}
            </h2>
            <p className="text-sm text-text-muted max-w-md mx-auto mb-6 leading-relaxed">
              {__(
                'Track overdue student tuition fees, calculate aging debt buckets, generate student fee balance statements, and trigger automated parent recovery notices.',
                'codeclove-school-management'
              )}
            </p>

            <div className="text-left bg-bg-surface/80 rounded-xl p-4 border border-border/80 mb-6 space-y-2.5">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-text">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{__('Overdue breakdown by Class, Section, and Term', 'codeclove-school-management')}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-text">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{__('Aging analysis buckets (30, 60, 90+ days overdue)', 'codeclove-school-management')}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-text">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{__('Direct PDF & CSV export for administrative collection', 'codeclove-school-management')}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-text">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{__('Integrated SMS & WhatsApp payment reminders', 'codeclove-school-management')}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <Button
                variant="default"
                size="lg"
                onClick={() => navigate('/pro-upgrade?feature=defaulters')}
                className="w-full sm:w-auto gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-md"
              >
                <Sparkles className="w-4 h-4 text-amber-100" />
                <span>{__('Upgrade to CodeClove Pro', 'codeclove-school-management')}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate('/finance/invoices')}
                className="w-full sm:w-auto"
              >
                {__('View Invoices', 'codeclove-school-management')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        description={__('List of students with outstanding unpaid or partially paid overdue invoices.', 'codeclove-school-management')}
        breadcrumbs={[
          { label: __('Finance', 'codeclove-school-management') },
          { label: __('Dashboard', 'codeclove-school-management'), href: '/finance' },
          { label: pageBreadcrumb },
        ]}
        onBack={() => navigate('/finance')}
      />

      {/* Filters Card */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <FormField label={__('Search Students', 'codeclove-school-management')}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    type="text"
                    placeholder={__('Search by student name, number, or invoice #...', 'codeclove-school-management')}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      table.resetPage()
                    }}
                    className="pl-9"
                  />
                </div>
              </FormField>
            </div>

            <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
              <FormField label={unitLabelSingular}>
                <Select
                  value={unitId}
                  onValueChange={(val) => {
                    setUnitId(val)
                    table.resetPage()
                  }}
                  placeholder={sprintf(__('All %s', 'codeclove-school-management'), unitLabelPlural.toLowerCase())}
                  options={[
                    { value: 'all', label: sprintf(__('All %s', 'codeclove-school-management'), unitLabelPlural.toLowerCase()) },
                    ...units.map((u) => ({ value: String(u.id), label: u.name })),
                  ]}
                />
              </FormField>
            </div>
            <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
              <FormField label={__('Minimum Days Overdue', 'codeclove-school-management')}>
                <Input
                  type="number"
                  min="0"
                  value={daysOverdueMin}
                  onChange={(e) => {
                    setDaysOverdueMin(e.target.value)
                    table.resetPage()
                  }}
                  placeholder={__('e.g. 30', 'codeclove-school-management')}
                  className="font-mono text-sm"
                />
              </FormField>
            </div>

            <div className="flex items-center gap-2 h-9">
              {(search || unitId || daysOverdueMin !== '30') && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch('')
                    setUnitId('all')
                    setDaysOverdueMin('30')
                    table.resetPage()
                  }}
                  className="text-xs text-text-muted hover:text-text gap-1"
                >
                  <X size={12} />
                  {__('Clear Filters', 'codeclove-school-management')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Report Table */}
      <DataTable<DefaulterRow>
        columns={columns}
        data={defaulters}
        table={table}
        total={total}
        loading={isLoading}
        isLoading={isLoading}
        error={isError}
        isError={isError}
        errorMessage={__('Error Loading Report', 'codeclove-school-management')}
        onRetry={() => refetch()}
        onRowClick={(row) => navigate(`/finance/invoices/${row.invoice_id}`)}
        keyExtractor={(row) => row.invoice_id}
        emptyMessage={__('No Defaulters Found', 'codeclove-school-management')}
        emptyState={{
          message: __('No Defaulters Found', 'codeclove-school-management'),
          description: __('Hooray! No student matches the defaulter criteria for this academic session.', 'codeclove-school-management'),
          icon: FileText,
        }}
      />
    </div>
  )
}
