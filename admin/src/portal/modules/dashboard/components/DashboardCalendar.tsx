/**
 * Dashboard Calendar Overview & Agenda Component.
 *
 * Mini interactive 7-day calendar with date-filtered upcoming milestones,
 * fee deadlines, academic events, and school announcements.
 */

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from 'lucide-react'
import { __, _n, sprintf } from '@/lib/i18n'
import type { CalendarEvent } from '../../../types'
import { usePortal } from '../../../lib/portal-context'
import { formatCurrency, getCleanLocale } from '../../../lib/formatter'
import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui'

interface DashboardCalendarProps {
  events?: CalendarEvent[]
}

// Parse date components (YYYY-MM-DD) for calendar display
function parseDateComponents(dateStr?: string) {
  if (!dateStr) return { monthShort: '', dayNum: '' }
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00')
  return {
    monthShort: isNaN(d.getTime()) ? '' : d.toLocaleDateString(getCleanLocale(), { month: 'short' }).toUpperCase(),
    dayNum: isNaN(d.getTime()) ? '' : String(d.getDate()),
  }
}

const EVENT_META: Record<string, { dot: string; variant: 'warning' | 'success' | 'danger' | 'brand' | 'default'; label: string }> = {
  deadline: { dot: 'bg-danger', variant: 'warning', label: __( 'Finance', 'codeclove-school-management' ) },
  finance:  { dot: 'bg-danger', variant: 'warning', label: __( 'Finance', 'codeclove-school-management' ) },
  holiday:  { dot: 'bg-success', variant: 'success', label: __( 'Holiday', 'codeclove-school-management' ) },
  exam:     { dot: 'bg-brand', variant: 'danger', label: __( 'Exam', 'codeclove-school-management' ) },
  academic: { dot: 'bg-brand', variant: 'brand', label: __( 'Academic', 'codeclove-school-management' ) },
}

function getEventStyle(evt: CalendarEvent) {
  return EVENT_META[evt.type] || EVENT_META[evt.category] || { dot: 'bg-info', variant: 'default' as const, label: evt.category || __( 'Event', 'codeclove-school-management' ) }
}

const EventLink: React.FC<{ url: string; className?: string; ariaLabel?: string; children: React.ReactNode }> = ({
  url,
  className,
  ariaLabel,
  children,
}) => {
  const isExt = url.startsWith('http://') || url.startsWith('https://')
  return isExt ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ) : (
    <Link to={url} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  )
}

