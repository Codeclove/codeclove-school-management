/**
 * TypeScript types for the CodeClove Examinations module.
 */

export type ExamType = 'standard' | 'composite'
export type ExamStatus = 'draft' | 'published'
export type ExamMarkStatus = 'present' | 'absent' | 'exempt'
export type AssessmentMode = 'total_only' | 'theory_practical' | 'practical_only' | 'grade_only'

export type ReportCardTemplateArchetype = 'oxford' | 'modern' | 'holistic'
export type ReportCardFontFamily = 'serif' | 'sans'
export type ReportCardHeadingScale = 'compact' | 'standard' | 'spacious'
export type ReportCardCurriculumPreset = 'cbse' | 'us' | 'ib' | 'general'
export type ReportCardMarksFormat = 'total_only' | 'theory_practical'

/** Per-exam report card display configuration. */
export interface ReportCardConfig {
  template?: ReportCardTemplateArchetype
  accent_color?: string
  font_family?: ReportCardFontFamily
  heading_scale?: ReportCardHeadingScale
  paper_size?: 'a4' | 'letter'
  density?: 'auto' | 'spacious' | 'standard' | 'compact'
  curriculum?: ReportCardCurriculumPreset
  marks_format?: ReportCardMarksFormat
  show_grading_scale?: boolean
  show_attendance?: boolean
  show_remarks?: boolean
  show_teacher_remarks?: boolean
  show_principal_remarks?: boolean
  show_signatures?: boolean
  show_teacher_signature?: boolean
  show_principal_signature?: boolean
  show_parent_signature?: boolean
  show_student_photo?: boolean
  show_rank?: boolean
  show_percentage?: boolean
  show_grade?: boolean
  show_gpa?: boolean
  show_pass_marks?: boolean
  show_qr_code?: boolean
  show_digital_signature?: boolean
  show_seal?: boolean
  signatory_count?: 2 | 3
  signatory_1_title?: string
  signatory_2_title?: string
  signatory_3_title?: string
  custom_title?: string
  custom_affiliation?: string
  toner_saver?: boolean
  /** CBSE-style compartment result for exactly one failed subject. Opt-in per exam via report card config. */
  enable_compartment?: boolean
  /** Whether student marks and report cards are released on the student/guardian portal. */
  publish_results?: boolean
}

/** Admit card / hall ticket configuration. */
export interface AdmitCardConfig {
  allow_portal_download?: boolean
  layout?: '1-up' | '2-up'
  show_photo?: boolean
  show_instructions?: boolean
  show_invigilator_sign?: boolean
  signatory_title?: string
  instructions?: string[]
}
export interface Exam {
  id: number
  academic_session_id: number
  academic_term_id: number | null
  grading_scale_id: number | null
  name: string
  code: string | null
  description: string | null
  exam_type: 'standard' | 'composite'
  starts_on: string
  ends_on: string
  status: 'draft' | 'published'
  weight_percentage: number
  report_card_config?: ReportCardConfig | null
  admit_card_config?: AdmitCardConfig | null
  grading_scale_name?: string | null
  academic_session_name?: string | null
  academic_term_name?: string | null
  subjects_count?: number
  created_at?: string
  updated_at?: string
}

export interface ExamSubject {
  id: number
  exam_id: number
  academic_unit_id: number
  subject_id: number
  subject_name: string
  subject_code?: string | null
  academic_unit_name?: string | null
  exam_date: string | null
  start_time: string | null
  end_time: string | null
  room: string | null
  max_marks: number
  pass_marks: number
  assessment_mode?: AssessmentMode
  theory_max_marks?: number | null
  theory_pass_marks?: number | null
  practical_max_marks?: number | null
  practical_pass_marks?: number | null
  practical_date?: string | null
  practical_start_time?: string | null
  practical_end_time?: string | null
  practical_room?: string | null
  marks_count?: number
  candidates_count?: number
  is_graded?: boolean
}
export interface ExamMark {
  id?: number | null
  exam_subject_id: number
  student_id: number
  student_name: string
  student_number: string
  roll_number: string | null
  group_name?: string | null
  marks_obtained: number | null
  theory_marks?: number | null
  practical_marks?: number | null
  status: 'present' | 'absent' | 'exempt'
  theory_status?: 'present' | 'absent' | 'exempt'
  practical_status?: 'present' | 'absent' | 'exempt'
  remarks: string | null
}

export interface GradingTier {
  label: string
  min: number
  max: number
  gp: number
  desc: string
  is_pass: boolean
}
export type GradingScaleType = 'percentage' | 'points'

export interface GradingScale {
  id: number
  name: string
  code: string
  description: string | null
  preset?: string | null
  scale_type?: GradingScaleType
  max_points?: number | null
  is_default: boolean
  tiers: GradingTier[]
}

export interface TabulationStudent {
  student_id: number
  student_name: string
  student_number: string
  roll_number: string | null
  group_name?: string | null
  marks: Record<
    number,
    {
      marks_obtained: number | null
      theory_marks?: number | null
      practical_marks?: number | null
      is_absent: boolean
      is_exempt?: boolean
      is_enrolled?: boolean
      status: string
    }
  >
  total_marks_obtained: number
  total_marks_possible: number
  percentage: number
  grade: string
  grade_point: number | null
  rank: number | null
  has_failed: boolean
  is_pending?: boolean
  is_partial?: boolean
  result_status?: 'passed' | 'failed' | 'partial' | 'pending'
  evaluated_papers?: number
  total_papers?: number
}
export interface TabulationSubject {
  id: number
  name: string
  code: string
  max_marks: number
  pass_marks: number
  assessment_mode?: AssessmentMode
  theory_max_marks?: number | null
  practical_max_marks?: number | null
}

