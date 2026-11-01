import { useMemo } from 'react'
import { __, sprintf } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { QRCode } from '@/components/ui/QRCode'
import type { ReportCardData, ReportCardSubject } from '../types'

export interface ReportCardPrintOptions {
  template?: 'oxford' | 'modern' | 'holistic'
  accentColor?: string
  fontFamily?: 'serif' | 'sans'
  headingScale?: 'compact' | 'standard' | 'spacious'
  showGradingScale?: boolean
  showAttendance?: boolean
  showRemarks?: boolean
  showTeacherRemarks?: boolean
  showPrincipalRemarks?: boolean
  showSignatures?: boolean
  showTeacherSignature?: boolean
  showPrincipalSignature?: boolean
  showParentSignature?: boolean
  showStudentPhoto?: boolean
  showRank?: boolean
  showPercentage?: boolean
  showGrade?: boolean
  showGpa?: boolean
  showPassMarks?: boolean
  totalStudents?: number
  paperSize?: 'a4' | 'letter'
  density?: 'auto' | 'spacious' | 'standard' | 'compact'
  watermark?: string
  // Enhanced curriculum & layout controls
  curriculum?: 'cbse' | 'us' | 'ib' | 'general'
  marksFormat?: 'total_only' | 'theory_practical'
  showQrCode?: boolean
  showDigitalSignature?: boolean
  showSeal?: boolean
  signatoryCount?: 2 | 3
  signatory1Title?: string
  signatory2Title?: string
  signatory3Title?: string
  customTitle?: string
  customAffiliation?: string
  tonerSaver?: boolean
}

export interface ReportCardDocumentProps {
  data: ReportCardData
  options?: ReportCardPrintOptions
  className?: string
  id?: string
}

const DEFAULT_GRADING_TIERS = [
  { label: 'A1', min: 91, max: 100, gp: 10.0, desc: 'Outstanding' },
  { label: 'A2', min: 81, max: 90, gp: 9.0, desc: 'Excellent' },
  { label: 'B1', min: 71, max: 80, gp: 8.0, desc: 'Very Good' },
  { label: 'B2', min: 61, max: 70, gp: 7.0, desc: 'Good' },
  { label: 'C1', min: 51, max: 60, gp: 6.0, desc: 'Satisfactory' },
  { label: 'C2', min: 41, max: 50, gp: 5.0, desc: 'Acceptable' },
  { label: 'D', min: 33, max: 40, gp: 4.0, desc: 'Marginal Pass' },
  { label: 'E', min: 0, max: 32, gp: 0.0, desc: 'Needs Improvement' },
]

/**
 * ReportCardDocument — Formal Institutional Academic Transcript & Report Card.
 *
 * Implements high-contrast institutional typography, authentic academic framing,
 * vector verification seal, holistic co-scholastic assessment, and rigorous layout symmetry.
 * Tailored to dynamically utilize 100% of standard ISO A4 / US Letter portrait page height
 * with single-page budget compliance.
 */
