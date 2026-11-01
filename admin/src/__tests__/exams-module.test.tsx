import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import ExamsListPage from '../modules/exams/pages/ExamsListPage'
import ExamTimetablePage from '../modules/exams/pages/ExamTimetablePage'
import ExamMarksPage from '../modules/exams/pages/ExamMarksPage'
import ExamReportsPage from '../modules/exams/pages/ExamReportsPage'
import ExamWorkspacePage from '../modules/exams/pages/ExamWorkspacePage'
import ExamFormPage from '../modules/exams/pages/ExamFormPage'
import GradingScalesPage from '../modules/exams/pages/GradingScalesPage'
import { ReportCardDocument } from '../modules/exams/components/ReportCardDocument'
import { TabulationLedgerDocument } from '../modules/exams/components/TabulationLedgerDocument'
import type {
  Exam,
  ExamSubject,
  ExamMark,
  GradingScale,
  TabulationData,
  ReportCardData,
} from '../modules/exams/types'
import type { AcademicUnit, AcademicGroup, Subject, AcademicSession, AcademicUnitSubject } from '../api/academics'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DEFAULT_EXAMS: Exam[] = [
  {
    id: 1,
    name: 'Midterm Examination 2026',
    code: 'MID-2026',
    description: null,
    academic_session_id: 10,
    academic_session_name: 'Academic Year 2025-2026',
    academic_term_id: 1,
    academic_term_name: 'Term 1',
    grading_scale_id: 100,
    grading_scale_name: 'CBSE 8-Point (India)',
    exam_type: 'standard',
    starts_on: '2026-10-15',
    ends_on: '2026-10-25',
    status: 'published',
    weight_percentage: 40,
    subjects_count: 2,
  },
  {
    id: 2,
    name: 'Final Term Examination 2026',
    code: 'FIN-2026',
    description: null,
    academic_session_id: 10,
    academic_session_name: 'Academic Year 2025-2026',
    academic_term_id: 2,
    academic_term_name: 'Term 2',
    grading_scale_id: 100,
    grading_scale_name: 'CBSE 8-Point (India)',
    exam_type: 'standard',
    starts_on: '2026-12-01',
    ends_on: '2026-12-15',
    status: 'draft',
    weight_percentage: 60,
    subjects_count: 2,
  },
]

const DEFAULT_GRADING_SCALES: GradingScale[] = [
  {
    id: 100,
    name: 'CBSE 8-Point (India)',
    code: 'CBSE_8PT',
    description: 'Central Board of Secondary Education 8-point grading scale from A1 down to E.',
    is_default: true,
    tiers: [
      { label: 'A1', min: 91, max: 100, gp: 10.0, desc: 'Outstanding — Top 1/8th of passed candidates', is_pass: true },
      { label: 'A2', min: 81, max: 90, gp: 9.0, desc: 'Excellent — Next 1/8th of passed candidates', is_pass: true },
      { label: 'B1', min: 71, max: 80, gp: 8.0, desc: 'Very Good — Next 1/8th', is_pass: true },
      { label: 'B2', min: 61, max: 70, gp: 7.0, desc: 'Good — Next 1/8th', is_pass: true },
      { label: 'C1', min: 51, max: 60, gp: 6.0, desc: 'Satisfactory — Next 1/8th', is_pass: true },
      { label: 'C2', min: 41, max: 50, gp: 5.0, desc: 'Average — Next 1/8th', is_pass: true },
      { label: 'D', min: 33, max: 40, gp: 4.0, desc: 'Pass Grade', is_pass: true },
      { label: 'E', min: 0, max: 32, gp: 0.0, desc: 'Needs Improvement / Fail', is_pass: false },
    ],
  },
  {
    id: 101,
    name: 'US 10-Point GPA',
    code: 'US_GPA_4',
    description: 'Standard North American 4.0 weighted grade point average scale from A+ down to F.',
    is_default: false,
    tiers: [
      { label: 'A+', min: 97, max: 100, gp: 4.0, desc: 'Superior / High Honors', is_pass: true },
      { label: 'A', min: 93, max: 96, gp: 4.0, desc: 'Excellent', is_pass: true },
      { label: 'B', min: 83, max: 86, gp: 3.0, desc: 'Above Average', is_pass: true },
      { label: 'C', min: 73, max: 76, gp: 2.0, desc: 'Competent', is_pass: true },
      { label: 'D', min: 60, max: 69, gp: 1.0, desc: 'Passing / Low Foundation', is_pass: true },
      { label: 'F', min: 0, max: 59, gp: 0.0, desc: 'Failing / No Credit', is_pass: false },
    ],
  },
]

const DEFAULT_SESSIONS = [
  { id: 10, name: 'Academic Year 2025-2026', code: 'AY-25-26', is_current: true, start_date: '2025-09-01', end_date: '2026-06-30' },
  { id: 9, name: 'Academic Year 2024-2025', code: 'AY-24-25', is_current: false, start_date: '2024-09-01', end_date: '2025-06-30' },
] as unknown as AcademicSession[]

