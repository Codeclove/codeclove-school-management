import { useState, useMemo } from 'react'
import {
  Clock, Download, Search, FilterX, Users, ChevronLeft, ChevronRight,
  Check, X, Sun, CalendarMinus, AlertCircle
} from 'lucide-react'
import { useMonthlyStaffAttendance } from '@/api/attendance'
import { useLabels } from '@/lib/labels'
import { __, sprintf } from '@/lib/i18n'
import {
  Button, Card, CardContent, Select, Input, PersonAvatar,
  TableRoot, Tbody, TableEmpty, TableSkeleton, Tooltip, TooltipProvider
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
  late: { label: 'L', className: 'bg-amber-400 text-amber-950 font-bold shadow-xs' },
  half_day: { label: 'H', className: 'bg-orange-400 text-orange-950 font-bold shadow-xs' },
  on_leave: { label: 'O', className: 'bg-purple-600 text-white shadow-xs' },
  excused: { label: 'E', className: 'bg-sky-600 text-white shadow-xs' },
  holiday: { label: 'Hl', className: 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold' },
}

export default function StaffMonthlyAttendance() {
  const { getLabel } = useLabels()
  const staffLabelSingular = getLabel('staff_member', false, __('Staff', 'codeclove-school-management'))

  // Filter States
  const [departmentFilter, setDepartmentFilter] = useState<string>('')
  const [designationFilter, setDesignationFilter] = useState<string>('')
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1))
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Monthly Matrix query
  const { data: monthlyData, isLoading: isMonthlyLoading, isError: isMonthlyError } = useMonthlyStaffAttendance(
    Number(year),
    Number(month)
  )

  // Monthly statistics raw list
  const monthlyStaffList = useMemo(() => monthlyData?.staff ?? [], [monthlyData])
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

  // Extract unique departments & designations
  const departmentsList = useMemo(() => [...new Set(monthlyStaffList.map((s) => s.department).filter(Boolean))].sort() as string[], [monthlyStaffList])
  const designationsList = useMemo(() => [...new Set(monthlyStaffList.map((s) => s.designation).filter(Boolean))].sort() as string[], [monthlyStaffList])

  // Instant client-side filtered staff list
  const filteredStaffList = useMemo(() => {
    return monthlyStaffList.filter((s) => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
      const staffNum = (s.staff_number || '').toLowerCase()
      const query = searchQuery.trim().toLowerCase()

      const matchesSearch = !query || fullName.includes(query) || staffNum.includes(query)
      const matchesDept = !departmentFilter || s.department === departmentFilter
      const matchesDesig = !designationFilter || s.designation === designationFilter

      return matchesSearch && matchesDept && matchesDesig
    })
  }, [monthlyStaffList, searchQuery, departmentFilter, designationFilter])

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

  // Calculate monthly stats across filtered staff
  const staffMonthlyStats = useMemo(() => {
    if (!monthlyData || filteredStaffList.length === 0) {
      return { totalMarks: 0, present: 0, late: 0, absent: 0, halfDay: 0, leave: 0, rate: 0 }
    }

    let totalMarks = 0
    let present = 0
    let late = 0
    let absent = 0
    let halfDay = 0
    let leave = 0

    filteredStaffList.forEach((s) => {
      daysInfo.forEach((info) => {
        const record = monthlyData.attendance[s.staff_member_id]?.[info.dateStr]
        const st = record?.status
        if (st) {
          totalMarks++
          if (st === 'present') present++
          else if (st === 'late') late++
          else if (st === 'absent') absent++
          else if (st === 'half_day') halfDay++
          else if (st === 'on_leave' || st === 'excused') leave++
        }
      })
    })

    const effective = present + late + 0.5 * halfDay
    const rate = totalMarks > 0 ? Math.round((effective / totalMarks) * 100) : 0

    return { totalMarks, present, late, absent, halfDay, leave, rate }
  }, [monthlyData, filteredStaffList, daysInfo])

  const handleExportCSV = () => {
    if (!monthlyData || filteredStaffList.length === 0) return

    let csv =
      'Staff ID,Name,Department,Designation,' +
      daysInfo.map((info) => `${month}/${info.day}`).join(',') +
      ',Present,Late,Absent,Half Day,On Leave,Rate (%)\n'

    filteredStaffList.forEach((s) => {
      const row = [
        s.staff_number || '',
        `${s.first_name} ${s.last_name}`,
        s.department || '',
        s.designation || '',
      ]
      let pCount = 0,
        lCount = 0,
        aCount = 0,
        hCount = 0,
        oCount = 0
      let totalLogged = 0

      daysInfo.forEach((info) => {
        const status = monthlyData.attendance[s.staff_member_id]?.[info.dateStr]?.status
        row.push(status || '-')
        if (status) {
          totalLogged++
          if (status === 'present') pCount++
          else if (status === 'late') lCount++
          else if (status === 'absent') aCount++
          else if (status === 'half_day') hCount++
          else if (status === 'on_leave' || status === 'excused') oCount++
        }
      })

      const effective = pCount + lCount + 0.5 * hCount
      const staffRate = totalLogged > 0 ? Math.round((effective / totalLogged) * 100) : 0

      row.push(String(pCount), String(lCount), String(aCount), String(hCount), String(oCount), `${staffRate}%`)
      csv += row.map((val) => `"${val.replace(/"/g, '""')}"`).join(',') + '\n'
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `Staff_Attendance_${year}_${month}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusLabel = (status?: string) => {
    const labels: Record<string, string> = {
      present: __('Present', 'codeclove-school-management'),
      absent: __('Absent', 'codeclove-school-management'),
      late: __('Late', 'codeclove-school-management'),
      half_day: __('Half Day', 'codeclove-school-management'),
      on_leave: __('On Leave', 'codeclove-school-management'),
      excused: __('Excused', 'codeclove-school-management'),
      holiday: __('Holiday', 'codeclove-school-management'),
    }
    return (status && labels[status]) || __('Not Marked', 'codeclove-school-management')
  }

  return (
    <div className="space-y-3">
      {/* ── Tier 1: Toolbar ── */}
      <div className="p-3 bg-bg-elevated border border-border rounded-xl shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Controls: Department, Role, Month Navigation */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Department */}
            <div className="w-full sm:w-44">
              <Select
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
                options={[
                  { value: '', label: __('All Departments', 'codeclove-school-management') },
                  ...departmentsList.map((d) => ({ value: d, label: d })),
                ]}
                placeholder={__('All Departments', 'codeclove-school-management')}
                disabled={isMonthlyLoading}
                className="h-9 text-xs"
              />
            </div>

            {/* Designation / Role */}
            <div className="w-full sm:w-36">
              <Select
                value={designationFilter}
                onValueChange={setDesignationFilter}
                options={[
                  { value: '', label: __('All Roles', 'codeclove-school-management') },
                  ...designationsList.map((d) => ({ value: d, label: d })),
                ]}
                placeholder={__('All Roles', 'codeclove-school-management')}
                disabled={isMonthlyLoading}
                className="h-9 text-xs"
              />
            </div>

            {/* Month & Year Steppers */}
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="h-9 w-8 flex items-center justify-center rounded-lg border border-border bg-bg-surface hover:bg-hover-bg text-text-subtle hover:text-text transition-colors shrink-0"
                title={__('Previous Month', 'codeclove-school-management')}
                aria-label={__('Previous Month', 'codeclove-school-management')}
              >
                <ChevronLeft size={14} />
              </button>

              <div className="w-32 min-w-0">
                <Select
                  value={month}
                  onValueChange={setMonth}
                  options={monthsList}
                  className="h-9 text-xs"
                />
              </div>

              <div className="w-24 min-w-0">
                <Select
                  value={year}
                  onValueChange={setYear}
                  options={yearsList}
                  className="h-9 text-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="h-9 w-8 flex items-center justify-center rounded-lg border border-border bg-bg-surface hover:bg-hover-bg text-text-subtle hover:text-text transition-colors shrink-0"
                title={__('Next Month', 'codeclove-school-management')}
                aria-label={__('Next Month', 'codeclove-school-management')}
              >
                <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={setCurrentMonth}
                className="h-9 px-2.5 text-2xs font-semibold rounded-lg border border-border bg-bg-surface hover:bg-hover-bg text-text-subtle hover:text-text transition-colors shrink-0"
                title={__('Jump to Current Month', 'codeclove-school-management')}
              >
                {__('Current', 'codeclove-school-management')}
              </button>
            </div>
          </div>

          {/* Search Staff */}
          <div className="w-full sm:w-52 relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={__('Search staff...', 'codeclove-school-management')}
              disabled={isMonthlyLoading}
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

      {/* ── Tier 2 & Tier 3: Matrix Sheet Card ── */}
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
          ) : monthlyStaffList.length > 0 ? (
            <div className="space-y-0">
              {/* ── Integrated Sleek KPI & Action Bar ── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-5 py-2.5 bg-bg-surface border-b border-border gap-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-surface border border-border text-text font-semibold text-2xs">
                    <Users size={12} className="text-text-subtle" />
                    {searchQuery || departmentFilter || designationFilter
                      ? sprintf(__('%1$d of %2$d Staff', 'codeclove-school-management'), filteredStaffList.length, monthlyStaffList.length)
                      : sprintf(__('%d Staff', 'codeclove-school-management'), monthlyStaffList.length)}
                  </span>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold text-2xs">
                    <Check size={11} className="stroke-[2.5]" />
                    {sprintf(__('Present: %d', 'codeclove-school-management'), staffMonthlyStats.present)}
                    {staffMonthlyStats.late > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-normal">
                        (+{staffMonthlyStats.late}L)
                      </span>
                    )}
                  </span>

                  {staffMonthlyStats.absent > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold text-2xs">
                      <X size={11} className="stroke-[2.5]" />
                      {sprintf(__('Absent: %d', 'codeclove-school-management'), staffMonthlyStats.absent)}
                    </span>
                  )}

                  {staffMonthlyStats.halfDay > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-700 dark:text-orange-400 font-semibold text-2xs">
                      <Sun size={11} />
                      {sprintf(__('Half Day: %d', 'codeclove-school-management'), staffMonthlyStats.halfDay)}
                    </span>
                  )}

                  {staffMonthlyStats.leave > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-400 font-semibold text-2xs">
                      <CalendarMinus size={11} />
                      {sprintf(__('Leave: %d', 'codeclove-school-management'), staffMonthlyStats.leave)}
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-400 font-bold text-2xs">
                    <Clock size={11} />
                    {sprintf(__('Staff Rate: %d%%', 'codeclove-school-management'), staffMonthlyStats.rate)}
                  </span>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 h-8 px-3 text-2xs font-semibold self-start sm:self-auto shrink-0"
                  onClick={handleExportCSV}
                  disabled={filteredStaffList.length === 0}
                >
                  <Download size={12} />
                  {__('Export CSV', 'codeclove-school-management')}
                </Button>
              </div>

              {/* Mobile scroll hint */}
              <div className="flex sm:hidden items-center justify-between px-3 py-1.5 bg-bg-surface border-b border-border text-3xs text-text-subtle font-medium">
                <span>← {__('Swipe to view all dates', 'codeclove-school-management')} →</span>
                <span className="text-text-muted">{sprintf(__('%d days', 'codeclove-school-management'), monthlyDaysCount)}</span>
              </div>

              {/* ── Attendance Matrix Heatmap Table ── */}
              <TooltipProvider>
                <div className="overflow-x-auto w-full touch-pan-x overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="w-full text-left border-collapse min-w-[780px] sm:min-w-[860px]">
                    <thead>
                      <tr className="bg-bg-surface border-b border-border text-2xs font-semibold text-text-muted">
                        {/* Staff Member column */}
                        <th className="py-2.5 px-3 sm:px-4 sm:sticky sm:left-0 z-10 sm:z-30 bg-bg-surface border-r border-border min-w-[140px] sm:min-w-[220px] sm:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)] uppercase tracking-wider text-left">
                          <span className="text-2xs font-semibold text-text-muted">{__('Staff Member', 'codeclove-school-management')}</span>
                        </th>

                        {/* Calendar Day Columns */}
                        {daysInfo.map((info) => (
                          <th
                            key={info.day}
                            className={`p-0.5 sm:p-1 text-center text-2xs font-mono w-[28px] sm:w-[32px] min-w-[28px] sm:min-w-[32px] max-w-[28px] sm:max-w-[32px] ${
                              info.isMonday ? 'border-l border-border/80' : ''
                            } ${info.isWeekend ? 'bg-black/[0.03] dark:bg-white/[0.04] text-text-subtle/60' : 'text-text'}`}
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
                        <th className="py-2.5 px-2 text-center border-l border-border/40 w-[40px] text-orange-700 dark:text-orange-400 font-bold tabular-nums" title={__('Half Day Count', 'codeclove-school-management')}>
                          H
                        </th>
                        <th className="py-2.5 px-2 text-center border-l border-border/40 w-[40px] text-purple-700 dark:text-purple-400 font-bold tabular-nums" title={__('On Leave Count', 'codeclove-school-management')}>
                          O
                        </th>
                        <th className="py-2.5 px-2 text-center border-l-2 border-border/80 w-[48px] text-sky-700 dark:text-sky-400 font-bold tabular-nums" title={__('Attendance Rate', 'codeclove-school-management')}>
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/25 text-xs">
                      {filteredStaffList.length > 0 ? (
                        filteredStaffList.map((s) => {
                          let pCount = 0,
                            lCount = 0,
                            aCount = 0,
                            hCount = 0,
                            oCount = 0
                          let totalLogged = 0

                          return (
                            <tr key={s.staff_member_id} className="hover:bg-hover-bg transition-colors">
                              {/* Sticky Staff Info */}
                              <td className="py-2 px-3 sm:px-4 sm:sticky sm:left-0 z-10 sm:z-20 bg-bg-surface border-r border-border min-w-[140px] sm:min-w-[220px] sm:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)]">
                                <PersonAvatar
                                  name={`${s.first_name} ${s.last_name}`}
                                  subtitle={`${s.designation || staffLabelSingular}${s.department ? ` • ${s.department}` : ''}`}
                                  idNumber={s.staff_number || undefined}
                                  className="min-w-0"
                                />
                              </td>

                              {/* Matrix Day Cells */}
                              {daysInfo.map((info) => {
                                const record = monthlyData?.attendance?.[s.staff_member_id]?.[info.dateStr]
                                const status = record?.status
                                const note = record?.note

                                if (status) {
                                  totalLogged++
                                  if (status === 'present') pCount++
                                  else if (status === 'late') lCount++
                                  else if (status === 'absent') aCount++
                                  else if (status === 'half_day') hCount++
                                  else if (status === 'on_leave' || status === 'excused') oCount++
                                }

                                const badge = status ? STATUS_BADGE_CONFIG[status] : undefined

                                const tooltipContent = (
                                  <div className="space-y-1 p-1 text-left">
                                    <p className="font-bold text-xs">{month}/{info.day}/{year}</p>
                                    <p className="capitalize text-xs">
                                      {__('Status:', 'codeclove-school-management')}{' '}
                                      <span className="font-semibold text-brand">{getStatusLabel(status)}</span>
                                    </p>
                                    {note && <p className="italic text-text-subtle text-xs mt-0.5">"{note}"</p>}
                                  </div>
                                )

                                return (
                                  <td
                                    key={info.day}
                                    className={`p-0.5 sm:p-1 text-center w-[28px] sm:w-[32px] min-w-[28px] sm:min-w-[32px] max-w-[28px] sm:max-w-[32px] ${
                                      info.isMonday ? 'border-l border-border/80' : ''
                                    } ${info.isWeekend ? 'bg-black/[0.03] dark:bg-white/[0.04]' : ''}`}
                                  >
                                    <Tooltip content={tooltipContent} delay={100}>
                                      <div className="flex items-center justify-center h-7 sm:h-8">
                                        {badge ? (
                                          <span
                                            className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-md text-3xs sm:text-2xs font-bold font-mono transition-transform hover:scale-110 cursor-default select-none ${badge.className}`}
                                          >
                                            {badge.label}
                                          </span>
                                        ) : (
                                          <span className="text-border/80 text-xs select-none">·</span>
                                        )}
                                      </div>
                                    </Tooltip>
                                  </td>
                                )
                              })}

                              {/* Trailing Total Counts */}
                              <td className="py-2 px-2 text-center border-l-2 border-border/80 font-mono font-semibold text-2xs text-emerald-700 dark:text-emerald-400 tabular-nums">
                                {pCount}
                              </td>
                              <td className="py-2 px-2 text-center border-l border-border/40 font-mono font-semibold text-2xs text-amber-700 dark:text-amber-400 tabular-nums">
                                {lCount}
                              </td>
                              <td className="py-2 px-2 text-center border-l border-border/40 font-mono font-semibold text-2xs text-rose-700 dark:text-rose-400 tabular-nums">
                                {aCount}
                              </td>
                              <td className="py-2 px-2 text-center border-l border-border/40 font-mono font-semibold text-2xs text-orange-700 dark:text-orange-400 tabular-nums">
                                {hCount}
                              </td>
                              <td className="py-2 px-2 text-center border-l border-border/40 font-mono font-semibold text-2xs text-purple-700 dark:text-purple-400 tabular-nums">
                                {oCount}
                              </td>
                              <td className="py-2 px-2 text-center border-l-2 border-border/80 font-mono font-bold text-2xs text-sky-700 dark:text-sky-400 tabular-nums">
                                {totalLogged > 0
                                  ? `${Math.round(((pCount + lCount + 0.5 * hCount) / totalLogged) * 100)}%`
                                  : '—'}
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={daysInfo.length + 7} className="py-12 text-center text-xs text-text-muted">
                            {__('No staff members match the selected search or filters.', 'codeclove-school-management')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TooltipProvider>

              {/* ── Status Legend & Meta Footer ── */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-2.5 bg-bg-surface/60 border-t border-border text-2xs text-text-muted">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-5 h-5 flex items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-2xs font-mono border border-emerald-500/20">
                      P
                    </span>
                    {__('Present', 'codeclove-school-management')}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-5 h-5 flex items-center justify-center rounded-md bg-amber-400 text-amber-950 font-bold text-2xs font-mono shadow-xs">
                      L
                    </span>
                    {__('Late', 'codeclove-school-management')}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-5 h-5 flex items-center justify-center rounded-md bg-rose-600 text-white font-bold text-2xs font-mono shadow-xs">
                      A
                    </span>
                    {__('Absent', 'codeclove-school-management')}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-5 h-5 flex items-center justify-center rounded-md bg-orange-400 text-orange-950 font-bold text-2xs font-mono shadow-xs">
                      H
                    </span>
                    {__('Half Day', 'codeclove-school-management')}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-5 h-5 flex items-center justify-center rounded-md bg-purple-600 text-white font-bold text-2xs font-mono shadow-xs">
                      O
                    </span>
                    {__('On Leave', 'codeclove-school-management')}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-5 h-5 flex items-center justify-center rounded-md bg-sky-600 text-white font-bold text-2xs font-mono shadow-xs">
                      E
                    </span>
                    {__('Excused', 'codeclove-school-management')}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-2xs font-mono">
                      Hl
                    </span>
                    {__('Holiday', 'codeclove-school-management')}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-text-subtle">
                    <span className="w-5 h-5 rounded-md bg-black/[0.03] dark:bg-white/[0.04] border border-border/40 inline-block" />
                    {__('Weekend', 'codeclove-school-management')}
                  </span>
                </div>

                <span className="text-3xs text-text-subtle">
                  {sprintf(__('Showing %1$d of %2$d staff members', 'codeclove-school-management'), filteredStaffList.length, monthlyStaffList.length)}
                </span>
              </div>
            </div>
          ) : (
            <TableRoot>
              <Tbody>
                <TableEmpty colSpan={6} message={__('No active staff members found in the directory.', 'codeclove-school-management')} />
              </Tbody>
            </TableRoot>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
