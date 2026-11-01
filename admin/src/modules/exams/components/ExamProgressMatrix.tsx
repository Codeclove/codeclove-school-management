/**
 * ExamProgressMatrix — Executive Examination Progress & Timetable Flight Board.
 *
 * Provides school administrators and exam superintendents with an immediate,
 * high-level overview of examination readiness across every academic class:
 * - Timetable completion status & metrics (without redundant cards or duplicated badges).
 * - Exam date windows and formatted shift timings.
 * - Context-driven, state-aware actions (Schedule vs Enter Marks).
 * - Full compliance with codeclove-ui-ux standards.
 */
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  GraduationCap,
  PenLine,
  TableProperties,
  Search,
  FileCheck2,
} from 'lucide-react'
import { useExam, useExamTimetable, type ExamSubject } from '@/api/exams'
import { useUnits, type AcademicUnit } from '@/api/academics'
import { useFormatter } from '@/lib/formatter'
import { __, sprintf } from '@/lib/i18n'
import {
  Card,
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableSkeleton,
  Badge,
  Button,
  Input,
  Select,
  EmptyState,
} from '@/components/ui'

export interface ExamProgressMatrixProps {
  examId: number
  onNavigateTab?: (tab: 'timetable' | 'marks' | 'tabulation' | 'report-cards' | 'admit-cards') => void
}

interface UnitTelemetry {
  unit: AcademicUnit
  totalPapers: number
  scheduledCount: number
  isComplete: boolean
  isInProgress: boolean
  isUnscheduled: boolean
  completionPercent: number
  earliestDate: string | null
  latestDate: string | null
  dateSpanDays: number
  studentsCount: number
  totalMarksEntered: number
  expectedMarksCount: number
  gradedCount: number
  marksPercent: number
  isMarksComplete: boolean
  isMarksInProgress: boolean
  lifecycleStatus: 'unscheduled' | 'ready_for_exam' | 'grading_in_progress' | 'grading_complete'
}

