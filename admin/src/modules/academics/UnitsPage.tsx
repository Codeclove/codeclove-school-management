/**
 * Units Page — Classes & Grades CRUD.
 *
 * Displays a list of academic units (e.g. Grades/Forms) scoped to the active session.
 */
import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { unitSchema, type UnitFormValues } from '@/schemas/academics'
import {
  Plus, Pencil, Trash2, RefreshCw, BookOpen,
  AlertTriangle, Search, X
} from 'lucide-react'
import {
  useUnits,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
  useUnitSubjects,
  useSubjects,
  useAssignSubject,
  useUnassignSubject,
  type AcademicUnit,
  type CreateUnitPayload,
} from '@/api/academics'
import { useSession } from '@/lib/session-context'
import { useLabels } from '@/lib/labels'
import { useToast } from '@/lib/toast'
import { onFormError } from '@/lib/form-errors'
import { useConfirm } from '@/lib/confirm'
import { useEntity } from '@/lib/useEntity'
import { AcademicsNav } from './components/AcademicsNav'
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
import {
  DataTable,
  type DataTableColumn,
  Button, Badge, Card,
  Modal, ModalFooter, FormField, Input, Select,
  TableRoot, Thead, Tbody, Tr, Th, Td, TableSkeleton,
  PageHeader, Spinner,
  type BadgeProps,
} from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'

// ─── Status Config Helper ────────────────────────────────────────────────────

function getStatusConfig(): Record<
  AcademicUnit['status'] | 'inactive',
  { label: string; variant: BadgeProps['variant'] }
