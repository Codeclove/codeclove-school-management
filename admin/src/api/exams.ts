/**
 * TanStack Query hooks for the Examinations module.
 *
 * Covers: Exams CRUD, publishing, timetable/schedule, marks entry & roster,
 * tabulation sheets, student report cards, and grading scale configurations.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'
import type {
  Exam,
  ExamSubject,
  ExamMark,
  GradingScale,
  TabulationData,
  ReportCardData,
  AdmitCardsDataset,
  AdmitCardConfig,
  CreateExamPayload,
  UpdateExamPayload,
  SaveTimetablePaper,
  SaveExamMarkItem,
  SaveGradingScalePayload,
} from '@/modules/exams/types'

// Re-export all exam types for convenience
export type * from '@/modules/exams/types'

/**
 * Serialize filter parameters into a URL query string.
 */
function toQueryString(params?: Record<string, unknown>): string {
  if (!params) return ''
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '' && v !== null)
    .map(([k, v]) => [k, String(v)])
  const qs = new URLSearchParams(entries).toString()
  return qs ? `?${qs}` : ''
}

// ─── Exams CRUD ──────────────────────────────────────────────────────────────

/**
 * Hook to retrieve a list of exams with optional filters.
 */
export function useExams(filters?: Record<string, unknown>) {
  return useQuery<Exam[]>({
    queryKey: queryKeys.exams.list(filters),
    queryFn: async () => {
      const res = await api.get<Exam[]>(`exams${toQueryString(filters)}`)
      return res.data
    },
  })
}

/**
 * Hook to retrieve a single examination with detailed metadata.
 */
export function useExam(id: number) {
  return useQuery<Exam>({
    queryKey: queryKeys.exams.detail(id),
    queryFn: async () => {
      const res = await api.get<Exam>(`exams/${id}`)
      return res.data
    },
    enabled: Boolean(id && id > 0),
  })
}

/**
 * Hook to create a new examination.
 */
export function useCreateExam() {
  const qc = useQueryClient()
  return useMutation<Exam, Error, CreateExamPayload>({
    mutationFn: async (payload) => {
      const res = await api.post<Exam>('exams', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.exams.lists() })
      qc.invalidateQueries({ queryKey: queryKeys.exams.all })
    },
  })
}

/**
 * Hook to update an existing examination.
 */
export function useUpdateExam() {
  const qc = useQueryClient()
  return useMutation<
    Exam,
    Error,
    { id: number; data?: UpdateExamPayload } & UpdateExamPayload
  >({
    mutationFn: async ({ id, data, ...rest }) => {
      const res = await api.patch<Exam>(`exams/${id}`, data ?? rest)
      return res.data
    },
    onSuccess: (exam) => {
      qc.invalidateQueries({ queryKey: queryKeys.exams.all })
      if (exam?.id) {
        qc.invalidateQueries({ queryKey: queryKeys.exams.detail(exam.id) })
      }
    },
  })
}

/**
 * Hook to soft-delete an examination.
 */
export function useDeleteExam() {
  const qc = useQueryClient()
  return useMutation<{ deleted: boolean } | void, Error, number>({
    mutationFn: async (id: number) => {
      const res = await api.delete<{ deleted: boolean }>(`exams/${id}`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.exams.all })
    },
  })
}

/**
 * Hook to publish or revert an examination status.
 */
export function usePublishExam() {
  const qc = useQueryClient()
  return useMutation<Exam, Error, { id: number; publish?: boolean } | number>({
    mutationFn: async (args) => {
      const id = typeof args === 'number' ? args : args.id
      const publish = typeof args === 'object' && args.publish !== undefined ? args.publish : true
      const res = await api.post<Exam>(`exams/${id}/publish`, { publish })
      return res.data
    },
    onSuccess: (_, args) => {
      const id = typeof args === 'number' ? args : args.id
      qc.invalidateQueries({ queryKey: queryKeys.exams.all })
      qc.invalidateQueries({ queryKey: queryKeys.exams.detail(id) })
    },
  })
}

// ─── Timetable / Exam Subjects ───────────────────────────────────────────────

/**
 * Hook to retrieve scheduled papers for an examination, optionally scoped to a unit.
 */
export function useExamTimetable(examId: number, unitId?: number) {
  return useQuery<ExamSubject[]>({
    queryKey: queryKeys.exams.timetable(examId, unitId),
    queryFn: async () => {
      const qs = unitId ? `?unit_id=${unitId}` : ''
      const res = await api.get<ExamSubject[]>(`exams/${examId}/timetable${qs}`)
      return res.data
    },
    enabled: Boolean(examId && examId > 0),
  })
}

/**
 * Hook to bulk upsert examination papers / timetable schedule.
 */
export function useSaveExamTimetable() {
  const qc = useQueryClient()
  return useMutation<
    ExamSubject[],
    Error,
    { examId: number; unit_id: number; papers: SaveTimetablePaper[] }
  >({
    mutationFn: async ({ examId, unit_id, papers }) => {
      const res = await api.post<ExamSubject[]>(`exams/${examId}/timetable`, {
        unit_id,
        papers,
      })
      return res.data
    },
    onSuccess: (_, { examId, unit_id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.exams.timetable(examId, unit_id) })
      qc.invalidateQueries({ queryKey: queryKeys.exams.timetable(examId) })
      qc.invalidateQueries({ queryKey: queryKeys.exams.detail(examId) })
      qc.invalidateQueries({ queryKey: queryKeys.exams.all })
    },
  })
}

// ─── Marks Entry & Roster ────────────────────────────────────────────────────

/**
 * Hook to retrieve the marks roster for an exam, unit, and subject.
 */
