/**
 * ExamReportsPage — Examination Tabulation Ledger & Printable Report Cards.
 *
 * Tab 1: Class Tabulation Ledger — High-density matrix of roll numbers, students,
 * subject scores, totals, percentages, grades, ranks, and result flags with CSV export.
 *
 * Tab 2: Printable Report Card — Single-Term Report vs Annual Combined Transcript (T1+T2),
 * official A4 canvas layout with school logo, bio profile, tabular subject breakdown,
 * attendance register stats, teacher/principal remarks, and print styles.
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FileText,
  Printer,
  Download,
  Users,
  BookOpen,
  Layers,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  RotateCcw,
  LayoutList,
  TableProperties,
} from 'lucide-react'
import {
  useExams,
  useExamTimetable,
  useExamTabulation,
  useExamReportCard,
  useUpdateExam,
} from '@/api/exams'
import { useUnits, useGroups } from '@/api/academics'
import { useToast } from '@/lib/toast'
import { printElement } from '@/lib/print'
import { exportToCSV } from '@/lib/csv'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  Select,
  type SelectOption,
  Checkbox,
  EmptyState,
  Alert,
  Badge,
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableSkeleton,
  Popover,
} from '@/components/ui'
import { ReportCardDocument, type ReportCardPrintOptions } from '../components/ReportCardDocument'
import { TabulationLedgerDocument } from '../components/TabulationLedgerDocument'
import type { TabulationStudent, ReportCardData, ReportCardSubject, ReportCardConfig } from '../types'

const DEFAULT_PRINT_OPTIONS: ReportCardPrintOptions = {
  accentColor: '#0f226b',
  fontFamily: 'serif',
  showGradingScale: true,
  showAttendance: true,
  showRemarks: true,
  showTeacherRemarks: true,
  showPrincipalRemarks: true,
  showSignatures: true,
  showTeacherSignature: true,
  showPrincipalSignature: true,
  showParentSignature: true,
  showStudentPhoto: true,
  showRank: true,
  showPercentage: true,
  showGrade: true,
  showGpa: true,
  showPassMarks: true,
  paperSize: 'a4',
  density: 'auto',
}

function getExamPrintOptions(cfg?: ReportCardConfig | null): ReportCardPrintOptions {
  if (!cfg) return DEFAULT_PRINT_OPTIONS
  return {
    ...DEFAULT_PRINT_OPTIONS,
    accentColor: cfg.accent_color || '#0f226b',
    fontFamily: cfg.font_family || 'serif',
    showGradingScale: cfg.show_grading_scale ?? true,
    showAttendance: cfg.show_attendance ?? true,
    showRemarks: cfg.show_remarks ?? true,
    showTeacherRemarks: cfg.show_teacher_remarks ?? cfg.show_remarks ?? true,
    showPrincipalRemarks: cfg.show_principal_remarks ?? cfg.show_remarks ?? true,
    showSignatures: cfg.show_signatures ?? true,
    showTeacherSignature: cfg.show_teacher_signature ?? cfg.show_signatures ?? true,
    showPrincipalSignature: cfg.show_principal_signature ?? cfg.show_signatures ?? true,
    showParentSignature: cfg.show_parent_signature ?? cfg.show_signatures ?? true,
    showStudentPhoto: cfg.show_student_photo ?? true,
    showRank: cfg.show_rank ?? true,
    showPercentage: cfg.show_percentage ?? true,
    showGrade: cfg.show_grade ?? true,
    showGpa: cfg.show_gpa ?? true,
    showPassMarks: cfg.show_pass_marks ?? true,
  }
}

type LayoutGroup = 'scores' | 'student' | 'institutional'

interface LayoutToggleDef {
  key: keyof ReportCardPrintOptions
  label: string
  group: LayoutGroup
}

const LAYOUT_TOGGLES: LayoutToggleDef[] = [
  { key: 'showRank', label: __('Class Rank', 'codeclove-school-management'), group: 'scores' },
  { key: 'showPercentage', label: __('Percentage Column', 'codeclove-school-management'), group: 'scores' },
  { key: 'showGrade', label: __('Grade Column', 'codeclove-school-management'), group: 'scores' },
  { key: 'showGpa', label: __('Cumulative GPA', 'codeclove-school-management'), group: 'scores' },
  { key: 'showGradingScale', label: __('Grading Scale Key', 'codeclove-school-management'), group: 'scores' },
  { key: 'showStudentPhoto', label: __('Student Passport Photo', 'codeclove-school-management'), group: 'student' },
  { key: 'showAttendance', label: __('Attendance Record', 'codeclove-school-management'), group: 'student' },
  { key: 'showTeacherRemarks', label: __('Class Teacher Observations', 'codeclove-school-management'), group: 'institutional' },
  { key: 'showPrincipalRemarks', label: __('Principal Remarks', 'codeclove-school-management'), group: 'institutional' },
  { key: 'showTeacherSignature', label: __('Class Teacher Signature', 'codeclove-school-management'), group: 'institutional' },
  { key: 'showPrincipalSignature', label: __('Principal / Headmaster Signature', 'codeclove-school-management'), group: 'institutional' },
  { key: 'showParentSignature', label: __('Parent / Guardian Acknowledgement', 'codeclove-school-management'), group: 'institutional' },
]

export interface ExamReportsPageProps {
  examId?: number
  embedded?: boolean
  reportMode?: 'ledger' | 'report_card'
}

export default function ExamReportsPage({
  examId: propExamId,
  embedded = false,
  reportMode,
}: ExamReportsPageProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const updateExamMutation = useUpdateExam()

  // ─── URL Query Param Sync ──────────────────────────────────────────────────
  const initialExamId = propExamId ? String(propExamId) : (searchParams.get('exam_id') || '')
  const initialUnitId = searchParams.get('unit_id') || ''
  const initialGroupId = searchParams.get('group_id') || ''
  const rawTab = searchParams.get('tab')
  const initialTab: 'ledger' | 'report_card' = rawTab === 'report_card' ? 'report_card' : 'ledger'
  const initialStudentId = searchParams.get('student_id') || ''
  // ─── Selectors State ────────────────────────────────────────────────────────
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(initialUnitId)
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId)
  const [activeTab, setActiveTab] = useState<'ledger' | 'report_card'>(reportMode || initialTab)
  const currentTab = reportMode || activeTab
  const [tabulationView, setTabulationView] = useState<'detailed' | 'summary'>('detailed')

  // Report Card Sub-state
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId)
  const reportCardRef = useRef<HTMLDivElement | null>(null)
  const batchPrintRef = useRef<HTMLDivElement | null>(null)
  const ledgerPrintRef = useRef<HTMLDivElement | null>(null)
  const [paperFormat, setPaperFormat] = useState<'a4' | 'letter'>('a4')
  const [printOptions, setPrintOptions] = useState<ReportCardPrintOptions>(DEFAULT_PRINT_OPTIONS)
  // External URL search parameter sync
  useEffect(() => {
    if (propExamId) {
      setSelectedExamId(String(propExamId))
    } else {
      const qExam = searchParams.get('exam_id') || ''
      if (qExam !== selectedExamId) setSelectedExamId(qExam)
    }
    const qUnit = searchParams.get('unit_id') || ''
    const qGroup = searchParams.get('group_id') || ''
    const qTabRaw = searchParams.get('tab')
    const qTab: 'ledger' | 'report_card' = qTabRaw === 'report_card' ? 'report_card' : 'ledger'
    const qStudent = searchParams.get('student_id') || ''

    if (qUnit !== selectedUnitId) setSelectedUnitId(qUnit)
    if (qGroup !== selectedGroupId) setSelectedGroupId(qGroup)
    if (!reportMode && qTab !== activeTab) setActiveTab(qTab)
    if (qStudent !== selectedStudentId) setSelectedStudentId(qStudent)
  }, [searchParams, propExamId])

  // Bidirectional searchParams update handlers
  const handleExamChange = (val: string) => {
    setSelectedExamId(val)
    setSelectedStudentId('')
    const next = new URLSearchParams(searchParams)
    if (val) next.set('exam_id', val)
    else next.delete('exam_id')
    next.delete('student_id')
    setSearchParams(next, { replace: true })
  }

  const handleUnitChange = (val: string) => {
    setSelectedUnitId(val)
    setSelectedGroupId('')
    setSelectedStudentId('')
    const next = new URLSearchParams(searchParams)
    if (val) next.set('unit_id', val)
    else next.delete('unit_id')
    next.delete('group_id')
    next.delete('student_id')
    setSearchParams(next, { replace: true })
  }

  const handleGroupChange = (val: string) => {
    setSelectedGroupId(val)
    const next = new URLSearchParams(searchParams)
    if (val) next.set('group_id', val)
    else next.delete('group_id')
    setSearchParams(next, { replace: true })
  }

  const handleTabChange = (tab: 'ledger' | 'report_card') => {
    setActiveTab(tab)
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const handleStudentChange = (val: string) => {
    setSelectedStudentId(val)
    const next = new URLSearchParams(searchParams)
    if (val) next.set('student_id', val)
    else next.delete('student_id')
    setSearchParams(next, { replace: true })
  }
  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: exams = [], isLoading: isLoadingExams } = useExams()

  // Auto-select first exam with papers or published exam if none selected
  useEffect(() => {
    if (!selectedExamId && exams.length > 0) {
      const withPapers = exams.find((e) => (e.subjects_count ?? 0) > 0)
      const target = withPapers || exams.find((e) => e.status === 'published') || exams[0]
      if (target) {
        setSelectedExamId(String(target.id))
      }
    }
  }, [exams, selectedExamId])

  const numExamId = Number(selectedExamId) || 0
  const selectedExam = useMemo(
    () => exams.find((e) => e.id === numExamId),
    [exams, numExamId]
  )

  // Sync print options from exam-level report card config
  useEffect(() => {
    setPrintOptions(getExamPrintOptions(selectedExam?.report_card_config))
  }, [selectedExam?.id, selectedExam?.report_card_config])
  // Scope units to the selected exam's session
  const targetSessionId = selectedExam?.academic_session_id
  const { data: unitsResponse, isLoading: isLoadingUnits } = useUnits(
    targetSessionId ? { session_id: targetSessionId, per_page: 100 } : { per_page: 100 }
  )
  const units = unitsResponse?.data ?? []

  // All papers scheduled for this exam across all units
  const { data: allExamPapers = [] } = useExamTimetable(numExamId)

  const numUnitId = Number(selectedUnitId) || 0
  const numGroupId = Number(selectedGroupId) || undefined
  const numStudentId = Number(selectedStudentId) || 0

  const { data: groupsResponse } = useGroups(
    selectedUnitId ? { academic_unit_id: Number(selectedUnitId) } : undefined
  )
  const groups = groupsResponse?.data ?? []

  // Auto-select unit: prefer a unit that has scheduled papers in allExamPapers
  useEffect(() => {
    if (numExamId > 0 && !selectedUnitId && allExamPapers.length > 0) {
      const paperUnit = allExamPapers.find((p) => units.some((u) => u.id === p.academic_unit_id))
      if (paperUnit) {
        setSelectedUnitId(String(paperUnit.academic_unit_id))
      } else if (units[0]) {
        setSelectedUnitId(String(units[0].id))
      }
    }
  }, [numExamId, selectedUnitId, units, allExamPapers])
  const {
    data: tabulationData,
    isLoading: isLoadingTabulation,
    isError: isTabulationError,
    refetch: refetchTabulation,
  } = useExamTabulation(numExamId, numUnitId, numGroupId)

  // Report Card query (for Tab 2)
  const {
    data: reportCardData,
    isLoading: isLoadingReportCard,
    isError: isReportCardError,
    refetch: refetchReportCard,
  } = useExamReportCard(numExamId, numStudentId)

  // Auto-select first student in report card view when tabulation loads
  const studentsList: TabulationStudent[] = useMemo(
    () => tabulationData?.students ?? [],
    [tabulationData]
  )
  useEffect(() => {
    const first = studentsList[0]
    if (!selectedStudentId && first) {
      const firstId = String(first.student_id)
      setSelectedStudentId(firstId)
      if (activeTab === 'report_card') {
        const next = new URLSearchParams(searchParams)
        if (!next.get('student_id')) {
          next.set('student_id', firstId)
          setSearchParams(next, { replace: true })
        }
      }
    }
  }, [studentsList, selectedStudentId, activeTab, searchParams, setSearchParams])

  const currentStudentIndex = useMemo(() => {
    return studentsList.findIndex((s) => String(s.student_id) === String(selectedStudentId))
  }, [studentsList, selectedStudentId])

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      const prev = studentsList[currentStudentIndex - 1]
      if (prev) {
        handleStudentChange(String(prev.student_id))
      }
    }
  }

  const handleNextStudent = () => {
    if (currentStudentIndex >= 0 && currentStudentIndex < studentsList.length - 1) {
      const next = studentsList[currentStudentIndex + 1]
      if (next) {
        handleStudentChange(String(next.student_id))
      }
    }
  }

  const handlePaperFormatChange = (fmt: 'a4' | 'letter') => {
    setPaperFormat(fmt)
    setPrintOptions((prev) => ({ ...prev, paperSize: fmt }))
  }

  // Active Layout Options Count
  const activeOptionsCount = useMemo(
    () => LAYOUT_TOGGLES.filter((t) => Boolean(printOptions[t.key])).length,
    [printOptions]
  )

  const handleResetOptionsToDefault = () => {
    setPrintOptions(getExamPrintOptions(selectedExam?.report_card_config))
  }
  const handleSelectAllOptions = () => {
    setPrintOptions((prev) => {
      const next = { ...prev }
      LAYOUT_TOGGLES.forEach((t) => {
        (next as Record<string, unknown>)[t.key] = true
      })
      return next
    })
  }

  const handleSaveAsDefault = () => {
    if (!selectedExam) return
    const updatedConfig: ReportCardConfig = {
      ...(selectedExam.report_card_config || {}),
      show_rank: Boolean(printOptions.showRank),
      show_percentage: Boolean(printOptions.showPercentage),
      show_grade: Boolean(printOptions.showGrade),
      show_gpa: Boolean(printOptions.showGpa),
      show_pass_marks: Boolean(printOptions.showPassMarks),
      show_grading_scale: Boolean(printOptions.showGradingScale),
      show_student_photo: Boolean(printOptions.showStudentPhoto),
      show_attendance: Boolean(printOptions.showAttendance),
      show_teacher_remarks: Boolean(printOptions.showTeacherRemarks),
      show_principal_remarks: Boolean(printOptions.showPrincipalRemarks),
      show_teacher_signature: Boolean(printOptions.showTeacherSignature),
      show_principal_signature: Boolean(printOptions.showPrincipalSignature),
      show_parent_signature: Boolean(printOptions.showParentSignature),
    }

    updateExamMutation.mutate(
      { id: selectedExam.id, data: { report_card_config: updatedConfig } },
      {
        onSuccess: () => {
          toast.success(__('Saved as exam default layout.', 'codeclove-school-management'))
        },
        onError: (err) => {
          toast.error(err.message || __('Failed to save layout defaults.', 'codeclove-school-management'))
        },
      }
    )
  }

  // Keyboard navigation shortcuts: [ for previous student, ] for next student
  useEffect(() => {
    if (currentTab !== 'report_card' || studentsList.length <= 1) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable ||
        target?.closest('[role="combobox"]') ||
        target?.closest('[role="dialog"]')
      ) {
        return
      }

      if (e.key === '[' || (e.altKey && e.key === 'ArrowLeft')) {
        if (currentStudentIndex > 0) {
          e.preventDefault()
          const prev = studentsList[currentStudentIndex - 1]
          if (prev) handleStudentChange(String(prev.student_id))
        }
      } else if (e.key === ']' || (e.altKey && e.key === 'ArrowRight')) {
        if (currentStudentIndex >= 0 && currentStudentIndex < studentsList.length - 1) {
          e.preventDefault()
          const next = studentsList[currentStudentIndex + 1]
          if (next) handleStudentChange(String(next.student_id))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTab, currentStudentIndex, studentsList, handleStudentChange])
  const ledgerStats = useMemo(() => {
    if (!studentsList.length || !tabulationData?.subjects?.length) return null
    const total = studentsList.length

    // Differentiate between completed, partial, and pending students
    const completedStudents: TabulationStudent[] = []
    const partialStudents: TabulationStudent[] = []
    const pendingStudents: TabulationStudent[] = []

    studentsList.forEach((s) => {
      const hasMarks = tabulationData.subjects.some((subj) => {
        const item = s.marks?.[subj.id]
        return Boolean(item && (item.is_absent || item.status === 'absent' || item.marks_obtained != null))
      })

      if (s.is_pending || (!hasMarks && s.total_marks_obtained === 0)) {
        pendingStudents.push(s)
      } else if (s.is_partial || s.result_status === 'partial') {
        partialStudents.push(s)
      } else {
        completedStudents.push(s)
      }
    })

    const assessedStudents = [...completedStudents, ...partialStudents]
    const passed = completedStudents.filter((s) => !s.has_failed && s.result_status !== 'failed').length
    const failed = completedStudents.filter((s) => s.has_failed || s.result_status === 'failed').length

    const passRate =
      completedStudents.length > 0
        ? `${((passed / completedStudents.length) * 100).toFixed(1)}%`
        : partialStudents.length > 0
        ? __('In Progress', 'codeclove-school-management')
        : '—'

    const avgPercentage =
      assessedStudents.length > 0
        ? (
            assessedStudents.reduce((acc, s) => acc + (s.percentage || 0), 0) /
            assessedStudents.length
          ).toFixed(1)
        : '—'
    const highestPercentage =
      assessedStudents.length > 0
        ? Math.max(...assessedStudents.map((s) => s.percentage || 0)).toFixed(1)
        : '—'

    return {
      total,
      assessed: assessedStudents.length,
      completed: completedStudents.length,
      partial: partialStudents.length,
      pending: pendingStudents.length,
      passed,
      failed,
      passRate,
      avgPercentage: avgPercentage !== '—' ? `${avgPercentage}%` : '—',
      highestPercentage: highestPercentage !== '—' ? `${highestPercentage}%` : '—',
    }
  }, [studentsList, tabulationData])

  const totalPossibleMarks = useMemo(() => {
    return tabulationData?.subjects?.reduce((sum, s) => sum + (Number(s.max_marks) || 0), 0) ?? 0
  }, [tabulationData])

  const minPassPercentage = useMemo(() => {
    if (!tabulationData?.subjects?.length || !totalPossibleMarks) return 0
    const totalPassMarks = tabulationData.subjects.reduce((sum, s) => sum + (Number(s.pass_marks) || 0), 0)
    return Math.round((totalPassMarks / totalPossibleMarks) * 100)
  }, [tabulationData, totalPossibleMarks])
  // ─── CSV Export for Tabulation Ledger ────────────────────────────────────────
  const handleExportLedgerCsv = () => {
    if (!tabulationData || !studentsList.length) {
      toast.info(__('No tabulation data available to export.', 'codeclove-school-management'))
      return
    }

    const subjects = tabulationData.subjects || []
    const headers = [
      'Roll No',
      'Student ID',
      'Student Name',
      ...subjects.map((s) => `${s.name} (Max ${s.max_marks})`),
      'Total Marks Obtained',
      'Total Marks Possible',
      'Percentage (%)',
      'Overall Grade',
      'Rank',
      'Result Status',
    ]

    const rows = studentsList.map((student) => {
      const subjectCols = subjects.map((subj) => {
        const item = student.marks?.[subj.id]
        if (!item) return ''
        if (item.is_enrolled === false || item.status === 'not_applicable') return 'N/A'
        if (item.is_absent || item.status === 'absent') return 'ABS'
        if (item.status === 'exempt') return 'EXM'
        return item.marks_obtained !== null && item.marks_obtained !== undefined
          ? item.marks_obtained
          : ''
      })

      return [
        student.roll_number || '',
        student.student_number || '',
        student.student_name,
        ...subjectCols,
        student.total_marks_obtained,
        student.total_marks_possible,
        student.percentage.toFixed(1),
        student.grade || '',
        student.rank ?? '',
        student.has_failed ? 'FAILED' : 'PASSED',
      ]
    })

    const filename = `tabulation_${tabulationData.exam_name}_${tabulationData.academic_unit_name}`.replace(/\s+/g, '_')
    exportToCSV(filename, headers, rows)
    toast.success(__('Tabulation ledger successfully exported to CSV.', 'codeclove-school-management'))
  }

  // ─── Print Handlers ──────────────────────────────────────────────────────────
  const handlePrintReportCard = () => {
    const docElem = document.getElementById('printable-report-card') || reportCardRef.current
    if (docElem) {
      printElement(docElem)
    }
  }

  const handlePrintBatchReportCards = () => {
    if (batchPrintRef.current) {
      toast.info(sprintf(__('Preparing batch print for %d students...', 'codeclove-school-management'), batchStudentsData.length))
      printElement(batchPrintRef.current)
    }
  }

  const handlePrintLedger = () => {
    if (ledgerPrintRef.current) {
      toast.info(__('Preparing tabulation ledger for print...', 'codeclove-school-management'))
      printElement(ledgerPrintRef.current)
    }
  }

  // ─── Base School & Exam Presentation Metadata ─────────────────────────────
  const baseSchool = useMemo(() => reportCardData?.school || {
    name: 'CodeClove International Academy',
    code: 'CC-SCH-2026',
    logo: '',
    email: 'admissions@codeclove.edu',
    phone: '+1 (555) 123-4567',
    address: '100 Academic Boulevard, Boston, MA 02108',
  }, [reportCardData])

  const currentExam = useMemo(() => exams.find((e) => String(e.id) === selectedExamId), [exams, selectedExamId])
  const baseExam = useMemo(() => reportCardData?.exam || {
    id: numExamId,
    name: tabulationData?.exam_name || currentExam?.name || 'Examination',
    code: currentExam?.code,
    academic_session_name: currentExam?.academic_session_name,
    starts_on: currentExam?.starts_on || '2026-09-01',
    ends_on: currentExam?.ends_on || '2026-09-15',
    status: currentExam?.status || 'published',
  }, [reportCardData, numExamId, tabulationData, currentExam])

  const selectedGroupName = useMemo(() => {
    return groups.find((g) => String(g.id) === selectedGroupId)?.name || ''
  }, [groups, selectedGroupId])

  // ─── Batch Report Cards Data Compilation ──────────────────────────────────
  const batchStudentsData = useMemo<ReportCardData[]>(() => {
    if (!tabulationData || !studentsList.length) return []
    const gradingScale = reportCardData?.grading_scale

    return studentsList.map((st) => {
      if (reportCardData && Number(st.student_id) === Number(selectedStudentId)) {
        return reportCardData
      }

      const subjects: ReportCardSubject[] = (tabulationData.subjects || []).map((sub) => {
        const item = st.marks?.[sub.id]
        const marks = item?.marks_obtained ?? null
        const isAbsent = Boolean(item?.is_absent || item?.status === 'absent')
        const isExempt = Boolean(item?.is_exempt || item?.status === 'exempt')
        const isPending = marks === null && !isAbsent && !isExempt
        const max = Number(sub.max_marks) || 100
        const pass = Number(sub.pass_marks) || 40
        const pct = marks !== null && max > 0 ? (marks / max) * 100 : null

        let grade = '—'
        let gradePoint: number | null = null
        if (gradingScale?.tiers?.length && marks !== null) {
          const match = gradingScale.tiers.find(
            (t) => (pct ?? 0) >= t.min && (pct ?? 0) <= t.max
          )
          if (match) {
            grade = match.label
            gradePoint = match.gp
          }
        } else if (isExempt) {
          grade = 'EX'
        }

        return {
          subject_id: sub.id,
          name: sub.name,
          max_marks: max,
          pass_marks: pass,
          marks_obtained: marks,
          theory_marks: item?.theory_marks ?? null,
          practical_marks: item?.practical_marks ?? null,
          theory_max: sub.theory_max_marks ?? null,
          practical_max: sub.practical_max_marks ?? null,
          percentage: pct,
          grade,
          grade_point: gradePoint,
          is_absent: isAbsent,
          is_exempt: isExempt,
          is_pending: isPending,
          remarks: isAbsent
            ? __('Absent', 'codeclove-school-management')
            : isExempt
            ? __('Exempt', 'codeclove-school-management')
            : marks !== null && marks < pass
            ? __('Needs Attention', 'codeclove-school-management')
            : marks !== null
            ? __('Good Effort', 'codeclove-school-management')
            : __('Pending', 'codeclove-school-management'),
        }
      })

      return {
        exam: baseExam,
        student: {
          id: st.student_id,
          name: st.student_name,
          student_number: st.student_number || `STU-${st.student_id}`,
          roll_number: st.roll_number || '',
          unit_name: tabulationData.academic_unit_name,
          group_name: st.group_name || '',
          guardian_name: undefined,
        },
        school: baseSchool,
        subjects,
        summary: {
          total_obtained: st.total_marks_obtained,
          total_possible: st.total_marks_possible,
          percentage: st.percentage,
          grade: st.grade || '—',
          grade_point: st.grade_point ?? 0,
          rank: st.rank,
          result_status: st.has_failed ? 'Failed' : 'Passed',
        },
        attendance: reportCardData?.attendance || {
          total_days: 120,
          days_present: 114,
          attendance_percentage: 95.0,
        },
        grading_scale: gradingScale,
      }
    })
  }, [tabulationData, studentsList, reportCardData, selectedStudentId, selectedExamId, numExamId, exams])
  // ─── Dropdown Options ───────────────────────────────────────────────────────
  const examOptions: SelectOption[] = useMemo(() => {
    return exams.map((e) => ({
      value: String(e.id),
      label: `${e.name}${e.code ? ` (${e.code})` : ''}`,
      description: `${e.academic_session_name ? `${e.academic_session_name} • ` : ''}${e.starts_on}${(e.subjects_count ?? 0) > 0 ? ` • ${sprintf(__('%d papers', 'codeclove-school-management'), e.subjects_count)}` : ''}`,
    }))
  }, [exams])

  const unitOptions: SelectOption[] = useMemo(() => {
    return units.map((u) => ({
      value: String(u.id),
      label: u.name,
    }))
  }, [units])
  const groupOptions: SelectOption[] = [
    { value: '', label: __('All Sections / Groups', 'codeclove-school-management') },
    ...groups.map((g) => ({
      value: String(g.id),
      label: g.name,
    })),
  ]

  const studentOptions: SelectOption[] = studentsList.map((s, idx) => ({
    value: String(s.student_id),
    label: `${idx + 1}. ${s.student_name}${s.roll_number ? ` (Roll ${s.roll_number})` : ''}`,
    description: s.student_number || undefined,
  }))

  const isSelectionReady = Boolean(numExamId && numUnitId)

  return (
    <div className={embedded ? "" : "space-y-6"}>
      {/* ─── Page Header & SubNav ─────────────────────────────────────────── */}
      <div className="no-print space-y-4">
        {!embedded && (
          <>
            <PageHeader
              title={__('Results & Report Cards', 'codeclove-school-management')}
              description={__(
                'View class results sheets, student rankings, and print official report cards.',
                'codeclove-school-management'
              )}
              breadcrumbs={[
                { label: __('Examinations', 'codeclove-school-management'), href: ROUTES.EXAMS },
                { label: __('Results & Report Cards', 'codeclove-school-management') },
              ]}
            />

          </>
        )}
        {/* ─── Tab Switcher Pills ──────────────────────────────────────────── */}
        {(!embedded || !reportMode) && (
          <div className="inline-flex items-center gap-1.5 p-1 bg-bg-surface rounded-lg border border-border">
            <button
              type="button"
              onClick={() => handleTabChange('ledger')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                currentTab === 'ledger'
                  ? 'bg-bg-elevated text-text shadow-xs'
                  : 'text-text-subtle hover:text-text'
              }`}
            >
              {__('Class Results Sheet', 'codeclove-school-management')}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('report_card')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                currentTab === 'report_card'
                  ? 'bg-bg-elevated text-text shadow-xs'
                  : 'text-text-subtle hover:text-text'
              }`}
            >
              {__('Student Report Card', 'codeclove-school-management')}
            </button>
          </div>
        )}
      </div>

      {/* Selectors Bar Card (Hidden on Print) */}
      {embedded && currentTab === 'ledger' ? (
        <div className="no-print bg-bg-surface/50 dark:bg-bg-surface/60 p-3 sm:px-6 sm:py-3 border-b border-border space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-text whitespace-nowrap">
                  {__('Class', 'codeclove-school-management')}:
                  <span className="text-danger ms-0.5">*</span>
                </label>
                <div className="w-48 sm:w-56">
                  <Select
                    value={selectedUnitId}
                    onValueChange={handleUnitChange}
                    options={unitOptions}
                    placeholder={
                      isLoadingUnits
                        ? __('Loading classes...', 'codeclove-school-management')
                        : __('Select Class...', 'codeclove-school-management')
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-text whitespace-nowrap">
                  {__('Section (Optional)', 'codeclove-school-management')}
                </label>
                <div className="w-40 sm:w-44">
                  <Select
                    value={selectedGroupId}
                    onValueChange={handleGroupChange}
                    options={groupOptions}
                    placeholder={
                      !selectedUnitId
                        ? __('Select Class First', 'codeclove-school-management')
                        : __('All Sections', 'codeclove-school-management')
                    }
                    disabled={!selectedUnitId}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <div className="inline-flex rounded-md border border-border bg-bg-surface p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTabulationView('detailed')}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                    tabulationView === 'detailed'
                      ? 'bg-bg-elevated text-text shadow-xs font-semibold'
                      : 'text-text-muted hover:text-text'
                  )}
                  title={__('Full broadsheet with all subject marks', 'codeclove-school-management')}
                >
                  <TableProperties size={13} />
                  <span>{__('Full Broadsheet', 'codeclove-school-management')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTabulationView('summary')}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                    tabulationView === 'summary'
                      ? 'bg-bg-elevated text-text shadow-xs font-semibold'
                      : 'text-text-muted hover:text-text'
                  )}
                  title={__('Compact results summary without individual subject columns', 'codeclove-school-management')}
                >
                  <LayoutList size={13} />
                  <span>{__('Results Summary', 'codeclove-school-management')}</span>
                </button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportLedgerCsv}
                disabled={!tabulationData || studentsList.length === 0}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{__('Export (CSV)', 'codeclove-school-management')}</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handlePrintLedger}
                disabled={!tabulationData || studentsList.length === 0}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{__('Print Ledger', 'codeclove-school-management')}</span>
              </Button>
            </div>
          </div>
          {/* Inline Live KPI Metrics Strip */}
          {ledgerStats && (
            <div className="pt-2.5 border-t border-border flex flex-wrap items-center gap-3 text-xs">
              <div>
                <span className="text-text-subtle">{__('Students:', 'codeclove-school-management')} </span>
                <strong className="text-text tabular-nums font-semibold">{ledgerStats.total}</strong>
              </div>

              {ledgerStats.partial && ledgerStats.partial > 0 && (!ledgerStats.completed || ledgerStats.completed === 0) ? (
                <>
                  <div className="text-border">|</div>
                  <div>
                    <span className="text-text-subtle">{__('Grading In Progress:', 'codeclove-school-management')} </span>
                    <strong className="text-warning tabular-nums font-semibold">{ledgerStats.partial}</strong>
                  </div>
                  {ledgerStats.pending > 0 && (
                    <>
                      <div className="text-border">|</div>
                      <div>
                        <span className="text-text-subtle">{__('Pending:', 'codeclove-school-management')} </span>
                        <strong className="text-text-muted tabular-nums font-semibold">{ledgerStats.pending}</strong>
                      </div>
                    </>
                  )}
                  <div className="text-border">|</div>
                  <div>
                    <span className="text-text-subtle">{__('Pass Rate:', 'codeclove-school-management')} </span>
                    <strong className="text-warning tabular-nums font-semibold">{__('In Progress', 'codeclove-school-management')}</strong>
                  </div>
                  <div className="text-border">|</div>
                  <div>
                    <span className="text-text-subtle">{__('Class Avg:', 'codeclove-school-management')} </span>
                    <strong className="text-text tabular-nums font-semibold">{ledgerStats.avgPercentage}</strong>
                  </div>
                  <div className="text-border">|</div>
                  <div>
                    <span className="text-text-subtle">{__('Top Score:', 'codeclove-school-management')} </span>
                    <strong className="text-brand tabular-nums font-semibold">{ledgerStats.highestPercentage}</strong>
                  </div>
                </>
              ) : ledgerStats.assessed > 0 ? (
                <>
                  {ledgerStats.pending > 0 && (
                    <>
                      <div className="text-border">|</div>
                      <div>
                        <span className="text-text-subtle">{__('Pending:', 'codeclove-school-management')} </span>
                        <strong className="text-warning tabular-nums font-semibold">{ledgerStats.pending}</strong>
                      </div>
                    </>
                  )}
                  <div className="text-border">|</div>
                  <div>
                    <span className="text-text-subtle">{__('Passed:', 'codeclove-school-management')} </span>
                    <strong className="text-success tabular-nums font-semibold">{ledgerStats.passed}</strong>
                  </div>
                  <div className="text-border">|</div>
                  <div>
                    <span className="text-text-subtle">{__('Failed:', 'codeclove-school-management')} </span>
                    <strong className="text-danger tabular-nums font-semibold">{ledgerStats.failed}</strong>
                  </div>
                  <div className="text-border">|</div>
                  <div>
                    <span className="text-text-subtle">{__('Pass Rate:', 'codeclove-school-management')} </span>
                    <strong className="text-text tabular-nums font-semibold">{ledgerStats.passRate}</strong>
                  </div>
                  <div className="text-border">|</div>
                  <div>
                    <span className="text-text-subtle">{__('Class Avg:', 'codeclove-school-management')} </span>
                    <strong className="text-text tabular-nums font-semibold">{ledgerStats.avgPercentage}</strong>
                  </div>
                  <div className="text-border">|</div>
                  <div>
                    <span className="text-text-subtle">{__('Top Score:', 'codeclove-school-management')} </span>
                    <strong className="text-brand tabular-nums font-semibold">{ledgerStats.highestPercentage}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-border">|</div>
                  <span className="text-text-subtle italic">{__('Scoresheet pending — marks not yet submitted', 'codeclove-school-management')}</span>
                </>
              )}
            </div>
          )}
        </div>
      ) : embedded && currentTab === 'report_card' ? (
        <div className="no-print bg-bg-surface/50 dark:bg-bg-surface/60 px-4 py-3 sm:px-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-text whitespace-nowrap">
                {__('Class', 'codeclove-school-management')}:
              </label>
              <div className="w-44 sm:w-48">
                <Select
                  value={selectedUnitId}
                  onValueChange={handleUnitChange}
                  options={unitOptions}
                  placeholder={
                    isLoadingUnits
                      ? __('Loading...', 'codeclove-school-management')
                      : __('Select Class...', 'codeclove-school-management')
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-text-subtle whitespace-nowrap">
                {__('Section', 'codeclove-school-management')}:
              </label>
              <div className="w-36 sm:w-44">
                <Select
                  value={selectedGroupId}
                  onValueChange={handleGroupChange}
                  options={groupOptions}
                  placeholder={
                    !selectedUnitId
                      ? __('Select Class First', 'codeclove-school-management')
                      : __('All Sections', 'codeclove-school-management')
                  }
                  disabled={!selectedUnitId}
                />
              </div>
            </div>

            {Boolean(selectedUnitId && studentsList.length > 0) && (
              <span className="text-xs text-text-subtle font-medium tabular-nums hidden md:inline">
                ({sprintf(__('%d students enrolled', 'codeclove-school-management'), studentsList.length)})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrintBatchReportCards}
              disabled={!studentsList.length || isLoadingTabulation}
              className="h-8 gap-1.5 text-xs font-semibold"
              title={sprintf(__('Print all %d report cards for this class', 'codeclove-school-management'), studentsList.length)}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>
                {studentsList.length > 0
                  ? sprintf(__('Print Class Batch (%d)', 'codeclove-school-management'), studentsList.length)
                  : __('Print Class Batch', 'codeclove-school-management')}
              </span>
            </Button>
          </div>
        </div>
      ) : (
        <Card className="no-print bg-bg-elevated border-border shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  {__('Examination', 'codeclove-school-management')} <span className="text-danger">*</span>
                </label>
                <Select
                  value={selectedExamId}
                  onValueChange={handleExamChange}
                  options={examOptions}
                  placeholder={
                    isLoadingExams
                      ? __('Loading exams...', 'codeclove-school-management')
                      : __('Select Exam...', 'codeclove-school-management')
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  {__('Class', 'codeclove-school-management')} <span className="text-danger">*</span>
                </label>
                <Select
                  value={selectedUnitId}
                  onValueChange={handleUnitChange}
                  options={unitOptions}
                  placeholder={
                    isLoadingUnits
                      ? __('Loading classes...', 'codeclove-school-management')
                      : __('Select Class...', 'codeclove-school-management')
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  {__('Section (Optional)', 'codeclove-school-management')}
                </label>
                <Select
                  value={selectedGroupId}
                  onValueChange={handleGroupChange}
                  options={groupOptions}
                  placeholder={
                    !selectedUnitId
                      ? __('Select Class First', 'codeclove-school-management')
                      : __('All Sections', 'codeclove-school-management')
                  }
                  disabled={!selectedUnitId}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Area */}
      {!isSelectionReady ? (
        embedded ? (
          <div className="py-16 bg-bg-surface">
            <EmptyState
              icon={BookOpen}
              title={__('Select Examination & Class', 'codeclove-school-management')}
              description={__(
                'Choose an examination and academic class above to compute the tabulation matrix and generate student report cards.',
                'codeclove-school-management'
              )}
            />
          </div>
        ) : (
          <Card className="no-print bg-bg-elevated border-border">
            <CardContent className="py-12">
              <EmptyState
                icon={BookOpen}
                title={__('Select Examination & Class', 'codeclove-school-management')}
                description={__(
                  'Choose an examination and academic class above to compute the tabulation matrix and generate student report cards.',
                  'codeclove-school-management'
                )}
              />
            </CardContent>
          </Card>
        )
      ) : currentTab === 'ledger' ? (
        /* ═══════════════════════════════════════════════════════════════════════
           TAB 1: CLASS TABULATION LEDGER
           ═══════════════════════════════════════════════════════════════════════ */
        <div className={embedded ? "" : "space-y-4"}>
          {isLoadingTabulation ? (
            embedded ? (
              <div className="p-6 bg-bg-surface">
                <TableSkeleton rows={10} columns={8} />
              </div>
            ) : (
              <Card className="bg-bg-elevated border-border">
                <CardContent className="p-4">
                  <TableSkeleton rows={10} columns={8} />
                </CardContent>
              </Card>
            )
          ) : isTabulationError ? (
            <Alert variant="danger">
              <div className="flex items-center justify-between w-full">
                <span>{__('Failed to compile examination tabulation ledger.', 'codeclove-school-management')}</span>
                <Button size="sm" variant="secondary" onClick={() => refetchTabulation()} className="h-7 text-xs">
                  {__('Retry', 'codeclove-school-management')}
                </Button>
              </div>
            </Alert>
          ) : !tabulationData || studentsList.length === 0 ? (
            embedded ? (
              <div className="py-16 bg-bg-surface">
                <EmptyState
                  icon={Users}
                  title={__('No tabulation records found', 'codeclove-school-management')}
                  description={__(
                    'No enrolled student marks have been entered for this examination and class yet.',
                    'codeclove-school-management'
                  )}
                />
              </div>
            ) : (
              <Card className="bg-bg-elevated border-border">
                <CardContent className="py-12">
                  <EmptyState
                    icon={Users}
                    title={__('No tabulation records found', 'codeclove-school-management')}
                    description={__(
                      'No enrolled student marks have been entered for this examination and class yet.',
                      'codeclove-school-management'
                    )}
                  />
                </CardContent>
              </Card>
            )
          ) : (
            <div className={embedded ? "" : "space-y-4"}>
              {/* Summary Metrics & Actions Toolbar (Standalone only; embedded has it unified above) */}
              {!embedded && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bg-surface px-4 py-3 rounded-lg border border-border">
                  {ledgerStats && (
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div>
                        <span className="text-text-subtle">{__('Students:', 'codeclove-school-management')} </span>
                        <strong className="text-text tabular-nums font-semibold">{ledgerStats.total}</strong>
                      </div>
                      {ledgerStats.pending > 0 && (
                        <>
                          <div className="text-border">|</div>
                          <div>
                            <span className="text-text-subtle">{__('Pending Evaluation:', 'codeclove-school-management')} </span>
                            <strong className="text-warning tabular-nums font-semibold">{ledgerStats.pending}</strong>
                          </div>
                        </>
                      )}
                      {ledgerStats.partial && ledgerStats.partial > 0 && (!ledgerStats.completed || ledgerStats.completed === 0) ? (
                        <>
                          <div className="text-border">|</div>
                          <div>
                            <span className="text-text-subtle">{__('Grading In Progress:', 'codeclove-school-management')} </span>
                            <strong className="text-warning tabular-nums font-semibold">{ledgerStats.partial}</strong>
                          </div>
                          {ledgerStats.pending > 0 && (
                            <>
                              <div className="text-border">|</div>
                              <div>
                                <span className="text-text-subtle">{__('Pending:', 'codeclove-school-management')} </span>
                                <strong className="text-text-muted tabular-nums font-semibold">{ledgerStats.pending}</strong>
                              </div>
                            </>
                          )}
                          <div className="text-border">|</div>
                          <div>
                            <span className="text-text-subtle">{__('Pass Rate:', 'codeclove-school-management')} </span>
                            <strong className="text-warning tabular-nums font-semibold">{__('In Progress', 'codeclove-school-management')}</strong>
                          </div>
                          <div className="text-border">|</div>
                          <div>
                            <span className="text-text-subtle">{__('Class Avg:', 'codeclove-school-management')} </span>
                            <strong className="text-text tabular-nums font-semibold">{ledgerStats.avgPercentage}</strong>
                          </div>
                          <div className="text-border">|</div>
                          <div>
                            <span className="text-text-subtle">{__('Top Score:', 'codeclove-school-management')} </span>
                            <strong className="text-brand tabular-nums font-semibold">{ledgerStats.highestPercentage}</strong>
                          </div>
                        </>
                      ) : ledgerStats.assessed > 0 ? (
                        <>
                          {ledgerStats.pending > 0 && (
                            <>
                              <div className="text-border">|</div>
                              <div>
                                <span className="text-text-subtle">{__('Pending:', 'codeclove-school-management')} </span>
                                <strong className="text-warning tabular-nums font-semibold">{ledgerStats.pending}</strong>
                              </div>
                            </>
                          )}
                          <div className="text-border">|</div>
                          <div>
                            <span className="text-text-subtle">{__('Passed:', 'codeclove-school-management')} </span>
                            <strong className="text-success tabular-nums font-semibold">{ledgerStats.passed}</strong>
                          </div>
                          <div className="text-border">|</div>
                          <div>
                            <span className="text-text-subtle">{__('Failed:', 'codeclove-school-management')} </span>
                            <strong className="text-danger tabular-nums font-semibold">{ledgerStats.failed}</strong>
                          </div>
                          <div className="text-border">|</div>
                          <div>
                            <span className="text-text-subtle">{__('Pass Rate:', 'codeclove-school-management')} </span>
                            <strong className="text-text tabular-nums font-semibold">{ledgerStats.passRate}</strong>
                          </div>
                          <div className="text-border">|</div>
                          <div>
                            <span className="text-text-subtle">{__('Class Avg:', 'codeclove-school-management')} </span>
                            <strong className="text-text tabular-nums font-semibold">{ledgerStats.avgPercentage}</strong>
                          </div>
                          <div className="text-border">|</div>
                          <div>
                            <span className="text-text-subtle">{__('Top Score:', 'codeclove-school-management')} </span>
                            <strong className="text-brand tabular-nums font-semibold">{ledgerStats.highestPercentage}</strong>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-border">|</div>
                          <span className="text-text-subtle italic">{__('Scoresheet pending — marks not yet submitted', 'codeclove-school-management')}</span>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <div className="inline-flex rounded-md border border-border bg-bg-surface p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setTabulationView('detailed')}
                        className={cn(
                          'px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                          tabulationView === 'detailed'
                            ? 'bg-bg-elevated text-text shadow-xs font-semibold'
                            : 'text-text-muted hover:text-text'
                        )}
                        title={__('Full broadsheet with all subject marks', 'codeclove-school-management')}
                      >
                        <TableProperties size={13} />
                        <span>{__('Full Broadsheet', 'codeclove-school-management')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTabulationView('summary')}
                        className={cn(
                          'px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                          tabulationView === 'summary'
                            ? 'bg-bg-elevated text-text shadow-xs font-semibold'
                            : 'text-text-muted hover:text-text'
                        )}
                        title={__('Compact results summary without individual subject columns', 'codeclove-school-management')}
                      >
                        <LayoutList size={13} />
                        <span>{__('Results Summary', 'codeclove-school-management')}</span>
                      </button>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleExportLedgerCsv}
                      className="h-8 gap-1.5 text-xs font-semibold"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {__('Export Results (CSV)', 'codeclove-school-management')}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handlePrintLedger}
                      className="h-8 gap-1.5 text-xs font-semibold"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {__('Print Tabulation Sheet', 'codeclove-school-management')}
                    </Button>
                  </div>
                </div>
              )}

              {/* High-density Matrix Table */}
              <Card className={embedded ? "bg-bg-surface border-0 rounded-none shadow-none" : "bg-bg-elevated border-border shadow-xs overflow-hidden"}>
                <div className="overflow-x-auto">
                  <TableRoot>
                    <Thead>
                      {/* Row 1: Primary Column Titles */}
                      <Tr>
                        <Th align="center" className="w-16 text-xs sticky left-0 bg-bg-surface z-20 shadow-[1px_0_0_0_var(--border)] pt-2.5 pb-1">
                          {__('Roll No.', 'codeclove-school-management')}
                        </Th>
                        <Th align="left" className="min-w-[170px] text-xs sticky left-16 bg-bg-surface z-20 shadow-[1px_0_0_0_var(--border)] pt-2.5 pb-1">
                          {__('Student', 'codeclove-school-management')}
                        </Th>

                        {/* Subject Paper Columns (Detailed Broadsheet View Only) */}
                        {tabulationView === 'detailed' && tabulationData.subjects.map((subj) => (
                          <Th
                            key={subj.id}
                            align="right"
                            className="w-24 sm:w-28 min-w-[90px] max-w-[125px] text-xs px-2.5 pt-2.5 pb-1.5 font-semibold normal-case tracking-normal whitespace-normal align-bottom"
                            title={`${subj.name} (${subj.code || ''})`}
                          >
                            <div className="font-semibold text-text text-xs leading-snug line-clamp-2 break-words text-end" title={subj.name}>
                              {subj.name}
                            </div>
                          </Th>
                        ))}

                        <Th align="right" className="w-24 text-xs font-semibold pt-2.5 pb-1 whitespace-nowrap">{__('Total Marks', 'codeclove-school-management')}</Th>
                        <Th align="right" className="w-20 text-xs font-semibold pt-2.5 pb-1 whitespace-nowrap">{__('Percentage', 'codeclove-school-management')}</Th>
                        <Th align="center" className="w-16 text-xs font-semibold pt-2.5 pb-1 whitespace-nowrap">{__('Grade', 'codeclove-school-management')}</Th>
                        <Th align="right" className="w-14 text-xs font-semibold pt-2.5 pb-1 whitespace-nowrap">{__('Rank', 'codeclove-school-management')}</Th>
                        <Th align="center" className="w-20 text-xs font-semibold pt-2.5 pb-1 whitespace-nowrap">{__('Result', 'codeclove-school-management')}</Th>
                      </Tr>

                      {/* Row 2: Official Scale Ribbon */}
                      <Tr className="border-t border-border/80 bg-bg-surface/50">
                        <Th align="center" className="text-3xs font-mono text-text-subtle py-1 sticky left-0 bg-bg-surface z-20 shadow-[1px_0_0_0_var(--border)]">
                          —
                        </Th>
                        <Th align="left" className="text-3xs font-semibold uppercase tracking-wider text-text-muted py-1 px-4 sticky left-16 bg-bg-surface z-20 shadow-[1px_0_0_0_var(--border)]">
                          {__('Scale (Max / Pass)', 'codeclove-school-management')}
                        </Th>

                        {/* Subject Paper Scales (Detailed Broadsheet View Only) */}
                        {tabulationView === 'detailed' && tabulationData.subjects.map((subj) => (
                          <Th
                            key={`scale-${subj.id}`}
                            align="right"
                            className="w-24 sm:w-28 min-w-[90px] max-w-[125px] text-3xs font-mono tabular-nums text-text-subtle font-medium py-1 px-2.5 whitespace-nowrap normal-case tracking-normal"
                          >
                            <span className="font-semibold text-text">{subj.max_marks}</span>
                            <span className="text-text-subtle/70"> / {subj.pass_marks}</span>
                          </Th>
                        ))}

                        <Th align="right" className="w-24 text-3xs font-mono tabular-nums text-text-muted font-semibold py-1 px-2.5 whitespace-nowrap">
                          {`Max ${totalPossibleMarks}`}
                        </Th>
                        <Th align="right" className="w-20 text-3xs font-mono tabular-nums text-text-subtle py-1 px-2.5 whitespace-nowrap">
                          {minPassPercentage ? `Min ${minPassPercentage}%` : '—'}
                        </Th>
                        <Th align="center" className="w-16 text-3xs text-text-subtle font-mono py-1">
                          —
                        </Th>
                        <Th align="right" className="w-14 text-3xs text-text-subtle font-mono py-1">
                          —
                        </Th>
                        <Th align="center" className="w-20 text-3xs text-text-subtle font-mono py-1">
                          —
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {studentsList.map((student) => {
                        const hasAnyMark = tabulationData.subjects.some((subj) => {
                          const item = student.marks?.[subj.id]
                          return (
                            item &&
                            (item.is_absent ||
                              item.status === 'absent' ||
                              (item.marks_obtained !== null && item.marks_obtained !== undefined))
                          )
                        })
                        const isPending = !hasAnyMark

                        return (
                        <Tr
                          key={student.student_id}
                          className={`transition-colors hover:bg-hover-bg/60 ${
                            !isPending && student.has_failed ? 'bg-danger-dim/5' : ''
                          }`}
                        >
                          {/* Roll Number */}
                          <Td align="center" className="font-mono text-xs text-text-subtle tabular-nums sticky left-0 bg-bg-elevated z-10 shadow-[1px_0_0_0_var(--border)]">
                            {student.roll_number || '—'}
                          </Td>

                          {/* Student Name */}
                          <Td align="left" className="font-medium text-text text-sm whitespace-nowrap sticky left-16 bg-bg-elevated z-10 shadow-[1px_0_0_0_var(--border)]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{student.student_name}</span>
                              {student.group_name && (
                                <span className="text-3xs px-1.5 py-0.2 rounded bg-bg-surface border border-border text-text-muted font-normal">
                                  {student.group_name}
                                </span>
                              )}
                            </div>
                            <div className="text-3xs font-mono text-text-subtle">{student.student_number}</div>
                          </Td>

                          {/* Marks for each subject paper (Detailed Broadsheet View Only) */}
                          {tabulationView === 'detailed' && tabulationData.subjects.map((subj) => {
                            const item = student.marks?.[subj.id]
                            const marks = item?.marks_obtained
                            const isAbsent = Boolean(item?.is_absent || item?.status === 'absent')
                            const isExempt = Boolean(item?.is_exempt || item?.status === 'exempt')
                            const isBelowPass = marks != null && marks < subj.pass_marks

                            return (
                              <Td
                                key={subj.id}
                                align="right"
                                className="font-mono text-xs tabular-nums px-2.5 py-2.5 w-24 sm:w-28 min-w-[90px] max-w-[125px]"
                              >
                                {isAbsent ? (
                                  <span className="text-danger font-bold text-3xs">{__('ABS', 'codeclove-school-management')}</span>
                                ) : isExempt ? (
                                  <span className="text-text-subtle text-3xs">{__('EXM', 'codeclove-school-management')}</span>
                                ) : item?.is_enrolled === false || item?.status === 'not_applicable' ? (
                                  <span className="text-text-subtle/40 text-xs font-mono select-none" title={__('Not enrolled in this subject', 'codeclove-school-management')}>—</span>
                                ) : marks != null ? (
                                  <span className={isBelowPass ? 'text-danger font-bold' : 'text-text'}>
                                    {marks}
                                  </span>
                                ) : (
                                  <span className="text-text-subtle">—</span>
                                )}
                              </Td>
                            )
                          })}

                          {/* Total Obtained */}
                          <Td align="right" className="font-mono text-xs tabular-nums font-semibold text-text whitespace-nowrap">
                            {!isPending ? (
                              <>
                                <span>{student.total_marks_obtained}</span>
                                <span className="text-text-subtle text-3xs font-normal"> / {student.total_marks_possible}</span>
                              </>
                            ) : (
                              <span className="text-text-subtle font-normal">—</span>
                            )}
                          </Td>

                          {/* Percentage */}
                          <Td align="right" className="font-mono text-xs tabular-nums font-semibold">
                            {!isPending ? (
                              <span className={student.has_failed ? 'text-danger' : 'text-text'}>
                                {student.percentage.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-text-subtle font-normal">—</span>
                            )}
                          </Td>

                          {/* Overall Grade */}
                          <Td align="center">
                            {!isPending && student.grade ? (
                              <Badge
                                variant={student.has_failed ? 'danger' : 'brand'}
                                className="font-bold text-xs"
                              >
                                {student.grade}
                              </Badge>
                            ) : (
                              <span className="text-text-subtle text-xs">—</span>
                            )}
                          </Td>

                          {/* Rank */}
                          <Td align="right" className="font-mono text-xs tabular-nums font-medium text-text">
                            {!isPending && student.rank ? `#${student.rank}` : '—'}
                          </Td>

                          {/* Result Badge */}
                          <Td align="center">
                            {isPending ? (
                              <Badge variant="neutral" className="text-3xs uppercase font-medium tracking-wider">
                                {__('Pending', 'codeclove-school-management')}
                              </Badge>
                            ) : student.is_partial || student.result_status === 'partial' ? (
                              <Badge variant="warning" className="text-3xs uppercase font-bold tracking-wider">
                                {student.evaluated_papers && student.total_papers
                                  ? sprintf(__('Partial (%d/%d)', 'codeclove-school-management'), student.evaluated_papers, student.total_papers)
                                  : __('In Progress', 'codeclove-school-management')}
                              </Badge>
                            ) : student.has_failed || student.result_status === 'failed' ? (
                              <Badge variant="danger" className="text-3xs uppercase font-bold tracking-wider">
                                {__('Failed', 'codeclove-school-management')}
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-3xs uppercase font-bold tracking-wider">
                                {__('Passed', 'codeclove-school-management')}
                              </Badge>
                            )}
                          </Td>
                        </Tr>
                      )})}
                    </Tbody>
                  </TableRoot>
                </div>
              </Card>

              {/* Dedicated Publication-Grade Tabulation Broadsheet Document for Print */}
              <div
                style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '297mm' }}
                aria-hidden="true"
              >
                {tabulationData && (
                  <TabulationLedgerDocument
                    ref={ledgerPrintRef}
                    viewMode={tabulationView}
                    exam={baseExam}
                    school={baseSchool}
                    academicUnitName={tabulationData.academic_unit_name}
                    sectionName={selectedGroupName}
                    subjects={tabulationData.subjects}
                    students={studentsList}
                    stats={ledgerStats}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════════════
           TAB 2: PRINTABLE REPORT CARD
           ═══════════════════════════════════════════════════════════════════════ */
        <div className={embedded ? "p-4 sm:p-6 space-y-4" : "space-y-6"}>
          {/* Controls & Action Header (when not embedded) */}
          {!embedded && (
            <Card className="no-print bg-bg-elevated border-border shadow-xs">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                  {/* Student Selector */}
                  <div className="w-full sm:w-72">
                    <label className="block text-xs font-semibold text-text mb-1">
                      {__('Student', 'codeclove-school-management')}
                    </label>
                    <Select
                      value={selectedStudentId}
                      onValueChange={handleStudentChange}
                      options={studentOptions}
                      placeholder={__('Choose Student...', 'codeclove-school-management')}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePrintBatchReportCards}
                    disabled={!studentsList.length || isLoadingTabulation}
                    className="h-8 gap-1.5 text-xs font-semibold"
                    title={sprintf(__('Print all %d report cards in batch', 'codeclove-school-management'), studentsList.length)}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>{__('Print Class Batch', 'codeclove-school-management')}</span>
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={handlePrintReportCard}
                    disabled={!selectedStudentId || isLoadingReportCard}
                    className="h-8 gap-1.5 text-xs font-semibold"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>{__('Print Report Card', 'codeclove-school-management')}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}


          {/* Report Card Canvas Body */}
          {isLoadingReportCard ? (
            embedded ? (
              <div className="p-8 bg-bg-surface max-w-4xl mx-auto rounded-lg border border-border">
                <TableSkeleton rows={8} columns={5} />
              </div>
            ) : (
              <Card className="no-print bg-bg-elevated border-border">
                <CardContent className="p-8">
                  <TableSkeleton rows={8} columns={5} />
                </CardContent>
              </Card>
            )
          ) : isReportCardError ? (
            <Alert variant="danger" className="no-print">
              <div className="flex items-center justify-between w-full">
                <span>{__('Failed to generate student report card.', 'codeclove-school-management')}</span>
                <Button size="sm" variant="secondary" onClick={() => refetchReportCard()} className="h-7 text-xs">
                  {__('Retry', 'codeclove-school-management')}
                </Button>
              </div>
            </Alert>
          ) : !reportCardData ? (
            embedded ? (
              <div className="py-16 bg-bg-surface max-w-4xl mx-auto rounded-lg border border-border">
                <EmptyState
                  icon={FileText}
                  title={__('No student report card selected', 'codeclove-school-management')}
                  description={__(
                    'Select an enrolled student from the dropdown above to render the printable academic report card.',
                    'codeclove-school-management'
                  )}
                />
              </div>
            ) : (
              <Card className="no-print bg-bg-elevated border-border">
                <CardContent className="py-12">
                  <EmptyState
                    icon={FileText}
                    title={__('No student report card selected', 'codeclove-school-management')}
                    description={__(
                      'Select an enrolled student from the dropdown above to render the printable academic report card.',
                      'codeclove-school-management'
                    )}
                  />
                </CardContent>
              </Card>
            )
          ) : (
            <>
            <div className="w-full">
              {/* ─── Integrated Document Studio Workbench (Docked Toolbar) ─── */}
              <div className="no-print bg-bg-surface border border-border rounded-t-xl px-3.5 py-2 flex items-center justify-between gap-2 sm:gap-3 text-xs shadow-xs overflow-x-auto">
                {/* Left: Unified Student Navigator (Stepper + Quick-Jump Select) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="inline-flex items-center rounded-lg border border-border bg-bg-elevated p-0.5 shadow-2xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrevStudent}
                      disabled={currentStudentIndex <= 0}
                      className="h-7 w-7 p-0 text-text hover:text-text-emphasis disabled:opacity-30"
                      title={__('Previous Student (or press [)', 'codeclove-school-management')}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="w-64 sm:w-80 md:w-96 px-0.5">
                      <Select
                        value={selectedStudentId}
                        onValueChange={handleStudentChange}
                        options={studentOptions}
                        placeholder={__('Choose Student...', 'codeclove-school-management')}
                        className="border-0 shadow-none h-7 text-xs bg-transparent focus:ring-0 font-medium"
                      />
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNextStudent}
                      disabled={currentStudentIndex < 0 || currentStudentIndex >= studentsList.length - 1}
                      className="h-7 w-7 p-0 text-text hover:text-text-emphasis disabled:opacity-30"
                      title={__('Next Student (or press ])', 'codeclove-school-management')}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Right: Layout Customizer Popover, Viewport Controls, and Primary Print CTA */}
                <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                  {/* Customize Layout Popover */}
                  <Popover
                    trigger={
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-medium"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 text-text-subtle" />
                        <span>{__('Customize Layout', 'codeclove-school-management')}</span>
                        <span className="ms-0.5 px-1.5 py-0.2 rounded-full bg-brand/10 text-brand text-3xs font-semibold">
                          {activeOptionsCount}/{LAYOUT_TOGGLES.length}
                        </span>
                      </Button>
                    }
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <span className="font-semibold text-text text-xs">
                          {__('Visible Sections & Columns', 'codeclove-school-management')}
                        </span>
                        <span className="text-3xs text-text-subtle">
                          {sprintf(__('%d of %d active', 'codeclove-school-management'), activeOptionsCount, LAYOUT_TOGGLES.length)}
                        </span>
                      </div>

                        {/* Document Paper Format */}
                        <div className="flex items-center justify-between pb-2 border-b border-border">
                          <span className="text-xs font-semibold text-text">{__('Paper Format', 'codeclove-school-management')}</span>
                          <div className="inline-flex rounded border border-border p-0.5 bg-bg-surface text-3xs font-medium">
                            <button
                              type="button"
                              onClick={() => handlePaperFormatChange('a4')}
                              className={cn(
                                'px-2 py-0.5 rounded transition-colors',
                                paperFormat === 'a4' ? 'bg-brand text-white font-bold shadow-xs' : 'text-text-muted hover:text-text'
                              )}
                              title={__('ISO A4 Standard (210 × 297 mm)', 'codeclove-school-management')}
                            >
                              A4
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePaperFormatChange('letter')}
                              className={cn(
                                'px-2 py-0.5 rounded transition-colors',
                                paperFormat === 'letter' ? 'bg-brand text-white font-bold shadow-xs' : 'text-text-muted hover:text-text'
                              )}
                              title={__('US Letter (8.5 × 11 in)', 'codeclove-school-management')}
                            >
                              Letter
                            </button>
                          </div>
                        </div>

                        {/* Group 1: Scores & Assessment */}
                        <div className="space-y-1.5">
                          <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                            {__('Scores & Assessment', 'codeclove-school-management')}
                          </span>
                          <div className="space-y-1">
                            {LAYOUT_TOGGLES.filter((t) => t.group === 'scores').map((t) => (
                              <Checkbox
                                key={t.key}
                                id={`pop-opt-${t.key}`}
                                label={t.label}
                                checked={Boolean(printOptions[t.key])}
                                onChange={(e) => setPrintOptions((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                                labelClassName="text-xs font-normal text-text"
                                containerClassName="flex cursor-pointer"
                              />
                            ))}
                          </div>
                        </div>

                        {/* Group 2: Student Profile */}
                        <div className="space-y-1.5 pt-2 border-t border-border">
                          <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                            {__('Student Profile', 'codeclove-school-management')}
                          </span>
                          <div className="space-y-1">
                            {LAYOUT_TOGGLES.filter((t) => t.group === 'student').map((t) => (
                              <Checkbox
                                key={t.key}
                                id={`pop-opt-${t.key}`}
                                label={t.label}
                                checked={Boolean(printOptions[t.key])}
                                onChange={(e) => setPrintOptions((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                                labelClassName="text-xs font-normal text-text"
                                containerClassName="flex cursor-pointer"
                              />
                            ))}
                          </div>
                        </div>

                        {/* Group 3: Institutional */}
                        <div className="space-y-1.5 pt-2 border-t border-border">
                          <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                            {__('Institutional Endorsements', 'codeclove-school-management')}
                          </span>
                          <div className="space-y-1">
                            {LAYOUT_TOGGLES.filter((t) => t.group === 'institutional').map((t) => (
                              <Checkbox
                                key={t.key}
                                id={`pop-opt-${t.key}`}
                                label={t.label}
                                checked={Boolean(printOptions[t.key])}
                                onChange={(e) => setPrintOptions((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                                labelClassName="text-xs font-normal text-text"
                                containerClassName="flex cursor-pointer"
                              />
                            ))}
                          </div>
                        </div>
                        {/* Popover Footer: Quick Actions */}
                        <div className="pt-2 border-t border-border flex items-center justify-between text-3xs">
                          <button
                            type="button"
                            onClick={handleResetOptionsToDefault}
                            className="text-text-muted hover:text-text font-medium flex items-center gap-1 transition-colors"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>{__('Reset', 'codeclove-school-management')}</span>
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleSelectAllOptions}
                              className="text-text-muted hover:text-text font-medium"
                            >
                              {__('Select All', 'codeclove-school-management')}
                            </button>
                            <span className="text-border">|</span>
                            <button
                              type="button"
                              onClick={handleSaveAsDefault}
                              disabled={updateExamMutation.isPending || !selectedExam}
                              className="text-brand hover:underline font-semibold"
                            >
                              {updateExamMutation.isPending ? __('Saving...', 'codeclove-school-management') : __('Save as Default', 'codeclove-school-management')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </Popover>

                    {/* Primary Print Report Card Action */}
                    <div className="border-s border-border ps-2.5 sm:ps-3">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handlePrintReportCard}
                        disabled={!selectedStudentId || isLoadingReportCard}
                        className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>{__('Print Report Card', 'codeclove-school-management')}</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ─── Document Stage Preview Container (Docked to Toolbar) ─── */}
                <div className="bg-slate-200/60 dark:bg-slate-900/40 p-4 sm:p-8 rounded-b-xl border border-border border-t-0 flex justify-center overflow-x-auto shadow-inner min-h-[520px]">
                  <div
                    ref={reportCardRef}
                    className={cn(
                      'shadow-xl rounded-xs bg-white w-full',
                      paperFormat === 'letter' ? 'max-w-[816px]' : 'max-w-[794px]'
                    )}
                  >
                  <ReportCardDocument
                    data={reportCardData}
                    options={{
                      ...printOptions,
                      totalStudents: studentsList.length || reportCardData.summary?.total_students || undefined,
                    }}
                  />
                </div>
              </div>
            </div>
              {/* ─── Off-Screen Batch Print Canvas ─── */}
              <div
                ref={batchPrintRef}
                style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: paperFormat === 'letter' ? '8.5in' : '210mm' }}
                aria-hidden="true"
              >
                {batchStudentsData.map((studentCard, sIdx) => (
                  <div
                    key={studentCard.student.id || sIdx}
                    className={sIdx < batchStudentsData.length - 1 ? 'print-page-break' : ''}
                  >
                    <ReportCardDocument
                      data={studentCard}
                      options={{
                        ...printOptions,
                        totalStudents: studentsList.length || studentCard.summary?.total_students || undefined,
                      }}
                      id={`batch-report-card-${studentCard.student.id}`}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