export default function ExamProgressMatrix({ examId, onNavigateTab }: ExamProgressMatrixProps) {
  const navigate = useNavigate()
  const { formatDate } = useFormatter()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'grading_in_progress' | 'grading_complete' | 'ready_for_exam' | 'unscheduled'
  >('all')

  // ─── Data Queries ───────────────────────────────────────────────────────────
  const { data: exam, isLoading: isLoadingExam } = useExam(examId)

  // Fetch all academic units belonging to this exam's academic session
  const targetSessionId = exam?.academic_session_id
  const { data: unitsResponse, isLoading: isLoadingUnits } = useUnits(
    targetSessionId ? { session_id: targetSessionId, per_page: 100 } : { per_page: 100 }
  )
  const units: AcademicUnit[] = useMemo(() => unitsResponse?.data ?? [], [unitsResponse])

  // Fetch all timetable papers across all classes for this exam
  const { data: allExamPapers = [], isLoading: isLoadingPapers } = useExamTimetable(examId)

  const isLoading = isLoadingExam || isLoadingUnits || isLoadingPapers

  // ─── Per-Class Telemetry Computation ────────────────────────────────────────
  const unitsTelemetry: UnitTelemetry[] = useMemo(() => {
    if (!units.length) return []

    // Group papers by academic_unit_id
    const papersByUnit = new Map<number, ExamSubject[]>()
    allExamPapers.forEach((p) => {
      const arr = papersByUnit.get(p.academic_unit_id) || []
      arr.push(p)
      papersByUnit.set(p.academic_unit_id, arr)
    })

    return units.map((unit) => {
      const unitPapers = papersByUnit.get(unit.id) || []
      const scheduled = unitPapers.filter((p) => Boolean(p.exam_date && p.start_time))

      const totalPapers = unitPapers.length
      const scheduledCount = scheduled.length

      const isComplete = totalPapers > 0 && scheduledCount === totalPapers
      const isInProgress = scheduledCount > 0 && scheduledCount < totalPapers
      const isUnscheduled = scheduledCount === 0

      const completionPercent = totalPapers > 0 ? Math.round((scheduledCount / totalPapers) * 100) : 0

      // Calculate earliest and latest dates
      const validDates = scheduled
        .map((p) => p.exam_date)
        .filter((d): d is string => Boolean(d))
        .sort()

      const earliestDate = validDates[0] || null
      const latestDate = validDates[validDates.length - 1] || null

      let dateSpanDays = 0
      if (earliestDate && latestDate) {
        const start = new Date(earliestDate).getTime()
        const end = new Date(latestDate).getTime()
        dateSpanDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1)
      }
      const studentsCount = unit.students_count || 0

      // Total marks entered across all papers in this class
      const totalMarksEntered = unitPapers.reduce((sum, p) => sum + (p.marks_count ?? 0), 0)

      // Total expected marks across all papers for this class
      const expectedMarksCount = unitPapers.reduce(
        (sum, p) => sum + ((p.candidates_count && p.candidates_count > 0) ? p.candidates_count : studentsCount),
        0
      )

      // A paper is fully completed ONLY when all candidates in that paper have their marks entered
      const fullyGradedPapers = unitPapers.filter((p) => {
        const cCount = (p.candidates_count && p.candidates_count > 0) ? p.candidates_count : studentsCount
        return cCount > 0 && (p.marks_count ?? 0) >= cCount
      })
      const gradedCount = fullyGradedPapers.length

      // True grading completion percentage across all student-paper marks in this class
      const marksPercent = expectedMarksCount > 0
        ? Math.min(100, Math.round((totalMarksEntered / expectedMarksCount) * 100))
        : 0

      // A class is only complete if schedule is complete, all papers are fully graded, and all expected marks are entered
      const isMarksComplete = totalPapers > 0 && expectedMarksCount > 0 && gradedCount === totalPapers && totalMarksEntered >= expectedMarksCount
      const isMarksInProgress = totalMarksEntered > 0 && !isMarksComplete

      let lifecycleStatus: UnitTelemetry['lifecycleStatus'] = 'unscheduled'
      if (totalPapers > 0 && scheduledCount === totalPapers) {
        if (isMarksComplete) {
          lifecycleStatus = 'grading_complete'
        } else if (isMarksInProgress) {
          lifecycleStatus = 'grading_in_progress'
        } else {
          lifecycleStatus = 'ready_for_exam'
        }
      }

      return {
        unit,
        totalPapers,
        scheduledCount,
        isComplete,
        isInProgress,
        isUnscheduled,
        completionPercent,
        earliestDate,
        latestDate,
        dateSpanDays,
        studentsCount,
        totalMarksEntered,
        expectedMarksCount,
        gradedCount,
        marksPercent,
        isMarksComplete,
        isMarksInProgress,
        lifecycleStatus,
      }
    })
  }, [units, allExamPapers])


  // ─── Filtered Matrix Rows ───────────────────────────────────────────────────
  const filteredTelemetry = useMemo(() => {
    return unitsTelemetry.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const nameMatches = item.unit.name.toLowerCase().includes(q)
        const codeMatches = item.unit.code ? item.unit.code.toLowerCase().includes(q) : false
        if (!nameMatches && !codeMatches) return false
      }

      if (statusFilter === 'grading_complete') return item.lifecycleStatus === 'grading_complete'
      if (statusFilter === 'grading_in_progress') return item.lifecycleStatus === 'grading_in_progress'
      if (statusFilter === 'ready_for_exam') return item.lifecycleStatus === 'ready_for_exam'
      if (statusFilter === 'unscheduled') return item.lifecycleStatus === 'unscheduled'
      return true
    })
  }, [unitsTelemetry, searchQuery, statusFilter])

  // ─── Navigation Handlers ────────────────────────────────────────────────────
  const handleJumpToTimetable = (unitId: number) => {
    navigate(`/exams/${examId}/timetable?unit_id=${unitId}`)
    onNavigateTab?.('timetable')
  }

  const handleJumpToMarks = (unitId: number) => {
    navigate(`/exams/${examId}/marks?unit_id=${unitId}`)
    onNavigateTab?.('marks')
  }

  const handleJumpToTabulation = (unitId: number) => {
    navigate(`/exams/${examId}/tabulation?unit_id=${unitId}`)
    onNavigateTab?.('tabulation')
  }

  const handleJumpToAdmitCards = (unitId: number) => {
    navigate(`/exams/${examId}/admit-cards?unit_id=${unitId}`)
    onNavigateTab?.('admit-cards')
  }
  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="p-4 bg-bg-surface border-border">
          <TableSkeleton columns={4} rows={6} />
        </Card>
      </div>
    )
  }

  if (units.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={GraduationCap}
          title={__('No Academic Classes Found', 'codeclove-school-management')}
          description={__(
            'There are no classes configured in this academic session. Set up academic classes to schedule examinations.',
            'codeclove-school-management'
          )}
        />
      </div>
    )
  }

  return (
    <div className="p-0">
      {/* ─── Class Timetables & Flight Board Table ─────────────────────────── */}
      <Card className="bg-transparent border-0 rounded-none shadow-none overflow-hidden">
        {/* Table Control Header */}
        <div className="p-4 sm:px-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bg-surface/50 dark:bg-bg-surface/60">
          <div>
            <h3 className="text-sm font-semibold text-text tracking-tight">
              {__('Class Schedules & Readiness', 'codeclove-school-management')}
            </h3>
            <p className="text-2xs text-text-muted">
              {__('Track schedule completion, student candidates, and grading progress per class.', 'codeclove-school-management')}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-44 sm:w-52">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-subtle" />
              <Input
                type="text"
                placeholder={__('Filter classes...', 'codeclove-school-management')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-8"
              />
            </div>

            {/* Status Filter */}
            <div className="w-52">
              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}
                options={[
                  { value: 'all', label: __('All classes', 'codeclove-school-management') },
                  { value: 'grading_in_progress', label: __('Grading in progress', 'codeclove-school-management') },
                  { value: 'grading_complete', label: __('Grading complete (100%)', 'codeclove-school-management') },
                  { value: 'ready_for_exam', label: __('Ready for exam (Scheduled)', 'codeclove-school-management') },
                  { value: 'unscheduled', label: __('Needs schedule', 'codeclove-school-management') },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <TableRoot>
            <Thead>
              <Tr>
                <Th align="left" className="min-w-[180px]">
                  {__('Class & Cohort', 'codeclove-school-management')}
                </Th>
                <Th align="left" className="min-w-[170px]">
                  {__('Exam Dates', 'codeclove-school-management')}
                </Th>
                <Th align="left" className="min-w-[220px]">
                  {__('Grading & Marks Status', 'codeclove-school-management')}
                </Th>
                <Th align="right" className="min-w-[210px]">
                  {__('Actions', 'codeclove-school-management')}
                </Th>
              </Tr>
            </Thead>

            <Tbody>
              {filteredTelemetry.length === 0 ? (
                <Tr>
                  <Td colSpan={4} align="center" className="py-12 text-text-muted text-xs">
                    {__('No classes match your search criteria.', 'codeclove-school-management')}
                  </Td>
                </Tr>
              ) : (
                filteredTelemetry.map((item) => {
                  return (
                    <Tr key={item.unit.id} className="hover:bg-hover-bg/40 transition-colors">
                      {/* 1. Class Name & Info */}
                      {/* 1. Class Name & Student Cohort */}
                      <Td align="left">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-text text-sm">
                            {item.unit.name}
                          </span>
                          <span className="text-3xs text-text-subtle font-mono">
                            {item.studentsCount > 0
                              ? sprintf(__('%1$d candidates • %2$d papers', 'codeclove-school-management'), item.studentsCount, item.totalPapers)
                              : item.totalPapers > 0
                              ? sprintf(__('%d papers configured', 'codeclove-school-management'), item.totalPapers)
                              : __('No subjects assigned', 'codeclove-school-management')}
                          </span>
                        </div>
                      </Td>

                      {/* 2. Exam Schedule Dates */}
                      <Td align="left">
                        {item.earliestDate && item.latestDate ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-xs font-medium text-text">
                              {formatDate(item.earliestDate)} – {formatDate(item.latestDate)}
                            </span>
                            <span className="text-3xs text-text-subtle font-mono">
                              {sprintf(__('%d days span', 'codeclove-school-management'), item.dateSpanDays)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-text-subtle font-mono">{__('Not scheduled', 'codeclove-school-management')}</span>
                        )}
                      </Td>

                      {/* 3. Grading & Marks Operational Status */}
                      <Td align="left">
                        {item.lifecycleStatus === 'grading_complete' ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="success" dot size="sm" className="font-medium self-start">
                              {__('Grading Complete', 'codeclove-school-management')}
                            </Badge>
                            <span className="text-3xs text-text-subtle font-mono">
                              {sprintf(__('All %d papers graded', 'codeclove-school-management'), item.totalPapers)}
                            </span>
                          </div>
                        ) : item.lifecycleStatus === 'grading_in_progress' ? (
                          <div className="flex flex-col gap-1 min-w-[170px] max-w-[210px]">
                            <div className="flex items-center justify-between text-xs gap-2">
                              <Badge variant="warning" dot size="sm" className="font-medium">
                                {sprintf(__('Grading (%s%%)', 'codeclove-school-management'), item.marksPercent)}
                              </Badge>
                              <span className="font-mono text-3xs text-text-muted tabular-nums font-semibold">
                                {item.totalMarksEntered} / {item.expectedMarksCount}
                              </span>
                            </div>
                            <div className="w-full bg-bg-surface border border-border h-1.5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                                style={{ width: `${Math.max(6, item.marksPercent)}%` }}
                              />
                            </div>
                            <span className="text-3xs text-text-subtle font-mono">
                              {item.gradedCount > 0
                                ? sprintf(__('%1$d of %2$d papers complete', 'codeclove-school-management'), item.gradedCount, item.totalPapers)
                                : sprintf(__('%d marks entered', 'codeclove-school-management'), item.totalMarksEntered)}
                            </span>
                          </div>
                        ) : item.lifecycleStatus === 'ready_for_exam' ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="brand" dot size="sm" className="font-medium self-start">
                              {__('Ready for Exam', 'codeclove-school-management')}
                            </Badge>
                            <span className="text-3xs text-text-subtle font-mono">
                              {sprintf(__('Schedule ready (%d papers)', 'codeclove-school-management'), item.totalPapers)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Badge variant="neutral" size="sm" className="font-medium self-start">
                              {__('Needs Schedule', 'codeclove-school-management')}
                            </Badge>
                            <span className="text-3xs text-text-subtle font-mono">
                              {item.totalPapers > 0
                                ? sprintf(__('%d papers to schedule', 'codeclove-school-management'), item.totalPapers - item.scheduledCount)
                                : __('No subjects defined', 'codeclove-school-management')}
                            </span>
                          </div>
                        )}
                      </Td>
                      {/* 5. Context-Aware Actions */}
                      <Td align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.lifecycleStatus === 'grading_complete' ? (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleJumpToTabulation(item.unit.id)}
                              className="h-7 px-2.5 text-xs font-semibold gap-1.5 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                              title={sprintf(__('View tabulation sheet for %s', 'codeclove-school-management'), item.unit.name)}
                            >
                              <TableProperties size={12} />
                              <span>{__('View Results', 'codeclove-school-management')}</span>
                            </Button>
                          ) : item.lifecycleStatus === 'unscheduled' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleJumpToTimetable(item.unit.id)}
                              className="h-7 px-2.5 text-xs font-medium gap-1.5 shadow-xs hover:border-brand/40"
                              title={sprintf(__('Schedule exam for %s', 'codeclove-school-management'), item.unit.name)}
                            >
                              <CalendarDays size={12} className="text-brand" />
                              <span>{__('Schedule', 'codeclove-school-management')}</span>
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleJumpToMarks(item.unit.id)}
                              className="h-7 px-2.5 text-xs font-semibold gap-1.5 shadow-xs"
                              title={sprintf(__('Enter marks for %s', 'codeclove-school-management'), item.unit.name)}
                            >
                              <PenLine size={12} />
                              <span>{item.lifecycleStatus === 'grading_in_progress' ? __('Continue Marks', 'codeclove-school-management') : __('Enter Marks', 'codeclove-school-management')}</span>
                            </Button>
                          )}

                          {/* Quick icon transitions */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleJumpToTimetable(item.unit.id)}
                            className="h-7 w-7 p-0 text-text-muted hover:text-text hover:bg-hover-bg"
                            title={sprintf(__('View schedule for %s', 'codeclove-school-management'), item.unit.name)}
                          >
                            <CalendarDays size={13} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleJumpToAdmitCards(item.unit.id)}
                            className="h-7 w-7 p-0 text-text-muted hover:text-text hover:bg-hover-bg"
                            title={sprintf(__('View admit cards for %s', 'codeclove-school-management'), item.unit.name)}
                          >
                            <FileCheck2 size={13} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleJumpToTabulation(item.unit.id)}
                            className="h-7 w-7 p-0 text-text-muted hover:text-text hover:bg-hover-bg"
                            title={sprintf(__('View tabulation sheet for %s', 'codeclove-school-management'), item.unit.name)}
                          >
                            <TableProperties size={13} />
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  )
                })
              )}
            </Tbody>
          </TableRoot>
        </div>
      </Card>
    </div>
  )
}
