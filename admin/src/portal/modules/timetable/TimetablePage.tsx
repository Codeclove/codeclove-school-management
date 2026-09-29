/**
 * Portal Timetable Page.
 *
 * Displays weekly schedule with day tabs (Mon-Sat), highlighting current day
 * and active periods, subject details, teacher, and room using shared CodeClove design system primitives.
 */

import React, { useMemo, useState } from 'react'
import { Calendar, Clock, Coffee, DoorClosed, User } from 'lucide-react'
import { usePortal } from '../../lib/portal-context'
import { usePortalLabels } from '../../lib/labels'
import { useTimetable } from '../../api/portal'
import { formatTime } from '../../lib/formatter'
import { formatRoomName, getBreakBetweenSlots, getSlotStatus } from '../../lib/schedule'
import type { TimetableSlot } from '../../types'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  PageHeader,
  Spinner,
} from '@/components/ui'
import { WeeklyScheduleMatrix } from './components/WeeklyScheduleMatrix'
import { __, sprintf } from '@/lib/i18n'

interface DayTab {
  id: number
  label: string
  shortLabel: string
}

const getDays = (): DayTab[] => [
  { id: 1, label: __( 'Monday', 'codeclove-school-management' ), shortLabel: __( 'Mon', 'codeclove-school-management' ) },
  { id: 2, label: __( 'Tuesday', 'codeclove-school-management' ), shortLabel: __( 'Tue', 'codeclove-school-management' ) },
  { id: 3, label: __( 'Wednesday', 'codeclove-school-management' ), shortLabel: __( 'Wed', 'codeclove-school-management' ) },
  { id: 4, label: __( 'Thursday', 'codeclove-school-management' ), shortLabel: __( 'Thu', 'codeclove-school-management' ) },
  { id: 5, label: __( 'Friday', 'codeclove-school-management' ), shortLabel: __( 'Fri', 'codeclove-school-management' ) },
  { id: 6, label: __( 'Saturday', 'codeclove-school-management' ), shortLabel: __( 'Sat', 'codeclove-school-management' ) },
]

