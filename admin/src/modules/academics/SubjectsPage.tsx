/**
 * Subjects Page — Subjects CRUD.
 *
 * Displays a list of academic subjects (e.g. Mathematics, Science).
 */
import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { subjectSchema, type SubjectFormValues } from '@/schemas/academics'
import {
  Plus, Trash2, RefreshCw, AlertTriangle, Pencil, Search, X
} from 'lucide-react'
import {
  useSubjects,
  useCreateSubject,
  useUpdateSubject,
  useDeleteSubject,
  type Subject,
  type CreateSubjectPayload,
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
  PageHeader, Spinner,
} from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubjectsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const entity = useEntity('subject')
  const subjectLabelPlural = entity.plural
  const subjectLabelSingular = entity.singular
  const { getLabel } = useLabels()
  const sessionLabelSingular = getLabel('academic_session', false, __( 'Academic Session', 'codeclove-school-management' ))
  const unitLabelPlural = getLabel('academic_unit', true, __( 'Academic Units', 'codeclove-school-management' ))

  const { session } = useSession()
  const session_id = session?.id ?? 0

  const table = useTableState()
  const [status, setStatus] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const debouncedSearch = useDebounce(search, 350)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Subject | null>(null)

  const { data, isLoading, isError, refetch } = useSubjects({
    session_id,
    status: status || undefined,
    search: debouncedSearch || undefined,
    ...table.params,
  })
  const deleteMutation = useDeleteSubject()

  const handleDelete = async (subject: Subject) => {
    const isConfirmed = await confirm({
      title: sprintf( __( 'Delete %s', 'codeclove-school-management' ), subjectLabelSingular ),
      message: sprintf(
        __( 'Are you sure you want to delete %1$s? This action cannot be undone if it is mapped to %2$s.', 'codeclove-school-management' ),
        subject.name,
        unitLabelPlural.toLowerCase()
      ),
    })
    if (!isConfirmed) return

    deleteMutation.mutate(subject.id, {
      onSuccess: () => {
        toast.success( sprintf( __( '%s deleted successfully!', 'codeclove-school-management' ), subjectLabelSingular ) )
      },
      onError: (err: Error) => {
        toast.error(err.message || sprintf( __( 'Failed to delete %s.', 'codeclove-school-management' ), subjectLabelSingular.toLowerCase() ))
      }
    })
  }

  const subjects = data?.data ?? []
  const total    = data?.total ?? 0

  const typeLabels: Record<string, string> = useMemo(
    () => ({
      core: __( 'Core', 'codeclove-school-management' ),
      elective: __( 'Elective', 'codeclove-school-management' ),
      activity: __( 'Co-Curricular', 'codeclove-school-management' ),
      other: __( 'Other', 'codeclove-school-management' ),
    }),
    []
  )

  const typeVariants: Record<string, 'brand' | 'info' | 'default'> = {
    core: 'brand',
    elective: 'info',
    activity: 'default',
    other: 'default',
  }


  const columns = useMemo<DataTableColumn<Subject>[]>(
    () => [
      {
        key: 'name',
        header: sprintf( __( '%s Name', 'codeclove-school-management' ), subjectLabelSingular ),
        type: 'primary',
        sortable: true,
        render: (subject) => <span className="font-semibold text-text">{subject.name}</span>,
      },
      {
        key: 'code',
        header: __( 'Code', 'codeclove-school-management' ),
        type: 'code',
        sortable: true,
        render: (subject) =>
          subject.code ? (
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-bg-surface border border-border text-text-muted">
              {subject.code}
            </span>
          ) : (
            <span className="text-text-subtle">—</span>
          ),
      },
      {
        key: 'type',
        header: __( 'Type', 'codeclove-school-management' ),
        type: 'badge',
        render: (subject) => (
          <Badge variant={typeVariants[subject.type] ?? 'default'} size="sm">
            {typeLabels[subject.type] ?? subject.type}
          </Badge>
        ),
      },
      {
        key: 'units_count',
        header: sprintf( __( 'Mapped %s', 'codeclove-school-management' ), unitLabelPlural ),
        type: 'number',
        sortable: true,
        render: (subject) => subject.units_count,
      },
      {
        key: 'status',
        header: __( 'Status', 'codeclove-school-management' ),
        type: 'badge',
        sortable: true,
        render: (subject) => (
          <Badge variant={subject.status}>{subject.status}</Badge>
        ),
      },
      {
        key: 'actions',
        header: __( 'Actions', 'codeclove-school-management' ),
        type: 'actions',
        render: (subject) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditTarget(subject)
                setShowModal(true)
              }}
              className="h-8 w-8 text-text-muted hover:text-brand hover:bg-brand-dim/50"
              title={sprintf( __( 'Edit %s', 'codeclove-school-management' ), subjectLabelSingular )}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(subject)}
              className="h-8 w-8 text-text-muted hover:text-danger hover:bg-danger-dim/50"
              title={sprintf( __( 'Delete %s', 'codeclove-school-management' ), subjectLabelSingular )}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [subjectLabelSingular, unitLabelPlural, typeLabels]
  )

  // Reset page & filters when session changes
  useEffect(() => {
    table.resetPage()
    table.clearSelection()
    setStatus('')
    setSearch('')
  }, [session_id, table.resetPage, table.clearSelection])

  // Reset to page 1 when filters change
  useEffect(() => {
    table.resetPage()
    table.clearSelection()
  }, [status, debouncedSearch, table.resetPage, table.clearSelection])

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={subjectLabelPlural}
        breadcrumbs={[{ label: __( 'Academics', 'codeclove-school-management' ) }, { label: subjectLabelPlural }]}
        description={sprintf(
          __( 'Manage the global list of courses, %1$s, or modules taught across %2$s.', 'codeclove-school-management' ),
          subjectLabelPlural.toLowerCase(),
          unitLabelPlural.toLowerCase()
        )}
        actions={
          <Button
            onClick={() => setShowModal(true)}
            disabled={!session_id}
            className="gap-1.5 font-semibold text-xs h-9"
          >
            <Plus size={14} />
            {sprintf( __( 'New %s', 'codeclove-school-management' ), subjectLabelSingular )}
          </Button>
        }
      />

      <AcademicsNav />

      {/* Filters Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <FormField label={sprintf( __( 'Search %s', 'codeclove-school-management' ), subjectLabelPlural )}>
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
              >
                <X size={12} />
                {__( 'Clear Filters', 'codeclove-school-management' )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <DataTable<Subject>
        data={subjects}
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
                message: sprintf( __( 'Could not load %s', 'codeclove-school-management' ), subjectLabelPlural.toLowerCase() ),
                description: sprintf( __( 'An error occurred while fetching %s from the backend REST API.', 'codeclove-school-management' ), subjectLabelPlural.toLowerCase() ),
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
                    ? __( 'No Subjects Match Filters', 'codeclove-school-management' )
                    : !session_id
                    ? __( 'Session Not Selected', 'codeclove-school-management' )
                    : sprintf( __( 'No %s Found', 'codeclove-school-management' ), subjectLabelPlural ),
                description:
                  search || status
                    ? __( 'Try adjusting your search query or status filter.', 'codeclove-school-management' )
                    : !session_id
                    ? sprintf( __( 'Select an active %1$s in the header to view %2$s.', 'codeclove-school-management' ), sessionLabelSingular.toLowerCase(), subjectLabelPlural.toLowerCase() )
                    : sprintf( __( 'Get started by creating your first reusable school %s template.', 'codeclove-school-management' ), subjectLabelSingular.toLowerCase() ),
                action:
                  !search && !status && session_id ? (
                    <Button size="sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                      {sprintf( __( 'Add %s', 'codeclove-school-management' ), subjectLabelSingular )}
                    </Button>
                  ) : undefined,
              }
        }
        keyExtractor={(subject) => subject.id}
      />

      {/* Subject Modal */}
      <SubjectModal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setEditTarget(null)
        }}
        session_id={session_id}
        editTarget={editTarget}
        onSuccess={() => {
          setShowModal(false)
          setEditTarget(null)
        }}
      />
    </div>
  )
}


