/**
 * Groups Page — Sections & Homerooms CRUD.
 *
 * Displays a list of academic groups (e.g. Section A, Section B) scoped to the active session/unit.
 */
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { groupSchema, type GroupFormValues } from '@/schemas/academics'
import {
  Plus, Trash2, RefreshCw, GraduationCap, AlertTriangle, Pencil, Search, X
} from 'lucide-react'
import {
  useGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useUnits,
  type AcademicGroup,
  type CreateGroupPayload,
} from '@/api/academics'
import { useSession } from '@/lib/session-context'
import { useLabels } from '@/lib/labels'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { useEntity } from '@/lib/useEntity'
import { AcademicsNav } from './components/AcademicsNav'
import { TablePagination } from '@/components/ui/TablePagination'
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
import {
  Button, Badge, Card, CardContent,
  Modal, ModalFooter, FormField, Input, Select,
  TableRoot, Thead, Tbody, Tr, Th, Td, TableEmpty, TableSkeleton,
  PageHeader, Spinner, EmptyState, FormGroupHeader,
} from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'

export default function GroupsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const entity = useEntity('section')
  const groupLabelPlural = entity.plural
  const groupLabelSingular = entity.singular
  const { getLabel } = useLabels()
  const unitLabelSingular = getLabel('academic_unit', false, __( 'Academic Unit', 'codeclove-school-management' ))
  const unitLabelPlural = getLabel('academic_unit', true, __( 'Academic Units', 'codeclove-school-management' ))
  const sessionLabelSingular = getLabel('academic_session', false, __( 'Academic Session', 'codeclove-school-management' ))

  const { session } = useSession()
  const session_id = session?.id ?? 0

  const table = useTableState()
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<number>(0)
  const [status, setStatus] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const debouncedSearch = useDebounce(search, 350)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<AcademicGroup | null>(null)

  // Fetch units for dropdown filters and creation select
  const { data: unitsData } = useUnits({ session_id, per_page: 200 })
  const units = unitsData?.data ?? []

  // Fetch groups — filter by unit_id server-side so pagination works correctly.
  const { data, isLoading, isError, refetch } = useGroups({
    session_id,
    unit_id: selectedUnitFilter || undefined,
    status: status || undefined,
    search: debouncedSearch || undefined,
    ...table.params,
  })
  const deleteMutation = useDeleteGroup()

  const handleDelete = async (group: AcademicGroup) => {
    const isConfirmed = await confirm({
      title: sprintf( __( 'Delete %s', 'codeclove-school-management' ), groupLabelSingular ),
      message: sprintf(
        __( 'Are you sure you want to delete %s? This action cannot be undone if there are enrolled students.', 'codeclove-school-management' ),
        group.name
      ),
    })
    if (!isConfirmed) return

    deleteMutation.mutate(group.id, {
      onSuccess: () => {
        toast.success( sprintf( __( '%s deleted successfully!', 'codeclove-school-management' ), groupLabelSingular ) )
      },
      onError: (err: Error) => {
        toast.error(err.message || sprintf( __( 'Failed to delete %s.', 'codeclove-school-management' ), groupLabelSingular.toLowerCase() ))
      }
    })
  }

  const groups = data?.data ?? []
  const total  = data?.total ?? 0

  // Reset page & filters when session changes
  useEffect(() => {
    table.resetPage()
    setSelectedUnitFilter(0)
    setStatus('')
    setSearch('')
  }, [session_id, table.resetPage])

  // Reset to page 1 when filters change
  useEffect(() => {
    table.resetPage()
  }, [selectedUnitFilter, status, debouncedSearch, table.resetPage])

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={groupLabelPlural}
        breadcrumbs={[{ label: __( 'Academics', 'codeclove-school-management' ) }, { label: groupLabelPlural }]}
        description={sprintf(
          __( 'Manage the classroom %1$s, homerooms, or streams mapped under each %2$s.', 'codeclove-school-management' ),
          groupLabelPlural.toLowerCase(),
          unitLabelSingular.toLowerCase()
        )}
        actions={
          <Button
            onClick={() => setShowModal(true)}
            disabled={!session_id || units.length === 0}
            className="gap-1.5 font-semibold text-xs h-9"
          >
            <Plus size={14} />
            {sprintf( __( 'New %s', 'codeclove-school-management' ), groupLabelSingular )}
          </Button>
        }
      />

      <AcademicsNav />

      {/* Filters Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <FormField label={sprintf( __( 'Search %s', 'codeclove-school-management' ), groupLabelPlural )}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={sprintf( __( 'Search by %s name, code...', 'codeclove-school-management' ), groupLabelSingular.toLowerCase() )}
                  className="pl-9"
                />
              </div>
            </FormField>
          </div>
          <div className="w-full sm:w-40 lg:w-48 min-w-[140px]">
            <FormField label={unitLabelSingular}>
              <Select
                value={selectedUnitFilter.toString()}
                onValueChange={(v) => setSelectedUnitFilter(parseInt(v, 10) || 0)}
                options={[
                  { value: '0', label: sprintf( __( 'All %s', 'codeclove-school-management' ), unitLabelPlural ) },
                  ...units.map((u) => ({
                    value: u.id.toString(),
                    label: u.name,
                  })),
                ]}
              />
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
            {(search || selectedUnitFilter !== 0 || status) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch('')
                  setSelectedUnitFilter(0)
                  setStatus('')
                  table.resetPage()
                }}
              >
                <X size={12} />
                {__( 'Clear Filters', 'codeclove-school-management' )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Table Card */}
      <Card className="shadow-sm">
        <CardContent className="p-0 overflow-hidden">
          {isError ? (
            <div className="p-6">
              <EmptyState
                title={sprintf( __( 'Could not load %s', 'codeclove-school-management' ), groupLabelPlural.toLowerCase() )}
                description={sprintf( __( 'An error occurred while fetching %s from the backend REST API.', 'codeclove-school-management' ), groupLabelPlural.toLowerCase() )}
                icon={AlertTriangle}
                action={
                  <Button variant="secondary" size="sm" onClick={() => refetch()} className="gap-1.5">
                    <RefreshCw size={13} />
                    {__( 'Try again', 'codeclove-school-management' )}
                  </Button>
                }
              />
            </div>
          ) : (
            <TableRoot>
              <Thead>
                <Tr>
                  <Th type="primary" {...table.getSortProps('name')}>
                    {sprintf( __( '%s Name', 'codeclove-school-management' ), groupLabelSingular )}
                  </Th>
                  <Th type="code" {...table.getSortProps('code')}>
                    {__( 'Code', 'codeclove-school-management' )}
                  </Th>
                  <Th>{unitLabelSingular}</Th>
                  <Th type="number">{__( 'Capacity', 'codeclove-school-management' )}</Th>
                  <Th type="number" {...table.getSortProps('students_count')}>
                    {__( 'Active Students', 'codeclove-school-management' )}
                  </Th>
                  <Th type="badge" {...table.getSortProps('status')}>
                    {__( 'Status', 'codeclove-school-management' )}
                  </Th>
                  <Th type="actions">{__( 'Actions', 'codeclove-school-management' )}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {isLoading ? (
                  <TableSkeleton columns={7} rows={5} />
                ) : groups.length === 0 ? (
                  <TableEmpty
                    colSpan={7}
                    icon={entity.icon}
                    message={
                      search || selectedUnitFilter !== 0 || status
                        ? __( 'No Classes Match Filters', 'codeclove-school-management' )
                        : !session_id
                        ? __( 'Session Not Selected', 'codeclove-school-management' )
                        : units.length === 0
                        ? sprintf( __( 'No %s Found', 'codeclove-school-management' ), unitLabelPlural )
                        : sprintf( __( 'No %s Found', 'codeclove-school-management' ), groupLabelPlural )
                    }
                    description={
                      search || selectedUnitFilter !== 0 || status
                        ? __( 'Try adjusting your search query or status filter.', 'codeclove-school-management' )
                        : !session_id
                        ? sprintf( __( 'Select an active %1$s in the header to view %2$s.', 'codeclove-school-management' ), sessionLabelSingular.toLowerCase(), groupLabelPlural.toLowerCase() )
                        : units.length === 0
                        ? sprintf( __( 'You must create a %1$s first before you can map any %2$s (sections/streams).', 'codeclove-school-management' ), unitLabelSingular.toLowerCase(), groupLabelPlural.toLowerCase() )
                        : __( 'Get started by grouping students into classes and sections/streams.', 'codeclove-school-management' )
                    }
                    action={
                      !search && !selectedUnitFilter && !status && session_id && units.length > 0 && (
                        <Button size="sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                          {sprintf( __( 'New %s', 'codeclove-school-management' ), groupLabelSingular )}
                        </Button>
                      )
                    }
                  />
                ) : (
                  groups.map((group) => {
                    const parentUnit = units.find((u) => u.id === group.unit_id)
                    return (
                      <GroupRow
                        key={group.id}
                        group={group}
                        unitName={parentUnit?.name ?? __( 'Unknown Class', 'codeclove-school-management' )}
                        onEdit={() => {
                          setEditTarget(group)
                          setShowModal(true)
                        }}
                        onDelete={() => handleDelete(group)}
                      />
                    )
                  })
                )}
              </Tbody>
            </TableRoot>
          )}

          {/* Pagination */}
          {!isLoading && !isError && (
            <TablePagination
              {...table.paginationProps}
              total={total}
            />
          )}
        </CardContent>
      </Card>

      {/* Group Modal */}
      <GroupModal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setEditTarget(null)
        }}
        session_id={session_id}
        units={units}
        editTarget={editTarget}
        onSuccess={() => {
          setShowModal(false)
          setEditTarget(null)
        }}
      />
    </div>
  )
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function GroupRow({
  group,
  unitName,
  onEdit,
  onDelete,
}: {
  group: AcademicGroup
  unitName: string
  onEdit: () => void
  onDelete: () => void
}) {
  const { getLabel } = useLabels()
  const groupLabelSingular = getLabel('academic_group', false, __( 'Academic Group', 'codeclove-school-management' ))

  const statusLabel = group.status === 'active'
    ? __( 'Active', 'codeclove-school-management' )
    : group.status === 'inactive'
    ? __( 'Inactive', 'codeclove-school-management' )
    : __( 'Archived', 'codeclove-school-management' )

  return (
    <Tr className="table-row-hover">
      <Td type="primary">
        <span className="font-semibold text-text">{group.name}</span>
      </Td>
      <Td type="code">
        {group.code ? (
          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-bg-base border border-border text-text-muted">
            {group.code}
          </span>
        ) : (
          <span className="text-text-subtle">—</span>
        )}
      </Td>
      <Td>{unitName}</Td>
      <Td type="number" className="text-text-muted">{group.capacity ?? '—'}</Td>
      <Td type="number">
        {group.students_count}
      </Td>
      <Td type="badge">
        <Badge
          variant={
            group.status === 'active'
              ? 'success'
              : group.status === 'inactive'
              ? 'default'
              : 'brand'
          }
          size="sm"
          dot
        >
          {statusLabel}
        </Badge>
      </Td>
      <Td type="actions">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="h-8 w-8 text-text-muted hover:text-brand hover:bg-brand-dim/50"
            title={sprintf( __( 'Edit %s', 'codeclove-school-management' ), groupLabelSingular )}
          >
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 text-text-muted hover:text-danger hover:bg-danger-dim/50"
            title={sprintf( __( 'Delete %s', 'codeclove-school-management' ), groupLabelSingular )}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </Td>
    </Tr>
  )
}

