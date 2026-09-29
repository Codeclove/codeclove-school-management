/**
 * Promotion & Rollover Page.
 *
 * Implements a premium step-by-step rollover pipeline:
 *   - Step 1: Sessions selection & academic structure rollover (cloning).
 *   - Step 2: Class-to-class promotion mapping.
 *   - Step 3: Student-by-student confirmation within accordion grids.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  RefreshCw,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Check,
  Users
} from 'lucide-react'
import {
  useSessions,
  useUnits,
  useGroups,
} from '@/api/academics'
import {
  usePromotionEligible,
  useCloneStructure,
  useExecutePromotion,
  type EligibleStudent,
  type PromotionPayloadItem
} from '@/api/promotion'
import { useStudents } from '@/api/students'
import { useLabels } from '@/lib/labels'
import { useToast } from '@/lib/toast'
import { __, sprintf } from '@/lib/i18n'
import {
  Button,
  Badge,
  Card,
  CardContent,
  Modal,
  ModalFooter,
  FormField,
  Input,
  Select,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  PageHeader,
  Spinner,
  EmptyState,
  Alert
} from '@/components/ui'

export default function PromotionPage() {
  const toast = useToast()
  const { getLabel } = useLabels()

  const classLabel = getLabel('academic_unit', false, __( 'Class', 'codeclove-school-management' ))
  const classesLabelPlural = getLabel('academic_unit', true, __( 'Classes', 'codeclove-school-management' ))
  const sectionLabel = getLabel('academic_group', false, __( 'Section', 'codeclove-school-management' ))
  const sectionsLabelPlural = getLabel('academic_group', true, __( 'Sections', 'codeclove-school-management' ))
  const sessionLabel = getLabel('academic_session', false, __( 'Academic Year', 'codeclove-school-management' ))

  // ─── State ───────────────────────────────────────────────────────────────────
  const [sourceSessionId, setSourceSessionId] = useState<string>('')
  const [targetSessionId, setTargetSessionId] = useState<string>('')
  const [classMappings, setClassMappings] = useState<Record<number, string>>({})
  const [studentActions, setStudentActions] = useState<
    Record<
      number,
      {
        action: 'promote' | 'detain' | 'graduate' | 'withdraw'
        target_unit_id: string
        target_group_id: string
        roll_number: string
      }
    >
  >({})
  const [previewModalOpen, setPreviewModalOpen] = useState(false)

  // Scope Selection States
  const [promotionScope, setPromotionScope] = useState<'all' | 'class' | 'student'>('all')
  const [selectedScopeUnitId, setSelectedScopeUnitId] = useState<string>('')
  const [selectedScopeStudentId, setSelectedScopeStudentId] = useState<string>('')

  // Query active students list for single student selector
  const { data: studentsListResult } = useStudents({
    academic_session_id: sourceSessionId ? parseInt(sourceSessionId) : undefined,
    status: 'active',
    per_page: 500,
  })
  const allActiveStudents = studentsListResult?.data ?? []

  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  const filteredStudents = useMemo(() => {
    if (!allActiveStudents) return []
    const query = studentSearchQuery.toLowerCase().trim()
    if (!query) return allActiveStudents.slice(0, 10) // Show first 10 when empty search
    return allActiveStudents.filter((s) => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
      const number = (s.student_number || '').toLowerCase()
      return fullName.includes(query) || number.includes(query)
    })
  }, [allActiveStudents, studentSearchQuery])

  // ─── Queries & Mutations ──────────────────────────────────────────────────────
  const { data: sessionsData } = useSessions({ per_page: 100 })
  const sessions = sessionsData?.data ?? []

  // Default source session to active session
  useEffect(() => {
    if (sessions.length > 0 && !sourceSessionId) {
      const active = sessions.find((s) => s.status === 'active')
      if (active) {
        setSourceSessionId(active.id.toString())
      } else {
        const firstSession = sessions[0]
        if (firstSession) {
          setSourceSessionId(firstSession.id.toString())
        }
      }
    }
  }, [sessions, sourceSessionId])

  // Get units for both source and target sessions
  const { data: sourceUnitsData } = useUnits({
    academic_session_id: sourceSessionId ? parseInt(sourceSessionId) : undefined,
    per_page: 200,
  })
  const sourceUnits = sourceUnitsData?.data ?? []

  const { data: targetUnitsData } = useUnits({
    academic_session_id: targetSessionId ? parseInt(targetSessionId) : undefined,
    per_page: 200,
  })
  const targetUnits = targetUnitsData?.data ?? []

  // Load all sections/groups
  const { data: groupsData } = useGroups({ per_page: 500 })
  const allGroups = groupsData?.data ?? []

  // Map groups by unit ID
  const groupsByUnit = useMemo(() => {
    const map: Record<number, typeof allGroups> = {}
    allGroups.forEach((g) => {
      const list = map[g.unit_id] ?? []
      list.push(g)
      map[g.unit_id] = list
    })
    return map
  }, [allGroups])

  // Fetch eligible students
  const { data: students, isLoading: isLoadingStudents, refetch: refetchStudents } = usePromotionEligible({
    session_id: sourceSessionId ? parseInt(sourceSessionId) : 0,
    unit_id: promotionScope === 'class' && selectedScopeUnitId ? parseInt(selectedScopeUnitId) : undefined,
    student_id: promotionScope === 'student' && selectedScopeStudentId ? parseInt(selectedScopeStudentId) : undefined,
  })

  // Mutations
  const cloneMutation = useCloneStructure()
  const executeMutation = useExecutePromotion()

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleCloneStructure = async () => {
    if (!sourceSessionId || !targetSessionId) {
      toast.error(__( 'Please select both source and target sessions.', 'codeclove-school-management' ))
      return
    }

    try {
      const res = await cloneMutation.mutateAsync({
        source_session_id: parseInt(sourceSessionId),
        target_session_id: parseInt(targetSessionId),
      })
      toast.success(
        sprintf(
          __( 'Academic structure cloned! Created %1$d %2$s and %3$d %4$s.', 'codeclove-school-management' ),
          res.cloned_units_count,
          classesLabelPlural.toLowerCase(),
          res.cloned_groups_count,
          sectionsLabelPlural.toLowerCase()
        )
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : '')
      toast.error(message || __( 'Failed to clone academic structure.', 'codeclove-school-management' ))
    }
  }

  // Auto-build mappings and students actions
  useEffect(() => {
    if (sourceUnits.length > 0 && targetUnits.length > 0) {
      const initialMappings: Record<number, string> = {}
      sourceUnits.forEach((su) => {
        // Try to find same-code or next level unit order in target
        const matchingTarget = targetUnits.find(
          (tu) => tu.code === su.code || tu.order === su.order + 1
        )
        if (matchingTarget) {
          initialMappings[su.id] = matchingTarget.id.toString()
        } else if (sourceUnits.length > 0 && su.order === Math.max(...sourceUnits.map((u) => u.order))) {
          // Highest level unit maps to Graduation
          initialMappings[su.id] = 'graduate'
        } else {
          initialMappings[su.id] = ''
        }
      })
      setClassMappings(initialMappings)
    }
  }, [sourceUnits, targetUnits])

  // Map student actions when students or classMappings load
  useEffect(() => {
    if (students && students.length > 0) {
      const actions: typeof studentActions = {}
      students.forEach((s) => {
        const mappedTarget = classMappings[s.academic_unit_id] ?? ''
        let action: 'promote' | 'detain' | 'graduate' | 'withdraw' = 'promote'
        let targetUnit = ''
        let targetGroup = ''

        if (mappedTarget === 'graduate') {
          action = 'graduate'
        } else if (mappedTarget === 'withdraw') {
          action = 'withdraw'
        } else if (mappedTarget) {
          action = 'promote'
          targetUnit = mappedTarget
          // Try to match group/section by name
          const targetUnitGroups = groupsByUnit[parseInt(mappedTarget)] ?? []
          const currentGroup = allGroups.find((g) => g.id === s.academic_group_id)
          const matchingGroup = targetUnitGroups.find((tg) => tg.name === currentGroup?.name)
          const firstTargetGroup = targetUnitGroups[0]
          if (matchingGroup) {
            targetGroup = matchingGroup.id.toString()
          } else if (firstTargetGroup) {
            targetGroup = firstTargetGroup.id.toString()
          }
        }

        actions[s.student_id] = {
          action,
          target_unit_id: targetUnit,
          target_group_id: targetGroup,
          roll_number: s.roll_number ?? '',
        }
      })
      setStudentActions(actions)
    }
  }, [students, classMappings, groupsByUnit, allGroups])

  // Group students by Class + Section for Accordion rendering
  const groupedStudents = useMemo(() => {
    if (!students) return {}
    const groups: Record<
      string,
      {
        unitId: number
        groupId: number | null
        unitName: string
        groupName: string
        students: EligibleStudent[]
      }
    > = {}

    students.forEach((s) => {
      const key = `${s.academic_unit_id}-${s.academic_group_id || 'none'}`
      if (!groups[key]) {
        groups[key] = {
          unitId: s.academic_unit_id,
          groupId: s.academic_group_id,
          unitName: s.current_unit_name || __( 'Unassigned', 'codeclove-school-management' ),
          groupName: s.current_group_name || __( 'No Section', 'codeclove-school-management' ),
          students: [],
        }
      }
      groups[key].students.push(s)
    })

    return groups
  }, [students])

  // Calculate statistics for preview/summary
  const stats = useMemo(() => {
    let promote = 0
    let detain = 0
    let graduate = 0
    let withdraw = 0

    Object.values(studentActions).forEach((act) => {
      if (act.action === 'promote') promote++
      if (act.action === 'detain') detain++
      if (act.action === 'graduate') graduate++
      if (act.action === 'withdraw') withdraw++
    })

    return { promote, detain, graduate, withdraw, total: promote + detain + graduate + withdraw }
  }, [studentActions])

  const handleBulkSetGroupAction = (groupKey: string, bulkAction: string, bulkTargetUnit = '', bulkTargetGroup = '') => {
    const group = groupedStudents[groupKey]
    if (!group) return

    setStudentActions((prev) => {
      const next = { ...prev }
      group.students.forEach((s) => {
        const actionType = bulkAction as 'promote' | 'detain' | 'graduate' | 'withdraw'
        next[s.student_id] = {
          action: actionType,
          target_unit_id: actionType === 'promote' || actionType === 'detain' ? bulkTargetUnit : '',
          target_group_id: actionType === 'promote' || actionType === 'detain' ? bulkTargetGroup : '',
          roll_number: prev[s.student_id]?.roll_number ?? '',
        }
      })
      return next
    })

    toast.success(sprintf( __( 'Updated bulk action for %1$d students in %2$s - %3$s', 'codeclove-school-management' ), group.students.length, group.unitName, group.groupName ))
  }

  const handleExecuteRollover = async () => {
    if (!sourceSessionId || !targetSessionId) return

    const payload: PromotionPayloadItem[] = []
    Object.entries(studentActions).forEach(([studentId, data]) => {
      const origStudent = students?.find((s) => s.student_id === parseInt(studentId))
      if (!origStudent) return

      payload.push({
        student_id: parseInt(studentId),
        current_enrollment_id: origStudent.current_enrollment_id,
        action: data.action,
        target_unit_id: data.target_unit_id ? parseInt(data.target_unit_id) : undefined,
        target_group_id: data.target_group_id ? parseInt(data.target_group_id) : null,
        roll_number: data.roll_number || undefined,
      })
    })

    try {
      const res = await executeMutation.mutateAsync({
        source_session_id: parseInt(sourceSessionId),
        target_session_id: parseInt(targetSessionId),
        promotions: payload,
      })
      toast.success(sprintf( __( 'Promotion and rollover executed successfully! Processed %d students.', 'codeclove-school-management' ), res.processed_count ))
      setPreviewModalOpen(false)
      refetchStudents()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : '')
      toast.error(message || __( 'Failed to execute student rollover.', 'codeclove-school-management' ))
    }
  }

  // ─── Render Options ───────────────────────────────────────────────────────────
  const sessionOptions = sessions.map((s) => ({
    value: s.id.toString(),
    label: `${s.name} ${s.status === 'active' ? `(${__( 'Current', 'codeclove-school-management' )})` : ''}`,
  }))

  const isStructureEmpty = targetUnits.length === 0

  const isSelectionComplete =
    promotionScope === 'all' ||
    (promotionScope === 'class' && selectedScopeUnitId) ||
    (promotionScope === 'student' && selectedScopeStudentId);

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={__( 'Student Promotion & Session Rollover', 'codeclove-school-management' )}
        breadcrumbs={[{ label: __( 'Students', 'codeclove-school-management' ) }, { label: __( 'Promotion & Rollover', 'codeclove-school-management' ) }]}
        description={__( 'Advance active student profiles into the new academic year. Set up class mappings, preview capacity issues, and execute rollover in a single transaction.', 'codeclove-school-management' )}
      />

      {/* ─── STEP 1: SELECT SESSIONS ───────────────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-6 h-6 rounded-full bg-bg-base border border-border flex items-center justify-center text-xs font-semibold text-text-muted">
              01
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">{__( 'Select Academic Sessions', 'codeclove-school-management' )}</h3>
              <p className="text-xs text-text-muted">{__( 'Define the source session to promote from and target session to enroll into.', 'codeclove-school-management' )}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={sprintf( __( 'Source %s (Promote From)', 'codeclove-school-management' ), sessionLabel )}>
              <Select
                value={sourceSessionId}
                onValueChange={setSourceSessionId}
                options={sessionOptions}
                placeholder={__( 'Select source session', 'codeclove-school-management' )}
              />
            </FormField>
            <FormField label={sprintf( __( 'Target %s (Promote Into)', 'codeclove-school-management' ), sessionLabel )}>
              <Select
                value={targetSessionId}
                onValueChange={setTargetSessionId}
                options={sessionOptions.filter((o) => o.value !== sourceSessionId)}
                placeholder={__( 'Select target session', 'codeclove-school-management' )}
              />
            </FormField>
          </div>

          {sourceSessionId && targetSessionId && (
            <div className="mt-4 p-4 rounded-xl border border-dashed border-border bg-bg-base/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs text-brand font-medium bg-brand-dim px-2.5 py-1 rounded-full">
                  <Sparkles size={12} />
                  {__( 'Academic Structure Verification', 'codeclove-school-management' )}
                </span>
                <p className="text-sm text-text mt-1">
                  {isStructureEmpty
                    ? sprintf( __( 'Warning: The target session has no %s set up yet.', 'codeclove-school-management' ), classesLabelPlural.toLowerCase() )
                    : sprintf(
                        __( 'Active Structure: Target session has %1$d %2$s and %3$d %4$s configured.', 'codeclove-school-management' ),
                        targetUnits.length,
                        classesLabelPlural.toLowerCase(),
                        allGroups.filter(g => targetUnits.some(tu => tu.id === g.unit_id)).length,
                        sectionsLabelPlural.toLowerCase()
                      )}
                </p>
              </div>

               {isStructureEmpty ? (
                <Button
                  onClick={handleCloneStructure}
                  disabled={cloneMutation.isPending}
                  className="gap-1.5 self-start md:self-auto"
                >
                  {cloneMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {__( 'Clone Academic Structure', 'codeclove-school-management' )}
                </Button>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs text-success bg-success-dim px-3 py-1.5 rounded-full font-medium">
                  <CheckCircle2 size={14} />
                  {__( 'Structure Rolled Over', 'codeclove-school-management' )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── PROMOTION SCOPE ──────────────────────────────────────────────────────── */}
      {sourceSessionId && targetSessionId && !isStructureEmpty && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-6 rounded-full bg-bg-base border border-border flex items-center justify-center text-xs font-semibold text-text-muted">
                02
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text">{__( 'Select Promotion Scope', 'codeclove-school-management' )}</h3>
                <p className="text-xs text-text-muted">{__( 'Promote the entire school, a specific class, or an individual student.', 'codeclove-school-management' )}</p>
              </div>
            </div>

            <div className="flex gap-6 border-b border-border pb-3">
              <label className="flex items-center gap-2 text-sm font-medium text-text cursor-pointer">
                <input
                  type="radio"
                  name="promotionScope"
                  value="all"
                  checked={promotionScope === 'all'}
                  onChange={() => {
                    setPromotionScope('all')
                    setSelectedScopeUnitId('')
                    setSelectedScopeStudentId('')
                    setStudentSearchQuery('')
                  }}
                  className="accent-brand"
                />
                {__( 'All Classes', 'codeclove-school-management' )}
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-text cursor-pointer">
                <input
                  type="radio"
                  name="promotionScope"
                  value="class"
                  checked={promotionScope === 'class'}
                  onChange={() => {
                    setPromotionScope('class')
                    setSelectedScopeUnitId('')
                    setSelectedScopeStudentId('')
                    setStudentSearchQuery('')
                  }}
                  className="accent-brand"
                />
                {__( 'Single Class', 'codeclove-school-management' )}
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-text cursor-pointer">
                <input
                  type="radio"
                  name="promotionScope"
                  value="student"
                  checked={promotionScope === 'student'}
                  onChange={() => {
                    setPromotionScope('student')
                    setSelectedScopeUnitId('')
                    setSelectedScopeStudentId('')
                    setStudentSearchQuery('')
                  }}
                  className="accent-brand"
                />
                {__( 'Single Student', 'codeclove-school-management' )}
              </label>
            </div>

            {promotionScope === 'class' && (
              <div className="max-w-xs animate-fade-in">
                <FormField label={sprintf( __( 'Select Source %s', 'codeclove-school-management' ), classLabel )} required>
                  <Select
                    value={selectedScopeUnitId}
                    onValueChange={setSelectedScopeUnitId}
                    options={sourceUnits.map((u) => ({ value: u.id.toString(), label: u.name }))}
                    placeholder={sprintf( __( 'Select %s', 'codeclove-school-management' ), classLabel )}
                  />
                </FormField>
              </div>
            )}

            {promotionScope === 'student' && (
              <div className="max-w-md animate-fade-in relative" onBlur={(e) => {
                // Delay hiding dropdown so that clicks register on list items
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setTimeout(() => setIsSearchFocused(false), 200)
                }
              }}>
                <FormField label={__( 'Search & Select Student', 'codeclove-school-management' )} required>
                  <div className="relative">
                    <Input
                      value={studentSearchQuery}
                      onChange={(e) => {
                        setStudentSearchQuery(e.target.value)
                        setSelectedScopeStudentId('') // Reset selection when user typing
                      }}
                      onFocus={() => setIsSearchFocused(true)}
                      placeholder={__( 'Type student name or ID...', 'codeclove-school-management' )}
                      className="pr-8"
                    />
                    {selectedScopeStudentId && (
                      <button
                        onClick={() => {
                          setSelectedScopeStudentId('')
                          setStudentSearchQuery('')
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text text-xs font-semibold"
                        type="button"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </FormField>

                {/* Autocomplete Search Dropdown */}
                {isSearchFocused && (
                  <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-bg-overlay shadow-modal z-50 p-1 space-y-0.5">
                    {filteredStudents.length === 0 ? (
                      <div className="p-3 text-xs text-text-subtle text-center">
                        {sprintf( __( 'No active students found matching "%s"', 'codeclove-school-management' ), studentSearchQuery )}
                      </div>
                    ) : (
                      filteredStudents.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={() => {
                            setSelectedScopeStudentId(s.id.toString())
                            setStudentSearchQuery(`${s.first_name} ${s.last_name} (${s.student_number})`)
                            setIsSearchFocused(false)
                          }}
                          className={`w-full flex items-center justify-between text-left px-3 py-2 rounded text-xs transition-colors duration-100 hover:bg-hover-bg/40 ${
                            selectedScopeStudentId === s.id.toString()
                              ? 'bg-brand-dim text-brand font-semibold'
                              : 'text-text-muted hover:text-text'
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{s.first_name} {s.last_name}</p>
                            <p className="text-text-subtle font-mono text-2xs">{s.student_number}</p>
                          </div>
                          {s.enrollment && (
                            <Badge variant="default" size="sm" className="text-2xs">
                              {s.enrollment.academic_unit_id ? (sourceUnits.find((u) => u.id === s.enrollment?.academic_unit_id)?.name || __( 'Class', 'codeclove-school-management' )) : __( 'No Class', 'codeclove-school-management' )}
                            </Badge>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 2: CLASS PROMOTION MAP ────────────────────────────────────────────── */}
      {sourceSessionId && targetSessionId && !isStructureEmpty && promotionScope !== 'student' && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-6 rounded-full bg-bg-base border border-border flex items-center justify-center text-xs font-semibold text-text-muted">
                03
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text">{sprintf( __( 'Configure %s Promotion Map', 'codeclove-school-management' ), classLabel )}</h3>
                <p className="text-xs text-text-muted">{__( 'Define the default next-class mapping to automatically populate student promotion targets.', 'codeclove-school-management' )}</p>
              </div>
            </div>

            {sourceUnits.length === 0 ? (
              <p className="text-sm text-text-muted">{sprintf( __( 'No %s records found in source session.', 'codeclove-school-management' ), classLabel.toLowerCase() )}</p>
            ) : promotionScope === 'class' && !selectedScopeUnitId ? (
              <p className="text-sm text-text-muted">{sprintf( __( 'Please select a %s in the scope selector above.', 'codeclove-school-management' ), classLabel.toLowerCase() )}</p>
            ) : (
              <TableRoot className="border border-border rounded-xl overflow-hidden bg-bg-surface mt-3">
                <Thead>
                  <Tr>
                    <Th className="text-xs font-semibold">{sprintf( __( 'Source %s', 'codeclove-school-management' ), classLabel )}</Th>
                    <Th className="text-xs font-semibold w-16 text-center"></Th>
                    <Th className="text-xs font-semibold">{sprintf( __( 'Target %s', 'codeclove-school-management' ), classLabel )}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {sourceUnits
                    .filter((su) => promotionScope !== 'class' || su.id.toString() === selectedScopeUnitId)
                    .map((su) => (
                    <Tr key={su.id} className="hover:bg-hover-bg/20 transition-colors">
                      <Td className="text-sm font-medium text-text">{su.name}</Td>
                      <Td className="text-center">
                        <ArrowRight size={14} className="text-text-subtle inline-block" />
                      </Td>
                      <Td>
                        <select
                          aria-label={sprintf( __( 'Select target for %s', 'codeclove-school-management' ), su.name )}
                          value={classMappings[su.id] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setClassMappings((prev) => ({ ...prev, [su.id]: val }))
                          }}
                          className="bg-bg-surface border border-border text-text rounded-lg px-2.5 py-1 text-sm outline-none focus:border-brand-strong w-full max-w-xs"
                        >
                          <option value="">{__( '-- Select --', 'codeclove-school-management' )}</option>
                          {targetUnits.map((tu) => (
                            <option key={tu.id} value={tu.id.toString()}>
                              {tu.name}
                            </option>
                          ))}
                          <option value="graduate">{__( '🎓 Graduate / Complete', 'codeclove-school-management' )}</option>
                          <option value="withdraw">{__( '❌ Withdraw / Archive', 'codeclove-school-management' )}</option>
                        </select>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </TableRoot>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 3: STUDENT LEVEL MAPS (ACCORDION) ─────────────────────────────────── */}
      {sourceSessionId && targetSessionId && !isStructureEmpty && isSelectionComplete && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-bg-base border border-border flex items-center justify-center text-xs font-semibold text-text-muted flex-shrink-0">
              {promotionScope === 'student' ? '03' : '04'}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text">{__( 'Confirm Student Rollovers', 'codeclove-school-management' )}</h3>
                  <p className="text-xs text-text-muted">{__( 'Expand class accordion segments to audit individual student promotions.', 'codeclove-school-management' )}</p>
                </div>
                {students && (
                  <Badge variant="active" className="px-3 py-1 font-semibold text-xs">
                    {sprintf( __( 'Total: %d Eligible', 'codeclove-school-management' ), students.length )}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Action Explanations Legend */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-bg-surface border border-border rounded-xl text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-text">
                <span className="w-2 h-2 rounded-full bg-success" />
                {__( 'Promote', 'codeclove-school-management' )}
              </div>
              <p className="text-text-muted leading-relaxed">
                {__( 'Moves the student to the selected target class & section for the new academic year.', 'codeclove-school-management' )}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-text">
                <span className="w-2 h-2 rounded-full bg-warning" />
                {__( 'Detain', 'codeclove-school-management' )}
              </div>
              <p className="text-text-muted leading-relaxed">
                {__( 'Registers the student in the same class level for the new year (retains them in grade).', 'codeclove-school-management' )}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-text">
                <span className="w-2 h-2 rounded-full bg-info" />
                {__( 'Graduate', 'codeclove-school-management' )}
              </div>
              <p className="text-text-muted leading-relaxed">
                {__( "Completes the student's studies. Updates profile status to Graduated and ends enrollment.", 'codeclove-school-management' )}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-text">
                <span className="w-2 h-2 rounded-full bg-text-subtle" />
                {__( 'Withdraw', 'codeclove-school-management' )}
              </div>
              <p className="text-text-muted leading-relaxed">
                {__( 'Marks student profile status as Withdrawn and ends current active enrollment.', 'codeclove-school-management' )}
              </p>
            </div>
          </div>

          {isLoadingStudents ? (
            <div className="p-8 text-center bg-bg-surface border border-border rounded-xl">
              <Spinner size="lg" className="mx-auto mb-2 text-brand" />
              <p className="text-sm text-text-muted">{__( 'Loading students eligible for promotion...', 'codeclove-school-management' )}</p>
            </div>
          ) : !students || students.length === 0 ? (
            <EmptyState
              title={__( 'No eligible students found', 'codeclove-school-management' )}
              description={__( 'No active student profiles with active enrollments were found in the selected source academic session.', 'codeclove-school-management' )}
              icon={Users}
            />
          ) : (
            <Accordion defaultOpen={Object.keys(groupedStudents)[0] || null}>
              {Object.entries(groupedStudents).map(([groupKey, group]) => {
                // Calculate section level stats for accordion header summary
                let promotedCount = 0
                let detainedCount = 0
                let graduatedCount = 0
                let withdrawnCount = 0

                group.students.forEach((s) => {
                  const act = studentActions[s.student_id]?.action
                  if (act === 'promote') promotedCount++
                  if (act === 'detain') detainedCount++
                  if (act === 'graduate') graduatedCount++
                  if (act === 'withdraw') withdrawnCount++
                })

                return (
                  <AccordionItem key={groupKey} value={groupKey}>
                    <AccordionTrigger>
                      <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-4 text-left gap-2">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-brand" />
                          <span className="font-semibold text-sm text-text">
                            {group.unitName} - {group.groupName}
                          </span>
                          <span className="text-xs text-text-muted font-normal">
                            {sprintf( __( '(%d Students)', 'codeclove-school-management' ), group.students.length )}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-normal">
                          {promotedCount > 0 && (
                            <span className="bg-success-dim text-success px-2 py-0.5 rounded-full font-medium">
                              {sprintf( __( '%d Promoted', 'codeclove-school-management' ), promotedCount )}
                            </span>
                          )}
                          {detainedCount > 0 && (
                            <span className="bg-warning-dim text-warning px-2 py-0.5 rounded-full font-medium">
                              {sprintf( __( '%d Detained', 'codeclove-school-management' ), detainedCount )}
                            </span>
                          )}
                          {graduatedCount > 0 && (
                            <span className="bg-info-dim text-info px-2 py-0.5 rounded-full font-medium">
                              {sprintf( __( '%d Graduated', 'codeclove-school-management' ), graduatedCount )}
                            </span>
                          )}
                          {withdrawnCount > 0 && (
                            <span className="bg-hover-bg text-text-muted px-2 py-0.5 rounded-full font-medium">
                              {sprintf( __( '%d Withdrawn', 'codeclove-school-management' ), withdrawnCount )}
                            </span>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-bg-base/30 space-y-4">
                      {/* Bulk actions inside panel */}
                      <div className="p-3 rounded-xl border border-border bg-bg-surface flex flex-col md:flex-row items-start md:items-center gap-3">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                          {sprintf( __( 'Bulk Action for this %s:', 'codeclove-school-management' ), sectionLabel )}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-xs font-medium text-text bg-bg-base hover:bg-hover-bg border border-border"
                            onClick={() => {
                              const targetUnit = classMappings[group.unitId]
                              if (!targetUnit || targetUnit === 'graduate' || targetUnit === 'withdraw') {
                                toast.error(sprintf( __( 'No class mapping target defined for %s. Configure Step 2 first.', 'codeclove-school-management' ), group.unitName ));
                                return
                              }
                              // Try to find a matching target group
                              const targetUnitGroups = groupsByUnit[parseInt(targetUnit)] ?? []
                              const matchingGroup = targetUnitGroups.find((tg) => tg.name === group.groupName)
                              const targetGroupId = matchingGroup ? matchingGroup.id.toString() : (targetUnitGroups[0]?.id.toString() ?? '')
                              handleBulkSetGroupAction(groupKey, 'promote', targetUnit, targetGroupId)
                            }}
                          >
                            {__( 'Set all to Promote', 'codeclove-school-management' )}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-xs font-medium text-text bg-bg-base hover:bg-hover-bg border border-border"
                            onClick={() => {
                              handleBulkSetGroupAction(groupKey, 'detain', group.unitId.toString(), group.groupId?.toString() ?? '')
                            }}
                          >
                            {__( 'Set all to Detain', 'codeclove-school-management' )}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-xs font-medium text-text bg-bg-base hover:bg-hover-bg border border-border animate-fade-in"
                            onClick={() => {
                              handleBulkSetGroupAction(groupKey, 'graduate')
                            }}
                          >
                            {__( 'Set all to Graduate', 'codeclove-school-management' )}
                          </Button>
                        </div>
                      </div>

                      {/* Student Table */}
                      <TableRoot className="border border-border rounded-xl overflow-hidden bg-bg-surface">
                        <Thead>
                          <Tr>
                            <Th className="text-xs font-semibold">{__( 'Student', 'codeclove-school-management' )}</Th>
                            <Th className="text-xs font-semibold w-36">{__( 'Action', 'codeclove-school-management' )}</Th>
                            <Th className="text-xs font-semibold w-48">{sprintf( __( 'Target %s', 'codeclove-school-management' ), classLabel )}</Th>
                            <Th className="text-xs font-semibold w-44">{sprintf( __( 'Target %s', 'codeclove-school-management' ), sectionLabel )}</Th>
                            <Th className="text-xs font-semibold w-36">{__( 'Roll Number', 'codeclove-school-management' )}</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {group.students.map((student) => {
                            const act = studentActions[student.student_id] || {
                              action: 'promote',
                              target_unit_id: '',
                              target_group_id: '',
                              roll_number: '',
                            }
                            const targetUnitGroups = act.target_unit_id ? (groupsByUnit[parseInt(act.target_unit_id)] ?? []) : []

                            return (
                              <Tr key={student.student_id} className="hover:bg-hover-bg/30 transition-colors duration-100">
                                <Td>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-sm text-text">
                                      {student.first_name} {student.last_name}
                                    </span>
                                    <span className="text-xs text-text-subtle">
                                      {sprintf( __( 'ID: %1$s | Roll: %2$s', 'codeclove-school-management' ), student.student_number, student.roll_number || '--' )}
                                    </span>
                                  </div>
                                </Td>
                                <Td>
                                  <select
                                    aria-label={sprintf( __( 'Promotion action for %1$s %2$s', 'codeclove-school-management' ), student.first_name, student.last_name )}
                                    value={act.action}
                                    onChange={(e) => {
                                      const newAction = e.target.value as 'promote' | 'detain' | 'graduate' | 'withdraw'
                                      setStudentActions((prev) => {
                                        const current = prev[student.student_id] || { action: 'promote', target_unit_id: '', target_group_id: '', roll_number: '' }
                                        return {
                                          ...prev,
                                          [student.student_id]: {
                                            ...current,
                                            action: newAction,
                                            target_unit_id: newAction === 'promote' ? (classMappings[group.unitId] ?? '') : newAction === 'detain' ? group.unitId.toString() : '',
                                            target_group_id: newAction === 'promote' ? '' : newAction === 'detain' ? (group.groupId?.toString() ?? '') : '',
                                          },
                                        }
                                      })
                                    }}
                                    className="bg-bg-surface border border-border text-text rounded-lg px-2.5 py-1 text-sm outline-none w-full"
                                  >
                                    <option value="promote">{__( 'Promote', 'codeclove-school-management' )}</option>
                                    <option value="detain">{__( 'Detain', 'codeclove-school-management' )}</option>
                                    <option value="graduate">{__( 'Graduate', 'codeclove-school-management' )}</option>
                                    <option value="withdraw">{__( 'Withdraw', 'codeclove-school-management' )}</option>
                                  </select>
                                </Td>
                                <Td>
                                  {(act.action === 'promote' || act.action === 'detain') ? (
                                    <select
                                      aria-label={sprintf( __( 'Target class level for %1$s %2$s', 'codeclove-school-management' ), student.first_name, student.last_name )}
                                      value={act.target_unit_id}
                                      onChange={(e) => {
                                        const newUnit = e.target.value
                                        setStudentActions((prev) => {
                                          const grps = groupsByUnit[parseInt(newUnit)] ?? []
                                          const current = prev[student.student_id] || { action: 'promote', target_unit_id: '', target_group_id: '', roll_number: '' }
                                          return {
                                            ...prev,
                                            [student.student_id]: {
                                              ...current,
                                              target_unit_id: newUnit,
                                              target_group_id: grps[0] ? grps[0].id.toString() : '',
                                            },
                                          }
                                        })
                                      }}
                                      className="bg-bg-surface border border-border text-text rounded-lg px-2.5 py-1 text-sm outline-none w-full"
                                    >
                                      {targetUnits.map((u) => (
                                        <option key={u.id} value={u.id.toString()}>
                                          {u.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-xs text-text-muted italic">{__( 'Not applicable', 'codeclove-school-management' )}</span>
                                  )}
                                </Td>
                                <Td>
                                  {(act.action === 'promote' || act.action === 'detain') ? (
                                    <select
                                      aria-label={sprintf( __( 'Target section for %1$s %2$s', 'codeclove-school-management' ), student.first_name, student.last_name )}
                                      value={act.target_group_id}
                                      onChange={(e) => {
                                        const newGroup = e.target.value
                                        setStudentActions((prev) => {
                                          const current = prev[student.student_id] || { action: 'promote', target_unit_id: '', target_group_id: '', roll_number: '' }
                                          return {
                                            ...prev,
                                            [student.student_id]: {
                                              ...current,
                                              target_group_id: newGroup,
                                            },
                                          }
                                        })
                                      }}
                                      className="bg-bg-surface border border-border text-text rounded-lg px-2.5 py-1 text-sm outline-none w-full"
                                      disabled={targetUnitGroups.length === 0}
                                    >
                                      {targetUnitGroups.length === 0 ? (
                                        <option value="">{__( 'No sections setup', 'codeclove-school-management' )}</option>
                                      ) : (
                                        targetUnitGroups.map((g) => (
                                          <option key={g.id} value={g.id.toString()}>
                                            {g.name}
                                          </option>
                                        ))
                                      )}
                                    </select>
                                  ) : (
                                    <span className="text-xs text-text-muted italic">{__( 'Not applicable', 'codeclove-school-management' )}</span>
                                  )}
                                </Td>
                                <Td>
                                  {(act.action === 'promote' || act.action === 'detain') ? (
                                    <Input
                                      value={act.roll_number}
                                      onChange={(e) => {
                                        const newRoll = e.target.value
                                        setStudentActions((prev) => {
                                          const current = prev[student.student_id] || { action: 'promote', target_unit_id: '', target_group_id: '', roll_number: '' }
                                          return {
                                            ...prev,
                                            [student.student_id]: {
                                              ...current,
                                              roll_number: newRoll,
                                            },
                                          }
                                        })
                                      }}
                                      className="h-8 py-0 px-2"
                                      placeholder={__( 'Roll no.', 'codeclove-school-management' )}
                                    />
                                  ) : (
                                    <span className="text-xs text-text-muted italic">{__( 'Not applicable', 'codeclove-school-management' )}</span>
                                  )}
                                </Td>
                              </Tr>
                            )
                          })}
                        </Tbody>
                      </TableRoot>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}

          {/* ─── FLOATING FOOTER ACTION BAR ────────────────────────────────────────────── */}
          {students && students.length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-bg-surface/85 backdrop-blur-md shadow-md flex items-center justify-between gap-4 sticky bottom-4 z-40">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Promotion Selection Summary', 'codeclove-school-management' )}
                </span>
                <p className="text-sm font-semibold text-text">
                  {sprintf(
                    __( '%1$d Promotes, %2$d Detains, %3$d Graduates, %4$d Withdraws', 'codeclove-school-management' ),
                    stats.promote,
                    stats.detain,
                    stats.graduate,
                    stats.withdraw
                  )}
                </p>
              </div>

              <Button onClick={() => setPreviewModalOpen(true)} className="gap-1.5 shadow-md">
                <RefreshCw size={14} />
                {promotionScope === 'all' ? __( 'Preview Rollover', 'codeclove-school-management' ) : promotionScope === 'class' ? __( 'Preview Class Rollover', 'codeclove-school-management' ) : __( 'Preview Student Rollover', 'codeclove-school-management' )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── PREVIEW MODAL ────────────────────────────────────────────────────────── */}
      <Modal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        title={__( 'Confirm Academic Rollover', 'codeclove-school-management' )}
      >
        <div className="space-y-4">
          <Alert variant="danger" title={__( 'Critical Operational Action', 'codeclove-school-management' )}>
            {__( 'This transaction will freeze source year enrollments (marking them completed), assign students to their target classes, and update profile statuses. This action cannot be easily undone.', 'codeclove-school-management' )}
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-bg-base rounded-xl text-center space-y-1">
              <span className="text-2xl font-bold text-success">{stats.promote}</span>
              <p className="text-xs font-medium text-text-muted">{__( 'Students Promoted', 'codeclove-school-management' )}</p>
            </div>
            <div className="p-3 bg-bg-base rounded-xl text-center space-y-1">
              <span className="text-2xl font-bold text-warning">{stats.detain}</span>
              <p className="text-xs font-medium text-text-muted">{__( 'Students Detained', 'codeclove-school-management' )}</p>
            </div>
            <div className="p-3 bg-bg-base rounded-xl text-center space-y-1">
              <span className="text-2xl font-bold text-info">{stats.graduate}</span>
              <p className="text-xs font-medium text-text-muted">{__( 'Students Graduated', 'codeclove-school-management' )}</p>
            </div>
            <div className="p-3 bg-bg-base rounded-xl text-center space-y-1">
              <span className="text-2xl font-bold text-text-muted">{stats.withdraw}</span>
              <p className="text-xs font-medium text-text-muted">{__( 'Students Withdrawn', 'codeclove-school-management' )}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm border-b border-border pb-2">
              <span className="text-text-muted">{__( 'Source Session:', 'codeclove-school-management' )}</span>
              <span className="font-semibold text-text">
                {sessions.find((s) => s.id.toString() === sourceSessionId)?.name}
              </span>
            </div>
            <div className="flex justify-between text-sm border-b border-border pb-2">
              <span className="text-text-muted">{__( 'Target Session:', 'codeclove-school-management' )}</span>
              <span className="font-semibold text-text">
                {sessions.find((s) => s.id.toString() === targetSessionId)?.name}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{__( 'Total Processed Records:', 'codeclove-school-management' )}</span>
              <span className="font-semibold text-text">{sprintf( __( '%d students', 'codeclove-school-management' ), stats.total )}</span>
            </div>
          </div>
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setPreviewModalOpen(false)}>
            {__( 'Cancel', 'codeclove-school-management' )}
          </Button>
          <Button
            onClick={handleExecuteRollover}
            disabled={executeMutation.isPending}
            className="bg-brand hover:bg-brand-strong gap-1.5"
          >
            {executeMutation.isPending ? (
              <Spinner size="sm" />
            ) : (
              <Check size={14} />
            )}
            {promotionScope === 'all' ? __( 'Confirm & Execute Rollover', 'codeclove-school-management' ) : promotionScope === 'class' ? __( 'Confirm & Execute Class Rollover', 'codeclove-school-management' ) : __( 'Confirm & Execute Student Rollover', 'codeclove-school-management' )}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
