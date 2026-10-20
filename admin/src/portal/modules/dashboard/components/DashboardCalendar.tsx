/**
 * Dashboard Upcoming Milestones Component.
 *
 * Provides a clean, low-cognitive chronological feed of upcoming school milestones,
 * term dates, exam schedules, and fee deadlines.
 */

import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
} from 'lucide-react'
import { __, sprintf } from '@/lib/i18n'
import type { CalendarEvent } from '../../../types'
import { formatCurrency, getCleanLocale } from '../../../lib/formatter'
import { Card, CardContent, CardHeader } from '@/components/ui'

export interface DashboardCalendarProps {
  events?: CalendarEvent[]
}

// Parse date components (YYYY-MM-DD) for display
export function parseDateComponents(dateStr?: string) {
  if (!dateStr) return { monthShort: '', dayNum: '', isToday: false, isTomorrow: false, dateNorm: '' }
  const clean = dateStr.slice(0, 10)
  const d = new Date(clean + 'T00:00:00')

  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA')
  const tomorrowStr = new Date(now.getTime() + 86400000).toLocaleDateString('en-CA')
  return {
    monthShort: isNaN(d.getTime()) ? '' : d.toLocaleDateString(getCleanLocale(), { month: 'short' }).toUpperCase(),
    dayNum: isNaN(d.getTime()) ? '' : String(d.getDate()),
    isToday: clean === todayStr,
    isTomorrow: clean === tomorrowStr,
    dateNorm: clean,
  }
}

/**
 * Filter and sort events chronologically.
 * Prioritizes today and future events; falls back to all events if none are future.
 */
export function getSortedUpcomingEvents(events: CalendarEvent[], referenceDateStr?: string): CalendarEvent[] {
  if (!events || events.length === 0) return []

  const todayStr = referenceDateStr || new Date().toLocaleDateString('en-CA')
  // Sorted copy
  const sorted = [...events].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

  // Filter events from today onward
  const future = sorted.filter((e) => !e.date || e.date.slice(0, 10) >= todayStr)
  return future.length > 0 ? future : sorted
}

export function getEventStyle(evt: CalendarEvent): { dot: string; variant: 'warning' | 'success' | 'danger' | 'brand' | 'default'; label: string } {
  const cat = String(evt.category || '')
  const type = String(evt.type || '')

  if (type === 'exam') {
    return { dot: 'bg-brand', variant: 'danger', label: __( 'Exam', 'codeclove-school-management' ) }
  }
  if (type === 'holiday') {
    return { dot: 'bg-success', variant: 'success', label: __( 'Holiday', 'codeclove-school-management' ) }
  }
  if (cat === 'academic' || type === 'academic') {
    return { dot: 'bg-brand', variant: 'brand', label: __( 'Academic', 'codeclove-school-management' ) }
  }
  if (cat === 'finance' || type === 'finance' || type === 'deadline') {
    return { dot: 'bg-danger', variant: 'warning', label: __( 'Fee Due', 'codeclove-school-management' ) }
  }
  return { dot: 'bg-info', variant: 'default', label: evt.category || __( 'Event', 'codeclove-school-management' ) }
}
const VARIANT_STYLES: Record<string, string> = {
  danger: 'bg-danger-dim text-danger',
  warning: 'bg-warning-dim text-warning',
  success: 'bg-success-dim text-success',
  brand: 'bg-brand-dim text-brand',
  default: 'bg-bg-elevated text-text-muted',
}

const EventLink: React.FC<{ url: string; className?: string; children: React.ReactNode }> = ({
  url,
  className,
  children,
}) => {
  const isExt = url.startsWith('http://') || url.startsWith('https://')
  return isExt ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link to={url} className={className}>
      {children}
    </Link>
  )
}

export const DashboardCalendar: React.FC<DashboardCalendarProps> = ({ events = [] }) => {
  const upcomingList = useMemo(() => getSortedUpcomingEvents(events), [events])

  return (
    <Card className="rounded-xl overflow-hidden shadow-card">
      <CardHeader className="pb-3 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-dim text-brand">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-text">
            {__( 'Upcoming Milestones', 'codeclove-school-management' )}
          </h3>
        </div>

        {upcomingList.length > 0 && (
          <span className="text-2xs font-semibold text-text-subtle tabular-nums bg-bg-surface border border-border px-2 py-0.5 rounded-full">
            {sprintf( __( '%d upcoming', 'codeclove-school-management' ), upcomingList.length )}
          </span>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {upcomingList.length === 0 ? (
          <div className="py-8 px-4 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-1.5">
            <CalendarIcon className="w-5 h-5 text-text-subtle" />
            <span className="font-semibold text-text">
              {__( 'No upcoming deadlines or milestones', 'codeclove-school-management' )}
            </span>
            <span className="text-3xs text-text-subtle max-w-xs">
              {__( 'Term dates, exams, and scheduled fee dues will appear here.', 'codeclove-school-management' )}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {upcomingList.slice(0, 6).map((evt) => {
              const dateMeta = parseDateComponents(evt.date)
              const style = getEventStyle(evt)

              const titleEl = (
                <span className="text-xs font-semibold text-text hover:text-brand transition-colors block leading-snug">
                  {evt.title}
                </span>
              )

              return (
                <div
                  key={evt.id}
                  className="flex items-center justify-between px-4 py-3 gap-3 hover:bg-hover-bg transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Modern Calendar Date Tile */}
                    <div className={`flex flex-col items-center justify-center w-11 h-12 rounded-xl border shrink-0 select-none shadow-2xs ${
                      dateMeta.isToday
                        ? 'bg-brand-dim/30 border-brand/40 text-brand'
                        : dateMeta.isTomorrow
                        ? 'bg-info-dim/20 border-info/30 text-info'
                        : 'bg-bg-surface border-border text-text'
                    }`}>
                      <span className={`text-3xs font-extrabold uppercase tracking-wider leading-none ${
                        dateMeta.isToday ? 'text-brand' : dateMeta.isTomorrow ? 'text-info' : 'text-text-subtle'
                      }`}>
                        {dateMeta.isToday
                          ? __( 'Today', 'codeclove-school-management' )
                          : dateMeta.isTomorrow
                          ? __( 'Tmrw', 'codeclove-school-management' )
                          : dateMeta.monthShort}
                      </span>
                      <span className="text-sm font-extrabold tabular-nums leading-none mt-1">
                        {dateMeta.dayNum}
                      </span>
                    </div>
                    {/* Event Title & Context */}
                    <div className="min-w-0 space-y-0.5">
                      {evt.url ? (
                        <EventLink url={evt.url}>{titleEl}</EventLink>
                      ) : (
                        titleEl
                      )}

                      {/* Optional Context (Only rendered if concrete data exists) */}
                      {evt.amount !== undefined ? (
                        <p className="text-3xs font-semibold text-danger tabular-nums">
                          {__( 'Payment due:', 'codeclove-school-management' )}{' '}
                          {formatCurrency(evt.amount, evt.currency)}
                        </p>
                      ) : (evt.time || evt.location) ? (
                        <div className="flex items-center gap-2 text-3xs text-text-subtle">
                          {evt.time && (
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Clock className="w-3 h-3 text-text-subtle" />
                              <span>{evt.time}</span>
                            </span>
                          )}
                          {evt.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-text-subtle" />
                              <span>{evt.location}</span>
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Subtle Category Badge */}
                  <div className="shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-semibold capitalize ${VARIANT_STYLES[style.variant] ?? VARIANT_STYLES.brand}`}>
                      {style.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