const DEFAULT_UNITS = [
  { id: 5, name: 'Grade 10', code: 'G10', academic_session_id: 10, sort_order: 1 },
  { id: 6, name: 'Grade 11', code: 'G11', academic_session_id: 10, sort_order: 2 },
] as unknown as AcademicUnit[]

const DEFAULT_GROUPS = [
  { id: 20, name: 'Section A', code: 'SEC-A', academic_unit_id: 5 },
  { id: 21, name: 'Section B', code: 'SEC-B', academic_unit_id: 5 },
] as unknown as AcademicGroup[]

const DEFAULT_UNIT_SUBJECTS: AcademicUnitSubject[] = [
  { id: 501, unit_id: 5, subject_id: 301, subject_name: 'Mathematics', subject_code: 'MATH-101', subject_type: 'core', is_required: true, sort_order: 1, created_at: '' },
  { id: 502, unit_id: 5, subject_id: 302, subject_name: 'Science', subject_code: 'SCI-101', subject_type: 'core', is_required: true, sort_order: 2, created_at: '' },
]

const DEFAULT_SUBJECTS = [
  { id: 301, name: 'Mathematics', code: 'MATH-101', type: 'core' },
  { id: 302, name: 'Science', code: 'SCI-101', type: 'core' },
] as unknown as Subject[]
const DEFAULT_TIMETABLE_PAPERS: ExamSubject[] = [
  {
    id: 801,
    exam_id: 1,
    academic_unit_id: 5,
    subject_id: 301,
    subject_name: 'Mathematics',
    subject_code: 'MATH-101',
    exam_date: '2026-10-16',
    start_time: '09:00',
    end_time: '12:00',
    room: 'Hall A',
    max_marks: 100,
    pass_marks: 33,
  },
  {
    id: 802,
    exam_id: 1,
    academic_unit_id: 5,
    subject_id: 302,
    subject_name: 'Science',
    subject_code: 'SCI-101',
    exam_date: '2026-10-18',
    start_time: '09:00',
    end_time: '12:00',
    room: 'Hall B',
    max_marks: 100,
    pass_marks: 33,
  },
]

const DEFAULT_MARKS_ROSTER: ExamMark[] = [
  {
    id: 901,
    exam_subject_id: 801,
    student_id: 1001,
    student_name: 'Alice Johnson',
    student_number: 'STU-2026-001',
    roll_number: '101',
    marks_obtained: 95,
    status: 'present',
    remarks: 'Outstanding analytical skills',
  },
  {
    id: 902,
    exam_subject_id: 801,
    student_id: 1002,
    student_name: 'Bob Smith',
    student_number: 'STU-2026-002',
    roll_number: '102',
    marks_obtained: 85,
    status: 'present',
    remarks: 'Consistent class work',
  },
  {
    id: 903,
    exam_subject_id: 801,
    student_id: 1003,
    student_name: 'Charlie Brown',
    student_number: 'STU-2026-003',
    roll_number: '103',
    marks_obtained: 25,
    status: 'present',
    remarks: 'Needs remedial guidance',
  },
]

const DEFAULT_TABULATION: TabulationData = {
  exam_id: 1,
  exam_name: 'Midterm Examination 2026',
  academic_unit_id: 5,
  academic_unit_name: 'Grade 10',
  subjects: [
    { id: 301, name: 'Mathematics', code: 'MATH-101', max_marks: 100, pass_marks: 33 },
    { id: 302, name: 'Science', code: 'SCI-101', max_marks: 100, pass_marks: 33 },
  ],
  students: [
    {
      student_id: 1001,
      student_name: 'Alice Johnson',
      student_number: 'STU-2026-001',
      roll_number: '101',
      marks: {
        301: { marks_obtained: 95, is_absent: false, status: 'present' },
        302: { marks_obtained: 92, is_absent: false, status: 'present' },
      },
      total_marks_obtained: 187,
      total_marks_possible: 200,
      percentage: 93.5,
      grade: 'A1',
      grade_point: 10.0,
      rank: 1,
      has_failed: false,
    },
    {
      student_id: 1002,
      student_name: 'Bob Smith',
      student_number: 'STU-2026-002',
      roll_number: '102',
      marks: {
        301: { marks_obtained: 85, is_absent: false, status: 'present' },
        302: { marks_obtained: 80, is_absent: false, status: 'present' },
      },
      total_marks_obtained: 165,
      total_marks_possible: 200,
      percentage: 82.5,
      grade: 'A2',
      grade_point: 9.0,
      rank: 2,
      has_failed: false,
    },
    {
      student_id: 1003,
      student_name: 'Charlie Brown',
      student_number: 'STU-2026-003',
      roll_number: '103',
      marks: {
        301: { marks_obtained: 25, is_absent: false, status: 'present' },
        302: { marks_obtained: 30, is_absent: false, status: 'present' },
      },
      total_marks_obtained: 55,
      total_marks_possible: 200,
      percentage: 27.5,
      grade: 'E',
      grade_point: 0.0,
      rank: 3,
      has_failed: true,
    },
  ],
}

