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
import { onFormError } from '@/lib/form-errors'
import { useConfirm } from '@/lib/confirm'
import { useEntity } from '@/lib/useEntity'
import {
  DataTable,
  type DataTableColumn,
  Button, Badge, Card,
  Modal, ModalFooter, FormField, Input, Select, DatePicker,
  TableRoot, Thead, Tbody, Tr, Th, Td, TableSkeleton,
  PageHeader, Spinner, Alert,
} from '@/components/ui'
import { SESSION_STATUSES } from '@/lib/constants'
import { AcademicsNav } from './components/AcademicsNav'
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

  const { formatDate } = useFormatter()
  const statusConfig = useMemo(() => getStatusConfig(), [])

  const columns = useMemo<DataTableColumn<AcademicSession>[]>(
    () => [
      {
        key: 'name',
        header: __( 'Name', 'codeclove-school-management' ),
        type: 'primary',
        render: (session) => (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text">{session.name}</span>
            {session.is_current && (
              <Badge variant="success" size="sm" dot>
                {__( 'Current', 'codeclove-school-management' )}
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: 'start_date',
        header: __( 'Start Date', 'codeclove-school-management' ),
        type: 'date',
        render: (session) => formatDate(session.start_date),
      },
      {
        key: 'end_date',
        header: __( 'End Date', 'codeclove-school-management' ),
        type: 'date',
        render: (session) => formatDate(session.end_date),
      },
      {
        key: 'terms_count',
        header: __( 'Terms', 'codeclove-school-management' ),
        type: 'number',
        render: (session) => session.terms_count ?? 0,
      },
      {
        key: 'status',
        header: __( 'Status', 'codeclove-school-management' ),
        type: 'badge',
        render: (session) => {
          const cfg = statusConfig[session.status] ?? { label: session.status, variant: 'draft' }
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
        render: (session) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTermsTarget(session)}
              className="h-8 w-8 text-text-muted hover:text-brand hover:bg-brand-dim/50"
              title={sprintf( __( 'Manage %s', 'codeclove-school-management' ), termLabelPlural )}
            >
              <CalendarDays size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditTarget(session)
                setShowModal(true)
              }}
              className="h-8 w-8 text-text-muted hover:text-brand hover:bg-brand-dim/50"
              title={sprintf( __( 'Edit %s', 'codeclove-school-management' ), sessionLabelSingular )}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(session)}
              className="h-8 w-8 text-text-muted hover:text-danger hover:bg-danger-dim/50"
              title={sprintf( __( 'Delete %s', 'codeclove-school-management' ), sessionLabelSingular )}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [formatDate, statusConfig, termLabelPlural, sessionLabelSingular]
  )

  // Reset page and selection when filters change
  useEffect(() => {
    table.resetPage()
    table.clearSelection()
  }, [debouncedSearch, statusFilter, table.resetPage, table.clearSelection])

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

      <DataTable<AcademicSession>
        data={sessions}
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
                message: __( 'Could not load sessions', 'codeclove-school-management' ),
                description: __( "The server returned an error. This usually means the backend API isn't connected yet.", 'codeclove-school-management' ),
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
                  search || statusFilter
                    ? __( 'No Sessions Match Filters', 'codeclove-school-management' )
                    : sprintf( __( 'No %s Found', 'codeclove-school-management' ), sessionLabelPlural ),
                description:
                  search || statusFilter
                    ? __( 'Try adjusting your search query or status filter.', 'codeclove-school-management' )
                    : __( 'Create an academic session to manage academic terms, classes, enrollments, and billing.', 'codeclove-school-management' ),
                action:
                  !search && !statusFilter ? (
                    <Button size="sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                      {sprintf( __( 'New %s', 'codeclove-school-management' ), sessionLabelSingular )}
                    </Button>
                  ) : undefined,
              }
        }
        keyExtractor={(session) => session.id}
      />

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
      <form onSubmit={handleSubmit(onSubmit, onFormError)} className="space-y-4">
        {errorMsg && (
          <Alert variant="danger">{errorMsg}</Alert>
        )}
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