export interface TabulationData {
  exam_id: number
  exam_name: string
  academic_unit_id: number
  academic_unit_name: string
  subjects: TabulationSubject[]
  students: TabulationStudent[]
}

export interface ReportCardSubject {
  subject_id: number
  name: string
  max_marks: number
  pass_marks: number
  marks_obtained: number | null
  percentage: number | null
  grade: string
  grade_point: number | null
  is_absent?: boolean
  is_exempt?: boolean
  is_pending?: boolean
  status?: string
  remarks?: string
  theory_marks?: number | null
  practical_marks?: number | null
  theory_max?: number | null
  practical_max?: number | null
  credits?: number
}

export interface CoScholasticItem {
  domain: string
  grade: string
  indicator?: string
}

export interface ReportCardData {
  exam: {
    id: number
    name: string
    starts_on: string
    ends_on: string
    status: string
    report_card_config?: ReportCardConfig | null
  }
  student: {
    id: number
    name: string
    student_number: string
    roll_number: string
    unit_name: string
    group_name: string
    guardian_name?: string
    admission_number?: string
    date_of_birth?: string
    gender?: string
    photo_url?: string | null
  }
  school: {
    name: string
    code?: string
    logo?: string
    signature?: string
    email?: string
    phone?: string
    address?: string
    affiliation_no?: string
  }
  subjects: ReportCardSubject[]
  co_scholastic?: CoScholasticItem[]
  summary: {
    total_obtained: number
    total_possible: number
    percentage: number
    grade: string
    grade_point: number
    /** Subjects the student failed or was absent for; drives the result_status label. */
    failed_subjects?: string[]
    rank: number | null
    total_students?: number | null
    result_status: string
  }
  attendance?: {
    total_days: number
    days_present: number
    attendance_percentage: number
  }
  grading_scale?: {
    id: number
    name: string
    scale_type?: GradingScaleType
    tiers: GradingTier[]
  } | null
}

export interface AdmitCardPaper {
  subject_id: number
  subject_name: string
  subject_code?: string
  exam_date: string
  start_time?: string
  end_time?: string
  room?: string
  max_marks?: number
}

export interface AdmitCardStudent {
  student_id: number
  name: string
  student_number: string
  admission_number?: string
  roll_number?: string
  unit_name: string
  group_name?: string
  date_of_birth?: string
  gender?: string
  photo_url?: string | null
  guardian_name?: string | null
  papers: AdmitCardPaper[]
}

export interface AdmitCardsDataset {
  exam: {
    id: number
    name: string
    code?: string
    starts_on: string
    ends_on: string
    academic_session_name?: string
    academic_term_name?: string
    status: string
    config?: AdmitCardConfig | null
    admit_card_config?: AdmitCardConfig | null
  }
  school: {
    name: string
    code?: string
    logo?: string
    email?: string
    phone?: string
    address?: string
    affiliation_no?: string
  }
  instructions: string[]
  students: AdmitCardStudent[]
}

// ─── Payloads & Filters ───────────────────────────────────────────────────────

export interface ExamFilters {
  academic_session_id?: number
  academic_term_id?: number
  status?: string
  search?: string
}

export interface CreateExamPayload {
  academic_session_id: number
  academic_term_id?: number | null
  grading_scale_id?: number | null
  name: string
  code?: string | null
  description?: string | null
  exam_type?: 'standard' | 'composite'
  starts_on: string
  ends_on: string
  weight_percentage?: number
  status?: 'draft' | 'published'
  report_card_config?: ReportCardConfig | null
  admit_card_config?: AdmitCardConfig | null
}

export type UpdateExamPayload = Partial<CreateExamPayload>

export interface SaveTimetablePaper {
  id?: number
  subject_id: number
  assessment_mode?: AssessmentMode
  exam_date?: string | null
  start_time?: string | null
  end_time?: string | null
  room?: string | null
  max_marks: number
  pass_marks: number
  theory_max_marks?: number | null
  theory_pass_marks?: number | null
  practical_max_marks?: number | null
  practical_pass_marks?: number | null
  practical_date?: string | null
  practical_start_time?: string | null
  practical_end_time?: string | null
  practical_room?: string | null
}

export interface SaveExamTimetablePayload {
  unit_id: number
  papers: SaveTimetablePaper[]
}

export interface SaveExamMarkItem {
  student_id: number
  marks_obtained: number | null
  theory_marks?: number | null
  practical_marks?: number | null
  status: 'present' | 'absent' | 'exempt'
  theory_status?: 'present' | 'absent' | 'exempt'
  practical_status?: 'present' | 'absent' | 'exempt'
  remarks?: string | null
}

export interface SaveExamMarksPayload {
  unit_id: number
  subject_id: number
  marks: SaveExamMarkItem[]
}

export interface SaveGradingScalePayload {
  id?: number
  name: string
  code?: string
  description?: string | null
  preset?: string | null
  scale_type?: GradingScaleType
  max_points?: number | null
  is_default?: boolean
  tiers: GradingTier[]
}
