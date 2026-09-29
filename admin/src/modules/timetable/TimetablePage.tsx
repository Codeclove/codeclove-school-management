import { useState, useMemo, useRef } from 'react'
import {
  Clock,
  Printer,
  Calendar,
  AlertTriangle,
  Users,
  UserCheck,
  ArrowRightLeft,
  X,
  Plus,
  GraduationCap
} from 'lucide-react'
import {
  useUnits,
  useGroups,
  useSubjects,
  useTerms
} from '@/api/academics'
import { useStaff } from '@/api/staff'
import { useSettings } from '@/api/settings'
import {
  usePeriods,
  useTimetableSlots,
  useUpsertSlot,
  useDeleteSlot,
  useConflicts,
  type TimetableSlot,
  type TimetablePeriod
} from '@/api/timetable'
import { useLabels } from '@/lib/labels'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { useSession } from '@/lib/session-context'
import {
  Button,
  Badge,
  Card,
  FormField,
  Select,
  PageHeader,
  Modal,
  ModalFooter,
  PrintLetterhead,
  Skeleton,
} from '@/components/ui'
import PeriodConfigModal from './PeriodConfigModal'
import { Link } from 'react-router-dom'
import { printElement } from '@/lib/print'
import { __, sprintf } from '@/lib/i18n'

