/**
 * ExamMarksPage — High-density spreadsheet mark entry grid.
 *
 * Provides rapid keyboard-driven score entry (Arrow Up/Down, Enter),
 * status shortcuts (A for Absent, P for Present, E for Exempt),
 * live percentage & grade calculation against grading scales,
 * visual fail thresholds, CSV export/import, and bulk persistence.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  Download,
  Upload,
  Save,
  Users,
  RotateCcw,
} from 'lucide-react'
import { useExams, useExamTimetable, useExamMarks, useSaveExamMarks, useGradingScales } from '@/api/exams'
import { useUnits, useGroups } from '@/api/academics'
import { useConfirm } from '@/lib/confirm'
import { useToast } from '@/lib/toast'
import { exportToCSV, parseCSVText } from '@/lib/csv'
import { ROUTES } from '@/lib/constants'
import { __, sprintf } from '@/lib/i18n'
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  Select,
  type SelectOption,
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
} from '@/components/ui'

interface LocalMarkRow {
  marks_obtained: number | null
  theory_marks?: number | null
  practical_marks?: number | null
  status: 'present' | 'absent' | 'exempt'
  remarks: string
}

const REMARKS_PRESETS = [
  'Outstanding performance',
  'Consistent effort & good understanding',
  'Demonstrated solid grasp of concepts',
  'Satisfactory progress shown',
  'Needs remedial assistance in core topics',
  'Careless calculation errors noted',
  'Incomplete long-answer sections',
  'Exemplary presentation & neatness',
  'Requires revision of fundamentals',
  'Active participation in class discussions',
]
export interface ExamMarksPageProps {
  examId?: number
  embedded?: boolean
}

export default function ExamMarksPage({ examId: propExamId, embedded = false }: ExamMarksPageProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()

  // ─── URL Query Param Sync ──────────────────────────────────────────────────
  const initialExamId = propExamId ? String(propExamId) : (searchParams.get('exam_id') || '')
  const initialUnitId = searchParams.get('unit_id') || ''
  const initialGroupId = searchParams.get('group_id') || ''
  const initialSubjectId = searchParams.get('subject_id') || ''

  // ─── Selectors State ────────────────────────────────────────────────────────
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(initialUnitId)
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId)

  // Track unit changes to avoid wiping searchParams on initial mount
  const prevUnitIdRef = useRef<string>(initialUnitId)

  // Sync state if URL search parameters change externally
  useEffect(() => {
    if (propExamId) {
      setSelectedExamId(String(propExamId))
    } else {
      const qExam = searchParams.get('exam_id') || ''
      if (qExam !== selectedExamId) setSelectedExamId(qExam)
    }
    const qUnit = searchParams.get('unit_id') || ''
    const qGroup = searchParams.get('group_id') || ''
    const qSubject = searchParams.get('subject_id') || ''

    if (qUnit !== selectedUnitId) setSelectedUnitId(qUnit)
    if (qGroup !== selectedGroupId) setSelectedGroupId(qGroup)
    if (qSubject !== selectedSubjectId) setSelectedSubjectId(qSubject)
  }, [searchParams, propExamId])
  const handleExamChange = (val: string) => {
    setSelectedExamId(val)
    setSelectedSubjectId('')
    const next = new URLSearchParams(searchParams)
    if (val) next.set('exam_id', val)
    else next.delete('exam_id')
    next.delete('subject_id')
    setSearchParams(next, { replace: true })
  }

  const handleUnitChange = (val: string) => {
    setSelectedUnitId(val)
    setSelectedGroupId('')
    setSelectedSubjectId('')
    prevUnitIdRef.current = val
    const next = new URLSearchParams(searchParams)
    if (val) next.set('unit_id', val)
    else next.delete('unit_id')
    next.delete('group_id')
    next.delete('subject_id')
    setSearchParams(next, { replace: true })
  }

  const handleGroupChange = (val: string) => {
    setSelectedGroupId(val)
    const next = new URLSearchParams(searchParams)
    if (val) next.set('group_id', val)
    else next.delete('group_id')
    setSearchParams(next, { replace: true })
  }

  const handleSubjectChange = (val: string) => {
    setSelectedSubjectId(val)
    const next = new URLSearchParams(searchParams)
    if (val) next.set('subject_id', val)
    else next.delete('subject_id')
    setSearchParams(next, { replace: true })
  }

  // ─── Local spreadsheet state: student_id -> mark details ───────────────────
  const [localMarks, setLocalMarks] = useState<Record<number, LocalMarkRow>>({})
  const [hasInitialized, setHasInitialized] = useState<boolean>(false)

  // Input focus refs array for keyboard navigation (indexed by student position)
  const markInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const remarkInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const csvFileInputRef = useRef<HTMLInputElement | null>(null)

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

  // Scope units to the selected exam's session
  const targetSessionId = selectedExam?.academic_session_id
  const { data: unitsResponse, isLoading: isLoadingUnits } = useUnits(
    targetSessionId ? { session_id: targetSessionId, per_page: 100 } : { per_page: 100 }
  )
  const units = unitsResponse?.data ?? []

  // All papers scheduled for this exam across all units
  const { data: allExamPapers = [] } = useExamTimetable(numExamId)

  const numUnitId = Number(selectedUnitId) || 0

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

  const { data: groupsResponse } = useGroups(
    selectedUnitId ? { academic_unit_id: Number(selectedUnitId) } : undefined
  )
  const groups = groupsResponse?.data ?? []

  const numGroupId = Number(selectedGroupId) || undefined
  const numSubjectId = Number(selectedSubjectId) || 0

  // Timetable papers for the selected exam + unit
  const {
    data: timetablePapers = [],
    isLoading: isLoadingPapers,
  } = useExamTimetable(numExamId, numUnitId)

  // Auto-select paper for the chosen unit: prefer matching URL param, or first paper
  useEffect(() => {
    if (timetablePapers.length > 0) {
      const qSub = searchParams.get('subject_id')
      if (qSub && timetablePapers.some((p) => String(p.subject_id) === qSub)) {
        if (selectedSubjectId !== qSub) setSelectedSubjectId(qSub)
      } else if (!selectedSubjectId || !timetablePapers.some((p) => String(p.subject_id) === selectedSubjectId)) {
        const first = timetablePapers[0]
        if (first) setSelectedSubjectId(String(first.subject_id))
      }
    }
  }, [timetablePapers, selectedSubjectId, searchParams])

  // Marks roster for the selected exam + unit + subject (+ optional group)
  const {
    data: marksRoster = [],
    isLoading: isLoadingMarks,
    isError: isMarksError,
    refetch: refetchMarks,
  } = useExamMarks(numExamId, numUnitId, numSubjectId, numGroupId)
  // Grading scales for live grade tier resolution
  const { data: gradingScales = [] } = useGradingScales()

  // Save mutation
  const saveMarksMutation = useSaveExamMarks()

  // ─── Derived Selected Entities ──────────────────────────────────────────────
  const selectedPaper = useMemo(
    () => timetablePapers.find((p) => p.subject_id === numSubjectId),
    [timetablePapers, numSubjectId]
  )

  const maxMarks = selectedPaper?.max_marks ?? 100
  const passMarks = selectedPaper?.pass_marks ?? 40
  const isComposite = selectedPaper?.assessment_mode === 'theory_practical'
  const isPracticalOnly = selectedPaper?.assessment_mode === 'practical_only'
  const theoryMax = Number(selectedPaper?.theory_max_marks) > 0 ? Number(selectedPaper?.theory_max_marks) : 70
  const practicalMax = Number(selectedPaper?.practical_max_marks) > 0 ? Number(selectedPaper?.practical_max_marks) : 30
  const activeScale = useMemo(() => {
    if (selectedExam?.grading_scale_id) {
      const matched = gradingScales.find((s) => s.id === selectedExam.grading_scale_id)
      if (matched) return matched
    }
    return gradingScales.find((s) => s.is_default) || gradingScales[0] || null
  }, [selectedExam, gradingScales])

  // Sync server marks into localMarks when roster loads or selectors change
  useEffect(() => {
    if (!marksRoster) return

    const initialMap: Record<number, LocalMarkRow> = {}
    marksRoster.forEach((m) => {
      initialMap[m.student_id] = {
        marks_obtained: m.marks_obtained,
        theory_marks: m.theory_marks,
        practical_marks: m.practical_marks,
        status: m.status || 'present',
        remarks: m.remarks || '',
      }
    })
    setLocalMarks(initialMap)
    setHasInitialized(true)
  }, [marksRoster, numExamId, numUnitId, numSubjectId, numGroupId])

  // Check if teacher has made unsaved edits
  const isDirty = useMemo(() => {
    if (!marksRoster || marksRoster.length === 0 || !hasInitialized) return false
    return marksRoster.some((m) => {
      const local = localMarks[m.student_id]
      if (!local) return false
      return (
        local.marks_obtained !== m.marks_obtained ||
        local.theory_marks !== m.theory_marks ||
        local.practical_marks !== m.practical_marks ||
        local.status !== m.status ||
        local.remarks !== (m.remarks || '')
      )
    })
  }, [marksRoster, localMarks, hasInitialized])

  // ─── Grade Resolution Helper ────────────────────────────────────────────────
  const evaluateGrade = useCallback(
    (percentage: number): { label: string; is_pass: boolean } => {
      const tiers = activeScale?.tiers
      if (!tiers?.length) {
        return { label: percentage >= 33 ? 'P' : 'F', is_pass: percentage >= 33 }
      }
      const matched = tiers.find((t) => percentage >= t.min && percentage <= t.max)
        ?? tiers.find((t) => percentage >= t.min)
        ?? tiers[tiers.length - 1]
      return { label: matched?.label || '—', is_pass: Boolean(matched?.is_pass) }
    },
    [activeScale]
  )

  // ─── Cell Update Handlers ───────────────────────────────────────────────────
  const updateStudentMark = useCallback(
    (studentId: number, field: keyof LocalMarkRow, value: unknown) => {
      setLocalMarks((prev) => {
        const current = prev[studentId] || { marks_obtained: null, status: 'present', remarks: '' }
        const updated = {
          ...current,
          [field]: value,
        }
        if (field === 'theory_marks' || field === 'practical_marks') {
          const th = field === 'theory_marks' ? (value as number | null) : current.theory_marks
          const pr = field === 'practical_marks' ? (value as number | null) : current.practical_marks
          if (th !== null || pr !== null) {
            updated.marks_obtained = Number(th ?? 0) + Number(pr ?? 0)
          } else {
            updated.marks_obtained = null
          }
        }
        return {
          ...prev,
          [studentId]: updated,
        }
      })
    },
    []
  )

  // ─── Keyboard Navigation & Shortcuts ─────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, studentId: number, index: number, totalCount: number) => {
      const key = e.key
      if (key === 'ArrowDown' || (key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        if (index + 1 < totalCount) markInputRefs.current[index + 1]?.focus()
      } else if (key === 'ArrowUp' || (key === 'Enter' && e.shiftKey)) {
        e.preventDefault()
        if (index - 1 >= 0) markInputRefs.current[index - 1]?.focus()
      } else if (key === 'a' || key === 'A') {
        e.preventDefault()
        updateStudentMark(studentId, 'status', 'absent')
        updateStudentMark(studentId, 'marks_obtained', 0)
      } else if (key === 'p' || key === 'P') {
        e.preventDefault()
        updateStudentMark(studentId, 'status', 'present')
      } else if (key === 'e' || key === 'E') {
        e.preventDefault()
        updateStudentMark(studentId, 'status', 'exempt')
        updateStudentMark(studentId, 'marks_obtained', null)
      }
    },
    [updateStudentMark]
  )

  const handleRemarkKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, index: number, totalCount: number) => {
    if ((e.key === 'Enter' || e.key === 'ArrowDown') && index + 1 < totalCount) {
      e.preventDefault()
      markInputRefs.current[index + 1]?.focus()
    } else if (e.key === 'ArrowUp' && index - 1 >= 0) {
      e.preventDefault()
      remarkInputRefs.current[index - 1]?.focus()
    }
  }, [])
  // ─── Roster Summary Statistics ──────────────────────────────────────────────
  const stats = useMemo(() => {
    let presentCount = 0
    let absentCount = 0
    let exemptCount = 0
    let passCount = 0
    let failCount = 0

    marksRoster.forEach((m) => {
      const record = localMarks[m.student_id]
      const status = record?.status ?? m.status ?? 'present'
      const marks = record?.marks_obtained ?? m.marks_obtained

      if (status === 'absent') {
        absentCount++
        failCount++
      } else if (status === 'exempt') {
        exemptCount++
      } else {
        presentCount++
        if (marks !== null && marks !== undefined) {
          if (marks >= passMarks) {
            passCount++
          } else {
            failCount++
          }
        }
      }
    })

    return {
      total: marksRoster.length,
      presentCount,
      absentCount,
      exemptCount,
      passCount,
      failCount,
    }
  }, [marksRoster, localMarks, passMarks])

  // ─── Actions: Save All Marks ────────────────────────────────────────────────
  const handleSaveMarks = async () => {
    if (!numExamId || !numUnitId || !numSubjectId) {
      toast.error(__('Please select Exam, Class, and Subject Paper before saving.', 'codeclove-school-management'))
      return
    }

    const payloadMarks = marksRoster.map((m) => {
      const local = localMarks[m.student_id]
      return {
        student_id: m.student_id,
        marks_obtained: local ? local.marks_obtained : m.marks_obtained,
        theory_marks: local ? local.theory_marks : m.theory_marks,
        practical_marks: local ? local.practical_marks : m.practical_marks,
        status: local ? local.status : m.status || 'present',
        remarks: local ? local.remarks : m.remarks,
      }
    })

    // Validation: marks must not exceed maxMarks or be negative
    const invalidEntry = payloadMarks.find((p) => {
      if (p.status === 'present' && p.marks_obtained !== null && p.marks_obtained !== undefined) {
        return p.marks_obtained < 0 || p.marks_obtained > maxMarks
      }
      return false
    })

    if (invalidEntry) {
      toast.error(
        sprintf(
          __('Marks must be between 0 and %d.', 'codeclove-school-management'),
          maxMarks
        )
      )
      return
    }

    try {
      await saveMarksMutation.mutateAsync({
        examId: numExamId,
        unit_id: numUnitId,
        subject_id: numSubjectId,
        marks: payloadMarks,
      })
      toast.success(
        sprintf(
          __('Marks successfully saved for %d students.', 'codeclove-school-management'),
          payloadMarks.length
        )
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __('Failed to save marks.', 'codeclove-school-management')
      toast.error(message)
    }
  }

  // ─── Discard Changes ─────────────────────────────────────────────────────────
  const handleDiscardChanges = async () => {
    const confirmed = await confirm({
      title: __('Discard Changes', 'codeclove-school-management'),
      message: __('Are you sure you want to discard all unsaved mark changes for this paper?', 'codeclove-school-management'),
      variant: 'danger',
      confirmText: __('Discard Changes', 'codeclove-school-management'),
    })

    if (confirmed) {
      const initialMap: Record<number, LocalMarkRow> = {}
      marksRoster.forEach((m) => {
        initialMap[m.student_id] = {
          marks_obtained: m.marks_obtained,
          status: m.status || 'present',
          remarks: m.remarks || '',
        }
      })
      setLocalMarks(initialMap)
      toast.info(__('Unsaved changes discarded.', 'codeclove-school-management'))
    }
  }

  // ─── Actions: CSV Template Download ──────────────────────────────────────────
  const handleDownloadCsvTemplate = () => {
    if (!marksRoster.length) {
      toast.info(__('No students to export.', 'codeclove-school-management'))
      return
    }
    const headers = ['Student ID', 'Roll Number', 'Student Name', 'Marks Obtained', 'Status', 'Remarks']
    const rows = marksRoster.map((m) => {
      const local = localMarks[m.student_id]
      return [m.student_id, m.roll_number || '', m.student_name, local?.marks_obtained ?? '', local?.status || 'present', local?.remarks || '']
    })
    exportToCSV(`marks_${selectedExam?.name || 'Exam'}`, headers, rows)
    toast.success(__('CSV template downloaded.', 'codeclove-school-management'))
  }

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      if (!text) return
      try {
        const records = parseCSVText(text)
        const updatedLocal = { ...localMarks }
        let count = 0
        for (const row of records) {
          const sid = Number(row['student_id'] || row['id'])
          const student = marksRoster.find((s) => s.student_id === sid || (row['roll_number'] && s.roll_number === row['roll_number']))
          if (!student) continue
          const rawMark = row['marks_obtained'] ?? row['marks']
          const parsedMark = rawMark !== undefined && rawMark !== '' ? Number(rawMark) : null
          const st = row['status']?.toLowerCase()
          const status = st?.startsWith('a') ? 'absent' : st?.startsWith('e') ? 'exempt' : 'present'
          updatedLocal[student.student_id] = {
            marks_obtained: isNaN(parsedMark as number) ? null : parsedMark,
            status,
            remarks: row['remarks'] || '',
          }
          count++
        }
        setLocalMarks(updatedLocal)
        toast.success(sprintf(__('Imported marks for %d students.', 'codeclove-school-management'), count))
      } catch {
        toast.error(__('Failed to parse CSV.', 'codeclove-school-management'))
      } finally {
        if (csvFileInputRef.current) csvFileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }
  // ─── Filter Options ─────────────────────────────────────────────────────────
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

  const paperOptions: SelectOption[] = timetablePapers.map((p) => {
    let modeSuffix = ''
    if (p.assessment_mode === 'theory_practical') {
      modeSuffix = ` · ${__('Theory + Practical', 'codeclove-school-management')}`
    } else if (p.assessment_mode === 'practical_only') {
      modeSuffix = ` · ${__('Practical Only', 'codeclove-school-management')}`
    } else if (p.assessment_mode === 'grade_only') {
      modeSuffix = ` · ${__('Grade Only', 'codeclove-school-management')}`
    }
    const baseName = p.subject_code ? `${p.subject_name} (${p.subject_code})` : p.subject_name
    return {
      value: String(p.subject_id),
      label: `${baseName}${modeSuffix}`,
      description:
        p.assessment_mode === 'theory_practical'
          ? sprintf(
              __('Theory (%d) + Practical (%d) · Total %d', 'codeclove-school-management'),
              p.theory_max_marks || 70,
              p.practical_max_marks || 30,
              p.max_marks || 100
            )
          : p.assessment_mode === 'practical_only'
          ? sprintf(__('Practical Only (Max %d)', 'codeclove-school-management'), p.max_marks || 100)
          : p.assessment_mode === 'grade_only'
          ? __('Direct Grade Only', 'codeclove-school-management')
          : sprintf(__('Theory Only (Max %d)', 'codeclove-school-management'), p.max_marks || 100),
    }
  })

  // ─── Render ─────────────────────────────────────────────────────────────────
  const isSelectionComplete = Boolean(numExamId && numUnitId && numSubjectId)

  return (
    <div className={embedded ? "" : "space-y-6"}>
      {!embedded && (
        <>
          <PageHeader
            title={__('Enter Marks', 'codeclove-school-management')}
            description={__(
              'Record student marks, attendance, and grades for this exam paper.',
              'codeclove-school-management'
            )}
            breadcrumbs={[
              { label: __('Examinations', 'codeclove-school-management'), href: ROUTES.EXAMS },
              { label: __('Enter Marks', 'codeclove-school-management') },
            ]}
            actions={
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={csvFileInputRef}
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleImportCsv}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => csvFileInputRef.current?.click()}
                  disabled={!isSelectionComplete || marksRoster.length === 0}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{__('Import CSV', 'codeclove-school-management')}</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadCsvTemplate}
                  disabled={!isSelectionComplete || marksRoster.length === 0}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{__('Download Template', 'codeclove-school-management')}</span>
                </Button>

                {isDirty && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDiscardChanges}
                    className="h-8 gap-1.5 text-xs text-danger hover:text-danger-hover"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{__('Discard', 'codeclove-school-management')}</span>
                  </Button>
                )}

                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveMarks}
                  disabled={!isSelectionComplete || marksRoster.length === 0 || saveMarksMutation.isPending}
                  className="h-8 gap-1.5 text-xs font-semibold"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {saveMarksMutation.isPending
                      ? __('Saving...', 'codeclove-school-management')
                      : __('Save Marks', 'codeclove-school-management')}
                  </span>
                </Button>
              </div>
            }
          />

        </>
      )}
      {/* Selectors Bar Card */}
      <Card className={embedded ? "bg-transparent border-0 border-b border-border rounded-none shadow-none" : "bg-bg-elevated border-border shadow-xs"}>
        <CardContent className={embedded ? "bg-bg-surface/50 dark:bg-bg-surface/60 p-3 sm:px-6 sm:py-3.5" : "p-4 sm:p-5"}>
          <div className={embedded ? "grid grid-cols-1 sm:grid-cols-3 gap-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"}>
            {/* Exam Selector (Standalone only) */}
            {!embedded && (
              <div>
                <label htmlFor="marks-exam-select" className="block text-xs font-semibold text-text mb-1.5">
                  {__('Examination', 'codeclove-school-management')} <span className="text-danger">*</span>
                </label>
                <Select
                  id="marks-exam-select"
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
            )}

            {/* Class (Unit) Selector */}
            <div>
              <label htmlFor="marks-unit-select" className="block text-xs font-semibold text-text mb-1.5">
                {__('Class', 'codeclove-school-management')} <span className="text-danger">*</span>
              </label>
              <Select
                id="marks-unit-select"
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

            {/* Section (Group) Selector */}
            <div>
              <label htmlFor="marks-group-select" className="block text-xs font-semibold text-text mb-1.5">
                {__('Section (Optional)', 'codeclove-school-management')}
              </label>
              <Select
                id="marks-group-select"
                value={selectedGroupId}
                onValueChange={handleGroupChange}
                options={groupOptions}
                placeholder={__('All Sections', 'codeclove-school-management')}
                disabled={!selectedUnitId}
              />
            </div>

            {/* Subject Paper Selector */}
            <div>
              <label htmlFor="marks-paper-select" className="block text-xs font-semibold text-text mb-1.5">
                {__('Subject', 'codeclove-school-management')} <span className="text-danger">*</span>
              </label>
              <Select
                id="marks-paper-select"
                value={selectedSubjectId}
                onValueChange={handleSubjectChange}
                options={paperOptions}
                placeholder={
                  isLoadingPapers
                    ? __('Loading papers...', 'codeclove-school-management')
                    : timetablePapers.length === 0 && selectedUnitId && selectedExamId
                    ? __('No papers scheduled', 'codeclove-school-management')
                    : __('Select Subject...', 'codeclove-school-management')
                }
                disabled={!selectedExamId || !selectedUnitId}
              />
            </div>
          </div>

          {/* Embedded Mode Action Buttons Bar */}
          {embedded && (
            <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <input
                type="file"
                ref={csvFileInputRef}
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportCsv}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => csvFileInputRef.current?.click()}
                  disabled={!isSelectionComplete || marksRoster.length === 0}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{__('Import CSV', 'codeclove-school-management')}</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadCsvTemplate}
                  disabled={!isSelectionComplete || marksRoster.length === 0}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{__('Download Template', 'codeclove-school-management')}</span>
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {isDirty && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDiscardChanges}
                    className="h-8 gap-1.5 text-xs text-danger hover:text-danger-hover"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{__('Discard', 'codeclove-school-management')}</span>
                  </Button>
                )}

                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveMarks}
                  disabled={!isSelectionComplete || marksRoster.length === 0 || saveMarksMutation.isPending}
                  className="h-8 gap-1.5 text-xs font-semibold"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {saveMarksMutation.isPending
                      ? __('Saving...', 'codeclove-school-management')
                      : __('Save Marks', 'codeclove-school-management')}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roster & Grid Area */}
      {!isSelectionComplete ? (
        embedded ? (
          <div className="py-16 bg-bg-surface">
            <EmptyState
              icon={BookOpen}
              title={__('Select Exam, Class & Subject', 'codeclove-school-management')}
              description={__(
                'Choose an examination, class, and subject paper from the dropdowns above to start entering marks.',
                'codeclove-school-management'
              )}
            />
          </div>
        ) : (
          <Card className="bg-bg-elevated border-border">
            <CardContent className="py-12">
              <EmptyState
                icon={BookOpen}
                title={__('Select Exam, Class & Subject', 'codeclove-school-management')}
                description={__(
                  'Choose an examination, class, and subject paper from the dropdowns above to start entering marks.',
                  'codeclove-school-management'
                )}
              />
            </CardContent>
          </Card>
        )
      ) : isMarksError ? (
        <Alert variant="danger">
          <div className="flex items-center justify-between w-full">
            <span>{__('Failed to load marks roster for this subject paper.', 'codeclove-school-management')}</span>
            <Button size="sm" variant="secondary" onClick={() => refetchMarks()} className="h-7 text-xs">
              {__('Retry', 'codeclove-school-management')}
            </Button>
          </div>
        </Alert>
      ) : isLoadingMarks ? (
        embedded ? (
          <div className="p-6 bg-bg-surface">
            <TableSkeleton columns={6} rows={8} />
          </div>
        ) : (
          <Card className="bg-bg-elevated border-border">
            <CardContent className="p-4">
              <TableSkeleton columns={6} rows={8} />
            </CardContent>
          </Card>
        )
      ) : marksRoster.length === 0 ? (
        embedded ? (
          <div className="py-16 bg-bg-surface">
            <EmptyState
              icon={Users}
              title={__('No students found', 'codeclove-school-management')}
              description={__(
                'There are no students enrolled in the selected class and section for this examination paper.',
                'codeclove-school-management'
              )}
            />
          </div>
        ) : (
          <Card className="bg-bg-elevated border-border">
            <CardContent className="py-12">
              <EmptyState
                icon={Users}
                title={__('No students found', 'codeclove-school-management')}
                description={__(
                  'There are no students enrolled in the selected class and section for this examination paper.',
                  'codeclove-school-management'
                )}
              />
            </CardContent>
          </Card>
        )
      ) : (
        <div className={embedded ? "" : "space-y-4"}>
          {/* Quick Roster Meta & Keyboard Shortcuts Banner */}
          <div
            className={
              embedded
                ? "flex flex-wrap items-center justify-between gap-3 bg-bg-surface/50 px-4 sm:px-6 py-2.5 border-b border-border text-xs text-text-subtle"
                : "flex flex-wrap items-center justify-between gap-3 bg-bg-surface px-4 py-2.5 rounded-lg border border-border text-xs text-text-subtle"
            }
          >
            <div className="flex flex-wrap items-center gap-3">
              {isComposite ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-3xs font-semibold bg-brand-dim text-brand border border-brand/20 whitespace-nowrap">
                  <span>{__('Theory + Practical', 'codeclove-school-management')}</span>
                  <span className="font-mono font-normal opacity-85">({sprintf(__('Th: %d · Pr: %d · Tot: %d', 'codeclove-school-management'), theoryMax, practicalMax, maxMarks)})</span>
                </span>
              ) : isPracticalOnly ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-3xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 whitespace-nowrap">
                  <span>{__('Practical Only', 'codeclove-school-management')}</span>
                  <span className="font-mono font-normal opacity-85">({sprintf(__('Max: %d', 'codeclove-school-management'), maxMarks)})</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-3xs font-semibold bg-bg-surface text-text-muted border border-border whitespace-nowrap">
                  <span>{__('Theory Only', 'codeclove-school-management')}</span>
                  <span className="font-mono font-normal opacity-85">({sprintf(__('Max: %d', 'codeclove-school-management'), maxMarks)})</span>
                </span>
              )}
              <span className="text-border">|</span>
              <span>
                {__('Pass Threshold:', 'codeclove-school-management')}{' '}
                <strong className="text-text tabular-nums">{passMarks}</strong>
              </span>
              <span className="text-border">|</span>
              <span className="text-text">
                {sprintf(
                  __('Students: %d • Present: %d • Absent: %d • Exempt: %d', 'codeclove-school-management'),
                  stats.total,
                  stats.presentCount,
                  stats.absentCount,
                  stats.exemptCount
                )}
              </span>
              <span className="text-border">|</span>
              <span className="text-success font-semibold">
                {sprintf(__('Passed: %d', 'codeclove-school-management'), stats.passCount)}
              </span>
              <span className="text-danger font-semibold">
                {sprintf(__('Failed: %d', 'codeclove-school-management'), stats.failCount)}
              </span>
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="flex items-center gap-2">
              <span className="hidden md:inline font-mono text-3xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded border border-border">
                {__('Keyboard: ↓/Enter = Next row, ↑ = Prev row, A = Absent, P = Present, E = Exempt', 'codeclove-school-management')}
              </span>
              {isDirty && (
                <span className="inline-flex items-center gap-1 text-warning font-semibold">
                  <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                  {__('Unsaved changes', 'codeclove-school-management')}
                </span>
              )}
            </div>
          </div>

          {/* Spreadsheet Table Grid */}
          <Card className={embedded ? "bg-transparent border-0 rounded-none shadow-none" : "bg-bg-elevated border-border shadow-xs overflow-hidden"}>
            <div className="overflow-x-auto">
              <TableRoot>
                <Thead>
                  <Tr>
                    <Th align="center" className="w-16">{__('Roll No.', 'codeclove-school-management')}</Th>
                    <Th align="left" className="min-w-[180px]">{__('Student', 'codeclove-school-management')}</Th>
                    <Th align="center" className="w-32">{__('Attendance', 'codeclove-school-management')}</Th>
                    {isComposite ? (
                      <>
                        <Th align="right" className="w-24">
                          {sprintf(__('Theory (/%d)', 'codeclove-school-management'), theoryMax)}
                        </Th>
                        <Th align="right" className="w-24">
                          {sprintf(__('Practical (/%d)', 'codeclove-school-management'), practicalMax)}
                        </Th>
                        <Th align="right" className="w-24">
                          {sprintf(__('Total (/%d)', 'codeclove-school-management'), maxMarks)}
                        </Th>
                      </>
                    ) : isPracticalOnly ? (
                      <Th align="right" className="w-32">
                        {sprintf(__('Practical (Max %d)', 'codeclove-school-management'), maxMarks)}
                      </Th>
                    ) : (
                      <Th align="right" className="w-32">
                        {sprintf(__('Marks (Max %d)', 'codeclove-school-management'), maxMarks)}
                      </Th>
                    )}
                    <Th align="right" className="w-20">{__('Percentage', 'codeclove-school-management')}</Th>
                    <Th align="center" className="w-24">{__('Grade', 'codeclove-school-management')}</Th>
                    <Th align="left" className="min-w-[200px]">{__('Remarks (Optional)', 'codeclove-school-management')}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {marksRoster.map((student, idx) => {
                    const rowData = localMarks[student.student_id] || {
                      marks_obtained: student.marks_obtained,
                      status: student.status || 'present',
                      remarks: student.remarks || '',
                    }

                    const isAbsent = rowData.status === 'absent'
                    const isExempt = rowData.status === 'exempt'
                    const marks = rowData.marks_obtained
                    const isFailing = marks !== null && marks < passMarks && !isAbsent && !isExempt

                    // Calculate live percentage
                    const percentage =
                      isAbsent
                        ? 0
                        : isExempt || marks === null
                        ? null
                        : maxMarks > 0
                        ? (marks / maxMarks) * 100
                        : 0

                    const grade = percentage !== null ? evaluateGrade(percentage) : null

                    return (
                      <Tr
                        key={student.student_id}
                        className={`transition-colors hover:bg-hover-bg/60 ${
                          isFailing ? 'bg-danger-dim/10' : ''
                        }`}
                      >
                        {/* Roll Number */}
                        <Td align="center" className="font-mono text-xs text-text-subtle tabular-nums">
                          {student.roll_number || '—'}
                        </Td>


                        {/* Student Name */}
                        <Td align="left" className="font-medium text-text text-sm">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{student.student_name}</span>
                              {student.group_name && (
                                <span className="text-3xs px-1.5 py-0.2 rounded bg-bg-surface border border-border text-text-muted font-normal">
                                  {student.group_name}
                                </span>
                              )}
                            </div>
                            {student.student_number && (
                              <span className="text-3xs font-mono text-text-subtle">
                                {student.student_number}
                              </span>
                            )}
                          </div>
                        </Td>

                        {/* Status Select */}
                        <Td align="center">
                          <select
                            value={rowData.status}
                            aria-label={sprintf(
                              __('%s status', 'codeclove-school-management'),
                              student.student_name
                            )}
                            onChange={(e) => {
                              const newStatus = e.target.value as 'present' | 'absent' | 'exempt'
                              updateStudentMark(student.student_id, 'status', newStatus)
                              if (newStatus === 'absent') {
                                updateStudentMark(student.student_id, 'marks_obtained', 0)
                                if (idx + 1 < marksRoster.length) {
                                  markInputRefs.current[idx + 1]?.focus()
                                  markInputRefs.current[idx + 1]?.select()
                                }
                              } else if (newStatus === 'exempt') {
                                updateStudentMark(student.student_id, 'marks_obtained', null)
                                if (idx + 1 < marksRoster.length) {
                                  markInputRefs.current[idx + 1]?.focus()
                                  markInputRefs.current[idx + 1]?.select()
                                }
                              } else if (newStatus === 'present') {
                                markInputRefs.current[idx]?.focus()
                                markInputRefs.current[idx]?.select()
                              }
                            }}
                            className={`h-8 px-2 text-xs rounded font-semibold border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-dim cursor-pointer shadow-xs ${
                              rowData.status === 'present'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60'
                                : rowData.status === 'absent'
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800/60'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60'
                            }`}
                          >
                            <option value="present" className="bg-bg-elevated text-text">{__('Present (P)', 'codeclove-school-management')}</option>
                            <option value="absent" className="bg-bg-elevated text-text">{__('Absent (A)', 'codeclove-school-management')}</option>
                            <option value="exempt" className="bg-bg-elevated text-text">{__('Exempt (E)', 'codeclove-school-management')}</option>
                          </select>
                        </Td>

                        {/* Marks Input */}
                        {isComposite ? (
                          <>
                            {/* Theory Input */}
                            <Td align="right">
                              <input
                                type="number"
                                readOnly={isAbsent || isExempt}
                                min={0}
                                max={theoryMax}
                                step="any"
                                value={isAbsent ? 0 : isExempt ? '' : rowData.theory_marks ?? ''}
                                onChange={(e) => {
                                  if (isAbsent || isExempt) return
                                  const val = e.target.value === '' ? null : Number(e.target.value)
                                  updateStudentMark(student.student_id, 'theory_marks', val)
                                }}
                                placeholder="0.0"
                                className="w-20 h-8 px-2 text-right font-mono text-sm tabular-nums rounded border border-border bg-bg-surface text-text focus:border-brand focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </Td>

                            {/* Practical Input */}
                            <Td align="right">
                              <input
                                type="number"
                                readOnly={isAbsent || isExempt}
                                min={0}
                                max={practicalMax}
                                step="any"
                                value={isAbsent ? 0 : isExempt ? '' : rowData.practical_marks ?? ''}
                                onChange={(e) => {
                                  if (isAbsent || isExempt) return
                                  const val = e.target.value === '' ? null : Number(e.target.value)
                                  updateStudentMark(student.student_id, 'practical_marks', val)
                                }}
                                placeholder="0.0"
                                className="w-20 h-8 px-2 text-right font-mono text-sm tabular-nums rounded border border-border bg-bg-surface text-text focus:border-brand focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </Td>

                            {/* Total Marks */}
                            <Td align="right" className="font-mono text-sm font-bold text-text tabular-nums">
                              {marks !== null ? marks.toFixed(1) : '—'}
                            </Td>
                          </>
                        ) : (
                          <Td align="right">
                            <div className="relative inline-block w-full">
                              <input
                                type="number"
                                ref={(el) => (markInputRefs.current[idx] = el)}
                                readOnly={isAbsent || isExempt}
                                aria-readonly={isAbsent || isExempt}
                                tabIndex={0}
                                min={0}
                                max={maxMarks}
                                step="any"
                                aria-label={sprintf(
                                  __('%s marks obtained out of %d', 'codeclove-school-management'),
                                  student.student_name,
                                  maxMarks
                                )}
                                value={
                                  isAbsent
                                    ? 0
                                    : isExempt
                                    ? ''
                                    : marks === null
                                    ? ''
                                    : marks
                                }
                                onChange={(e) => {
                                  if (isAbsent || isExempt) return
                                  const valStr = e.target.value
                                  const val = valStr === '' ? null : Number(valStr)
                                  updateStudentMark(student.student_id, 'marks_obtained', val)
                                }}
                                onKeyDown={(e) =>
                                  handleKeyDown(e, student.student_id, idx, marksRoster.length)
                                }
                                placeholder={isExempt ? __('EXM', 'codeclove-school-management') : '0.0'}
                                className={`w-24 h-8 px-2.5 text-right font-mono text-sm tabular-nums rounded border bg-bg-surface shadow-xs transition-colors duration-150 focus:outline-none focus:ring-2 ${
                                  isFailing
                                    ? 'border-danger text-danger bg-danger-dim/30 font-bold focus:ring-danger-ring'
                                    : isAbsent || isExempt
                                    ? 'border-border/60 text-text-subtle bg-bg-elevated/60 cursor-default focus:ring-brand-ring/40'
                                    : 'border-border text-text hover:border-border-strong focus:border-brand focus:ring-brand-dim'
                                }`}
                              />
                            </div>
                          </Td>
                        )}

                        {/* Percentage */}
                        <Td align="right" className="font-mono text-xs tabular-nums font-semibold">
                          {isAbsent ? (
                            <span className="text-danger">0.0%</span>
                          ) : isExempt ? (
                            <span className="text-text-subtle">—</span>
                          ) : percentage !== null ? (
                            <span className={isFailing ? 'text-danger' : 'text-text'}>
                              {`${percentage.toFixed(1)}%`}
                            </span>
                          ) : (
                            <span className="text-text-subtle">—</span>
                          )}
                        </Td>

                        {/* Grade Badge */}
                        <Td align="center">
                          {isAbsent ? (
                            <Badge variant="danger" className="text-3xs uppercase font-bold tracking-wide">
                              {__('ABS', 'codeclove-school-management')}
                            </Badge>
                          ) : isExempt ? (
                            <Badge variant="neutral" className="text-3xs uppercase tracking-wide">
                              {__('EXM', 'codeclove-school-management')}
                            </Badge>
                          ) : grade ? (
                            <Badge
                              variant={grade.is_pass ? 'success' : 'danger'}
                              className="font-bold text-xs"
                            >
                              {grade.label}
                            </Badge>
                          ) : (
                            <span className="text-text-subtle text-xs">—</span>
                          )}
                        </Td>

                        {/* Custom Remarks Input with Auto-Suggest Datalist */}
                        <Td align="left">
                          <input
                            type="text"
                            ref={(el) => (remarkInputRefs.current[idx] = el)}
                            value={rowData.remarks}
                            onChange={(e) => updateStudentMark(student.student_id, 'remarks', e.target.value)}
                            onKeyDown={(e) => handleRemarkKeyDown(e, idx, marksRoster.length)}
                            list="exam-remark-presets"
                            placeholder={isAbsent ? __('Absent from paper', 'codeclove-school-management') : __('Add remark...', 'codeclove-school-management')}
                            aria-label={sprintf(__('%s remarks', 'codeclove-school-management'), student.student_name)}
                            className="w-full h-8 px-3 text-xs rounded border border-border bg-bg-surface shadow-xs text-text placeholder:text-text-subtle hover:border-border-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-dim transition-colors"
                          />
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </TableRoot>
              <datalist id="exam-remark-presets">
                {REMARKS_PRESETS.map((preset) => (
                  <option key={preset} value={preset} />
                ))}
              </datalist>
            </div>
            </Card>
        </div>
      )}
    </div>
  )
}
