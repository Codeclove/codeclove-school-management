/**
 * NoticeboardPage — Manage school announcements, notices, and portal updates.
 *
 * Implements full CRUD:
 *  - Browse announcements with search and audience/type filters
 *  - Create broad broadcasts (Portal, Staff, All) or targeted class notices
 *  - Edit existing announcements
 *  - Delete announcements with confirmation
 *
 * Strictly adheres to codeclove-ui-ux standards:
 *  - Left-aligned text, center-aligned badges, right-aligned actions
 *  - 4 required async states (Loading skeleton, Empty, Error, Populated)
 *  - Full form accessibility with visible labels and required indicators
 */

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Megaphone, Plus, Edit2, Trash2,
  AlertCircle, ExternalLink,
} from 'lucide-react'
import {
  DataTable,
  type DataTableColumn,
  FilterBar,
  Button, Badge,
  Modal, ModalFooter, FormField, Input, Textarea, Select,
  PageHeader, Spinner,
} from '@/components/ui'
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
import { useConfirm } from '@/lib/confirm'
import { useToast } from '@/lib/toast'
import { useFormatter } from '@/lib/formatter'
import { __, sprintf } from '@/lib/i18n'
import {
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  type AnnouncementItem,
} from '@/api/notifications'

export type NoticeboardItem = AnnouncementItem

// ─── Constants & Badge Helpers ───────────────────────────────────────────────

const EVENT_TYPE_BADGES: Record<string, 'danger' | 'info' | 'success' | 'warning' | 'default'> = {
  urgent: 'danger',
  event: 'info',
  holiday: 'success',
  notice: 'warning',
}

const AUDIENCE_BADGES: Record<string, 'active' | 'warning' | 'default'> = {
  portal: 'active',
  staff: 'warning',
}

interface FormState {
  title: string
  content: string
  audience: 'portal' | 'staff' | 'all'
  eventType: string
  url: string
}

