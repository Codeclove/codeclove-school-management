/**
 * Sessions Page — Academic Sessions CRUD.
 *
 * Displays a list of academic sessions (e.g. 2026-2027) with their status,
 * date ranges, and term counts. Admins can create, edit, delete, or
 * manage terms within a session.
 */
import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sessionSchema, type SessionFormValues } from '@/schemas/academics'
import {
  Plus, CalendarDays, Pencil, Trash2, RefreshCw,
  AlertTriangle, Search, X
} from 'lucide-react'
import {
  useSessions,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
  useTerms,
  useCreateTerm,
  useUpdateTerm,
  useDeleteTerm,
  type AcademicSession,
  type CreateSessionPayload,
  type AcademicTerm,
} from '@/api/academics'
import { useLabels } from '@/lib/labels'
import { useFormatter } from '@/lib/formatter'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { useEntity } from '@/lib/useEntity'
import {
  Button, Badge, Card, CardContent,
  Modal, ModalFooter, FormField, Input, Select, DatePicker,
  TableRoot, Thead, Tbody, Tr, Th, Td, TableEmpty, TableSkeleton,
  PageHeader, Spinner, EmptyState, FormGroupHeader, Alert,
} from '@/components/ui'
import { SESSION_STATUSES } from '@/lib/constants'
import { AcademicsNav } from './components/AcademicsNav'
import { TablePagination } from '@/components/ui/TablePagination'
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
import { __, sprintf } from '@/lib/i18n'

// ─── Status config helper ───────────────────────────────────────────────────

function getStatusConfig(): Record<
  AcademicSession['status'],
  { label: string; variant: any }