export function useExamMarks(examId: number, unitId: number, subjectId: number, groupId?: number) {
  return useQuery<ExamMark[]>({
    queryKey: queryKeys.exams.marks(examId, unitId, subjectId, groupId),
    queryFn: async () => {
      const params = new URLSearchParams({
        unit_id: String(unitId),
        subject_id: String(subjectId),
      })
      if (groupId) {
        params.set('group_id', String(groupId))
      }
      const res = await api.get<ExamMark[]>(`exams/${examId}/marks?${params.toString()}`)
      return res.data
    },
    enabled: Boolean(examId && examId > 0 && unitId && unitId > 0 && subjectId && subjectId > 0),
  })
}

/**
 * Hook to bulk save marks for students in an exam paper.
 */
export function useSaveExamMarks() {
  const qc = useQueryClient()
  return useMutation<
    ExamMark[],
    Error,
    {
      examId: number
      unit_id: number
      subject_id: number
      marks: SaveExamMarkItem[]
    }
  >({
    mutationFn: async ({ examId, unit_id, subject_id, marks }) => {
      const res = await api.post<ExamMark[]>(`exams/${examId}/marks`, {
        unit_id,
        subject_id,
        marks,
      })
      return res.data
    },
    onSuccess: (_, { examId, unit_id, subject_id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.exams.marks(examId, unit_id, subject_id) })
      qc.invalidateQueries({ queryKey: queryKeys.exams.all })
    },
  })
}

// ─── Tabulation & Reports ────────────────────────────────────────────────────

/**
 * Hook to retrieve a consolidated tabulation sheet for a unit in an exam.
 */
export function useExamTabulation(examId: number, unitId: number, groupId?: number) {
  return useQuery<TabulationData>({
    queryKey: queryKeys.exams.tabulation(examId, unitId, groupId),
    queryFn: async () => {
      const params = new URLSearchParams({
        unit_id: String(unitId),
      })
      if (groupId) {
        params.set('group_id', String(groupId))
      }
      const res = await api.get<TabulationData>(`exams/${examId}/tabulation?${params.toString()}`)
      return res.data
    },
    enabled: Boolean(examId && examId > 0 && unitId && unitId > 0),
  })
}

/**
 * Hook to retrieve an individual student's report card for an examination.
 */
export function useExamReportCard(examId: number, studentId: number) {
  return useQuery<ReportCardData>({
    queryKey: queryKeys.exams.reportCard(examId, studentId),
    queryFn: async () => {
      const res = await api.get<ReportCardData>(`exams/${examId}/report-card/${studentId}`)
      return res.data
    },
    enabled: Boolean(examId && examId > 0 && studentId && studentId > 0),
  })
}

// ─── Admit Cards (Hall Tickets) ──────────────────────────────────────────────

/**
 * Hook to retrieve batch admit cards for an exam, unit, and optional section or student.
 */
export function useExamAdmitCards(
  examId: number,
  unitId?: number,
  groupId?: number,
  studentId?: number,
  enabled = true
) {
  return useQuery<AdmitCardsDataset>({
    queryKey: queryKeys.exams.admitCards(examId, unitId, groupId, studentId),
    queryFn: async () => {
      const params: Record<string, unknown> = {}
      if (unitId) params.unit_id = unitId
      if (groupId) params.group_id = groupId
      if (studentId) params.student_id = studentId
      const res = await api.get<AdmitCardsDataset>(`exams/${examId}/admit-cards${toQueryString(params)}`)
      return res.data
    },
    enabled: Boolean(examId && examId > 0 && enabled && (Boolean(unitId) || Boolean(studentId))),
  })
}

/**
 * Hook to update an examination's admit card instructions and configuration.
 */
export function useUpdateAdmitCardConfig() {
  const qc = useQueryClient()
  return useMutation<Exam, Error, { examId: number; admit_card_config: AdmitCardConfig }>({
    mutationFn: async ({ examId, admit_card_config }) => {
      const res = await api.patch<Exam>(`exams/${examId}/admit-card-config`, {
        admit_card_config,
      })
      return res.data
    },
    onSuccess: (_, { examId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.exams.detail(examId) })
      qc.invalidateQueries({ queryKey: [...queryKeys.exams.all, 'admitCards'] })
      qc.invalidateQueries({ queryKey: queryKeys.exams.all })
    },
  })
}

// ─── Grading Scales ──────────────────────────────────────────────────────────

/**
 * Hook to retrieve all configured grading scales.
 */
export function useGradingScales(preset?: string) {
  return useQuery<GradingScale[]>({
    queryKey: preset ? [...queryKeys.exams.gradingScales(), preset] : queryKeys.exams.gradingScales(),
    queryFn: async () => {
      const qs = preset ? `?preset=${preset}` : ''
      const res = await api.get<GradingScale[]>(`exams/grading-scales${qs}`)
      return res.data
    },
  })
}

/**
 * Hook to create or update a grading scale configuration.
 */
export function useSaveGradingScale() {
  const qc = useQueryClient()
  return useMutation<GradingScale, Error, SaveGradingScalePayload>({
    mutationFn: async (payload) => {
      const res = await api.post<GradingScale>('exams/grading-scales', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.exams.gradingScales() })
      qc.invalidateQueries({ queryKey: queryKeys.exams.all })
    },
  })
}

/**
 * Hook to delete a grading scale.
 */
export function useDeleteGradingScale() {
  const qc = useQueryClient()
  return useMutation<{ deleted: boolean; id: number }, Error, number>({
    mutationFn: async (id: number) => {
      const res = await api.delete<{ deleted: boolean; id: number }>(`exams/grading-scales/${id}`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.exams.gradingScales() })
      qc.invalidateQueries({ queryKey: queryKeys.exams.all })
    },
  })
}
