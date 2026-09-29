/**
 * Portal Weekly Schedule Matrix.
 *
 * Full-week grid view showing time/period rows on the left and days of the week as columns.
 * Highlights the current active period, displays teacher & room details,
 * and maintains horizontal responsiveness.
 */

import React, { useMemo } from 'react'
import { Clock, Coffee, DoorClosed, User } from 'lucide-react'
import { usePortal } from '../../../lib/portal-context'
import { formatTime } from '../../../lib/formatter'
import { formatRoomName, getBreakBetweenSlots, getSlotStatus, parseTimeToMinutes } from '../../../lib/schedule'
import type { TimetableData, TimetableSlot } from '../../../types'
import { Badge, Card, EmptyState } from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'

interface WeeklyScheduleMatrixProps {
  timetable?: TimetableData | null
  className?: string
}

interface MatrixDay {
  id: number
  label: string
  shortLabel: string
}

interface MatrixRow {
  id: string
  name: string
  startTime: string
  endTime: string
}

const getDefaultDays = (): MatrixDay[] => [
  { id: 1, label: __( 'Monday', 'codeclove-school-management' ), shortLabel: __( 'Mon', 'codeclove-school-management' ) },
  { id: 2, label: __( 'Tuesday', 'codeclove-school-management' ), shortLabel: __( 'Tue', 'codeclove-school-management' ) },
  { id: 3, label: __( 'Wednesday', 'codeclove-school-management' ), shortLabel: __( 'Wed', 'codeclove-school-management' ) },
  { id: 4, label: __( 'Thursday', 'codeclove-school-management' ), shortLabel: __( 'Thu', 'codeclove-school-management' ) },
  { id: 5, label: __( 'Friday', 'codeclove-school-management' ), shortLabel: __( 'Fri', 'codeclove-school-management' ) },
  { id: 6, label: __( 'Saturday', 'codeclove-school-management' ), shortLabel: __( 'Sat', 'codeclove-school-management' ) },
]