const initialForm: FormState = {
  title: '',
  content: '',
  audience: 'portal',
  eventType: 'announcement',
  url: '',
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function NoticeboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const confirm = useConfirm()
  const toast = useToast()
  const { formatDate } = useFormatter()

  const formAudiences = useMemo(() => [
    { value: 'portal', label: __('Students & Guardians (Portal)', 'codeclove-school-management') },
    { value: 'staff',  label: __('Staff & Faculty', 'codeclove-school-management') },
    { value: 'all',    label: __('Everyone (Portal + Staff)', 'codeclove-school-management') },
  ], [])

  const audienceFilterOptions = useMemo(() => [
    { value: 'all',    label: __('All Audiences', 'codeclove-school-management') },
    { value: 'portal', label: __('Students & Guardians (Portal)', 'codeclove-school-management') },
    { value: 'staff',  label: __('Staff & Faculty', 'codeclove-school-management') },
  ], [])

  const eventTypes = useMemo(() => [
    { value: 'announcement', label: __('Announcement', 'codeclove-school-management') },
    { value: 'notice',       label: __('General Notice', 'codeclove-school-management') },
    { value: 'urgent',       label: __('Urgent Alert', 'codeclove-school-management') },
    { value: 'event',        label: __('School Event', 'codeclove-school-management') },
    { value: 'holiday',      label: __('Holiday Notice', 'codeclove-school-management') },
    { value: 'circular',     label: __('Circular', 'codeclove-school-management') },
  ], [])

  // Table & Filters
  const table = useTableState({ defaultPerPage: 20 })
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [audienceFilter, setAudienceFilter] = useState('all')
  const [eventTypeFilter, setEventTypeFilter] = useState('all')

  // Query announcements
  const { data, isLoading, isError, refetch } = useAnnouncements({
    page: table.page,
    per_page: table.params.per_page,
    search: debouncedSearch || undefined,
    audience: audienceFilter !== 'all' ? audienceFilter : undefined,
    event_type: eventTypeFilter !== 'all' ? eventTypeFilter : undefined,
  })

  // Mutations
  const createMutation = useCreateAnnouncement()
  const updateMutation = useUpdateAnnouncement()
  const deleteMutation = useDeleteAnnouncement()

  // Modal & Form state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AnnouncementItem | null>(null)
  const [form, setForm] = useState<FormState>(initialForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Automatically trigger create modal if query param ?create=true
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      handleOpenCreate()
      searchParams.delete('create')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Reset page and selection when filters change
  useEffect(() => {
    table.resetPage()
    table.clearSelection()
  }, [debouncedSearch, audienceFilter, eventTypeFilter, table.resetPage, table.clearSelection])

  const columns = useMemo<DataTableColumn<NoticeboardItem>[]>(
    () => [
      {
        key: 'title',
        header: __('Notice', 'codeclove-school-management'),
        type: 'primary',
        render: (item) => (
          <div className="space-y-1 py-1">
            <div className="font-semibold text-text text-sm flex items-center gap-1.5">
              <span>{item.title}</span>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-subtle hover:text-brand transition-colors"
                  title={item.url}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3.5 h-3.5 inline" />
                </a>
              )}
            </div>
            <p className="text-xs text-text-muted line-clamp-2 leading-relaxed font-normal">
              {item.content}
            </p>
          </div>
        ),
      },
      {
        key: 'audience',
        header: __('Audience', 'codeclove-school-management'),
        type: 'badge',
        render: (item) => (
          <Badge variant={AUDIENCE_BADGES[item.audience.toLowerCase()] ?? 'default'} size="sm" className="capitalize">
            {item.audience}
          </Badge>
        ),
      },
      {
        key: 'event_type',
        header: __('Category', 'codeclove-school-management'),
        type: 'badge',
        render: (item) => (
          <Badge variant={EVENT_TYPE_BADGES[item.event_type.toLowerCase()] ?? 'default'} size="sm" className="capitalize">
            {item.event_type.replace(/[._]/g, ' ')}
          </Badge>
        ),
      },
      {
        key: 'created_at',
        header: __('Date Posted', 'codeclove-school-management'),
        type: 'date',
        render: (item) => formatDate(item.created_at),
      },
      {
        key: 'actions',
        header: __('Actions', 'codeclove-school-management'),
        type: 'actions',
        render: (item) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit(item)}
              className="h-8 w-8 p-0 text-text-subtle hover:text-brand"
              title={__('Edit Announcement', 'codeclove-school-management')}
            >
              <Edit2 size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(item)}
              className="h-8 w-8 p-0 text-text-subtle hover:text-danger"
              title={__('Delete Announcement', 'codeclove-school-management')}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [formatDate]
  )

  const announcements = data?.items ?? []
  const total = data?.total ?? 0

  // Handlers
  const handleOpenCreate = () => {
    setEditingItem(null)
    setForm(initialForm)
    setFormErrors({})
    setModalOpen(true)
  }

  const handleOpenEdit = (item: AnnouncementItem) => {
    setEditingItem(item)
    setForm({
      title: item.title,
      content: item.content,
      audience: (item.audience === 'portal' || item.audience === 'staff' || item.audience === 'all') ? item.audience : 'portal',
      eventType: item.event_type || 'announcement',
      url: item.url || '',
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const handleDelete = async (item: AnnouncementItem) => {
    const isConfirmed = await confirm({
      title: __('Delete Announcement', 'codeclove-school-management'),
      message: sprintf(__('Are you sure you want to delete "%s"? This will permanently remove it from all recipient dashboards.', 'codeclove-school-management'), item.title),
    })
    if (!isConfirmed) return

    deleteMutation.mutate(item.id, {
      onSuccess: () => {
        toast.success(__('Announcement deleted successfully.', 'codeclove-school-management'))
      },
      onError: (err: unknown) => {
        toast.error(err instanceof Error ? err.message : __('Failed to delete announcement.', 'codeclove-school-management'))
      },
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}

    if (!form.title.trim()) {
      errors.title = __('Title is required.', 'codeclove-school-management')
    } else if (form.title.trim().length > 160) {
      errors.title = __('Title must be 160 characters or less.', 'codeclove-school-management')
    }

    if (!form.content.trim()) {
      errors.content = __('Content description is required.', 'codeclove-school-management')
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      audience: form.audience,
      event_type: form.eventType,
      url: form.url.trim() || null,
    }

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data: payload },
        {
          onSuccess: () => {
            toast.success(__('Announcement updated successfully.', 'codeclove-school-management'))
            setModalOpen(false)
          },
          onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : __('Failed to update announcement.', 'codeclove-school-management'))
          },
        }
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success(__('Announcement published successfully.', 'codeclove-school-management'))
          setModalOpen(false)
        },
        onError: (err: unknown) => {
          toast.error(err instanceof Error ? err.message : __('Failed to publish announcement.', 'codeclove-school-management'))
        },
      })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        title={__('Noticeboard', 'codeclove-school-management')}
        description={__('Publish and manage school-wide announcements, portal updates, and staff circulars.', 'codeclove-school-management')}
        actions={
          <Button onClick={handleOpenCreate} className="gap-1.5 shadow-sm">
            <Plus size={16} />
            {__('New Announcement', 'codeclove-school-management')}
          </Button>
        }
      />

      {/* ─── Filter Bar ────────────────────────────────────────────────────── */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={__('Search announcements...', 'codeclove-school-management')}
        activeFilterCount={(audienceFilter !== 'all' ? 1 : 0) + (eventTypeFilter !== 'all' ? 1 : 0)}
        onClearAll={() => {
          setSearch('')
          setAudienceFilter('all')
          setEventTypeFilter('all')
          table.resetPage()
          table.clearSelection()
        }}
      >
        <Select
          value={audienceFilter}
          onValueChange={setAudienceFilter}
          options={audienceFilterOptions}
          className="text-xs w-48"
        />

        <Select
          value={eventTypeFilter}
          onValueChange={setEventTypeFilter}
          options={[{ value: 'all', label: __('All Categories', 'codeclove-school-management') }, ...eventTypes]}
          className="text-xs w-40"
        />
      </FilterBar>

      {/* ─── Data Table & Async States ───────────────────────────────────────── */}
      <DataTable<NoticeboardItem>
        data={announcements}
        columns={columns}
        table={table}
        total={total}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={
          isError
            ? {
                icon: AlertCircle,
                message: __('Failed to load announcements', 'codeclove-school-management'),
                description: __('Failed to load announcements. Please check your network connection.', 'codeclove-school-management'),
                action: (
                  <Button size="sm" variant="secondary" onClick={() => refetch()}>
                    {__('Retry', 'codeclove-school-management')}
                  </Button>
                ),
              }
            : {
                icon: Megaphone,
                message: __('No announcements found', 'codeclove-school-management'),
                description:
                  search || audienceFilter !== 'all' || eventTypeFilter !== 'all'
                    ? __('No notices match the selected search or filter criteria.', 'codeclove-school-management')
                    : __('Start communicating with your school community by posting your first announcement.', 'codeclove-school-management'),
                action: (
                  <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
                    <Plus size={14} /> {__('Create Announcement', 'codeclove-school-management')}
                  </Button>
                ),
              }
        }
        keyExtractor={(item) => item.id}
      />

      {/* ─── Create / Edit Announcement Modal ───────────────────────────────── */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingItem ? __('Edit Announcement', 'codeclove-school-management') : __('Publish New Announcement', 'codeclove-school-management')}
        description={
          editingItem
            ? __('Update the announcement details below.', 'codeclove-school-management')
            : __('Compose and dispatch a notice to students, parents, or staff.', 'codeclove-school-management')
        }
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <FormField
            label={__('Announcement Title', 'codeclove-school-management')}
            required
            error={formErrors.title}
          >
            <Input
              placeholder={__('e.g. Annual Sports Meet & Schedule Published', 'codeclove-school-management')}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={160}
              aria-invalid={!!formErrors.title}
            />
          </FormField>

          {/* Row: Audience & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={__('Target Audience', 'codeclove-school-management')} required>
              <Select
                value={form.audience}
                onValueChange={(val) => setForm((f) => ({ ...f, audience: val as 'portal' | 'staff' | 'all' }))}
                options={formAudiences}
              />
            </FormField>

            <FormField label={__('Notice Category', 'codeclove-school-management')} required>
              <Select
                value={form.eventType}
                onValueChange={(val) => setForm((f) => ({ ...f, eventType: val }))}
                options={eventTypes}
              />
            </FormField>
          </div>

          {/* Content */}
          <FormField
            label={__('Notice Content', 'codeclove-school-management')}
            required
            error={formErrors.content}
          >
            <Textarea
              placeholder={__('Provide complete details, dates, instructions, or meeting links...', 'codeclove-school-management')}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={5}
              aria-invalid={!!formErrors.content}
            />
          </FormField>

          {/* Optional Action URL */}
          <FormField
            label={__('Action Link / URL (Optional)', 'codeclove-school-management')}
            hint={__('Optional destination link opened when user clicks this notification.', 'codeclove-school-management')}
          >
            <Input
              type="text"
              placeholder={__('e.g. /portal/calendar or https://school.edu/sports-meet', 'codeclove-school-management')}
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          </FormField>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={isSaving}
            >
              {__('Cancel', 'codeclove-school-management')}
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-1.5">
              {isSaving && <Spinner size="sm" />}
              {editingItem ? __('Save Changes', 'codeclove-school-management') : __('Publish Announcement', 'codeclove-school-management')}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  )
}
