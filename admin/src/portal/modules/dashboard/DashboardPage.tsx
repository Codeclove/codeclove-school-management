/**
 * Portal Dashboard Page.
 *
 * Student-centric overview displaying academic standing, attendance compliance,
 * enrolled curriculum, fee status, school notices, and today's schedule
 * using shared CodeClove design system primitives.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Coffee,
  CreditCard,
  ShieldCheck,
} from 'lucide-react'
import { __, _n, sprintf } from '@/lib/i18n'
import { usePortal } from '../../lib/portal-context'
import { usePortalLabels } from '../../lib/labels'
import { useDashboard } from '../../api/portal'
import { formatCurrency, formatDate, formatTime, getCleanLocale } from '../../lib/formatter'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Spinner,
} from '@/components/ui'

import { formatRoomName, getBreakBetweenSlots, getGreeting, getSlotStatus } from '../../lib/schedule'
import { DashboardCalendar } from './components/DashboardCalendar'

// ─── Component ────────────────────────────────────────────────────────────────

export const DashboardPage: React.FC = () => {
  const { currentStudent } = usePortal()
  const isPro = window.CodeClovePortalConfig?.isPro ?? false
  const { getLabel } = usePortalLabels()
  const { data: dashboard, isLoading } = useDashboard(currentStudent?.id)

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  const attendance = dashboard?.attendance
  const finance = dashboard?.finance
  const todayClasses = dashboard?.today_timetable ?? []
  const recentNotices = dashboard?.recent_notifications ?? []
  const academic = dashboard?.academic
  const subjects = academic?.subjects ?? []

  const attendancePct = attendance?.percentage ?? 0
  const feeBalance = finance?.balance ?? 0
  const currency = finance?.currency ?? 'USD'
  const nextDueDate = finance?.next_due_date
  const isOverdue = (finance?.overdue ?? finance?.overdue_amount ?? 0) > 0

  // Format today's date cleanly with native Intl API
  const todayFormatted = new Date().toLocaleDateString(getCleanLocale(), {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Academic details
  const unitLabel = getLabel('academic_unit', false, 'Class')
  const className = [currentStudent?.unit_name, currentStudent?.group_name].filter(Boolean).join(' • ') || sprintf( __( 'Enrolled %s', 'codeclove-school-management' ), unitLabel )
  const electiveCount = subjects.filter((s) => s.type === 'elective').length
  const coreCount = subjects.length - electiveCount
  const curriculumSummary = electiveCount > 0
    ? sprintf( __( '%1$d Core • %2$d Elective', 'codeclove-school-management' ), coreCount, electiveCount )
    : currentStudent?.unit_name
    ? sprintf( __( '%s Curriculum', 'codeclove-school-management' ), currentStudent.unit_name )
    : __( 'All Core Subjects', 'codeclove-school-management' )

  // Attendance standing assessment
  const isAttendanceGood = attendancePct >= 75

  return (
    <div className="space-y-6">
      {/* ─── 1. Welcome & Status Banner ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/80 bg-bg-surface p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
              <Calendar className="w-3.5 h-3.5" />
              <span>{todayFormatted}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-text">
              {sprintf(
                __( '%1$s, %2$s!', 'codeclove-school-management' ),
                __( getGreeting(), 'codeclove-school-management' ),
                currentStudent?.first_name || __( 'Student', 'codeclove-school-management' )
              )}
            </h1>

            <p className="text-xs sm:text-sm text-text-muted">
              {className} • {academic?.enrollment?.session_name || getLabel('academic_session', false, 'Academic Session')}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Badge variant="active" size="default" className="gap-1.5 py-1 px-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{__( 'Active Enrollment', 'codeclove-school-management' )}</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* ─── 2. Metric Stat Cards (3 Core Pillars) ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Attendance Rate */}
        <Link
          to="/attendance"
          className="group rounded-xl border border-border/80 bg-bg-surface p-4 sm:p-5 shadow-card hover:border-brand/30 hover:shadow-card-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-text-muted group-hover:text-brand transition-colors">
              {__( 'Attendance', 'codeclove-school-management' )}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-dim text-success border border-success/20 group-hover:bg-success/25 transition-colors">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text tabular-nums">
              {attendancePct.toFixed(1)}%
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                  isAttendanceGood ? 'bg-success' : 'bg-warning'
                }`}
              />
              <span className="text-xs font-semibold text-text">
                {attendance?.total_days === 0
                  ? __( 'No Records', 'codeclove-school-management' )
                  : isAttendanceGood
                  ? __( 'Good Standing', 'codeclove-school-management' )
                  : __( 'Needs Attention', 'codeclove-school-management' )}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
              <span>
                {attendance?.total_days === 0
                  ? __( 'No records this month', 'codeclove-school-management' )
                  : sprintf(
                      __( '%1$d of %2$d days present', 'codeclove-school-management' ),
                      attendance?.present_days ?? 0,
                      attendance?.total_days ?? 0
                    )}
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
            </div>
          </div>
        </Link>

        {/* Academic Subjects */}
        <Link
          to="/academics"
          className="group rounded-xl border border-border/80 bg-bg-surface p-4 sm:p-5 shadow-card hover:border-brand/30 hover:shadow-card-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-text-muted group-hover:text-brand transition-colors">
              {__( 'Curriculum', 'codeclove-school-management' )}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-dim text-brand border border-brand/20 group-hover:bg-brand/25 transition-colors">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text">
              {subjects.length}{' '}
              <span className="text-base font-bold text-text-muted font-sans">
                {subjects.length === 1 ? __( 'Subject', 'codeclove-school-management' ) : __( 'Subjects', 'codeclove-school-management' )}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-brand shrink-0" />
              <span className="text-xs font-semibold text-text">
                {curriculumSummary}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
              <span>{__( 'Enrolled Curriculum', 'codeclove-school-management' )}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
            </div>
          </div>
        </Link>

        {/* Fee Standing */}
        <Link
          to="/finance"
          className="group rounded-xl border border-border/80 bg-bg-surface p-4 sm:p-5 shadow-card hover:border-brand/30 hover:shadow-card-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-text-muted group-hover:text-brand transition-colors">
              {__( 'Fee Standing', 'codeclove-school-management' )}
            </span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                isOverdue
                  ? 'bg-danger-dim text-danger border-danger/20 group-hover:bg-danger/25'
                  : feeBalance > 0
                  ? 'bg-warning-dim text-warning border-warning/20 group-hover:bg-warning/25'
                  : 'bg-success-dim text-success border-success/20 group-hover:bg-success/25'
              }`}
            >
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text tabular-nums">
              {formatCurrency(feeBalance, currency)}
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                  isOverdue ? 'bg-danger' : feeBalance > 0 ? 'bg-warning' : 'bg-success'
                }`}
              />
              <span className={`text-xs font-semibold ${isOverdue ? 'text-danger' : 'text-text'}`}>
                {isOverdue
                  ? __( 'Overdue Dues', 'codeclove-school-management' )
                  : feeBalance > 0
                  ? __( 'Pending Dues', 'codeclove-school-management' )
                  : __( 'Fully Settled', 'codeclove-school-management' )}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
              <span>
                {isOverdue && nextDueDate
                  ? sprintf( __( 'Due since %s', 'codeclove-school-management' ), formatDate(nextDueDate) )
                  : nextDueDate
                  ? sprintf( __( 'Due %s', 'codeclove-school-management' ), formatDate(nextDueDate) )
                  : sprintf( __( 'Paid %s', 'codeclove-school-management' ), formatCurrency(finance?.total_paid ?? 0, currency) )}
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
            </div>
          </div>
        </Link>
      </div>

      {/* ─── 3. Main Body: Balanced 2-Column Layout ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Primary Column (7 cols): Today's Schedule */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section: Today's Schedule */}
          <Card className="rounded-xl border border-border/80 shadow-card bg-bg-surface overflow-hidden">
            <CardHeader className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-dim text-info">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-text leading-tight">
                    {__( "Today's Schedule", 'codeclove-school-management' )}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {todayClasses.length === 0
                      ? __( 'No periods today', 'codeclove-school-management' )
                      : sprintf(
                          _n( '%d period scheduled', '%d periods scheduled', todayClasses.length, 'codeclove-school-management' ),
                          todayClasses.length
                        )}
                  </p>
                </div>
              </div>

              <Link
                to="/timetable"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-strong transition-colors"
              >
                {__( 'Full Timetable', 'codeclove-school-management' )}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>

            <CardContent className="p-0">
              {todayClasses.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                  <span className="font-medium text-text">{__( 'No classes scheduled for today.', 'codeclove-school-management' )}</span>
                  <span className="text-3xs text-text-subtle">{__( 'Enjoy your day or catch up on coursework!', 'codeclove-school-management' )}</span>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {todayClasses.map((slot, index) => {
                    const roomClean = formatRoomName(slot.room)
                    const teacher = slot.teacher_name || slot.staff_name
                    const status = getSlotStatus(slot.start_time, slot.end_time)
                    const nextSlot = todayClasses[index + 1]
                    const gap = nextSlot ? getBreakBetweenSlots(slot.end_time, nextSlot.start_time) : null
                    const meta = [slot.period_name, teacher, roomClean].filter(Boolean).join(' • ')

                    return (
                      <React.Fragment key={`${slot.period_name}-${index}`}>
                        <div
                          className={`flex items-center justify-between px-4 py-3 gap-3 transition-colors ${
                            status === 'current'
                              ? 'bg-brand-dim/35 font-medium'
                              : status === 'past'
                              ? 'opacity-65 bg-bg-base/20 hover:bg-bg-base/40'
                              : 'hover:bg-bg-base/40'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Time Interval Badge */}
                            <div className="flex flex-col items-center justify-center rounded-lg bg-bg-base/80 border border-border/60 px-2.5 py-1 text-center min-w-[76px] shrink-0">
                              <span className="text-xs font-bold text-text tabular-nums leading-tight">
                                {formatTime(slot.start_time)}
                              </span>
                              <span className="text-3xs font-semibold text-text-subtle tabular-nums leading-tight mt-0.5">
                                {sprintf( __( 'to %s', 'codeclove-school-management' ), formatTime(slot.end_time) )}
                              </span>
                            </div>

                            {/* Subject Title & Single-Line Context Meta */}
                            <div className="min-w-0">
                              <h4 className={`text-sm font-bold truncate ${status === 'current' ? 'text-brand' : 'text-text'}`}>
                                {slot.subject_name}
                              </h4>
                              <p className="text-xs text-text-muted mt-0.5 truncate">
                                {meta}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0">
                            {status === 'current' ? (
                              <Badge variant="active" size="sm" className="gap-1 animate-pulse">
                                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                {__( 'Live Now', 'codeclove-school-management' )}
                              </Badge>
                            ) : (
                              <Badge variant="default" size="sm" className={status === 'past' ? 'text-text-subtle' : undefined}>
                                {status === 'past' ? __( 'Done', 'codeclove-school-management' ) : __( 'Upcoming', 'codeclove-school-management' )}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Break / Recess Strip */}
                        {gap && (
                          <div className="flex items-center justify-between px-4 py-2 bg-bg-base/40 border-y border-dashed border-border/70 text-text-muted text-xs">
                            <div className="flex items-center gap-2 font-medium">
                              <Coffee className="w-3.5 h-3.5 text-brand shrink-0" />
                              <span className="font-bold text-text">{__( gap.label, 'codeclove-school-management' )}</span>
                              <span className="text-border-strong">•</span>
                              <span className="text-text-subtle text-3xs font-medium tabular-nums">
                                {formatTime(gap.startTime)} – {formatTime(gap.endTime)}
                              </span>
                            </div>
                            <span className="text-3xs font-semibold text-text-muted bg-bg-surface border border-border/60 px-2 py-0.5 rounded-full">
                              {gap.durationMinutes}m
                            </span>
                          </div>
                        )}
                      </React.Fragment>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right / Secondary Column (5 cols): Calendar Overview & Notices */}
        <div className="lg:col-span-5 space-y-6">
          {/* Section: Calendar Overview & Agenda */}
          <DashboardCalendar events={dashboard?.calendar_events ?? []} />

          {/* Section: Recent Notifications (Pro only) */}
          {isPro && (
            <Card className="rounded-xl border border-border/80 shadow-card bg-bg-surface">
            <CardHeader className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-dim text-warning">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-text">{__( 'Recent Notifications', 'codeclove-school-management' )}</h3>
                </div>
              </div>
              <Link
                to="/notifications"
                className="text-xs font-semibold text-brand hover:text-brand-strong transition-colors"
              >
                {__( 'View all', 'codeclove-school-management' )}
              </Link>
            </CardHeader>

            <CardContent className="space-y-2.5">
              {recentNotices.length === 0 ? (
                <div className="py-5 px-3 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-1.5">
                  <div className="flex items-center gap-2 font-medium text-text">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <span>{__( 'All caught up — no new notifications.', 'codeclove-school-management' )}</span>
                  </div>
                  <span className="text-3xs text-text-subtle">
                    {__( 'Attendance alerts, payment receipts, and school updates will appear here.', 'codeclove-school-management' )}
                  </span>
                </div>
              ) : (
                recentNotices.slice(0, 5).map((notice) => (
                  <Link
                    key={notice.id}
                    to={notice.url || '/notifications'}
                    className="group block p-3 rounded-lg border border-border/60 bg-bg-surface hover:border-border/90 hover:bg-bg-base/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-text group-hover:text-brand transition-colors leading-snug line-clamp-1">
                        {notice.title}
                      </h4>
                      {notice.event_type && (
                        <Badge variant="default" size="sm" className="capitalize shrink-0 text-3xs font-semibold py-0.5 px-1.5">
                          {notice.event_type.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                    {notice.content && (
                      <p className="text-3xs text-text-muted mt-1 line-clamp-2 leading-relaxed">
                        {notice.content}
                      </p>
                    )}
                    <span className="text-3xs font-medium text-text-subtle mt-1.5 block">
                      {formatDate(notice.created_at)}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
