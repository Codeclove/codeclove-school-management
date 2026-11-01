/**
 * ExamTimetablePage — Subject paper scheduling, venues, timings, and passing marks.
 *
 * Provides:
 *   - Fast selection of Examination and Academic Unit (Class).
 *   - Auto-sync with URL query parameters (?exam_id=...&unit_id=...).
 *   - Grid of all subjects mapped to the selected class.
 *   - Live editable rows for Exam Date, Start Time, End Time, Venue/Room, Max Marks, Pass Marks.
 *   - Strict compliance with codeclove-ui-ux (right-aligned numeric inputs, font-mono tabular-nums).
 *   - Bulk mutation with loading pending state, dirty tracking, and toast notifications.
 */
import { useState, useEffect, useMemo, Fragment } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Save,
  BookOpen,
  Calendar,
  Zap,
  ChevronDown,
  X,
  ArrowRight,
  Sparkles,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import {
  useExams,
  useExamTimetable,
  useSaveExamTimetable,
  type ExamSubject,
  type SaveTimetablePaper,
  type AssessmentMode,
} from '@/api/exams'
import {
  useUnits,
  useSubjects,
  useUnitSubjects,
  type AcademicUnit,
  type Subject,
} from '@/api/academics'
import { useToast } from '@/lib/toast'
import { useFormatter } from '@/lib/formatter'
import { ROUTES } from '@/lib/constants'
import { __, sprintf } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableSkeleton,
  EmptyState,
  Alert,
  Select,
  type SelectOption,
  Input,
  DatePicker,
  TimeRangePicker,
  Checkbox,
  Badge,
  Spinner,
} from '@/components/ui'

interface SubjectItem {
  subject_id: number
  name: string
  code: string | null
  type?: string
}

interface RowState {
  id?: number
  assessment_mode?: AssessmentMode
  exam_date: string
  start_time: string
  end_time: string
  room: string
  max_marks: number | string
  pass_marks: number | string
  theory_max_marks?: number | string
  theory_pass_marks?: number | string
  practical_max_marks?: number | string
  practical_pass_marks?: number | string
  practical_date?: string
  practical_start_time?: string
  practical_end_time?: string
  practical_room?: string
}
export interface ExamTimetablePageProps {
  examId?: number
  embedded?: boolean
}
/**
 * Normalize dates, stripping invalid or zeroed MySQL dates
 */
const cleanDate = (d?: string | null): string => (!d || d === '0000-00-00' || d.startsWith('1970') ? '' : d)
const cleanTime = (t?: string | null): string => (!t || t.startsWith('00:00') ? '' : t.slice(0, 5))

/**
 * Check if a row has a valid scheduled date and legitimate time slot
 */
function isRowScheduled(r?: RowState): boolean {
  if (!r) return false
  const hasDate = Boolean(cleanDate(r.exam_date))
  const sTime = cleanTime(r.start_time)
  const eTime = cleanTime(r.end_time)
  const hasTime = Boolean(sTime && eTime && eTime > sTime)
  if (r.assessment_mode === 'theory_practical') {
    const hasPracDate = Boolean(cleanDate(r.practical_date))
    const prSTime = cleanTime(r.practical_start_time)
    const prETime = cleanTime(r.practical_end_time)
    const hasPracTime = Boolean(prSTime && prETime && prETime > prSTime)
    return hasDate && hasTime && hasPracDate && hasPracTime
  }
  return hasDate && hasTime
}

/**
 * Extract day of week and weekend flags from YYYY-MM-DD
 */
function getDayMeta(dateStr?: string | null) {
  if (!dateStr?.trim()) return null
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return null
  const day = d.getDay()
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    dayLabel: dayNames[day],
    isSunday: day === 0,
    isSaturday: day === 6,
    isWeekend: day === 0 || day === 6,
  }
}


/**
 * Generate sequential examination dates honoring cadence and weekend exclusions.
 */
function generateExamCadenceDates(
  startDateStr: string,
  intervalDays: number,
  count: number,
  skipDays: number[] = [0] // default: skip Sundays
): string[] {
  if (!startDateStr || count <= 0) return []
  const dates: string[] = []
  const parts = startDateStr.split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[0]!) || isNaN(parts[1]!) || isNaN(parts[2]!)) return []

  const cur = new Date(parts[0]!, parts[1]! - 1, parts[2]!)
  if (isNaN(cur.getTime())) return []

  // If start date itself lands on a skipped day, advance to next valid day
  while (skipDays.includes(cur.getDay())) {
    cur.setDate(cur.getDate() + 1)
  }

  while (dates.length < count) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)

    // Step to next date: 0-day gap = +1 day, 1-day gap = +2 days, etc.
    const step = intervalDays === 0 ? 1 : 1 + intervalDays
    cur.setDate(cur.getDate() + step)
    while (skipDays.includes(cur.getDay())) {
      cur.setDate(cur.getDate() + 1)
    }
  }

  return dates
}

const QUICK_INTERVAL_OPTIONS: SelectOption[] = [
  { value: '0', label: __('Daily (0 Gap Days / Consecutive)', 'codeclove-school-management') },
  { value: '1', label: __('Alternate Days (1 Gap Day / Revision)', 'codeclove-school-management') },
  { value: '2', label: __('2 Days Gap (2 Revision Days)', 'codeclove-school-management') },
  { value: '3', label: __('3 Days Gap (3 Revision Days)', 'codeclove-school-management') },
]

const QUICK_SHIFT_OPTIONS: SelectOption[] = [
  { value: 'morning_standard', label: __('Morning Standard (09:00 – 11:30 AM • 2.5h)', 'codeclove-school-management') },
  { value: 'morning_1h', label: __('Morning 1-Hour (09:00 – 10:00 AM • 1.0h)', 'codeclove-school-management') },
  { value: 'morning_full', label: __('Morning Full (09:00 – 12:00 PM • 3.0h)', 'codeclove-school-management') },
  { value: 'late_morning', label: __('Late Morning (09:30 – 12:30 PM • 3.0h)', 'codeclove-school-management') },
  { value: 'afternoon_standard', label: __('Afternoon Session (01:30 – 04:00 PM • 2.5h)', 'codeclove-school-management') },
  { value: 'afternoon_full', label: __('Afternoon Full (02:00 – 05:00 PM • 3.0h)', 'codeclove-school-management') },
]

const QUICK_SHIFT_TIMINGS: Record<string, { start: string; end: string }> = {
  morning_standard: { start: '09:00', end: '11:30' },
  morning_1h: { start: '09:00', end: '10:00' },
  morning_full: { start: '09:00', end: '12:00' },
  late_morning: { start: '09:30', end: '12:30' },
  afternoon_standard: { start: '13:30', end: '16:00' },
  afternoon_full: { start: '14:00', end: '17:00' },
}

// ponytail: static class lookup shrinks 20 lines of nested JSX ternaries to 1 line
const ASSESSMENT_MODE_STYLES: Record<string, string> = {
  theory_practical: 'bg-brand-dim/70 border-brand/30 text-brand font-semibold hover:border-brand/60 focus:border-brand',
  practical_only: 'bg-purple-dim/70 border-purple/30 text-purple font-semibold hover:border-purple/60 focus:border-purple',
  grade_only: 'bg-amber-dim/70 border-amber/30 text-amber font-semibold hover:border-amber/60 focus:border-amber',
}

