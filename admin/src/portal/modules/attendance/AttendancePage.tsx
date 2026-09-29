/**
 * Portal Attendance Page.
 *
 * Provides month selection, key attendance statistics, a monthly visual calendar grid,
 * and a filterable daily attendance log list with teacher notes using shared CodeClove design system primitives.
 */

import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  XCircle,
} from 'lucide-react'
import { __, sprintf } from '@/lib/i18n'
import { usePortal } from '../../lib/portal-context'
import { useAttendance } from '../../api/portal'
import { formatDate, getCleanLocale } from '../../lib/formatter'
import type { AttendanceRecord, AttendanceStatus } from '../../types'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
  TableRoot,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui'
const STATUS_LABELS: Record<string, string> = {
  present: __( 'Present', 'codeclove-school-management' ),
  absent: __( 'Absent', 'codeclove-school-management' ),
  late: __( 'Late', 'codeclove-school-management' ),
  half_day: __( 'Half Day', 'codeclove-school-management' ),
  excused: __( 'Excused', 'codeclove-school-management' ),
}

export const AttendancePage: React.FC = () => {
  const { currentStudent, localization } = usePortal()
  const weekStartDay = localization?.week_start_day ?? 1

  // Default to current month: YYYY-MM
  const [currentMonthStr, setCurrentMonthStr] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })

  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all')

  const { data: attendanceData, isLoading } = useAttendance(currentStudent?.id, currentMonthStr)

  const summary = attendanceData?.summary
  const records = attendanceData?.records ?? []

  // Handle previous/next month navigation
  const handleMonthChange = (offset: number) => {
    const parts = currentMonthStr.split('-')
    const year = parseInt(parts[0] ?? '2026', 10)
    const month = parseInt(parts[1] ?? '1', 10) - 1
    const nextDate = new Date(year, month + offset, 1)
    const nextY = nextDate.getFullYear()
    const nextM = String(nextDate.getMonth() + 1).padStart(2, '0')
    setCurrentMonthStr(`${nextY}-${nextM}`)
  }

  // Month title for display
  const monthDisplayTitle = useMemo(() => {
    const parts = currentMonthStr.split('-')
    const year = parseInt(parts[0] ?? '2026', 10)
    const month = parseInt(parts[1] ?? '1', 10) - 1
    return new Intl.DateTimeFormat(getCleanLocale(), { month: 'long', year: 'numeric' }).format(
      new Date(year, month, 1)
    )
  }, [currentMonthStr])

  const getStatusLabel = (status: string): string => STATUS_LABELS[status] || status.replace(/_/g, ' ')

  // Calendar days generation
  const calendarDays = useMemo(() => {
    const parts = currentMonthStr.split('-')
    const year = parseInt(parts[0] ?? '2026', 10)
    const month = parseInt(parts[1] ?? '1', 10) - 1

    const jsDay = new Date(year, month, 1).getDay() // 0 = Sun
    const firstDayIndex = weekStartDay === 0 ? jsDay : (jsDay + 6) % 7
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
    const recordsMap = new Map<number, AttendanceRecord>()
    for (const rec of records) {
      const dayNum = parseInt(rec.attendance_date.split('-')[2] ?? '0', 10)
      if (dayNum > 0) {
        recordsMap.set(dayNum, rec)
      }
    }

    const days: Array<{
      dayNumber: number | null
      dateStr: string
      record?: AttendanceRecord
    }> = []

    // Padding for starting day of week
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNumber: null, dateStr: '' })
    }

    // Days in current month
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0')
      const dateStr = `${currentMonthStr}-${dayStr}`
      days.push({
        dayNumber: day,
        dateStr,
        record: recordsMap.get(day),
      })
    }

    return days
  }, [currentMonthStr, records, weekStartDay])

  // Filtered daily log
  const filteredRecords = useMemo(() => {
    if (statusFilter === 'all') return records
    return records.filter((r) => r.status === statusFilter)
  }, [records, statusFilter])

  const percentage = summary?.percentage ?? 0
  const totalDays = summary?.total_days ?? summary?.total ?? 0
  const presentDays = summary?.present_days ?? summary?.present ?? 0
  const absentDays = summary?.absent_days ?? summary?.absent ?? 0
  const lateDays = summary?.late_days ?? summary?.late ?? 0

  const filterOptions: Array<{ id: 'all' | AttendanceStatus; label: string }> = [
    { id: 'all', label: __( 'All', 'codeclove-school-management' ) },
    { id: 'present', label: __( 'Present', 'codeclove-school-management' ) },
    { id: 'absent', label: __( 'Absent', 'codeclove-school-management' ) },
    { id: 'late', label: __( 'Late', 'codeclove-school-management' ) },
  ]

  const weekHeaders = weekStartDay === 0
    ? [
        __( 'Sun', 'codeclove-school-management' ),
        __( 'Mon', 'codeclove-school-management' ),
        __( 'Tue', 'codeclove-school-management' ),
        __( 'Wed', 'codeclove-school-management' ),
        __( 'Thu', 'codeclove-school-management' ),
        __( 'Fri', 'codeclove-school-management' ),
        __( 'Sat', 'codeclove-school-management' ),
      ]
    : [
        __( 'Mon', 'codeclove-school-management' ),
        __( 'Tue', 'codeclove-school-management' ),
        __( 'Wed', 'codeclove-school-management' ),
        __( 'Thu', 'codeclove-school-management' ),
        __( 'Fri', 'codeclove-school-management' ),
        __( 'Sat', 'codeclove-school-management' ),
        __( 'Sun', 'codeclove-school-management' ),
      ]

  return (
    <div className="space-y-6">
      {/* Header with Month Navigation */}
      <PageHeader
        title={__( 'Attendance Records', 'codeclove-school-management' )}
        description={__( 'Monthly attendance calendar and daily records', 'codeclove-school-management' )}
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-bg-surface p-1.5 shadow-card">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMonthChange(-1)}
              className="h-7 w-7 p-0 rounded-lg hover:bg-bg-base"
              aria-label={__( 'Previous month', 'codeclove-school-management' )}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="min-w-[130px] text-center text-xs font-semibold text-text">
              {monthDisplayTitle}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMonthChange(1)}
              className="h-7 w-7 p-0 rounded-lg hover:bg-bg-base"
              aria-label={__( 'Next month', 'codeclove-school-management' )}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Summary Stat Cards (Clean 4-Card Responsive Grid) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <StatCard
              className="rounded-xl border-border/80 bg-bg-surface shadow-card"
              label={__( 'Attendance Rate', 'codeclove-school-management' )}
              value={`${percentage.toFixed(1)}%`}
              icon={CalendarCheck}
              iconColor={percentage >= 75 ? 'text-success' : 'text-warning'}
              iconBg={percentage >= 75 ? 'bg-success-dim' : 'bg-warning-dim'}
              subtext={sprintf( __( '%1$d of %2$d school days', 'codeclove-school-management' ), presentDays, totalDays )}
            />
            <StatCard
              className="rounded-xl border-border/80 bg-bg-surface shadow-card"
              label={__( 'Present Days', 'codeclove-school-management' )}
              value={presentDays}
              icon={CheckCircle2}
              iconColor="text-success"
              iconBg="bg-success-dim"
              subtext={__( 'Attended sessions', 'codeclove-school-management' )}
            />
            <StatCard
              className="rounded-xl border-border/80 bg-bg-surface shadow-card"
              label={__( 'Absent Days', 'codeclove-school-management' )}
              value={absentDays}
              icon={XCircle}
              iconColor={absentDays > 0 ? 'text-danger' : 'text-text-muted'}
              iconBg={absentDays > 0 ? 'bg-danger-dim' : 'bg-brand-dim'}
              subtext={__( 'Recorded absences', 'codeclove-school-management' )}
            />
            <StatCard
              className="rounded-xl border-border/80 bg-bg-surface shadow-card"
              label={__( 'Late Arrivals', 'codeclove-school-management' )}
              value={lateDays}
              icon={AlertTriangle}
              iconColor={lateDays > 0 ? 'text-warning' : 'text-text-muted'}
              iconBg={lateDays > 0 ? 'bg-warning-dim' : 'bg-brand-dim'}
              subtext={__( 'Tardy arrivals', 'codeclove-school-management' )}
            />
          </div>

          {/* Monthly Calendar View */}
          <Card className="rounded-xl border border-border/80 shadow-card bg-bg-surface overflow-hidden">
            <CardHeader className="flex items-center gap-2 border-b border-border/60 pb-3">
              <CalendarIcon className="w-4 h-4 text-brand" />
              <h3 className="text-sm font-bold text-text">{__( 'Calendar Overview', 'codeclove-school-management' )}</h3>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              {/* Calendar grid container with clean borders */}
              <div className="rounded-xl border border-border/70 overflow-hidden bg-bg-surface shadow-2xs">
                {/* Day header */}
                <div className="grid grid-cols-7 text-center text-2xs font-bold text-text-muted uppercase tracking-wider py-2.5 bg-bg-base/60 border-b border-border/70">
                  {weekHeaders.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>

                {/* Grid cells */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((item, idx) => {
                    if (item.dayNumber === null) {
                      return (
                        <div
                          key={`empty-${idx}`}
                          className="min-h-[56px] sm:min-h-[64px] bg-bg-base/20 border-b border-r border-border/50"
                        />
                      )
                    }

                    const status = item.record?.status
                    let statusBg = 'bg-bg-surface hover:bg-bg-base/50'
                    let indicatorBg = 'bg-border-strong'

                    if (status === 'present') {
                      statusBg = 'bg-success/5 hover:bg-success/10'
                      indicatorBg = 'bg-success'
                    } else if (status === 'absent') {
                      statusBg = 'bg-danger/5 hover:bg-danger/10'
                      indicatorBg = 'bg-danger'
                    } else if (status === 'late') {
                       statusBg = 'bg-warning/5 hover:bg-warning/10'
                      indicatorBg = 'bg-warning'
                    } else if (status === 'half_day') {
                      statusBg = 'bg-info/5 hover:bg-info/10'
                      indicatorBg = 'bg-info'
                    }

                    return (
                      <div
                        key={item.dateStr}
                        className={`min-h-[56px] sm:min-h-[64px] border-b border-r border-border/50 p-2 flex flex-col justify-between transition-colors ${statusBg}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-text">
                            {item.dayNumber}
                          </span>
                          {status && (
                            <span
                              className={`w-2 h-2 rounded-full ${indicatorBg}`}
                              title={getStatusLabel(status)}
                            />
                          )}
                        </div>

                        <div className="hidden sm:block">
                          {status && (
                            <span className="text-3xs capitalize font-medium text-text-muted truncate block">
                              {getStatusLabel(status)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Attendance Log List */}
          <Card className="rounded-xl border border-border/70 overflow-hidden shadow-card bg-bg-surface">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3.5">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-bold text-text">{__( 'Daily Attendance Log', 'codeclove-school-management' )}</h3>
              </div>

              {/* Status Filter Tabs (Segmented Capsule Track) */}
              <div
                role="tablist"
                aria-label={__( 'Attendance status filters', 'codeclove-school-management' )}
                className="inline-flex items-center bg-bg-base/80 border border-border/80 rounded-xl p-1 gap-1 shadow-2xs"
              >
                {filterOptions.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === filter.id}
                    onClick={() => setStatusFilter(filter.id)}
                    className={`rounded-lg px-3 py-1.5 capitalize text-xs font-semibold transition-all cursor-pointer select-none outline-none ${
                      statusFilter === filter.id
                        ? 'bg-bg-surface text-brand font-bold shadow-xs'
                        : 'text-text-muted hover:text-text hover:bg-bg-surface/50'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </CardHeader>

            {filteredRecords.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={__( 'No attendance records', 'codeclove-school-management' )}
                description={__( 'No attendance records logged for this month or filter.', 'codeclove-school-management' )}
                className="py-10"
              />
            ) : (
              <TableRoot responsiveMode="scroll">
                <Thead className="border-b border-border/70 bg-bg-base/50">
                  <Tr className="border-b border-border/70">
                    <Th className="w-[180px] bg-bg-base/50 text-2xs uppercase tracking-wider font-semibold text-text-muted">{__( 'Date', 'codeclove-school-management' )}</Th>
                    <Th className="w-[140px] bg-bg-base/50 text-2xs uppercase tracking-wider font-semibold text-text-muted text-center">{__( 'Status', 'codeclove-school-management' )}</Th>
                    <Th className="bg-bg-base/50 text-2xs uppercase tracking-wider font-semibold text-text-muted">{__( 'Teacher / Class Note', 'codeclove-school-management' )}</Th>
                  </Tr>
                </Thead>
                <Tbody className="divide-y divide-border/60">
                  {filteredRecords.map((record, index) => (
                    <Tr key={`${record.attendance_date}-${index}`} className="hover:bg-bg-base/50 border-b border-border/60 last:border-b-0 transition-colors">
                      <Td className="font-medium text-text py-3">
                        {formatDate(record.attendance_date)}
                      </Td>
                      <Td className="py-3 text-center">
                        <Badge variant={record.status as AttendanceStatus} size="sm">
                          {getStatusLabel(record.status)}
                        </Badge>
                      </Td>
                      <Td className="text-text-muted py-3">
                        {record.note ? record.note : <span className="text-text-subtle/50">—</span>}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </TableRoot>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
