import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CalendarDays, CheckCircle2, Clock, Save, Check, X,
  Users, RefreshCw, ChevronLeft, ChevronRight, Sun, CalendarMinus,
  Search, FilterX
} from 'lucide-react'
import { useStaffAttendanceRegister, useSaveStaffAttendance } from '@/api/attendance'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { __, sprintf } from '@/lib/i18n'
import {
  Button, Card, CardContent, Select, DatePicker, EmptyState, PersonAvatar,
  TableRoot, Thead, Tbody, Tr, Th, Td, TableEmpty, TableSkeleton, Input, Alert
} from '@/components/ui'
import { AttendanceStatusSelector } from './components/AttendanceStatusSelector'
import { AttendanceNotePopover } from './components/AttendanceNotePopover'

export default function StaffDailyAttendance() {
  const toast = useToast()
  const { getLabel } = useLabels()
  const staffLabelSingular = getLabel('staff_member', false, __('Staff', 'codeclove-school-management'))

  // Filters State
  const [departmentFilter, setDepartmentFilter] = useState<string>('')
  const [designationFilter, setDesignationFilter] = useState<string>('')
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0] || '')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Local Attendance Register state (for daily editing)
  const [localRecords, setLocalRecords] = useState<Record<number, { status: string; note: string }>>({})

  // Daily staff attendance query
  const {
    data: registerRecords,
    isLoading: isDailyLoading,
    isError: isDailyError,
    refetch: refetchDaily,
  } = useStaffAttendanceRegister(date)
  const saveMutation = useSaveStaffAttendance()
  // Check if attendance for this day has already been saved to the database
  const isAlreadySubmitted = useMemo(() => {
    if (!registerRecords || registerRecords.length === 0) return false
    return registerRecords.some((r) => r.attendance_id !== null)
  }, [registerRecords])
  // Track if user has made unsaved changes by comparing directly against server data
  const isDirty = useMemo(() => {
    if (!registerRecords || registerRecords.length === 0) return false
    return registerRecords.some((r) => {
      const curr = localRecords[r.staff_member_id]
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

  // Synced state initialization for daily edit
  useEffect(() => {
    if (!registerRecords) return
    const initialMap: Record<number, { status: string; note: string }> = {}
    registerRecords.forEach((r) => {
      initialMap[r.staff_member_id] = {
        status: r.status || 'present',
        note: r.note || '',
      }
    })
    setLocalRecords(initialMap)
  }, [registerRecords])

  const handleStatusChange = (staffId: number, status: string) => {
    setLocalRecords((prev) => {
      const current = prev[staffId] || { status: 'present', note: '' }
      return {
        ...prev,
        [staffId]: {
          status,
          note: current.note,
        },
      }
    })
  }

  const handleNoteChange = (staffId: number, note: string) => {
    setLocalRecords((prev) => {
      const current = prev[staffId] || { status: 'present', note: '' }
      return {
        ...prev,
        [staffId]: {
          status: current.status,
          note,
        },
      }
    })
  }

  const handleSave = () => {
    if (!date) return

    const recordsArray = Object.entries(localRecords).map(([staffId, data]) => ({
      staff_member_id: Number(staffId),
      status: data.status,
      note: data.note,
    }))

    saveMutation.mutate(
      {
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
      updated[r.staff_member_id] = {
        status,
        note: updated[r.staff_member_id]?.note ?? '',
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

  // Raw list and options
  const recordsList = registerRecords ?? []
  const totalCount = recordsList.length

  // Extract unique departments & designations for dynamic filter options
  const departmentsList = useMemo(() => [...new Set(recordsList.map((s) => s.department).filter(Boolean))].sort() as string[], [recordsList])
  const designationsList = useMemo(() => [...new Set(recordsList.map((s) => s.designation).filter(Boolean))].sort() as string[], [recordsList])

  // Daily statistics computed in a single pass
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

  // Standard education/workforce formula: Present(1.0) + Late(1.0) + HalfDay(0.5)
  const effectiveAttended = counts.present + counts.late + 0.5 * counts.halfDay
  const attendanceRate = totalCount > 0 ? Math.round((effectiveAttended / totalCount) * 100) : 0

  // Filtered by department, designation, and instant search
  const filteredRecordsList = useMemo(() => {
    return recordsList.filter((r) => {
      const fullName = `${r.first_name} ${r.last_name}`.toLowerCase()
      const staffNum = (r.staff_number || '').toLowerCase()
      const query = searchQuery.trim().toLowerCase()

      const matchesSearch = !query || fullName.includes(query) || staffNum.includes(query)
      const matchesDept = !departmentFilter || r.department === departmentFilter
      const matchesDesig = !designationFilter || r.designation === designationFilter

      return matchesSearch && matchesDept && matchesDesig
    })
  }, [recordsList, searchQuery, departmentFilter, designationFilter])


  return (
    <div className={`space-y-3 ${isDirty ? 'pb-20 sm:pb-0' : ''}`}>
      {/* ── Tier 1: Filters Toolbar ── */}
      <div className="p-3 bg-bg-elevated border border-border rounded-xl shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Controls: Department, Role/Designation, Date Stepper */}
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
                disabled={isDailyLoading}
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
                disabled={isDailyLoading}
                className="h-9 text-xs"
              />
            </div>

            {/* Date with integrated Prev / Today / Next steppers */}
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => shiftDate(-1)}
                className="h-9 w-8 flex items-center justify-center rounded-lg border border-border bg-bg-surface hover:bg-hover-bg text-text-subtle hover:text-text transition-colors shrink-0"
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
                className="h-9 w-8 flex items-center justify-center rounded-lg border border-border bg-bg-surface hover:bg-hover-bg text-text-subtle hover:text-text transition-colors shrink-0"
                title={__('Next Day', 'codeclove-school-management')}
                aria-label={__('Next Day', 'codeclove-school-management')}
              >
                <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={setTodayDate}
                className="h-9 px-2.5 text-2xs font-semibold rounded-lg border border-border bg-bg-surface hover:bg-hover-bg text-text-subtle hover:text-text transition-colors shrink-0"
                title={__('Jump to Today', 'codeclove-school-management')}
              >
                {__('Today', 'codeclove-school-management')}
              </button>
            </div>
          </div>

          {/* Staff Search */}
          <div className="w-full sm:w-52 relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={__('Search staff...', 'codeclove-school-management')}
              disabled={isDailyLoading}
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

      {date ? (
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
                  {__('Could not retrieve staff attendance records for this date.', 'codeclove-school-management')}
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

                    <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-bg-surface text-text-muted border border-border text-3xs sm:text-2xs font-medium">
                      <Users size={12} className="text-text-subtle" />
                      {searchQuery || departmentFilter || designationFilter
                        ? sprintf(__('%1$d of %2$d Staff', 'codeclove-school-management'), filteredRecordsList.length, totalCount)
                        : sprintf(__('%d Staff', 'codeclove-school-management'), totalCount)}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-3xs sm:text-2xs font-semibold">
                      <Check size={11} className="stroke-[2.5]" />
                      {sprintf(__('Present: %d', 'codeclove-school-management'), counts.present)}
                      {counts.late > 0 && (
                        <span className="text-amber-700 dark:text-amber-400 font-normal">
                          (+{counts.late}L)
                        </span>
                      )}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-3xs sm:text-2xs font-semibold">
                      <X size={11} className="stroke-[2.5]" />
                      {sprintf(__('Absent: %d', 'codeclove-school-management'), counts.absent)}
                    </span>

                    {counts.halfDay > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-3xs sm:text-2xs font-semibold">
                        <Sun size={11} />
                        {sprintf(__('Half: %d', 'codeclove-school-management'), counts.halfDay)}
                      </span>
                    )}

                    {counts.leave > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 text-3xs sm:text-2xs font-semibold">
                        <CalendarMinus size={11} />
                        {sprintf(__('Leave: %d', 'codeclove-school-management'), counts.leave)}
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 text-3xs sm:text-2xs font-bold">
                      <Clock size={11} />
                      {sprintf(__('Rate: %d%%', 'codeclove-school-management'), attendanceRate)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleMarkAll('present')}
                      disabled={saveMutation.isPending || recordsList.length === 0}
                      className="h-8 text-2xs font-semibold gap-1.5"
                    >
                      <Check size={12} className="text-emerald-600 stroke-[2.5]" />
                      {__('Mark All Present', 'codeclove-school-management')}
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSave}
                      disabled={saveMutation.isPending || recordsList.length === 0 || (isAlreadySubmitted && !isDirty)}
                      className="h-8 text-2xs font-semibold gap-1.5 min-w-[76px]"
                    >
                      {saveMutation.isPending ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          {__('Saving...', 'codeclove-school-management')}
                        </>
                      ) : (
                        <>
                          <Save size={12} />
                          {isAlreadySubmitted && isDirty
                            ? __('Save Changes', 'codeclove-school-management')
                            : __('Save', 'codeclove-school-management')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* ── Tier 3: Register Table (Desktop) ── */}
                <div className="hidden md:block overflow-x-auto">
                  <TableRoot className="min-w-[700px]">
                    <Thead>
                      <Tr className="border-b border-border bg-bg-surface text-2xs uppercase tracking-wider text-text-subtle font-semibold">
                        <Th className="py-2.5 px-4 sm:px-6 text-left">{__('Staff Member', 'codeclove-school-management')}</Th>
                        <Th className="py-2.5 px-4 text-center w-[340px]">{__('Status', 'codeclove-school-management')}</Th>
                        <Th className="py-2.5 px-4 sm:px-6 text-right w-[140px] sm:w-[180px]">{__('Remarks / Note', 'codeclove-school-management')}</Th>
                      </Tr>
                    </Thead>
                    <Tbody className="divide-y divide-border/30">
                      {filteredRecordsList.map((r) => {
                        const local = localRecords[r.staff_member_id] || { status: 'present', note: '' }
                        const staffName = `${r.first_name} ${r.last_name}`
                        const subtitleText = `${r.designation || staffLabelSingular}${r.department ? ` • ${r.department}` : ''}`

                        return (
                          <Tr key={r.staff_member_id} className="hover:bg-hover-bg transition-colors">
                            <Td className="py-2.5 px-4 sm:px-6 text-left">
                              <PersonAvatar
                                name={staffName}
                                subtitle={subtitleText}
                                idNumber={r.staff_number || undefined}
                                className="min-w-0"
                              />
                            </Td>
                            <Td className="py-2.5 px-4 text-center">
                              <AttendanceStatusSelector
                                status={local.status}
                                onChange={(newStatus) => handleStatusChange(r.staff_member_id, newStatus)}
                                label={sprintf(__('Attendance status for %s', 'codeclove-school-management'), staffName)}
                              />
                            </Td>
                            <Td className="py-2.5 px-4 sm:px-6 text-right">
                              <AttendanceNotePopover
                                note={local.note}
                                onChange={(newNote) => handleNoteChange(r.staff_member_id, newNote)}
                                studentName={staffName}
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
                    const local = localRecords[r.staff_member_id] || { status: 'present', note: '' }
                    const staffName = `${r.first_name} ${r.last_name}`
                    const subtitleText = `${r.designation || staffLabelSingular}${r.department ? ` • ${r.department}` : ''}`

                    return (
                      <div key={r.staff_member_id} className="p-3 space-y-2 hover:bg-hover-bg transition-colors">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <PersonAvatar
                              name={staffName}
                              subtitle={subtitleText}
                              idNumber={r.staff_number || undefined}
                              className="min-w-0"
                            />
                          </div>
                          <div className="shrink-0">
                            <AttendanceNotePopover
                              note={local.note}
                              onChange={(newNote) => handleNoteChange(r.staff_member_id, newNote)}
                              studentName={staffName}
                            />
                          </div>
                        </div>
                        <div className="pt-1">
                          <AttendanceStatusSelector
                            status={local.status}
                            onChange={(newStatus) => handleStatusChange(r.staff_member_id, newStatus)}
                            label={sprintf(__('Attendance status for %s', 'codeclove-school-management'), staffName)}
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
                    {sprintf(__('Showing %d staff members', 'codeclove-school-management'), filteredRecordsList.length)}
                  </span>
                </div>
              </div>
            ) : (
              <TableRoot>
                <Tbody>
                  <TableEmpty colSpan={3} message={__('No staff members found matching the selected filters.', 'codeclove-school-management')} />
                </Tbody>
              </TableRoot>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          variant="dashed"
          icon={CalendarDays}
          title={__('Select Attendance Date', 'codeclove-school-management')}
          description={__(
            'Select an attendance date above to open the daily staff register and record attendance.',
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
