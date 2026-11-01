/**
 * ExamsListPage — Master examination list, publishing, and workflow navigation.
 *
 * Provides:
 *   - Search, session & status filtering ('all', 'draft', 'published').
 *   - Unified DataTable architecture with built-in pagination, sorting, and empty states.
 *   - Responsive columns adhering to codeclove-ui-ux standards.
 *   - Action links to Dedicated Create Exam page, Timetable, Marks Entry, Reports, and Publish toggling.
 */
import { useState, useMemo, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  GraduationCap,
  Plus,
  CalendarDays,
  CheckCircle2,
  FileEdit,
  Trash2,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  MoreVertical,
  Calendar,
} from 'lucide-react'
import {
  useExams,
  useDeleteExam,
  usePublishExam,
  type Exam,
} from '@/api/exams'
import { useSessions } from '@/api/academics'
import { useConfirm } from '@/lib/confirm'
import { useToast } from '@/lib/toast'
import { useFormatter } from '@/lib/formatter'
import { useSession } from '@/lib/session-context'
import { ROUTES } from '@/lib/constants'
import { __, sprintf } from '@/lib/i18n'
import { useTableState } from '@/lib/useTableState'
import {
  PageHeader,
  FilterBar,
  Button,
  Badge,
  Alert,
  DataTable,
  type DataTableColumn,
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  Select,
} from '@/components/ui'

type ExamStatusFilter = 'all' | 'draft' | 'published'