export const WeeklyScheduleMatrix: React.FC<WeeklyScheduleMatrixProps> = ({
  timetable,
  className = '',
}) => {
  const { localization } = usePortal()

  // Current day of week in ISO standard (1 = Mon ... 7 = Sun)
  const todayDayOfWeek = useMemo(() => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day
  }, [])

  // Build matrix days list based on localization week_start_day or presence of Sunday slots
  const daysList = useMemo<MatrixDay[]>(() => {
    const hasSundaySlots = Boolean(
      (timetable?.days?.[7] && timetable.days[7].length > 0) ||
      (timetable?.days?.['7'] && timetable.days['7'].length > 0)
    )
    const baseDays = getDefaultDays()

    if (localization?.week_start_day === 0 || hasSundaySlots) {
      return [
        { id: 7, label: __( 'Sunday', 'codeclove-school-management' ), shortLabel: __( 'Sun', 'codeclove-school-management' ) },
        ...baseDays,
      ]
    }
    return baseDays
  }, [timetable?.days, localization?.week_start_day])

  const daysData = timetable?.days || {}

  // Extract all distinct periods/time intervals across all days, sorted chronologically
  const periodRows = useMemo<MatrixRow[]>(() => {
    const periodMap = new Map<string, MatrixRow>()

    Object.values(daysData).forEach((slots) => {
      if (!Array.isArray(slots)) return
      slots.forEach((s) => {
        if (!s.start_time || !s.end_time) return
        const key = `${s.period_name || 'Period'}_${s.start_time}_${s.end_time}`
        if (!periodMap.has(key)) {
          periodMap.set(key, {
            id: key,
            name: s.period_name || __( 'Period', 'codeclove-school-management' ),
            startTime: s.start_time,
            endTime: s.end_time,
          })
        }
      })
    })

    return Array.from(periodMap.values()).sort(
      (a, b) => (parseTimeToMinutes(a.startTime) ?? 0) - (parseTimeToMinutes(b.startTime) ?? 0)
    )
  }, [daysData])

  // Helper to determine if a slot is currently in progress
  const isSlotLive = (dayId: number, slot: TimetableSlot): boolean =>
    dayId === todayDayOfWeek && getSlotStatus(slot.start_time, slot.end_time) === 'current'

  // Find slot for a specific day and period row
  const getSlot = (dayId: number, row: MatrixRow): TimetableSlot | undefined => {
    const slots = (daysData[dayId] ?? daysData[String(dayId)]) as TimetableSlot[] | undefined
    if (!slots?.length) return undefined
    const normRowStart = row.startTime?.substring(0, 5) ?? ''
    return slots.find((s) => {
      const normStart = s.start_time?.substring(0, 5) ?? ''
      return (s.period_name?.trim() === row.name && normStart === normRowStart) || normStart === normRowStart
    })
  }

  if (periodRows.length === 0) {
    return (
      <Card className="rounded-xl border border-border/80 shadow-card bg-bg-surface">
        <EmptyState
          icon={Clock}
          title={__( 'No weekly schedule available', 'codeclove-school-management' )}
          description={__( 'There are no scheduled class periods assigned for this timetable.', 'codeclove-school-management' )}
          className="py-14"
        />
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Horizontally scrollable matrix container */}
      <div className="w-full overflow-x-auto rounded-2xl border border-border/80 bg-bg-surface shadow-card">
        <div className="min-w-[860px]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-bg-base/40 border-b border-border/80">
                {/* Time header column */}
                <th
                  scope="col"
                  className="w-36 p-3.5 text-left text-xs font-bold text-text-subtle uppercase tracking-wider border-r border-border/60"
                >
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand" />
                    <span>{__( 'Time / Period', 'codeclove-school-management' )}</span>
                  </div>
                </th>

                {/* Day header columns */}
                {daysList.map((day) => {
                  const isToday = day.id === todayDayOfWeek
                  return (
                    <th
                      key={day.id}
                      scope="col"
                      className={`p-3 text-center text-xs font-bold border-r border-border/60 last:border-r-0 transition-colors ${
                        isToday ? 'bg-brand-dim/30 text-brand' : 'text-text'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="font-bold">{day.label}</span>
                        {isToday && (
                          <Badge variant="brand" size="sm" className="text-3xs font-semibold px-2 py-0.5 gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                            {__( 'Today', 'codeclove-school-management' )}
                          </Badge>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-border/60">
              {periodRows.map((row, rowIdx) => {
                const nextRow = periodRows[rowIdx + 1]
                const gap = nextRow ? getBreakBetweenSlots(row.endTime, nextRow.startTime) : null

                return (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-bg-base/20 transition-colors">
                      {/* Period row timing header */}
                      <th
                        scope="row"
                        className="w-36 p-3.5 border-r border-border/60 bg-bg-base/25 text-left align-top"
                      >
                        <div className="font-bold text-xs text-text">{row.name}</div>
                        <div className="text-3xs font-semibold text-text-muted mt-1 tabular-nums whitespace-nowrap">
                          {formatTime(row.startTime)} – {formatTime(row.endTime)}
                        </div>
                      </th>

                      {/* Day slot cards */}
                      {daysList.map((day) => {
                        const slot = getSlot(day.id, row)
                        if (!slot) {
                          return (
                            <td
                              key={day.id}
                              className="p-2 border-r border-border/60 last:border-r-0 align-top"
                            >
                              <div className="h-full min-h-[96px] flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-bg-base/15 p-2 text-center select-none transition-colors">
                                <span className="text-3xs font-medium text-text-subtle/50">
                                  {__( 'Free', 'codeclove-school-management' )}
                                </span>
                              </div>
                            </td>
                          )
                        }

                        const activeNow = isSlotLive(day.id, slot)
                        const teacher = slot.teacher_name || slot.staff_name
                        const roomClean = formatRoomName(slot.room)

                        return (
                          <td
                            key={day.id}
                            className="p-2 border-r border-border/60 last:border-r-0 align-top"
                          >
                            <div
                              className={`group relative flex flex-col justify-between h-full min-h-[96px] rounded-xl p-3 border transition-all duration-150 ${
                                activeNow
                                  ? 'bg-brand-dim/30 border-brand shadow-xs ring-1 ring-brand/40'
                                  : 'bg-bg-surface border-border/70 hover:border-border-strong hover:shadow-2xs hover:bg-bg-base/30'
                              }`}
                            >
                              <div>
                                {/* Period badge & Live status */}
                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                  <Badge
                                    variant={activeNow ? 'brand' : 'default'}
                                    size="sm"
                                    className="text-3xs font-semibold px-1.5 py-0"
                                  >
                                    {slot.period_name || row.name}
                                  </Badge>
                                  {activeNow && (
                                    <span className="inline-flex items-center gap-1 text-3xs font-bold text-brand animate-pulse">
                                      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                                      {__( 'Live', 'codeclove-school-management' )}
                                    </span>
                                  )}
                                </div>

                                {/* Subject Name */}
                                <h4
                                  className="text-xs font-bold text-text line-clamp-2 leading-snug tracking-tight"
                                  title={slot.subject_name}
                                >
                                  {slot.subject_name}
                                </h4>
                              </div>

                              {/* Meta: Teacher and Room */}
                              <div className="mt-2.5 pt-1.5 border-t border-border/40 space-y-1 text-3xs text-text-muted">
                                {teacher && (
                                  <div
                                    className="flex items-center gap-1 font-medium text-text truncate"
                                    title={teacher}
                                  >
                                    <User className="w-3 h-3 text-text-subtle shrink-0" />
                                    <span className="truncate">{teacher}</span>
                                  </div>
                                )}
                                {roomClean && (
                                  <div
                                    className="flex items-center gap-1 text-text-muted truncate"
                                    title={roomClean}
                                  >
                                    <DoorClosed className="w-3 h-3 text-text-subtle shrink-0" />
                                    <span className="truncate">{roomClean}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        )
                      })}
                    </tr>

                    {/* Friendly break interval spanning across all days */}
                    {gap && (
                      <tr key={`break-${row.id}`} className="bg-bg-base/40 border-y border-dashed border-border/70">
                        <td colSpan={daysList.length + 1} className="py-2.5 px-4 text-center">
                          <div className="inline-flex items-center gap-2.5 px-3.5 py-1 rounded-full bg-bg-surface border border-border/70 shadow-2xs text-xs">
                            <Coffee className="w-3.5 h-3.5 text-brand shrink-0" />
                            <span className="font-bold text-text">{gap.label}</span>
                            <span className="text-border-strong">•</span>
                            <span className="text-text-subtle font-medium tabular-nums">
                              {formatTime(gap.startTime)} – {formatTime(gap.endTime)}
                            </span>
                            <span className="text-3xs font-semibold text-text-muted bg-bg-base px-2 py-0.5 rounded-full border border-border/60">
                              {sprintf( __( '%dm', 'codeclove-school-management' ), gap.durationMinutes )}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
