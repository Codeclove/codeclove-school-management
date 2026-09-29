import { useState, useMemo, useRef, useEffect } from 'react'
import { UserMinus, Trash2, UserCheck, Pencil, Printer } from 'lucide-react'
import { useTerms, useUnits, useGroups } from '@/api/academics'
import { useStaff } from '@/api/staff'
import { useSettings } from '@/api/settings'
import {
  usePeriods,
  useTimetableSlots,
  useSubstitutes,
  useUpsertSubstitute,
  useDeleteSubstitute,
  type TimetableSlot
} from '@/api/timetable'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import {
  Button,
  Badge,
  Card,
  CardContent,
  FormField,
  Input,
  Select,
  PageHeader,
  Modal,
  ModalFooter,
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  DatePicker,
  PrintLetterhead,
  TableSkeleton,
} from '@/components/ui'
import { Link } from 'react-router-dom'
import { useSession } from '@/lib/session-context'
import { printElement } from '@/lib/print'
import { useFormatter } from '@/lib/formatter'
import { useLabels } from '@/lib/labels'
import { __, sprintf } from '@/lib/i18n'

export default function SubstitutePage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { getLabel } = useLabels()
  const { session } = useSession()
  const sessionId = session?.id ?? 0
  const { data: settings } = useSettings()
  const printRef = useRef<HTMLDivElement>(null)
  const { formatDate } = useFormatter()

  const unitLabelSingular = getLabel('academic_unit', false, __( 'Class', 'codeclove-school-management' ))
  const unitLabelPlural = getLabel('academic_unit', true, __( 'Classes', 'codeclove-school-management' ))
  const groupLabelSingular = getLabel('academic_group', false, __( 'Section', 'codeclove-school-management' ))
  const groupLabelPlural = getLabel('academic_group', true, __( 'Sections', 'codeclove-school-management' ))
  const staffLabelSingular = getLabel('staff_member', false, __( 'Teacher', 'codeclove-school-management' ))
  const staffLabelPlural = getLabel('staff_member', true, __( 'Teachers', 'codeclove-school-management' ))
  const todayStr = new Date().toISOString().split('T')[0] || ''
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [termId, setTermId] = useState<string>('')

  // Filter criteria states
  const [filterUnitId, setFilterUnitId] = useState<string>('')
  const [filterGroupId, setFilterGroupId] = useState<string>('')
  const [filterStaffId, setFilterStaffId] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Assign substitute modal state
  const [subModalOpen, setSubModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null)
  const [assignSubStaffId, setAssignSubStaffId] = useState<string>('')
  const [assignReason, setAssignReason] = useState<string>('')

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: termsData } = useTerms(sessionId)
  const terms = termsData ?? []

  // Auto-select first term
  useMemo(() => {
    if (terms.length > 0 && !termId) {
      const current = terms.find((t: any) => t.status === 'active') || terms[0]
      if (current) setTermId(current.id.toString())
    }
  }, [terms, termId])

  const { data: unitsData } = useUnits({ academic_session_id: sessionId, per_page: 200 })
  const units = unitsData?.data ?? []

  const { data: filterGroupsData } = useGroups(
    filterUnitId ? { academic_unit_id: Number(filterUnitId), per_page: 200 } : undefined
  )
  const filterGroups = filterUnitId && filterGroupsData?.data ? filterGroupsData.data : []

  // Reset section filter when class filter changes
  useEffect(() => {
    setFilterGroupId('')
  }, [filterUnitId])

  const { data: staffData } = useStaff({ status: 'active', per_page: 500 })
  const staffMembers = staffData?.data ?? []

  // Compute day of week for selected date (1=Mon...6=Sat, 0=Sun)
  // Construct Date locally using split parts to avoid UTC timezone shifting offset bugs
  const dayOfWeek = useMemo(() => {
    if (!selectedDate) return 1
    const parts = selectedDate.split('-').map(Number)
    if (parts.length !== 3) return 1
    const [year, month, day] = parts
    if (!year || !month || !day) return 1
    const d = new Date(year, month - 1, day)
    return d.getDay()
  }, [selectedDate])

  // Get ALL scheduled slots for session/term for this day of week
  const { data: dailyBaseSlots = [], isLoading: isLoadingSlots } = useTimetableSlots({
    academic_session_id: sessionId,
    academic_term_id: Number(termId)
  })

  // Get periods (to fetch times)
  const { data: allPeriodsData } = usePeriods({
    academic_session_id: Number(sessionId),
    academic_unit_id: units[0]?.id ?? 0 // default class lookup
  })
  // Memoize periods lookup by id so we're not calling find() in every table cell
  const allPeriods = allPeriodsData ?? []
  const periodsById = useMemo(() => {
    const map: Record<number, typeof allPeriods[number]> = {}
    allPeriods.forEach((p) => { map[p.id] = p })
    return map
  }, [allPeriods])

  // Filter slots to only include this day of week, and sort by class/section
  // Coerce day_of_week to number to avoid strict string-vs-number type mismatch empty lists
  const activeBaseSlots = useMemo(() => {
    return dailyBaseSlots
      .filter((s) => Number(s.day_of_week) === dayOfWeek && s.staff_member_id && Number(s.staff_member_id) !== 0)
      .sort((a, b) => (a.unit_name ?? '').localeCompare(b.unit_name ?? ''))
  }, [dailyBaseSlots, dayOfWeek])

  // Fetch substitute overrides for selected date
  const { data: substitutes = [], isLoading: isLoadingSubs } = useSubstitutes({
    date: selectedDate
  })

  // Map substitutes by slot_id for O(1) matching
  const substitutesLookup = useMemo(() => {
    const map: Record<number, typeof substitutes[number]> = {}
    substitutes.forEach((sub) => {
      map[sub.slot_id] = sub
    })
    return map
  }, [substitutes])

  // Filter base slots based on selection criteria
  const filteredSlots = useMemo(() => {
    return activeBaseSlots.filter((slot) => {
      const hasSub = substitutesLookup[slot.id] !== undefined
      const isFree = hasSub && (!substitutesLookup[slot.id]?.substitute_staff_id || Number(substitutesLookup[slot.id]?.substitute_staff_id) === 0)

      if (filterUnitId && String(slot.academic_unit_id) !== filterUnitId) {
        return false
      }
      if (filterGroupId && String(slot.academic_group_id) !== filterGroupId) {
        return false
      }
      if (filterStaffId && String(slot.staff_member_id) !== filterStaffId) {
        return false
      }
      if (filterStatus && filterStatus !== 'all') {
        if (filterStatus === 'normal' && hasSub) return false
        if (filterStatus === 'subbed' && (!hasSub || isFree)) return false
        if (filterStatus === 'free' && !isFree) return false
      }
      return true
    })
  }, [activeBaseSlots, filterUnitId, filterGroupId, filterStaffId, filterStatus, substitutesLookup])

  // Mutations
  const upsertSubMutation = useUpsertSubstitute()
  const deleteSubMutation = useDeleteSubstitute()

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleOpenAssignModal = (slot: TimetableSlot) => {
    const existing = substitutesLookup[slot.id]
    setSelectedSlot(slot)
    setAssignSubStaffId(existing?.substitute_staff_id && Number(existing.substitute_staff_id) !== 0 ? existing.substitute_staff_id.toString() : '')
    setAssignReason(existing?.reason ?? '')
    setSubModalOpen(true)
  }

  const handleSaveSubstitute = async () => {
    if (!selectedSlot) return

    try {
      await upsertSubMutation.mutateAsync({
        slot_id: selectedSlot.id,
        date: selectedDate,
        substitute_staff_id: assignSubStaffId ? Number(assignSubStaffId) : 0, // 0 = free period/cancelled
        reason: assignReason.trim()
      })
      toast.success(__( 'Substitute coverage saved.', 'codeclove-school-management' ))
      setSubModalOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to save substitute.', 'codeclove-school-management' )
      toast.error(message)
    }
  }

  const handleRemoveSubstitute = async (subId: number) => {
    const isConfirmed = await confirm({
      title: __( 'Remove Substitute', 'codeclove-school-management' ),
      message: __( 'Are you sure you want to remove this substitute assignment? Slot coverage will revert to the original teacher.', 'codeclove-school-management' ),
      confirmText: __( 'Remove', 'codeclove-school-management' )
    })
    if (!isConfirmed) return
    try {
      await deleteSubMutation.mutateAsync(subId)
      toast.success(__( 'Substitute assignment removed.', 'codeclove-school-management' ))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to remove substitute.', 'codeclove-school-management' )
      toast.error(message)
    }
  }

  // Helper: Format day label
  const dayName = useMemo(() => {
    const names = [
      __( 'Sunday', 'codeclove-school-management' ),
      __( 'Monday', 'codeclove-school-management' ),
      __( 'Tuesday', 'codeclove-school-management' ),
      __( 'Wednesday', 'codeclove-school-management' ),
      __( 'Thursday', 'codeclove-school-management' ),
      __( 'Friday', 'codeclove-school-management' ),
      __( 'Saturday', 'codeclove-school-management' ),
    ]
    return names[dayOfWeek] ?? __( 'Unknown', 'codeclove-school-management' )
  }, [dayOfWeek])

  // Check if a replacement teacher has a schedule conflict for this slot
  const isTeacherBusy = (staffId: number) => {
    if (!selectedSlot) return false

    // 1. Check regular timetable slot conflict for this day & period
    const hasBaseConflict = dailyBaseSlots.some((s) =>
      Number(s.day_of_week) === Number(selectedSlot.day_of_week) &&
      Number(s.period_id) === Number(selectedSlot.period_id) &&
      Number(s.staff_member_id) === staffId &&
      Number(s.id) !== Number(selectedSlot.id)
    )
    if (hasBaseConflict) return true

    // 2. Check substitute cover conflict for this date & period
    const hasSubConflict = substitutes.some((sub) =>
      sub.date === selectedDate &&
      Number(sub.period_id) === Number(selectedSlot.period_id) &&
      Number(sub.substitute_staff_id) === staffId &&
      Number(sub.slot_id) !== Number(selectedSlot.id)
    )
    return hasSubConflict
  }

  return (
    <div className="space-y-5 w-full print:p-0 print:space-y-0">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          #adminmenuback, #adminmenuwrap, #wpadminbar, #wpfooter,
          .notice, .update-nag, .print\\:hidden { display: none !important; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          #wpcontent, #wpbody, #wpbody-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          table, th, td { border: 1px solid #999 !important; color: #000 !important; padding: 4px 6px !important; }
          th { font-size: 9px !important; font-weight: 700 !important; background: #f3f4f6 !important; -webkit-print-color-adjust: exact !important; }
          td { font-size: 9px !important; }
        }
      `}</style>
      <div className="print:hidden">
        <PageHeader
          title={__( 'Daily Substitution Manager', 'codeclove-school-management' )}
          breadcrumbs={[{ label: __( 'Academics', 'codeclove-school-management' ) }, { label: __( 'Timetable', 'codeclove-school-management' ), href: '/academics/timetable' }, { label: __( 'Substitutes', 'codeclove-school-management' ) }]}
          description={__( 'Manage teacher coverage schedules and daily replacements. View scheduled lessons for any date, reassign instructors, or mark free periods.', 'codeclove-school-management' )}
          actions={
            <div className="flex gap-2.5">
              <Button
                variant="secondary"
                className="gap-1.5 h-8 text-xs"
                onClick={() => printRef.current && printElement(printRef.current)}
              >
                <Printer size={14} />
                {__( 'Print Register', 'codeclove-school-management' )}
              </Button>
              <Link to="/academics/timetable">
                <Button variant="secondary" className="gap-1.5 h-8 text-xs">
                  {__( 'Back to Timetable', 'codeclove-school-management' )}
                </Button>
              </Link>
            </div>
          }
        />
      </div>

      {/* ─── FILTERS BAR ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3.5 p-3.5 bg-bg-surface border border-border rounded-xl print:hidden shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {/* Date Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-2xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                {__( 'Select Date:', 'codeclove-school-management' )}
              </span>
              <div className="w-full sm:w-auto flex-1 sm:flex-initial min-w-[140px]">
                <DatePicker value={selectedDate} onChange={setSelectedDate} className="h-8 text-xs" />
              </div>
            </div>

            {/* Term Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-2xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                {getLabel('academic_term', false, __( 'Academic Term', 'codeclove-school-management' ))}:
              </span>
              <div className="w-full sm:w-auto flex-1 sm:flex-initial min-w-[140px]">
                <Select value={termId} onValueChange={setTermId} options={terms.map((t: any) => ({ value: t.id.toString(), label: t.name }))} />
              </div>
            </div>
          </div>

          {/* Selected Day indicator */}
          <div className="text-xs text-text-muted font-medium bg-bg-base/40 px-3 py-1.5 rounded-lg border border-border/20">
            {__( 'Selected Day of Week:', 'codeclove-school-management' )} <strong className="text-text ml-1">{dayName}</strong>
          </div>
        </div>

        {/* Search Filter Sub-bar */}
        <div className="border-t border-border/50 pt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* Class Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-2xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
              {unitLabelSingular}:
            </span>
            <div className="w-full sm:w-auto flex-1 sm:flex-initial min-w-[140px]">
              <Select
                value={filterUnitId}
                onValueChange={setFilterUnitId}
                options={[
                  { value: '', label: sprintf( __( 'All %s', 'codeclove-school-management' ), unitLabelPlural ) },
                  ...units.map((u: any) => ({ value: u.id.toString(), label: u.name })),
                ]}
              />
            </div>
          </div>

          {/* Section Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-2xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
              {groupLabelSingular}:
            </span>
            <div className="w-full sm:w-auto flex-1 sm:flex-initial min-w-[140px]">
              <Select
                value={filterGroupId}
                onValueChange={setFilterGroupId}
                options={[
                  { value: '', label: sprintf( __( 'All %s', 'codeclove-school-management' ), groupLabelPlural ) },
                  ...filterGroups.map((g: any) => ({ value: g.id.toString(), label: g.name })),
                ]}
                disabled={!filterUnitId}
              />
            </div>
          </div>

          {/* Teacher Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-2xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
              {staffLabelSingular}:
            </span>
            <div className="w-full sm:w-auto flex-1 sm:flex-initial min-w-[140px]">
              <Select
                value={filterStaffId}
                onValueChange={setFilterStaffId}
                options={[
                  { value: '', label: sprintf( __( 'All %s', 'codeclove-school-management' ), staffLabelPlural ) },
                  ...staffMembers.map((s: any) => ({ value: s.id.toString(), label: `${s.first_name} ${s.last_name}` })),
                ]}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-2xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
              {__( 'Status:', 'codeclove-school-management' )}
            </span>
            <div className="w-full sm:w-auto flex-1 sm:flex-initial min-w-[140px]">
              <Select
                value={filterStatus}
                onValueChange={setFilterStatus}
                options={[
                  { value: 'all', label: __( 'All Statuses', 'codeclove-school-management' ) },
                  { value: 'normal', label: __( 'Normal / Teaching', 'codeclove-school-management' ) },
                  { value: 'subbed', label: __( 'Substitute Assigned', 'codeclove-school-management' ) },
                  { value: 'free', label: __( 'Free Period / Cancelled', 'codeclove-school-management' ) },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── DAILY COVERAGE SHEET ───────────────────────────────────────────────────── */}
      <div ref={printRef}>
        {/* Print-only header */}
        <div className="hidden print:block">
          <PrintLetterhead
            school={settings?.school}
            documentType={__( 'Daily Substitution Register', 'codeclove-school-management' )}
            documentNumber={`${dayName}, ${formatDate(selectedDate)}`}
            metaRows={[
              { label: __( 'Session', 'codeclove-school-management' ), value: session?.label || __( 'Current Session', 'codeclove-school-management' ) },
            ]}
          />
        </div>

      <Card className="print:border-0 print:shadow-none print:bg-transparent">
        <CardContent className="p-4 space-y-4 print:p-0 print:space-y-0">
          <div className="flex items-center justify-between border-b border-border pb-3 print:hidden">
            <div>
              <h3 className="text-sm font-semibold text-text">
                {sprintf( __( 'Daily Coverage Register — %s', 'codeclove-school-management' ), selectedDate )}
              </h3>
              <p className="text-xs text-text-muted">
                {sprintf( __( 'Showing all lectures scheduled on %s and their substitute teacher assignments.', 'codeclove-school-management' ), dayName )}
              </p>
            </div>
            <div className="hidden print:block text-xs font-semibold text-text-muted uppercase tracking-wider">
              {session?.label}
            </div>
          </div>

          {isLoadingSlots || isLoadingSubs ? (
            <TableRoot className="border border-border rounded-xl overflow-hidden bg-bg-surface text-xs">
              <Tbody>
                <TableSkeleton columns={6} rows={6} />
              </Tbody>
            </TableRoot>
          ) : dayOfWeek === 0 ? (
            <div className="text-center py-10 text-xs text-text-muted font-medium">
              {__( 'No classes are scheduled on Sundays. Select a weekday.', 'codeclove-school-management' )}
            </div>
          ) : activeBaseSlots.length === 0 ? (
            <div className="text-center py-10 text-xs text-text-muted font-medium">
              {sprintf( __( 'No classes or timetables have been scheduled for %s in this term.', 'codeclove-school-management' ), dayName )}
            </div>
          ) : filteredSlots.length === 0 ? (
            <div className="text-center py-10 text-xs text-text-muted font-medium">
              {__( 'No classes match the selected filter criteria.', 'codeclove-school-management' )}
            </div>
          ) : (
            <TableRoot className="border border-border rounded-xl overflow-hidden bg-bg-surface text-xs print:border-gray-400 print:rounded-none">
              <Thead>
                <Tr>
                  <Th>{__( 'Class Section', 'codeclove-school-management' )}</Th>
                  <Th type="code">{__( 'Period / Time', 'codeclove-school-management' )}</Th>
                  <Th>{__( 'Subject', 'codeclove-school-management' )}</Th>
                  <Th type="primary">{sprintf( __( 'Regular %s', 'codeclove-school-management' ), staffLabelSingular )}</Th>
                  <Th type="badge">{__( 'Coverage Status', 'codeclove-school-management' )}</Th>
                  <Th type="actions" className="print:hidden">{__( 'Actions', 'codeclove-school-management' )}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredSlots.map((slot) => {
                  const sub = substitutesLookup[slot.id]
                  const hasSub = sub !== undefined

                  return (
                    <Tr key={slot.id} className="hover:bg-hover-bg/10 print:border-b print:border-gray-400">
                      <Td>
                        {slot.unit_name} - {slot.group_name}
                      </Td>
                      <Td type="code">
                        <div className="font-medium text-text">
                          {periodsById[slot.period_id]?.name || __( 'Lecture', 'codeclove-school-management' )}
                        </div>
                        <div className="text-2xs text-text-muted font-mono mt-0.5">
                          {periodsById[slot.period_id]
                            ? `${periodsById[slot.period_id]!.start_time.substring(0, 5)} - ${periodsById[slot.period_id]!.end_time.substring(0, 5)}`
                            : '—'}
                        </div>
                      </Td>
                      <Td>{slot.subject_name}</Td>
                      <Td type="primary">
                        {slot.staff_first_name} {slot.staff_last_name}
                      </Td>
                      <Td type="badge">
                        {hasSub ? (
                          !sub.substitute_staff_id || Number(sub.substitute_staff_id) === 0 ? (
                            <Badge variant="danger" size="sm" className="gap-1 print:border print:border-gray-400 print:text-black print:bg-transparent">
                              <UserMinus size={10} />
                              {__( 'Free Period / Cancelled', 'codeclove-school-management' )}
                            </Badge>
                          ) : (
                            <div className="space-y-1">
                              <Badge variant="active" size="sm" className="gap-1 print:border print:border-gray-400 print:text-black print:bg-transparent">
                                <UserCheck size={10} />
                                {sprintf(
                                  __( 'Subbed by: %1$s %2$s', 'codeclove-school-management' ),
                                  sub.substitute_staff_first_name,
                                  sub.substitute_staff_last_name
                                )}
                              </Badge>
                              {sub.reason && (
                                <p className="text-2xs text-text-subtle italic">"{sub.reason}"</p>
                              )}
                            </div>
                          )
                        ) : (
                          <Badge variant="default" size="sm" className="print:border print:border-gray-400 print:text-black print:bg-transparent">
                            {__( 'Teaching / Normal', 'codeclove-school-management' )}
                          </Badge>
                        )}
                      </Td>
                      <Td type="actions" className="space-x-2 print:hidden">
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenAssignModal(slot)}
                          className="h-7 px-2.5 text-xs gap-1"
                        >
                          <Pencil size={10} />
                          {hasSub ? __( 'Modify', 'codeclove-school-management' ) : __( 'Assign Sub', 'codeclove-school-management' )}
                        </Button>
                        {hasSub && (
                          <Button
                            variant="danger"
                            onClick={() => handleRemoveSubstitute(sub.id)}
                            className="h-7 px-2 text-xs"
                            title={__( 'Remove substitute assignment', 'codeclove-school-management' )}
                          >
                            <Trash2 size={10} />
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </TableRoot>
          )}
        </CardContent>
      </Card>
      </div>

      {/* ─── ASSIGN SUBSTITUTE MODAL ────────────────────────────────────────────────── */}
      <Modal
        open={subModalOpen}
        onOpenChange={setSubModalOpen}
        title={__( 'Assign Substitute Teacher', 'codeclove-school-management' )}
        description={__( 'Select a replacement teacher to take over this lecture slot or cancel the period.', 'codeclove-school-management' )}
      >
        <div className="space-y-4 py-2">
          {selectedSlot && (
            <div className="p-3 bg-bg-base border border-border rounded-lg text-xs space-y-1">
              <div>
                <span className="text-text-muted">{sprintf( __( 'Target %s:', 'codeclove-school-management' ), unitLabelSingular )}</span>{' '}
                <span className="font-semibold text-text">
                  {selectedSlot.unit_name} - {selectedSlot.group_name} ({selectedSlot.subject_name})
                </span>
              </div>
              <div>
                <span className="text-text-muted">{__( 'Scheduled Day & Date:', 'codeclove-school-management' )}</span>{' '}
                <span className="font-semibold text-text">{dayName}, {selectedDate}</span>
              </div>
              <div>
                <span className="text-text-muted">{sprintf( __( 'Absent %s:', 'codeclove-school-management' ), staffLabelSingular )}</span>{' '}
                <span className="font-semibold text-danger">
                  {selectedSlot.staff_first_name} {selectedSlot.staff_last_name}
                </span>
              </div>
            </div>
          )}

          <FormField label={sprintf( __( 'Substitute %s', 'codeclove-school-management' ), staffLabelSingular )}>
            <Select
              value={assignSubStaffId}
              onValueChange={setAssignSubStaffId}
              options={staffMembers
                .filter((s) => selectedSlot && s.id !== selectedSlot.staff_member_id)
                .map((s) => {
                  const busy = isTeacherBusy(s.id)
                  return {
                    value: s.id.toString(),
                    label: busy ? sprintf( __( '%1$s %2$s (Busy)', 'codeclove-school-management' ), s.first_name, s.last_name ) : `${s.first_name} ${s.last_name}`,
                    disabled: busy
                  }
                })}
              placeholder={__( 'Mark Free Period / No Substitute', 'codeclove-school-management' )}
            />
          </FormField>

          <FormField label={__( 'Reason for Absence / Substitution Notes', 'codeclove-school-management' )}>
            <Input
              value={assignReason}
              onChange={(e) => setAssignReason(e.target.value)}
              placeholder={__( 'e.g. Medical leave, Training seminar...', 'codeclove-school-management' )}
            />
          </FormField>
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setSubModalOpen(false)}>
            {__( 'Cancel', 'codeclove-school-management' )}
          </Button>
          <Button onClick={handleSaveSubstitute} disabled={upsertSubMutation.isPending}>
            {upsertSubMutation.isPending ? __( 'Assigning…', 'codeclove-school-management' ) : __( 'Save Cover', 'codeclove-school-management' )}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