export default function ExamsListPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const { formatDate } = useFormatter()
  const { session } = useSession()
  // ─── Table State & Pagination ─────────────────────────────────────────────
  const table = useTableState({
    defaultPerPage: 10,
    defaultOrderBy: 'starts_on',
    defaultOrder: 'desc',
  })

  // ─── Filter State ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExamStatusFilter>('all')

  // ─── Data Queries ─────────────────────────────────────────────────────────
  const {
    data: exams = [],
    isLoading: isLoadingExams,
    isError: isErrorExams,
    refetch: refetchExams,
  } = useExams()

  const { data: sessionsResponse } = useSessions({ per_page: 50 })
  const sessions = useMemo(() => sessionsResponse?.data ?? [], [sessionsResponse])

  // ─── Mutations ────────────────────────────────────────────────────────────
  const deleteExamMutation = useDeleteExam()
  const publishExamMutation = usePublishExam()

  // ─── Filtered Data ────────────────────────────────────────────────────────
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      // Scope to active session selected in the master header
      if (session?.id && exam.academic_session_id && exam.academic_session_id !== session.id) {
        return false
      }

      // Status filter
      if (statusFilter !== 'all' && exam.status !== statusFilter) {
        return false
      }

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase().trim()
        const nameMatch = exam.name.toLowerCase().includes(query)
        const codeMatch = exam.code ? exam.code.toLowerCase().includes(query) : false
        const sessionMatch = exam.academic_session_name
          ? exam.academic_session_name.toLowerCase().includes(query)
          : false
        return nameMatch || codeMatch || sessionMatch
      }

      return true
    })
  }, [exams, session?.id, statusFilter, search])

  // ─── Sorting & Pagination ─────────────────────────────────────────────────
  const sortedExams = useMemo(() => {
    if (!table.orderby) return filteredExams
    return [...filteredExams].sort((a, b) => {
      let aVal: unknown
      let bVal: unknown
      if (table.orderby === 'name') {
        aVal = a.name
        bVal = b.name
      } else if (table.orderby === 'starts_on') {
        aVal = a.starts_on
        bVal = b.starts_on
      } else if (table.orderby === 'status') {
        aVal = a.status
        bVal = b.status
      } else {
        aVal = (a as unknown as Record<string, unknown>)[table.orderby]
        bVal = (b as unknown as Record<string, unknown>)[table.orderby]
      }
      if (aVal === bVal) return 0
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      const comparison = String(aVal).localeCompare(String(bVal))
      return table.order === 'asc' ? comparison : -comparison
    })
  }, [filteredExams, table.orderby, table.order])

  const paginatedExams = useMemo(() => {
    if (table.perPage === 'all') return sortedExams
    const start = (table.page - 1) * table.perPage
    return sortedExams.slice(start, start + table.perPage)
  }, [sortedExams, table.page, table.perPage])

  const statusOptions = useMemo(() => [
    { value: 'all', label: __('All Statuses', 'codeclove-school-management') },
    { value: 'draft', label: __('Draft', 'codeclove-school-management') },
    { value: 'published', label: __('Published', 'codeclove-school-management') },
  ], [])

  const handleTogglePublish = useCallback((exam: Exam) => {
    const isPublishing = exam.status !== 'published'
    publishExamMutation.mutate(
      { id: exam.id, publish: isPublishing },
      {
        onSuccess: () => {
          toast.success(
            isPublishing
              ? sprintf(
                  __('Exam "%s" published successfully.', 'codeclove-school-management'),
                  exam.name
                )
              : sprintf(
                  __('Exam "%s" reverted to draft.', 'codeclove-school-management'),
                  exam.name
                )
          )
        },
        onError: (err) => {
          toast.error(err.message || __('Failed to update exam status.', 'codeclove-school-management'))
        },
      }
    )
  }, [publishExamMutation, toast])

  const handleDeleteExam = useCallback(async (exam: Exam) => {
    const confirmed = await confirm({
      title: __('Delete Examination', 'codeclove-school-management'),
      message: sprintf(
        __(
          'Are you sure you want to delete "%s"? This action will remove all scheduled papers and recorded marks for this examination.',
          'codeclove-school-management'
        ),
        exam.name
      ),
      variant: 'danger',
      confirmText: __('Delete Exam', 'codeclove-school-management'),
    })

    if (confirmed) {
      deleteExamMutation.mutate(exam.id, {
        onSuccess: () => {
          toast.success(
            sprintf(
              __('Examination "%s" deleted.', 'codeclove-school-management'),
              exam.name
            )
          )
        },
        onError: (err) => {
          toast.error(err.message || __('Failed to delete exam.', 'codeclove-school-management'))
        },
      })
    }
  }, [confirm, deleteExamMutation, toast])

  // Active filter count for clear button
  const activeFiltersCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (search.trim() ? 1 : 0)

  const handleClearFilters = useCallback(() => {
    setSearch('')
    setStatusFilter('all')
    table.resetPage()
  }, [table])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    table.resetPage()
  }

  const handleStatusChange = (val: ExamStatusFilter) => {
    setStatusFilter(val)
    table.resetPage()
  }

  // ─── Table Columns Definition ─────────────────────────────────────────────
  const columns = useMemo<DataTableColumn<Exam>[]>(() => [
    {
      key: 'name',
      header: __('Exam Name', 'codeclove-school-management'),
      type: 'primary',
      sortable: true,
      sortKey: 'name',
      render: (exam) => {
        const sessionLabel =
          exam.academic_session_name ||
          sessions.find((s) => s.id === exam.academic_session_id)?.name ||
          __('Session', 'codeclove-school-management')

        const termLabel = exam.academic_term_name || __('Annual / Full', 'codeclove-school-management')

        return (
          <div className="flex flex-col py-0.5">
            <Link
              to={`/exams/${exam.id}`}
              className="font-semibold text-text text-sm hover:text-brand hover:underline transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {exam.name}
            </Link>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-text-muted flex-wrap">
              <span>{sessionLabel} • {termLabel}</span>
              {exam.code && (
                <span className="text-2xs font-mono px-1 rounded bg-bg-surface border border-border text-text-subtle">
                  {exam.code}
                </span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'starts_on',
      header: __('Dates', 'codeclove-school-management'),
      type: 'date',
      sortable: true,
      sortKey: 'starts_on',
      render: (exam) => (
        <div className="flex items-center gap-1.5 text-xs text-text-muted whitespace-nowrap">
          <Calendar size={13} className="text-text-subtle flex-shrink-0" />
          <span>
            {formatDate(exam.starts_on)} – {formatDate(exam.ends_on)}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: __('Status', 'codeclove-school-management'),
      type: 'badge',
      align: 'center',
      sortable: true,
      sortKey: 'status',
      render: (exam) => (
        <div className="flex flex-col items-center gap-1">
          {exam.status === 'published' ? (
            <Badge variant="success" dot size="sm">
              {__('Published', 'codeclove-school-management')}
            </Badge>
          ) : (
            <Badge variant="warning" dot size="sm">
              {__('Draft', 'codeclove-school-management')}
            </Badge>
          )}
          <span className="text-3xs font-mono text-text-subtle">
            {exam.subjects_count !== undefined && exam.subjects_count > 0
              ? sprintf(__('%d subjects', 'codeclove-school-management'), exam.subjects_count)
              : __('0 subjects', 'codeclove-school-management')}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: __('Actions', 'codeclove-school-management'),
      type: 'actions',
      align: 'right',
      render: (exam) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            align="end"
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-text-muted hover:text-text"
                aria-label={__('Exam options', 'codeclove-school-management')}
              >
                <MoreVertical size={15} />
              </Button>
            }
          >
            <DropdownItem
              icon={GraduationCap}
              label={__('Open Exam', 'codeclove-school-management')}
              onClick={() => navigate(`/exams/${exam.id}`)}
            />
            <DropdownSeparator />
            <DropdownItem
              icon={CalendarDays}
              label={__('Exam Schedule', 'codeclove-school-management')}
              onClick={() => navigate(`/exams/${exam.id}/timetable`)}
            />
            <DropdownItem
              icon={FileSpreadsheet}
              label={__('Enter Marks', 'codeclove-school-management')}
              onClick={() => navigate(`/exams/${exam.id}/marks`)}
            />
            <DropdownItem
              icon={FileText}
              label={__('Results & Report Cards', 'codeclove-school-management')}
              onClick={() => navigate(`/exams/${exam.id}/reports`)}
            />
            <DropdownSeparator />
            <DropdownItem
              icon={FileEdit}
              label={__('Edit Exam', 'codeclove-school-management')}
              onClick={() => navigate(`/exams/${exam.id}/edit`)}
            />
            <DropdownItem
              icon={exam.status === 'published' ? RotateCcw : CheckCircle2}
              label={
                exam.status === 'published'
                  ? __('Revert to Draft', 'codeclove-school-management')
                  : __('Publish Exam', 'codeclove-school-management')
              }
              onClick={() => handleTogglePublish(exam)}
            />
            <DropdownSeparator />
            <DropdownItem
              icon={Trash2}
              label={__('Delete Exam', 'codeclove-school-management')}
              danger
              onClick={() => handleDeleteExam(exam)}
            />
          </Dropdown>
        </div>
      ),
    },
  ], [sessions, formatDate, navigate, handleTogglePublish, handleDeleteExam])

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        title={__('Examinations', 'codeclove-school-management')}
        description={__(
          'Manage school examinations, schedules, grading scales, and results.',
          'codeclove-school-management'
        )}
        breadcrumbs={[
          { label: __('Examinations', 'codeclove-school-management'), href: ROUTES.EXAMS },
          { label: __('All Exams', 'codeclove-school-management') },
        ]}
        actions={
          <Button onClick={() => navigate(ROUTES.EXAM_NEW)} className="gap-2 font-semibold">
            <Plus size={16} />
            <span>{__('Create Exam', 'codeclove-school-management')}</span>
          </Button>
        }
      />

      {/* ─── Error Alert State ──────────────────────────────────────────────── */}
      {isErrorExams && (
        <Alert
          variant="danger"
          title={__('Failed to Load Examinations', 'codeclove-school-management')}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <p className="text-xs">
              {__('Could not retrieve examinations records. Please check network connection and try again.', 'codeclove-school-management')}
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => refetchExams()}
              className="h-7 text-xs shrink-0 self-start sm:self-auto"
            >
              {__('Retry', 'codeclove-school-management')}
            </Button>
          </div>
        </Alert>
      )}
      {/* ─── Filter Bar ────────────────────────────────────────────────────── */}
      <FilterBar
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder={__('Search exam name or code...', 'codeclove-school-management')}
        activeFilterCount={activeFiltersCount}
        onClearAll={handleClearFilters}
      >
        <Select
          value={statusFilter}
          onValueChange={(val) => handleStatusChange(val as ExamStatusFilter)}
          options={statusOptions}
          className="w-40 text-xs"
        />
      </FilterBar>

      {/* ─── Exams Table ───────────────────────────────────────────────────── */}
      <DataTable<Exam>
        data={paginatedExams}
        columns={columns}
        table={table}
        total={filteredExams.length}
        isLoading={isLoadingExams}
        onRowClick={(exam) => navigate(`/exams/${exam.id}`)}
        emptyState={{
          icon: GraduationCap,
          message:
            activeFiltersCount > 0
              ? __('No exams match your filters.', 'codeclove-school-management')
              : __('No examinations created yet.', 'codeclove-school-management'),
          description:
            activeFiltersCount > 0
              ? __('Try resetting search, session, or status filters.', 'codeclove-school-management')
              : __(
                  'Click "Create Exam" to set up your first examination session.',
                  'codeclove-school-management'
                ),
          action:
            activeFiltersCount > 0 ? (
              <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                {__('Clear Filters', 'codeclove-school-management')}
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate(ROUTES.EXAM_NEW)} className="gap-1.5">
                <Plus size={14} />
                <span>{__('Create Exam', 'codeclove-school-management')}</span>
              </Button>
            ),
        }}
      />
    </div>
  )
}