> {
  return {
    active:   { label: __( 'Active', 'codeclove-school-management' ),   variant: 'active' },
    inactive: { label: __( 'Inactive', 'codeclove-school-management' ), variant: 'inactive' },
    archived: { label: __( 'Archived', 'codeclove-school-management' ), variant: 'archived' },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UnitsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const entity = useEntity('class_level')
  const unitLabelPlural = entity.plural
  const unitLabelSingular = entity.singular
  const { getLabel } = useLabels()
  const sessionLabelSingular = getLabel('academic_session', false, __( 'Academic Session', 'codeclove-school-management' ))
  const groupLabelPlural = getLabel('academic_group', true, __( 'Academic Groups', 'codeclove-school-management' ))

  const { session } = useSession()
  const session_id = session?.id ?? 0

  const table = useTableState()
  const [status, setStatus] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const debouncedSearch = useDebounce(search, 350)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<AcademicUnit | null>(null)
  const [subjectsTarget, setSubjectsTarget] = useState<AcademicUnit | null>(null)

  const { data, isLoading, isError, refetch } = useUnits({
    session_id,
    status: status || undefined,
    search: debouncedSearch || undefined,
    ...table.params,
  })
  const deleteMutation = useDeleteUnit()

  const handleDelete = async (unit: AcademicUnit) => {
    const isConfirmed = await confirm({
      title: sprintf( __( 'Delete %s', 'codeclove-school-management' ), unitLabelSingular ),
      message: sprintf(
        __( 'Are you sure you want to delete %1$s? All %2$s inside this level must be deleted first.', 'codeclove-school-management' ),
        unit.name,
        groupLabelPlural.toLowerCase()
      ),
    })
    if (!isConfirmed) return

    deleteMutation.mutate(unit.id, {
      onSuccess: () => {
        toast.success( sprintf( __( '%s deleted successfully!', 'codeclove-school-management' ), unitLabelSingular ) )
      },
      onError: (err) => {
        toast.error(err.message || sprintf( __( 'Failed to delete %s.', 'codeclove-school-management' ), unitLabelSingular.toLowerCase() ))
      }
    })
  }

  const units = data?.data ?? []
  const total = data?.total ?? 0

  const { data: allUnitsData } = useUnits({
    session_id,
    per_page: 200,
  })
  const allUnits = allUnitsData?.data ?? []

  const statusConfig = useMemo(() => getStatusConfig(), [])
  const subjectLabelPlural = getLabel('subject', true, __( 'Subjects', 'codeclove-school-management' ))

  const columns = useMemo<DataTableColumn<AcademicUnit>[]>(
    () => [
      {
        key: 'name',
        header: __( 'Name', 'codeclove-school-management' ),
        type: 'primary',
        sortable: true,
        render: (unit) => <span className="font-semibold text-text">{unit.name}</span>,
      },
      {
        key: 'code',
        header: __( 'Code', 'codeclove-school-management' ),
        type: 'code',
        sortable: true,
        render: (unit) =>
          unit.code ? (
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-bg-surface border border-border text-text-muted">
              {unit.code}
            </span>
          ) : (
            <span className="text-text-subtle">—</span>
          ),
      },
      {
        key: 'order',
        header: __( 'Order / Level', 'codeclove-school-management' ),
        type: 'number',
        sortable: true,
        render: (unit) => unit.order,
      },
      {
        key: 'groups_count',
        header: groupLabelPlural,
        type: 'number',
        sortable: true,
        render: (unit) => unit.groups_count,
      },
      {
        key: 'students_count',
        header: __( 'Active Students', 'codeclove-school-management' ),
        type: 'number',
        sortable: true,
        render: (unit) => unit.students_count,
      },
      {
        key: 'status',
        header: __( 'Status', 'codeclove-school-management' ),
        type: 'badge',
        sortable: true,
        render: (unit) => {
          const cfg = statusConfig[unit.status] ?? statusConfig.inactive
          return (
            <Badge variant={cfg.variant} size="sm" dot>
              {cfg.label}
            </Badge>
          )
        },
      },
      {
        key: 'actions',
        header: __( 'Actions', 'codeclove-school-management' ),
        type: 'actions',
        render: (unit) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSubjectsTarget(unit)}
              className="h-8 w-8 text-text-muted hover:text-brand hover:bg-brand-dim/50"
              title={sprintf( __( 'Manage %s', 'codeclove-school-management' ), subjectLabelPlural )}
            >
              <BookOpen size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditTarget(unit)
                setShowModal(true)
              }}
              className="h-8 w-8 text-text-muted hover:text-brand hover:bg-brand-dim/50"
              title={sprintf( __( 'Edit %s', 'codeclove-school-management' ), unitLabelSingular )}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(unit)}
              className="h-8 w-8 text-text-muted hover:text-danger hover:bg-danger-dim/50"
              title={sprintf( __( 'Delete %s', 'codeclove-school-management' ), unitLabelSingular )}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [statusConfig, groupLabelPlural, subjectLabelPlural, unitLabelSingular]
  )

  // Reset page and selection when session, status, or search changes
  useEffect(() => {
    table.resetPage()
    table.clearSelection()
  }, [session_id, status, debouncedSearch, table.resetPage, table.clearSelection])

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={unitLabelPlural}
        breadcrumbs={[{ label: __( 'Academics', 'codeclove-school-management' ) }, { label: unitLabelPlural }]}
        description={sprintf(
          __( 'Manage the %1$s or grades configured under the selected %2$s.', 'codeclove-school-management' ),
          unitLabelPlural.toLowerCase(),
          sessionLabelSingular.toLowerCase()
        )}
        actions={
          <Button
            onClick={() => {
              setEditTarget(null)
              setShowModal(true)
            }}
            disabled={!session_id}
            className="gap-1.5 font-semibold text-xs h-9"
          >
            <Plus size={14} />
            {sprintf( __( 'New %s', 'codeclove-school-management' ), unitLabelSingular )}
          </Button>
        }
      />

      <AcademicsNav />

      {/* Filters Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <FormField label={sprintf( __( 'Search %s', 'codeclove-school-management' ), unitLabelPlural )}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={__( 'Search by name, code...', 'codeclove-school-management' )}
                  className="pl-9"
                />
              </div>
            </FormField>
          </div>
          <div className="w-full sm:w-40 lg:w-48 min-w-[140px]">
            <FormField label={__( 'Status', 'codeclove-school-management' )}>
              <Select
                value={status}
                onValueChange={setStatus}
                placeholder={__( 'All statuses', 'codeclove-school-management' )}
                options={[
                  { value: '', label: __( 'All statuses', 'codeclove-school-management' ) },
                  { value: 'active', label: __( 'Active', 'codeclove-school-management' ) },
                  { value: 'inactive', label: __( 'Inactive', 'codeclove-school-management' ) },
                  { value: 'archived', label: __( 'Archived', 'codeclove-school-management' ) },
                ]}
              />
            </FormField>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 h-9">
            {(search || status) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch('')
                  setStatus('')
                  table.resetPage()
                  table.clearSelection()
                }}
                className="text-xs text-text-muted hover:text-text gap-1"
              >
                <X size={12} />
                {__( 'Clear Filters', 'codeclove-school-management' )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <DataTable<AcademicUnit>
        data={units}
        columns={columns}
        table={table}
        total={total}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={
          isError
            ? {
                icon: AlertTriangle,
                message: sprintf( __( 'Could not load %s', 'codeclove-school-management' ), unitLabelPlural.toLowerCase() ),
                description: sprintf( __( 'An error occurred while fetching %s from the backend REST API.', 'codeclove-school-management' ), unitLabelPlural.toLowerCase() ),
                action: (
                  <Button variant="secondary" size="sm" onClick={() => refetch()} className="gap-1.5">
                    <RefreshCw size={13} />
                    {__( 'Try again', 'codeclove-school-management' )}
                  </Button>
                ),
              }
            : {
                icon: entity.icon,
                message:
                  search || status
                    ? __( 'No Class Levels Match Filters', 'codeclove-school-management' )
                    : !session_id
                    ? __( 'Session Not Selected', 'codeclove-school-management' )
                    : sprintf( __( 'No %s Found', 'codeclove-school-management' ), unitLabelPlural ),
                description:
                  search || status
                    ? __( 'Try adjusting your search query or status filter.', 'codeclove-school-management' )
                    : !session_id
                    ? sprintf( __( 'Select an active %1$s in the header to view %2$s.', 'codeclove-school-management' ), sessionLabelSingular.toLowerCase(), unitLabelPlural.toLowerCase() )
                    : sprintf( __( 'Get started by creating your first reusable school %s level template.', 'codeclove-school-management' ), unitLabelSingular.toLowerCase() ),
                action:
                  !search && !status && session_id ? (
                    <Button size="sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                      {sprintf( __( 'New %s', 'codeclove-school-management' ), unitLabelSingular )}
                    </Button>
                  ) : undefined,
              }
        }
        keyExtractor={(unit) => unit.id}
      />

      {/* Unit Modal */}
      <UnitModal
        open={showModal}
        onClose={() => setShowModal(false)}
        session_id={session_id}
        unit={editTarget}
        onSuccess={() => setShowModal(false)}
        unitLabelSingular={unitLabelSingular}
        existingUnits={allUnits}
      />

      {subjectsTarget && (
        <ManageSubjectsModal
          unit={subjectsTarget}
          session_id={session_id}
          onClose={() => setSubjectsTarget(null)}
        />
      )}
    </div>
  )
}


