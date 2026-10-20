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
  CalendarCheck,
  CheckCircle2,
  Clock,
  Coffee,
  CreditCard,
  DoorClosed,
  User,
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
  // Attendance standing assessment
  const isAttendanceGood = attendancePct >= 75
   const nextTimetable = dashboard?.next_timetable
   const isPreviewSchedule = todayClasses.length === 0 && Boolean(nextTimetable?.periods?.length)
   const displayClasses = isPreviewSchedule ? (nextTimetable?.periods ?? []) : todayClasses
 
   return (
     <div className="space-y-6">
       {/* ─── 1. Page Header (Modern Editorial Layout) ─────────────────────────── */}
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
         <div>
           <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text">
             {sprintf(
               __( '%1$s, %2$s', 'codeclove-school-management' ),
               __( getGreeting(), 'codeclove-school-management' ),
               currentStudent?.first_name || __( 'Student', 'codeclove-school-management' )
             )}
           </h1>
 
           <div className="text-xs sm:text-sm text-text-muted mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
             <span className="font-medium">{todayFormatted}</span>
             <span className="text-border-strong">•</span>
             <span className="font-semibold text-text">{className}</span>
             {currentStudent?.roll_number && (
               <>
                 <span className="text-border-strong">•</span>
                 <span>{sprintf( __( 'Roll #%s', 'codeclove-school-management' ), currentStudent.roll_number )}</span>
               </>
             )}
             {(currentStudent?.admission_number || currentStudent?.student_number) && (
               <>
                 <span className="text-border-strong">•</span>
                 <span className="tabular-nums font-mono text-3xs bg-bg-surface px-1.5 py-0.5 rounded border border-border text-text-subtle">
                   {currentStudent?.admission_number || currentStudent?.student_number}
                 </span>
               </>
             )}
           </div>
         </div>
 
         {/* Active Academic Session Indicator */}
         <div className="flex items-center gap-2.5 shrink-0 select-none">
           <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-bg-surface shadow-2xs text-xs font-semibold text-text">
             <span className="relative flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
               <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
             </span>
             <span>{academic?.enrollment?.session_name || __( 'Current Session', 'codeclove-school-management' )}</span>
           </div>
         </div>
       </div>
 
       {/* ─── 2. Metric Stat Cards (3 Core Pillars) ───────────────────────────────── */}
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
         {/* Attendance Rate */}
         <Link
           to="/attendance"
           className="group rounded-xl border border-border bg-bg-surface p-4 sm:p-5 shadow-card hover:border-brand/40 hover:shadow-card-md transition-all flex flex-col justify-between"
         >
           {/* Header */}
           <div className="flex items-center justify-between">
             <span className="text-2xs font-bold uppercase tracking-wider text-text-muted group-hover:text-brand transition-colors inline-flex items-center gap-1.5">
               <CalendarCheck className="w-3.5 h-3.5 text-text-subtle group-hover:text-brand transition-colors" />
               {__( 'Attendance', 'codeclove-school-management' )}
             </span>
             <span className="text-2xs font-semibold text-text-muted bg-bg-elevated px-2 py-0.5 rounded-md border border-border/60 tabular-nums">
               {attendance?.total_days === 0
                 ? __( 'No records', 'codeclove-school-management' )
                 : sprintf(
                     __( '%1$d of %2$d days', 'codeclove-school-management' ),
                     attendance?.present_days ?? 0,
                     attendance?.total_days ?? 0
                   )}
             </span>
           </div>
 
          {/* Metric + Visual Progress */}
          <div className="mt-3.5">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text tabular-nums">
                {attendancePct.toFixed(1)}%
              </div>
              <span
                className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${
                  isAttendanceGood ? 'bg-success-dim text-success' : 'bg-warning-dim text-warning'
                }`}
              >
                {attendance?.total_days === 0
                  ? __( 'No records', 'codeclove-school-management' )
                  : isAttendanceGood
                  ? __( 'Good Standing', 'codeclove-school-management' )
                  : __( 'Action Needed', 'codeclove-school-management' )}
              </span>
            </div>

            {/* Attendance Progress Track */}
            <div className="mt-3">
              <div className="h-1.5 w-full bg-bg-elevated rounded-full overflow-hidden border border-border/40">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isAttendanceGood ? 'bg-success' : 'bg-warning'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, attendancePct))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-3xs font-medium text-text-subtle mt-1.5 tabular-nums">
                <span>{sprintf( __( '%d present', 'codeclove-school-management' ), attendance?.present_days ?? 0 )}</span>
                <span>{sprintf( __( '%d absent', 'codeclove-school-management' ), Math.max(0, (attendance?.total_days ?? 0) - (attendance?.present_days ?? 0)) )}</span>
              </div>
            </div>
          </div>
 
           {/* Footer Action */}
           <div className="mt-4 pt-2.5 border-t border-border/50 flex items-center justify-between text-3xs font-semibold text-text-subtle group-hover:text-brand transition-colors">
             <span>{__( 'View monthly attendance log', 'codeclove-school-management' )}</span>
             <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
           </div>
         </Link>
 
         {/* Academic Subjects */}
         <Link
           to="/academics"
           className="group rounded-xl border border-border bg-bg-surface p-4 sm:p-5 shadow-card hover:border-brand/40 hover:shadow-card-md transition-all flex flex-col justify-between"
         >
           {/* Header */}
           <div className="flex items-center justify-between">
             <span className="text-2xs font-bold uppercase tracking-wider text-text-muted group-hover:text-brand transition-colors inline-flex items-center gap-1.5">
               <BookOpen className="w-3.5 h-3.5 text-text-subtle group-hover:text-brand transition-colors" />
               {__( 'Curriculum', 'codeclove-school-management' )}
             </span>
             <span className="text-2xs font-semibold text-text-muted bg-bg-elevated px-2 py-0.5 rounded-md border border-border/60">
               {electiveCount > 0
                 ? sprintf( __( '%1$d Core • %2$d Elective', 'codeclove-school-management' ), coreCount, electiveCount )
                 : __( 'Core Courses', 'codeclove-school-management' )}
             </span>
           </div>
 
           {/* Metric */}
          {/* Metric + Subject Badges */}
          <div className="mt-3.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text tabular-nums">
                {subjects.length}
              </span>
              <span className="text-sm font-semibold text-text-muted">
                {subjects.length === 1 ? __( 'Active Subject', 'codeclove-school-management' ) : __( 'Active Subjects', 'codeclove-school-management' )}
              </span>
            </div>

            {/* Subject Chips preview */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {subjects.length > 0 ? (
                <>
                  {subjects.slice(0, 3).map((sub, idx) => (
                    <span
                      key={sub.id ?? idx}
                      className="text-3xs font-medium text-text-muted bg-bg-elevated border border-border/60 px-2 py-0.5 rounded-md truncate max-w-[120px]"
                    >
                      {sub.name}
                    </span>
                  ))}
                  {subjects.length > 3 && (
                    <span className="text-3xs font-bold text-text-subtle bg-bg-elevated px-1.5 py-0.5 rounded-md border border-border/60">
                      +{subjects.length - 3}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-3xs text-text-subtle">
                  {__( 'No active subjects assigned', 'codeclove-school-management' )}
                </span>
              )}
            </div>
          </div>
 
           {/* Footer Action */}
           <div className="mt-4 pt-2.5 border-t border-border/50 flex items-center justify-between text-3xs font-semibold text-text-subtle group-hover:text-brand transition-colors">
             <span>{__( 'View syllabus & teachers', 'codeclove-school-management' )}</span>
             <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
           </div>
         </Link>
 
         {/* Fee Standing */}
         <Link
           to="/finance"
           className="group rounded-xl border border-border bg-bg-surface p-4 sm:p-5 shadow-card hover:border-brand/40 hover:shadow-card-md transition-all flex flex-col justify-between"
         >
           {/* Header */}
           <div className="flex items-center justify-between">
             <span className="text-2xs font-bold uppercase tracking-wider text-text-muted group-hover:text-brand transition-colors inline-flex items-center gap-1.5">
               <CreditCard className="w-3.5 h-3.5 text-text-subtle group-hover:text-brand transition-colors" />
               {__( 'Tuition & Fees', 'codeclove-school-management' )}
             </span>
            <span className="text-2xs font-semibold text-text-muted bg-bg-elevated px-2 py-0.5 rounded-md border border-border/60 tabular-nums">
              {feeBalance > 0
                ? __( 'Balance Due', 'codeclove-school-management' )
                : __( 'Fully Settled', 'codeclove-school-management' )}
            </span>
          </div>

          {/* Metric + Financial Status */}
          <div className="mt-3.5">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text tabular-nums">
                {formatCurrency(feeBalance, currency)}
              </div>
              <span
                className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${
                  isOverdue
                    ? 'bg-danger-dim text-danger'
                    : feeBalance > 0
                    ? 'bg-warning-dim text-warning'
                    : 'bg-success-dim text-success'
                }`}
              >
                {isOverdue
                  ? __( 'Overdue', 'codeclove-school-management' )
                  : feeBalance > 0
                  ? __( 'Pending', 'codeclove-school-management' )
                  : __( 'Zero Dues', 'codeclove-school-management' )}
              </span>
            </div>

            {/* Financial context note */}
            <div className="mt-3 flex items-center gap-1.5 text-3xs text-text-subtle font-medium">
              {isOverdue && nextDueDate ? (
                <span className="text-danger font-semibold">
                  {sprintf( __( 'Overdue since %s', 'codeclove-school-management' ), formatDate(nextDueDate) )}
                </span>
              ) : feeBalance > 0 && nextDueDate ? (
                <span>
                  {sprintf( __( 'Next installment due %s', 'codeclove-school-management' ), formatDate(nextDueDate) )}
                </span>
              ) : (
                <span className="text-text-muted flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success inline shrink-0" />
                  <span>{__( 'All term installments paid in full', 'codeclove-school-management' )}</span>
                </span>
              )}
            </div>
          </div>
 
           {/* Footer Action */}
           <div className="mt-4 pt-2.5 border-t border-border/50 flex items-center justify-between text-3xs font-semibold text-text-subtle group-hover:text-brand transition-colors">
             <span>
               {isOverdue && nextDueDate
                 ? sprintf( __( 'Due since %s • Pay now', 'codeclove-school-management' ), formatDate(nextDueDate) )
                 : feeBalance > 0 && nextDueDate
                 ? sprintf( __( 'Due %s • Pay now', 'codeclove-school-management' ), formatDate(nextDueDate) )
                 : __( 'View fee statement & receipts', 'codeclove-school-management' )}
             </span>
             <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
           </div>
         </Link>
       </div>

      {/* ─── 3. Main Body: Balanced 2-Column Layout ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Primary Column (7 cols): Today's Schedule */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section: Today's / Upcoming Schedule */}
          <Card className="rounded-xl overflow-hidden shadow-card">
            <CardHeader className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                  isPreviewSchedule ? 'bg-brand-dim text-brand' : 'bg-info-dim text-info'
                }`}>
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-text leading-tight truncate">
                    {isPreviewSchedule
                      ? sprintf( __( 'Upcoming Schedule • %s', 'codeclove-school-management' ), nextTimetable?.date_formatted )
                      : __( "Today's Schedule", 'codeclove-school-management' )}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {displayClasses.length === 0
                      ? __( 'No periods scheduled', 'codeclove-school-management' )
                      : sprintf(
                          _n( '%d period scheduled', '%d periods scheduled', displayClasses.length, 'codeclove-school-management' ),
                          displayClasses.length
                        )}
                  </p>
                </div>
              </div>

              <Link
                to="/timetable"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-strong transition-colors shrink-0 select-none ml-2"
              >
                <span>{__( 'Full Timetable', 'codeclove-school-management' )}</span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              </Link>
            </CardHeader>

            <CardContent className="p-0">
              {displayClasses.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                  <span className="font-medium text-text">{__( 'No classes scheduled for today.', 'codeclove-school-management' )}</span>
                  <span className="text-3xs text-text-subtle">{__( 'Enjoy your day or catch up on coursework!', 'codeclove-school-management' )}</span>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {displayClasses.map((slot, index) => {
                    const roomClean = formatRoomName(slot.room)
                    const teacher = slot.teacher_name || slot.staff_name
                    const status = isPreviewSchedule ? 'upcoming' : getSlotStatus(slot.start_time, slot.end_time)
                    const nextSlot = displayClasses[index + 1]
                    const gap = nextSlot ? getBreakBetweenSlots(slot.end_time, nextSlot.start_time) : null

                    return (
                      <React.Fragment key={`${slot.period_name}-${index}`}>
                        <div
                          className={`flex items-center justify-between px-4 py-3 gap-3 transition-colors ${
                            status === 'current'
                              ? 'bg-brand-dim/35 font-medium border-l-4 border-l-brand'
                              : status === 'past'
                              ? 'opacity-65 hover:bg-hover-bg'
                              : 'hover:bg-hover-bg'
                          }`}
                        >
                          {/* Time & Period Column */}
                          <div className="w-28 shrink-0 select-none">
                            <div className="text-xs font-bold text-text tabular-nums leading-tight">
                              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                            </div>
                            <div className="text-3xs font-semibold text-text-subtle uppercase tracking-wider mt-0.5">
                              {slot.period_name}
                            </div>
                          </div>

                          {/* Subject & Instructor/Room Meta */}
                          <div className="min-w-0 flex-1">
                            <h4 className={`text-sm font-bold truncate leading-snug ${status === 'current' ? 'text-brand' : 'text-text'}`}>
                              {slot.subject_name}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5 flex-wrap">
                              {teacher && (
                                <span className="inline-flex items-center gap-1">
                                  <User className="w-3 h-3 text-text-subtle shrink-0" />
                                  <span className="truncate">{teacher}</span>
                                </span>
                              )}
                              {roomClean && (
                                <span className="inline-flex items-center gap-1 text-text-subtle">
                                  <DoorClosed className="w-3 h-3 text-text-subtle shrink-0" />
                                  <span>{roomClean}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0 text-right">
                            {status === 'current' ? (
                              <Badge variant="active" size="sm" className="gap-1 animate-pulse">
                                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                {__( 'Live Now', 'codeclove-school-management' )}
                              </Badge>
                            ) : status === 'past' ? (
                              <span className="text-3xs font-medium text-text-subtle">
                                {__( 'Done', 'codeclove-school-management' )}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Break / Recess Strip */}
                        {gap && (
                          <div className="flex items-center justify-between px-4 py-2 bg-bg-surface/80 border-y border-dashed border-border/70 text-xs">
                            <div className="flex items-center gap-3">
                              <div className="w-28 shrink-0 text-3xs font-medium text-text-subtle tabular-nums select-none">
                                {formatTime(gap.startTime)} – {formatTime(gap.endTime)}
                              </div>
                              <div className="flex items-center gap-1.5 font-semibold text-text text-xs">
                                <Coffee className="w-3.5 h-3.5 text-brand shrink-0" />
                                <span>{__( gap.label, 'codeclove-school-management' )}</span>
                              </div>
                            </div>
                            <span className="text-3xs font-semibold text-text-muted bg-bg-elevated border border-border px-2 py-0.5 rounded-full shrink-0">
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
            <Card className="rounded-xl overflow-hidden shadow-card">
              <CardHeader className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-dim text-warning">
                    <Bell className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-text">{__( 'Recent Notifications', 'codeclove-school-management' )}</h3>
                </div>
                <Link
                  to="/notifications"
                  className="text-xs font-semibold text-brand hover:text-brand-strong transition-colors"
                >
                  {__( 'View all', 'codeclove-school-management' )}
                </Link>
              </CardHeader>

              <CardContent className="p-0">
                {recentNotices.length === 0 ? (
                  <div className="py-6 px-4 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-1.5">
                    <div className="flex items-center gap-2 font-medium text-text">
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      <span>{__( 'All caught up — no new notifications.', 'codeclove-school-management' )}</span>
                    </div>
                    <span className="text-3xs text-text-subtle">
                      {__( 'Attendance alerts, payment receipts, and school updates will appear here.', 'codeclove-school-management' )}
                    </span>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {recentNotices.slice(0, 4).map((notice) => (
                      <Link
                        key={notice.id}
                        to={notice.url || '/notifications'}
                        className="group block px-4 py-3 hover:bg-hover-bg transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-semibold text-text group-hover:text-brand transition-colors leading-snug line-clamp-1">
                            {notice.title}
                          </h4>
                          {notice.event_type && (
                            <span className="text-3xs font-medium text-text-subtle capitalize shrink-0">
                              {notice.event_type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        {notice.content && (
                          <p className="text-3xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                            {notice.content}
                          </p>
                        )}
                        <span className="text-3xs font-medium text-text-subtle mt-1 block">
                          {formatDate(notice.created_at)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
