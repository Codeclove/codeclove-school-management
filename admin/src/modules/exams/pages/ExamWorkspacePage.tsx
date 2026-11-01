/**
 * ExamWorkspacePage — Unified workspace for an Examination cycle.
 *
 * Houses the 3 essential operational tabs:
 *   1. Date Sheet & Timetable (subject papers, dates, timings, max/pass marks)
 *   2. Marks Entry (high-density spreadsheet marks entry grid)
 *   3. Reports & Tabulation (class tabulation ledger & printable report cards)
 *
 * Pinning the active examination context eliminates redundant multi-dropdown
 * exam selectors across every child screen.
 */
import { useMemo } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  PenLine,
  TableProperties,
  GraduationCap,
  Calendar,
  FileEdit,
  CheckCircle2,
  RotateCcw,
  ArrowLeft,
  FileCheck2,
  BookOpen,
} from 'lucide-react'
import { useExam, usePublishExam } from '@/api/exams'
import { useFormatter } from '@/lib/formatter'
import { useToast } from '@/lib/toast'
import { ROUTES } from '@/lib/constants'
import { __, sprintf } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  PageHeader,
  Button,
  Badge,
  Skeleton,
  Card,
  CardContent,
  EmptyState,
} from '@/components/ui'
import ExamTimetablePage from './ExamTimetablePage'
import ExamMarksPage from './ExamMarksPage'
import ExamReportsPage from './ExamReportsPage'
import ExamAdmitCardsPage from './ExamAdmitCardsPage'
import ExamProgressMatrix from '../components/ExamProgressMatrix'

type WorkspaceTab = 'overview' | 'timetable' | 'admit-cards' | 'marks' | 'tabulation' | 'report-cards'

