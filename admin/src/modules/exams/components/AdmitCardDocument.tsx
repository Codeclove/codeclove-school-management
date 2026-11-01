import { __, sprintf } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'
import { formatTimeDisplay } from '@/components/ui'
import type { AdmitCardStudent, AdmitCardsDataset } from '../types'
export interface AdmitCardDocumentProps {
  exam: AdmitCardsDataset['exam']
  school: AdmitCardsDataset['school']
  student: AdmitCardStudent
  instructions?: string[]
  showPhoto?: boolean
  showInstructions?: boolean
  showInvigilatorSign?: boolean
  signatoryTitle?: string
  id?: string
  className?: string
}

export default function AdmitCardDocument({
  exam,
  school,
  student,
  instructions = [],
  showPhoto = true,
  showInstructions = true,
  showInvigilatorSign = false,
  signatoryTitle = 'Controller of Examinations',
  id,
  className,
}: AdmitCardDocumentProps) {
  const cleanSchoolName = school?.name || __('School Name', 'codeclove-school-management')

  const formattedDate = (d?: string, includeWeekday = false) => {
    if (!d) return '—'
    const parsed = new Date(d.includes('T') ? d : `${d}T00:00:00`)
    if (isNaN(parsed.getTime())) return d
    return parsed.toLocaleDateString(undefined, {
      weekday: includeWeekday ? 'short' : undefined,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTimeSlot = (startTime?: string, endTime?: string) => {
    if (!startTime && !endTime) return '—'
    if (startTime && endTime) {
      return `${formatTimeDisplay(startTime)} – ${formatTimeDisplay(endTime)}`
    }
    return formatTimeDisplay(startTime || endTime) || '—'
  }

  const documentSerial = `HT-${String(exam.id || 1).padStart(4, '0')}-${String(
    student.student_id || 1001
  ).padStart(5, '0')}`

  const papersCount = student.papers.length
  const isDense = papersCount >= 8
  const isUltraDense = papersCount >= 13

  return (
    <div
      id={id}
      data-admit-card="true"
      className={cn(
        // Single clean 1px institutional bounding border
        'relative bg-white text-slate-900 border border-slate-300 shadow-sm mx-auto box-border font-sans',
        'w-full max-w-[194mm]',
        isDense ? 'p-3 sm:p-3.5 mb-4' : 'p-3.5 sm:p-4 mb-5',
        // Print optimization: exactly 194mm wide, zero margin, zero shadow, identical in HTML and PDF
        'print:border print:border-slate-300 print:shadow-none print:m-0 print:mb-0 print:max-w-[194mm] print:p-3',
        className
      )}
      style={{
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      <div className={cn('flex flex-col', isUltraDense ? 'space-y-1.5' : isDense ? 'space-y-2' : 'space-y-2.5')}>
        {/* ─── 1. School Letterhead & Document Title ─── */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            {/* School Crest / Logo */}
            <div className="shrink-0 pt-0.5">
              {school.logo ? (
                <img
                  src={school.logo}
                  alt={cleanSchoolName}
                  style={{ width: '42px', height: '42px', objectFit: 'contain' }}
                  className="shrink-0"
                />
              ) : (
                <div
                  style={{ width: '42px', height: '42px' }}
                  className="rounded-xs bg-slate-900 text-white font-bold text-base flex items-center justify-center shrink-0"
                >
                  {cleanSchoolName.charAt(0)}
                </div>
              )}
            </div>

            {/* School Identity & Affiliation Details (Single-line clean hierarchy) */}
            <div className="text-center flex-1 min-w-0 px-1">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 uppercase leading-snug font-serif">
                {cleanSchoolName}
              </h1>
              {school.address && (
                <p className="text-[10px] text-slate-600 font-medium leading-tight mt-0.5">
                  {school.address}
                </p>
              )}
              <div className="flex items-center justify-center gap-x-2 text-[9px] text-slate-500 font-medium flex-wrap mt-0.5 leading-tight">
                {school.code && (
                  <span>
                    {__('Affiliation Code:', 'codeclove-school-management')}{' '}
                    <strong className="text-slate-700 font-semibold">{school.code}</strong>
                  </span>
                )}
                {school.phone && <span>• Tel: {school.phone}</span>}
                {school.email && <span>• {school.email}</span>}
              </div>
            </div>

            {/* Hall Ticket Identification Credential Box */}
            <div className="shrink-0 text-right font-mono min-w-[105px] bg-slate-50/70 border border-slate-200 p-1.5 sm:p-2 rounded-2xs">
              <span className="block text-[7.5px] font-bold text-slate-600 uppercase tracking-wider">
                {__('Hall Ticket No.', 'codeclove-school-management')}
              </span>
              <strong className="block text-xs sm:text-[13px] font-extrabold text-slate-900 tracking-tight mt-0.5">
                {documentSerial}
              </strong>
            </div>
          </div>

          {/* Understated Title Band */}
          <div className="border-y border-slate-200 py-0.5 sm:py-1 text-center">
            <h2 className="text-xs sm:text-[12.5px] font-extrabold uppercase tracking-widest text-slate-900">
              {__('Examination Admit Card / Hall Ticket', 'codeclove-school-management')}
            </h2>
            <p className="text-[9.5px] sm:text-[10px] font-semibold text-slate-600 mt-0.5">
              <span>{exam.name}</span>
              {exam.academic_session_name && (
                <span className="font-normal text-slate-500">
                  {' '}• {exam.academic_session_name}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* ─── 2. Compact Candidate Information Dossier ─── */}
        <div className="bg-slate-50/50 border border-slate-200 p-2 sm:p-2.5 flex items-stretch gap-2.5">
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 sm:gap-y-1.5">
            {/* Candidate Full Name */}
            <div className="min-w-0 sm:col-span-2">
              <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-slate-600 leading-tight">
                {__('Candidate Full Name', 'codeclove-school-management')}
              </span>
              <strong className="block text-xs sm:text-[13px] font-bold text-slate-950 leading-tight mt-0.5">
                {student.name}
              </strong>
            </div>

            {/* Prominent Roll Number Callout */}
            <div className="min-w-0">
              <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-slate-600 leading-tight">
                {__('Roll Number', 'codeclove-school-management')}
              </span>
              <strong className="block text-sm sm:text-base font-extrabold font-mono text-slate-950 leading-tight mt-0.5">
                {student.roll_number || '—'}
              </strong>
            </div>

            {/* Class & Section */}
            <div className="min-w-0">
              <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-slate-600 leading-tight">
                {__('Class & Section', 'codeclove-school-management')}
              </span>
              <strong className="block text-xs font-semibold text-slate-900 leading-tight mt-0.5">
                {student.unit_name} {student.group_name && `(${student.group_name})`}
              </strong>
            </div>

            {/* Admission No */}
            <div className="min-w-0">
              <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-slate-600 leading-tight">
                {__('Admission No.', 'codeclove-school-management')}
              </span>
              <strong className="block text-xs font-mono font-semibold text-slate-900 leading-tight mt-0.5">
                {student.admission_number || student.student_number || '—'}
              </strong>
            </div>

            {/* Guardian / Father Name */}
            <div className="min-w-0">
              <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-slate-600 leading-tight">
                {__('Guardian / Father Name', 'codeclove-school-management')}
              </span>
              <strong className="block text-xs font-semibold text-slate-900 leading-tight mt-0.5">
                {student.guardian_name || '—'}
              </strong>
            </div>

            {/* Date of Birth & Gender */}
            <div className="min-w-0">
              <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-slate-600 leading-tight">
                {__('Date of Birth & Gender', 'codeclove-school-management')}
              </span>
              <strong className="block text-xs font-semibold text-slate-900 leading-tight mt-0.5">
                {formattedDate(student.date_of_birth)}
                {student.gender && ` (${student.gender.charAt(0).toUpperCase()})`}
              </strong>
            </div>

            {/* Examination Center */}
            <div className="min-w-0 sm:col-span-4">
              <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-slate-600 leading-tight">
                {__('Designated Examination Center / Venue', 'codeclove-school-management')}
              </span>
              <strong className="block text-xs font-semibold text-slate-900 leading-tight mt-0.5 break-words">
                {cleanSchoolName} {school.address ? `• ${school.address}` : ''}
              </strong>
            </div>
          </div>

          {/* Right Passport Photograph & Official Digital Verification */}
          {showPhoto && (
            <div className="shrink-0 flex flex-col items-center justify-between pl-2.5 border-l border-slate-200 w-[88px]">
              {/* Photo Frame */}
              {student.photo_url ? (
                <div className="border border-slate-300 bg-white p-0.5 shadow-2xs">
                  <img
                    src={student.photo_url}
                    alt={student.name}
                    className="object-cover w-[72px] h-[84px]"
                  />
                </div>
              ) : (
                <div className="border border-dashed border-slate-300 flex flex-col items-center justify-center p-1 text-center text-slate-400 bg-white w-[72px] h-[84px]">
                  <User className="w-4 h-4 mb-0.5 text-slate-300" />
                  <span className="text-[7px] font-bold uppercase tracking-tight text-slate-500 leading-tight">
                    {__('Affix Photo', 'codeclove-school-management')}
                  </span>
                  <span className="text-[6px] text-slate-400 leading-tight mt-0.5">
                    {__('(Self-Attested)', 'codeclove-school-management')}
                  </span>
                </div>
              )}

              {/* Candidate Signature Box */}
              <div className="mt-1.5 w-full flex flex-col items-center text-center">
                <div className="w-full h-5 border-b border-dashed border-slate-300 bg-white/60 mb-0.5" />
                <span className="text-[6.5px] font-mono font-bold uppercase tracking-wider text-slate-400 leading-tight">
                  {__('Candidate Signature', 'codeclove-school-management')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ─── 3. Editorial Examination Schedule Table (Standard Single-Column Layout) ─── */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wider text-slate-900 font-sans">
              {__('Examination Schedule', 'codeclove-school-management')}
            </span>
            <span className="text-[8px] font-mono text-slate-400 font-medium uppercase tracking-wider">
              {sprintf(__('%d Subject Paper(s)', 'codeclove-school-management'), papersCount)}
            </span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-50/80 text-slate-800 text-[8px] sm:text-[8.5px] uppercase tracking-wider font-extrabold">
                <th className={cn('text-center w-8', isUltraDense ? 'py-0.5 px-1.5' : 'py-1 px-2')}>#</th>
                <th className={cn('w-16', isUltraDense ? 'py-0.5 px-1.5' : 'py-1 px-2')}>{__('Code', 'codeclove-school-management')}</th>
                <th className={cn(isUltraDense ? 'py-0.5 px-2' : 'py-1 px-2.5')}>{__('Subject Title', 'codeclove-school-management')}</th>
                <th className={cn(isUltraDense ? 'py-0.5 px-2' : 'py-1 px-2.5')}>{__('Date & Day', 'codeclove-school-management')}</th>
                <th className={cn(isUltraDense ? 'py-0.5 px-2' : 'py-1 px-2.5')}>{__('Time Slot', 'codeclove-school-management')}</th>
                <th className={cn(isUltraDense ? 'py-0.5 px-2' : 'py-1 px-2.5')}>{__('Room / Hall', 'codeclove-school-management')}</th>
                {showInvigilatorSign && (
                  <th className={cn('text-center w-24 sm:w-28', isUltraDense ? 'py-0.5 px-2' : 'py-1 px-2.5')}>
                    {__('Invigilator Sign', 'codeclove-school-management')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {student.papers.length === 0 ? (
                <tr>
                  <td
                    colSpan={showInvigilatorSign ? 7 : 6}
                    className="py-2.5 text-center text-slate-500 italic text-[10px]"
                  >
                    {__('No scheduled exam papers found for this candidate.', 'codeclove-school-management')}
                  </td>
                </tr>
              ) : (
                student.papers.map((paper, index) => (
                  <tr
                    key={`${paper.subject_id}-${index}`}
                    className="even:bg-slate-50/40 hover:bg-slate-50/80 transition-colors"
                  >
                    <td className={cn('text-center font-mono font-medium text-slate-600', isUltraDense ? 'py-0.5 px-1.5 text-[8.5px]' : isDense ? 'py-1 px-1.5 text-[8.5px]' : 'py-1.25 px-2 text-[9px]')}>
                      {index + 1}
                    </td>
                    <td className={cn('font-mono font-bold text-slate-700', isUltraDense ? 'py-0.5 px-1.5 text-[9px]' : isDense ? 'py-1 px-1.5 text-[9px]' : 'py-1.25 px-2 text-[9.5px]')}>
                      {paper.subject_code || '—'}
                    </td>
                    <td className={cn('font-semibold text-slate-900', isUltraDense ? 'py-0.5 px-2 text-[9.5px]' : isDense ? 'py-1 px-2 text-[10px]' : 'py-1.25 px-2.5 text-[10.5px]')}>
                      {paper.subject_name}
                    </td>
                    <td className={cn('font-medium text-slate-700 whitespace-nowrap', isUltraDense ? 'py-0.5 px-2 text-[9px]' : isDense ? 'py-1 px-2 text-[9.5px]' : 'py-1.25 px-2.5 text-[10px]')}>
                      {formattedDate(paper.exam_date, true)}
                    </td>
                    <td className={cn('text-slate-600 whitespace-nowrap font-mono font-medium', isUltraDense ? 'py-0.5 px-2 text-[8.5px]' : isDense ? 'py-1 px-2 text-[9px]' : 'py-1.25 px-2.5 text-[9.5px]')}>
                      {formatTimeSlot(paper.start_time, paper.end_time)}
                    </td>
                    <td className={cn('font-medium text-slate-700 whitespace-nowrap', isUltraDense ? 'py-0.5 px-2 text-[9px]' : isDense ? 'py-1 px-2 text-[9.5px]' : 'py-1.25 px-2.5 text-[10px]')}>
                      {paper.room || '—'}
                    </td>
                    {showInvigilatorSign && (
                      <td className={cn('text-center', isUltraDense ? 'py-0.25 px-1.5' : 'py-0.5 px-2')}>
                        <div className="h-3.5 sm:h-4 w-full border border-dashed border-slate-300 rounded-2xs bg-slate-50/50" />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─── 4. Candidate Instructions (Clean Unboxed Band) ─── */}
        {showInstructions && instructions.length > 0 && (
          <div className="border-t border-slate-200 pt-1.5 text-[8px] text-slate-600">
            <span className="font-extrabold uppercase tracking-wider text-slate-800 block mb-0.5">
              {__('Instructions to Candidates:', 'codeclove-school-management')}
            </span>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 list-decimal pl-3.5 text-slate-600 leading-tight">
              {instructions.map((inst, i) => (
                <li key={i}>{inst}</li>
              ))}
            </ol>
          </div>
        )}

        {/* ─── 5. Candidate Declaration Undertaking ─── */}
        <div className="border-t border-slate-200 pt-1 text-[8px] text-slate-700 font-medium text-center leading-tight">
          {__('Candidate Declaration: I hereby confirm that the examination details printed above are accurate. I undertake to strictly abide by all institutional examination rules and directives.', 'codeclove-school-management')}
        </div>

        {/* ─── 6. Three-Point Executive Signatures & Seal ─── */}
        <div className="grid grid-cols-3 gap-4 pt-1.5 border-t border-slate-200 text-center items-end">
          {/* Candidate Signature */}
          <div className="flex flex-col items-center">
            <div className="h-5 border-b border-dashed border-slate-300 w-4/5 mb-0.5" />
            <span className="text-[8.5px] font-bold text-slate-900 uppercase tracking-wider block">
              {__("Candidate's Signature", 'codeclove-school-management')}
            </span>
            <span className="text-[7px] text-slate-600 font-medium italic block">
              {__('(Sign in presence of Invigilator)', 'codeclove-school-management')}
            </span>
          </div>

          {/* Official School Seal Placeholder */}
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-9 border border-dashed border-slate-300 rounded-2xs flex flex-col items-center justify-center p-0.5 text-slate-500 bg-white">
              <span className="text-[7px] uppercase tracking-wider font-bold text-slate-600">
                {__('Official Stamp', 'codeclove-school-management')}
              </span>
              <span className="text-[6px] text-slate-500 uppercase tracking-wider font-medium">
                {__('School Seal', 'codeclove-school-management')}
              </span>
            </div>
          </div>

          {/* Authorized Signatory */}
          <div className="flex flex-col items-center">
            <div className="h-5 border-b border-slate-900 w-4/5 mb-0.5" />
            <span className="text-[8.5px] font-bold text-slate-900 uppercase tracking-wider block">
              {signatoryTitle}
            </span>
            <span className="text-[7.5px] text-slate-700 block mt-0.5 font-medium truncate max-w-[200px]">
              {cleanSchoolName}
            </span>
          </div>
        </div>

        {/* ─── 7. Clean Security Micro-Footer (Removed • Page 1 of 1) ─── */}
        <div className="border-t border-slate-200 pt-1 text-[7.5px] font-mono text-slate-600 font-medium flex items-center justify-between">
          <span>{__('Official Examination Hall Ticket • Preserve till result declaration', 'codeclove-school-management')}</span>
          <span>{documentSerial}</span>
        </div>
      </div>
    </div>
  )
}