// ─── Group Modal (Create Only) ──────────────────────────────────────────────

function GroupModal({
  open,
  onClose,
  session_id,
  units,
  editTarget,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  session_id: number
  units: Array<{ id: number; name: string }>
  editTarget: AcademicGroup | null
  onSuccess: () => void
}) {
  const toast = useToast()
  const { getLabel } = useLabels()
  const groupLabelSingular = getLabel('academic_group', false, __( 'Academic Group', 'codeclove-school-management' ))
  const unitLabelSingular = getLabel('academic_unit', false, __( 'Academic Unit', 'codeclove-school-management' ))

  const createMutation = useCreateGroup()
  const updateMutation = useUpdateGroup()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { unit_id: units[0]?.id || 0 },
  })

  useEffect(() => {
    if (open) {
      if (editTarget) {
        reset({
          unit_id:  editTarget.unit_id,
          name:     editTarget.name,
          code:     editTarget.code || '',
          capacity: editTarget.capacity || undefined,
          status:   editTarget.status || 'active',
        })
      } else {
        reset({
          unit_id:  units[0]?.id || 0,
          name:     '',
          code:     '',
          capacity: undefined,
          status:   'active',
        })
      }
    }
  }, [open, units, editTarget, reset])

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = (values: GroupFormValues) => {
    const payload = {
      unit_id:  values.unit_id,
      name:     values.name,
      code:     values.code || undefined,
      capacity: values.capacity || null,
      status:   values.status || 'active',
    }

    if (editTarget) {
      updateMutation.mutate(
        {
          id: editTarget.id,
          data: payload,
        },
        {
          onSuccess: () => {
            reset()
            onSuccess()
            toast.success(sprintf( __( '%s updated successfully!', 'codeclove-school-management' ), groupLabelSingular ))
          },
          onError: (err: Error) => {
            toast.error(err.message || sprintf( __( 'Failed to update %s.', 'codeclove-school-management' ), groupLabelSingular.toLowerCase() ))
          }
        }
      )
    } else {
      createMutation.mutate(
        {
          session_id,
          ...payload,
        } as CreateGroupPayload,
        {
          onSuccess: () => {
            reset()
            onSuccess()
            toast.success(sprintf( __( '%s created successfully!', 'codeclove-school-management' ), groupLabelSingular ))
          },
          onError: (err: Error) => {
            toast.error(err.message || sprintf( __( 'Failed to create %s.', 'codeclove-school-management' ), groupLabelSingular.toLowerCase() ))
          }
        }
      )
    }
  }

  const unitIdValue = watch('unit_id')
  const statusValue = watch('status')
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose()
      }}
      title={editTarget ? sprintf( __( 'Edit %s', 'codeclove-school-management' ), groupLabelSingular ) : sprintf( __( 'New %s / Homeroom', 'codeclove-school-management' ), groupLabelSingular )}
      description={
        editTarget
          ? sprintf( __( 'Update classroom %s details.', 'codeclove-school-management' ), groupLabelSingular.toLowerCase() )
          : sprintf( __( 'Create a %1$s or homeroom class under a specific %2$s.', 'codeclove-school-management' ), groupLabelSingular.toLowerCase(), unitLabelSingular.toLowerCase() )
      }
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormGroupHeader
          title={sprintf( __( '%s Details', 'codeclove-school-management' ), groupLabelSingular )}
          description={sprintf( __( 'Configure the %1$s name, code, capacity, and parent %2$s.', 'codeclove-school-management' ), groupLabelSingular.toLowerCase(), unitLabelSingular.toLowerCase() )}
          icon={GraduationCap}
        />
        <FormField label={sprintf( __( 'Parent %s', 'codeclove-school-management' ), unitLabelSingular )} error={errors.unit_id?.message} required>
          <Select
            value={unitIdValue ? unitIdValue.toString() : ''}
            onValueChange={(v) => setValue('unit_id', parseInt(v, 10) || 0)}
            options={units.map((u) => ({
              value: u.id.toString(),
              label: u.name,
            }))}
          />
        </FormField>

        <FormField label={sprintf( __( '%s Name', 'codeclove-school-management' ), groupLabelSingular )} error={errors.name?.message} required>
          <Input
            {...register('name')}
            placeholder={__( 'e.g. Section A', 'codeclove-school-management' )}
            error={!!errors.name}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={__( 'Short Code', 'codeclove-school-management' )} error={errors.code?.message}>
            <Input
              {...register('code')}
              placeholder={__( 'e.g. SEC-A', 'codeclove-school-management' )}
              error={!!errors.code}
            />
          </FormField>
          <FormField label={__( 'Capacity (Max Students)', 'codeclove-school-management' )} error={errors.capacity?.message}>
            <Input
              {...register('capacity')}
              type="number"
              placeholder={__( 'e.g. 30', 'codeclove-school-management' )}
              error={!!errors.capacity}
            />
          </FormField>
        </div>

        {editTarget && (
          <FormField label={__( 'Status', 'codeclove-school-management' )} error={errors.status?.message} required>
            <Select
              value={statusValue || 'active'}
              onValueChange={(v) => setValue('status', v as GroupFormValues['status'])}
              options={[
                { value: 'active', label: __( 'Active', 'codeclove-school-management' ) },
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
            {editTarget ? __( 'Save Changes', 'codeclove-school-management' ) : sprintf( __( 'Create %s', 'codeclove-school-management' ), groupLabelSingular )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