> {
  return {
    active:   { label: __( 'Active', 'codeclove-school-management' ),   variant: 'active' },
    draft:    { label: __( 'Draft', 'codeclove-school-management' ),    variant: 'draft' },
    archived: { label: __( 'Archived', 'codeclove-school-management' ), variant: 'archived' },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const entity = useEntity('session')
  const sessionLabelPlural = entity.plural
  const sessionLabelSingular = entity.singular
  const { getLabel } = useLabels()
  const termLabelPlural = getLabel('academic_term', true, __( 'Academic Terms', 'codeclove-school-management' ))

  const table = useTableState()
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<AcademicSession | null>(null)
  const [termsTarget, setTermsTarget] = useState<AcademicSession | null>(null)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [statusFilter, setStatusFilter] = useState('')

  // Reset page when filters change
  useEffect(() => {
    table.resetPage()
  }, [debouncedSearch, statusFilter, table.resetPage])

  const { data, isLoading, isError, refetch } = useSessions({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    ...table.params,
  })
  const deleteMutation = useDeleteSession()

  const handleDelete = async (sessionItem: AcademicSession) => {
    const isConfirmed = await confirm({
      title: sprintf( __( 'Delete %s', 'codeclove-school-management' ), sessionLabelSingular ),
      message: sprintf(
        __( 'Are you sure you want to delete %s? This action uses soft delete and can be recovered from the database.', 'codeclove-school-management' ),
        sessionItem.name
      ),
    })
    if (!isConfirmed) return

    deleteMutation.mutate(sessionItem.id, {
      onSuccess: () => {
        toast.success( sprintf( __( '%s deleted successfully!', 'codeclove-school-management' ), sessionLabelSingular ) )
      },
      onError: (err) => {
        toast.error(err.message || sprintf( __( 'Failed to delete %s.', 'codeclove-school-management' ), sessionLabelSingular.toLowerCase() ))
      }
    })
  }

  const sessions = data?.data ?? []
  const total    = data?.total ?? 0

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={sessionLabelPlural}
        breadcrumbs={[{ label: __( 'Academics', 'codeclove-school-management' ) }, { label: sessionLabelPlural }]}
        description={sprintf(
          __( 'Manage %1$s and their %2$s. Each %3$s scopes classes, attendance, and finance records.', 'codeclove-school-management' ),
          sessionLabelPlural.toLowerCase(),
          termLabelPlural.toLowerCase(),
          sessionLabelSingular.toLowerCase()
        )}
        actions={
          <Button onClick={() => { setEditTarget(null); setShowModal(true); }} className="gap-1.5 font-semibold text-xs h-9">
            <Plus size={14} />
            {sprintf( __( 'New %s', 'codeclove-school-management' ), sessionLabelSingular )}
          </Button>
        }
      />

      <AcademicsNav />

      {/* Filters Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <FormField label={sprintf( __( 'Search %s', 'codeclove-school-management' ), sessionLabelPlural )}>
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
                value={statusFilter}
                onValueChange={setStatusFilter}
                placeholder={__( 'All statuses', 'codeclove-school-management' )}
                options={[
                  { value: '', label: __( 'All statuses', 'codeclove-school-management' ) },
                  { value: 'draft', label: __( 'Draft', 'codeclove-school-management' ) },
                  { value: 'active', label: __( 'Active', 'codeclove-school-management' ) },
                  { value: 'archived', label: __( 'Archived', 'codeclove-school-management' ) },
                ]}
              />
            </FormField>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 h-9">
            {(statusFilter || search) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStatusFilter('')
                  setSearch('')
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
                title={__( 'Could not load sessions', 'codeclove-school-management' )}
                description={__( "The server returned an error. This usually means the backend API isn't connected yet.", 'codeclove-school-management' )}
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
                  <Th type="primary">{__( 'Name', 'codeclove-school-management' )}</Th>
                  <Th type="date">{__( 'Start Date', 'codeclove-school-management' )}</Th>
                  <Th type="date">{__( 'End Date', 'codeclove-school-management' )}</Th>
                  <Th type="number">{__( 'Terms', 'codeclove-school-management' )}</Th>
                  <Th type="badge">{__( 'Status', 'codeclove-school-management' )}</Th>
                  <Th type="actions">{__( 'Actions', 'codeclove-school-management' )}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {isLoading ? (
                  <TableSkeleton columns={6} rows={5} />
                ) : sessions.length === 0 ? (
                  <TableEmpty
                    colSpan={6}
                    icon={entity.icon}
                    message={
                      search || statusFilter
                        ? __( 'No Sessions Match Filters', 'codeclove-school-management' )
                        : sprintf( __( 'No %s Found', 'codeclove-school-management' ), sessionLabelPlural )
                    }
                    description={
                      search || statusFilter
                        ? __( 'Try adjusting your search query or status filter.', 'codeclove-school-management' )
                        : __( 'Create an academic session to manage academic terms, classes, enrollments, and billing.', 'codeclove-school-management' )
                    }
                    action={
                      !search && !statusFilter && (
                        <Button size="sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                          {sprintf( __( 'New %s', 'codeclove-school-management' ), sessionLabelSingular )}
                        </Button>
                      )
                    }
                  />
                ) : (
                  sessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      onEdit={() => {
                        setEditTarget(session)
                        setShowModal(true)
                      }}
                      onDelete={() => handleDelete(session)}
                      onManageTerms={() => setTermsTarget(session)}
                    />
                  ))
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

      {/* Session Modal (Create & Edit) */}
      <SessionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        session={editTarget}
        onSuccess={() => setShowModal(false)}
      />

      {termsTarget && (
        <ManageTermsModal
          session={termsTarget}
          onClose={() => setTermsTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function SessionRow({
  session,
  onEdit,
  onDelete,
  onManageTerms,
}: {
  session: AcademicSession
  onEdit: () => void
  onDelete: () => void
  onManageTerms: () => void
}) {
  const { formatDate } = useFormatter()
  const { getLabel } = useLabels()
  const sessionLabelSingular = getLabel('academic_session', false, __( 'Academic Session', 'codeclove-school-management' ))
  const termLabelPlural = getLabel('academic_term', true, __( 'Academic Terms', 'codeclove-school-management' ))

  const cfg = useMemo(() => getStatusConfig()[session.status] ?? { label: session.status, variant: 'draft' }, [session.status])

  return (
    <Tr className="table-row-hover">
      <Td type="primary">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text">{session.name}</span>
          {session.is_current && (
            <Badge variant="success" size="sm" dot>{__( 'Current', 'codeclove-school-management' )}</Badge>
          )}
        </div>
      </Td>
      <Td type="date">{formatDate(session.start_date)}</Td>
      <Td type="date">{formatDate(session.end_date)}</Td>
      <Td type="number">
        {session.terms_count ?? 0}
      </Td>
      <Td type="badge">
        <Badge variant={cfg.variant} size="sm" dot>
          {cfg.label}
        </Badge>
      </Td>
      <Td type="actions">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onManageTerms}
            className="h-8 w-8 text-text-muted hover:text-brand hover:bg-brand-dim/50"
            title={sprintf( __( 'Manage %s', 'codeclove-school-management' ), termLabelPlural )}
          >
            <CalendarDays size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="h-8 w-8 text-text-muted hover:text-brand hover:bg-brand-dim/50"
            title={sprintf( __( 'Edit %s', 'codeclove-school-management' ), sessionLabelSingular )}
          >
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 text-text-muted hover:text-danger hover:bg-danger-dim/50"
            title={sprintf( __( 'Delete %s', 'codeclove-school-management' ), sessionLabelSingular )}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </Td>
    </Tr>
  )
}

// ─── Session Modal (Create & Edit) ───────────────────────────────────────────

function SessionModal({
  open,
  onClose,
  session,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  session: AcademicSession | null
  onSuccess: () => void
}) {
  const toast = useToast()
  const { getLabel } = useLabels()
  const sessionLabelSingular = getLabel('academic_session', false, __( 'Academic Session', 'codeclove-school-management' ))

  const createMutation = useCreateSession()
  const updateMutation = useUpdateSession()
  const [errorMsg, setErrorMsg] = useState('')

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: { status: 'draft' },
  })

  useEffect(() => {
    if (open) {
      setErrorMsg('')
      if (session) {
        reset({
          name:       session.name,
          start_date: session.start_date,
          end_date:   session.end_date,
          status:     session.status,
        })
      } else {
        reset({
          name:       '',
          start_date: '',
          end_date:   '',
          status:     'draft',
        })
      }
    }
  }, [session, open, reset])

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = (values: SessionFormValues) => {
    setErrorMsg('')
    if (session) {
      updateMutation.mutate(
        { id: session.id, data: values },
        {
          onSuccess: () => {
            reset()
            onSuccess()
            toast.success(sprintf( __( '%s updated successfully!', 'codeclove-school-management' ), sessionLabelSingular ))
          },
          onError: (err: any) => {
            setErrorMsg(err.message || sprintf( __( 'Failed to update %s.', 'codeclove-school-management' ), sessionLabelSingular.toLowerCase() ))
          }
        }
      )
    } else {
      createMutation.mutate(values as CreateSessionPayload, {
        onSuccess: () => {
          reset()
          onSuccess()
          toast.success(sprintf( __( '%s created successfully!', 'codeclove-school-management' ), sessionLabelSingular ))
        },
        onError: (err: any) => {
          setErrorMsg(err.message || sprintf( __( 'Failed to create %s.', 'codeclove-school-management' ), sessionLabelSingular.toLowerCase() ))
        }
      })
    }
  }

  const isPending  = createMutation.isPending || updateMutation.isPending
  const statusValue = watch('status')
  const statusConfig = useMemo(() => getStatusConfig(), [])

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) handleClose() }}
      title={session ? sprintf( __( 'Edit %s', 'codeclove-school-management' ), sessionLabelSingular ) : sprintf( __( 'New %s', 'codeclove-school-management' ), sessionLabelSingular )}
      description={
        session
          ? sprintf( __( 'Edit %s details.', 'codeclove-school-management' ), sessionLabelSingular.toLowerCase() )
          : sprintf( __( 'Create a new %s. You can add terms after creation.', 'codeclove-school-management' ), sessionLabelSingular.toLowerCase() )
      }
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errorMsg && (
          <Alert variant="danger">{errorMsg}</Alert>
        )}
        <FormGroupHeader
          title={sprintf( __( '%s Details', 'codeclove-school-management' ), sessionLabelSingular )}
          description={sprintf( __( 'Define the name, date range, and status for this %s.', 'codeclove-school-management' ), sessionLabelSingular.toLowerCase() )}
          icon={CalendarDays}
        />
        <FormField label={sprintf( __( '%s Name', 'codeclove-school-management' ), sessionLabelSingular )} error={errors.name?.message} required>
          <Input
            {...register('name')}
            placeholder={__( 'e.g. 2026–2027', 'codeclove-school-management' )}
            error={!!errors.name}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={__( 'Start Date', 'codeclove-school-management' )} error={errors.start_date?.message} required>
            <Controller
              name="start_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  error={!!errors.start_date}
                  disabled={isPending}
                />
              )}
            />
          </FormField>
          <FormField label={__( 'End Date', 'codeclove-school-management' )} error={errors.end_date?.message} required>
            <Controller
              name="end_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  error={!!errors.end_date}
                  disabled={isPending}
                />
              )}
            />
          </FormField>
        </div>

        <FormField label={__( 'Status', 'codeclove-school-management' )} error={errors.status?.message} required>
          <Select
            value={statusValue}
            onValueChange={(v) => setValue('status', v as SessionFormValues['status'])}
            options={SESSION_STATUSES.map((s) => ({
              value: s,
              label: statusConfig[s]?.label ?? s,
            }))}
          />
        </FormField>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            {__( 'Cancel', 'codeclove-school-management' )}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Spinner size="xs" className="mr-1.5" />}
            {session ? __( 'Save Changes', 'codeclove-school-management' ) : sprintf( __( 'Create %s', 'codeclove-school-management' ), sessionLabelSingular )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

// ─── Manage Terms Modal ──────────────────────────────────────────────────────

function ManageTermsModal({
  session,
  onClose,
}: {
  session: AcademicSession
  onClose: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const { formatDate } = useFormatter()
  const { getLabel } = useLabels()
  const sessionLabelSingular = getLabel('academic_session', false, __( 'Academic Session', 'codeclove-school-management' ))
  const termLabelPlural = getLabel('academic_term', true, __( 'Academic Terms', 'codeclove-school-management' ))
  const termLabelSingular = getLabel('academic_term', false, __( 'Academic Term', 'codeclove-school-management' ))

  const { data: terms = [], isLoading, refetch } = useTerms(session.id)
  const createMutation = useCreateTerm()
  const updateMutation = useUpdateTerm()
  const deleteMutation = useDeleteTerm()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  // Form states for inline editing/adding
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'archived'>('active')
  const [errorMsg, setErrorMsg] = useState('')

  const startEdit = (term: AcademicTerm) => {
    setEditingId(term.id)
    setIsAdding(false)
    setName(term.name)
    setCode(term.code || '')
    setStartDate(term.start_date)
    setEndDate(term.end_date)
    setStatus(term.status)
    setErrorMsg('')
  }

  const handleSave = () => {
    if (!name.trim()) {
      setErrorMsg(__( 'Name is required', 'codeclove-school-management' ))
      return
    }
    if (!startDate || !endDate) {
      setErrorMsg(__( 'Dates are required', 'codeclove-school-management' ))
      return
    }
    if (startDate >= endDate) {
      setErrorMsg(__( 'End date must be after start date', 'codeclove-school-management' ))
      return
    }
    // Must fall within session dates
    if (startDate < session.start_date || endDate > session.end_date) {
      setErrorMsg(
        sprintf(
          __( 'Dates must fall within %1$s range: %2$s to %3$s', 'codeclove-school-management' ),
          sessionLabelSingular.toLowerCase(),
          formatDate(session.start_date),
          formatDate(session.end_date)
        )
      )
      return
    }

    if (editingId) {
      updateMutation.mutate(
        {
          id: editingId,
          data: { name, code, start_date: startDate, end_date: endDate, status },
        },
        {
          onSuccess: () => {
            setEditingId(null)
            refetch()
            toast.success(sprintf( __( '%s updated successfully!', 'codeclove-school-management' ), termLabelSingular ))
          },
          onError: (err) => {
            setErrorMsg(err.message || sprintf( __( 'Failed to update %s', 'codeclove-school-management' ), termLabelSingular.toLowerCase() ))
          },
        }
      )
    }
  }

  const handleAdd = () => {
    if (!name.trim()) {
      setErrorMsg(__( 'Name is required', 'codeclove-school-management' ))
      return
    }
    if (!startDate || !endDate) {
      setErrorMsg(__( 'Dates are required', 'codeclove-school-management' ))
      return
    }
    if (startDate >= endDate) {
      setErrorMsg(__( 'End date must be after start date', 'codeclove-school-management' ))
      return
    }
    // Must fall within session dates
    if (startDate < session.start_date || endDate > session.end_date) {
      setErrorMsg(
        sprintf(
          __( 'Dates must fall within %1$s range: %2$s to %3$s', 'codeclove-school-management' ),
          sessionLabelSingular.toLowerCase(),
          formatDate(session.start_date),
          formatDate(session.end_date)
        )
      )
      return
    }

    createMutation.mutate(
      {
        session_id: session.id,
        data: { name, code, start_date: startDate, end_date: endDate, status },
      },
      {
        onSuccess: () => {
          setIsAdding(false)
          setName('')
          setCode('')
          setStartDate('')
          setEndDate('')
          refetch()
          toast.success(sprintf( __( '%s created successfully!', 'codeclove-school-management' ), termLabelSingular ))
        },
        onError: (err) => {
          setErrorMsg(err.message || sprintf( __( 'Failed to create %s', 'codeclove-school-management' ), termLabelSingular.toLowerCase() ))
        },
      }
    )
  }

  const handleDelete = async (id: number) => {
    const isConfirmed = await confirm({
      title: sprintf( __( 'Delete %s', 'codeclove-school-management' ), termLabelSingular ),
      message: sprintf( __( 'Are you sure you want to delete this %s?', 'codeclove-school-management' ), termLabelSingular.toLowerCase() ),
    })
    if (!isConfirmed) return

    deleteMutation.mutate(id, {
      onSuccess: () => {
        refetch()
        toast.success(sprintf( __( '%s deleted successfully!', 'codeclove-school-management' ), termLabelSingular ))
      },
      onError: (err: any) => {
        toast.error(err.message || sprintf( __( 'Failed to delete %s.', 'codeclove-school-management' ), termLabelSingular.toLowerCase() ))
      }
    })
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  return (
    <Modal
      open={true}
      onOpenChange={(open) => { if (!open) onClose() }}
      title={sprintf( __( '%1$s in %2$s', 'codeclove-school-management' ), termLabelPlural, session.name )}
      description={sprintf(
        __( 'Manage the quarters/semesters for this %1$s. %2$s define grading and fee schedule intervals.', 'codeclove-school-management' ),
        sessionLabelSingular.toLowerCase(),
        termLabelPlural
      )}
      size="lg"
    >
      <div className="space-y-4">
        {errorMsg && (
          <Alert variant="danger">{errorMsg}</Alert>
        )}

        <TableRoot>
          <Thead>
            <Tr>
              <Th type="primary">{__( 'Name', 'codeclove-school-management' )}</Th>
              <Th type="code">{__( 'Code', 'codeclove-school-management' )}</Th>
              <Th type="date">{__( 'Start Date', 'codeclove-school-management' )}</Th>
              <Th type="date">{__( 'End Date', 'codeclove-school-management' )}</Th>
              <Th type="actions" />
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              <TableSkeleton columns={5} rows={3} />
            ) : (
              <>
                {terms.length === 0 && !isAdding && (
                  <Tr>
                    <Td colSpan={5} className="text-center py-4 text-text-muted text-sm">
                      {sprintf(
                        __( 'No %1$s in this %2$s. Click "Add %3$s" to create one.', 'codeclove-school-management' ),
                        termLabelPlural.toLowerCase(),
                        sessionLabelSingular.toLowerCase(),
                        termLabelSingular
                      )}
                    </Td>
                  </Tr>
                )}

              {terms.map((term) => {
                const isEditing = editingId === term.id
                if (isEditing) {
                  return (
                    <Tr key={term.id} className="bg-brand-dim/10">
                      <Td className="p-1">
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={__( 'e.g. Quarter 1', 'codeclove-school-management' )} />
                      </Td>
                      <Td className="p-1">
                        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={__( 'e.g. Q1', 'codeclove-school-management' )} />
                      </Td>
                      <Td className="p-1">
                        <DatePicker value={startDate} onChange={setStartDate} />
                      </Td>
                      <Td className="p-1">
                        <DatePicker value={endDate} onChange={setEndDate} />
                      </Td>
                      <Td className="p-1">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={handleSave} disabled={isPending}>{__( 'Save', 'codeclove-school-management' )}</Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>{__( 'Cancel', 'codeclove-school-management' )}</Button>
                        </div>
                      </Td>
                    </Tr>
                  )
                }

                return (
                  <Tr key={term.id}>
                    <Td type="primary">{term.name}</Td>
                    <Td type="code">{term.code || '—'}</Td>
                    <Td type="date">{formatDate(term.start_date)}</Td>
                    <Td type="date">{formatDate(term.end_date)}</Td>
                    <Td type="actions">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" onClick={() => startEdit(term)}>{__( 'Edit', 'codeclove-school-management' )}</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(term.id)} disabled={isPending}>
                          <Trash2 size={11} className="text-danger" />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                )
              })}

              {isAdding && (
                <Tr className="bg-brand-dim/10">
                  <Td className="p-1">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={__( 'e.g. Quarter 1', 'codeclove-school-management' )} />
                  </Td>
                  <Td className="p-1">
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={__( 'e.g. Q1', 'codeclove-school-management' )} />
                  </Td>
                  <Td className="p-1">
                    <DatePicker value={startDate} onChange={setStartDate} />
                  </Td>
                  <Td className="p-1">
                    <DatePicker value={endDate} onChange={setEndDate} />
                  </Td>
                  <Td className="p-1">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" onClick={handleAdd} disabled={isPending}>{__( 'Add', 'codeclove-school-management' )}</Button>
                      <Button size="sm" variant="secondary" onClick={() => setIsAdding(false)}>{__( 'Cancel', 'codeclove-school-management' )}</Button>
                    </div>
                  </Td>
                </Tr>
              )}
            </>
          )}
        </Tbody>
      </TableRoot>

        {!isAdding && !editingId && (
          <div className="flex justify-start">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setIsAdding(true)
                setName('')
                setCode('')
                setStartDate('')
                setEndDate('')
                setErrorMsg('')
              }}
              className="gap-1"
            >
              <Plus size={12} />
              {sprintf( __( 'Add %s', 'codeclove-school-management' ), termLabelSingular )}
            </Button>
          </div>
        )}

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>{__( 'Close', 'codeclove-school-management' )}</Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