// ─── Unit Modal (Create & Edit) ─────────────────────────────────────────────

function UnitModal({
  open,
  onClose,
  session_id,
  unit,
  onSuccess,
  unitLabelSingular,
  existingUnits = [],
}: {
  open: boolean
  onClose: () => void
  session_id: number
  unit: AcademicUnit | null
  onSuccess: () => void
  unitLabelSingular: string
  existingUnits?: AcademicUnit[]
}) {
  const toast = useToast()
  const { getLabel } = useLabels()
  const sessionLabelSingular = getLabel('academic_session', false, __( 'Academic Session', 'codeclove-school-management' ))

  const createMutation = useCreateUnit()
  const updateMutation = useUpdateUnit()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: { status: 'active', order: 0 },
  })

  useEffect(() => {
    if (open) {
      if (unit) {
        reset({
          name:   unit.name,
          code:   unit.code ?? '',
          order:  unit.order,
          status: (unit.status === 'active' || unit.status === 'archived') ? unit.status : 'inactive',
        })
      } else {
        const maxOrder = existingUnits.length > 0
          ? Math.max(...existingUnits.map((u) => u.order))
          : -1
        reset({
          name:   '',
          code:   '',
          order:  maxOrder + 1,
          status: 'active',
        })
      }
    }
  }, [unit, open, reset, existingUnits])

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = (values: UnitFormValues) => {
    if (unit) {
      updateMutation.mutate(
        { id: unit.id, data: values },
        {
          onSuccess: () => {
            reset()
            onSuccess()
            toast.success(sprintf( __( '%s updated successfully!', 'codeclove-school-management' ), unitLabelSingular ))
          },
          onError: (err) => {
            toast.error(err.message || sprintf( __( 'Failed to update %s.', 'codeclove-school-management' ), unitLabelSingular.toLowerCase() ))
          }
        }
      )
    } else {
      createMutation.mutate(
        {
          session_id,
          name:  values.name,
          code:  values.code || undefined,
          order: values.order,
        } as CreateUnitPayload,
        {
          onSuccess: () => {
            reset()
            onSuccess()
            toast.success(sprintf( __( '%s created successfully!', 'codeclove-school-management' ), unitLabelSingular ))
          },
          onError: (err) => {
            toast.error(err.message || sprintf( __( 'Failed to create %s.', 'codeclove-school-management' ), unitLabelSingular.toLowerCase() ))
          }
        }
      )
    }
  }

  const isPending  = createMutation.isPending || updateMutation.isPending
  const statusValue = watch('status')

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose()
      }}
      title={unit ? sprintf( __( 'Edit %s', 'codeclove-school-management' ), unitLabelSingular ) : sprintf( __( 'New %s', 'codeclove-school-management' ), unitLabelSingular )}
      description={
        unit
          ? sprintf( __( 'Modify %s details.', 'codeclove-school-management' ), unitLabelSingular.toLowerCase() )
          : sprintf( __( 'Create a new %1$s or grade under this %2$s.', 'codeclove-school-management' ), unitLabelSingular.toLowerCase(), sessionLabelSingular.toLowerCase() )
      }
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit, onFormError)} className="space-y-4">
        <FormField label={sprintf( __( '%s/Grade Name', 'codeclove-school-management' ), unitLabelSingular )} error={errors.name?.message} required>
          <Input
            {...register('name')}
            placeholder={__( 'e.g. Grade 10', 'codeclove-school-management' )}
            error={!!errors.name}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={__( 'Short Code', 'codeclove-school-management' )} error={errors.code?.message}>
            <Input
              {...register('code')}
              placeholder={__( 'e.g. G10', 'codeclove-school-management' )}
              error={!!errors.code}
            />
          </FormField>
          <FormField label={__( 'Level Order', 'codeclove-school-management' )} error={errors.order?.message} required>
            <Input
              {...register('order')}
              type="number"
              error={!!errors.order}
            />
          </FormField>
        </div>

        {unit && (
          <FormField label={__( 'Status', 'codeclove-school-management' )} error={errors.status?.message} required>
            <Select
              value={statusValue}
              onValueChange={(v) => setValue('status', v as UnitFormValues['status'])}
              options={[
                { value: 'active',   label: __( 'Active', 'codeclove-school-management' ) },
                { value: 'inactive', label: __( 'Inactive', 'codeclove-school-management' ) },
                { value: 'archived', label: __( 'Archived', 'codeclove-school-management' ) },
              ]}
            />
          </FormField>
        )}

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            {__( 'Cancel', 'codeclove-school-management' )}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Spinner size="xs" className="mr-1.5" />}
            {unit ? __( 'Save Changes', 'codeclove-school-management' ) : sprintf( __( 'Create %s', 'codeclove-school-management' ), unitLabelSingular )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

// ─── Manage Subjects Modal ───────────────────────────────────────────────────

function ManageSubjectsModal({
  unit,
  session_id,
  onClose,
}: {
  unit: AcademicUnit
  session_id: number
  onClose: () => void
}) {
  const toast = useToast()
  const { getLabel } = useLabels()
  const unitLabelSingular = getLabel('academic_unit', false, __( 'Academic Unit', 'codeclove-school-management' ))
  const subjectLabelSingular = getLabel('subject', false, __( 'Subject', 'codeclove-school-management' ))
  const subjectLabelPlural = getLabel('subject', true, __( 'Subjects', 'codeclove-school-management' ))

  const { data: mappedSubjects = [], isLoading: loadingMapped } = useUnitSubjects(unit.id)
  const { data: allSubjectsData } = useSubjects({ session_id, per_page: 100 })
  const assignMutation   = useAssignSubject()
  const unassignMutation = useUnassignSubject()

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [isRequired, setIsRequired]               = useState(true)
  const [errorMsg, setErrorMsg]                   = useState('')
  // ID of the subject pending unassign confirmation (replaces confirm() dialog)
  const [pendingUnassignId, setPendingUnassignId] = useState<number | null>(null)

  const allSubjects = allSubjectsData?.data ?? []

  // Filter out subjects that are already assigned
  const assignedIds      = new Set(mappedSubjects.map((ms) => ms.subject_id))
  const assignableSubjects = allSubjects.filter((s) => !assignedIds.has(s.id))

  const handleAssign = () => {
    setErrorMsg('')
    if (!selectedSubjectId) {
      setErrorMsg(sprintf( __( 'Please select a %s', 'codeclove-school-management' ), subjectLabelSingular.toLowerCase() ))
      return
    }

    assignMutation.mutate(
      {
        unit_id: unit.id,
        data: {
          subject_id:  parseInt(selectedSubjectId, 10),
          is_required: isRequired,
          sort_order:  mappedSubjects.length,
        },
      },
      {
        // Cache invalidation in useAssignSubject's onSuccess re-fetches automatically.
        onSuccess: () => {
          setSelectedSubjectId('')
          toast.success(sprintf( __( '%s assigned successfully!', 'codeclove-school-management' ), subjectLabelSingular ))
        },
        onError:   (err: Error) => {
          setErrorMsg(err.message || sprintf( __( 'Failed to assign %s', 'codeclove-school-management' ), subjectLabelSingular.toLowerCase() ))
          toast.error(err.message || sprintf( __( 'Failed to assign %s', 'codeclove-school-management' ), subjectLabelSingular.toLowerCase() ))
        },
      }
    )
  }

  const handleUnassign = (subjectId: number) => {
    setErrorMsg('')
    setPendingUnassignId(null)
    unassignMutation.mutate(
      { unit_id: unit.id, subject_id: subjectId },
      {
        // Cache invalidation in useUnassignSubject's onSuccess re-fetches automatically.
        onSuccess: () => {
          toast.success(sprintf( __( '%s unassigned successfully!', 'codeclove-school-management' ), subjectLabelSingular ))
        },
        onError: (err: Error) => {
          setErrorMsg(err.message || sprintf( __( 'Failed to unassign %s', 'codeclove-school-management' ), subjectLabelSingular.toLowerCase() ))
          toast.error(err.message || sprintf( __( 'Failed to unassign %s', 'codeclove-school-management' ), subjectLabelSingular.toLowerCase() ))
        },
      }
    )
  }

  const isPending = assignMutation.isPending || unassignMutation.isPending

  const typeLabels: Record<string, string> = {
    core: __( 'Core', 'codeclove-school-management' ),
    elective: __( 'Elective', 'codeclove-school-management' ),
    activity: __( 'Co-Curricular', 'codeclove-school-management' ),
    other: __( 'Other', 'codeclove-school-management' ),
  }

  return (
    <Modal
      open={true}
      onOpenChange={(open) => { if (!open) onClose() }}
      title={sprintf( __( '%1$s for %2$s', 'codeclove-school-management' ), subjectLabelPlural, unit.name )}
      description={sprintf(
        __( 'Map academic %1$s to this %2$s. Specify whether they are Required or Optional.', 'codeclove-school-management' ),
        subjectLabelPlural.toLowerCase(),
        unitLabelSingular.toLowerCase()
      )}
      size="lg"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-danger/5 border border-danger/20 text-xs text-danger font-medium">
            {errorMsg}
          </div>
        )}

        {/* Assignment Form */}
        <div className="p-3.5 rounded-xl bg-bg-surface border border-border space-y-3">
          <p className="text-xs font-semibold text-text uppercase tracking-wider">{sprintf( __( 'Assign %s', 'codeclove-school-management' ), subjectLabelSingular )}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label={subjectLabelSingular} required>
              <Select
                value={selectedSubjectId}
                onValueChange={setSelectedSubjectId}
                disabled={assignableSubjects.length === 0}
                placeholder={
                  assignableSubjects.length === 0
                    ? sprintf( __( 'All %s already assigned', 'codeclove-school-management' ), subjectLabelPlural.toLowerCase() )
                    : sprintf( __( 'Select %s...', 'codeclove-school-management' ), subjectLabelSingular.toLowerCase() )
                }
                options={assignableSubjects.map((s) => ({
                  value: String(s.id),
                  label: s.code ? `[${s.code}] ${s.name}` : s.name,
                }))}
              />
            </FormField>

            <FormField label={__( 'Requirement', 'codeclove-school-management' )} required>
              <Select
                value={isRequired ? 'core' : 'elective'}
                onValueChange={(v) => setIsRequired(v === 'core')}
                options={[
                  { value: 'core', label: __( 'Required', 'codeclove-school-management' ) },
                  { value: 'elective', label: __( 'Optional', 'codeclove-school-management' ) },
                ]}
              />
            </FormField>
          </div>

          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={handleAssign} disabled={isPending || !selectedSubjectId}>
              {isPending && <Spinner size="xs" className="mr-1.5" />}
              {sprintf( __( 'Assign %s', 'codeclove-school-management' ), subjectLabelSingular )}
            </Button>
          </div>
        </div>

        {/* Assigned List */}
        <div>
          <p className="text-xs font-semibold text-text uppercase tracking-wider mb-2">{sprintf( __( 'Assigned %s', 'codeclove-school-management' ), subjectLabelPlural )}</p>
          <TableRoot>
            <Thead>
              <Tr>
                <Th>{subjectLabelSingular}</Th>
                <Th>{__( 'Code', 'codeclove-school-management' )}</Th>
                <Th>{sprintf( __( '%s Type', 'codeclove-school-management' ), subjectLabelSingular )}</Th>
                <Th>{__( 'Requirement', 'codeclove-school-management' )}</Th>
                <Th className="w-16" />
              </Tr>
            </Thead>
            <Tbody>
              {loadingMapped ? (
                <TableSkeleton columns={5} rows={3} />
              ) : mappedSubjects.length === 0 ? (
                <Tr>
                  <Td colSpan={5} className="text-center py-4 text-text-muted text-xs">
                    {sprintf( __( 'No %1$s mapped to this %2$s yet.', 'codeclove-school-management' ), subjectLabelPlural.toLowerCase(), unitLabelSingular.toLowerCase() )}
                  </Td>
                </Tr>
                ) : (
                  mappedSubjects.map((ms) => {
                    const typeVariants: Record<string, 'brand' | 'info' | 'default'> = {
                      core: 'brand',
                      elective: 'info',
                      activity: 'default',
                      other: 'default',
                    }
                    const sType = ms.subject_type || 'core'

                    return (
                      <Tr key={ms.id}>
                        <Td className="font-medium text-text">{ms.subject_name}</Td>
                        <Td className="text-text-muted font-mono text-xs">{ms.subject_code || '—'}</Td>
                        <Td>
                          <Badge variant={typeVariants[sType] || 'default'} size="sm">
                            {typeLabels[sType] || sType}
                          </Badge>
                        </Td>
                        <Td>
                          <Badge variant={ms.is_required ? 'success' : 'default'} size="sm">
                            {ms.is_required ? __( 'Required', 'codeclove-school-management' ) : __( 'Optional', 'codeclove-school-management' )}
                          </Badge>
                        </Td>
                        <Td className="text-right">
                          {pendingUnassignId === ms.subject_id ? (
                            // Inline confirm strip — avoids blocking confirm() dialog
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-text-muted mr-1">{__( 'Remove?', 'codeclove-school-management' )}</span>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleUnassign(ms.subject_id)}
                                disabled={isPending}
                              >
                                {__( 'Yes', 'codeclove-school-management' )}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setPendingUnassignId(null)}
                              >
                                {__( 'No', 'codeclove-school-management' )}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPendingUnassignId(ms.subject_id)}
                              disabled={isPending}
                            >
                              <Trash2 size={11} className="text-danger" />
                            </Button>
                          )}
                        </Td>
                      </Tr>
                    )
                  })
                )}
              </Tbody>
            </TableRoot>
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>{__( 'Close', 'codeclove-school-management' )}</Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