// ─── Subject Modal (Create Only) ────────────────────────────────────────────

function SubjectModal({
  open,
  onClose,
  session_id,
  editTarget,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  session_id: number
  editTarget: Subject | null
  onSuccess: () => void
}) {
  const toast = useToast()
  const { getLabel } = useLabels()
  const subjectLabelSingular = getLabel('subject', false, __( 'Subject', 'codeclove-school-management' ))

  const createMutation = useCreateSubject()
  const updateMutation = useUpdateSubject()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      name: '',
      code: '',
      type: 'core',
      status: 'active',
    },
  })

  useEffect(() => {
    if (open) {
      if (editTarget) {
        reset({
          name: editTarget.name,
          code: editTarget.code || '',
          type: editTarget.type || 'core',
          status: editTarget.status || 'active',
        })
      } else {
        reset({
          name: '',
          code: '',
          type: 'core',
          status: 'active',
        })
      }
    }
  }, [open, editTarget, reset])

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = (values: SubjectFormValues) => {
    const payload = {
      name: values.name,
      code: values.code || undefined,
      type: values.type,
      status: values.status || 'active',
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
            toast.success(sprintf( __( '%s updated successfully!', 'codeclove-school-management' ), subjectLabelSingular ))
          },
          onError: (err: Error) => {
            toast.error(err.message || sprintf( __( 'Failed to update %s.', 'codeclove-school-management' ), subjectLabelSingular.toLowerCase() ))
          }
        }
      )
    } else {
      createMutation.mutate(
        {
          session_id,
          ...payload,
        } as CreateSubjectPayload,
        {
          onSuccess: () => {
            reset()
            onSuccess()
            toast.success(sprintf( __( '%s created successfully!', 'codeclove-school-management' ), subjectLabelSingular ))
          },
          onError: (err: Error) => {
            toast.error(err.message || sprintf( __( 'Failed to create %s.', 'codeclove-school-management' ), subjectLabelSingular.toLowerCase() ))
          }
        }
      )
    }
  }

  const typeValue = watch('type')
  const statusValue = watch('status')
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose()
      }}
      title={editTarget ? sprintf( __( 'Edit %s', 'codeclove-school-management' ), subjectLabelSingular ) : sprintf( __( 'New %s', 'codeclove-school-management' ), subjectLabelSingular )}
      description={
        editTarget
          ? sprintf( __( 'Update %s details.', 'codeclove-school-management' ), subjectLabelSingular.toLowerCase() )
          : sprintf( __( 'Create a new course or %s.', 'codeclove-school-management' ), subjectLabelSingular.toLowerCase() )
      }
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit, onFormError)} className="space-y-4">
        <FormField label={sprintf( __( '%s Name', 'codeclove-school-management' ), subjectLabelSingular )} error={errors.name?.message} required>
          <Input
            {...register('name')}
            placeholder={__( 'e.g. Mathematics', 'codeclove-school-management' )}
            error={!!errors.name}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={__( 'Short Code', 'codeclove-school-management' )} error={errors.code?.message}>
            <Input
              {...register('code')}
              placeholder={__( 'e.g. MATH', 'codeclove-school-management' )}
              error={!!errors.code}
            />
          </FormField>

          <FormField label={sprintf( __( '%s Type', 'codeclove-school-management' ), subjectLabelSingular )} error={errors.type?.message} required>
            <Select
              value={typeValue}
              onValueChange={(v) => setValue('type', v as SubjectFormValues['type'])}
              options={[
                { value: 'core', label: __( 'Core / Required', 'codeclove-school-management' ) },
                { value: 'elective', label: __( 'Elective', 'codeclove-school-management' ) },
                { value: 'activity', label: __( 'Co-Curricular / Activity', 'codeclove-school-management' ) },
                { value: 'other', label: __( 'Other', 'codeclove-school-management' ) },
              ]}
            />
          </FormField>
        </div>


        {editTarget && (
          <FormField label={__( 'Status', 'codeclove-school-management' )} error={errors.status?.message} required>
            <Select
              value={statusValue || 'active'}
              onValueChange={(v) => setValue('status', v as SubjectFormValues['status'])}
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
            {editTarget ? __( 'Save Changes', 'codeclove-school-management' ) : sprintf( __( 'Create %s', 'codeclove-school-management' ), subjectLabelSingular )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
