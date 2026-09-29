/**
 * ActivityLogPage — Audit trail viewer.
 * Paginated table of system audit logs with category, search, and date filters.
 * Layout matches existing plugin pages (AdmissionsPage, StudentDirectoryPage).
 */
import { useState, useMemo } from 'react'
import {
  Sparkles,
  Search,
  X,
  ClipboardList,
  Users,
  Wallet,
  CalendarCheck,
  Briefcase,
  Settings,
  Bell,
  AlertTriangle,
} from 'lucide-react'
import { type LucideIcon } from 'lucide-react'
import {
  PageHeader,
  Card,
  CardContent,
  FormField,
  Input,
  Select,
  DatePicker,
  Button,
  Badge,
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableSkeleton,
  TableEmpty,
  EmptyState,
} from '@/components/ui'
import { TablePagination } from '@/components/ui/TablePagination'
import { useActivityLog, type ActivityLogParams, type ActivityLogEntry } from '@/api/activity'
import { useFormatter } from '@/lib/formatter'
import { cn } from '@/lib/utils'
import { __ } from '@/lib/i18n'

// ─── Event metadata ───────────────────────────────────────────────────────────

// ponytail: object lookup — icons already imported, no abstraction
const EVENT_ICON: Partial<Record<string, LucideIcon>> = {
  admission_created:        ClipboardList,
  admission_status_changed: ClipboardList,
  status_change:            ClipboardList,
  student_created:          Users,
  student_updated:          Users,
  payment_recorded:         Wallet,
  invoice_issued:           Wallet,
  staff_member_created:     Briefcase,
  staff_app_created:        Briefcase,
  attendance_taken:         CalendarCheck,
  settings_updated:         Settings,
}

const EVENT_COLORS: Record<string, string> = {
  admission_created:        'text-info',
  admission_status_changed: 'text-brand',
  student_created:          'text-brand',
  invoice_issued:           'text-warning',
  payment_recorded:         'text-success',
  staff_member_created:     'text-purple-500',
  attendance_taken:         'text-emerald-600',
  settings_updated:         'text-text-muted',
  status_change:            'text-brand',
}

const CATEGORY_COLORS: Record<string, 'default' | 'brand' | 'success' | 'warning' | 'info'> = {
  admissions: 'info',
  students:   'brand',
  staff:      'brand',
  finance:    'success',
  attendance: 'info',
  settings:   'warning',
  system:     'default',
}