export default function TimetablePage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { getLabel } = useLabels()
  const { data: settings } = useSettings()
  const { session } = useSession()
  const sessionId = session?.id ?? 0
  const printRef = useRef<HTMLDivElement>(null)

  // ─── Filter States ──────────────────────────────────────────────────────────
  const [termId, setTermId] = useState<string>('')
  const [unitId, setUnitId] = useState<string>('')
  const [groupId, setGroupId] = useState<string>('')

  // View Mode: 'class' (per Class Section) or 'teacher' (per Staff Member)
  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class')
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')

  // Modals & Swapping state
  const [periodModalOpen, setPeriodModalOpen] = useState(false)
  const [cellEditOpen, setCellEditOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ period: TimetablePeriod; day: number } | null>(null)
  
  // Swap slots state
  const [swapSource, setSwapSource] = useState<{ periodId: number; dayOfWeek: number; slot: TimetableSlot | null } | null>(null)

  // Edit cell state
  const [editSubjectId, setEditSubjectId] = useState<string>('')
  const [editStaffId, setEditStaffId] = useState<string>('')
  const [editNotes, setEditNotes] = useState<string>('')

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: termsData } = useTerms(sessionId)
  const terms = termsData ?? []

  // Auto-select first term
  useMemo(() => {
    if (terms.length > 0 && !termId) {
      const current = terms.find((t) => t.status === 'active') || terms[0]
      if (current) setTermId(current.id.toString())
    }
  }, [terms, termId])

  const { data: unitsData } = useUnits({ academic_session_id: sessionId, per_page: 200 })
  const units = unitsData?.data ?? []

  // Auto-select first unit
  useMemo(() => {
    if (units.length > 0 && !unitId && units[0]) {
      setUnitId(units[0].id.toString())
    }
  }, [units, unitId])

  const { data: groupsData } = useGroups({ academic_unit_id: Number(unitId), per_page: 200 })
  const groups = groupsData?.data ?? []

  // Auto-select first group
  useMemo(() => {
    if (groups.length > 0 && !groupId && groups[0]) {
      setGroupId(groups[0].id.toString())
    }
  }, [groups, groupId])

  // Get periods (scoped by academic_unit_id)
  const { data: periods = [], isLoading: isLoadingPeriods } = usePeriods({
    academic_session_id: sessionId,
    academic_unit_id: Number(unitId)
  })

  // Get active staff members for teachers list
  const { data: staffData } = useStaff({ status: 'active', per_page: 500 })
  const staffMembers = staffData?.data ?? []

  // Get all subjects
  const { data: subjectsData } = useSubjects({ per_page: 500 })
  const subjects = subjectsData?.data ?? []

  // Get all slots for current selection
  const { data: slots = [], isLoading: isLoadingSlots } = useTimetableSlots({
    academic_session_id: sessionId,
    academic_term_id: Number(termId),
    academic_unit_id: viewMode === 'class' ? Number(unitId) : undefined,
    academic_group_id: viewMode === 'class' ? Number(groupId) : undefined,
    staff_member_id: viewMode === 'teacher' ? Number(selectedStaffId) : undefined
  })

  // Get all conflicts for session
  const { data: conflicts = [] } = useConflicts(sessionId)

  // Mutations
  const upsertSlotMutation = useUpsertSlot()
  const deleteSlotMutation = useDeleteSlot()

  // ─── Day Columns Configuration ──────────────────────────────────────────────
  const isIndianSchool = settings?.education_system?.preset === 'IN'
  const daysOfWeek = useMemo(() => {
    const list = [
      { value: 1, label: __( 'Monday', 'codeclove-school-management' ) },
      { value: 2, label: __( 'Tuesday', 'codeclove-school-management' ) },
      { value: 3, label: __( 'Wednesday', 'codeclove-school-management' ) },
      { value: 4, label: __( 'Thursday', 'codeclove-school-management' ) },
      { value: 5, label: __( 'Friday', 'codeclove-school-management' ) }
    ]
    if (isIndianSchool || settings?.localization?.week_start_day === 1) {
      list.push({ value: 6, label: __( 'Saturday', 'codeclove-school-management' ) })
    }
    return list
  }, [isIndianSchool, settings])

  // Map slots into indexable grid lookup [periodId][dayOfWeek]
  const slotsLookup = useMemo(() => {
    const lookup: Record<number, Record<number, TimetableSlot>> = {}
    slots.forEach((s) => {
      if (!lookup[s.period_id]) {
        lookup[s.period_id] = {}
      }
      const periodMap = lookup[s.period_id]
      if (periodMap) {
        periodMap[s.day_of_week] = s
      }
    })
    return lookup
  }, [slots])

  // Map conflicts by slot_id for quick cell highlight
  const conflictSlots = useMemo(() => {
    const set = new Set<number>()
    conflicts.forEach((c) => {
      set.add(c.slot_id_1)
      set.add(c.slot_id_2)
    })
    return set
  }, [conflicts])

  // ─── Handlers ───────────────────────────────────────────────────────────────
  
  const handleCellClick = (period: TimetablePeriod, day: number) => {
    if (period.type !== 'lesson') return // Cannot schedule on breaks

    const existingSlot = slotsLookup[period.id]?.[day]

    // If in swapping mode
    if (swapSource) {
      if (swapSource.periodId === period.id && swapSource.dayOfWeek === day) {
        setSwapSource(null) // Cancel swap
        return
      }

      executeSwap(swapSource, period.id, day, existingSlot || null)
      return
    }

    setSelectedCell({ period, day })
    setEditSubjectId(existingSlot?.subject_id && Number(existingSlot.subject_id) !== 0 ? existingSlot.subject_id.toString() : '')
    setEditStaffId(existingSlot?.staff_member_id && Number(existingSlot.staff_member_id) !== 0 ? existingSlot.staff_member_id.toString() : '')
    setEditNotes(existingSlot?.notes ?? '')
    setCellEditOpen(true)
  }

  const handleSaveCell = async () => {
    if (!selectedCell) return

    try {
      if (!editSubjectId && !editStaffId) {
        // Clear cell if nothing selected
        const existing = slotsLookup[selectedCell.period.id]?.[selectedCell.day]
        if (existing) {
          await deleteSlotMutation.mutateAsync(existing.id)
        }
      } else {
        await upsertSlotMutation.mutateAsync({
          academic_session_id: Number(sessionId),
          academic_term_id: Number(termId),
          academic_unit_id: Number(unitId),
          academic_group_id: Number(groupId),
          period_id: selectedCell.period.id,
          day_of_week: selectedCell.day,
          subject_id: editSubjectId ? Number(editSubjectId) : null,
          staff_member_id: editStaffId ? Number(editStaffId) : null,
          notes: editNotes.trim()
        })
      }
      toast.success(__( 'Timetable cell saved.', 'codeclove-school-management' ))
      setCellEditOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to save cell.', 'codeclove-school-management' )
      toast.error(message)
    }
  }

  const handleClearCell = async (slotId: number) => {
    const isConfirmed = await confirm({
      title: __( 'Clear Slot', 'codeclove-school-management' ),
      message: __( 'Are you sure you want to clear this slot?', 'codeclove-school-management' ),
      confirmText: __( 'Clear Slot', 'codeclove-school-management' )
    })
    if (!isConfirmed) return
    try {
      await deleteSlotMutation.mutateAsync(slotId)
      toast.success(__( 'Slot cleared.', 'codeclove-school-management' ))
      setCellEditOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to clear slot.', 'codeclove-school-management' )
      toast.error(message)
    }
  }

  const startSwapMode = (periodId: number, dayOfWeek: number, slot: TimetableSlot | null) => {
    setSwapSource({ periodId, dayOfWeek, slot })
    setCellEditOpen(false)
    toast.success(__( 'Select target cell to move / swap slot.', 'codeclove-school-management' ))
  }

  const executeSwap = async (
    source: typeof swapSource,
    targetPeriodId: number,
    targetDay: number,
    targetSlot: TimetableSlot | null
  ) => {
    if (!source) return

    try {
      // 1. Move source to target
      if (source.slot) {
        await upsertSlotMutation.mutateAsync({
          academic_session_id: Number(sessionId),
          academic_term_id: Number(termId),
          academic_unit_id: Number(unitId),
          academic_group_id: Number(groupId),
          period_id: targetPeriodId,
          day_of_week: targetDay,
          subject_id: source.slot.subject_id,
          staff_member_id: source.slot.staff_member_id,
          notes: source.slot.notes
        })
      } else {
        // If source was empty, delete target
        if (targetSlot) {
          await deleteSlotMutation.mutateAsync(targetSlot.id)
        }
      }

      // 2. Move target to source
      if (targetSlot) {
        await upsertSlotMutation.mutateAsync({
          academic_session_id: Number(sessionId),
          academic_term_id: Number(termId),
          academic_unit_id: Number(unitId),
          academic_group_id: Number(groupId),
          period_id: source.periodId,
          day_of_week: source.dayOfWeek,
          subject_id: targetSlot.subject_id,
          staff_member_id: targetSlot.staff_member_id,
          notes: targetSlot.notes
        })
      } else {
        // If target was empty, delete source
        if (source.slot) {
          await deleteSlotMutation.mutateAsync(source.slot.id)
        }
      }

      toast.success(__( 'Slots swapped successfully.', 'codeclove-school-management' ))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to swap slots.', 'codeclove-school-management' )
      toast.error(message)
    } finally {
      setSwapSource(null)
    }
  }

  const handlePrint = () => {
    if (printRef.current) {
      printElement(printRef.current)
    }
  }

  // ─── Render Options ───────────────────────────────────────────────────────────
  const termOptions = terms.map((t) => ({ value: t.id.toString(), label: t.name }))
  const unitOptions = units.map((u) => ({ value: u.id.toString(), label: u.name }))
  const groupOptions = groups.map((g) => ({ value: g.id.toString(), label: g.name }))
  const staffOptions = staffMembers.map((s) => ({
    value: s.id.toString(),
    label: `${s.first_name} ${s.last_name} (${s.staff_number})`
  }))

  const selectedUnitName = units.find((u) => u.id.toString() === unitId)?.name ?? getLabel('academic_unit', false, __( 'Class', 'codeclove-school-management' ))
  const selectedGroupName = groups.find((g) => g.id.toString() === groupId)?.name ?? ''
  const selectedTermName = terms.find((t) => t.id.toString() === termId)?.name
  const printTimestamp = useMemo(() => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), [])

  const selectedStaff = staffMembers.find((s) => s.id.toString() === selectedStaffId)
  const selectedStaffName = selectedStaff ? `${selectedStaff.first_name} ${selectedStaff.last_name}` : ''

  return (
    <div className="space-y-5 w-full print:p-0 print:space-y-0">
      <style>{`
        @media print {
          /* Hide WordPress Admin interface components */
          #adminmenuback,
          #adminmenuwrap,
          #wpadminbar,
          #wpfooter,
          .notice,
          .update-nag,
          .print\\:hidden {
            display: none !important;
          }
          /* Override WordPress body layouts and content offsets */
          html, body {
            background: #fff !important;
            color: #000 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #wpcontent,
          #wpbody,
          #wpbody-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
        }
      `}</style>
      <div className="print:hidden">
        <PageHeader
          title={__( 'Timetable & Schedules', 'codeclove-school-management' )}
          breadcrumbs={[{ label: __( 'Academics', 'codeclove-school-management' ) }, { label: __( 'Timetable', 'codeclove-school-management' ) }]}
          description={__( 'Manage academic period slots, schedule weekly lectures, resolve teacher double-booking conflicts, and assign daily substitution covers.', 'codeclove-school-management' )}
          actions={
            <div className="flex gap-2.5">
              <Link to="/academics/timetable/substitutes">
                <Button variant="secondary" className="gap-1.5 h-8 text-xs">
                  <UserCheck size={14} />
                  {__( 'Daily Substitutes', 'codeclove-school-management' )}
                </Button>
              </Link>
              <Button onClick={handlePrint} variant="secondary" className="gap-1.5 h-8 text-xs">
                <Printer size={14} />
                {__( 'Print Timetable', 'codeclove-school-management' )}
              </Button>
            </div>
          }
        />
      </div>

      {/* ─── FILTERS BAR ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 bg-bg-surface border border-border rounded-xl print:hidden shadow-2xs">
        {/* Left Side: View Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-bg-surface border border-border/70 shadow-2xs w-fit self-start md:self-auto">
          <button
            onClick={() => setViewMode('class')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-150 select-none ${
              viewMode === 'class'
                ? 'bg-brand-dim text-brand border border-brand/30 font-bold shadow-2xs'
                : 'text-text hover:text-brand hover:bg-bg-subtle/50 border border-transparent'
            }`}
          >
            <GraduationCap size={14} className={viewMode === 'class' ? 'text-brand' : 'text-text-subtle'} />
            <span>{__( 'Class View', 'codeclove-school-management' )}</span>
          </button>
          <button
            onClick={() => setViewMode('teacher')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-150 select-none ${
              viewMode === 'teacher'
                ? 'bg-brand-dim text-brand border border-brand/30 font-bold shadow-2xs'
                : 'text-text hover:text-brand hover:bg-bg-subtle/50 border border-transparent'
            }`}
          >
            <Users size={14} className={viewMode === 'teacher' ? 'text-brand' : 'text-text-subtle'} />
            <span>{__( 'Teacher View', 'codeclove-school-management' )}</span>
          </button>
        </div>

        {/* Right Side: Filters List */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Term Filter */}
          <div className="flex items-center gap-2">
            <span className="text-2xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
              {getLabel('academic_term', false, __( 'Academic Term', 'codeclove-school-management' ))}:
            </span>
            <div className="w-full sm:w-44 md:w-56 flex-1 sm:flex-initial">
              <Select value={termId} onValueChange={setTermId} options={termOptions} />
            </div>
          </div>

          {viewMode === 'class' ? (
            <>
              {/* Unit/Class Filter */}
              <div className="flex items-center gap-2">
                <span className="text-2xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                  {getLabel('academic_unit', false, __( 'Class', 'codeclove-school-management' ))}:
                </span>
                <div className="w-full sm:w-44 md:w-56 flex-1 sm:flex-initial">
                  <Select value={unitId} onValueChange={(val) => { setUnitId(val); setGroupId(''); }} options={unitOptions} />
                </div>
              </div>

              {/* Group/Section Filter */}
              <div className="flex items-center gap-2">
                <span className="text-2xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                  {getLabel('academic_group', false, __( 'Section', 'codeclove-school-management' ))}:
                </span>
                <div className="w-full sm:w-44 md:w-56 flex-1 sm:flex-initial">
                  <Select value={groupId} onValueChange={setGroupId} options={groupOptions} />
                </div>
              </div>
            </>
          ) : (
            /* Teacher Filter */
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                {getLabel('staff_member', false, __( 'Teacher', 'codeclove-school-management' ))}:
              </span>
              <div className="w-full sm:w-44 md:w-56 flex-1 sm:flex-initial">
                <Select
                  value={selectedStaffId}
                  onValueChange={setSelectedStaffId}
                  options={staffOptions}
                  placeholder={sprintf( __( 'Select %s...', 'codeclove-school-management' ), getLabel('staff_member', false, __( 'Teacher', 'codeclove-school-management' )) )}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── CONFLICTS BAR ────────────────────────────────────────────────────────── */}
      {conflicts.length > 0 && (
        <div className="p-4 rounded-xl bg-danger-dim border border-danger/25 text-danger flex items-start gap-3 print:hidden">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">{__( 'Teacher Booking Conflicts Detected', 'codeclove-school-management' )}</h4>
            <ul className="text-xs list-disc pl-4 space-y-1 opacity-90">
              {conflicts.slice(0, 5).map((c, i) => (
                <li key={i}>
                  {sprintf(
                    __( '%1$s %2$s is double-booked on %3$s during %4$s (%5$s - %6$s) in %7$s %8$s and %9$s %10$s.', 'codeclove-school-management' ),
                    c.staff_first_name,
                    c.staff_last_name,
                    daysOfWeek.find((d) => d.value === c.day_of_week)?.label ?? '',
                    c.period_name,
                    c.start_time.substring(0, 5),
                    c.end_time.substring(0, 5),
                    c.unit_name_1,
                    c.group_name_1,
                    c.unit_name_2,
                    c.group_name_2
                  )}
                </li>
              ))}
              {conflicts.length > 5 && (
                <li className="list-none font-semibold">
                  {sprintf( __( '+ %d more conflicts in this session', 'codeclove-school-management' ), conflicts.length - 5 )}
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Swap Mode banner */}
      {swapSource && (
        <div className="p-3 rounded-lg bg-brand-dim border border-brand/25 text-brand flex items-center justify-between text-xs animate-pulse print:hidden">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={14} />
            <span>
              {sprintf(
                __( 'Moving slot: %s. Click target cell to swap or place.', 'codeclove-school-management' ),
                swapSource.slot ? swapSource.slot.subject_name : __( 'Empty Slot', 'codeclove-school-management' )
              )}
            </span>
          </div>
          <button onClick={() => setSwapSource(null)} className="hover:opacity-80">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── TIMETABLE GRID ────────────────────────────────────────────────────────── */}
      <div ref={printRef}>
        <style>{`
          @page {
            size: A4 landscape;
            margin: 7mm 8mm;
          }
          @media print {
            table.timetable-grid {
              border-collapse: collapse !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              border: 1px solid #d1d5db !important;
            }
            table.timetable-grid tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              border-bottom: 1px solid #d1d5db !important;
            }
            table.timetable-grid th {
              padding: 4px 6px !important;
              font-size: 10px !important;
              background-color: #f3f4f6 !important;
              border: 1px solid #d1d5db !important;
              color: #000 !important;
            }
            table.timetable-grid td {
              border: 1px solid #d1d5db !important;
              color: #000 !important;
            }
            .timetable-period-col {
              padding: 3px 5px !important;
              background-color: #f9fafb !important;
              width: 85px !important;
            }
            .timetable-slot-cell {
              padding: 3px 4px !important;
              height: auto !important;
            }
            .slot-card, .slot-empty {
              min-height: 0 !important;
            }
            .slot-empty {
              padding: 2px 0 !important;
              border: none !important;
            }
            .is-break-row td {
              padding: 2px 4px !important;
              background-color: #f3f4f6 !important;
            }
          }
        `}</style>
        <Card className="overflow-hidden shadow-sm border border-border print:border-none print:shadow-none print:bg-transparent print:rounded-none">
        <div className="p-4 border-b border-border bg-bg-surface flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <Calendar className="text-text-muted" size={16} />
            <span className="text-sm font-semibold text-text">
              {viewMode === 'class'
                ? sprintf( __( '%1$s - %2$s Timetable', 'codeclove-school-management' ), selectedUnitName, selectedGroupName )
                : __( 'Teacher Timetable', 'codeclove-school-management' )}
            </span>
          </div>
          {viewMode === 'class' && (
            <Button onClick={() => setPeriodModalOpen(true)} className="gap-1 px-3 py-1 h-7 text-xs" variant="secondary">
              <Clock size={12} />
              {__( 'Configure Periods', 'codeclove-school-management' )}
            </Button>
          )}
        </div>

        {/* Print-only Header */}
        <div className="hidden print:block">
          <PrintLetterhead
            compact
            school={settings?.school}
            documentType={__( 'Weekly Timetable', 'codeclove-school-management' )}
            documentNumber={
              viewMode === 'class'
                ? sprintf( __( 'Class: %1$s%2$s', 'codeclove-school-management' ), selectedUnitName || __( 'All Classes', 'codeclove-school-management' ), selectedGroupName ? ` — ${selectedGroupName}` : '' )
                : sprintf( __( 'Teacher: %s', 'codeclove-school-management' ), selectedStaffName || __( 'All Faculty', 'codeclove-school-management' ) )
            }
            metaRows={[
              { label: __( 'Session', 'codeclove-school-management' ), value: session?.label || __( 'Current Session', 'codeclove-school-management' ) },
              ...(selectedTermName ? [{ label: __( 'Term', 'codeclove-school-management' ), value: selectedTermName }] : []),
            ]}
          />
        </div>

        <div className="overflow-x-auto w-full">
          {isLoadingPeriods || isLoadingSlots ? (
            <div className="p-8">
              <Skeleton className="h-64 w-full rounded" />
            </div>
          ) : periods.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
              <Clock size={40} className="text-text-subtle" />
              <div>
                <h3 className="text-sm font-semibold text-text">{__( 'No Periods Set Up', 'codeclove-school-management' )}</h3>
                <p className="text-xs text-text-muted mt-1 max-w-xs">
                  {sprintf( __( 'Configure period timings for %s to begin adding scheduling slots.', 'codeclove-school-management' ), selectedUnitName )}
                </p>
              </div>
              <Button onClick={() => setPeriodModalOpen(true)} className="gap-1 h-8 text-xs">
                <Plus size={12} />
                {__( 'Configure Periods', 'codeclove-school-management' )}
              </Button>
            </div>
          ) : (
            <table className="timetable-grid w-full border-collapse border-spacing-0 table-fixed">
              <thead>
                <tr className="bg-bg-base/40 border-b border-border">
                  <th className="p-3 text-left text-xs font-semibold text-text-subtle w-32 border-r border-border">
                    {__( 'Period', 'codeclove-school-management' )}
                  </th>
                  {daysOfWeek.map((day) => (
                    <th key={day.value} className="p-3 text-center text-xs font-semibold text-text-subtle border-r border-border last:border-r-0">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => {
                  const isBreak = period.type !== 'lesson'

                  return (
                    <tr
                      key={period.id}
                      className={`border-b border-border last:border-b-0 ${
                        isBreak ? 'bg-bg-base/20 is-break-row' : 'hover:bg-hover-bg/5'
                      }`}
                    >
                      {/* Period Header Column */}
                      <td className="timetable-period-col p-3 border-r border-border text-xs">
                        <div className="font-semibold text-text print:text-2xs leading-tight">
                          {period.name}
                          {isBreak && (
                            <span className="hidden print:inline text-[8px] font-normal text-text-muted ml-1">
                              ({period.type})
                            </span>
                          )}
                        </div>
                        <div className="text-2xs text-text-muted font-mono mt-0.5 print:mt-0 print:text-[9px] print:text-gray-600 whitespace-nowrap">
                          {period.start_time.substring(0, 5)} – {period.end_time.substring(0, 5)}
                        </div>
                        {isBreak && (
                          <Badge variant="default" className="mt-1 text-2xs uppercase tracking-wider scale-90 origin-left print:hidden">
                            {period.type}
                          </Badge>
                        )}
                      </td>

                      {/* Day Columns */}
                      {isBreak ? (
                        <td
                          colSpan={daysOfWeek.length}
                          className="p-1.5 text-center text-xs font-bold uppercase tracking-widest text-text-subtle bg-bg-base/10 border-b border-border last:border-b-0"
                        >
                          <div className="flex items-center justify-center gap-3 py-1 print:py-0.5 w-full">
                            <span className="h-[1px] bg-gray-300 flex-1" />
                            <span className="text-2xs font-bold tracking-widest text-gray-700 print:text-black uppercase print:text-[9px]">{period.name}</span>
                            <span className="h-[1px] bg-gray-300 flex-1" />
                          </div>
                        </td>
                      ) : (
                        daysOfWeek.map((day) => {
                          const slot = slotsLookup[period.id]?.[day.value]
                          const isConflicting = slot && conflictSlots.has(slot.id)
                          const isSourceSwap = swapSource && swapSource.periodId === period.id && swapSource.dayOfWeek === day.value

                          return (
                            <td
                              key={day.value}
                              onClick={() => viewMode === 'class' && handleCellClick(period, day.value)}
                              className={`timetable-slot-cell p-3 text-center border-r border-border last:border-r-0 relative transition-all duration-100 ${
                                viewMode === 'class' ? 'cursor-pointer select-none group' : ''
                              } ${
                                isSourceSwap
                                  ? 'bg-brand-dim/40 ring-1 ring-inset ring-brand ring-offset-0'
                                  : isConflicting
                                  ? 'bg-danger-dim/30 ring-1 ring-inset ring-danger'
                                  : slot
                                  ? 'bg-bg-surface hover:bg-hover-bg/10 print:bg-white'
                                  : 'bg-bg-base/5 border-dashed border-border hover:bg-hover-bg/10 print:bg-white'
                              }`}
                            >
                              {slot ? (
                                <div className="slot-card space-y-1 print:space-y-0.5 min-h-[44px] flex flex-col justify-center">
                                  <div className="slot-subject font-semibold text-text text-xs leading-snug print:text-xs print:font-bold print:leading-tight print:text-black">
                                    {slot.subject_name}
                                  </div>
                                  <div className="slot-teacher text-2xs text-text-muted font-medium flex items-center justify-center gap-1 print:text-[10px] print:leading-tight print:text-gray-700">
                                    <Users size={10} className="text-text-subtle print:hidden" />
                                    <span>
                                      {viewMode === 'class'
                                        ? `${slot.staff_first_name} ${slot.staff_last_name}`
                                        : `${slot.unit_name} - ${slot.group_name}`}
                                    </span>
                                  </div>
                                  {slot.notes && (
                                    <div className="text-3xs text-text-subtle leading-tight italic max-w-xs mx-auto print:text-[8px] print:leading-none print:mt-0.5 print:text-gray-500 print:whitespace-normal">
                                      "{slot.notes}"
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="slot-empty min-h-[44px] flex items-center justify-center text-2xs text-text-subtle font-medium border border-dashed border-border/20 rounded py-2">
                                  <span className="print:hidden">{viewMode === 'class' ? __( '+ Assign', 'codeclove-school-management' ) : '—'}</span>
                                  <span className="hidden print:inline text-gray-400 font-light">—</span>
                                </div>
                              )}

                              {/* Quick edit icons on hover */}
                              {viewMode === 'class' && slot && (
                                <div className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-bg-surface border border-border shadow rounded p-0.5 flex gap-1 print:hidden">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      startSwapMode(period.id, day.value, slot)
                                    }}
                                    className="p-0.5 hover:bg-hover-bg rounded text-text-subtle"
                                    title={__( 'Move / Swap', 'codeclove-school-management' )}
                                  >
                                    <ArrowRightLeft size={10} />
                                  </button>
                                </div>
                              )}
                            </td>
                          )
                        })
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Print-only Footer */}
        <div className="hidden print:flex items-center justify-between text-[9px] text-gray-600 mt-2 px-1 pt-1.5 border-t border-gray-200">
          <span>
            {sprintf(
              __( 'Generated on %s', 'codeclove-school-management' ),
              printTimestamp
            )}
          </span>
          <span>
            {settings?.school?.name || 'School Management'}
          </span>
        </div>
      </Card>
      </div>

      {/* ─── EDIT SLOT MODAL ───────────────────────────────────────────────────────── */}
      <Modal
        open={cellEditOpen}
        onOpenChange={setCellEditOpen}
        title={
          selectedCell
            ? sprintf(
                __( 'Schedule Slot — %1$s, %2$s', 'codeclove-school-management' ),
                daysOfWeek.find((d) => d.value === selectedCell.day)?.label ?? '',
                selectedCell.period.name
              )
            : __( 'Schedule Slot', 'codeclove-school-management' )
        }
        description={__( 'Select subject and instructor teacher for this weekly lecture slot.', 'codeclove-school-management' )}
      >
        <div className="space-y-4 py-2">
          {selectedCell && (
            <div className="p-3 bg-bg-base border border-border rounded-lg text-xs flex justify-between">
              <div>
                <span className="text-text-muted">{sprintf( __( 'Target %s:', 'codeclove-school-management' ), getLabel('academic_group', false, __( 'Section', 'codeclove-school-management' )) )}</span>{' '}
                <span className="font-semibold text-text">{selectedUnitName} - {selectedGroupName}</span>
              </div>
              <div>
                <span className="text-text-muted">{__( 'Time:', 'codeclove-school-management' )}</span>{' '}
                <span className="font-semibold text-text font-mono">
                  {selectedCell.period.start_time.substring(0, 5)} - {selectedCell.period.end_time.substring(0, 5)}
                </span>
              </div>
            </div>
          )}

          <FormField label={sprintf( __( 'Select %s', 'codeclove-school-management' ), getLabel('subject', false, __( 'Subject', 'codeclove-school-management' )) )}>
            <Select
              value={editSubjectId}
              onValueChange={setEditSubjectId}
              options={subjects.map((s) => ({ value: s.id.toString(), label: `${s.name} (${s.code || 'N/A'})` }))}
              placeholder={__( 'No Subject / Clear', 'codeclove-school-management' )}
            />
          </FormField>

          <FormField label={sprintf( __( 'Select %s', 'codeclove-school-management' ), getLabel('staff_member', false, __( 'Teacher', 'codeclove-school-management' )) )}>
            <Select
              value={editStaffId}
              onValueChange={setEditStaffId}
              options={staffOptions}
              placeholder={__( 'No Teacher / Clear', 'codeclove-school-management' )}
            />
          </FormField>

          <FormField label={__( 'Classroom Notes / Instructions (Optional)', 'codeclove-school-management' )}>
            <textarea
              className="w-full bg-bg-surface border border-border text-text rounded px-3 py-2 text-sm outline-none focus:border-brand min-h-[60px]"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder={__( 'e.g. Bring lab coats, Audio-Visual room...', 'codeclove-school-management' )}
            />
          </FormField>
        </div>

        <ModalFooter>
          {selectedCell && slotsLookup[selectedCell.period.id]?.[selectedCell.day] && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                const targetSlot = slotsLookup[selectedCell.period.id]?.[selectedCell.day];
                if (targetSlot) {
                  handleClearCell(targetSlot.id);
                }
              }}
            >
              {__( 'Clear Slot', 'codeclove-school-management' )}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setCellEditOpen(false)}>
            {__( 'Cancel', 'codeclove-school-management' )}
          </Button>
          <Button onClick={handleSaveCell} disabled={upsertSlotMutation.isPending}>
            {upsertSlotMutation.isPending ? __( 'Saving…', 'codeclove-school-management' ) : __( 'Save Slot', 'codeclove-school-management' )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Period Configuration Modal */}
      {periodModalOpen && (
        <PeriodConfigModal
          open={periodModalOpen}
          onOpenChange={setPeriodModalOpen}
          sessionId={Number(sessionId)}
          unitId={Number(unitId)}
          unitName={selectedUnitName}
        />
      )}
    </div>
  )
}
