/**
 * TabulationLedgerDocument - Publication-grade, statutory Class Tabulation Broadsheet.
 * Formatted for landscape paper (A4 / Letter / A3) with official school letterhead,
 * executive summary metrics, repeating table headers, and statutory signature endorsements.
 * Supports both Detailed Broadsheet (all subjects) and Results Summary (merit list) views.
 */
import React from 'react'
import { __, sprintf } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { TabulationSubject, TabulationStudent } from '../types'

export interface TabulationLedgerDocumentProps {
  id?: string
  viewMode?: 'summary' | 'detailed'
  exam: {
    id: number
    name: string
    code?: string | null
    academic_session_name?: string | null
    starts_on?: string | null
    ends_on?: string | null
    status?: string | null
  }
  school: {
    name: string
    code?: string | null
    logo?: string | null
    address?: string | null
    phone?: string | null
    email?: string | null
    affiliation?: string | null
  }
  academicUnitName: string
  sectionName?: string
  subjects: TabulationSubject[]
  students: TabulationStudent[]
  stats?: {
    total: number
    assessed: number
    completed?: number
    partial?: number
    pending: number
    passed: number
    failed: number
    passRate: string
    avgPercentage: string
    highestPercentage: string
  } | null
  paperSize?: 'a4' | 'letter' | 'a3'
  className?: string
}