export default function ExamTimetablePage({ examId: propExamId, embedded = false }: ExamTimetablePageProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { formatDate } = useFormatter()

  // ─── URL Query Param Sync ──────────────────────────────────────────────────
  const initialExamId = propExamId ? String(propExamId) : (searchParams.get('exam_id') || '')
  const initialUnitId = searchParams.get('unit_id') || ''

  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(initialUnitId)

  // Keep state synchronized if URL search params change externally
  useEffect(() => {
    if (propExamId) {
      setSelectedExamId(String(propExamId))
    } else {
      const qExam = searchParams.get('exam_id') || ''
      if (qExam !== selectedExamId) setSelectedExamId(qExam)
    }
    const qUnit = searchParams.get('unit_id') || ''
    if (qUnit !== selectedUnitId) setSelectedUnitId(qUnit)
  }, [searchParams, propExamId])
  const handleExamChange = (val: string) => {
    setSelectedExamId(val)
    const nextParams = new URLSearchParams(searchParams)
    if (val) {
      nextParams.set('exam_id', val)
    } else {
      nextParams.delete('exam_id')
    }
    setSearchParams(nextParams, { replace: true })
  }

  const handleUnitChange = (val: string) => {
    setSelectedUnitId(val)
    const nextParams = new URLSearchParams(searchParams)
    if (val) {
      nextParams.set('unit_id', val)
    } else {
      nextParams.delete('unit_id')
    }
    setSearchParams(nextParams, { replace: true })
  }

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: exams = [] } = useExams()

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
  const selectedExam = useMemo(() => exams.find((e) => e.id === numExamId), [exams, numExamId])

  // Filter units by the selected exam's session so only classes for that session appear
  const targetSessionId = selectedExam?.academic_session_id
  const { data: unitsResponse } = useUnits(
    targetSessionId ? { session_id: targetSessionId, per_page: 100 } : { per_page: 100 }
  )
  const units: AcademicUnit[] = useMemo(() => unitsResponse?.data ?? [], [unitsResponse])

  // All papers scheduled for this exam across all classes
  const { data: allExamPapers = [] } = useExamTimetable(numExamId)

  const numUnitId = Number(selectedUnitId) || 0

  // Auto-select unit: prefer a unit that already has papers scheduled in this exam, or the first unit
  useEffect(() => {
    if (numExamId > 0 && !selectedUnitId && units.length > 0) {
      const unitWithPapers = allExamPapers.find((p) => units.some((u) => u.id === p.academic_unit_id))
      if (unitWithPapers) {
        setSelectedUnitId(String(unitWithPapers.academic_unit_id))
      } else if (units[0]) {
        setSelectedUnitId(String(units[0].id))
      }
    }
  }, [numExamId, selectedUnitId, units, allExamPapers])

  // Existing saved timetable papers for the selected unit
  const {
    data: savedPapers = [],
    isLoading: isLoadingPapers,
    isError: isErrorPapers,
    refetch: refetchPapers,
  } = useExamTimetable(numExamId, numUnitId)
  // Subjects assigned to the unit
  const {
    data: unitSubjects = [],
    isLoading: isLoadingUnitSubjects,
  } = useUnitSubjects(numUnitId)

  // Fallback catalog of all subjects
  const { data: allSubjectsResponse, isLoading: isLoadingAllSubjects } = useSubjects({
    per_page: 100,
  })
  const allSubjects: Subject[] = useMemo(
    () => allSubjectsResponse?.data ?? [],
    [allSubjectsResponse]
  )

  // ─── Combined Subjects List ────────────────────────────────────────────────
  const subjects: SubjectItem[] = useMemo(() => {
    if (!numUnitId) return []

    // 1. Prefer subjects assigned to this unit
    if (unitSubjects && unitSubjects.length > 0) {
      return unitSubjects.map((us) => ({
        subject_id: us.subject_id,
        name: us.subject_name,
        code: us.subject_code,
        type: us.subject_type,
      }))
    }

    // 2. If papers already exist in timetable for this unit, ensure they are present
    if (savedPapers && savedPapers.length > 0) {
      const map = new Map<number, SubjectItem>()
      savedPapers.forEach((p) => {
        map.set(p.subject_id, {
          subject_id: p.subject_id,
          name: p.subject_name,
          code: p.subject_code ?? null,
        })
      })
      return Array.from(map.values())
    }

    // 3. Fallback to school subject catalog
    return allSubjects.map((s) => ({
      subject_id: s.id,
      name: s.name,
      code: s.code,
      type: s.type,
    }))
  }, [numUnitId, unitSubjects, savedPapers, allSubjects])

  // ─── Local State for Editable Rows ─────────────────────────────────────────
  const [rows, setRows] = useState<Record<number, RowState>>({})
  const [isDirty, setIsDirty] = useState<boolean>(false)

  // Initialize or re-sync rows when saved papers or subject list changes
  useEffect(() => {
    if (!numExamId || !numUnitId || subjects.length === 0) {
      setRows({})
      setIsDirty(false)
      return
    }

    // Map saved papers by subject_id
    const savedMap = new Map<number, ExamSubject>()
    savedPapers.forEach((paper) => {
      savedMap.set(paper.subject_id, paper)
    })

    const newRows: Record<number, RowState> = {}
    subjects.forEach((sub) => {
      const saved = savedMap.get(sub.subject_id)
      newRows[sub.subject_id] = {
        id: saved?.id,
        assessment_mode: saved?.assessment_mode || 'total_only',
        exam_date: cleanDate(saved?.exam_date),
        start_time: cleanTime(saved?.start_time),
        end_time: cleanTime(saved?.end_time),
        room: saved?.room || '',
        max_marks: saved?.max_marks ?? 100,
        pass_marks: saved?.pass_marks ?? 33,
        theory_max_marks: saved?.theory_max_marks ?? '',
        theory_pass_marks: saved?.theory_pass_marks ?? '',
        practical_max_marks: saved?.practical_max_marks ?? '',
        practical_pass_marks: saved?.practical_pass_marks ?? '',
        practical_date: cleanDate(saved?.practical_date),
        practical_start_time: cleanTime(saved?.practical_start_time),
        practical_end_time: cleanTime(saved?.practical_end_time),
        practical_room: saved?.practical_room || '',
      }
    })
    setRows(newRows)
    setIsDirty(false)
  }, [numExamId, numUnitId, savedPapers, subjects])
  // Count subjects that actually have a scheduled date and start time
  const scheduledCount = useMemo(() => {
    return subjects.filter((s) => isRowScheduled(rows[s.subject_id])).length
  }, [subjects, rows])

  // ─── Mutation ─────────────────────────────────────────────────────────────
  const saveTimetableMutation = useSaveExamTimetable()

  const handleRowChange = (
    subjectId: number,
    field: keyof RowState,
    value: string | number
  ) => {
    setRows((prev) => ({
      ...prev,
      [subjectId]: {
        ...(prev[subjectId] || {
          exam_date: '',
          start_time: '',
          end_time: '',
          room: '',
          max_marks: 100,
          pass_marks: 33,
        }),
        [field]: value,
      },
    }))
    setIsDirty(true)
  }

  const handleSlotChange = (
    subjectId: number,
    startTime: string,
    endTime: string
  ) => {
    setRows((prev) => ({
      ...prev,
      [subjectId]: {
        ...(prev[subjectId] || {
          exam_date: '',
          start_time: '',
          end_time: '',
          room: '',
          max_marks: 100,
          pass_marks: 33,
        }),
        start_time: startTime,
        end_time: endTime,
      },
    }))
    setIsDirty(true)
  }

  // ─── Quick Fill Cadence State ──────────────────────────────────────────────
  const [isQuickFillOpen, setIsQuickFillOpen] = useState(false)
  const [quickInterval, setQuickInterval] = useState<number>(1)
  const [quickShift, setQuickShift] = useState<string>('morning_standard')
  const [quickRoom, setQuickRoom] = useState<string>('')
  const [quickSkipWeekends, setQuickSkipWeekends] = useState<boolean>(true)
  const [quickScope, setQuickScope] = useState<'unscheduled' | 'all'>('unscheduled')
  const [quickStartDate, setQuickStartDate] = useState<string>('')

  const unscheduledCount = useMemo(() => {
    return subjects.filter((s) => !isRowScheduled(rows[s.subject_id])).length
  }, [subjects, rows])

  // Auto-seed quick start date from exam starts_on or next day after last scheduled
  useEffect(() => {
    if (selectedExam?.starts_on) {
      const scheduledDates = subjects
        .map((s) => rows[s.subject_id]?.exam_date)
        .filter((d): d is string => Boolean(d))
        .sort()

      if (scheduledDates.length > 0 && scheduledDates[scheduledDates.length - 1]) {
        const last = scheduledDates[scheduledDates.length - 1]!
        const nextDates = generateExamCadenceDates(last, quickInterval, 2, quickSkipWeekends ? [0] : [])
        if (nextDates[1]) {
          setQuickStartDate(nextDates[1])
          return
        }
      }
      setQuickStartDate(selectedExam.starts_on)
    }
  }, [selectedExam?.starts_on, subjects, rows, quickInterval, quickSkipWeekends])

  const targetSubjects = useMemo(() => {
    if (quickScope === 'all') return subjects
    return subjects.filter((s) => !isRowScheduled(rows[s.subject_id]))
  }, [subjects, rows, quickScope])

  const previewDates = useMemo(() => {
    if (!quickStartDate || targetSubjects.length === 0) return []
    return generateExamCadenceDates(
      quickStartDate,
      quickInterval,
      Math.min(targetSubjects.length, 5),
      quickSkipWeekends ? [0] : []
    )
  }, [quickStartDate, quickInterval, targetSubjects.length, quickSkipWeekends])

  const previewPills = useMemo(() => {
    if (!previewDates.length) return []
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return previewDates.map((dateStr) => {
      const parts = dateStr.split('-').map(Number)
      if (parts.length < 3 || isNaN(parts[0]!) || isNaN(parts[1]!) || isNaN(parts[2]!)) return dateStr
      const d = new Date(parts[0]!, parts[1]! - 1, parts[2]!)
      const dayLabel = dayNames[d.getDay()] || ''
      const monthLabel = months[d.getMonth()] || ''
      return `${dayLabel} ${parts[2]} ${monthLabel}`
    })
  }, [previewDates])

  const handleApplyQuickFill = () => {
    if (targetSubjects.length === 0) {
      toast.info(__('No subjects need scheduling for this scope.', 'codeclove-school-management'))
      return
    }

    const startDateToUse = quickStartDate || selectedExam?.starts_on
    if (!startDateToUse) {
      toast.error(__('Please choose a valid start date.', 'codeclove-school-management'))
      return
    }

    const generatedDates = generateExamCadenceDates(
      startDateToUse,
      quickInterval,
      targetSubjects.length,
      quickSkipWeekends ? [0] : []
    )

    const timing = QUICK_SHIFT_TIMINGS[quickShift] || QUICK_SHIFT_TIMINGS.morning_standard!

    setRows((prev) => {
      const updated = { ...prev }
      targetSubjects.forEach((sub, idx) => {
        const assignedDate = generatedDates[idx] || ''
        const existing = updated[sub.subject_id] || {
          exam_date: '',
          start_time: '',
          end_time: '',
          room: '',
          max_marks: 100,
          pass_marks: 33,
        }
        updated[sub.subject_id] = {
          ...existing,
          exam_date: assignedDate,
          start_time: timing.start,
          end_time: timing.end,
          room: quickRoom.trim() ? quickRoom.trim() : existing.room,
        }
      })
      return updated
    })

    setIsDirty(true)
    toast.success(
      sprintf(
        __('Auto-scheduled %d subjects (%s).', 'codeclove-school-management'),
        targetSubjects.length,
        quickInterval === 0
          ? __('Daily', 'codeclove-school-management')
          : quickInterval === 1
          ? __('Alternate Days', 'codeclove-school-management')
          : sprintf(__('%d-Day Gap', 'codeclove-school-management'), quickInterval)
      )
    )
    setIsQuickFillOpen(false)
  }

  const handleSave = () => {
    if (!numExamId || !numUnitId) return

    // Pre-flight validation: check for invalid timings or impossible pass marks
    for (const sub of subjects) {
      const r = rows[sub.subject_id]
      if (r) {
        if (r.start_time && r.end_time && r.end_time <= r.start_time) {
          toast.error(
            sprintf(
              __('End time must be after start time for %s.', 'codeclove-school-management'),
              sub.name
            )
          )
          return
        }
        if (r.assessment_mode === 'theory_practical' && r.practical_start_time && r.practical_end_time && r.practical_end_time <= r.practical_start_time) {
          toast.error(
            sprintf(
              __('Practical end time must be after start time for %s.', 'codeclove-school-management'),
              sub.name
            )
          )
          return
        }
        if (r.assessment_mode !== 'grade_only') {
          const maxM = Number(r.max_marks)
          const passM = Number(r.pass_marks)
          if (isNaN(maxM) || maxM <= 0) {
            toast.error(
              sprintf(
                __('Maximum marks must be greater than zero for %s.', 'codeclove-school-management'),
                sub.name
              )
            )
            return
          }
          if (isNaN(passM) || passM < 0 || passM > maxM) {
            toast.error(
              sprintf(
                __('Passing marks must be between 0 and maximum marks for %s.', 'codeclove-school-management'),
                sub.name
              )
            )
            return
          }
        }
      }
    }

    // Build papers array
    const papers: SaveTimetablePaper[] = subjects.map((sub) => {
      const r = rows[sub.subject_id] || {
        exam_date: '',
        start_time: '',
        end_time: '',
        room: '',
        max_marks: 100,
        pass_marks: 33,
      }

      return {
        id: r.id,
        subject_id: sub.subject_id,
        assessment_mode: r.assessment_mode || 'total_only',
        exam_date: r.exam_date || null,
        start_time: r.start_time || null,
        end_time: r.end_time || null,
        room: r.room?.trim() ? r.room.trim() : null,
        max_marks: r.assessment_mode === 'grade_only' ? 0 : (Number(r.max_marks) > 0 ? Number(r.max_marks) : 100),
        pass_marks: r.assessment_mode === 'grade_only' ? 0 : (Number(r.pass_marks) >= 0 ? Number(r.pass_marks) : 33),
        theory_max_marks: r.theory_max_marks !== '' && r.theory_max_marks !== undefined ? Number(r.theory_max_marks) : null,
        theory_pass_marks: r.theory_pass_marks !== '' && r.theory_pass_marks !== undefined ? Number(r.theory_pass_marks) : null,
        practical_max_marks: r.practical_max_marks !== '' && r.practical_max_marks !== undefined ? Number(r.practical_max_marks) : null,
        practical_pass_marks: r.practical_pass_marks !== '' && r.practical_pass_marks !== undefined ? Number(r.practical_pass_marks) : null,
        practical_date: r.practical_date || null,
        practical_start_time: r.practical_start_time || null,
        practical_end_time: r.practical_end_time || null,
        practical_room: r.practical_room?.trim() ? r.practical_room.trim() : null,
      }
    })
    saveTimetableMutation.mutate(
      {
        examId: numExamId,
        unit_id: numUnitId,
        papers,
      },
      {
        onSuccess: () => {
          toast.success(__('Exam schedule saved successfully.', 'codeclove-school-management'))
          setIsDirty(false)
        },
        onError: (err) => {
          toast.error(err.message || __('Failed to save exam schedule.', 'codeclove-school-management'))
        },
      }
    )
  }

  // ─── Options ──────────────────────────────────────────────────────────────
  const examOptions: SelectOption[] = useMemo(() => {
    return exams.map((ex) => ({
      value: String(ex.id),
      label: `${ex.name}${ex.code ? ` (${ex.code})` : ''}`,
      description: `${ex.academic_session_name ? `${ex.academic_session_name} • ` : ''}${formatDate(ex.starts_on)} – ${formatDate(ex.ends_on)}${(ex.subjects_count ?? 0) > 0 ? ` • ${sprintf(__('%d papers', 'codeclove-school-management'), ex.subjects_count)}` : ''}`,
    }))
  }, [exams, formatDate])

  const unitOptions: SelectOption[] = useMemo(() => {
    return units.map((u) => ({
      value: String(u.id),
      label: u.name,
    }))
  }, [units])

  const selectedUnit = units.find((u) => u.id === numUnitId)
  const isLoadingData =
    Boolean(numExamId && numUnitId) &&
    (isLoadingPapers || isLoadingUnitSubjects || isLoadingAllSubjects)

  // ─── Filter State ─────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'pending'>('all')

  // ponytail: 1-liner boolean comparison replaces 3-branch if statement
  const displayedSubjects = useMemo(() => {
    if (filterStatus === 'all') return subjects
    const wantScheduled = filterStatus === 'scheduled'
    return subjects.filter((s) => wantScheduled === isRowScheduled(rows[s.subject_id]))
  }, [subjects, rows, filterStatus])
  return (
    <div className={embedded ? "" : "space-y-6"}>
      {/* ─── Header (Standalone mode only) ─────────────────────────────────── */}
      {!embedded && (
        <>
          <PageHeader
            title={__('Exam Schedule', 'codeclove-school-management')}
            description={__(
              'Set dates, start and end times, rooms, and passing marks for each subject.',
              'codeclove-school-management'
            )}
            breadcrumbs={[
              { label: __('Examinations', 'codeclove-school-management'), href: ROUTES.EXAMS },
              { label: __('Schedule', 'codeclove-school-management') },
            ]}
            actions={
              numExamId > 0 && numUnitId > 0 && subjects.length > 0 ? (
                <Button
                  onClick={handleSave}
                  disabled={saveTimetableMutation.isPending}
                  className="gap-2"
                >
                  {saveTimetableMutation.isPending && <Spinner size="sm" />}
                  <Save size={16} />
                  <span>{__('Save Schedule', 'codeclove-school-management')}</span>
                </Button>
              ) : null
            }
          />
        </>
      )}
      {/* ─── Selectors Toolbar / Card ────────────────────────────────────────── */}
      {/* ─── Standalone Selectors Card ────────────────────────────────────────── */}
      {!embedded && (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="exam-select"
                  className="block text-sm font-medium text-text mb-1"
                >
                  {__('Examination', 'codeclove-school-management')}
                  <span className="text-danger ms-0.5">*</span>
                </label>
                <Select
                  id="exam-select"
                  value={selectedExamId}
                  onValueChange={handleExamChange}
                  options={examOptions}
                  placeholder={__('Select an exam...', 'codeclove-school-management')}
                />
              </div>

              <div>
                <label
                  htmlFor="unit-select"
                  className="block text-sm font-medium text-text mb-1"
                >
                  {__('Class', 'codeclove-school-management')}
                  <span className="text-danger ms-0.5">*</span>
                </label>
                <Select
                  id="unit-select"
                  value={selectedUnitId}
                  onValueChange={handleUnitChange}
                  options={unitOptions}
                  placeholder={__('Select a class...', 'codeclove-school-management')}
                />
              </div>
            </div>

            {selectedExam && selectedUnit && (
              <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-text-subtle" />
                    <span>
                      {formatDate(selectedExam.starts_on)} – {formatDate(selectedExam.ends_on)}
                    </span>
                  </span>
                  <span className="text-border">|</span>
                  <span>
                    {scheduledCount === subjects.length
                      ? sprintf(__('%d of %d subjects scheduled (Complete)', 'codeclove-school-management'), scheduledCount, subjects.length)
                      : sprintf(__('%d of %d scheduled (%d pending)', 'codeclove-school-management'), scheduledCount, subjects.length, subjects.length - scheduledCount)}
                  </span>
                </div>

                {isDirty && (
                  <Badge variant="warning" dot>
                    {__('Unsaved changes', 'codeclove-school-management')}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Error State Alert ─────────────────────────────────────────────── */}
      {isErrorPapers && (
        <Alert variant="danger" title={__('Failed to Load Schedule', 'codeclove-school-management')}>
          <div className="flex items-center justify-between">
            <span>{__('Could not retrieve the exam schedule for this class.', 'codeclove-school-management')}</span>
            <Button size="sm" variant="secondary" onClick={() => refetchPapers()} className="h-7 text-xs">
              {__('Retry', 'codeclove-school-management')}
            </Button>
          </div>
        </Alert>
      )}

      {/* ─── Timetable Matrix Table ────────────────────────────────────────── */}
      {!numExamId || !numUnitId ? (
        embedded ? (
          <div className="divide-y divide-border">
            <div className="px-4 sm:px-6 py-3 bg-bg-surface flex items-center gap-3">
              <label
                htmlFor="unit-select"
                className="text-xs font-semibold text-text whitespace-nowrap"
              >
                {__('Class', 'codeclove-school-management')}
                <span className="text-danger ms-0.5">*</span>
              </label>
              <div className="w-56 sm:w-64">
                <Select
                  id="unit-select"
                  value={selectedUnitId}
                  onValueChange={handleUnitChange}
                  options={unitOptions}
                  placeholder={__('Select a class...', 'codeclove-school-management')}
                />
              </div>
            </div>
            <div className="py-16 bg-bg-surface">
              <EmptyState
                icon={CalendarDays}
                title={__('Select an Examination and Class', 'codeclove-school-management')}
                description={__(
                  'Choose an examination and academic class above to view or configure the schedule.',
                  'codeclove-school-management'
                )}
                variant="dashed"
                className="py-16"
              />
            </div>
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title={__('Select an Examination and Class', 'codeclove-school-management')}
            description={__(
              'Choose an examination and academic class above to view or configure the schedule.',
              'codeclove-school-management'
            )}
            variant="dashed"
            className="py-16"
          />
        )
      ) : isLoadingData ? (
        <Card>
          <CardContent className="p-0">
            <TableRoot>
              <Thead>
                <Tr>
                  <Th align="left">{__('Subject', 'codeclove-school-management')}</Th>
                  <Th align="left">{__('Date', 'codeclove-school-management')}</Th>
                  <Th align="left">{__('Time Slot', 'codeclove-school-management')}</Th>
                  <Th align="left">{__('Room / Venue', 'codeclove-school-management')}</Th>
                  <Th align="right">{__('Max Marks', 'codeclove-school-management')}</Th>
                  <Th align="right">{__('Passing Marks', 'codeclove-school-management')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                <TableSkeleton columns={6} rows={6} />
              </Tbody>
            </TableRoot>
          </CardContent>
        </Card>
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={__('No Subjects Found', 'codeclove-school-management')}
          description={__(
            'There are no subjects configured for this class yet. Assign subjects to this class in the Academics module.',
            'codeclove-school-management'
          )}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(ROUTES.SUBJECTS)}
            >
              {__('Go to Subjects', 'codeclove-school-management')}
            </Button>
          }
          className="py-12"
        />
      ) : (
        <Card className={embedded ? "bg-transparent border-0 rounded-none shadow-none" : "bg-bg-elevated border-border shadow-xs overflow-hidden"}>
          {/* ponytail: single unified toolbar replaces 155 lines of duplicated embedded and standalone blocks */}
          {numExamId > 0 && numUnitId > 0 && subjects.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bg-surface/50 dark:bg-bg-surface/60 px-4 sm:px-6 py-3 border-b border-border">
              <div className="flex flex-wrap items-center gap-3">
                {embedded && (
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="unit-select"
                      className="text-xs font-semibold text-text whitespace-nowrap"
                    >
                      {__('Class', 'codeclove-school-management')}
                    </label>
                    <div className="w-48 sm:w-56">
                      <Select
                        id="unit-select"
                        value={selectedUnitId}
                        onValueChange={handleUnitChange}
                        options={unitOptions}
                        placeholder={__('Select a class...', 'codeclove-school-management')}
                      />
                    </div>
                  </div>
                )}

                <div className="inline-flex rounded-md border border-border bg-bg-surface p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer',
                      filterStatus === 'all'
                        ? 'bg-bg-elevated text-text shadow-xs font-semibold'
                        : 'text-text-muted hover:text-text'
                    )}
                  >
                    {sprintf(__('All (%d)', 'codeclove-school-management'), subjects.length)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('scheduled')}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer',
                      filterStatus === 'scheduled'
                        ? 'bg-bg-elevated text-success shadow-xs font-semibold'
                        : 'text-text-muted hover:text-text'
                    )}
                  >
                    {sprintf(__('%d scheduled', 'codeclove-school-management'), scheduledCount)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('pending')}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer',
                      filterStatus === 'pending'
                        ? 'bg-bg-elevated text-warning shadow-xs font-semibold'
                        : 'text-text-muted hover:text-text'
                    )}
                  >
                    {sprintf(__('%d pending', 'codeclove-school-management'), unscheduledCount)}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-center">
                <Button
                  type="button"
                  variant={isQuickFillOpen ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setIsQuickFillOpen((prev) => !prev)}
                  className="h-8 px-3 text-xs font-semibold gap-1.5 shadow-xs"
                  aria-expanded={isQuickFillOpen}
                  aria-label={__('Toggle Quick Fill Cadence Toolbar', 'codeclove-school-management')}
                >
                  <Sparkles size={13} className={isQuickFillOpen ? 'fill-current' : 'text-brand'} />
                  <span>{__('Quick Fill Cadence', 'codeclove-school-management')}</span>
                  <ChevronDown size={13} className={cn('transition-transform duration-200', isQuickFillOpen && 'rotate-180')} />
                </Button>

                {embedded && isDirty && (
                  <Badge variant="warning" dot size="sm">
                    {__('Unsaved changes', 'codeclove-school-management')}
                  </Badge>
                )}
                {embedded && (
                  <Button
                    onClick={handleSave}
                    disabled={saveTimetableMutation.isPending}
                    size="sm"
                    className="gap-1.5 font-semibold h-8 text-xs shadow-xs"
                  >
                    {saveTimetableMutation.isPending && <Spinner size="sm" />}
                    <Save size={14} />
                    <span>{__('Save Schedule', 'codeclove-school-management')}</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ─── ⚡ Quick Fill Cadence Panel ─────────────────────────────────── */}
          {isQuickFillOpen && numExamId > 0 && numUnitId > 0 && subjects.length > 0 && (
            <div className="bg-bg-surface border-b border-border p-4 sm:px-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-dim text-brand flex items-center justify-center shrink-0 border border-brand/20">
                    <Sparkles size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text">
                      {__('Quick Fill Cadence & Session Slots', 'codeclove-school-management')}
                    </h4>
                    <p className="text-2xs text-text-muted">
                      {__('Auto-space examination dates across subjects and assign shifts in one gesture.', 'codeclove-school-management')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-2xs text-text-muted">
                    {sprintf(
                      __('%d of %d subjects currently unscheduled', 'codeclove-school-management'),
                      unscheduledCount,
                      subjects.length
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsQuickFillOpen(false)}
                    className="p-1 rounded hover:bg-hover-bg text-text-subtle hover:text-text transition-colors"
                    title={__('Close Quick Fill', 'codeclove-school-management')}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Grid of 4 Core Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
                {/* 1. Start Date */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text block">
                    {__('Start Date', 'codeclove-school-management')}
                  </label>
                  <DatePicker
                    value={quickStartDate}
                    showDayOfWeek
                    onChange={setQuickStartDate}
                    minDate={selectedExam?.starts_on}
                    maxDate={selectedExam?.ends_on}
                    placeholder={__('Pick start date...', 'codeclove-school-management')}
                    className="w-full"
                  />
                </div>

                {/* 2. Interval / Cadence */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text block">
                    {__('Gap Between Papers', 'codeclove-school-management')}
                  </label>
                  <Select
                    value={String(quickInterval)}
                    onValueChange={(val) => setQuickInterval(Number(val))}
                    options={QUICK_INTERVAL_OPTIONS}
                    className="h-8 text-xs"
                  />
                </div>

                {/* 3. Shift / Timing */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text block">
                    {__('Time Slot / Shift', 'codeclove-school-management')}
                  </label>
                  <Select
                    value={quickShift}
                    onValueChange={setQuickShift}
                    options={QUICK_SHIFT_OPTIONS}
                    className="h-8 text-xs"
                  />
                </div>

                {/* 4. Room / Venue */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text block">
                    {__('Default Room (Optional)', 'codeclove-school-management')}
                  </label>
                  <Input
                    type="text"
                    placeholder={__('e.g. Room 101, Hall A', 'codeclove-school-management')}
                    value={quickRoom}
                    onChange={(e) => setQuickRoom(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Bottom Row: Preview + Options + Apply Action */}
              <div className="pt-2 border-t border-border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                {/* Left: Live Preview */}
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-2xs font-bold uppercase tracking-wider text-text-subtle">
                    {__('Preview:', 'codeclove-school-management')}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {previewPills.map((pill, idx) => (
                      <Fragment key={pill}>
                        <span className="font-mono text-3xs font-semibold px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-text">
                          {pill}
                        </span>
                        {idx < previewPills.length - 1 && (
                          <ArrowRight size={10} className="text-text-subtle" />
                        )}
                      </Fragment>
                    ))}
                    {targetSubjects.length > previewPills.length && (
                      <span className="text-3xs text-text-muted font-mono">
                        +{targetSubjects.length - previewPills.length} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Controls & Apply CTA */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {/* Skip Sundays Checkbox */}
                  <Checkbox
                    checked={quickSkipWeekends}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickSkipWeekends(e.target.checked)}
                    label={<span className="text-2xs font-medium">{__('Skip Sundays', 'codeclove-school-management')}</span>}
                  />

                  {/* Scope Switcher */}
                  <div className="inline-flex rounded-md border border-border bg-bg-surface p-0.5 text-3xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setQuickScope('unscheduled')}
                      className={cn(
                        'px-2 py-0.5 rounded transition-colors',
                        quickScope === 'unscheduled'
                          ? 'bg-brand text-text-inverted shadow-xs'
                          : 'text-text-muted hover:text-text'
                      )}
                    >
                      {sprintf(__('Unscheduled (%d)', 'codeclove-school-management'), unscheduledCount)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickScope('all')}
                      className={cn(
                        'px-2 py-0.5 rounded transition-colors',
                        quickScope === 'all'
                          ? 'bg-brand text-text-inverted shadow-xs'
                          : 'text-text-muted hover:text-text'
                      )}
                    >
                      {sprintf(__('All (%d)', 'codeclove-school-management'), subjects.length)}
                    </button>
                  </div>

                  {/* Apply Button */}
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyQuickFill}
                    disabled={targetSubjects.length === 0}
                    className="gap-1.5 font-semibold text-xs h-8 shadow-xs"
                  >
                    <Zap size={13} className="fill-current" />
                    <span>
                      {sprintf(
                        __('Fill %d Subjects', 'codeclove-school-management'),
                        targetSubjects.length
                      )}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          )}
          <CardContent className="p-0 overflow-x-auto">
            <TableRoot>
              <Thead className="sticky top-0 z-10 bg-bg-surface/95 backdrop-blur-xs border-b border-border shadow-2xs">
                <Tr className="bg-bg-surface/60 border-b border-border">
                  <Th align="left" className="min-w-[220px] ps-5 py-3 font-semibold text-2xs uppercase tracking-wider text-text-subtle">
                    {__('Subject', 'codeclove-school-management')}
                  </Th>
                  <Th align="left" className="min-w-[170px] py-3 font-semibold text-2xs uppercase tracking-wider text-text-subtle">
                    {__('Date', 'codeclove-school-management')}
                  </Th>
                  <Th align="left" className="min-w-[240px] py-3 font-semibold text-2xs uppercase tracking-wider text-text-subtle">
                    {__('Time Slot', 'codeclove-school-management')}
                  </Th>
                  <Th align="left" className="min-w-[150px] py-3 font-semibold text-2xs uppercase tracking-wider text-text-subtle">
                    {__('Room / Venue', 'codeclove-school-management')}
                  </Th>
                  <Th align="right" className="min-w-[105px] py-3 font-semibold text-2xs uppercase tracking-wider text-text-subtle">
                    {__('Max Marks', 'codeclove-school-management')}
                  </Th>
                  <Th align="right" className="min-w-[110px] py-3 pe-5 font-semibold text-2xs uppercase tracking-wider text-text-subtle">
                    {__('Passing Marks', 'codeclove-school-management')}
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {displayedSubjects.length === 0 ? (
                  <Tr>
                    <Td colSpan={6} className="py-12 text-center bg-bg-surface/30">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        {filterStatus === 'pending' ? (
                          <>
                            <CheckCircle2 size={24} className="text-success" />
                            <p className="text-sm font-semibold text-text">
                              {__('All Subjects Scheduled!', 'codeclove-school-management')}
                            </p>
                            <p className="text-xs text-text-muted">
                              {__('Every subject in this class has an assigned date and time slot.', 'codeclove-school-management')}
                            </p>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setFilterStatus('all')}
                              className="mt-2 text-xs h-7"
                            >
                              {__('View All Subjects', 'codeclove-school-management')}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Clock size={24} className="text-text-subtle" />
                            <p className="text-sm font-semibold text-text">
                              {__('No Subjects Scheduled Yet', 'codeclove-school-management')}
                            </p>
                            <p className="text-xs text-text-muted">
                              {__('Use Quick Fill Cadence or assign dates and time slots to subjects below.', 'codeclove-school-management')}
                            </p>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setFilterStatus('all')}
                              className="mt-2 text-xs h-7"
                            >
                              {__('View All Subjects', 'codeclove-school-management')}
                            </Button>
                          </>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ) : (
                  displayedSubjects.map((sub) => {
                    const row = rows[sub.subject_id] || {
                      exam_date: '',
                      start_time: '',
                      end_time: '',
                      room: '',
                      max_marks: 100,
                      pass_marks: 33,
                    }

                    const sTime = cleanTime(row.start_time)
                    const eTime = cleanTime(row.end_time)
                    const isInvalidTime = Boolean(sTime && eTime && eTime <= sTime)
                    const isInvalidPassMarks =
                      row.pass_marks !== '' &&
                      row.max_marks !== '' &&
                      Number(row.pass_marks) > Number(row.max_marks)
                    const dayMeta = getDayMeta(row.exam_date)
                    const isComposite = row.assessment_mode === 'theory_practical'

                    const practicalDayMeta = getDayMeta(row.practical_date)
                    const isInvalidPracticalTime =
                      Boolean(
                        row.practical_start_time &&
                        row.practical_end_time &&
                        cleanTime(row.practical_start_time) &&
                        cleanTime(row.practical_end_time) &&
                        row.practical_end_time <= row.practical_start_time
                      )
                    return (
                      <Tr
                        key={sub.subject_id}
                        className="hover:bg-hover-bg/30 transition-colors border-b border-border"
                      >
                        {/* 1. Subject Name & Code */}
                        <Td align="left" className="ps-5 py-3">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="font-semibold text-text text-sm leading-tight">
                              {sub.name}
                            </span>

                            <div className="flex items-center gap-2">
                              {sub.code && (
                                <span className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-bg-surface border border-border text-text-subtle shrink-0 inline-flex items-center h-6">
                                  {sub.code}
                                </span>
                              )}
                              <div className="relative inline-flex items-center">
                                <select
                                  value={row.assessment_mode || 'total_only'}
                                  onChange={(e) => {
                                    const mode = e.target.value as AssessmentMode
                                    handleRowChange(sub.subject_id, 'assessment_mode', mode)
                                    if (mode === 'theory_practical' && (!row.theory_max_marks || !row.practical_max_marks)) {
                                      handleRowChange(sub.subject_id, 'theory_max_marks', 70)
                                      handleRowChange(sub.subject_id, 'practical_max_marks', 30)
                                      handleRowChange(sub.subject_id, 'theory_pass_marks', 23)
                                      handleRowChange(sub.subject_id, 'practical_pass_marks', 10)
                                      handleRowChange(sub.subject_id, 'max_marks', 100)
                                      handleRowChange(sub.subject_id, 'pass_marks', 33)
                                    } else if (mode === 'practical_only') {
                                      handleRowChange(sub.subject_id, 'practical_max_marks', row.max_marks || 100)
                                      handleRowChange(sub.subject_id, 'practical_pass_marks', row.pass_marks || 33)
                                    }
                                  }}
                                  className={cn(
                                    'h-6 ps-2.5 pe-6 text-xs rounded border shadow-2xs cursor-pointer appearance-none outline-none transition-colors select-none font-medium',
                                    (row.assessment_mode && ASSESSMENT_MODE_STYLES[row.assessment_mode]) || 'bg-bg-surface border-border text-text-muted hover:text-text hover:border-border-strong focus:border-brand'
                                  )}
                                  aria-label={sprintf(__('%s assessment mode', 'codeclove-school-management'), sub.name)}
                                >
                                  <option value="total_only">{__('Theory Only', 'codeclove-school-management')}</option>
                                  <option value="theory_practical">{__('Theory + Practical', 'codeclove-school-management')}</option>
                                  <option value="practical_only">{__('Practical Only', 'codeclove-school-management')}</option>
                                  <option value="grade_only">{__('Grade Only', 'codeclove-school-management')}</option>
                                </select>
                                <ChevronDown
                                  size={11}
                                  className={cn(
                                    'pointer-events-none absolute right-1.5',
                                    isComposite ? 'text-brand' : 'text-text-subtle'
                                  )}
                                />
                              </div>
                            </div>

                            {isComposite && (
                              <span className="text-3xs font-mono text-text-muted">
                                {sprintf(__('Tot: %s / %s', 'codeclove-school-management'), row.max_marks, row.pass_marks)}
                              </span>
                            )}
                          </div>
                        </Td>

                        {/* 2. Exam Date */}
                        <Td align="left" className="py-3">
                          {isComposite ? (
                            <div className="space-y-1.5 min-w-[170px]">
                              {/* Theory Date */}
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-3xs font-semibold text-text-subtle w-4 shrink-0">Th</span>
                                <DatePicker
                                  value={row.exam_date}
                                  showDayOfWeek
                                  onChange={(val) => handleRowChange(sub.subject_id, 'exam_date', val)}
                                  minDate={selectedExam?.starts_on}
                                  maxDate={selectedExam?.ends_on}
                                  placeholder={__('Theory date...', 'codeclove-school-management')}
                                  aria-label={sprintf(__('%s theory exam date', 'codeclove-school-management'), sub.name)}
                                  className={cn(
                                    'w-full h-8 text-xs',
                                    dayMeta?.isSunday && 'border-danger text-danger font-medium focus:border-danger'
                                  )}
                                />
                                {dayMeta?.isSunday && (
                                  <span className="text-3xs font-bold px-1 py-0.5 rounded bg-danger-dim border border-danger/30 text-danger shrink-0 uppercase tracking-wider">
                                    {__('Sun!', 'codeclove-school-management')}
                                  </span>
                                )}
                              </div>

                              {/* Practical Date */}
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-3xs font-semibold text-text-subtle w-4 shrink-0">Pr</span>
                                <DatePicker
                                  value={row.practical_date || ''}
                                  showDayOfWeek
                                  onChange={(val) => handleRowChange(sub.subject_id, 'practical_date', val)}
                                  minDate={selectedExam?.starts_on}
                                  maxDate={selectedExam?.ends_on}
                                  placeholder={__('Practical date...', 'codeclove-school-management')}
                                  aria-label={sprintf(__('%s practical exam date', 'codeclove-school-management'), sub.name)}
                                  className={cn(
                                    'w-full h-8 text-xs',
                                    practicalDayMeta?.isSunday && 'border-danger text-danger font-medium focus:border-danger'
                                  )}
                                />
                                {practicalDayMeta?.isSunday && (
                                  <span className="text-3xs font-bold px-1 py-0.5 rounded bg-danger-dim border border-danger/30 text-danger shrink-0 uppercase tracking-wider">
                                    {__('Sun!', 'codeclove-school-management')}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 min-w-[155px]">
                              <DatePicker
                                value={row.exam_date}
                                showDayOfWeek
                                onChange={(val) => handleRowChange(sub.subject_id, 'exam_date', val)}
                                minDate={selectedExam?.starts_on}
                                maxDate={selectedExam?.ends_on}
                                placeholder={__('Pick date...', 'codeclove-school-management')}
                                aria-label={sprintf(__('%s exam date', 'codeclove-school-management'), sub.name)}
                                className={cn(
                                  'w-full h-8 text-xs',
                                  dayMeta?.isSunday && 'border-danger text-danger font-medium focus:border-danger'
                                )}
                              />
                              {dayMeta?.isSunday && (
                                <span className="text-3xs font-bold px-1.5 py-0.5 rounded bg-danger-dim border border-danger/30 text-danger shrink-0 uppercase tracking-wider">
                                  {__('Sun!', 'codeclove-school-management')}
                                </span>
                              )}
                            </div>
                          )}
                        </Td>

                        {/* 3. Time Slot */}
                        <Td align="left" className="py-3">
                          {isComposite ? (
                            <div className="space-y-1.5 min-w-[210px]">
                              <TimeRangePicker
                                startTime={row.start_time}
                                endTime={row.end_time}
                                error={Boolean(isInvalidTime)}
                                placeholder={__('Theory time...', 'codeclove-school-management')}
                                onChange={(start, end) => handleSlotChange(sub.subject_id, start, end)}
                                aria-label={sprintf(__('%s theory exam time slot', 'codeclove-school-management'), sub.name)}
                                className="w-full font-mono text-xs h-8"
                              />
                              <TimeRangePicker
                                startTime={row.practical_start_time || ''}
                                endTime={row.practical_end_time || ''}
                                error={Boolean(isInvalidPracticalTime)}
                                placeholder={__('Practical time...', 'codeclove-school-management')}
                                onChange={(start, end) => {
                                  handleRowChange(sub.subject_id, 'practical_start_time', start)
                                  handleRowChange(sub.subject_id, 'practical_end_time', end)
                                }}
                                aria-label={sprintf(__('%s practical time slot', 'codeclove-school-management'), sub.name)}
                                className="w-full font-mono text-xs h-8"
                              />
                            </div>
                          ) : (
                            <div className="min-w-[210px]">
                              <TimeRangePicker
                                startTime={row.start_time}
                                endTime={row.end_time}
                                error={Boolean(isInvalidTime)}
                                placeholder={__('Set time...', 'codeclove-school-management')}
                                onChange={(start, end) => handleSlotChange(sub.subject_id, start, end)}
                                aria-label={sprintf(__('%s exam time slot', 'codeclove-school-management'), sub.name)}
                                className="w-full font-mono text-xs h-8"
                              />
                            </div>
                          )}
                        </Td>

                        {/* 4. Room / Venue */}
                        <Td align="left" className="py-3">
                          {isComposite ? (
                            <div className="space-y-1.5 min-w-[130px]">
                              <Input
                                type="text"
                                value={row.room}
                                onChange={(e) => handleRowChange(sub.subject_id, 'room', e.target.value)}
                                placeholder={__('Theory room...', 'codeclove-school-management')}
                                aria-label={sprintf(__('%s theory room', 'codeclove-school-management'), sub.name)}
                                className="w-full h-8 text-xs bg-bg-surface"
                              />
                              <Input
                                type="text"
                                value={row.practical_room || ''}
                                onChange={(e) => handleRowChange(sub.subject_id, 'practical_room', e.target.value)}
                                placeholder={__('Practical room / lab...', 'codeclove-school-management')}
                                aria-label={sprintf(__('%s practical room', 'codeclove-school-management'), sub.name)}
                                className="w-full h-8 text-xs bg-bg-surface"
                              />
                            </div>
                          ) : (
                            <div className="min-w-[130px]">
                              <Input
                                type="text"
                                value={row.room}
                                onChange={(e) => handleRowChange(sub.subject_id, 'room', e.target.value)}
                                placeholder={__('Room / Hall...', 'codeclove-school-management')}
                                aria-label={sprintf(__('%s examination venue or room', 'codeclove-school-management'), sub.name)}
                                className="w-full h-8 text-xs bg-bg-surface"
                              />
                            </div>
                          )}
                        </Td>

                        {/* 5. Max Marks */}
                        <Td align="right" className="py-3">
                          {isComposite ? (
                            <div className="space-y-1.5 text-right min-w-[70px]">
                              <Input
                                type="number"
                                min={1}
                                max={1000}
                                value={row.theory_max_marks ?? 70}
                                onChange={(e) => {
                                  const th = Number(e.target.value) || 0
                                  const pr = Number(row.practical_max_marks) || 0
                                  handleRowChange(sub.subject_id, 'theory_max_marks', e.target.value)
                                  handleRowChange(sub.subject_id, 'max_marks', th + pr)
                                }}
                                aria-label={sprintf(__('%s theory maximum marks', 'codeclove-school-management'), sub.name)}
                                className="w-16 h-8 text-right font-mono text-xs tabular-nums ms-auto bg-bg-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <Input
                                type="number"
                                min={0}
                                max={1000}
                                value={row.practical_max_marks ?? 30}
                                onChange={(e) => {
                                  const pr = Number(e.target.value) || 0
                                  const th = Number(row.theory_max_marks) || 0
                                  handleRowChange(sub.subject_id, 'practical_max_marks', e.target.value)
                                  handleRowChange(sub.subject_id, 'max_marks', th + pr)
                                }}
                                aria-label={sprintf(__('%s practical maximum marks', 'codeclove-school-management'), sub.name)}
                                className="w-16 h-8 text-right font-mono text-xs tabular-nums ms-auto bg-bg-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                          ) : row.assessment_mode === 'grade_only' ? (
                            <span className="inline-flex items-center text-3xs font-medium px-2 py-0.5 rounded bg-bg-surface border border-border text-text-subtle font-mono">
                              {__('Direct Grade', 'codeclove-school-management')}
                            </span>
                          ) : (
                            <Input
                              type="number"
                              min={1}
                              max={1000}
                              value={row.max_marks}
                              onChange={(e) => handleRowChange(sub.subject_id, 'max_marks', e.target.value)}
                              aria-label={sprintf(__('%s maximum marks', 'codeclove-school-management'), sub.name)}
                              className="w-16 text-right font-mono tabular-nums ms-auto h-8 text-xs bg-bg-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          )}
                        </Td>

                        {/* 6. Passing Marks */}
                        <Td align="right" className="py-3 pe-5">
                          {isComposite ? (
                            <div className="space-y-1.5 text-right min-w-[70px]">
                              <Input
                                type="number"
                                min={0}
                                max={Number(row.theory_max_marks) || 1000}
                                value={row.theory_pass_marks ?? 23}
                                onChange={(e) => {
                                  const thP = Number(e.target.value) || 0
                                  const prP = Number(row.practical_pass_marks) || 0
                                  handleRowChange(sub.subject_id, 'theory_pass_marks', e.target.value)
                                  handleRowChange(sub.subject_id, 'pass_marks', thP + prP)
                                }}
                                aria-label={sprintf(__('%s theory passing marks', 'codeclove-school-management'), sub.name)}
                                className="w-16 h-8 text-right font-mono text-xs tabular-nums ms-auto bg-bg-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <Input
                                type="number"
                                min={0}
                                max={Number(row.practical_max_marks) || 1000}
                                value={row.practical_pass_marks ?? 10}
                                onChange={(e) => {
                                  const prP = Number(e.target.value) || 0
                                  const thP = Number(row.theory_pass_marks) || 0
                                  handleRowChange(sub.subject_id, 'practical_pass_marks', e.target.value)
                                  handleRowChange(sub.subject_id, 'pass_marks', thP + prP)
                                }}
                                aria-label={sprintf(__('%s practical passing marks', 'codeclove-school-management'), sub.name)}
                                className="w-16 h-8 text-right font-mono text-xs tabular-nums ms-auto bg-bg-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                          ) : row.assessment_mode === 'grade_only' ? (
                            <span className="text-3xs font-medium text-text-subtle font-mono pe-2">—</span>
                          ) : (
                            <div className="space-y-0.5 text-right">
                              <Input
                                type="number"
                                min={0}
                                max={Number(row.max_marks) || 1000}
                                error={Boolean(isInvalidPassMarks)}
                                value={row.pass_marks}
                                onChange={(e) => handleRowChange(sub.subject_id, 'pass_marks', e.target.value)}
                                aria-label={sprintf(__('%s passing marks', 'codeclove-school-management'), sub.name)}
                                className="w-16 text-right font-mono tabular-nums ms-auto h-8 text-xs bg-bg-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              {isInvalidPassMarks && (
                                <p className="text-3xs text-danger leading-none text-right">
                                  {__('Pass > Max', 'codeclove-school-management')}
                                </p>
                              )}
                            </div>
                          )}
                        </Td>
                      </Tr>
                    )
                  })
                )}
               </Tbody>
             </TableRoot>

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between p-4 border-t border-border bg-bg-surface/50 dark:bg-bg-surface/60">
              <span className="text-xs text-text-muted font-medium">
                {scheduledCount === subjects.length
                  ? sprintf(
                      __('All %d subjects scheduled for %s', 'codeclove-school-management'),
                      subjects.length,
                      selectedUnit?.name ?? ''
                    )
                  : sprintf(
                      __('%d of %d subjects scheduled for %s (%d pending)', 'codeclove-school-management'),
                      scheduledCount,
                      subjects.length,
                      selectedUnit?.name ?? '',
                      subjects.length - scheduledCount
                    )}
              </span>

              <Button
                onClick={handleSave}
                disabled={saveTimetableMutation.isPending}
                className="gap-2 shadow-xs font-semibold"
              >
                {saveTimetableMutation.isPending && <Spinner size="sm" />}
                <Save size={16} />
                <span>{__('Save Schedule', 'codeclove-school-management')}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
