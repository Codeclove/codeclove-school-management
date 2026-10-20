/**
 * NoticeboardPage — Manage school announcements, notices, and portal updates.
 *
 * Implements full CRUD:
 *  - Browse announcements with search, audience, and category filters
 *  - Fast status tabs (All, Active, Scheduled, Expired) using CodeClove design tokens
 *  - Consolidated Notice Details column with formatted text preview
 *  - Instant Recipient Card Preview modal for rapid audit without navigating away
 *  - Dedicated full-page composer (/announcements/new) for authoring
 *  - Dedicated full-page composer (/announcements/:id/edit) for editing
 *  - Quick single-notice deletion and batch multi-delete actions
 *  - Zero emojis — strictly uses standard Lucide icons and UI tokens
 *
 * Strictly adheres to codeclove-ui-ux and codebase design standards.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Megaphone, Plus, Edit2, Trash2,
  AlertCircle, ExternalLink, Pin,
} from 'lucide-react'
import {
  DataTable,
  type DataTableColumn,
  FilterBar,
  Button, Badge,
  Select,
  PageHeader,
} from '@/components/ui'
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
import { useConfirm } from '@/lib/confirm'
import { useToast } from '@/lib/toast'
import { useFormatter } from '@/lib/formatter'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'
import { ROUTES } from '@/lib/constants'
import {
  CANONICAL_NOTICE_CATEGORIES,
  getNotificationCategory,
} from '@/portal/lib/notifications'
import {
  useAnnouncements,
  useDeleteAnnouncement,
  type AnnouncementItem,
} from '@/api/notifications'
import { FormattedNoticeContent } from './components/FormattedNoticeContent'

export type NoticeboardItem = AnnouncementItem

// ─── Constants & Badge Helpers ───────────────────────────────────────────────

const STATUS_BADGES: Record<string, { variant: 'success' | 'info' | 'default'; label: string }> = {
  active: { variant: 'success', label: __( 'Active', 'codeclove-school-management' ) },
  scheduled: { variant: 'info', label: __( 'Scheduled', 'codeclove-school-management' ) },
  expired: { variant: 'default', label: __( 'Expired', 'codeclove-school-management' ) },
}

const AUDIENCE_FILTER_OPTIONS = [
  { value: 'all',    label: __( 'All Audiences', 'codeclove-school-management' ) },
  { value: 'portal', label: __( 'Students & Guardians (Portal)', 'codeclove-school-management' ) },
  { value: 'staff',  label: __( 'Staff & Faculty', 'codeclove-school-management' ) },
]

const STATUS_FILTER_OPTIONS = [
  { value: 'all',       label: __( 'All Statuses', 'codeclove-school-management' ) },
  { value: 'active',    label: __( 'Active', 'codeclove-school-management' ) },
  { value: 'scheduled', label: __( 'Scheduled', 'codeclove-school-management' ) },
  { value: 'expired',   label: __( 'Expired', 'codeclove-school-management' ) },
]

const CATEGORY_FILTER_OPTIONS = [
  {
    value: 'all',
    label: __( 'All Categories', 'codeclove-school-management' ),
    prefix: <Megaphone className="w-4 h-4 text-brand shrink-0" />,
  },
  ...CANONICAL_NOTICE_CATEGORIES.slice( 0, 6 ).map( ( c ) => {
    const IconComp = c.icon
    return {
      value: c.id,
      label: c.label,
      prefix: <IconComp className={cn( 'w-4 h-4 shrink-0', c.textColor )} />,
    }
  } ),
]

// ─── Main Component ──────────────────────────────────────────────────────────

export default function NoticeboardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const confirm = useConfirm()
  const toast = useToast()
  const { formatDate } = useFormatter()

  // Table & Filters
  const table = useTableState( { defaultPerPage: 10 } )
  const [search, setSearch] = useState( '' )
  const debouncedSearch = useDebounce( search, 350 )
  const [audienceFilter, setAudienceFilter] = useState( 'all' )
  const [eventTypeFilter, setEventTypeFilter] = useState( 'all' )
  const [statusFilter, setStatusFilter] = useState( 'all' )

  // Query announcements
  const { data, isLoading, isError, refetch } = useAnnouncements( {
    page: table.page,
    per_page: table.params.per_page,
    search: debouncedSearch || undefined,
    audience: audienceFilter !== 'all' ? audienceFilter : undefined,
    event_type: eventTypeFilter !== 'all' ? eventTypeFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  } )

  const deleteMutation = useDeleteAnnouncement()

  // Redirect legacy ?create=true directly to dedicated composer
  useEffect( () => {
    if ( searchParams.get( 'create' ) === 'true' ) {
      navigate( ROUTES.ANNOUNCEMENT_NEW, { replace: true } )
    }
  }, [searchParams, navigate] )

  const { resetPage, clearSelection } = table

  // Reset page and selection when filters change
  useEffect( () => {
    resetPage()
    clearSelection()
  }, [debouncedSearch, audienceFilter, eventTypeFilter, statusFilter, resetPage, clearSelection] )

  // Handlers
  const handleOpenCreate = () => {
    navigate( ROUTES.ANNOUNCEMENT_NEW )
  }

  const handleOpenEdit = useCallback( ( item: AnnouncementItem ) => {
    navigate( ROUTES.ANNOUNCEMENT_EDIT.replace( ':id', String( item.id ) ) )
  }, [navigate] )

  const handleDelete = useCallback(
    async ( item: AnnouncementItem ) => {
      const isConfirmed = await confirm( {
        title: __( 'Delete Announcement', 'codeclove-school-management' ),
        message: sprintf( __( 'Are you sure you want to delete "%s"? This will permanently remove it from all recipient dashboards.', 'codeclove-school-management' ), item.title ),
        confirmText: __( 'Delete Notice', 'codeclove-school-management' ),
        variant: 'danger',
      } )
      if ( ! isConfirmed ) return

      deleteMutation.mutate( item.id, {
        onSuccess: () => {
          toast.success( __( 'Announcement deleted successfully.', 'codeclove-school-management' ) )
        },
        onError: ( err: unknown ) => {
          toast.error( err instanceof Error ? err.message : __( 'Failed to delete announcement.', 'codeclove-school-management' ) )
        },
      } )
    },
    [confirm, deleteMutation, toast]
  )

  // Bulk delete action
  const handleBulkDelete = async () => {
    const selectedIds = table.selectedIds
    const count = selectedIds.length
    if ( count === 0 ) return

    const confirmed = await confirm( {
      title: __( 'Delete Selected Announcements', 'codeclove-school-management' ),
      message: sprintf(
        __( 'Are you sure you want to delete %d selected announcement(s)? This will permanently remove them from all recipient feeds.', 'codeclove-school-management' ),
        count
      ),
      confirmText: __( 'Delete Selected', 'codeclove-school-management' ),
      variant: 'danger',
    } )
    if ( ! confirmed ) return

    const results = await Promise.allSettled(
      selectedIds.map( ( id ) => deleteMutation.mutateAsync( Number( id ) ) )
    )
    const successCount = results.filter( ( r ) => r.status === 'fulfilled' ).length

    toast.success( sprintf( __( '%d announcement(s) deleted.', 'codeclove-school-management' ), successCount ) )
    table.clearSelection()
  }

  const bulkActions = useMemo(
    () => (
      <Button
        variant="danger"
        size="sm"
        onClick={handleBulkDelete}
        className="gap-1.5 h-7 text-xs"
      >
        <Trash2 size={12} />
        <span>{__( 'Delete Selected', 'codeclove-school-management' )}</span>
      </Button>
    ),
    [table.selectedIds, deleteMutation, confirm, toast]
  )

  const columns = useMemo<DataTableColumn<NoticeboardItem>[]>(
    () => [
      {
        key: 'title',
        header: __( 'Notice Details', 'codeclove-school-management' ),
        type: 'primary',
        render: ( item ) => {
          const category = getNotificationCategory( item.event_type, item.title, item.accent_color, item.icon )
          const CategoryIcon = category.icon
          const audienceLabel = item.audience === 'all'
            ? __( 'Everyone (Portal + Staff)', 'codeclove-school-management' )
            : item.audience === 'staff'
              ? __( 'Staff & Faculty', 'codeclove-school-management' )
              : __( 'Students & Guardians', 'codeclove-school-management' )

          return (
            <div className="flex items-start gap-3.5 py-1">
              {/* Category Icon Box */}
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center border shadow-3xs shrink-0 mt-0.5',
                  category.badgeColor
                )}
              >
                <CategoryIcon className="w-4 h-4" />
              </div>

              {/* Content, Title & Category Pill */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.is_pinned && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      <Pin className="w-3 h-3 fill-current" />
                      <span>{__( 'Pinned', 'codeclove-school-management' )}</span>
                    </span>
                  )}
                  <Link
                    to={ROUTES.ANNOUNCEMENT_EDIT.replace( ':id', String( item.id ) )}
                    className="font-semibold text-text text-sm hover:text-brand transition-colors"
                    onClick={( e ) => e.stopPropagation()}
                  >
                    {item.title}
                  </Link>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-text-subtle hover:text-brand transition-colors"
                      title={item.url}
                      onClick={( e ) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3.5 h-3.5 inline" />
                    </a>
                  )}
                </div>

                <FormattedNoticeContent
                  content={item.content}
                  className="text-xs text-text-muted line-clamp-2 leading-relaxed font-normal max-w-2xl"
                />

                <div className="flex items-center gap-2 text-2xs pt-0.5">
                  <span
                    className={cn(
                      'font-medium px-2 py-0.5 rounded-full border shadow-3xs text-[11px]',
                      category.badgeColor
                    )}
                  >
                    {category.label}
                  </span>
                  <span className="text-text-subtle/50">•</span>
                  <span className="text-text-subtle font-medium">{audienceLabel}</span>
                </div>
              </div>
            </div>
          )
        },
      },
      {
        key: 'status',
        header: __( 'Status', 'codeclove-school-management' ),
        type: 'badge',
        render: ( item ) => {
          const cfg = STATUS_BADGES[item.status] ?? { variant: 'default', label: item.status }
          return (
            <Badge variant={cfg.variant} size="sm" className="capitalize">
              {cfg.label}
            </Badge>
          )
        },
      },
      {
        key: 'notice_date',
        header: __( 'Date', 'codeclove-school-management' ),
        type: 'date',
        render: ( item ) => (
          <div className="text-xs space-y-0.5">
            <div className="font-medium text-text">{formatDate( item.notice_date || item.created_at )}</div>
            {item.expires_at && (
              <div className="text-[11px] text-text-muted">
                {sprintf( __( 'Expires: %s', 'codeclove-school-management' ), formatDate( item.expires_at ) )}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'actions',
        header: __( 'Actions', 'codeclove-school-management' ),
        type: 'actions',
        render: ( item ) => (
          <div className="flex items-center justify-end gap-1" onClick={( e ) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit( item )}
              className="h-8 w-8 p-0 text-text-subtle hover:text-brand"
              title={__( 'Edit Announcement', 'codeclove-school-management' )}
            >
              <Edit2 size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete( item )}
              className="h-8 w-8 p-0 text-text-subtle hover:text-danger"
              title={__( 'Delete Announcement', 'codeclove-school-management' )}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [formatDate, handleDelete, handleOpenEdit]
  )

  const announcements = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        title={__( 'Noticeboard', 'codeclove-school-management' )}
        description={__( 'Publish and manage school-wide announcements, portal updates, and staff circulars.', 'codeclove-school-management' )}
        actions={
          <Button onClick={handleOpenCreate} className="gap-1.5 shadow-sm">
            <Plus size={16} />
            {__( 'New Announcement', 'codeclove-school-management' )}
          </Button>
        }
      />

      {/* ─── Unified Standard FilterBar ────────────────────────────────────── */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={__( 'Search announcements...', 'codeclove-school-management' )}
        activeFilterCount={( statusFilter !== 'all' ? 1 : 0 ) + ( audienceFilter !== 'all' ? 1 : 0 ) + ( eventTypeFilter !== 'all' ? 1 : 0 )}
        onClearAll={() => {
          setSearch( '' )
          setStatusFilter( 'all' )
          setAudienceFilter( 'all' )
          setEventTypeFilter( 'all' )
          table.resetPage()
          table.clearSelection()
        }}
      >
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={STATUS_FILTER_OPTIONS}
          className="text-xs w-36"
        />

        <Select
          value={audienceFilter}
          onValueChange={setAudienceFilter}
          options={AUDIENCE_FILTER_OPTIONS}
          className="text-xs w-48"
        />

        <Select
          value={eventTypeFilter}
          onValueChange={setEventTypeFilter}
          options={CATEGORY_FILTER_OPTIONS}
          className="text-xs w-48"
          aria-label={__( 'Filter by category', 'codeclove-school-management' )}
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
        selectable
        bulkActions={bulkActions}
        onRowClick={( item ) => navigate( ROUTES.ANNOUNCEMENT_EDIT.replace( ':id', String( item.id ) ) )}
        onRetry={() => refetch()}
        emptyState={
          isError
            ? {
                icon: AlertCircle,
                message: __( 'Failed to load announcements', 'codeclove-school-management' ),
                description: __( 'Failed to load announcements. Please check your network connection.', 'codeclove-school-management' ),
                action: (
                  <Button size="sm" variant="secondary" onClick={() => refetch()}>
                    {__( 'Retry', 'codeclove-school-management' )}
                  </Button>
                ),
              }
            : {
                icon: Megaphone,
                message: __( 'No announcements found', 'codeclove-school-management' ),
                description:
                  search || audienceFilter !== 'all' || eventTypeFilter !== 'all' || statusFilter !== 'all'
                    ? __( 'No notices match the selected search or filter criteria.', 'codeclove-school-management' )
                    : __( 'Start communicating with your school community by posting your first announcement.', 'codeclove-school-management' ),
                action: (
                  <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
                    <Plus size={14} /> {__( 'Create Announcement', 'codeclove-school-management' )}
                  </Button>
                ),
              }
        }
        keyExtractor={( item ) => item.id}
      />

    </div>
  )
}