export const TabulationLedgerDocument = React.forwardRef<HTMLDivElement, TabulationLedgerDocumentProps>(
  (
    {
      id = 'codeclove-tabulation-ledger',
      viewMode = 'detailed',
      exam,
      school,
      academicUnitName,
      sectionName,
      subjects = [],
      students = [],
      stats,
      paperSize = 'a4',
      className,
    },
    ref
  ) => {
    const isSummary = viewMode === 'summary'
    const totalMaxMarks = subjects.reduce((acc, s) => acc + (s.max_marks || 0), 0)
    const minPassPercentage = subjects.length > 0 ? 33 : 0
    const cleanSchoolName = school?.name || __('School Name', 'codeclove-school-management')
    const isDenseSubjects = subjects.length > 8

    // Count subjects that have at least one entered mark across the cohort
    const evaluatedSubjectCount = subjects.filter((subj) =>
      students.some((st) => {
        const item = st.marks?.[subj.id]
        return item && (item.is_absent || item.status === 'absent' || (item.marks_obtained != null))
      })
    ).length

    const currentDateFormatted = new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

    return (
      <div
        ref={ref}
        id={id}
        data-tabulation-print="true"
        data-print-area="true"
        data-orientation="landscape"
        data-paper-size={paperSize}
        className={cn(
          'bg-white text-slate-900 font-sans mx-auto box-border flex flex-col p-4 print:p-0 w-full max-w-full overflow-hidden',
          className
        )}
      >
        {/* ─── Paged Media CSS Rules ─── */}
        <style>{`
          @page {
            size: ${paperSize === 'letter' ? 'letter landscape' : paperSize === 'a3' ? 'A3 landscape' : 'A4 landscape'};
            margin: 6mm 8mm;
          }
          @media print {
            html, body {
              background: #fff !important;
              color: #0f172a !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            thead {
              display: table-header-group !important;
            }
            tfoot {
              display: table-footer-group !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        `}</style>

        {/* ─── Outer Formal Border Frame ─── */}
        <div className="border-2 border-slate-900 p-1 bg-white box-border w-full">
          <div className="border border-slate-700 p-3 sm:p-4 bg-white flex flex-col space-y-3 box-border w-full">
            
            {/* ─── 1. Official Institutional Header ─── */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2.5">
              <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                {school.logo ? (
                  <img
                    src={school.logo}
                    alt={cleanSchoolName}
                    className="max-h-16 max-w-16 object-contain"
                  />
                ) : (
                  <div className="w-12 h-12 border border-dashed border-slate-400 rounded flex items-center justify-center text-slate-400 font-bold text-lg font-mono">
                    {cleanSchoolName.charAt(0)}
                  </div>
                )}
              </div>

              <div className="text-center flex-1 px-4">
                <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-950 font-serif">
                  {cleanSchoolName}
                </h1>
                <div className="flex items-center justify-center gap-3 text-[9px] text-slate-600 mt-0.5 flex-wrap">
                  {school.code && (
                    <span className="font-mono">
                      {sprintf(__('Code: %s', 'codeclove-school-management'), school.code)}
                    </span>
                  )}
                  {school.affiliation && (
                    <span>• {sprintf(__('Affiliation: %s', 'codeclove-school-management'), school.affiliation)}</span>
                  )}
                  {school.address && <span>• {school.address}</span>}
                </div>
                <div className="inline-block mt-1.5 px-3 py-0.5 bg-slate-900 text-white rounded text-[9.5px] font-bold uppercase tracking-widest">
                  {isSummary
                    ? __('Official Tabulation Register • Results Summary', 'codeclove-school-management')
                    : __('Official Tabulation Register • Broadsheet Gazette', 'codeclove-school-management')}
                </div>
              </div>

              <div className="w-24 text-right text-[8.5px] text-slate-500 font-mono shrink-0">
                <div>{sprintf(__('Date: %s', 'codeclove-school-management'), currentDateFormatted)}</div>
                <div>{sprintf(__('Total Students: %d', 'codeclove-school-management'), students.length)}</div>
                <div className="mt-1 font-semibold text-slate-700">{__('Confidential', 'codeclove-school-management')}</div>
              </div>
            </div>

            {/* ─── 2. Academic Context & Metadata Strip ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-slate-300 p-2 text-[10px]">
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[8px] font-bold block">
                  {__('Examination', 'codeclove-school-management')}
                </span>
                <span className="font-bold text-slate-900 truncate block">
                  {exam.name}
                  {exam.code ? ` (${exam.code})` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[8px] font-bold block">
                  {__('Academic Session', 'codeclove-school-management')}
                </span>
                <span className="font-semibold text-slate-900 truncate block">
                  {exam.academic_session_name || __('Current Session', 'codeclove-school-management')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[8px] font-bold block">
                  {__('Class & Section', 'codeclove-school-management')}
                </span>
                <span className="font-bold text-slate-900 truncate block">
                  {sectionName ? `${academicUnitName} • ${sectionName}` : `${academicUnitName} • ${__('All Sections', 'codeclove-school-management')}`}
                </span>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[8px] font-bold block">
                  {__('Assessment Standard', 'codeclove-school-management')}
                </span>
                <span className="font-semibold text-slate-900 truncate block">
                  {evaluatedSubjectCount < subjects.length && evaluatedSubjectCount > 0
                    ? sprintf(__('%d of %d Papers Graded • Max %d Marks', 'codeclove-school-management'), evaluatedSubjectCount, subjects.length, totalMaxMarks)
                    : sprintf(__('%d Papers • Max %d Marks', 'codeclove-school-management'), subjects.length, totalMaxMarks)}
                </span>
              </div>
            </div>

            {/* ─── 3. Executive Performance Summary Band ─── */}
            {stats && (
              <div className="flex items-center justify-between bg-slate-100/70 border border-slate-300 px-3 py-1.5 text-[9px] font-mono tabular-nums">
                <div className="flex items-center gap-3">
                  <span>
                    <span className="text-slate-500 font-sans">{__('Enrolled:', 'codeclove-school-management')}</span>{' '}
                    <strong className="text-slate-900">{stats.total}</strong>
                  </span>
                  <span>•</span>
                  {stats.partial && stats.partial > 0 && (!stats.completed || stats.completed === 0) ? (
                    <>
                      <span>
                        <span className="text-slate-500 font-sans">{__('Grading In Progress:', 'codeclove-school-management')}</span>{' '}
                        <strong className="text-amber-700">{stats.partial}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        <span className="text-slate-500 font-sans">{__('Pending:', 'codeclove-school-management')}</span>{' '}
                        <strong className="text-slate-600">{stats.pending}</strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        <span className="text-slate-500 font-sans">{__('Evaluated:', 'codeclove-school-management')}</span>{' '}
                        <strong className="text-slate-900">{stats.assessed}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        <span className="text-slate-500 font-sans">{__('Pending:', 'codeclove-school-management')}</span>{' '}
                        <strong className="text-amber-700">{stats.pending}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        <span className="text-slate-500 font-sans">{__('Passed:', 'codeclove-school-management')}</span>{' '}
                        <strong className="text-emerald-700">{stats.passed}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        <span className="text-slate-500 font-sans">{__('Failed:', 'codeclove-school-management')}</span>{' '}
                        <strong className="text-rose-700">{stats.failed}</strong>
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 font-semibold">
                  <span className="text-slate-700">
                    <span className="text-slate-500 font-sans font-normal">{__('Pass Rate:', 'codeclove-school-management')}</span>{' '}
                    {stats.passRate}
                  </span>
                  <span>•</span>
                  <span className="text-slate-700">
                    <span className="text-slate-500 font-sans font-normal">{__('Class Avg:', 'codeclove-school-management')}</span>{' '}
                    {stats.avgPercentage}
                  </span>
                  <span>•</span>
                  <span className="text-slate-900">
                    <span className="text-slate-500 font-sans font-normal">{__('Top Score:', 'codeclove-school-management')}</span>{' '}
                    {stats.highestPercentage}
                  </span>
                </div>
              </div>
            )}

            {/* ─── 4. High-Density Tabular Broadsheet Matrix ─── */}
            <div className="w-full overflow-hidden">
              <table className={cn(
                'w-full border-collapse border border-slate-300',
                isDenseSubjects ? 'table-fixed text-[8px]' : 'text-[9.5px]'
              )}>
                {/* ─── Repeatable Table Header on Print ─── */}
                <thead>
                  <tr className="bg-slate-200/90 text-slate-900 font-bold border-b border-slate-400">
                    <th className={cn('border-r border-slate-300 text-center font-mono', isDenseSubjects ? 'w-6 py-1 px-0.5' : 'w-8 py-1.5 px-1')}>
                      #
                    </th>
                    <th className={cn('border-r border-slate-300 text-center font-mono', isDenseSubjects ? 'w-10 py-1 px-0.5' : 'w-14 py-1.5 px-1')}>
                      {__('Roll No.', 'codeclove-school-management')}
                    </th>
                    <th className={cn('border-r border-slate-300 text-left', isSummary ? 'min-w-[180px] py-1.5 px-2' : isDenseSubjects ? 'w-36 py-1 px-1.5' : 'min-w-[140px] py-1.5 px-2')}>
                      {__('Student Name & Admission No.', 'codeclove-school-management')}
                    </th>

                    {/* Subject Headers (Detailed View Only) */}
                    {!isSummary && subjects.map((subj) => (
                      <th
                        key={subj.id}
                        className={cn(
                          'border-r border-slate-300 text-right font-semibold text-slate-900',
                          isDenseSubjects ? 'py-1 px-1 text-[7.5px] leading-tight break-words' : 'py-1.5 px-2 min-w-[60px]'
                        )}
                        title={subj.name}
                      >
                        <div className={isDenseSubjects ? 'line-clamp-2' : 'truncate max-w-[85px]'}>
                          {subj.name}
                        </div>
                      </th>
                    ))}

                    <th className={cn('border-r border-slate-300 text-right font-bold text-slate-900', isDenseSubjects ? 'w-14 py-1 px-1' : 'w-16 py-1.5 px-2')}>
                      {__('Total', 'codeclove-school-management')}
                    </th>
                    <th className={cn('border-r border-slate-300 text-right font-bold text-slate-900', isDenseSubjects ? 'w-10 py-1 px-0.5' : 'w-14 py-1.5 px-1.5')}>
                      %
                    </th>
                    <th className={cn('border-r border-slate-300 text-center font-bold text-slate-900', isDenseSubjects ? 'w-8 py-1 px-0.5' : 'w-10 py-1.5 px-1')}>
                      {__('Grd', 'codeclove-school-management')}
                    </th>
                    <th className={cn('border-r border-slate-300 text-center font-bold text-slate-900', isDenseSubjects ? 'w-8 py-1 px-0.5' : 'w-10 py-1.5 px-1')}>
                      {__('Rnk', 'codeclove-school-management')}
                    </th>
                    <th className={cn('text-center font-bold text-slate-900', isDenseSubjects ? 'w-14 py-1 px-0.5' : 'w-16 py-1.5 px-1.5')}>
                      {__('Result', 'codeclove-school-management')}
                    </th>
                  </tr>

                  {/* ─── Scale / Maximum Marks Ribbon ─── */}
                  <tr className="bg-slate-100 text-[8px] font-mono text-slate-600 border-b border-slate-300 tabular-nums">
                    <th className="border-r border-slate-300 text-center py-0.5 px-0.5">—</th>
                    <th className="border-r border-slate-300 text-center py-0.5 px-0.5">—</th>
                    <th className="border-r border-slate-300 text-left py-0.5 px-1.5 uppercase font-semibold text-slate-700">
                      {__('Scale (Max / Pass)', 'codeclove-school-management')}
                    </th>

                    {!isSummary && subjects.map((subj) => (
                      <th key={`scale-${subj.id}`} className="border-r border-slate-300 text-right py-0.5 px-1">
                        <span className="font-bold text-slate-800">{subj.max_marks}</span>
                        <span className="text-slate-400">/{subj.pass_marks}</span>
                      </th>
                    ))}

                    <th className="border-r border-slate-300 text-right py-0.5 px-1 font-bold text-slate-800">
                      {totalMaxMarks}
                    </th>
                    <th className="border-r border-slate-300 text-right py-0.5 px-0.5 font-bold text-slate-700">
                      {minPassPercentage}%
                    </th>
                    <th className="border-r border-slate-300 text-center py-0.5 px-0.5">—</th>
                    <th className="border-r border-slate-300 text-center py-0.5 px-0.5">—</th>
                    <th className="text-center py-0.5 px-0.5">—</th>
                  </tr>
                </thead>

                {/* ─── Student Performance Rows ─── */}
                <tbody className="divide-y divide-slate-200">
                  {students.map((st, idx) => {
                    const hasMarks = subjects.some((subj) => {
                      const item = st.marks?.[subj.id]
                      return (
                        item &&
                        (item.is_absent ||
                          item.status === 'absent' ||
                          (item.marks_obtained != null))
                      )
                    })
                    const isPending = Boolean(st.is_pending || (!hasMarks && st.total_marks_obtained === 0))
                    const isPartial = Boolean(st.is_partial || st.result_status === 'partial')

                    return (
                      <tr
                        key={st.student_id || idx}
                        className={cn(
                          'transition-colors align-middle',
                          idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                        )}
                      >
                        <td className="border-r border-slate-200 text-center py-1 px-0.5 font-mono text-[8px] text-slate-400">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="border-r border-slate-200 text-center py-1 px-0.5 font-mono font-medium text-slate-700">
                          {st.roll_number || '—'}
                        </td>
                        <td className="border-r border-slate-200 py-1 px-1.5">
                          <div className="font-semibold text-slate-900 leading-tight truncate">
                            {st.student_name}
                          </div>
                          <div className="text-[7.5px] font-mono text-slate-500 truncate">
                            {st.student_number}
                            {st.group_name ? ` • ${st.group_name}` : ''}
                          </div>
                        </td>

                        {/* Subject Score Cells (Detailed View Only) */}
                        {!isSummary && subjects.map((subj) => {
                          const item = st.marks?.[subj.id]
                          const marks = item?.marks_obtained
                          const isAbsent = Boolean(item?.is_absent || item?.status === 'absent')
                          const isExempt = Boolean(item?.is_exempt || item?.status === 'exempt')
                          const isBelowPass =
                            marks != null && marks < subj.pass_marks

                          return (
                            <td
                              key={subj.id}
                              className={cn(
                                'border-r border-slate-200 text-right font-mono tabular-nums',
                                isDenseSubjects ? 'py-0.5 px-1 text-[8px]' : 'py-1 px-2 text-[9px]',
                                isBelowPass && 'bg-rose-50/80 font-bold text-rose-700'
                              )}
                            >
                              {isAbsent ? (
                                <span className="font-bold text-rose-600 text-[8px]">ABS</span>
                              ) : isExempt ? (
                                <span className="text-slate-400 text-[8px]">EXM</span>
                              ) : item?.is_enrolled === false ? (
                                <span className="text-slate-300 font-mono">—</span>
                              ) : marks != null ? (
                                <span>
                                  {marks}
                                  {isBelowPass ? '*' : ''}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono">—</span>
                              )}
                            </td>
                          )
                        })}

                        {/* Aggregate Columns */}
                        <td className={cn('border-r border-slate-200 text-right font-mono font-bold text-slate-900 tabular-nums', isDenseSubjects ? 'py-0.5 px-1' : 'py-1 px-2')}>
                          {!isPending ? (
                            <>
                              <span>{st.total_marks_obtained}</span>
                              <span className="text-slate-400 text-[7.5px] font-normal">
                                /{st.total_marks_possible}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-300 font-mono">—</span>
                          )}
                        </td>

                        <td className={cn('border-r border-slate-200 text-right font-mono font-bold tabular-nums', isDenseSubjects ? 'py-0.5 px-0.5' : 'py-1 px-1.5')}>
                          {!isPending ? (
                            <span className={st.has_failed ? 'text-rose-700' : 'text-slate-900'}>
                              {st.percentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">—</span>
                          )}
                        </td>

                        <td className={cn('border-r border-slate-200 text-center font-mono font-bold text-slate-900', isDenseSubjects ? 'py-0.5 px-0.5' : 'py-1 px-1')}>
                          {!isPending && st.grade ? st.grade : '—'}
                        </td>

                        <td className={cn('border-r border-slate-200 text-center font-mono text-slate-700 font-semibold', isDenseSubjects ? 'py-0.5 px-0.5' : 'py-1 px-1')}>
                          {!isPending && st.rank ? st.rank : '—'}
                        </td>

                        <td className={cn('text-center font-bold uppercase tracking-wider', isDenseSubjects ? 'py-0.5 px-0.5 text-[7.5px]' : 'py-1 px-1.5 text-[8px]')}>
                          {isPending ? (
                            <span className="text-slate-400 font-normal">PENDING</span>
                          ) : isPartial ? (
                            <span className="text-amber-700 font-bold">
                              {st.evaluated_papers && st.total_papers
                                ? sprintf(__('PARTIAL (%d/%d)', 'codeclove-school-management'), st.evaluated_papers, st.total_papers)
                                : __('PARTIAL', 'codeclove-school-management')}
                            </span>
                          ) : st.has_failed || st.result_status === 'failed' ? (
                            <span className="text-rose-700 font-bold">FAILED</span>
                          ) : (
                            <span className="text-emerald-700 font-bold">PASSED</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ─── 5. Broadsheet Footnote ─── */}
            <div className="flex items-center justify-between text-[8px] text-slate-500 pt-1">
              <span>
                {__('* Asterisk indicates subject score below minimum pass threshold. ABS = Absent, EXM = Exempt from paper.', 'codeclove-school-management')}
              </span>
              <span className="font-mono">
                {sprintf(__('Computer Generated Academic Credential • Page 1 of 1', 'codeclove-school-management'))}
              </span>
            </div>

            {/* ─── 6. Statutory Signatory Block ─── */}
            <div className="grid grid-cols-4 gap-4 border-t-2 border-slate-900 pt-5 mt-4">
              <div className="text-center">
                <div className="h-9 border-b border-dashed border-slate-400 w-3/4 mx-auto mb-1" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-800 block">
                  {__('Class Teacher', 'codeclove-school-management')}
                </span>
                <span className="text-[8px] text-slate-500 block">
                  {__('Prepared By', 'codeclove-school-management')}
                </span>
              </div>

              <div className="text-center">
                <div className="h-9 border-b border-dashed border-slate-400 w-3/4 mx-auto mb-1" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-800 block">
                  {__('Exam Coordinator', 'codeclove-school-management')}
                </span>
                <span className="text-[8px] text-slate-500 block">
                  {__('Tabulated & Verified', 'codeclove-school-management')}
                </span>
              </div>

              <div className="text-center">
                <div className="h-9 border-b border-dashed border-slate-400 w-3/4 mx-auto mb-1" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-800 block">
                  {__('Controller of Examinations', 'codeclove-school-management')}
                </span>
                <span className="text-[8px] text-slate-500 block">
                  {__('Audit & Compliance', 'codeclove-school-management')}
                </span>
              </div>

              <div className="text-center border-l border-slate-300 ps-4">
                <div className="h-9 border-b border-dashed border-slate-400 w-3/4 mx-auto mb-1" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-900 block">
                  {__('Principal / Headmaster', 'codeclove-school-management')}
                </span>
                <span className="text-[8px] text-slate-500 block">
                  {__('Approved & Sealed', 'codeclove-school-management')}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    )
  }
)

TabulationLedgerDocument.displayName = 'TabulationLedgerDocument'