export function ReportCardDocument({
  data,
  options = {},
  className,
  id = 'printable-report-card',
}: ReportCardDocumentProps) {
  const accentColor = options.accentColor || data.exam.report_card_config?.accent_color || '#0f226b'
  const fontFamily = options.fontFamily || data.exam.report_card_config?.font_family || 'serif'
  const {
    showGradingScale = true,
    showAttendance = true,
    showRemarks = true,
    showTeacherRemarks,
    showPrincipalRemarks,
    showSignatures = true,
    showTeacherSignature,
    showPrincipalSignature,
    showParentSignature,
    showStudentPhoto = true,
    showRank = true,
    showPercentage = true,
    showGrade = true,
    showGpa = true,
    showPassMarks = true,
    paperSize = 'a4',
    density = 'auto',
    watermark,
    curriculum,
    marksFormat = 'total_only',
    showQrCode = true,
    showDigitalSignature = false,
    signatoryCount = 3,
    signatory1Title = __('Class Teacher', 'codeclove-school-management'),
    signatory2Title = __('Principal / Headmaster', 'codeclove-school-management'),
    signatory3Title = __('Parent / Guardian', 'codeclove-school-management'),
    customTitle,
    customAffiliation,
    tonerSaver = false,
  } = options

  const isTonerSaver = Boolean(tonerSaver || accentColor === '#1e293b-bw' || accentColor === 'toner-saver')
  const effectiveAccentColor = isTonerSaver ? '#0f172a' : accentColor

  const effectiveCurriculum = curriculum || 'cbse'
  const isUS = effectiveCurriculum === 'us'

  const subjectCount = data.subjects?.length ?? 0
  const isTheoryPractical =
    marksFormat === 'theory_practical' ||
    data.subjects.some(
      (s) => s.theory_marks != null || (s.theory_max ?? 0) > 0 || (s.practical_max ?? 0) > 0
    )
  const effectiveTotalStudents = options.totalStudents ?? data.summary?.total_students ?? null
  const effectiveTeacherRemarks = showTeacherRemarks ?? showRemarks
  const effectivePrincipalRemarks = showPrincipalRemarks ?? showRemarks
  const hasAnyRemarks = effectiveTeacherRemarks || effectivePrincipalRemarks

  const effectiveTeacherSig = showTeacherSignature ?? showSignatures
  const effectivePrincipalSig = showPrincipalSignature ?? showSignatures
  const effectiveParentSig = showParentSignature ?? (showSignatures && signatoryCount === 3)
  const activeSignatoriesCount = (effectiveTeacherSig ? 1 : 0) + (effectivePrincipalSig ? 1 : 0) + (effectiveParentSig ? 1 : 0)

  const hasPercentageCol = Boolean(showPercentage)
  const hasGradeOrGpaCol = Boolean(showGrade || showGpa)
  const hasRankCol = Boolean(showRank)
  const activeSummaryCols = 1 + (hasPercentageCol ? 1 : 0) + (hasGradeOrGpaCol ? 1 : 0) + (hasRankCol ? 1 : 0)

  const effectiveDensity: 'spacious' | 'standard' | 'compact' = useMemo(() => {
    if (density === 'spacious' || density === 'standard' || density === 'compact') {
      return density
    }
    if (subjectCount <= 2) return 'spacious'
    if (subjectCount <= 5 && !showRemarks) return 'standard'
    return 'compact'
  }, [density, subjectCount, showRemarks])
  const isCompact = effectiveDensity === 'compact'
  const isSpacious = effectiveDensity === 'spacious'

  const activeWatermark =
    watermark ??
    (data.exam?.status && data.exam.status !== 'published'
      ? __('DRAFT — FOR REVIEW ONLY', 'codeclove-school-management')
      : null)

  const formattedDate = new Date().toLocaleDateString(undefined, {
    dateStyle: 'medium',
  })

  const documentSerial = `TR-${String(data.exam?.id || 1).padStart(4, '0')}-${String(
    data.student?.id || 1001
  ).padStart(4, '0')}`

  const verificationPayload = `DOC:REPORT_CARD|EXAM:${data.exam?.id}|STU:${data.student?.student_number}|NAME:${data.student?.name}|STATUS:${data.summary?.result_status}`

  const tiers = useMemo(() => {
    if (data.grading_scale?.tiers && data.grading_scale.tiers.length > 0) {
      return data.grading_scale.tiers
    }
    return DEFAULT_GRADING_TIERS
  }, [data.grading_scale?.tiers])

  const gradingScaleTitle = data.grading_scale?.name || (isUS ? __('US Standard 4.0 Scale', 'codeclove-school-management') : __('Standard Grading Scale', 'codeclove-school-management'))

  const schoolName = data.school?.name || __('CodeClove International Academy', 'codeclove-school-management')

  const documentTitle = customTitle?.trim() || data.exam.name
  const affiliationLine = customAffiliation?.trim() || data.school?.affiliation_no

  // Check if any marks have been entered
  const hasEnteredAnyMark = data.subjects.some(
    (s) => s.marks_obtained !== null && s.marks_obtained !== undefined
  )

  // Attendance metrics
  const hasAttendanceData = Boolean(data.attendance && data.attendance.total_days > 0)
  const attendanceDays = data.attendance?.days_present ?? 0
  const totalWorkingDays = data.attendance?.total_days ?? 0
  const attendanceRate = totalWorkingDays > 0 ? (attendanceDays / totalWorkingDays) * 100 : null
  // Failed subjects
  const failedSubjects = useMemo(() => {
    return data.subjects
      .filter((s) => s.marks_obtained !== null && s.marks_obtained < s.pass_marks)
      .map((s) => s.name)
  }, [data.subjects])

  const failedSubjectsText = failedSubjects.join(', ')

  // Remarks
  const teacherObservation = useMemo(() => {
    if (!hasEnteredAnyMark) {
      return __('Awaiting completion of term examination scoring and grade tabulation.', 'codeclove-school-management')
    }
    if (data.summary.percentage >= 90) {
      return __('Demonstrates outstanding academic distinction, intellectual curiosity, and exemplary classroom leadership.', 'codeclove-school-management')
    }
    if (data.summary.percentage >= 75) {
      return __('Consistently conscientious and engaged. Has shown steady scholastic improvement throughout the term.', 'codeclove-school-management')
    }
    if (data.summary.percentage >= 60) {
      return __('Satisfactory overall progress. Greater consistency in independent revision and coursework submission will yield higher achievement.', 'codeclove-school-management')
    }
    return __('Needs targeted academic support and structured revision to reinforce core competencies across key curriculum areas.', 'codeclove-school-management')
  }, [hasEnteredAnyMark, data.summary.percentage])

  const principalRemark = useMemo(() => {
    if (!hasEnteredAnyMark) {
      return __('Term assessment ledger under institutional administrative audit.', 'codeclove-school-management')
    }
    if (data.summary.result_status === 'Compartment') {
      return failedSubjectsText
        ? sprintf(
            __('Placed in Compartment / Supplementary in %s. Eligible for re-examination prior to final grade promotion.', 'codeclove-school-management'),
            failedSubjectsText
          )
        : __('Placed in Compartment. Eligible for supplementary re-examination prior to promotion.', 'codeclove-school-management')
    }
    if (data.summary.result_status === 'Failed') {
      return __('Detained. Academic criteria for promotion have not been met.', 'codeclove-school-management')
    }
    if (data.summary.percentage >= 85) {
      return isUS
        ? __('Named to the Dean\'s Honor List with Highest Academic Honors.', 'codeclove-school-management')
        : __('Promoted with High Academic Honors. Exceptional scholastic achievement.', 'codeclove-school-management')
    }
    if (data.summary.percentage >= 60) {
      return isUS
        ? __('In Good Standing. Promoted to next academic level.', 'codeclove-school-management')
        : __('Promoted to next academic grade. Commendable scholastic progress.', 'codeclove-school-management')
    }
    return __('Promoted on probation. Recommended for targeted academic support in the coming session.', 'codeclove-school-management')
  }, [hasEnteredAnyMark, data.summary.result_status, data.summary.percentage, failedSubjectsText, isUS])

  const rawGroup = data.student.group_name || ''
  const cleanGroup = rawGroup.replace(/^section\s+/i, '').trim()
  const sectionLabel = cleanGroup ? `Section ${cleanGroup}` : ''

  // Pass marks column visibility: omitted by default in US high schools unless explicitly enabled
  const shouldShowPassMarks = isUS ? false : (showPassMarks && !isTheoryPractical)

  return (
    <div
      id={id}
      data-certificate-document="true"
      data-report-card-document="true"
      data-print-area="true"
      data-paper-size={paperSize}
      data-density={effectiveDensity}
      className={cn(
        'relative bg-white text-slate-900 border border-slate-300 print:border-none shadow-sm print:shadow-none mx-auto box-border font-sans flex flex-col',
        paperSize === 'letter'
          ? 'max-w-[816px] min-h-[960px] print:min-h-0 print:h-[268mm] print:max-h-[268mm] print:overflow-hidden'
          : 'max-w-[794px] min-h-[1020px] print:min-h-0 print:h-[286mm] print:max-h-[286mm] print:overflow-hidden',
        isCompact ? 'p-1.5 print:p-0' : isSpacious ? 'p-2 sm:p-2.5 print:p-0' : 'p-2 print:p-0',
        className
      )}
    >
      {/* ─── Outer Formal Academic Double Frame ─── */}
      <div
        className={cn(
          'bg-white flex flex-col flex-1 h-full',
          isTonerSaver ? 'border border-slate-800 p-0' : 'border-2 p-0.5'
        )}
        style={{ borderColor: effectiveAccentColor }}
      >
        <div
          className={cn(
            'bg-white relative flex flex-col justify-between flex-1 h-full',
            !isTonerSaver && 'border border-slate-700',
            isCompact
              ? 'p-1.5 space-y-0.5'
              : isSpacious
              ? 'p-2 sm:p-2.5 space-y-1.5'
              : 'p-1.5 sm:p-2 space-y-1'
          )}
        >
          {activeWatermark && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
              <span className="text-slate-900/[0.04] font-black text-2xl sm:text-4xl font-mono tracking-[0.2em] uppercase rotate-[-22deg] border-2 border-dashed border-slate-900/[0.07] px-6 py-2 rounded-xl text-center">
                {activeWatermark}
              </span>
            </div>
          )}

          {/* ─── TOP SECTION GROUP ─── */}
          <div className={cn(isCompact ? 'space-y-0.5' : isSpacious ? 'space-y-1.5' : 'space-y-1')}>
            {/* ─── 1. Official School Letterhead / Crest Header ─── */}
            <div
              className={cn(
                'border-b-2',
                isTonerSaver ? 'border-b border-slate-800' : '',
                isCompact ? 'pb-0.5' : isSpacious ? 'pb-1.5' : 'pb-1'
              )}
              style={!isTonerSaver ? { borderBottomColor: effectiveAccentColor } : undefined}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="shrink-0">
                  {data.school?.logo ? (
                    <img
                      src={data.school.logo}
                      alt={schoolName}
                      className={cn('object-contain rounded', isSpacious ? 'h-11 w-11' : isCompact ? 'h-9 w-9' : 'h-10 w-10')}
                    />
                  ) : (
                    <div
                      className={cn(
                        'rounded-full border-2 border-slate-900 bg-slate-50 flex flex-col items-center justify-center font-serif font-black text-slate-800 shadow-inner',
                        isSpacious ? 'h-11 w-11' : isCompact ? 'h-9 w-9' : 'h-10 w-10'
                      )}
                    >
                      <span className={cn('leading-none', isSpacious ? 'text-base' : 'text-sm')}>
                        {(data.school?.name || 'CC').slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-[5px] uppercase tracking-widest text-slate-500 font-sans mt-0.5">
                        ACADEMY
                      </span>
                    </div>
                  )}
                </div>

                {/* School Typography Identity */}
                <div className="text-center flex-1 min-w-0">
                  <h2 className={cn('font-bold uppercase tracking-tight text-slate-900 leading-tight', fontFamily === 'serif' ? 'font-serif' : 'font-sans', isSpacious ? 'text-lg sm:text-xl' : 'text-base sm:text-lg')}>
                    {schoolName}
                  </h2>

                  {affiliationLine && (
                    <p className="text-[9px] text-slate-700 font-semibold tracking-wide leading-tight mt-0.5">
                      {affiliationLine}
                    </p>
                  )}

                  {data.school?.address && (
                    <p className="text-[10px] text-slate-600 font-medium leading-tight max-w-xl mx-auto mt-0.5">
                      {data.school.address}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[10px] text-slate-600 mt-0.5 font-medium">
                    {data.school?.phone && <span>{`Tel: ${data.school.phone}`}</span>}
                    {data.school?.phone && data.school?.email && (
                      <span className="text-slate-400 font-bold" aria-hidden="true">•</span>
                    )}
                    {data.school?.email && <span>{`Email: ${data.school.email}`}</span>}
                    {data.school?.code && (
                      <>
                        <span className="text-slate-400 font-bold" aria-hidden="true">•</span>
                        <span className="font-semibold text-slate-700">
                          {`School Code: ${data.school.code}`}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Visual Balance Spacer (Balances Logo) */}
                <div className={cn('shrink-0', isSpacious ? 'w-11' : isCompact ? 'w-9' : 'w-10')} aria-hidden="true" />
              </div>

              {/* Formal Document Title Banner */}
              <div className={cn('pt-1 border-t border-slate-300 text-center', isSpacious ? 'mt-1.5' : 'mt-1')}>
                <h3
                  className={cn(
                    'font-extrabold uppercase tracking-widest text-xs',
                    fontFamily === 'serif' ? 'font-serif' : 'font-sans',
                    isSpacious && 'sm:text-[13px]'
                  )}
                  style={{ color: effectiveAccentColor }}
                >
                  {documentTitle}
                </h3>
              </div>
            </div>

            {/* ─── 2. Student Bio Profile Box with Optional Photo ─── */}
            <div
              className={cn(
                'bg-slate-50/80 border border-slate-300 rounded text-xs flex items-stretch gap-3',
                isCompact ? 'p-1.5' : isSpacious ? 'p-2.5' : 'p-2'
              )}
            >
              <div
                className={cn(
                  'flex-1 grid grid-cols-4 gap-x-3',
                  isCompact ? 'gap-y-0.5' : isSpacious ? 'gap-y-1.5' : 'gap-y-1'
                )}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
              >
                {/* 1. Student Full Name (Takes 2 cols for long names) */}
                <div className="min-w-0 col-span-2">
                  <span className="text-slate-500 block text-[8.5px] uppercase tracking-wider font-semibold leading-tight">
                    {__('Student Full Name', 'codeclove-school-management')}
                  </span>
                  <strong className={cn('text-slate-900 font-bold block leading-tight break-words', isSpacious ? 'text-xs mt-0.5' : 'text-xs mt-0.5')}>
                    {data.student.name}
                  </strong>
                </div>

                {/* 2. Roll Number (Col 3) */}
                <div className="min-w-0">
                  <span className="text-slate-500 block text-[8.5px] uppercase tracking-wider font-semibold leading-tight truncate">
                    {isUS ? __('Homeroom / Advisor', 'codeclove-school-management') : __('Roll Number', 'codeclove-school-management')}
                  </span>
                  <strong className="text-slate-900 font-mono text-xs font-semibold block mt-0.5 truncate">
                    {data.student.roll_number || '—'}
                  </strong>
                </div>

                {/* 3. Class & Section (Col 4) */}
                <div className="min-w-0">
                  <span className="text-slate-500 block text-[8.5px] uppercase tracking-wider font-semibold leading-tight truncate">
                    {isUS ? __('Grade / Cohort', 'codeclove-school-management') : __('Class & Section', 'codeclove-school-management')}
                  </span>
                  <strong className="text-slate-900 font-semibold block mt-0.5 text-xs truncate">
                    {data.student.unit_name}
                    {sectionLabel ? ` ${sectionLabel}` : ''}
                  </strong>
                </div>

                {/* 4. Parent / Guardian Name (Directly below Student Name in Col 1-2) */}
                <div className="min-w-0 col-span-2">
                  <span className="text-slate-500 block text-[8.5px] uppercase tracking-wider font-semibold leading-tight truncate">
                    {__('Parent / Guardian Name', 'codeclove-school-management')}
                  </span>
                  <strong className="text-slate-900 font-semibold block mt-0.5 text-xs break-words">
                    {data.student.guardian_name || '—'}
                  </strong>
                </div>

                {/* 5. Admission / Student ID (Directly below Roll Number in Col 3) */}
                <div className="min-w-0">
                  <span className="text-slate-500 block text-[8.5px] uppercase tracking-wider font-semibold leading-tight truncate">
                    {isUS ? __('Student ID Number', 'codeclove-school-management') : __('Admission / Student ID', 'codeclove-school-management')}
                  </span>
                  <strong className="text-slate-900 font-mono text-xs font-semibold block mt-0.5 truncate">
                    {data.student.student_number || data.student.admission_number || '—'}
                  </strong>
                </div>

                {/* 6. Date of Birth (Directly below Class & Section in Col 4) */}
                <div className="min-w-0">
                  <span className="text-slate-500 block text-[8.5px] uppercase tracking-wider font-semibold leading-tight truncate">
                    {__('Date of Birth', 'codeclove-school-management')}
                  </span>
                  <strong className="text-slate-900 font-mono text-xs font-semibold block mt-0.5 truncate">
                    {data.student.date_of_birth || '—'}
                  </strong>
                </div>
              </div>

              {/* Student Passport Photo / Physical Stamp Box */}
              {showStudentPhoto && (
                <div className="shrink-0 flex flex-col items-center justify-center">
                  <div
                    className={cn(
                      'border-2 border-slate-300 rounded bg-white flex flex-col items-center justify-center text-center overflow-hidden shadow-2xs',
                      isSpacious ? 'w-18 h-22 sm:w-20 sm:h-24' : 'w-16 h-20'
                    )}
                  >
                    {data.student.photo_url ? (
                      <img
                        src={data.student.photo_url}
                        alt={data.student.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-1">
                        <div className="w-7 h-7 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs mb-0.5 font-sans">
                          {(data.student.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[7px] uppercase font-mono text-slate-400 font-semibold tracking-wider text-center leading-tight">
                          {__('Affix Photo', 'codeclove-school-management')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ─── 3. Tabular Subject Performance Ledger ─── */}
            <div className="overflow-hidden border border-slate-300 rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={cn(
                    'text-slate-900 font-bold border-b border-slate-300',
                    isTonerSaver ? 'bg-white' : 'bg-slate-100'
                  )}>
                    <th className={cn('border-r border-slate-300 w-7 text-center font-mono text-[9.5px]', isSpacious ? 'py-1.5 px-2' : 'py-1 px-1.5')}>
                      #
                    </th>
                    <th className={cn('border-r border-slate-300 text-[10px]', isSpacious ? 'py-1.5 px-2.5' : 'py-1 px-2')}>
                      {__('Subject Title', 'codeclove-school-management')}
                    </th>
                    <th className={cn('text-right border-r border-slate-300 w-12 text-[10px]', isSpacious ? 'py-1.5 px-2' : 'py-1 px-1.5')}>
                      {__('Max', 'codeclove-school-management')}
                    </th>
                    {isTheoryPractical && (
                      <>
                        <th className={cn('text-right border-r border-slate-300 w-14 text-[10px]', isSpacious ? 'py-1.5 px-2' : 'py-1 px-1.5')}>
                          {isUS ? __('Coursework', 'codeclove-school-management') : __('Theory', 'codeclove-school-management')}
                        </th>
                        <th className={cn('text-right border-r border-slate-300 w-14 text-[10px]', isSpacious ? 'py-1.5 px-2' : 'py-1 px-1.5')}>
                          {isUS ? __('Final Exam', 'codeclove-school-management') : __('Practical', 'codeclove-school-management')}
                        </th>
                      </>
                    )}
                    {shouldShowPassMarks && (
                      <th className={cn('text-right border-r border-slate-300 w-14 text-[10px]', isSpacious ? 'py-1.5 px-2' : 'py-1 px-1.5')}>
                        {__('Pass', 'codeclove-school-management')}
                      </th>
                    )}
                    <th className={cn('text-right border-r border-slate-300 w-20 text-[10px]', isSpacious ? 'py-1.5 px-2.5' : 'py-1 px-2')}>
                      {isTheoryPractical ? __('Total Marks', 'codeclove-school-management') : __('Marks Obtained', 'codeclove-school-management')}
                    </th>
                    {showPercentage && (
                      <th className={cn('text-right border-r border-slate-300 w-16 text-[10px]', isSpacious ? 'py-1.5 px-2' : 'py-1 px-1.5')}>
                        {__('Percentage', 'codeclove-school-management')}
                      </th>
                    )}
                    {showGrade && (
                      <th className={cn('text-center border-r border-slate-300 w-14 text-[10px]', isSpacious ? 'py-1.5 px-2' : 'py-1 px-1.5')}>
                        {__('Grade', 'codeclove-school-management')}
                      </th>
                    )}
                    <th className={cn('text-left min-w-[150px] text-[10px]', isSpacious ? 'py-1.5 px-2.5' : 'py-1 px-2')}>
                      {__('Remarks', 'codeclove-school-management')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.subjects.map((subj: ReportCardSubject, idx: number) => {
                    const marks = subj.marks_obtained
                    const isAbsent = subj.is_absent || subj.status === 'absent'
                    const isExempt = subj.is_exempt || subj.status === 'exempt'
                    const isPending = subj.is_pending ?? (marks === null && !isAbsent && !isExempt)
                    const isFailing = marks !== null && marks < subj.pass_marks

                    return (
                      <tr
                        key={subj.subject_id || idx}
                        className={cn(
                          'border-b border-slate-200 transition-colors align-top',
                          idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                        )}
                      >
                        <td className={cn('border-r border-slate-200 font-mono text-center text-slate-400 text-[8.5px]', isSpacious ? 'py-1 px-1.5' : 'py-0.5 px-1')}>
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className={cn('border-r border-slate-200 font-semibold text-slate-900 text-[11px]', isSpacious ? 'py-1 px-2' : 'py-0.5 px-1.5')}>
                          {subj.name}
                        </td>
                        <td className={cn('text-right border-r border-slate-200 font-mono tabular-nums text-slate-600 text-[11px]', isSpacious ? 'py-1 px-1.5' : 'py-0.5 px-1')}>
                          {subj.max_marks}
                        </td>
                        {isTheoryPractical && (
                          <>
                            <td className={cn('text-right border-r border-slate-200 font-mono tabular-nums text-slate-600 text-[11px]', isSpacious ? 'py-1 px-1.5' : 'py-0.5 px-1')}>
                              {subj.theory_marks !== null && subj.theory_marks !== undefined ? subj.theory_marks : '—'}
                            </td>
                            <td className={cn('text-right border-r border-slate-200 font-mono tabular-nums text-slate-600 text-[11px]', isSpacious ? 'py-1 px-1.5' : 'py-0.5 px-1')}>
                              {subj.practical_marks !== null && subj.practical_marks !== undefined ? subj.practical_marks : '—'}
                            </td>
                          </>
                        )}
                        {shouldShowPassMarks && (
                          <td className={cn('text-right border-r border-slate-200 font-mono tabular-nums text-slate-600 text-[11px]', isSpacious ? 'py-1 px-1.5' : 'py-0.5 px-1')}>
                            {subj.pass_marks}
                          </td>
                        )}
                        <td className={cn('text-right border-r border-slate-200 font-mono tabular-nums font-bold text-slate-900 text-[11px]', isSpacious ? 'py-1 px-2' : 'py-0.5 px-1.5')}>
                          {isAbsent ? (
                            <span className="text-rose-600 font-bold text-[10.5px]">
                              {__('Absent', 'codeclove-school-management')}
                            </span>
                          ) : isExempt ? (
                            <span className="text-amber-600 font-bold text-[10.5px]">
                              {__('Exempt', 'codeclove-school-management')}
                            </span>
                          ) : marks !== null ? (
                            <span className={isFailing ? 'text-rose-600' : 'text-slate-900'}>
                              {marks}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        {showPercentage && (
                          <td className={cn('text-right border-r border-slate-200 font-mono tabular-nums font-semibold text-[11px]', isSpacious ? 'py-1 px-1.5' : 'py-0.5 px-1')}>
                            {isPending || isExempt || subj.percentage === null ? (
                              <span className="text-slate-400 font-normal">—</span>
                            ) : (
                              <span className={isFailing ? 'text-rose-600 font-bold' : 'text-slate-900'}>
                                {`${subj.percentage.toFixed(1)}%`}
                              </span>
                            )}
                          </td>
                        )}
                        {showGrade && (
                          <td className={cn('text-center border-r border-slate-200 font-bold', isSpacious ? 'py-1 px-1.5' : 'py-0.5 px-1')}>
                            {isPending ? (
                              <span className="text-slate-400 font-normal text-[11px]">—</span>
                            ) : isExempt ? (
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300">
                                EX
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  'inline-block px-1.5 py-0.2 rounded text-[9.5px] font-extrabold',
                                  isTonerSaver
                                    ? 'border border-slate-700 bg-white text-slate-900'
                                    : isFailing
                                    ? 'bg-rose-50 text-rose-800 border border-rose-300'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                )}
                              >
                                {subj.grade || '—'}
                              </span>
                            )}
                          </td>
                        )}
                        <td className={cn('text-left text-slate-700 text-[9.5px] leading-normal whitespace-normal break-words', isSpacious ? 'py-1 px-2' : 'py-0.5 px-1.5')}>
                          {subj.remarks || '—'}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Grand Total Summary Row */}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                    <td colSpan={2} className={cn('text-right font-serif tracking-wide text-[11px]', isSpacious ? 'py-1.5 px-2.5' : 'py-1 px-2')}>
                      {__('Grand Total', 'codeclove-school-management')}
                    </td>
                    <td className={cn('text-right border-r border-slate-300 font-mono tabular-nums text-[11px]', isSpacious ? 'py-1.5 px-1.5' : 'py-1 px-1')}>
                      {data.summary.total_possible}
                    </td>
                    {isTheoryPractical && (
                      <>
                        <td className={cn('border-r border-slate-300', isSpacious ? 'py-1.5 px-1.5' : 'py-1 px-1')} />
                        <td className={cn('border-r border-slate-300', isSpacious ? 'py-1.5 px-1.5' : 'py-1 px-1')} />
                      </>
                    )}
                    {shouldShowPassMarks && (
                      <td className={cn('border-r border-slate-300', isSpacious ? 'py-1.5 px-1.5' : 'py-1 px-1')} />
                    )}
                    <td className={cn('text-right border-r border-slate-300 font-mono tabular-nums text-[11.5px] font-black', isSpacious ? 'py-1.5 px-2' : 'py-1 px-1.5')}>
                      {hasEnteredAnyMark ? data.summary.total_obtained : '—'}
                    </td>
                    {showPercentage && (
                      <td className={cn('text-right border-r border-slate-300 font-mono tabular-nums text-[11px] font-bold', isSpacious ? 'py-1.5 px-1.5' : 'py-1 px-1')}>
                        {hasEnteredAnyMark && data.summary.percentage !== null && data.summary.percentage !== undefined && data.summary.total_possible > 0
                          ? `${data.summary.percentage.toFixed(1)}%`
                          : '—'}
                      </td>
                    )}
                    {showGrade && (
                      <td className={cn('text-center border-r border-slate-300 font-mono text-[11px] font-black', isSpacious ? 'py-1.5 px-1.5' : 'py-1 px-1')}>
                        {hasEnteredAnyMark ? data.summary.grade : '—'}
                      </td>
                    )}
                    <td className={cn(isSpacious ? 'py-1.5 px-2.5' : 'py-1 px-2')} />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ─── 4. Integrated Academic & Attendance Summary Band ─── */}
            <div className="border border-slate-300 rounded bg-slate-50/70 text-xs overflow-hidden">
              {/* Row 1: Symmetrical Metric Columns with Clean Vertical Dividers */}
              <div
                className={cn(
                  'grid divide-y sm:divide-y-0 sm:divide-x divide-slate-200',
                  activeSummaryCols === 4
                    ? 'grid-cols-2 sm:grid-cols-4'
                    : activeSummaryCols === 3
                    ? 'grid-cols-1 sm:grid-cols-3'
                    : activeSummaryCols === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-1'
                )}
              >
                {/* Col 1: Final Examination Result */}
                <div className={cn('flex flex-col justify-center', isSpacious ? 'p-2 sm:p-2.5' : 'p-1.5 sm:p-2')}>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-serif leading-tight">
                    {isUS ? __('Academic Standing:', 'codeclove-school-management') : __('Final Examination Result:', 'codeclove-school-management')}
                  </span>
                  <span className={cn(
                    'font-mono font-bold text-xs uppercase tracking-wide mt-0.5',
                    data.summary.result_status === 'Failed'
                      ? 'text-rose-700'
                      : data.summary.result_status === 'Passed' || data.summary.result_status === 'Honor Roll'
                      ? 'text-emerald-700'
                      : data.summary.result_status === 'Compartment'
                      ? 'text-amber-700'
                      : 'text-slate-700'
                  )}>
                    {data.summary.result_status === 'Compartment' && failedSubjects.length === 1
                      ? sprintf(__('Compartment (%s)', 'codeclove-school-management'), failedSubjects[0])
                      : (data.summary.result_status || __('Pending', 'codeclove-school-management'))}
                  </span>
                </div>

                {/* Col 2: Overall Percentage */}
                {showPercentage && (
                  <div className={cn('flex flex-col justify-center', isSpacious ? 'p-2 sm:p-2.5' : 'p-1.5 sm:p-2')}>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-serif leading-tight">
                      {__('Overall Percentage:', 'codeclove-school-management')}
                    </span>
                    <strong className="font-mono font-bold text-slate-900 text-xs mt-0.5 tabular-nums">
                      {hasEnteredAnyMark &&
                      data.summary.percentage !== null &&
                      data.summary.percentage !== undefined &&
                      data.summary.total_possible > 0
                        ? `${data.summary.percentage.toFixed(1)}%`
                        : '—'}
                    </strong>
                  </div>
                )}

                {/* Col 3: Final Cumulative Grade & GPA */}
                {(showGrade || showGpa) && (
                  <div className={cn('flex flex-col justify-center', isSpacious ? 'p-2 sm:p-2.5' : 'p-1.5 sm:p-2')}>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-serif leading-tight">
                      {!showGrade && showGpa
                        ? (isUS ? __('Cumulative GPA:', 'codeclove-school-management') : __('Overall GPA:', 'codeclove-school-management'))
                        : (isUS ? __('Cumulative GPA:', 'codeclove-school-management') : __('Final Cumulative Grade:', 'codeclove-school-management'))}
                    </span>
                    <strong className="font-mono font-bold text-slate-900 text-xs mt-0.5">
                      {showGrade || showGpa ? (
                        isUS ? (
                          hasEnteredAnyMark ? (
                            showGpa && showGrade
                              ? `${data.summary.grade ? `${data.summary.grade} · ` : ''}${data.summary.grade_point ? (data.summary.grade_point * 0.4).toFixed(2) : '3.85'} / 4.0`
                              : showGpa
                              ? `${data.summary.grade_point ? (data.summary.grade_point * 0.4).toFixed(2) : '3.85'} / 4.0`
                              : data.summary.grade || '—'
                          ) : '—'
                        ) : (
                          <>
                            {showGrade ? (hasEnteredAnyMark ? (data.summary.grade || '—') : '—') : ''}
                            {showGpa && hasEnteredAnyMark && data.summary.grade_point !== null && data.summary.grade_point !== undefined && data.summary.result_status !== 'Failed'
                              ? `${showGrade ? ' ' : ''}(${__('GPA', 'codeclove-school-management')}: ${data.summary.grade_point.toFixed(1)})`
                              : ''}
                            {!showGrade && showGpa && (!hasEnteredAnyMark || data.summary.grade_point === null || data.summary.grade_point === undefined) ? '—' : ''}
                          </>
                        )
                      ) : '—'}
                    </strong>
                  </div>
                )}

                {/* Col 4: Academic Class Rank (out of Total) */}
                {showRank && (
                  <div className={cn('flex flex-col justify-center', isSpacious ? 'p-2 sm:p-2.5' : 'p-1.5 sm:p-2')}>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-serif leading-tight">
                      {__('Academic Class Rank:', 'codeclove-school-management')}
                    </span>
                    <strong className="font-mono font-bold text-slate-900 text-xs mt-0.5">
                      {hasEnteredAnyMark && data.summary.rank ? (
                        <span>
                          {`#${data.summary.rank}`}
                          {effectiveTotalStudents ? (
                            <span className="text-[10px] font-normal text-slate-600">
                              {' '}{__('out of', 'codeclove-school-management')} {effectiveTotalStudents}
                            </span>
                          ) : null}
                        </span>
                      ) : '—'}
                    </strong>
                  </div>
                )}
              </div>

              {/* Row 2: Attendance Summary */}
              {showAttendance && (
                <div className={cn(
                  'border-t border-slate-200 bg-white/70 flex flex-wrap items-center justify-between gap-2 text-xs',
                  isSpacious ? 'px-2.5 py-1.5' : 'px-2 py-1'
                )}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 font-serif">
                      {__('Term Attendance Record:', 'codeclove-school-management')}
                    </span>
                    <span className="font-mono font-semibold text-slate-900 text-xs">
                      {hasAttendanceData
                        ? sprintf(
                            __('%s of %s Days Attended (%s%%)', 'codeclove-school-management'),
                            attendanceDays,
                            totalWorkingDays,
                            attendanceRate !== null ? attendanceRate.toFixed(1) : '0'
                          )
                        : __('No Attendance Record', 'codeclove-school-management')}
                    </span>
                  </div>

                  {hasAttendanceData && totalWorkingDays >= attendanceDays && (
                    <div className="text-[10px] font-mono text-slate-500">
                      {sprintf(__('%s Days Absent / Leave', 'codeclove-school-management'), totalWorkingDays - attendanceDays)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ─── BOTTOM SECTION GROUP ─── */}
          <div className={cn(isCompact ? 'space-y-1' : isSpacious ? 'space-y-2' : 'space-y-1.5', 'mt-auto pt-1')}>
            {/* ─── 5. Grading Scale Reference Legend ─── */}
            {showGradingScale && (
              <div className="border border-slate-300 rounded overflow-hidden text-xs">
                <div className="bg-slate-100/80 px-2 py-0.5 border-b border-slate-300 flex items-center justify-between">
                  <span className="font-bold text-slate-900 uppercase tracking-wider font-serif text-[8.5px]">
                    {__('Grading Scale & Assessment Key', 'codeclove-school-management')}
                  </span>
                  <span className="text-[8px] text-slate-500 font-mono">
                    {gradingScaleTitle}
                  </span>
                </div>
                <table className="w-full text-center border-collapse text-[8px] font-mono">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-0.5 px-1 border-r border-slate-200 text-slate-500 text-[7.5px] font-sans uppercase w-16">{__('Grade', 'codeclove-school-management')}</th>
                      {tiers.map((t, i) => (
                        <th key={i} className="py-0.5 px-1 border-r border-slate-200 last:border-r-0 font-bold text-slate-900">{t.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-slate-600">
                      <td className="py-0.5 px-1 border-r border-slate-200 text-slate-500 text-[7.5px] font-sans uppercase">{__('Marks %', 'codeclove-school-management')}</td>
                      {tiers.map((t, i) => (
                        <td key={i} className="py-0.5 px-1 border-r border-slate-200 last:border-r-0 tabular-nums">{`${t.min}-${t.max}`}</td>
                      ))}
                    </tr>
                    <tr className="text-slate-500 bg-slate-50/50">
                      <td className="py-0.5 px-1 border-r border-slate-200 text-slate-500 text-[7.5px] font-sans uppercase">{__('Grade Pt', 'codeclove-school-management')}</td>
                      {tiers.map((t, i) => (
                        <td key={i} className="py-0.5 px-1 border-r border-slate-200 last:border-r-0 tabular-nums">{t.gp.toFixed(1)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ─── 6. Remarks Section ─── */}
            {hasAnyRemarks && (
              <div className={cn('border border-slate-300 rounded bg-white text-xs', isSpacious ? 'p-2 space-y-1.5' : 'p-1.5 space-y-1')}>
                {effectiveTeacherRemarks && (
                  <div>
                    <span className="font-bold text-slate-900 uppercase tracking-wider block text-[8.5px] mb-0.5 font-serif">
                      {__('Class Teacher Observations', 'codeclove-school-management')}
                    </span>
                    <p className="text-slate-700 italic border-l-2 border-slate-400 pl-2 leading-tight text-[9.5px]">
                      {teacherObservation}
                    </p>
                  </div>
                )}

                {effectivePrincipalRemarks && (
                  <div className={cn(effectiveTeacherRemarks && 'pt-0.5 border-t border-slate-200')}>
                    <span className="font-bold text-slate-900 uppercase tracking-wider block text-[8.5px] mb-0.5 font-serif">
                      {__('Principal / Head of Institution Remarks', 'codeclove-school-management')}
                    </span>
                    <p className="text-slate-700 italic border-l-2 border-slate-400 pl-2 leading-tight text-[9.5px]">
                      {principalRemark}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ─── 7. Official Signatures Footer ─── */}
            {activeSignatoriesCount > 0 && (
              <div className={cn(isSpacious ? 'pt-3' : isCompact ? 'pt-1' : 'pt-2')}>
                <div
                  className={cn(
                    'text-center text-xs items-end',
                    activeSignatoriesCount === 1 && 'grid grid-cols-1 max-w-[220px] mx-auto',
                    activeSignatoriesCount === 2 && 'grid grid-cols-2 max-w-md mx-auto gap-12',
                    activeSignatoriesCount === 3 && 'grid grid-cols-3 gap-6'
                  )}
                >
                  {/* Signatory 1 (Class Teacher) */}
                  {effectiveTeacherSig && (
                    <div className="flex flex-col justify-end">
                      <div className={cn('border-b border-slate-400 mb-0.5', isSpacious ? 'h-11' : isCompact ? 'h-7' : 'h-9')} />
                      <span className="font-bold text-slate-900 block font-serif text-[9px]">
                        {signatory1Title}
                      </span>
                      <span className="text-[7.5px] text-slate-500">
                        {__('Signature', 'codeclove-school-management')}
                      </span>
                    </div>
                  )}

                  {/* Signatory 2 (Principal / Headmaster) */}
                  {effectivePrincipalSig && (
                    <div className="flex flex-col justify-end items-center">
                      {/* Digital Signature if uploaded */}
                      {showDigitalSignature && data.school?.signature && (
                        <div className={cn('flex items-end justify-center mb-0.5', isSpacious ? 'h-8' : 'h-6')}>
                          <img
                            src={data.school.signature}
                            alt={signatory2Title}
                            className="max-h-full max-w-[120px] object-contain drop-shadow-xs"
                          />
                        </div>
                      )}

                      {/* Aligned Signature Baseline */}
                      <div className={cn('border-b border-slate-400 mb-0.5 w-full', isSpacious ? 'h-11' : isCompact ? 'h-7' : 'h-9')} />
                      <span className="font-bold text-slate-900 block font-serif text-[9px]">
                        {signatory2Title}
                      </span>
                      <span className="text-[7.5px] text-slate-500">
                        {__('Signature & Date', 'codeclove-school-management')}
                      </span>
                    </div>
                  )}

                  {/* Signatory 3 (Parent / Guardian) */}
                  {effectiveParentSig && (
                    <div className="flex flex-col justify-end">
                      <div className={cn('border-b border-slate-400 mb-0.5', isSpacious ? 'h-11' : isCompact ? 'h-7' : 'h-9')} />
                      <span className="font-bold text-slate-900 block font-serif text-[9px]">
                        {signatory3Title}
                      </span>
                      <span className="text-[7.5px] text-slate-500">
                        {__('Acknowledgement', 'codeclove-school-management')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* ─── 8. Security Verification Token & Stamp ─── */}
            <div className="pt-0.5 border-t border-slate-200 flex items-center justify-between text-[7.5px] text-slate-500 font-mono">
              <div className="flex items-center gap-1.5">
                {showQrCode ? (
                  <div className="p-0.5 bg-white border border-slate-300 rounded shrink-0">
                    <QRCode value={verificationPayload} size={18} />
                  </div>
                ) : null}
                <div>
                  <p className="font-semibold text-slate-700 leading-none text-[8.5px]">
                    {__('Official Academic Credential', 'codeclove-school-management')}
                  </p>
                  <p className="text-slate-400 text-[7.5px] leading-tight mt-0.5">
                    {showQrCode
                      ? __('Scan QR to verify institutional authenticity.', 'codeclove-school-management')
                      : __('Valid without manual alterations. Retain for academic records.', 'codeclove-school-management')}
                  </p>
                </div>
              </div>

              <div className="text-right leading-tight">
                <span className="font-bold text-slate-700">{documentSerial}</span>
                <span className="block text-slate-500 text-[7.5px]">
                  {__('Date of Issue:', 'codeclove-school-management')} {formattedDate}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReportCardDocument
