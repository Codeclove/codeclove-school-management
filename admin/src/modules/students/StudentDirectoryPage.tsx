import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/lib/session-context'
import { __, sprintf } from '@/lib/i18n'
import {
  Plus, Search, Eye, Pencil, X, Trash2, Printer, Upload
} from 'lucide-react'
import {
  useStudents,
  useBulkStudentsAction,
  type FullStudent,
  type FullStudent as Student,
} from '@/api/students'
import {
  useUnits,
  useGroups,
  useSessions,
} from '@/api/academics'
import { useExecutePromotion } from '@/api/promotion'
import { printElement } from '@/lib/print'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { useLabels } from '@/lib/labels'
import { useFormatter } from '@/lib/formatter'
import { useEntity } from '@/lib/useEntity'
import { useSettings } from '@/api/settings'
import {
  Button, Badge, Card,
  FormField, Input, Select,
  PageHeader, PersonAvatar, Modal, ModalFooter,
  DataTable, type DataTableColumn
} from '@/components/ui'
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
import { StudentIdCard } from './components/StudentIdCard'

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentDirectoryPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const sessionId = session ? String(session.id) : ''
  const { data: settings } = useSettings()
  const { formatDate } = useFormatter()

  const toast = useToast()
  const confirm = useConfirm()
  const entity = useEntity('student')
  const studentLabelSingular = entity.singular
  const studentLabelPlural = entity.plural
  const { getLabel } = useLabels()
  const unitLabelSingular = getLabel('academic_unit', false, __( 'Class Level', 'codeclove-school-management' ))
  const unitLabelPlural = getLabel('academic_unit', true, __( 'Class Levels', 'codeclove-school-management' ))
  const groupLabelSingular = getLabel('academic_group', false, __( 'Section', 'codeclove-school-management' ))
  const groupLabelPlural = getLabel('academic_group', true, __( 'Sections', 'codeclove-school-management' ))
  const guardianLabelSingular = getLabel('guardian', false, __( 'Guardian', 'codeclove-school-management' ))

  const [unitId, setUnitId] = useState<string>('')
  const [groupId, setGroupId] = useState<string>('')
  const [status, setStatus] = useState<string>('')

  // Search input debouncing
  const [search, setSearch] = useState<string>('')
  const debouncedSearch = useDebounce(search, 350)

  const table = useTableState()
  const { selectedIds, setSelectedIds, clearSelection } = table

  // Reset class level and section filters if the globally active session changes
  useEffect(() => {
    setUnitId('')
    setGroupId('')
    table.resetPage()
    table.clearSelection()
  }, [sessionId, table.resetPage, table.clearSelection])

  // Reset page and selection when filters change
  useEffect(() => {
    table.resetPage()
    table.clearSelection()
  }, [unitId, groupId, status, debouncedSearch, table.resetPage, table.clearSelection])

  const { data: unitData } = useUnits({ session_id: Number(sessionId) })
  const { data: groupData } = useGroups({
    session_id: sessionId ? Number(sessionId) : undefined,
    academic_unit_id: unitId ? Number(unitId) : undefined,
    per_page: 200,
  })

  const { data: studentData, isLoading, isError, refetch } = useStudents({
    academic_session_id: sessionId ? Number(sessionId) : undefined,
    academic_unit_id: unitId ? Number(unitId) : undefined,
    academic_group_id: groupId ? Number(groupId) : undefined,
    status: status || undefined,
    search: debouncedSearch || undefined,
    ...table.params,
  })

  const bulkActionMutation = useBulkStudentsAction()

  const [promoteModalOpen, setPromoteModalOpen] = useState(false)
  const [promoTargetSessionId, setPromoTargetSessionId] = useState('')
  const [promoTargetUnitId, setPromoTargetUnitId] = useState('')
  const [promoTargetGroupId, setPromoTargetGroupId] = useState('')
  const [promoAction, setPromoAction] = useState<'promote' | 'detain' | 'graduate' | 'withdraw'>('promote')

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignTargetUnitId, setAssignTargetUnitId] = useState('')
  const [assignTargetGroupId, setAssignTargetGroupId] = useState('')

  const [printingStudents, setPrintingStudents] = useState<FullStudent[] | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  // Sessions
  const { data: promoSessionsData } = useSessions()
  const promoSessions = promoSessionsData?.data ?? []

  // Class Levels based on selected session for promotion
  const { data: promoUnitsData } = useUnits({
    session_id: promoTargetSessionId ? Number(promoTargetSessionId) : undefined,
    per_page: 200,
  })
  const promoUnits = promoUnitsData?.data ?? []

  // Sections based on class level for promotion
  const { data: promoGroupsData } = useGroups({
    academic_unit_id: promoTargetUnitId ? Number(promoTargetUnitId) : undefined,
    per_page: 200,
  })
  const promoGroups = promoGroupsData?.data ?? []

  // Class Levels for Section assignment
  const { data: assignUnitsData } = useUnits({
    session_id: Number(sessionId),
    per_page: 200,
  })
  const assignUnits = assignUnitsData?.data ?? []

  // Sections for Section assignment based on class level
  const { data: assignGroupsData } = useGroups({
    academic_unit_id: assignTargetUnitId ? Number(assignTargetUnitId) : undefined,
    per_page: 200,
  })
  const assignGroups = assignGroupsData?.data ?? []

  const executePromotionMutation = useExecutePromotion()

  // Reset selection on data change
  useEffect(() => {
    setSelectedIds([])
  }, [studentData])

  useEffect(() => {
    if (printingStudents && printRef.current) {
      printElement(printRef.current)
      setPrintingStudents(null)
    }
  }, [printingStudents])

  // Set default target session on promotion open
  useEffect(() => {
    if (promoteModalOpen && !promoTargetSessionId) {
      setPromoTargetSessionId(sessionId)
    }
  }, [promoteModalOpen, sessionId])

  const handleBulkPrintIdCards = () => {
    const selected = (studentData?.data || []).filter((s) => selectedIds.includes(s.id))
    setPrintingStudents(selected)
  }

  const handleBulkPromoteSubmit = () => {
    if (!promoTargetSessionId || (promoAction !== 'graduate' && promoAction !== 'withdraw' && !promoTargetUnitId)) {
      toast.error(sprintf(__( 'Academic Session and Target %s are required.', 'codeclove-school-management' ), unitLabelSingular))
      return
    }

    const promotions = selectedIds.map((id) => {
      const student = (studentData?.data || []).find((s) => s.id === id)
      return {
        student_id: id,
        action: promoAction,
        current_enrollment_id: student?.enrollment?.id || 0,
        target_unit_id: Number(promoTargetUnitId),
        target_group_id: promoTargetGroupId ? Number(promoTargetGroupId) : null,
      }
    })

    executePromotionMutation.mutate(
      {
        source_session_id: Number(sessionId),
        target_session_id: Number(promoTargetSessionId),
        promotions,
      },
      {
        onSuccess: () => {
          clearSelection()
          setPromoteModalOpen(false)
          setPromoTargetUnitId('')
          setPromoTargetGroupId('')
          toast.success(sprintf(__( 'Successfully promoted/detained selected %s!', 'codeclove-school-management' ), studentLabelPlural.toLowerCase()))
          refetch()
        },
        onError: (err) => {
          toast.error(err.message || __( 'Failed to execute bulk promotions.', 'codeclove-school-management' ))
        }
      }
    )
  }

  const handleBulkAssignSectionSubmit = () => {
    if (!assignTargetUnitId) {
      toast.error(__( 'Class Level is required.', 'codeclove-school-management' ))
      return
    }

    bulkActionMutation.mutate(
      {
        action: 'assign_section',
        ids: selectedIds,
        unit_id: Number(assignTargetUnitId),
        group_id: assignTargetGroupId ? Number(assignTargetGroupId) : undefined,
      },
      {
        onSuccess: (res) => {
          clearSelection()
          setAssignModalOpen(false)
          setAssignTargetUnitId('')
          setAssignTargetGroupId('')
          toast.success(sprintf(__( 'Successfully assigned sections to selected %s!', 'codeclove-school-management' ), studentLabelPlural.toLowerCase()))
          if (res.errors && res.errors.length > 0) {
            toast.error(sprintf(__( 'Some assignments failed: %s', 'codeclove-school-management' ), res.errors.join('; ')))
          }
          refetch()
        },
        onError: (err) => {
          toast.error(err.message || __( 'Failed to update section assignments.', 'codeclove-school-management' ))
        }
      }
    )
  }

  const handleBulkStatus = (newStatus: string) => {
    bulkActionMutation.mutate(
      { action: 'status', ids: selectedIds, status: newStatus },
      {
        onSuccess: () => {
          setSelectedIds([])
          toast.success(sprintf(__( 'Successfully updated status for selected %s!', 'codeclove-school-management' ), studentLabelPlural.toLowerCase()))
        },
        onError: (err) => {
          toast.error(err.message || __( 'Failed to perform bulk status update.', 'codeclove-school-management' ))
        }
      }
    )
  }

  const handleBulkDelete = async () => {
    const isConfirmed = await confirm({
      title: sprintf(__( 'Delete Selected %s', 'codeclove-school-management' ), studentLabelPlural),
      message: sprintf(__( 'Are you sure you want to delete the %1$d selected %2$s?', 'codeclove-school-management' ), selectedIds.length, studentLabelPlural.toLowerCase()),
    })
    if (!isConfirmed) return

    bulkActionMutation.mutate(
      { action: 'delete', ids: selectedIds },
      {
        onSuccess: (res) => {
          setSelectedIds([])
          toast.success(sprintf(__( 'Successfully deleted %1$d %2$s!', 'codeclove-school-management' ), res.deleted_count, studentLabelPlural.toLowerCase()))
          if (res.errors && res.errors.length > 0) {
            toast.error(sprintf(__( 'Some %1$s could not be deleted: %2$s', 'codeclove-school-management' ), studentLabelPlural.toLowerCase(), res.errors.join('; ')))
          }
        },
        onError: (err) => {
          toast.error(err.message || sprintf(__( 'Failed to bulk delete %s.', 'codeclove-school-management' ), studentLabelPlural.toLowerCase()))
        }
      }
    )
  }

  const handleSingleDelete = async (id: number, name: string) => {
    const isConfirmed = await confirm({
      title: sprintf(__( 'Delete %s', 'codeclove-school-management' ), studentLabelSingular),
      message: sprintf(__( 'Are you sure you want to delete student %s?', 'codeclove-school-management' ), name),
    })
    if (!isConfirmed) return

    bulkActionMutation.mutate(
      { action: 'delete', ids: [id] },
      {
        onSuccess: (res) => {
          toast.success(sprintf(__( 'Successfully deleted student %s!', 'codeclove-school-management' ), name))
          if (res.errors && res.errors.length > 0) {
            toast.error(sprintf(__( 'Could not delete student: %s', 'codeclove-school-management' ), res.errors.join('; ')))
          }
        },
        onError: (err) => {
          toast.error(err.message || __( 'Failed to delete student.', 'codeclove-school-management' ))
        }
      }
    )
  }

  const units = unitData?.data ?? []
  const groups = groupData?.data ?? []
  const students = studentData?.data ?? []
  const total = studentData?.total ?? 0


  const columns: DataTableColumn<Student>[] = useMemo(
    () => [
      {
        key: 'first_name',
        header: studentLabelSingular,
        type: 'primary',
        sortable: true,
        sortKey: 'first_name',
        render: (student) => (
          <PersonAvatar
            name={`${student.first_name} ${student.last_name}`}
            subtitle={student.student_number || undefined}
            photoUrl={student.photo_url}
          />
        ),
      },
      {
        key: 'admission_number',
        header: __( 'Admission No.', 'codeclove-school-management' ),
        type: 'code',
        sortable: true,
        sortKey: 'admission_number',
        render: (student) => student.admission_number || '—',
      },
      {
        key: 'unit_name',
        header: unitLabelSingular,
        render: (student) => student.enrollment?.unit_name || '—',
      },
      {
        key: 'group_name',
        header: groupLabelSingular,
        render: (student) => student.enrollment?.group_name || '—',
      },
      {
        key: 'primary_guardian',
        header: sprintf(__( 'Primary %s', 'codeclove-school-management' ), guardianLabelSingular),
        render: (student) =>
          student.primary_guardian
            ? `${student.primary_guardian.first_name} ${student.primary_guardian.last_name}`.trim()
            : '—',
      },
      {
        key: 'status',
        header: __( 'Status', 'codeclove-school-management' ),
        type: 'badge',
        sortable: true,
        sortKey: 'status',
        render: (student) => (
          <Badge variant={student.status}>{student.status}</Badge>
        ),
      },
      {
        key: 'actions',
        header: __( 'Actions', 'codeclove-school-management' ),
        type: 'actions',
        render: (student) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/students/${student.id}`)}
              className="h-8 w-8 text-text-subtle hover:text-brand"
              title={__( 'View Profile', 'codeclove-school-management' )}
            >
              <Eye size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/students/${student.id}/edit`)}
              className="h-8 w-8 text-text-subtle hover:text-brand"
              title={__( 'Edit Profile', 'codeclove-school-management' )}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSingleDelete(student.id, `${student.first_name} ${student.last_name}`)}
              className="h-8 w-8 text-text-subtle hover:text-danger"
              title={__( 'Delete Record', 'codeclove-school-management' )}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [
      studentLabelSingular,
      unitLabelSingular,
      groupLabelSingular,
      guardianLabelSingular,
      navigate,
    ]
  )

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={sprintf(__( '%s Directory', 'codeclove-school-management' ), studentLabelSingular)}
        breadcrumbs={[{ label: studentLabelPlural }, { label: sprintf(__( '%s Directory', 'codeclove-school-management' ), studentLabelSingular) }]}
        description={sprintf(
          __( 'View registered %1$s directories, %2$s details, primary emergency contacts, and enroll manual %3$s records.', 'codeclove-school-management' ),
          studentLabelSingular.toLowerCase(),
          unitLabelSingular.toLowerCase(),
          studentLabelSingular.toLowerCase()
        )}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/students/import')} className="gap-1.5">
              <Upload size={14} />
              {__( 'Bulk Import', 'codeclove-school-management' )}
            </Button>
            <Button onClick={() => navigate('/students/new')} className="gap-1.5">
              <Plus size={14} />
              {sprintf(__( 'Admit %s', 'codeclove-school-management' ), studentLabelSingular)}
            </Button>
          </div>
        }
      />

      {/* Filters Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <FormField label={sprintf(__( 'Search %s', 'codeclove-school-management' ), studentLabelPlural)}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={__( 'Search by name, ID number...', 'codeclove-school-management' )}
                  className="pl-9"
                />
              </div>
            </FormField>
          </div>
          <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
            <FormField label={unitLabelSingular}>
              <Select
                value={unitId}
                onValueChange={(val) => {
                  setUnitId(val)
                  setGroupId('')
                }}
                placeholder={sprintf(__( 'All %s', 'codeclove-school-management' ), unitLabelPlural.toLowerCase())}
                options={[
                  { value: '', label: sprintf(__( 'All %s', 'codeclove-school-management' ), unitLabelPlural.toLowerCase()) },
                  ...units.map((u) => ({ value: String(u.id), label: u.name })),
                ]}
              />
            </FormField>
          </div>
          <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
            <FormField label={groupLabelSingular}>
              <Select
                value={groupId}
                onValueChange={setGroupId}
                placeholder={sprintf(__( 'All %s', 'codeclove-school-management' ), groupLabelPlural.toLowerCase())}
                disabled={!unitId}
                options={[
                  { value: '', label: sprintf(__( 'All %s', 'codeclove-school-management' ), groupLabelPlural.toLowerCase()) },
                  ...groups.map((g) => ({ value: String(g.id), label: g.name })),
                ]}
              />
            </FormField>
          </div>
          <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
            <FormField label={__( 'Status', 'codeclove-school-management' )}>
              <Select
                value={status}
                onValueChange={setStatus}
                placeholder={__( 'All statuses', 'codeclove-school-management' )}
                options={[
                  { value: '', label: __( 'All statuses', 'codeclove-school-management' ) },
                  { value: 'active', label: __( 'Active', 'codeclove-school-management' ) },
                  { value: 'inactive', label: __( 'Inactive', 'codeclove-school-management' ) },
                  { value: 'graduated', label: __( 'Graduated', 'codeclove-school-management' ) },
                  { value: 'withdrawn', label: __( 'Withdrawn', 'codeclove-school-management' ) },
                ]}
              />
            </FormField>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 h-9">
            {(unitId || groupId || status || search) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setUnitId('')
                  setGroupId('')
                  setStatus('')
                  setSearch('')
                  table.clearSelection()
                }}
              >
                <X size={12} />
                {__( 'Clear Filters', 'codeclove-school-management' )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Students Data Table */}
      <DataTable<Student>
        data={students}
        columns={columns}
        table={table}
        total={total}
        isLoading={isLoading}
        isError={isError}
        errorMessage={sprintf(__( 'Could not load %s list', 'codeclove-school-management' ), studentLabelSingular.toLowerCase())}
        onRetry={() => refetch()}
        selectable
        onRowClick={(student) => navigate(`/students/${student.id}`)}
        bulkActions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkPrintIdCards}
              className="h-7 text-xs flex items-center gap-1"
            >
              <Printer size={12} /> {__( 'Print ID Cards', 'codeclove-school-management' )}
            </Button>
            <Select
              value=""
              onValueChange={(val) => {
                if (val === 'delete') {
                  handleBulkDelete()
                } else if (val === 'promote') {
                  setPromoteModalOpen(true)
                } else if (val === 'assign_section') {
                  setAssignModalOpen(true)
                } else if (val.startsWith('status:')) {
                  handleBulkStatus(val.replace('status:', ''))
                }
              }}
              placeholder={__( 'Bulk Actions', 'codeclove-school-management' )}
              options={[
                { value: '', label: __( 'Bulk Actions', 'codeclove-school-management' ) },
                { value: 'status:active', label: __( 'Mark Active', 'codeclove-school-management' ) },
                { value: 'status:inactive', label: __( 'Mark Inactive', 'codeclove-school-management' ) },
                { value: 'status:graduated', label: __( 'Mark Graduated', 'codeclove-school-management' ) },
                { value: 'status:withdrawn', label: __( 'Mark Withdrawn', 'codeclove-school-management' ) },
                { value: 'promote', label: __( 'Promote Selected', 'codeclove-school-management' ) },
                { value: 'assign_section', label: __( 'Assign Class & Section', 'codeclove-school-management' ) },
                { value: 'delete', label: __( 'Delete Selected', 'codeclove-school-management' ) },
              ]}
              className="h-7 text-xs w-full sm:w-48 bg-bg-surface"
            />
          </>
        }
        emptyState={{
          icon: entity.icon,
          message:
            debouncedSearch || status || unitId || groupId
              ? __( 'No Students Match Filters', 'codeclove-school-management' )
              : sprintf(__( 'No %s Found', 'codeclove-school-management' ), studentLabelPlural),
          description:
            debouncedSearch || status || unitId || groupId
              ? __( 'Try adjusting your search query, class level, or section filter.', 'codeclove-school-management' )
              : sprintf(__( 'Admit your first %s to configure their academic record.', 'codeclove-school-management' ), studentLabelSingular.toLowerCase()),
          action:
            !debouncedSearch && !status && !unitId && !groupId ? (
              <Button size="sm" onClick={() => navigate('/students/new')}>
                {sprintf(__( 'Admit %s', 'codeclove-school-management' ), studentLabelSingular)}
              </Button>
            ) : undefined,
        }}
      />

      {/* Bulk Promotion Modal */}
      <Modal
        open={promoteModalOpen}
        onOpenChange={setPromoteModalOpen}
        title={__( 'Promote Selected Students', 'codeclove-school-management' )}
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-text-muted">
            {sprintf(
              __( 'Execute batch promotions or status roll-overs for the %d selected students.', 'codeclove-school-management' ),
              selectedIds.length
            )}
          </p>

          <FormField label={__( 'Target Academic Session', 'codeclove-school-management' )} required>
            <Select
              value={promoTargetSessionId}
              onValueChange={setPromoTargetSessionId}
              options={promoSessions.map((s) => ({ value: String(s.id), label: s.name }))}
              placeholder={__( 'Select target session', 'codeclove-school-management' )}
            />
          </FormField>

          <FormField label={__( 'Action', 'codeclove-school-management' )}>
            <Select
              value={promoAction}
              onValueChange={(val) => setPromoAction(val as 'promote' | 'detain' | 'graduate' | 'withdraw')}
              options={[
                { value: 'promote', label: __( 'Promote to Class Level', 'codeclove-school-management' ) },
                { value: 'detain', label: __( 'Detain in Class Level', 'codeclove-school-management' ) },
                { value: 'graduate', label: __( 'Graduate Students', 'codeclove-school-management' ) },
                { value: 'withdraw', label: __( 'Withdraw Students', 'codeclove-school-management' ) },
              ]}
              placeholder={__( 'Select action', 'codeclove-school-management' )}
            />
          </FormField>

          {(promoAction === 'promote' || promoAction === 'detain') && (
            <>
              <FormField label={sprintf(__( 'Target %s', 'codeclove-school-management' ), unitLabelSingular)} required>
                <Select
                  value={promoTargetUnitId}
                  onValueChange={setPromoTargetUnitId}
                  options={promoUnits.map((u) => ({ value: String(u.id), label: u.name }))}
                  placeholder={sprintf(__( 'Select target %s', 'codeclove-school-management' ), unitLabelSingular.toLowerCase())}
                  disabled={!promoTargetSessionId}
                />
              </FormField>

              <FormField label={sprintf(__( 'Target %s (Optional)', 'codeclove-school-management' ), groupLabelSingular)}>
                <Select
                  value={promoTargetGroupId}
                  onValueChange={setPromoTargetGroupId}
                  options={promoGroups.map((g) => ({ value: String(g.id), label: g.name }))}
                  placeholder={sprintf(__( 'Select target %s', 'codeclove-school-management' ), groupLabelSingular.toLowerCase())}
                  disabled={!promoTargetUnitId}
                />
              </FormField>
            </>
          )}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setPromoteModalOpen(false)}>
            {__( 'Cancel', 'codeclove-school-management' )}
          </Button>
          <Button onClick={handleBulkPromoteSubmit} disabled={executePromotionMutation.isPending}>
            {__( 'Execute Rollover', 'codeclove-school-management' )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Bulk Section Assignment Modal */}
      <Modal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        title={sprintf(__( 'Assign %1$s & %2$s', 'codeclove-school-management' ), unitLabelSingular, groupLabelSingular)}
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-text-muted">
            {sprintf(
              __( 'Batch assign the %1$d selected students to a %2$s and %3$s. This will update their active enrollment records for the current session.', 'codeclove-school-management' ),
              selectedIds.length,
              unitLabelSingular.toLowerCase(),
              groupLabelSingular.toLowerCase()
            )}
          </p>

          <FormField label={unitLabelSingular} required>
            <Select
              value={assignTargetUnitId}
              onValueChange={val => {
                setAssignTargetUnitId(val)
                setAssignTargetGroupId('')
              }}
              options={assignUnits.map((u) => ({ value: String(u.id), label: u.name }))}
              placeholder={sprintf(__( 'Select %s', 'codeclove-school-management' ), unitLabelSingular.toLowerCase())}
            />
          </FormField>

          <FormField label={sprintf(__( '%s (Optional)', 'codeclove-school-management' ), groupLabelSingular)}>
            <Select
              value={assignTargetGroupId}
              onValueChange={setAssignTargetGroupId}
              options={assignGroups.map((g) => ({ value: String(g.id), label: g.name }))}
              placeholder={sprintf(__( 'Select %s', 'codeclove-school-management' ), groupLabelSingular.toLowerCase())}
              disabled={!assignTargetUnitId}
            />
          </FormField>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>
            {__( 'Cancel', 'codeclove-school-management' )}
          </Button>
          <Button onClick={handleBulkAssignSectionSubmit} disabled={bulkActionMutation.isPending}>
            {__( 'Assign Section', 'codeclove-school-management' )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Hidden print container for Student ID Cards */}
      {printingStudents && (
        <div style={{ visibility: 'hidden', position: 'fixed', top: 0, left: 0, pointerEvents: 'none' }}>
          <div ref={printRef} className="bg-white text-black font-sans">
            {Array.from({ length: Math.ceil(printingStudents.length / 2) }, (_, pageIdx) => {
              const pageStudents = printingStudents.slice(pageIdx * 2, pageIdx * 2 + 2)
              const isLastPage = pageIdx === Math.ceil(printingStudents.length / 2) - 1
              return (
                <div
                  key={pageIdx}
                  className={!isLastPage ? 'print-page-break' : ''}
                >
                  <div className="flex flex-col gap-5 w-full max-w-[180mm] mx-auto py-2">
                    {pageStudents.map((student) => (
                      <StudentIdCard
                        key={student.id}
                        student={student}
                        unitName={student.enrollment?.unit_name}
                        groupName={student.enrollment?.group_name}
                        rollNumber={student.enrollment?.roll_number}
                        school={settings?.school}
                        sessionLabel={session?.label}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