export const TimetablePage: React.FC = () => {
  const { currentStudent, localization } = usePortal()
  const { getLabel } = usePortalLabels()
  const { data: timetableData, isLoading } = useTimetable(currentStudent?.id)
  const daysList = useMemo<DayTab[]>(() => {
    const baseDays = getDays()
    if (localization?.week_start_day === 0) {
      return [
        { id: 7, label: __( 'Sunday', 'codeclove-school-management' ), shortLabel: __( 'Sun', 'codeclove-school-management' ) },
        ...baseDays,
      ]
    }
    return baseDays
  }, [localization?.week_start_day])

  // Current day of week (1 = Mon, ... 7 = Sun)
  const todayDayOfWeek = useMemo(() => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day
  }, [])

  // Default selected day tab to today (if in daysList) or first day
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const today = new Date().getDay()
    const isoDay = today === 0 ? 7 : today
    return isoDay <= 6 ? isoDay : (localization?.week_start_day === 0 ? 7 : 1)
  })
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')

  const daysData = timetableData?.days ?? {}
  const enrollment = timetableData?.enrollment

  // Get slots for the selected day tab (support numeric key or string key)
  const currentSlots = useMemo<TimetableSlot[]>(() => {
    const slots = (daysData[selectedDay] ?? daysData[String(selectedDay)]) as
      | TimetableSlot[]
      | undefined
    return slots ?? []
  }, [daysData, selectedDay])

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={sprintf(
          __( 'Weekly %s Timetable', 'codeclove-school-management' ),
          getLabel('academic_unit', false, __( 'Class', 'codeclove-school-management' ))
        )}
        description={
          [enrollment?.unit_name, enrollment?.group_name].filter(Boolean).join(' • ') ||
          [currentStudent?.unit_name, currentStudent?.group_name].filter(Boolean).join(' • ') ||
          sprintf(
            __( 'Enrolled %s Schedule', 'codeclove-school-management' ),
            getLabel('academic_unit', false, __( 'Class', 'codeclove-school-management' ))
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View mode segmented switcher (Segmented Capsule Track) */}
            <div
              role="tablist"
              aria-label={__( 'Timetable view mode', 'codeclove-school-management' )}
              className="inline-flex items-center gap-1 p-1 rounded-xl bg-bg-base/80 border border-border/80 shadow-2xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'day'}
                onClick={() => setViewMode('day')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none outline-none ${
                  viewMode === 'day'
                    ? 'bg-bg-surface text-brand font-bold shadow-xs'
                    : 'text-text-muted hover:text-text hover:bg-bg-surface/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{__( 'Day View', 'codeclove-school-management' )}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'week'}
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none outline-none ${
                  viewMode === 'week'
                    ? 'bg-bg-surface text-brand font-bold shadow-xs'
                    : 'text-text-muted hover:text-text hover:bg-bg-surface/50'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{__( 'Week View', 'codeclove-school-management' )}</span>
              </button>
            </div>

          </div>
        }
      />

      {/* Day selector tabs (visible in Day View — Segmented Capsule Track) */}
      {viewMode === 'day' && (
        <div
          role="tablist"
          aria-label={__( 'Day selection', 'codeclove-school-management' )}
          className="inline-flex items-center gap-1 overflow-x-auto rounded-xl bg-bg-base/80 p-1 border border-border/80 shadow-2xs w-fit max-w-full"
        >
          {daysList.map((day) => {
            const isToday = day.id === todayDayOfWeek
            const isSelected = day.id === selectedDay
            return (
              <button
                key={day.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedDay(day.id)}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shrink-0 select-none outline-none ${
                  isSelected
                    ? 'bg-bg-surface text-brand font-bold shadow-xs'
                    : 'text-text-muted hover:text-text hover:bg-bg-surface/50'
                }`}
              >
                <span>{day.shortLabel}</span>
                {isToday && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSelected ? 'bg-brand' : 'bg-border-strong'
                    }`}
                    title={__( 'Today', 'codeclove-school-management' )}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : viewMode === 'week' ? (
        <WeeklyScheduleMatrix timetable={timetableData} />
      ) : (
        <Card className="rounded-xl border border-border/80 shadow-card bg-bg-surface overflow-hidden">
          <CardHeader className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand" />
              <h3 className="text-sm font-bold text-text">
                {sprintf(
                  __( '%s Schedule', 'codeclove-school-management' ),
                  daysList.find((d) => d.id === selectedDay)?.label ?? ''
                )}
              </h3>
            </div>
            {selectedDay === todayDayOfWeek && (
              <Badge variant="current" size="sm">
                {__( 'Current Day', 'codeclove-school-management' )}
              </Badge>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {currentSlots.length === 0 ? (
              <EmptyState
                icon={Clock}
                title={__( 'No scheduled periods', 'codeclove-school-management' )}
                description={__( 'No classes or activities are assigned for this day.', 'codeclove-school-management' )}
                className="py-12"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-bg-base/50 border-b border-border/60 text-xs font-semibold text-text-subtle uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="py-3 px-4 w-24">{__( 'Period', 'codeclove-school-management' )}</th>
                      <th scope="col" className="py-3 px-4 w-44">{__( 'Time', 'codeclove-school-management' )}</th>
                      <th scope="col" className="py-3 px-4">{__( 'Subject', 'codeclove-school-management' )}</th>
                      <th scope="col" className="py-3 px-4">{__( 'Teacher', 'codeclove-school-management' )}</th>
                      <th scope="col" className="py-3 px-4">{__( 'Room', 'codeclove-school-management' )}</th>
                      <th scope="col" className="py-3 px-4 text-right">{__( 'Status', 'codeclove-school-management' )}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {currentSlots.map((slot, idx) => {
                      const isToday = selectedDay === todayDayOfWeek
                      const slotStatus = isToday ? getSlotStatus(slot.start_time, slot.end_time) : null
                      const activeNow = slotStatus === 'current'
                      const isPast = slotStatus === 'past'
                      const teacher = slot.teacher_name || slot.staff_name
                      const roomClean = formatRoomName(slot.room)
                      const nextSlot = currentSlots[idx + 1]
                      const gap = nextSlot ? getBreakBetweenSlots(slot.end_time, nextSlot.start_time) : null

                      return (
                        <React.Fragment key={`${slot.period_name}-${idx}`}>
                          <tr
                            className={`transition-colors ${
                              activeNow
                                ? 'bg-brand-dim/40 font-medium'
                                : isPast
                                ? 'opacity-70 bg-bg-base/20 hover:bg-bg-base/40'
                                : 'hover:bg-bg-base/40'
                            }`}
                          >
                            <td className="py-3.5 px-4 font-bold text-text-subtle">
                              {slot.period_name}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-text-muted tabular-nums whitespace-nowrap">
                              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-sm text-text">
                                {slot.subject_name}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-text">
                              {teacher ? (
                                <span className="inline-flex items-center gap-1.5 font-medium">
                                  <User className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                                  <span>{teacher}</span>
                                </span>
                              ) : (
                                <span className="text-text-subtle">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-text-muted">
                              {roomClean ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <DoorClosed className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                                  <span>{roomClean}</span>
                                </span>
                              ) : (
                                <span className="text-text-subtle">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {activeNow ? (
                                <Badge variant="active" size="sm" className="gap-1 animate-pulse">
                                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                  {__( 'Live Now', 'codeclove-school-management' )}
                                </Badge>
                              ) : (
                                <Badge variant="default" size="sm" className={isPast ? 'text-text-subtle' : undefined}>
                                  {isPast ? __( 'Completed', 'codeclove-school-management' ) : isToday ? __( 'Upcoming', 'codeclove-school-management' ) : __( 'Scheduled', 'codeclove-school-management' )}
                                </Badge>
                              )}
                            </td>
                          </tr>

                          {gap && (
                            <tr key={`break-${idx}`} className="bg-bg-base/40 border-y border-dashed border-border/70 text-text-muted">
                              <td className="py-2.5 px-4 text-center">
                                <Coffee className="w-3.5 h-3.5 text-brand inline" />
                              </td>
                              <td className="py-2.5 px-4 font-semibold tabular-nums text-text-muted whitespace-nowrap">
                                {formatTime(gap.startTime)} – {formatTime(gap.endTime)}
                              </td>
                              <td colSpan={3} className="py-2.5 px-4 font-bold text-xs text-text">
                                <span>{gap.label}</span>
                                <span className="text-text-subtle font-normal ml-2">
                                  {sprintf( __( '(%d minutes)', 'codeclove-school-management' ), gap.durationMinutes )}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <Badge variant="default" size="sm" className="text-3xs font-semibold">
                                  {gap.durationMinutes}m
                                </Badge>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
