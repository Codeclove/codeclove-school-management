import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CalendarDays, CheckCircle2, Clock, Save, Check, X,
  Users, RefreshCw, ChevronLeft, ChevronRight, Sun, CalendarMinus,
  Search, FilterX
} from 'lucide-react'
import { useSession } from '@/lib/session-context'
import { useUnits, useGroups } from '@/api/academics'
import { useAttendanceRegister, useSaveAttendance } from '@/api/attendance'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { __, sprintf } from '@/lib/i18n'
import {
  Button, Card, CardContent, Select, DatePicker, EmptyState, PersonAvatar,
  TableRoot, Thead, Tbody, Tr, Th, Td, TableEmpty, TableSkeleton, Input, Alert
} from '@/components/ui'
import { AttendanceStatusSelector } from './components/AttendanceStatusSelector'
import { AttendanceNotePopover } from './components/AttendanceNotePopover'

export default function StudentDailyAttendance() {
  const { session } = useSession()
  const sessionId = session ? String(session.id) : ''
  const toast = useToast()
  const { getLabel } = useLabels()

  const unitLabelSingular = getLabel('academic_unit', false, __('Class', 'codeclove-school-management'))

  // Filters State
  const [unitId, setUnitId] = useState<string>('')
  const [groupId, setGroupId] = useState<string>('')
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0] || '')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Local Attendance Register state (for daily editing)
  const [localRecords, setLocalRecords] = useState<Record<number, { status: string; note: string }>>({})

  // Fetch filter dropdown options
  const { data: unitResponse } = useUnits({ session_id: Number(sessionId) })
  const { data: groupResponse } = useGroups({ academic_unit_id: Number(unitId) })

  const units = unitResponse?.data ?? []
  const groups = groupResponse?.data ?? []

  // Daily attendance query
  const {
    data: registerRecords,
    isLoading: isDailyLoading,
    isError: isDailyError,
    refetch: refetchDaily,
  } = useAttendanceRegister({
    academic_session_id: sessionId ? Number(sessionId) : undefined,
    academic_unit_id: unitId ? Number(unitId) : undefined,
    academic_group_id: groupId ? Number(groupId) : undefined,
    attendance_date: date || undefined,
  })
  const saveMutation = useSaveAttendance()

  // Track if teacher has made unsaved changes by comparing directly against server data
  const isDirty = useMemo(() => {
    if (!registerRecords || registerRecords.length === 0) return false
    return registerRecords.some((r) => {
      const curr = localRecords[r.student_id]
      if (!curr) return false
      return curr.status !== (r.status || 'present') || curr.note !== (r.note || '')
    })
  }, [localRecords, registerRecords])

  // Safeguard: warn if discarding unsaved changes
  const confirmDiscardIfDirty = useCallback(
    (action: () => void) => {
      if (!isDirty || window.confirm(__('You have unsaved attendance changes. Discard them?', 'codeclove-school-management'))) {
        action()
      }
    },
    [isDirty]
  )

  // Reset filters if active session changes
  useEffect(() => {
    setUnitId('')
    setGroupId('')
  }, [sessionId])

  // Synced state initialization for daily edit
  useEffect(() => {
    if (!registerRecords) return
    const initialMap: Record<number, { status: string; note: string }> = {}
    registerRecords.forEach((r) => {
      initialMap[r.student_id] = {
        status: r.status || 'present',
        note: r.note || '',
      }
    })
    setLocalRecords(initialMap)
  }, [registerRecords])

  const handleStatusChange = (studentId: number, status: string) => {
    setLocalRecords((prev) => {
      const current = prev[studentId] || { status: 'present', note: '' }
      return {
        ...prev,
        [studentId]: {
          status,
          note: current.note,
        },
      }
    })
  }

  const handleNoteChange = (studentId: number, note: string) => {
    setLocalRecords((prev) => {
      const current = prev[studentId] || { status: 'present', note: '' }
      return {
        ...prev,
        [studentId]: {
          status: current.status,
          note,
        },
      }
    })
  }

  const handleSave = () => {
    if (!sessionId || !unitId || !date) return

    const recordsArray = Object.entries(localRecords).map(([studentId, data]) => ({
      student_id: Number(studentId),
      status: data.status,
      note: data.note,
    }))

    saveMutation.mutate(
      {
        academic_session_id: Number(sessionId),
        academic_unit_id: Number(unitId),
        academic_group_id: groupId ? Number(groupId) : undefined,
        attendance_date: date,
        records: recordsArray,
      },
      {
        onSuccess: () => {
          toast.success(
            sprintf(
              __('%s saved successfully!', 'codeclove-school-management'),
              getLabel('attendance_record', false, __('Attendance', 'codeclove-school-management'))
            )
          )
        },
        onError: (err) => {
          toast.error(sprintf(__('Failed to save attendance: %s', 'codeclove-school-management'), err.message))
        },
      }
    )
  }

  const handleMarkAll = (status: string) => {
    if (!registerRecords) return
    const updated = { ...localRecords }
    registerRecords.forEach((r) => {
      updated[r.student_id] = {
        status,
        note: updated[r.student_id]?.note ?? '',
      }
    })
    setLocalRecords(updated)
  }

  // Date steppers
  const shiftDate = (days: number) => {
    confirmDiscardIfDirty(() => {
      const current = date ? new Date(date) : new Date()
      current.setDate(current.getDate() + days)
      setDate(current.toISOString().split('T')[0] || '')
    })
  }

  const setTodayDate = () => {
    confirmDiscardIfDirty(() => {
      setDate(new Date().toISOString().split('T')[0] || '')
    })
  }

  // Daily statistics computed in a single pass
  const recordsList = registerRecords ?? []
  const totalCount = recordsList.length
  const counts = useMemo(() => {
    let present = 0, late = 0, absent = 0, halfDay = 0, leave = 0
    for (const r of Object.values(localRecords)) {
      if (r.status === 'present') present++
      else if (r.status === 'late') late++
      else if (r.status === 'absent') absent++
      else if (r.status === 'half_day') halfDay++
      else if (r.status === 'on_leave' || r.status === 'excused') leave++
    }
    return { present, late, absent, halfDay, leave }
  }, [localRecords])

  // Standard education formula: Present(1.0) + Late(1.0) + HalfDay(0.5)
  const effectiveAttended = counts.present + counts.late + 0.5 * counts.halfDay
  const attendanceRate = totalCount > 0 ? Math.round((effectiveAttended / totalCount) * 100) : 0

  // Filtered by instant search
  const filteredRecordsList = useMemo(() => {
    return recordsList.filter((r) => {
      const fullName = `${r.first_name} ${r.last_name}`.toLowerCase()
      const studentNum = (r.student_number || '').toLowerCase()
      const rollNum = String(r.roll_number || '').toLowerCase()
      const query = searchQuery.trim().toLowerCase()

      return !query || fullName.includes(query) || studentNum.includes(query) || rollNum.includes(query)
    })
  }, [recordsList, searchQuery])

  // Check if attendance for this day has already been saved to the database
  const isAlreadySubmitted = useMemo(() => {
    if (!registerRecords || registerRecords.length === 0) return false
    return registerRecords.some((r) => r.attendance_id !== null)
  }, [registerRecords])

  return (
    <div className={`space-y-3 ${isDirty ? 'pb-20 sm:pb-0' : ''}`}>
      {/* ── Tier 1: Filters Toolbar ── */}
      <div className="p-3 bg-bg-surface border border-border rounded-xl shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Controls: Class, Section, Date Stepper */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Class */}
            <div className="w-full sm:w-44">
              <Select
                value={unitId}
                onValueChange={(val) => {
                  confirmDiscardIfDirty(() => {
                    setUnitId(val)
                    setGroupId('')
                  })
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
                onValueChange={(val) => {
                  confirmDiscardIfDirty(() => setGroupId(val))
                }}
                options={[
                  { value: '', label: __('All Sections', 'codeclove-school-management') },
                  ...groups.map((g) => ({ value: String(g.id), label: g.name })),
                ]}
                placeholder={__('All Sections', 'codeclove-school-management')}
                disabled={!unitId}
                className="h-9 text-xs"
              />
            </div>

            {/* Date with integrated Prev / Today / Next steppers */}
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => shiftDate(-1)}
                className="h-9 w-8 flex items-center justify-center rounded-lg border border-border bg-bg-surface hover:bg-bg-subtle text-text-subtle hover:text-text transition-colors shrink-0"
                title={__('Previous Day', 'codeclove-school-management')}
                aria-label={__('Previous Day', 'codeclove-school-management')}
              >
                <ChevronLeft size={14} />
              </button>

              <div className="flex-1 sm:w-36 min-w-0">
                <DatePicker
                  value={date}
                  clearable={false}
                  onChange={(val) => {
                    if (val) confirmDiscardIfDirty(() => setDate(val))
                  }}
                  className="h-9 w-full text-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => shiftDate(1)}
                className="h-9 w-8 flex items-center justify-center rounded-lg border border-border bg-bg-surface hover:bg-bg-subtle text-text-subtle hover:text-text transition-colors shrink-0"
                title={__('Next Day', 'codeclove-school-management')}
                aria-label={__('Next Day', 'codeclove-school-management')}
              >
                <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={setTodayDate}
                className="h-9 px-2.5 text-2xs font-semibold rounded-lg border border-border bg-bg-surface hover:bg-bg-subtle text-text-subtle hover:text-text transition-colors shrink-0"
                title={__('Jump to Today', 'codeclove-school-management')}
              >
                {__('Today', 'codeclove-school-management')}
              </button>
            </div>
          </div>

          {/* Student Search */}
          <div className="w-full sm:w-52 relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={__('Search student...', 'codeclove-school-management')}
              disabled={!unitId || isDailyLoading}
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

      {unitId && date ? (
        <Card className="border-border shadow-xs overflow-hidden">
          <CardContent className="p-0">
            {isDailyLoading ? (
              <TableRoot>
                <Tbody>
                  <TableSkeleton columns={3} rows={6} />
                </Tbody>
              </TableRoot>
            ) : isDailyError ? (
              <div className="p-8 text-center space-y-3">
                <Alert variant="danger" title={__('Failed to load register', 'codeclove-school-management')}>
                  {__('Could not retrieve student attendance records for this class and date.', 'codeclove-school-management')}
                </Alert>
                <Button variant="secondary" size="sm" onClick={() => refetchDaily()} className="gap-1.5 mx-auto">
                  <RefreshCw size={13} />
                  {__('Retry', 'codeclove-school-management')}
                </Button>
              </div>
            ) : recordsList.length > 0 ? (
              <div className="space-y-0">
                {/* ── Tier 2: Integrated Metrics & Action Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-5 sm:py-2.5 bg-bg-surface border-b border-border gap-2.5">
                  {/* Status badge & metrics */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
                    {isAlreadySubmitted ? (
                      <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 text-3xs sm:text-2xs font-semibold rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 size={11} className="stroke-[2.5]" />
                        {__('Submitted', 'codeclove-school-management')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 text-3xs sm:text-2xs font-semibold rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        <Clock size={11} />
                        {__('Draft', 'codeclove-school-management')}
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-bg-subtle text-text font-semibold text-3xs sm:text-2xs">
                      <Users size={11} className="text-text-subtle" />
                      {searchQuery
                        ? sprintf(__('%1$d of %2$d', 'codeclove-school-management'), filteredRecordsList.length, totalCount)
                        : sprintf(__('%d Students', 'codeclove-school-management'), totalCount)}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold text-3xs sm:text-2xs">
                      <Check size={11} className="stroke-[2.5]" />
                      {sprintf(__('Present: %d', 'codeclove-school-management'), counts.present)}
                      {counts.late > 0 && <span className="font-normal">(+{counts.late}L)</span>}
                    </span>

                    {counts.absent > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold text-3xs sm:text-2xs">
                        <X size={11} className="stroke-[2.5]" />
                        {sprintf(__('Absent: %d', 'codeclove-school-management'), counts.absent)}
                      </span>
                    )}

                    {counts.halfDay > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-orange-500/10 text-orange-700 dark:text-orange-400 font-semibold text-3xs sm:text-2xs">
                        <Sun size={11} />
                        {sprintf(__('Half: %d', 'codeclove-school-management'), counts.halfDay)}
                      </span>
                    )}

                    {counts.leave > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-400 font-semibold text-3xs sm:text-2xs">
                        <CalendarMinus size={11} />
                        {sprintf(__('Leave: %d', 'codeclove-school-management'), counts.leave)}
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-400 font-bold text-3xs sm:text-2xs">
                      <Clock size={11} />
                      {sprintf(__('Rate: %d%%', 'codeclove-school-management'), attendanceRate)}
                    </span>

                    {isDirty && (
                      <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-3xs font-bold rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 animate-pulse">
                        • {__('Unsaved changes', 'codeclove-school-management')}
                      </span>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 flex-1 sm:flex-initial px-3 text-2xs font-semibold gap-1.5 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30"
                      onClick={() => handleMarkAll('present')}
                    >
                      <Check size={12} className="text-emerald-600 stroke-[2.5]" />
                      <span>{__('Mark All Present', 'codeclove-school-management')}</span>
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className={`h-8 flex-1 sm:flex-initial gap-1.5 px-4 text-xs font-semibold transition-all ${
                        isDirty ? 'ring-2 ring-brand ring-offset-1 shadow-sm' : ''
                      }`}
                    >
                      <Save size={13} />
                      <span>
                        {saveMutation.isPending
                          ? __('Saving...', 'codeclove-school-management')
                          : isDirty
                          ? __('Save Changes', 'codeclove-school-management')
                          : __('Save', 'codeclove-school-management')}
                      </span>
                    </Button>
                  </div>
                </div>

                {/* ── Desktop View: Attendance Roster Table (md and up) ── */}
                <div className="hidden md:block overflow-x-auto">
                  <TableRoot className="min-w-[700px]">
                    <Thead className="bg-bg-subtle/40">
                      <Tr>
                        <Th className="py-2.5 px-4 sm:px-5 text-left text-2xs uppercase tracking-wider text-text-muted font-semibold min-w-[240px] sm:min-w-[280px]">
                          {__('Student', 'codeclove-school-management')}
                        </Th>
                        <Th className="py-2.5 px-4 text-center text-2xs uppercase tracking-wider text-text-muted font-semibold w-[340px]">
                          {__('Status', 'codeclove-school-management')}
                        </Th>
                        <Th className="py-2.5 px-4 text-left text-2xs uppercase tracking-wider text-text-muted font-semibold">
                          {__('Remarks / Note', 'codeclove-school-management')}
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody className="divide-y divide-border/30">
                      {filteredRecordsList.map((r) => {
                        const local = localRecords[r.student_id] || { status: 'present', note: '' }
                        const studentName = `${r.first_name} ${r.last_name}`
                        const rollText = sprintf(__('Roll: %s', 'codeclove-school-management'), r.roll_number || __('N/A', 'codeclove-school-management'))
                        const subtitleText =
                          !groupId && r.group_name
                            ? `${r.group_name} • ${rollText}`
                            : rollText

                        return (
                          <Tr key={r.student_id} className="hover:bg-bg-overlay/5 transition-colors">
                            {/* Column 1: Student Profile (Name, ID, Section, Roll) */}
                            <Td className="py-2.5 px-4 sm:px-5 min-w-[240px] sm:min-w-[280px]">
                              <PersonAvatar
                                name={studentName}
                                subtitle={subtitleText}
                                idNumber={r.student_number || undefined}
                              />
                            </Td>

                            {/* Column 2: Attendance Status */}
                            <Td className="py-2.5 px-4 text-center w-[340px]">
                              <AttendanceStatusSelector
                                status={local.status}
                                onChange={(newStatus) => handleStatusChange(r.student_id, newStatus)}
                                label={sprintf(__('Attendance status for %s', 'codeclove-school-management'), studentName)}
                              />
                            </Td>

                            {/* Column 3: Remarks / Note */}
                            <Td className="py-2.5 px-4 text-left">
                              <AttendanceNotePopover
                                note={local.note}
                                onChange={(newNote) => handleNoteChange(r.student_id, newNote)}
                                studentName={studentName}
                              />
                            </Td>
                          </Tr>
                        )
                      })}
                    </Tbody>
                  </TableRoot>
                </div>

                {/* ── Mobile View: Touch-Friendly Card List (below md) ── */}
                <div className="block md:hidden divide-y divide-border/40">
                  {filteredRecordsList.map((r) => {
                    const local = localRecords[r.student_id] || { status: 'present', note: '' }
                    const studentName = `${r.first_name} ${r.last_name}`
                    const rollText = sprintf(__('Roll: %s', 'codeclove-school-management'), r.roll_number || __('N/A', 'codeclove-school-management'))
                    const subtitleText =
                      !groupId && r.group_name
                        ? `${r.group_name} • ${rollText}`
                        : rollText

                    return (
                      <div key={r.student_id} className="p-3 space-y-2 hover:bg-bg-overlay/5 transition-colors">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <PersonAvatar
                              name={studentName}
                              subtitle={subtitleText}
                              idNumber={r.student_number || undefined}
                              className="min-w-0"
                            />
                          </div>
                          <div className="shrink-0">
                            <AttendanceNotePopover
                              note={local.note}
                              onChange={(newNote) => handleNoteChange(r.student_id, newNote)}
                              studentName={studentName}
                            />
                          </div>
                        </div>
                        <div className="pt-1">
                          <AttendanceStatusSelector
                            status={local.status}
                            onChange={(newStatus) => handleStatusChange(r.student_id, newStatus)}
                            label={sprintf(__('Attendance status for %s', 'codeclove-school-management'), studentName)}
                            fullWidth={true}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* ── Minimal Footer ── */}
                <div className="px-4 sm:px-5 py-2.5 bg-bg-surface/50 border-t border-border flex items-center justify-between text-2xs text-text-subtle">
                  <span>
                    {sprintf(__('Showing %d enrolled students', 'codeclove-school-management'), filteredRecordsList.length)}
                  </span>
                </div>
              </div>
            ) : (
              <TableRoot>
                <Tbody>
                  <TableEmpty colSpan={3} message={__('No students enrolled in this class context.', 'codeclove-school-management')} />
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
            'Select a class, section (if applicable), and date above to load the student register and record daily attendance.',
            'codeclove-school-management'
          )}
        />
      )}

      {/* ── Mobile Floating Quick-Save Dock (shows only when changes pending) ── */}
      {isDirty && (
        <div className="fixed bottom-4 left-4 right-4 z-40 sm:hidden flex items-center justify-between p-3 px-4 bg-bg-surface border border-border shadow-lg rounded-2xl animate-slide-up">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="text-xs font-semibold text-text truncate">{__('Unsaved changes', 'codeclove-school-management')}</span>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="h-9 px-4 text-xs font-bold gap-1.5 shadow-sm rounded-xl shrink-0"
          >
            <Save size={13} />
            {saveMutation.isPending ? __('Saving...', 'codeclove-school-management') : __('Save Now', 'codeclove-school-management')}
          </Button>
        </div>
      )}
    </div>
  )
}