export default function ExamWorkspacePage() {
  const { id, tab: routeTab } = useParams<{ id: string; tab?: string }>()
  const [searchParams] = useSearchParams()
  const examId = Number(id) || 0
  const navigate = useNavigate()
  const toast = useToast()
  const { formatDate } = useFormatter()

  const activeTab: WorkspaceTab = useMemo(() => {
    if (routeTab === 'overview') return 'overview'
    if (routeTab === 'timetable' || routeTab === 'schedule') return 'timetable'
    if (routeTab === 'admit-cards' || routeTab === 'admit_cards' || routeTab === 'hall-tickets') return 'admit-cards'
    if (routeTab === 'marks') return 'marks'
    if (routeTab === 'tabulation') return 'tabulation'
    if (routeTab === 'report-cards' || routeTab === 'report_cards') return 'report-cards'
    if (routeTab === 'reports') {
      const qTab = searchParams.get('tab')
      return qTab === 'report_card' ? 'report-cards' : 'tabulation'
    }
    return 'overview'
  }, [routeTab, searchParams])

  // ─── Query Exam Data ────────────────────────────────────────────────────────
  const { data: exam, isLoading, isError } = useExam(examId)
  const publishExamMutation = usePublishExam()

  const handleTogglePublish = () => {
    if (!exam) return
    const isPublishing = exam.status !== 'published'
    publishExamMutation.mutate(
      { id: exam.id, publish: isPublishing },
      {
        onSuccess: () => {
          toast.success(
            isPublishing
              ? sprintf(__('Exam "%s" published successfully.', 'codeclove-school-management'), exam.name)
              : sprintf(__('Exam "%s" reverted to draft.', 'codeclove-school-management'), exam.name)
          )
        },
        onError: (err) => {
          toast.error(err.message || __('Failed to update exam status.', 'codeclove-school-management'))
        },
      }
    )
  }

  const handleTabChange = (nextTab: WorkspaceTab) => {
    navigate(`/exams/${examId}/${nextTab}`)
  }

  const tabs = [
    {
      id: 'overview' as const,
      label: __('Overview', 'codeclove-school-management'),
      icon: LayoutDashboard,
    },
    {
      id: 'timetable' as const,
      label: __('Exam Schedule', 'codeclove-school-management'),
      icon: CalendarDays,
    },
    {
      id: 'admit-cards' as const,
      label: __('Admit Cards', 'codeclove-school-management'),
      icon: FileCheck2,
    },
    {
      id: 'marks' as const,
      label: __('Enter Marks', 'codeclove-school-management'),
      icon: PenLine,
    },
    {
      id: 'tabulation' as const,
      label: __('Class Tabulation', 'codeclove-school-management'),
      icon: TableProperties,
    },
    {
      id: 'report-cards' as const,
      label: __('Student Report Cards', 'codeclove-school-management'),
      icon: GraduationCap,
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-7 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError || !exam) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={CalendarDays}
          title={__('Examination Not Found', 'codeclove-school-management')}
          description={__('The requested examination cycle could not be located or may have been deleted.', 'codeclove-school-management')}
          action={
            <Button onClick={() => navigate(ROUTES.EXAMS)} className="gap-2">
              <ArrowLeft size={16} />
              <span>{__('Back to Examinations', 'codeclove-school-management')}</span>
            </Button>
          }
        />
      </div>
    )
  }

  const sessionLabel = exam.academic_session_name || __('Academic Session', 'codeclove-school-management')
  const termLabel = exam.academic_term_name || __('Annual / Full Term', 'codeclove-school-management')

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumbs & Header ────────────────────────────────────────── */}
      <PageHeader
        title={exam.name}
        description={
          exam.description ||
          __('Manage exam schedules, enter student marks, view class tabulation, and print report cards.', 'codeclove-school-management')
        }
        breadcrumbs={[
          { label: __('Examinations', 'codeclove-school-management'), href: ROUTES.EXAMS },
          { label: exam.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/exams/${exam.id}/edit`)}
              className="gap-1.5 h-8 text-xs"
            >
              <FileEdit size={14} />
              <span>{__('Edit Exam', 'codeclove-school-management')}</span>
            </Button>

            <Button
              variant={exam.status === 'published' ? 'secondary' : 'default'}
              size="sm"
              onClick={handleTogglePublish}
              disabled={publishExamMutation.isPending}
              className="gap-1.5 h-8 text-xs font-semibold"
            >
              {exam.status === 'published' ? (
                <>
                  <RotateCcw size={14} />
                  <span>{__('Revert to Draft', 'codeclove-school-management')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>{__('Publish Exam', 'codeclove-school-management')}</span>
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* ─── Pinned Exam Context Strip ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bg-elevated px-4 sm:px-5 py-3 rounded-xl border border-border shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Status Badge */}
          {exam.status === 'published' ? (
            <Badge variant="success" dot size="sm" className="font-semibold px-2 py-0.5">
              {__('Published', 'codeclove-school-management')}
            </Badge>
          ) : (
            <Badge variant="warning" dot size="sm" className="font-semibold px-2 py-0.5">
              {__('Draft', 'codeclove-school-management')}
            </Badge>
          )}

          {/* Session & Term */}
          <span className="font-semibold text-text">{sessionLabel}</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-bg-surface border border-border/70 text-text-muted text-2xs font-medium">
            {termLabel}
          </span>

          {/* Date Window */}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-surface border border-border/70 text-text-subtle text-2xs font-medium">
            <Calendar size={12} className="text-brand shrink-0" />
            <span>
              {formatDate(exam.starts_on)} – {formatDate(exam.ends_on)}
            </span>
          </span>

          {/* Short Code if present */}
          {exam.code && (
            <span className="font-mono text-3xs font-semibold px-1.5 py-0.5 rounded-md bg-bg-surface border border-border/70 text-text-muted">
              {exam.code}
            </span>
          )}

          {/* Scheduled Papers Count */}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-surface border border-border/70 text-text-subtle text-2xs font-medium font-mono">
            <BookOpen size={12} className="text-text-subtle shrink-0" />
            <span>
              {sprintf(__('%d subjects scheduled', 'codeclove-school-management'), exam.subjects_count ?? 0)}
            </span>
          </span>
        </div>

        <Link
          to={ROUTES.EXAMS}
          className="text-xs text-text-subtle hover:text-brand inline-flex items-center gap-1.5 font-medium transition-colors shrink-0"
        >
          <ArrowLeft size={13} />
          <span>{__('All Exams', 'codeclove-school-management')}</span>
        </Link>
      </div>

      {/* ─── Unified Content Card with Embedded Tab Navigation Header ────── */}
      <div className="bg-bg-elevated border border-border rounded-xl shadow-xs overflow-hidden">
        {/* Card Header: Tab Navigation Bar */}
        <div className="border-b border-border px-4 sm:px-6 flex items-center bg-bg-surface/30">
          <div
            className="flex items-center gap-1 sm:gap-2 -mb-px overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-w-0 flex-1"
            role="tablist"
            aria-label={__('Examination Workspace Sections', 'codeclove-school-management')}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'group inline-flex items-center gap-2 py-3.5 px-3 sm:px-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer select-none shrink-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                    isActive
                      ? 'border-brand text-brand font-semibold'
                      : 'border-transparent text-text-muted hover:text-text hover:border-border'
                  )}
                >
                  <Icon
                    size={15}
                    className={cn(
                      'transition-colors',
                      isActive ? 'text-brand' : 'text-text-subtle group-hover:text-text'
                    )}
                  />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Card Body: Active Tab Workspace */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === 'overview' && (
            <ExamProgressMatrix examId={exam.id} onNavigateTab={handleTabChange} />
          )}
          {activeTab === 'timetable' && (
            <ExamTimetablePage embedded examId={exam.id} />
          )}
          {activeTab === 'admit-cards' && (
            <ExamAdmitCardsPage embedded examId={exam.id} />
          )}
          {activeTab === 'marks' && (
            <ExamMarksPage embedded examId={exam.id} />
          )}
          {activeTab === 'tabulation' && (
            <ExamReportsPage embedded examId={exam.id} reportMode="ledger" />
          )}
          {activeTab === 'report-cards' && (
            <ExamReportsPage embedded examId={exam.id} reportMode="report_card" />
          )}
        </div>
      </div>
    </div>
  )
}
