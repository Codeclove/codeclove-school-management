import { useState, useEffect, useMemo } from 'react'
import {
  CalendarDays, Clock, Download, Search,
  FilterX, Users, ChevronLeft, ChevronRight, Check, X,
  Sun, AlertCircle
} from 'lucide-react'
import { useSession } from '@/lib/session-context'
import { useUnits, useGroups } from '@/api/academics'
import { useMonthlyAttendance } from '@/api/attendance'
import { useLabels } from '@/lib/labels'
import { __, sprintf } from '@/lib/i18n'
import {
  Button, Card, CardContent, Select, Input, PersonAvatar,
  TableRoot, Tbody, TableEmpty, TableSkeleton, EmptyState
} from '@/components/ui'

const currentYear = new Date().getFullYear()
const yearsList = [-1, 0, 1].map((offset) => {
  const val = String(currentYear + offset)
  return { value: val, label: val }
})

const monthsList = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(2000, i, 1).toLocaleString('default', { month: 'long' }),
}))

const STATUS_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  present: { label: 'P', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' },
  absent: { label: 'A', className: 'bg-rose-600 text-white shadow-xs' },
  late: { label: 'L', className: 'bg-amber-500 text-white shadow-xs' },
  half_day: { label: 'H', className: 'bg-orange-500 text-white shadow-xs' },
  excused: { label: 'E', className: 'bg-sky-500 text-white shadow-xs' },
  holiday: { label: 'Hl', className: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300' },
}

export default function StudentMonthlyAttendance() {
  const { session } = useSession()
  const sessionId = session ? String(session.id) : ''
  const { getLabel } = useLabels()

  const unitLabelSingular = getLabel('academic_unit', false, __('Class', 'codeclove-school-management'))

  // Filter States
  const [unitId, setUnitId] = useState<string>('')
  const [groupId, setGroupId] = useState<string>('')
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1))
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Reset filters if the active session changes
  useEffect(() => {
    setUnitId('')
    setGroupId('')
  }, [sessionId])

  // Fetch filter dropdown options
  const { data: unitResponse } = useUnits({ session_id: Number(sessionId) })
  const { data: groupResponse } = useGroups({ academic_unit_id: Number(unitId) })

  const units = unitResponse?.data ?? []
  const groups = groupResponse?.data ?? []

  // Monthly Matrix query
  const { data: monthlyData, isLoading: isMonthlyLoading, isError: isMonthlyError } = useMonthlyAttendance({
    academic_session_id: Number(sessionId),
    academic_unit_id: Number(unitId),
    academic_group_id: groupId ? Number(groupId) : undefined,
    year: Number(year),
    month: Number(month),
  })

  // Monthly statistics raw list
  const monthlyStudentsList = useMemo(() => monthlyData?.students ?? [], [monthlyData])
  const monthlyDaysCount = monthlyData?.days_in_month ?? 0

  // Precomputed day metadata for table rendering and exports
  const daysInfo = useMemo(() => {
    const y = Number(year)
    const m = Number(month)
    const mPad = String(month).padStart(2, '0')
    return Array.from({ length: monthlyDaysCount }, (_, i) => {
      const d = i + 1
      const dateObj = new Date(y, m - 1, d)
      const dayOfWeek = dateObj.getDay()
      return {
        day: d,
        dateStr: `${y}-${mPad}-${String(d).padStart(2, '0')}`,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isMonday: dayOfWeek === 1 && d > 1,
        weekdayLetter: dateObj.toLocaleDateString('en-US', { weekday: 'narrow' }),
      }
    })
  }, [monthlyDaysCount, year, month])

  // Instant client-side filtered students list
  const filteredStudentsList = useMemo(() => {
    return monthlyStudentsList.filter((s) => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
      const studentNum = (s.student_number || '').toLowerCase()
      const rollNum = String(s.roll_number || '').toLowerCase()
      const query = searchQuery.trim().toLowerCase()

      return !query || fullName.includes(query) || studentNum.includes(query) || rollNum.includes(query)
    })
  }, [monthlyStudentsList, searchQuery])

  // Month navigation steppers
  const shiftMonth = (delta: number) => {
    const d = new Date(Number(year), Number(month) - 1 + delta, 1)
    setMonth(String(d.getMonth() + 1))
    setYear(String(d.getFullYear()))
  }

  const setCurrentMonth = () => {
    const now = new Date()
    setMonth(String(now.getMonth() + 1))
    setYear(String(now.getFullYear()))
  }

  // Calculate weighted class rates and totals for the selected month
  const classMonthlyStats = useMemo(() => {
    if (!monthlyData || filteredStudentsList.length === 0) {
      return { rate: 0, present: 0, absent: 0, late: 0, halfDay: 0 }
    }
    let totalMarks = 0
    let totalPresents = 0
    let totalAbsents = 0
    let totalLates = 0
    let totalHalfDays = 0

    filteredStudentsList.forEach((s) => {
      daysInfo.forEach((info) => {
        const status = monthlyData.attendance[s.student_id]?.[info.dateStr]?.status
        if (status) {
          totalMarks++
          if (status === 'present') totalPresents++
          else if (status === 'absent') totalAbsents++
          else if (status === 'late') totalLates++
          else if (status === 'half_day') totalHalfDays++
        }
      })
    })

    const effectiveAttended = totalPresents + totalLates + (0.5 * totalHalfDays)
    const rate = totalMarks > 0 ? Math.round((effectiveAttended / totalMarks) * 100) : 0

    return {
      rate,
      present: totalPresents,
      absent: totalAbsents,
      late: totalLates,
      halfDay: totalHalfDays,
    }
  }, [monthlyData, filteredStudentsList, daysInfo])

  const handleExportCSV = () => {
    if (!monthlyData || filteredStudentsList.length === 0) return

    let csv = 'Roll No,Name,Student Number,Class,Section,' +
      daysInfo.map((info) => `${month}/${info.day}`).join(',') +
      ',Present,Late,Absent,Half Day,Rate (%)\n'

    filteredStudentsList.forEach((s) => {
      const row = [
        s.roll_number || '',
        `${s.first_name} ${s.last_name}`,
        s.student_number || '',
        s.class_name || '',
        s.section_name || '',
      ]
      let present = 0, absent = 0, late = 0, halfDay = 0
      let totalLogged = 0

      daysInfo.forEach((info) => {
        const status = monthlyData.attendance[s.student_id]?.[info.dateStr]?.status
        row.push(status || '-')
        if (status) {
          totalLogged++
          if (status === 'present') present++
          else if (status === 'absent') absent++
          else if (status === 'late') late++
          else if (status === 'half_day') halfDay++
        }
      })

      const effective = present + late + (0.5 * halfDay)
      const studentRate = totalLogged > 0 ? Math.round((effective / totalLogged) * 100) : 0

      row.push(String(present), String(late), String(absent), String(halfDay), `${studentRate}%`)
      csv += row.map((val) => `"${val.replace(/"/g, '""')}"`).join(',') + '\n'
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `Student_Attendance_${unitLabelSingular}_${year}_${month}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'present': return __('Present', 'codeclove-school-management')
      case 'absent': return __('Absent', 'codeclove-school-management')
      case 'late': return __('Late', 'codeclove-school-management')
      case 'half_day': return __('Half Day', 'codeclove-school-management')
      case 'excused': return __('Excused', 'codeclove-school-management')
      case 'holiday': return __('Holiday', 'codeclove-school-management')
      default: return __('Not Marked', 'codeclove-school-management')
    }
  }

  return (
    <div className="space-y-3">
      {/* ── Minimal Toolbar ── */}
      <div className="p-3 bg-bg-surface border border-border rounded-xl shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Controls: Class, Section, Month Navigation */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Class */}
            <div className="w-full sm:w-44">
              <Select
                value={unitId}
                onValueChange={(val) => {
                  setUnitId(val)
                  setGroupId('')
                }}
                options={units.map((u) => ({ value: String(u.id), label: u.name }))}
                placeholder={sprintf(__('Select %s', 'codeclove-school-management'), unitLabelSingular)}
                disabled={!sessionId}
                className="h-9 text-xs"
              />
            </div>

            {/* Section */}
            <div className="w-full sm:w-36">
              <Select
                value={groupId}
                onValueChange={setGroupId}
                options={[
                  { value: '', label: __('All Sections', 'codeclove-school-management') },
                  ...groups.map((g) => ({ value: String(g.id), label: g.name })),
                ]}
                placeholder={__('All Sections', 'codeclove-school-management')}
                disabled={!unitId}
                className="h-9 text-xs"
              />
            </div>

            {/* Month & Year Stepper */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="h-9 w-8 flex items-center justify-center rounded-lg border border-border bg-bg-surface hover:bg-bg-subtle text-text-subtle hover:text-text transition-colors shrink-0"
                title={__('Previous Month', 'codeclove-school-management')}
                aria-label={__('Previous Month', 'codeclove-school-management')}
              >
                <ChevronLeft size={14} />
              </button>

              <Select
                value={month}
                onValueChange={setMonth}
                options={monthsList}
                className="h-9 w-32 sm:w-34 text-xs"
              />

              <Select
                value={year}
                onValueChange={setYear}
                options={yearsList}
                className="h-9 w-20 sm:w-22 text-xs"
              />

              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="h-9 w-8 flex items-center justify-center rounded-lg border border-border bg-bg-surface hover:bg-bg-subtle text-text-subtle hover:text-text transition-colors shrink-0"
                title={__('Next Month', 'codeclove-school-management')}
                aria-label={__('Next Month', 'codeclove-school-management')}
              >
                <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={setCurrentMonth}
                className="h-9 px-2 text-2xs font-semibold rounded-lg border border-border bg-bg-surface hover:bg-bg-subtle text-text-subtle hover:text-text transition-colors shrink-0"
                title={__('Jump to Current Month', 'codeclove-school-management')}
              >
                {__('Today', 'codeclove-school-management')}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="w-full sm:w-52 relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={__('Search student...', 'codeclove-school-management')}
              disabled={!unitId || isMonthlyLoading}
              className="pl-8 h-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text"
                title={__('Clear search', 'codeclove-school-management')}
              >
                <FilterX size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {unitId ? (
        <Card className="border-border shadow-xs overflow-hidden">
          <CardContent className="p-0">
            {isMonthlyLoading ? (
              <TableRoot>
                <Tbody>
                  <TableSkeleton columns={8} rows={6} />
                </Tbody>
              </TableRoot>
            ) : isMonthlyError ? (
              <div className="p-12 text-center text-sm text-danger flex items-center justify-center gap-2">
                <AlertCircle size={18} />
                {__('Failed to load monthly attendance report.', 'codeclove-school-management')}
              </div>
            ) : monthlyStudentsList.length > 0 ? (
              <div className="space-y-0">
                {/* ── Integrated Sleek KPI & Action Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-5 py-2.5 bg-bg-surface border-b border-border gap-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-subtle text-text font-semibold text-2xs">
                      <Users size={12} className="text-text-subtle" />
                      {searchQuery
                        ? sprintf(__('%1$d of %2$d Students', 'codeclove-school-management'), filteredStudentsList.length, monthlyStudentsList.length)
                        : sprintf(__('%d Students', 'codeclove-school-management'), monthlyStudentsList.length)}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold text-2xs">
                      <Check size={11} className="stroke-[2.5]" />
                      {sprintf(__('Present: %d', 'codeclove-school-management'), classMonthlyStats.present)}
                      {classMonthlyStats.late > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-normal">
                          (+{classMonthlyStats.late}L)
                        </span>
                      )}
                    </span>

                    {classMonthlyStats.absent > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold text-2xs">
                        <X size={11} className="stroke-[2.5]" />
                        {sprintf(__('Absent: %d', 'codeclove-school-management'), classMonthlyStats.absent)}
                      </span>
                    )}

                    {classMonthlyStats.halfDay > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-700 dark:text-orange-400 font-semibold text-2xs">
                        <Sun size={11} />
                        {sprintf(__('Half Day: %d', 'codeclove-school-management'), classMonthlyStats.halfDay)}
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-400 font-bold text-2xs">
                      <Clock size={11} />
                      {sprintf(__('Class Rate: %d%%', 'codeclove-school-management'), classMonthlyStats.rate)}
                    </span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 h-8 px-3 text-2xs font-semibold self-start sm:self-auto shrink-0"
                    onClick={handleExportCSV}
                    disabled={filteredStudentsList.length === 0}
                  >
                    <Download size={12} />
                    {__('Export CSV', 'codeclove-school-management')}
                  </Button>
                </div>

                {/* Mobile scroll hint */}
                <div className="flex sm:hidden items-center justify-between px-3 py-1.5 bg-bg-subtle/50 border-b border-border text-3xs text-text-subtle font-medium">
                  <span>← {__('Swipe to view all dates', 'codeclove-school-management')} →</span>
                  <span className="text-text-muted">{sprintf(__('%d days', 'codeclove-school-management'), monthlyDaysCount)}</span>
                </div>

                {/* ── Attendance Matrix Heatmap Table ── */}
                <div className="overflow-x-auto w-full touch-pan-x overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="w-full text-left border-collapse min-w-[780px] sm:min-w-[860px]">
                    <thead>
                      <tr className="bg-bg-subtle/50 border-b border-border text-2xs font-semibold text-text-muted">
                        {/* Student column */}
                        <th className="py-2.5 px-3 sm:px-4 sm:sticky sm:left-0 z-10 sm:z-30 bg-bg-surface border-r border-border min-w-[120px] sm:min-w-[220px] sm:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)] uppercase tracking-wider text-left">
                          <span className="text-2xs font-semibold text-text-muted">{__('Student', 'codeclove-school-management')}</span>
                        </th>
                        {/* Calendar Day Columns */}
                        {daysInfo.map((info) => (
                          <th
                            key={info.day}
                            className={`p-0.5 sm:p-1 text-center text-2xs font-mono w-[28px] sm:w-[32px] min-w-[28px] sm:min-w-[32px] max-w-[28px] sm:max-w-[32px] ${
                              info.isMonday ? 'border-l border-border/80' : ''
                            } ${info.isWeekend ? 'bg-bg-subtle/40 text-text-subtle/60' : 'text-text'}`}
                          >
                            <div className="flex flex-col items-center">
                              <span className="font-bold leading-none">{info.day}</span>
                              <span className="text-3xs text-text-subtle font-normal mt-0.5 leading-none">
                                {info.weekdayLetter}
                              </span>
                            </div>
                          </th>
                        ))}

                        {/* Trailing Summary totals */}
                        <th className="py-2.5 px-2 text-center border-l-2 border-border/80 w-[40px] text-emerald-700 dark:text-emerald-400 font-bold tabular-nums" title={__('Present Count', 'codeclove-school-management')}>
                          P
                        </th>
                        <th className="py-2.5 px-2 text-center border-l border-border/40 w-[40px] text-amber-700 dark:text-amber-400 font-bold tabular-nums" title={__('Late Count', 'codeclove-school-management')}>
                          L
                        </th>
                        <th className="py-2.5 px-2 text-center border-l border-border/40 w-[40px] text-rose-700 dark:text-rose-400 font-bold tabular-nums" title={__('Absent Count', 'codeclove-school-management')}>
                          A
                        </th>
                        <th className="py-2.5 px-2.5 text-center border-l border-border w-[56px] text-text font-bold tabular-nums" title={__('Attendance Rate', 'codeclove-school-management')}>
                          %
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border/25 text-xs">
                      {filteredStudentsList.length > 0 ? (
                        filteredStudentsList.map((s) => {
                          let pCount = 0
                          let aCount = 0
                          let lCount = 0
                          let hCount = 0
                          let totalDaysLogged = 0

                          const studentName = `${s.first_name} ${s.last_name}`
                          const rollText = sprintf(__('Roll: %s', 'codeclove-school-management'), s.roll_number || __('N/A', 'codeclove-school-management'))
                          const subtitleText =
                            !groupId && s.section_name
                              ? `${s.section_name} • ${rollText}`
                              : rollText

                          return (
                            <tr key={s.student_id} className="hover:bg-bg-overlay/5 transition-colors">
                              {/* Student Profile Cell */}
                              <td className="py-2 px-3 sm:px-4 sm:sticky sm:left-0 z-0 sm:z-10 bg-bg-surface border-r border-border min-w-[120px] sm:min-w-[220px] sm:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)]">
                                <div className="block sm:hidden leading-snug">
                                  <p className="font-semibold text-xs text-text truncate max-w-[120px]" title={studentName}>
                                    {studentName}
                                  </p>
                                  <p className="text-3xs text-text-subtle font-mono mt-0.5 font-medium">
                                    {sprintf(__('Roll: %s', 'codeclove-school-management'), s.roll_number || '—')}
                                  </p>
                                </div>
                                <div className="hidden sm:block">
                                  <PersonAvatar
                                    name={studentName}
                                    subtitle={subtitleText}
                                    idNumber={s.student_number || undefined}
                                  />
                                </div>
                              </td>

                              {/* Day Status Cells */}
                              {daysInfo.map((info) => {
                                const record = monthlyData?.attendance?.[s.student_id]?.[info.dateStr]
                                const status = record?.status
                                const note = record?.note

                                if (status === 'present') {
                                  pCount++
                                  totalDaysLogged++
                                } else if (status === 'absent') {
                                  aCount++
                                  totalDaysLogged++
                                } else if (status === 'late') {
                                  lCount++
                                  totalDaysLogged++
                                } else if (status === 'half_day') {
                                  hCount++
                                  totalDaysLogged++
                                } else if (status === 'excused') {
                                  totalDaysLogged++
                                }

                                const badge = status ? STATUS_BADGE_CONFIG[status] : null
                                const cellContent = badge ? (
                                  <span className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center font-mono font-bold text-3xs sm:text-xs rounded-md ${badge.className}`}>
                                    {badge.label}
                                  </span>
                                ) : info.isWeekend ? null : (
                                  <span className="text-text-subtle/30 font-light text-xs select-none">
                                    —
                                  </span>
                                )

                                const cellTitle = status
                                  ? `${month}/${info.day}/${year}: ${getStatusLabel(status)}${note ? ` — "${note}"` : ''}`
                                  : info.isWeekend
                                  ? `${month}/${info.day}/${year} (${__('Weekend', 'codeclove-school-management')})`
                                  : `${month}/${info.day}/${year} (${__('Not Marked', 'codeclove-school-management')})`

                                return (
                                  <td
                                    key={info.day}
                                    className={`p-0.5 sm:p-1 text-center w-[28px] sm:w-[32px] min-w-[28px] sm:min-w-[32px] max-w-[28px] sm:max-w-[32px] ${
                                      info.isMonday ? 'border-l border-border/80' : ''
                                    } ${info.isWeekend ? 'bg-bg-subtle/30' : ''}`}
                                    title={cellTitle}
                                  >
                                    <div className="flex items-center justify-center h-7 sm:h-8">
                                      {cellContent}
                                    </div>
                                  </td>
                                )
                              })}

                              {/* Student Summary Counts */}
                              <td className="py-2 px-1 text-center border-l-2 border-border/80 font-bold text-emerald-700 dark:text-emerald-400 tabular-nums text-xs">
                                {pCount || '—'}
                              </td>
                              <td className="py-2 px-1 text-center border-l border-border/40 font-semibold text-amber-700 dark:text-amber-400 tabular-nums text-xs">
                                {lCount || '—'}
                              </td>
                              <td className="py-2 px-1 text-center border-l border-border/40 font-bold text-rose-700 dark:text-rose-400 tabular-nums text-xs">
                                {aCount || '—'}
                              </td>
                              <td className="py-2 px-2 text-center border-l border-border tabular-nums text-2xs font-semibold">
                                {totalDaysLogged > 0 ? (
                                  (() => {
                                    const studentRate = Math.round(((pCount + lCount + 0.5 * hCount) / totalDaysLogged) * 100)
                                    const rateBadgeClass =
                                      studentRate >= 85
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                        : studentRate >= 75
                                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'

                                    return (
                                      <span className={`inline-block px-1.5 py-0.5 rounded-md font-bold ${rateBadgeClass}`}>
                                        {studentRate}%
                                      </span>
                                    )
                                  })()
                                ) : (
                                  <span className="text-text-subtle/40">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={daysInfo.length + 5} className="py-12 text-center text-xs text-text-muted">
                            {__('No students match the search query.', 'codeclove-school-management')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── Status Legend & Roster Meta Footer ── */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-2.5 bg-bg-surface/60 border-t border-border text-2xs text-text-muted">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-5 h-5 flex items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-2xs font-mono border border-emerald-500/20">P</span>
                      {__('Present', 'codeclove-school-management')}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-5 h-5 flex items-center justify-center rounded-md bg-amber-500 text-white font-bold text-2xs font-mono shadow-xs">L</span>
                      {__('Late', 'codeclove-school-management')}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-5 h-5 flex items-center justify-center rounded-md bg-rose-600 text-white font-bold text-2xs font-mono shadow-xs">A</span>
                      {__('Absent', 'codeclove-school-management')}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-5 h-5 flex items-center justify-center rounded-md bg-orange-500 text-white font-bold text-2xs font-mono shadow-xs">H</span>
                      {__('Half Day', 'codeclove-school-management')}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-5 h-5 flex items-center justify-center rounded-md bg-sky-500 text-white font-bold text-2xs font-mono shadow-xs">E</span>
                      {__('Excused', 'codeclove-school-management')}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-2xs font-mono">Hl</span>
                      {__('Holiday', 'codeclove-school-management')}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-text-subtle">
                      <span className="w-5 h-5 rounded-md bg-bg-subtle/50 border border-border/40 inline-block" />
                      {__('Weekend', 'codeclove-school-management')}
                    </span>
                  </div>

                  <span className="text-3xs text-text-subtle">
                    {sprintf(__('Showing %1$d of %2$d students', 'codeclove-school-management'), filteredStudentsList.length, monthlyStudentsList.length)}
                  </span>
                </div>
              </div>
            ) : (
              <TableRoot>
                <Tbody>
                  <TableEmpty colSpan={6} message={__('No students enrolled in this class.', 'codeclove-school-management')} />
                </Tbody>
              </TableRoot>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          variant="dashed"
          icon={CalendarDays}
          title={__('Select Class Context', 'codeclove-school-management')}
          description={__(
            'Select a class and month above to load the student attendance matrix and monthly overview report.',
            'codeclove-school-management'
          )}
        />
      )}
    </div>
  )
}