export function calculateTermSplits(startStr: string, endStr: string, count: number, label: string) {
  const start = new Date(startStr + 'T00:00:00')
  const end = new Date(endStr + 'T00:00:00')
  const totalDays = Math.round((end.getTime() - start.getTime()) / 864e5) + 1
  const daysPerTerm = Math.floor(totalDays / count)
  const prefix = count === 2 ? 'Semester' : count === 4 ? 'Quarter' : label
  const code = count === 2 ? 'S' : count === 4 ? 'Q' : 'T'

  // ponytail: en-CA locale formats natively as YYYY-MM-DD
  const toYMD = (d: Date) => d.toLocaleDateString('en-CA')

  return Array.from({ length: count }, (_, i) => {
    const s = new Date(start)
    s.setDate(s.getDate() + i * daysPerTerm)
    const e = i === count - 1 ? end : new Date(start)
    if (i !== count - 1) {
      e.setDate(e.getDate() + (i + 1) * daysPerTerm - 1)
    }
    const finalEnd = e > end ? end : e
    return {
      name: `${prefix} ${i + 1}`,
      code: `${code}${i + 1}`,
      start_date: toYMD(s),
      end_date: toYMD(finalEnd),
    }
  })
}

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
  const [isGenerating, setIsGenerating] = useState(false)

  const initialForm: { name: string; code: string; startDate: string; endDate: string; status: AcademicTerm['status'] } = {
    name: '', code: '', startDate: '', endDate: '', status: 'active'
  }
  const [form, setForm] = useState(initialForm)
  const [errorMsg, setErrorMsg] = useState('')

  const setField = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrorMsg('')
  }

  const startEdit = (term: AcademicTerm) => {
    setEditingId(term.id)
    setIsAdding(false)
    setForm({
      name: term.name,
      code: term.code || '',
      startDate: term.start_date,
      endDate: term.end_date,
      status: term.status,
    })
    setErrorMsg('')
  }

  const validateDates = () => {
    if (!form.name.trim()) return __( 'Name is required', 'codeclove-school-management' )
    if (!form.startDate || !form.endDate) return __( 'Dates are required', 'codeclove-school-management' )
    if (form.startDate >= form.endDate) return __( 'End date must be after start date', 'codeclove-school-management' )
    if (form.startDate < session.start_date || form.endDate > session.end_date) {
      return sprintf(
        __( 'Dates must fall within %1$s range: %2$s to %3$s', 'codeclove-school-management' ),
        sessionLabelSingular.toLowerCase(),
        formatDate(session.start_date),
        formatDate(session.end_date)
      )
    }
    return null
  }

  const handleSave = () => {
    const err = validateDates()
    if (err) { setErrorMsg(err); return }

    if (editingId) {
      updateMutation.mutate(
        {
          id: editingId,
          data: { name: form.name, code: form.code, start_date: form.startDate, end_date: form.endDate, status: form.status },
        },
        {
          onSuccess: () => {
            setEditingId(null)
            refetch()
            toast.success(sprintf( __( '%s updated successfully!', 'codeclove-school-management' ), termLabelSingular ))
          },
          onError: (error) => {
            setErrorMsg(error.message || sprintf( __( 'Failed to update %s', 'codeclove-school-management' ), termLabelSingular.toLowerCase() ))
          },
        }
      )
    }
  }

  const handleAdd = () => {
    const err = validateDates()
    if (err) { setErrorMsg(err); return }

    createMutation.mutate(
      {
        session_id: session.id,
        data: { name: form.name, code: form.code, start_date: form.startDate, end_date: form.endDate, status: form.status },
      },
      {
        onSuccess: () => {
          setIsAdding(false)
          setForm(initialForm)
          refetch()
          toast.success(sprintf( __( '%s created successfully!', 'codeclove-school-management' ), termLabelSingular ))
        },
        onError: (error) => {
          setErrorMsg(error.message || sprintf( __( 'Failed to create %s', 'codeclove-school-management' ), termLabelSingular.toLowerCase() ))
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
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : sprintf( __( 'Failed to delete %s.', 'codeclove-school-management' ), termLabelSingular.toLowerCase() )
        toast.error(msg)
      }
    })
  }

  const handleGeneratePresets = async (count: number) => {
    const splits = calculateTermSplits(session.start_date, session.end_date, count, termLabelSingular)
    setIsGenerating(true)
    try {
      for (const item of splits) {
        await createMutation.mutateAsync({
          session_id: session.id,
          data: { ...item, status: 'active' },
        })
      }
      refetch()
      toast.success(sprintf( __( '%d terms generated successfully!', 'codeclove-school-management' ), count ))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : __( 'Failed to generate terms', 'codeclove-school-management' )
      toast.error(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || isGenerating

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
        {/* Parent Session Boundary Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-bg-surface border border-border text-xs">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-brand shrink-0" />
            <span className="text-text-muted">{sessionLabelSingular} {__( 'Period:', 'codeclove-school-management' )}</span>
            <span className="font-semibold font-mono text-text">
              {formatDate(session.start_date)} &mdash; {formatDate(session.end_date)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-text-muted">
            <span>{__( 'Configured:', 'codeclove-school-management' )}</span>
            <Badge variant="outline" size="sm" className="font-mono">
              {terms.length} {terms.length === 1 ? termLabelSingular : termLabelPlural}
            </Badge>
          </div>
        </div>

        {errorMsg && (
          <Alert variant="danger">{errorMsg}</Alert>
        )}

        {/* Quick Partition Presets (shown when session has 0 terms and not currently adding) */}
        {terms.length === 0 && !isAdding && !editingId && (
          <div className="p-4 text-center rounded-xl border border-dashed border-border bg-bg-surface/50 space-y-2.5">
            <p className="text-xs text-text-muted">
              {__( 'Auto-partition dates into:', 'codeclove-school-management' )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {([
                [2, sprintf( __( '%d Semesters', 'codeclove-school-management' ), 2 )],
                [3, sprintf( __( '%d Terms', 'codeclove-school-management' ), 3 )],
                [4, sprintf( __( '%d Quarters', 'codeclove-school-management' ), 4 )],
              ] as const).map(([cnt, label]) => (
                <Button
                  key={cnt}
                  size="sm"
                  variant="secondary"
                  onClick={() => handleGeneratePresets(cnt)}
                  disabled={isPending}
                  className="text-xs h-7 px-3 font-medium"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Dedicated Form Card (Stacked layout for Add or Edit — eliminates horizontal table overflow) */}
        {(isAdding || editingId !== null) && (
          <div className="p-4 rounded-xl bg-bg-surface border border-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/80">
              <p className="text-xs font-semibold text-text uppercase tracking-wider">
                {editingId
                  ? sprintf( __( 'Edit %s', 'codeclove-school-management' ), termLabelSingular )
                  : sprintf( __( 'Add %s', 'codeclove-school-management' ), termLabelSingular )}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-text-muted hover:text-text"
                onClick={() => {
                  setIsAdding(false)
                  setEditingId(null)
                  setErrorMsg('')
                }}
                title={__( 'Cancel', 'codeclove-school-management' )}
              >
                <X size={14} />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label={sprintf( __( '%s Name', 'codeclove-school-management' ), termLabelSingular )} required>
                <Input
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder={__( 'e.g. Term 1, Semester 1', 'codeclove-school-management' )}
                />
              </FormField>

              <FormField label={__( 'Short Code', 'codeclove-school-management' )}>
                <Input
                  value={form.code}
                  onChange={(e) => setField('code', e.target.value)}
                  placeholder={__( 'e.g. T1, S1', 'codeclove-school-management' )}
                  className="font-mono text-sm"
                />
              </FormField>

              <FormField label={__( 'Start Date', 'codeclove-school-management' )} required>
                <DatePicker
                  value={form.startDate}
                  onChange={(v) => setField('startDate', v)}
                  minDate={new Date(session.start_date + 'T00:00:00')}
                  maxDate={new Date(session.end_date + 'T23:59:59')}
                />
              </FormField>

              <FormField label={__( 'End Date', 'codeclove-school-management' )} required>
                <DatePicker
                  value={form.endDate}
                  onChange={(v) => setField('endDate', v)}
                  minDate={new Date(session.start_date + 'T00:00:00')}
                  maxDate={new Date(session.end_date + 'T23:59:59')}
                />
              </FormField>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsAdding(false)
                  setEditingId(null)
                  setErrorMsg('')
                }}
              >
                {__( 'Cancel', 'codeclove-school-management' )}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={editingId ? handleSave : handleAdd}
                disabled={isPending}
              >
                {isPending && <Spinner size="xs" className="mr-1.5" />}
                {editingId
                  ? __( 'Save Changes', 'codeclove-school-management' )
                  : sprintf( __( 'Add %s', 'codeclove-school-management' ), termLabelSingular )}
              </Button>
            </div>
          </div>
        )}

        {/* Existing Terms List (Read-only table — zero horizontal overflow) */}
        <div>
          <TableRoot>
            <Thead>
              <Tr>
                <Th>{sprintf( __( '%s Name', 'codeclove-school-management' ), termLabelSingular )}</Th>
                <Th className="w-24 font-mono">{__( 'Code', 'codeclove-school-management' )}</Th>
                <Th className="w-32">{__( 'Start Date', 'codeclove-school-management' )}</Th>
                <Th className="w-32">{__( 'End Date', 'codeclove-school-management' )}</Th>
                <Th className="w-24 text-right">{__( 'Actions', 'codeclove-school-management' )}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <TableSkeleton columns={5} rows={3} />
              ) : terms.length === 0 ? (
                <Tr>
                  <Td colSpan={5} className="text-center py-5 text-text-muted text-xs">
                    {sprintf(
                      __( 'No %1$s in this %2$s yet.', 'codeclove-school-management' ),
                      termLabelPlural.toLowerCase(),
                      sessionLabelSingular.toLowerCase()
                    )}
                  </Td>
                </Tr>
              ) : (
                terms.map((term) => {
                  const isEditingThis = editingId === term.id
                  return (
                    <Tr
                      key={term.id}
                      className={isEditingThis ? 'bg-brand-dim/40 ring-1 ring-brand-ring/40' : undefined}
                    >
                      <Td className="font-medium text-text">{term.name}</Td>
                      <Td className="font-mono text-xs text-text-subtle">{term.code || '—'}</Td>
                      <Td className="font-mono text-xs text-text-muted">{formatDate(term.start_date)}</Td>
                      <Td className="font-mono text-xs text-text-muted">{formatDate(term.end_date)}</Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(term)}
                            disabled={isPending}
                            title={__( 'Edit', 'codeclove-school-management' )}
                          >
                            <Pencil size={12} className="text-text-muted hover:text-brand" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(term.id)}
                            disabled={isPending}
                            title={__( 'Delete', 'codeclove-school-management' )}
                          >
                            <Trash2 size={12} className="text-danger" />
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  )
                })
              )}
            </Tbody>
          </TableRoot>
        </div>

        {!isAdding && !editingId && (
          <div className="flex justify-start">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setIsAdding(true)
                setEditingId(null)
                setForm({ ...initialForm, startDate: session.start_date, endDate: session.end_date })
                setErrorMsg('')
              }}
              className="gap-1.5"
            >
              <Plus size={13} />
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