export const DashboardCalendar: React.FC<DashboardCalendarProps> = ({ events = [] }) => {
  const { localization } = usePortal()
  const weekStartDay = localization?.week_start_day === 1 ? 1 : 0

  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const weekHeaders = useMemo(
    () =>
      weekStartDay === 1
        ? [
            __( 'Mo', 'codeclove-school-management' ),
            __( 'Tu', 'codeclove-school-management' ),
            __( 'We', 'codeclove-school-management' ),
            __( 'Th', 'codeclove-school-management' ),
            __( 'Fr', 'codeclove-school-management' ),
            __( 'Sa', 'codeclove-school-management' ),
            __( 'Su', 'codeclove-school-management' ),
          ]
        : [
            __( 'Su', 'codeclove-school-management' ),
            __( 'Mo', 'codeclove-school-management' ),
            __( 'Tu', 'codeclove-school-management' ),
            __( 'We', 'codeclove-school-management' ),
            __( 'Th', 'codeclove-school-management' ),
            __( 'Fr', 'codeclove-school-management' ),
            __( 'Sa', 'codeclove-school-management' ),
          ],
    [weekStartDay]
  )

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const monthTitle = viewDate.toLocaleDateString(getCleanLocale(), {
    month: 'short',
    year: 'numeric',
  })

  // First day offset
  const firstDay = new Date(year, month, 1).getDay()
  const leadingEmptyCount = weekStartDay === 1 ? (firstDay + 6) % 7 : firstDay
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Map events by normalized date string (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const record: Record<string, CalendarEvent[]> = {}
    for (const evt of events) {
      if (!evt.date) continue
      const dStr = evt.date.slice(0, 10)
      if (!record[dStr]) {
        record[dStr] = []
      }
      record[dStr].push(evt)
    }
    return record
  }, [events])

  // Filter agenda events based on selection or current viewed month
  const viewYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`

  const agendaEvents = useMemo(() => {
    const list = selectedDate
      ? events.filter((e) => e.date?.slice(0, 10) === selectedDate)
      : events.filter((e) => e.date?.startsWith(viewYearMonth))

    return [...list].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  }, [events, selectedDate, viewYearMonth])

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-dim text-brand">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-text">{__( 'Calendar Overview', 'codeclove-school-management' )}</h3>
        </div>

        {/* Month Navigator */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 rounded-lg text-text-muted hover:text-text hover:bg-hover-bg"
            onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            aria-label={__( 'Previous month', 'codeclove-school-management' )}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <span className="text-xs font-bold text-text min-w-[76px] text-center select-none tabular-nums">
            {monthTitle}
          </span>

          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 rounded-lg text-text-muted hover:text-text hover:bg-hover-bg"
            onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            aria-label={__( 'Next month', 'codeclove-school-management' )}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        {/* Mini Calendar Grid */}
        <div className="rounded-xl border border-border p-2.5 bg-bg-surface">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 text-center mb-1.5">
            {weekHeaders.map((day) => (
              <span
                key={day}
                className="text-2xs font-bold text-text-muted uppercase tracking-wider py-1"
              >
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingEmptyCount }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8 w-8 mx-auto" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
              const isToday = dateStr === todayStr
              const isSelected = selectedDate === dateStr
              const dayEvents = eventsByDate[dateStr] ?? []
              const hasEvents = dayEvents.length > 0

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate((prev) => (prev === dateStr ? null : dateStr))}
                  className={`group relative h-8 w-8 mx-auto flex flex-col items-center justify-center rounded-lg text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-brand text-text-inverted font-bold shadow-xs'
                      : isToday
                      ? 'bg-brand-dim text-brand font-bold ring-1 ring-brand/40 hover:bg-brand-dim/80'
                      : hasEvents
                      ? 'text-text font-bold hover:bg-hover-bg'
                      : 'text-text-muted hover:text-text hover:bg-hover-bg font-medium'
                  }`}
                  title={
                    hasEvents
                      ? `${dateStr} (${sprintf(
                          _n( '%d event', '%d events', dayEvents.length, 'codeclove-school-management' ),
                          dayEvents.length
                        )})`
                      : dateStr
                  }
                >
                  <span className="leading-none tabular-nums text-xs">{dayNum}</span>
                  {hasEvents && (
                    <div className="flex items-center justify-center gap-0.5 mt-0.5 h-1">
                      {dayEvents.slice(0, 3).map((e, idx) => (
                        <span
                          key={e.id ?? idx}
                          className={`h-1 w-1 rounded-full shrink-0 ${
                            isSelected ? 'bg-text-inverted' : getEventStyle(e).dot
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── Agenda List Section ────────────────────────────────────────── */}
        <div className="pt-3 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                {__( 'Upcoming Events & Deadlines', 'codeclove-school-management' )}
              </h4>
              <Badge
                variant="default"
                size="sm"
                className="tabular-nums font-bold text-3xs py-0.5 px-1.5"
              >
                {agendaEvents.length}
              </Badge>
            </div>

            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="text-2xs font-semibold text-brand hover:text-brand-strong transition-colors cursor-pointer"
              >
                {__( 'Show all this month', 'codeclove-school-management' )}
              </button>
            )}
          </div>

          {agendaEvents.length === 0 ? (
            <div className="py-6 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-bg-surface p-4">
              <CalendarIcon className="w-5 h-5 text-text-subtle" />
              <span className="font-semibold text-text">
                {selectedDate ? __( 'No events on this date', 'codeclove-school-management' ) : __( 'No upcoming events this month', 'codeclove-school-management' )}
              </span>
              <span className="text-3xs text-text-subtle">
                {selectedDate
                  ? __( 'Select another date or view all monthly events.', 'codeclove-school-management' )
                  : __( 'School milestones, exams, and payment deadlines will appear here.', 'codeclove-school-management' )}
              </span>
              {selectedDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-7 text-xs text-brand hover:text-brand-strong"
                  onClick={() => setSelectedDate(null)}
                >
                  {__( 'Show all this month', 'codeclove-school-management' )}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {agendaEvents.map((evt) => {
                const { monthShort, dayNum } = parseDateComponents(evt.date)
                const style = getEventStyle(evt)

                return (
                  <div
                    key={evt.id}
                    className="group flex items-start justify-between gap-3 p-2.5 rounded-lg border border-border bg-bg-surface hover:border-border-strong hover:bg-hover-bg transition-all"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {/* Date Pill */}
                      <div className="flex flex-col items-center justify-center rounded-lg bg-bg-elevated border border-border px-2 py-1 min-w-[42px] shrink-0 text-center">
                        <span className="text-3xs font-bold text-text-muted uppercase tracking-wider leading-none">
                          {monthShort}
                        </span>
                        <span className="text-xs font-extrabold text-text tabular-nums leading-tight mt-0.5">
                          {dayNum}
                        </span>
                      </div>

                      {/* Event Details */}
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {evt.url ? (
                            <EventLink
                              url={evt.url}
                              className="text-xs font-bold text-text group-hover:text-brand transition-colors truncate hover:underline"
                            >
                              {evt.title}
                            </EventLink>
                          ) : (
                            <h5 className="text-xs font-bold text-text truncate">{evt.title}</h5>
                          )}
                          <Badge variant={style.variant} size="sm" className="text-3xs font-semibold py-0.5 px-1.5 capitalize">
                            {style.label}
                          </Badge>
                        </div>

                        {(evt.amount !== undefined || evt.description) && (
                          <p className="text-3xs text-text-muted line-clamp-1">
                            {evt.amount !== undefined ? (
                              <>
                                {__( 'Payment due:', 'codeclove-school-management' )}{' '}
                                <span className="font-semibold text-text tabular-nums">
                                  {formatCurrency(evt.amount, evt.currency)}
                                </span>
                              </>
                            ) : (
                              evt.description
                            )}
                          </p>
                        )}

                        <div className="flex items-center gap-2.5 text-3xs text-text-subtle flex-wrap pt-0.5">
                          {evt.time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-text-subtle" />
                              <span className="tabular-nums">{evt.time}</span>
                            </span>
                          )}
                          {evt.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-text-subtle" />
                              <span>{evt.location}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {evt.url && (
                      <EventLink
                        url={evt.url}
                        className="text-text-subtle group-hover:text-brand transition-colors shrink-0 mt-1"
                        ariaLabel={sprintf( __( 'Open %s', 'codeclove-school-management' ), evt.title )}
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </EventLink>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