const DEFAULT_REPORT_CARD: ReportCardData = {
  exam: {
    id: 1,
    name: 'Midterm Examination 2026',
    starts_on: '2026-10-15',
    ends_on: '2026-10-25',
    status: 'published',
  },
  student: {
    id: 1001,
    name: 'Alice Johnson',
    student_number: 'STU-2026-001',
    roll_number: '101',
    unit_name: 'Grade 10',
    group_name: 'Section A',
    guardian_name: 'Robert Johnson',
  },
  school: {
    name: 'CodeClove International Academy',
    code: 'CC-SCH-2026',
    logo: '',
    email: 'admissions@codeclove.edu',
    phone: '+1 (555) 123-4567',
    address: '100 Academic Boulevard, Boston, MA 02108',
  },
  subjects: [
    {
      subject_id: 301,
      name: 'Mathematics',
      max_marks: 100,
      pass_marks: 33,
      marks_obtained: 95,
      percentage: 95.0,
      grade: 'A1',
      grade_point: 10.0,
      remarks: 'Outstanding analytical skills',
    },
    {
      subject_id: 302,
      name: 'Science',
      max_marks: 100,
      pass_marks: 33,
      marks_obtained: 92,
      percentage: 92.0,
      grade: 'A1',
      grade_point: 10.0,
      remarks: 'Exemplary laboratory execution',
    },
  ],
  summary: {
    total_obtained: 187,
    total_possible: 200,
    percentage: 93.5,
    grade: 'A1',
    grade_point: 10.0,
    rank: 1,
    result_status: 'PASSED',
  },
  attendance: {
    total_days: 90,
    days_present: 88,
    attendance_percentage: 97.8,
  },
}

// ─── Dynamic Mock Variables ───────────────────────────────────────────────────