// ponytail: normalize unknown event_type — replace both _ and . before title-casing
function normalizeEventType(raw: string) {
  return raw.replace(/[_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActivityLogPage({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const { formatDateTime } = useFormatter()

  const [page, setPage]         = useState(1)
  const [perPage, setPerPage]   = useState<number | 'all'>(25)
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const eventLabels: Record<string, string> = useMemo(() => ({
    admission_created:         __('New admission submitted', 'codeclove-school-management'),
    admission_status_changed:  __('Admission status updated', 'codeclove-school-management'),
    student_created:           __('Student record created', 'codeclove-school-management'),
    student_updated:           __('Student profile updated', 'codeclove-school-management'),
    invoice_issued:            __('Invoice issued', 'codeclove-school-management'),
    payment_recorded:          __('Payment recorded', 'codeclove-school-management'),
    staff_member_created:      __('Staff member added', 'codeclove-school-management'),
    staff_app_created:         __('Staff application submitted', 'codeclove-school-management'),
    attendance_taken:          __('Attendance recorded', 'codeclove-school-management'),
    settings_updated:          __('Settings updated', 'codeclove-school-management'),
    status_change:             __('Status updated', 'codeclove-school-management'),
  }), [])

  const categoryLabels: Record<string, string> = useMemo(() => ({
    admissions: __('Admissions', 'codeclove-school-management'),
    students:   __('Students', 'codeclove-school-management'),
    staff:      __('Staff', 'codeclove-school-management'),
    finance:    __('Finance', 'codeclove-school-management'),
    attendance: __('Attendance', 'codeclove-school-management'),
    settings:   __('Settings', 'codeclove-school-management'),
    system:     __('System', 'codeclove-school-management'),
  }), [])

  const params: ActivityLogParams = {
    page,
    per_page: perPage === 'all' ? -1 : perPage,
  }
  if (search)             params.search    = search
  if (category !== 'all') params.category  = category
  if (dateFrom)           params.date_from = dateFrom
  if (dateTo)             params.date_to   = dateTo

  const { data, isLoading, isError, refetch } = useActivityLog(params)
  const items = data?.data ?? []
  const total = data?.pagination?.total ?? 0
  const hasFilters = !!(search || category !== 'all' || dateFrom || dateTo)

  const handleClearFilters = () => {
    setSearch(''); setCategory('all'); setDateFrom(''); setDateTo(''); setPage(1)
  }

  const categoryOptions = [
    { value: 'all', label: __('All categories', 'codeclove-school-management') },
    ...Object.entries(categoryLabels).map(([value, label]) => ({ value, label })),
  ]

  return (
    <div className="space-y-5 w-full">

      {!hideHeader && (
        <PageHeader
          title={__('Activity Log', 'codeclove-school-management')}
          breadcrumbs={[
            { label: __('Dashboard', 'codeclove-school-management'), href: '/dashboard' },
            { label: __('Activity Log', 'codeclove-school-management') },
          ]}
          description={__('Audit trail of system events, actions, and administrative changes.', 'codeclove-school-management')}
        />
      )}

      {/* ── Filter Toolbar — matches Card className="p-4" pattern ─────────── */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">

          {/* Search */}
          <div className="flex-1">
            <FormField label={__('Search', 'codeclove-school-management')}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder={__('Search actor or event…', 'codeclove-school-management')}
                  className="pl-9"
                />
              </div>
            </FormField>
          </div>

          {/* Category */}
          <div className="w-full md:w-48">
            <FormField label={__('Category', 'codeclove-school-management')}>
              <Select
                value={category}
                onValueChange={(val) => { setCategory(val); setPage(1) }}
                options={categoryOptions}
                placeholder={__('All categories', 'codeclove-school-management')}
              />
            </FormField>
          </div>

          {/* Date from */}
          <div className="w-full md:w-40">
            <FormField label={__('From', 'codeclove-school-management')}>
              <DatePicker
                value={dateFrom}
                onChange={(val) => { setDateFrom(val); setPage(1) }}
                placeholder={__('Start date', 'codeclove-school-management')}
              />
            </FormField>
          </div>

          {/* Date to */}
          <div className="w-full md:w-40">
            <FormField label={__('To', 'codeclove-school-management')}>
              <DatePicker
                value={dateTo}
                onChange={(val) => { setDateTo(val); setPage(1) }}
                placeholder={__('End date', 'codeclove-school-management')}
              />
            </FormField>
          </div>

          {/* Clear button — aligned to bottom of FormField rows */}
          {hasFilters && (
            <div className="flex items-center gap-2 flex-shrink-0 self-end pb-0.5">
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                className="text-xs text-text-muted hover:text-text gap-1"
              >
                <X size={12} />
                {__('Clear Filters', 'codeclove-school-management')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* ── Table Card — matches Card className="shadow-sm" pattern ───────── */}
      <Card className="shadow-sm">
        <CardContent className="p-0 overflow-hidden">
          {isError ? (
            <EmptyState
              title={__('Could not load activity log', 'codeclove-school-management')}
              description={__('An error occurred while fetching the logs.', 'codeclove-school-management')}
              icon={AlertTriangle}
              action={<Button size="sm" onClick={() => refetch()}>{__('Try again', 'codeclove-school-management')}</Button>}
            />
          ) : (
            <TableRoot>
              <Thead>
                <Tr>
                  <Th className="w-10 pl-5 pr-2" />
                  <Th priority="high">{__('Event', 'codeclove-school-management')}</Th>
                  <Th type="badge" priority="medium">{__('Category', 'codeclove-school-management')}</Th>
                  <Th priority="high">{__('Actor', 'codeclove-school-management')}</Th>
                  <Th priority="high">{__('Date & Time', 'codeclove-school-management')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {isLoading ? (
                  <TableSkeleton columns={5} rows={12} />
                ) : items.length === 0 ? (
                  <TableEmpty
                    colSpan={5}
                    icon={Sparkles}
                    message={__('No activity found', 'codeclove-school-management')}
                    description={
                      hasFilters
                        ? __('Try adjusting your search query or filters.', 'codeclove-school-management')
                        : __('Activity will appear here once events are recorded.', 'codeclove-school-management')
                    }
                  />
                ) : (
                  items.map((item: ActivityLogEntry) => {
                    const EventIcon = EVENT_ICON[item.event_type] ?? Bell
                    const label     = item.label
                      ?? eventLabels[item.event_type]
                      ?? normalizeEventType(item.event_type)
                    const actorName = item.actor_name || __('System', 'codeclove-school-management')

                    return (
                      <Tr key={item.id}>
                        {/* Event icon badge */}
                        <Td className="pl-5 pr-2 w-10">
                          <div className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                            'bg-bg-base border border-border'
                          )}>
                            <EventIcon
                              size={13}
                              className={EVENT_COLORS[item.event_type] ?? 'text-text-subtle'}
                            />
                          </div>
                        </Td>

                        {/* Event label + raw type */}
                        <Td priority="high">
                          <p className="text-xs font-semibold text-text leading-snug">{label}</p>
                          <p className="text-xs text-text-subtle mt-0.5 font-mono">{item.event_type}</p>
                        </Td>

                        {/* Category badge */}
                        <Td type="badge" priority="medium">
                          <Badge
                            variant={CATEGORY_COLORS[item.event_category] ?? 'default'}
                            size="sm"
                          >
                            {categoryLabels[item.event_category] ?? item.event_category}
                          </Badge>
                        </Td>

                        {/* Actor with initials avatar */}
                        <Td priority="high">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-brand-dim border border-brand/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-2xs font-bold text-brand leading-none select-none">
                                {initials(actorName)}
                              </span>
                            </div>
                            <span className="text-xs text-text truncate">{actorName}</span>
                          </div>
                        </Td>

                        {/* Timestamp */}
                        <Td priority="high" className="text-xs text-text-muted tabular-nums">
                          {formatDateTime(item.created_at)}
                        </Td>
                      </Tr>
                    )
                  })
                )}
              </Tbody>
            </TableRoot>
          )}
        </CardContent>

        {/* ── Pagination — matches px-6 py-4 pattern from other pages ──────── */}
        {!isLoading && !isError && (
          <TablePagination
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
          />
        )}
      </Card>
    </div>
  )
}