let mockExams: Exam[] = [...DEFAULT_EXAMS]
let mockGradingScales: GradingScale[] = [...DEFAULT_GRADING_SCALES]
let mockSessions: AcademicSession[] = [...DEFAULT_SESSIONS]
let mockUnits: AcademicUnit[] = [...DEFAULT_UNITS]
let mockGroups: AcademicGroup[] = [...DEFAULT_GROUPS]
let mockUnitSubjects: AcademicUnitSubject[] = [...DEFAULT_UNIT_SUBJECTS]
let mockSubjects: Subject[] = [...DEFAULT_SUBJECTS]
let mockTimetablePapers: ExamSubject[] = [...DEFAULT_TIMETABLE_PAPERS]
let mockMarksRoster: ExamMark[] = [...DEFAULT_MARKS_ROSTER]
let mockTabulation: TabulationData | null = DEFAULT_TABULATION
let mockReportCard: ReportCardData | null = DEFAULT_REPORT_CARD

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('@/api/exams', () => ({
  useExams: () => ({
    data: mockExams,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useExam: (id: number) => ({
    data: mockExams.find((e) => e.id === id),
    isLoading: false,
    isError: false,
  }),
  useExamTimetable: () => ({
    data: mockTimetablePapers,
    isLoading: false,
    isError: false,
  }),
  useExamMarks: () => ({
    data: mockMarksRoster,
    isLoading: false,
    isError: false,
  }),
  useExamTabulation: () => ({
    data: mockTabulation,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useExamReportCard: () => ({
    data: mockReportCard,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useGradingScales: () => ({
    data: mockGradingScales,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateExam: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateExam: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteExam: () => ({ mutate: vi.fn(), isPending: false }),
  usePublishExam: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveExamTimetable: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveExamMarks: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveGradingScale: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteGradingScale: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/api/academics', () => ({
  useSessions: () => ({
    data: { data: mockSessions, total: mockSessions.length },
    isLoading: false,
  }),
  useTerms: () => ({
    data: [],
    isLoading: false,
  }),
  useUnits: () => ({
    data: { data: mockUnits, total: mockUnits.length },
    isLoading: false,
  }),
  useGroups: () => ({
    data: { data: mockGroups, total: mockGroups.length },
    isLoading: false,
  }),
  useSubjects: () => ({
    data: { data: mockSubjects, total: mockSubjects.length },
    isLoading: false,
  }),
  useUnitSubjects: () => ({
    data: mockUnitSubjects,
    isLoading: false,
  }),
}))

vi.mock('@/api/settings', () => ({
  useSettings: () => ({
    data: {
      localization: { date_format: 'Y-m-d', time_format: 'H:i' },
      school: { name: 'CodeClove Academy' },
    },
    isLoading: false,
    isError: false,
  }),
  useUpdateSettings: () => ({
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('@/lib/session-context', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    session: { id: 10, label: 'Academic Year 2025-2026', status: 'active' as const },
    sessionId: 10,
    sessionLabel: 'Academic Year 2025-2026',
    setSession: vi.fn(),
  }),
}))

// ─── Test Render Helper ───────────────────────────────────────────────────────

function renderWithProviders(ui: React.ReactNode, initialEntries = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Examinations Module Comprehensive Test Suite', () => {
  beforeEach(() => {
    mockExams = [...DEFAULT_EXAMS]
    mockGradingScales = [...DEFAULT_GRADING_SCALES]
    mockSessions = [...DEFAULT_SESSIONS]
    mockUnits = [...DEFAULT_UNITS]
    mockGroups = [...DEFAULT_GROUPS]
    mockUnitSubjects = [...DEFAULT_UNIT_SUBJECTS]
    mockSubjects = [...DEFAULT_SUBJECTS]
    mockTimetablePapers = [...DEFAULT_TIMETABLE_PAPERS]
    mockMarksRoster = [...DEFAULT_MARKS_ROSTER]
    mockTabulation = DEFAULT_TABULATION
    mockReportCard = DEFAULT_REPORT_CARD

    globalThis.window = {
      ...globalThis.window,
      CodeCloveConfig: {
        isPro: true,
        currentUser: { isAdmin: true },
        permissions: ['*'],
      },
    } as unknown as Window & typeof globalThis
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ExamsListPage
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. ExamsListPage Component', () => {
    it('renders PageHeader with breadcrumbs, FilterBar, and TableRoot', () => {
      const html = renderWithProviders(<ExamsListPage />, ['/exams'])

      // PageHeader & Breadcrumbs
      expect(html).toContain('Examinations')
      expect(html).toContain('All Exams')
      expect(html).toContain('Manage school examinations, schedules, grading scales, and results.')
      expect(html).toContain('Create Exam')
      // FilterBar
      expect(html).toContain('Search exam name or code...')
      expect(html).toContain('All Statuses')
      // TableRoot
      expect(html).toContain('Exam Name')
      expect(html).toContain('Dates')
      expect(html).toContain('Status')
      expect(html).toContain('Actions')
    })

    it('verifies table header and cell alignments per codeclove-ui-ux (text left, weight/numbers right, status center)', () => {
      const html = renderWithProviders(<ExamsListPage />, ['/exams'])

      // Left-aligned text columns (Exam Name, Dates) use text-start
      expect(html).toContain('text-start')

      // Center-aligned status column uses text-center
      expect(html).toContain('text-center')

      // Clean action menu trigger (no redundant Manage Exam button)
      expect(html).toContain('Exam options')
      expect(html).not.toContain('Manage Exam')

      // Exam row content
      expect(html).toContain('Midterm Examination 2026')
      expect(html).toContain('MID-2026')
      expect(html).toContain('Final Term Examination 2026')
      expect(html).toContain('FIN-2026')
    })

    it('renders empty state when no examinations are configured', () => {
      mockExams = []
      const html = renderWithProviders(<ExamsListPage />, ['/exams'])

      expect(html).toContain('No examinations created yet.')
      expect(html).toContain('Create Exam')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 3. ExamTimetablePage
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. ExamTimetablePage Component', () => {
    it('renders PageHeader and selectors card', () => {
      const html = renderWithProviders(<ExamTimetablePage />, ['/exams/timetable'])

      // PageHeader
      expect(html).toContain('Exam Schedule')
      expect(html).toContain('Set dates, start and end times, rooms, and passing marks for each subject.')
      // Selectors
      expect(html).toContain('Examination')
      expect(html).toContain('Class')
      expect(html).toContain('Select an exam...')
      expect(html).toContain('Select a class...')
    })

    it('renders empty selection state when no exam or class is selected', () => {
      const html = renderWithProviders(<ExamTimetablePage />, ['/exams/timetable'])

      expect(html).toContain('Select an Examination and Class')
      expect(html).toContain('Choose an examination and academic class above to view or configure the schedule.')
    })

    it('renders table headers and subject rows when exam and class are selected in URL', () => {
      const html = renderWithProviders(
        <ExamTimetablePage />,
        ['/exams/timetable?exam_id=1&unit_id=5']
      )

      // Table headers
      expect(html).toContain('Subject')
      expect(html).toContain('Date')
      expect(html).toContain('Time Slot')
      expect(html).toContain('Room / Venue')
      expect(html).toContain('Max Marks')
      expect(html).toContain('Passing Marks')
      // Subject rows
      expect(html).toContain('Mathematics')
      expect(html).toContain('MATH-101')
      expect(html).toContain('Science')
      expect(html).toContain('SCI-101')
    })

    it('verifies date, time, venue, and marks inputs with accessible aria-labels and tabular alignments', () => {
      const html = renderWithProviders(
        <ExamTimetablePage />,
        ['/exams/timetable?exam_id=1&unit_id=5']
      )

      // Accessible aria-labels on inputs
      expect(html).toContain('aria-label="Mathematics exam date"')
      expect(html).toContain('aria-label="Mathematics exam time slot"')
      expect(html).toContain('aria-label="Mathematics maximum marks"')
      expect(html).toContain('aria-label="Mathematics passing marks"')

      // Accessible date, time slot, and numeric inputs
      expect(html).toContain('title="Open Calendar"')
      expect(html).toContain('type="number"')

      // Max marks and Pass marks right-aligned with font-mono tabular-nums
      expect(html).toContain('text-right font-mono tabular-nums')
    })

    it('renders Quick Fill Cadence toolbar button and honest progress metrics in embedded mode', () => {
      const html = renderWithProviders(
        <ExamTimetablePage embedded />,
        ['/exams/timetable?exam_id=1&unit_id=5']
      )

      expect(html).toContain('Quick Fill Cadence')
      expect(html).toContain('scheduled')
    })

    it('renders segmented status filters in embedded mode', () => {
      const html = renderWithProviders(
        <ExamTimetablePage embedded />,
        ['/exams/timetable?exam_id=1&unit_id=5']
      )

      // Segmented status filter tabs
      expect(html).toContain('All (')
      expect(html).toContain('scheduled')
      expect(html).toContain('pending')
    })

    it('renders empty state when selected class has no configured subjects', () => {
      mockUnitSubjects = []
      mockTimetablePapers = []
      mockSubjects = []

      const html = renderWithProviders(
        <ExamTimetablePage />,
        ['/exams/timetable?exam_id=1&unit_id=5']
      )

      expect(html).toContain('No Subjects Found')
      expect(html).toContain('There are no subjects configured for this class yet.')
      expect(html).toContain('Go to Subjects')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 4. ExamMarksPage
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. ExamMarksPage Component', () => {
    it('renders PageHeader and selector dropdowns', () => {
      const html = renderWithProviders(<ExamMarksPage />, ['/exams/marks'])

      // PageHeader
      expect(html).toContain('Enter Marks')
      expect(html).toContain('Record student marks, attendance, and grades for this exam paper.')
      // Selector labels
      expect(html).toContain('Examination')
      expect(html).toContain('Class')
      expect(html).toContain('Section (Optional)')
      expect(html).toContain('Subject')
    })

    it('renders prompt state when selections are incomplete', () => {
      const html = renderWithProviders(<ExamMarksPage />, ['/exams/marks'])
      expect(html).toContain('Select Exam, Class &amp; Subject')
      expect(html).toContain('Choose an examination, class, and subject paper from the dropdowns above to start entering marks.')
    })

    it('renders high-density spreadsheet grid with student roster rows when selections are satisfied', () => {
      const html = renderWithProviders(
        <ExamMarksPage />,
        ['/exams/marks?exam_id=1&unit_id=5&subject_id=301']
      )

      // Column headers
      expect(html).toContain('Roll No.')
      expect(html).toContain('Student')
      expect(html).toContain('Attendance')
      expect(html).toContain('Marks (Max 100)')
      expect(html).toContain('Percentage')
      expect(html).toContain('Grade')
      expect(html).toContain('Remarks (Optional)')
      expect(html).toContain('Alice Johnson')
      expect(html).toContain('101')

      expect(html).toContain('Bob Smith')
      expect(html).toContain('102')

      expect(html).toContain('Charlie Brown')
      expect(html).toContain('103')
    })

    it('verifies accessible aria-labels on status select, marks input, and remarks input', () => {
      const html = renderWithProviders(
        <ExamMarksPage />,
        ['/exams/marks?exam_id=1&unit_id=5&subject_id=301']
      )

      // Accessible labels per student
      expect(html).toContain('aria-label="Alice Johnson status"')
      expect(html).toContain('aria-label="Alice Johnson marks obtained out of 100"')
      expect(html).toContain('aria-label="Bob Smith status"')
      expect(html).toContain('aria-label="Bob Smith marks obtained out of 100"')
      expect(html).toContain('aria-label="Alice Johnson remarks"')
      expect(html).toContain('aria-label="Bob Smith remarks"')
      expect(html).toContain('id="exam-remark-presets"')
      // Status select options
      expect(html).toContain('Present (P)')
      expect(html).toContain('Absent (A)')
      expect(html).toContain('Exempt (E)')
    })

    it('evaluates grades against scale tiers and highlights failing rows', () => {
      const html = renderWithProviders(
        <ExamMarksPage />,
        ['/exams/marks?exam_id=1&unit_id=5&subject_id=301']
      )

      // Alice scored 95/100 -> 95.0% -> Tier A1 (Pass)
      expect(html).toContain('95.0%')
      expect(html).toContain('A1')

      // Bob scored 85/100 -> 85.0% -> Tier A2 (Pass)
      expect(html).toContain('85.0%')
      expect(html).toContain('A2')

      // Charlie scored 25/100 -> 25.0% -> Tier E (Fail)
      expect(html).toContain('25.0%')
      expect(html).toContain('E')

      // Failing row highlighted with danger-dim class
      expect(html).toContain('bg-danger-dim/10')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 5. ExamReportsPage
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. ExamReportsPage Component', () => {
    it('renders PageHeader and tab switcher buttons', () => {
      const html = renderWithProviders(<ExamReportsPage />, ['/exams/reports'])

      // PageHeader
      expect(html).toContain('Results &amp; Report Cards')
      expect(html).toContain('View class results sheets, student rankings, and print official report cards.')
      // Tab switcher
      expect(html).toContain('Class Results Sheet')
      expect(html).toContain('Student Report Card')
    })

    it('renders Tabulation Ledger with summary statistics (total, passed, failed, passRate)', () => {
      const html = renderWithProviders(
        <ExamReportsPage />,
        ['/exams/reports?exam_id=1&unit_id=5&tab=ledger']
      )

      // Summary statistics banner
      expect(html).toContain('Students:')
      expect(html).toContain('3')

      expect(html).toContain('Passed:')
      expect(html).toContain('2')

      expect(html).toContain('Failed:')
      expect(html).toContain('1')

      expect(html).toContain('Pass Rate:')
      expect(html).toContain('66.7%')

      expect(html).toContain('Class Avg:')
      expect(html).toContain('67.8%')

      expect(html).toContain('Top Score:')
      expect(html).toContain('93.5%')

      // Export CSV button
      expect(html).toContain('Export Results (CSV)')

      // Tabulation table headers and student rows
      expect(html).toContain('Roll No.')
      expect(html).toContain('Student')
      expect(html).toContain('Mathematics')
      expect(html).toContain('Science')
      expect(html).toContain('Total Marks')
      expect(html).toContain('Percentage')
      expect(html).toContain('Grade')
      expect(html).toContain('Rank')
      expect(html).toContain('Result')

      // Students in ledger
      expect(html).toContain('Alice Johnson')
      expect(html).toContain('187')
      expect(html).toContain('Bob Smith')
      expect(html).toContain('165')
      expect(html).toContain('Charlie Brown')
      expect(html).toContain('55')

      // Result badges
      expect(html).toContain('Passed')
      expect(html).toContain('Failed')
    })

    it('renders Printable Report Card canvas with school header, student profile, subject breakdown, and signatures', () => {
      const html = renderWithProviders(
        <ExamReportsPage />,
        ['/exams/reports?exam_id=1&unit_id=5&tab=report_card&student_id=1001']
      )

      // Printable canvas container
      expect(html).toContain('id="printable-report-card"')
      expect(html).toContain('data-certificate-document="true"')

      // 1. School Header
      expect(html).toContain('CodeClove International Academy')
      expect(html).toContain('100 Academic Boulevard, Boston, MA 02108')
      expect(html).toContain('Tel: +1 (555) 123-4567')
      expect(html).toContain('Email: admissions@codeclove.edu')
      expect(html).toContain('School Code: CC-SCH-2026')
      expect(html).toContain('Midterm Examination 2026')
      // 2. Student Bio Profile Box
      expect(html).toContain('Student Full Name')
      expect(html).toContain('Alice Johnson')
      expect(html).toContain('Admission / Student ID')
      expect(html).toContain('STU-2026-001')
      expect(html).toContain('Roll Number')
      expect(html).toContain('101')
      expect(html).toContain('Grade 10')
      expect(html).toContain('Section A')

      // 3. Tabular Subject Breakdown
      expect(html).toContain('Mathematics')
      expect(html).toContain('Science')
      expect(html).toContain('95')
      expect(html).toContain('92')
      expect(html).toContain('A1')

      // 4. Summary & Performance Metrics
      expect(html).toContain('Overall Percentage:')
      expect(html).toContain('93.5%')
      expect(html).toContain('Final Cumulative Grade:')
      expect(html).toContain('#1')
      expect(html).toContain('PASSED')

      // 5. Official Signatures Footer
      expect(html).toContain('Class Teacher')
      expect(html).toContain('Principal / Headmaster')
      expect(html).toContain('Signature &amp; Date')
      expect(html).toContain('Parent / Guardian')
      expect(html).toContain('Acknowledgement')
    })

    it('renders interactive print options bar, density mode buttons, and batch class print trigger', () => {
      const html = renderWithProviders(
        <ExamReportsPage />,
        ['/exams/reports?exam_id=1&unit_id=5&tab=report_card&student_id=1001']
      )

      expect(html).toContain('Print Class Batch')
      expect(html).toContain('Customize Layout')
      expect(html).toContain('Print Report Card')
    })

    it('verifies ReportCardDocument respects section toggles for print layout customization and auto-density', () => {
      // 1. Full document rendering (auto-density selects spacious for 2 subjects)
      const fullHtml = renderToString(
        <ReportCardDocument
          data={DEFAULT_REPORT_CARD}
          options={{
            showGradingScale: true,
            showAttendance: true,
            showRemarks: true,
            showSignatures: true,
            showStudentPhoto: true,
          }}
        />
      )
      expect(fullHtml).toContain('Grading Scale &amp; Assessment Key')
      expect(fullHtml).toContain('Term Attendance Record')
      expect(fullHtml).toContain('Affix Photo')
      expect(fullHtml).toContain('data-density="spacious"')
      expect(fullHtml).toContain('Class Teacher Observations')
      expect(fullHtml).toContain('Signature &amp; Date')
      expect(fullHtml).toContain('Official Academic Credential')

      // 2. Customized document rendering (toggled off)
      const customizedHtml = renderToString(
        <ReportCardDocument
          data={DEFAULT_REPORT_CARD}
          options={{
            showGradingScale: false,
            showAttendance: false,
            showRemarks: false,
            showSignatures: false,
            showStudentPhoto: false,
            density: 'compact',
          }}
        />
      )
      expect(customizedHtml).not.toContain('Grading Scale &amp; Assessment Key')
      expect(customizedHtml).not.toContain('Term Attendance Record')
      expect(customizedHtml).not.toContain('Affix Photo')
      expect(customizedHtml).toContain('data-density="compact"')
      expect(customizedHtml).not.toContain('Class Teacher Observations')
      expect(customizedHtml).not.toContain('Signature &amp; Date')
      // Core transcript content remains intact
      expect(customizedHtml).toContain('Alice Johnson')
      expect(customizedHtml).toContain('Mathematics')
      expect(customizedHtml).toContain('Grand Total')
    })

    it('renders TabulationLedgerDocument with landscape orientation, institutional letterhead, summary band, and statutory signatures', () => {
      const html = renderToString(
        <TabulationLedgerDocument
          exam={{
            id: 1,
            name: 'Midterm Examination 2026',
            code: 'MID-2026',
            academic_session_name: '2026-2027',
          }}
          school={{
            name: 'CodeClove International Academy',
            code: 'CC-SCH-2026',
            affiliation: 'CBSE Affiliated',
          }}
          academicUnitName="Grade 10"
          sectionName="Section A"
          subjects={DEFAULT_TABULATION.subjects}
          students={DEFAULT_TABULATION.students}
          stats={{
            total: 3,
            assessed: 3,
            pending: 0,
            passed: 2,
            failed: 1,
            passRate: '66.7%',
            avgPercentage: '67.8%',
            highestPercentage: '93.5%',
          }}
        />
      )

      // Landscape orientation & document indicators
      expect(html).toContain('data-orientation="landscape"')
      expect(html).toContain('data-tabulation-print="true"')
      expect(html).toContain('Official Tabulation Register • Broadsheet Gazette')

      // School letterhead
      expect(html).toContain('CodeClove International Academy')
      expect(html).toContain('Code: CC-SCH-2026')
      expect(html).toContain('CBSE Affiliated')

      // Metadata & scale
      expect(html).toContain('Midterm Examination 2026')
      expect(html).toContain('Grade 10 • Section A')
      expect(html).toContain('Scale (Max / Pass)')

      // Students & subject marks
      expect(html).toContain('Alice Johnson')
      expect(html).toContain('Bob Smith')
      expect(html).toContain('Charlie Brown')

      // Statutory signature blocks
      expect(html).toContain('Class Teacher')
      expect(html).toContain('Exam Coordinator')
      expect(html).toContain('Controller of Examinations')
      expect(html).toContain('Principal / Headmaster')
    })
  })
  // ───────────────────────────────────────────────────────────────────────────
  // 6. GradingScalesPage
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. GradingScalesPage Component', () => {
    it('renders PageHeader with breadcrumbs, action triggers, and preserves standard presets', () => {
      const html = renderWithProviders(<GradingScalesPage />, ['/exams/grading-scales'])

      // PageHeader & Breadcrumbs
      expect(html).toContain('Grading Scales')
      expect(html).toContain('Set up letter grade ranges (A, B, C...) and passing thresholds for exams.')
      expect(html).toContain('Add Grading Scale')
      expect(html).toContain('Grading Scales')

      // Institutional Presets Contract
      expect(mockGradingScales.some((t) => t.name.includes('CBSE 8-Point') && t.code === 'CBSE_8PT')).toBe(true)
      expect(mockGradingScales.some((t) => t.name.includes('US') && t.code === 'US_GPA_4')).toBe(true)
    })

    it('verifies accessible scale switcher cards with role="button" and aria-selected states', () => {
      const html = renderWithProviders(<GradingScalesPage />, ['/exams/grading-scales'])

      // Configured scales count
      expect(html).toContain('Configured Grading Scales')
      expect(html).toContain('(2)')

      // Accessible switcher cards
      expect(html).toContain('role="button"')
      expect(html).toContain('tabindex="0"')

      // Active scale marked with aria-selected="true"
      expect(html).toContain('aria-selected="true"')
      expect(html).toContain('aria-selected="false"')

      // Default badge on CBSE 8-Point scale
      expect(html).toContain('Default')
      expect(html).toContain('8 tiers')
    })

    it('verifies tier matrix table alignments per codeclove-ui-ux (text left, percentages/GP right, pass status center)', () => {
      const html = renderWithProviders(<GradingScalesPage />, ['/exams/grading-scales'])

      // Table headers
      expect(html).toContain('Grade')
      expect(html).toContain('Min %')
      expect(html).toContain('Max %')
      expect(html).toContain('Grade Points (GPA)')
      expect(html).toContain('Description')
      expect(html).toContain('Result')

      // Alignments: text columns use text-start, numeric columns use text-end, status uses text-center
      expect(html).toContain('text-start')
      expect(html).toContain('text-end')
      expect(html).toContain('text-center')

      // Tiers data for CBSE 8-point
      expect(html).toContain('A1')
      expect(html).toContain('91%')
      expect(html).toContain('100%')
      expect(html).toContain('10.0')

      expect(html).toContain('E')
      expect(html).toContain('0%')
      expect(html).toContain('32%')
      expect(html).toContain('0.0')

      // Status badges
      expect(html).toContain('Pass')
      expect(html).toContain('Fail')
    })

    it('renders empty state when no grading scales are configured', () => {
      mockGradingScales = []
      const html = renderWithProviders(<GradingScalesPage />, ['/exams/grading-scales'])

      expect(html).toContain('No grading scales configured')
      expect(html).toContain('Create First Scale')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 7. ExamWorkspacePage
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. ExamWorkspacePage Component', () => {
    it('renders pinned exam header with date window, session badge, status, and executive workspace tabs with Overview Progress Matrix', () => {
      const html = renderWithProviders(
        <Routes>
          <Route path="/exams/:id" element={<ExamWorkspacePage />} />
        </Routes>,
        ['/exams/1']
      )
      expect(html).toContain('Midterm Examination 2026')
      expect(html).toContain('Overview')
      expect(html).toContain('Exam Schedule')
      expect(html).toContain('Enter Marks')
      expect(html).toContain('Class Tabulation')
      expect(html).toContain('Student Report Cards')
      expect(html).toContain('Class Schedules &amp; Readiness')
      expect(html).toContain('All Exams')
      expect(html).toContain('Edit Exam')
    })
  })


  // ───────────────────────────────────────────────────────────────────────────
  // 9. ExamFormPage
  // ───────────────────────────────────────────────────────────────────────────
  describe('9. ExamFormPage Component', () => {
    it('renders create mode with focused Exam Details & Schedule, and Status & Policy', () => {
      const html = renderWithProviders(<ExamFormPage />, ['/exams/new'])

      // PageHeader & Breadcrumbs
      expect(html).toContain('Create Examination')
      expect(html).toContain('Set up examination title, schedule window, and grading scale.')
      expect(html).toContain('New Examination')
      expect(html).toContain('Cancel')
      expect(html).toContain('Save as Draft')
      expect(html).toContain('Save &amp; Set Schedule')

      // Main Form Card 1: Exam Details & Schedule
      expect(html).toContain('Exam Name')
      expect(html).toContain('Exam Code (Optional)')
      expect(html).toContain('Start Date')
      expect(html).toContain('End Date')
      expect(html).toContain('Authorized Signatory Title')
      expect(html).toContain('Internal Notes (Staff Only)')
      // Sidebar Cards
      expect(html).toContain('Status &amp; Publication')
      expect(html).toContain('Grading Policy')
      expect(html).toContain('Manage Scales')

      // Decoupled: should NOT contain Report Card Presentation or Lifecycle clutter
      expect(html).not.toContain('Report Card Presentation &amp; Layout')
      expect(html).not.toContain('Examination Lifecycle')

      // Header Actions
      expect(html).toContain('Save &amp; Set Schedule')
      expect(html).toContain('Cancel')
    })

    it('renders edit mode with proper breadcrumbs hierarchy (/exams > exam name > Edit) and pre-filled data', () => {
      const html = renderWithProviders(
        <Routes>
          <Route path="/exams/:id/edit" element={<ExamFormPage />} />
        </Routes>,
        ['/exams/1/edit']
      )

      // Edit Header & Breadcrumbs
      expect(html).toContain('Edit Examination')
      expect(html).toContain('Updating examination details for Midterm Examination 2026.')
      expect(html).toContain('href="/exams"')
      expect(html).toContain('href="/exams/1"')
      expect(html).toContain('Edit')

      // Form values prefilled
      expect(html).toContain('value="Midterm Examination 2026"')
      expect(html).toContain('value="MID-2026"')

      // Action button
      expect(html).toContain('Save Changes')
    })
  })

})
