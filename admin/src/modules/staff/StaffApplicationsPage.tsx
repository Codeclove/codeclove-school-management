import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Pencil, X, Download, Trash2, Briefcase
} from 'lucide-react'
import { __, sprintf } from '@/lib/i18n'
import {
  useStaffApplications,
  useBulkStaffApplicationsAction,
  type StaffApplication,
} from '@/api/staff'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import {
  Button, Badge, Card,
  FormField, Input, Select,
  PageHeader,
  DataTable, type DataTableColumn,
  type BadgeProps
} from '@/components/ui'
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
import { useFormatter } from '@/lib/formatter'
import { useLabels } from '@/lib/labels'

export default function StaffApplicationsPage() {
  const navigate = useNavigate()
  const { formatDate } = useFormatter()
  const { getLabel } = useLabels()
  const staffLabelPlural = getLabel('staff_member', true, __( 'Staff & HR', 'codeclove-school-management' ))
  const toast = useToast()
  const confirm = useConfirm()

  const [status, setStatus] = useState<string>('')
  const [datePreset, setDatePreset] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const debouncedSearch = useDebounce(search, 350)

  const table = useTableState()
  const { selectedIds, clearSelection, resetPage } = table
  const statusConfig: Record<string, { label: string; variant: BadgeProps['variant'] }> = useMemo(() => ({
    submitted:           { label: __( 'Submitted', 'codeclove-school-management' ),           variant: 'submitted' },
    under_review:        { label: __( 'Under Review', 'codeclove-school-management' ),        variant: 'under_review' },
    more_info_needed:    { label: __( 'More Info Needed', 'codeclove-school-management' ),    variant: 'more_info_needed' },
    interview_scheduled: { label: __( 'Interview Scheduled', 'codeclove-school-management' ), variant: 'interview_scheduled' },
    offer_sent:          { label: __( 'Offer Sent', 'codeclove-school-management' ),          variant: 'offer_sent' },
    accepted:            { label: __( 'Accepted', 'codeclove-school-management' ),            variant: 'accepted' },
    hired:               { label: __( 'Hired', 'codeclove-school-management' ),               variant: 'hired' },
    rejected:            { label: __( 'Rejected', 'codeclove-school-management' ),            variant: 'rejected' },
    withdrawn:           { label: __( 'Withdrawn', 'codeclove-school-management' ),           variant: 'withdrawn' },
  }), [])

  // Reset page and selection when filters change
  useEffect(() => {
    resetPage()
    clearSelection()
  }, [status, datePreset, debouncedSearch, resetPage, clearSelection])
  const getDateRange = (preset: string) => {
    if (!preset) return { date_from: undefined, date_to: undefined }
    const now = new Date()
    const formatDateStr = (d: Date) => d.toISOString().split('T')[0]

    if (preset === 'today') {
      const todayStr = formatDateStr(now)
      return { date_from: todayStr, date_to: todayStr }
    }
    if (preset === 'this_week') {
      const past = new Date()
      past.setDate(now.getDate() - 7)
      return { date_from: formatDateStr(past), date_to: formatDateStr(now) }
    }
    if (preset === 'this_month') {
      const past = new Date()
      past.setDate(now.getDate() - 30)
      return { date_from: formatDateStr(past), date_to: formatDateStr(now) }
    }
    return { date_from: undefined, date_to: undefined }
  }

  const { date_from, date_to } = getDateRange(datePreset)

  const { data: applicationsData, isLoading, isError, refetch } = useStaffApplications({
    status: status || undefined,
    search: debouncedSearch || undefined,
    date_from,
    date_to,
    ...table.params,
  })

  const bulkActionMutation = useBulkStaffApplicationsAction()

  const applications = applicationsData?.data ?? []
  const total = applicationsData?.total ?? 0

  // Single delete
  const handleDeleteSingle = useCallback(async (app: StaffApplication) => {
    const isConfirmed = await confirm({
      title: __( 'Delete Staff Application', 'codeclove-school-management' ),
      message: sprintf(
        __( 'Are you sure you want to delete the application for %1$s (%2$s)?', 'codeclove-school-management' ),
        `${app.first_name} ${app.last_name}`,
        app.reference_number
      ),
    })
    if (!isConfirmed) return

    bulkActionMutation.mutate(
      { action: 'delete', ids: [app.id] },
      {
        onSuccess: () => {
          toast.success(__( 'Application deleted successfully.', 'codeclove-school-management' ))
        },
        onError: (err) => {
          toast.error(err.message || __( 'Failed to delete application.', 'codeclove-school-management' ))
        },
      }
    )
  }, [bulkActionMutation, confirm, toast])
  // Bulk actions
  const handleBulkDelete = async () => {
    const isConfirmed = await confirm({
      title: __( 'Delete Selected Applications', 'codeclove-school-management' ),
      message: sprintf(
        __( 'Are you sure you want to delete %d selected applications?', 'codeclove-school-management' ),
        selectedIds.length
      ),
    })
    if (!isConfirmed) return

    bulkActionMutation.mutate(
      { action: 'delete', ids: selectedIds },
      {
        onSuccess: (res) => {
          clearSelection()
          toast.success(
            sprintf(__( 'Successfully deleted %d applications.', 'codeclove-school-management' ), res.deleted_count || selectedIds.length)
          )
        },
        onError: (err) => {
          toast.error(err.message || __( 'Failed to delete applications.', 'codeclove-school-management' ))
        },
      }
    )
  }

  const handleBulkStatus = (bulkNewStatus: string) => {
    bulkActionMutation.mutate(
      { action: 'status', ids: selectedIds, status: bulkNewStatus },
      {
        onSuccess: () => {
          clearSelection()
          toast.success(__( 'Successfully updated status for selected applications.', 'codeclove-school-management' ))
        },
        onError: (err) => {
          toast.error(err.message || __( 'Failed to update status for selected applications.', 'codeclove-school-management' ))
        },
      }
    )
  }

  // Export CSV
  const handleExportCSV = () => {
    const listToExport = selectedIds.length > 0
      ? applications.filter((app) => selectedIds.includes(app.id))
      : applications

    if (!listToExport.length) return
    const headers = [
      __( 'Reference', 'codeclove-school-management' ),
      __( 'Candidate Name', 'codeclove-school-management' ),
      __( 'Desired Role', 'codeclove-school-management' ),
      __( 'Department', 'codeclove-school-management' ),
      __( 'Email', 'codeclove-school-management' ),
      __( 'Phone', 'codeclove-school-management' ),
      __( 'Submission Date', 'codeclove-school-management' ),
      __( 'Status', 'codeclove-school-management' ),
    ]
    const rows = listToExport.map((app) => {
      const statusCfg = statusConfig[app.status] ?? { label: app.status }
      return [
        app.reference_number,
        `${app.first_name} ${app.last_name}`,
        app.desired_role || '—',
        app.department || '—',
        app.email,
        app.phone || '—',
        formatDate(app.submitted_at),
        statusCfg.label,
      ]
    })
    const csvContent = [headers, ...rows]
      .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `staff_applications_${Date.now()}.csv`)
    link.click()
  }

  const columns: DataTableColumn<StaffApplication>[] = useMemo(
    () => [
      {
        key: 'reference_number',
        header: __( 'Reference', 'codeclove-school-management' ),
        type: 'code',
        sortable: true,
        sortKey: 'reference_number',
        render: (app) => app.reference_number,
      },
      {
        key: 'first_name',
        header: __( 'Candidate Name', 'codeclove-school-management' ),
        type: 'primary',
        sortable: true,
        sortKey: 'first_name',
        render: (app) => (
          <div>
            <div className="font-medium text-text">{`${app.first_name} ${app.last_name}`}</div>
            <div className="text-xs text-text-muted">{app.email}</div>
          </div>
        ),
      },
      {
        key: 'desired_role',
        header: __( 'Position', 'codeclove-school-management' ),
        render: (app) => (
          <div>
            <div className="font-medium text-text">{app.desired_role || '—'}</div>
            {app.department && <div className="text-xs text-text-muted">{app.department}</div>}
          </div>
        ),
      },
      {
        key: 'phone',
        header: __( 'Phone', 'codeclove-school-management' ),
        render: (app) => app.phone || '—',
      },
      {
        key: 'submitted_at',
        header: __( 'Submission Date', 'codeclove-school-management' ),
        type: 'date',
        sortable: true,
        sortKey: 'submitted_at',
        render: (app) => formatDate(app.submitted_at),
      },
      {
        key: 'status',
        header: __( 'Status', 'codeclove-school-management' ),
        type: 'badge',
        sortable: true,
        sortKey: 'status',
        render: (app) => {
          const cfg = statusConfig[app.status] ?? { label: app.status, variant: 'default' as const }
          return (
            <Badge variant={cfg.variant} size="sm">
              {cfg.label}
            </Badge>
          )
        },
      },
      {
        key: 'actions',
        header: __( 'Actions', 'codeclove-school-management' ),
        type: 'actions',
        render: (app) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/staff/applications/${app.id}/edit`)
              }}
              className="h-8 w-8 text-text-subtle hover:text-brand"
              title={__( 'Edit Details', 'codeclove-school-management' )}
              aria-label={__( 'Edit Details', 'codeclove-school-management' )}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteSingle(app)
              }}
              className="h-8 w-8 text-text-subtle hover:text-danger"
              title={__( 'Delete Application', 'codeclove-school-management' )}
              aria-label={__( 'Delete Application', 'codeclove-school-management' )}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [statusConfig, formatDate, navigate, handleDeleteSingle]
  )

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={__( 'Staff Applications', 'codeclove-school-management' )}
        breadcrumbs={[{ label: staffLabelPlural }, { label: __( 'Applications', 'codeclove-school-management' ) }]}
        description={__(
          'Review incoming employee recruitment applications, manage hiring stages, and onboard candidates as active staff members.',
          'codeclove-school-management'
        )}
      />

      {/* Filter Toolbar */}
      <Card className="p-4 bg-bg-elevated border border-border">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <FormField inputId="staff-app-search" label={__( 'Search Candidates', 'codeclove-school-management' )}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                <Input
                  id="staff-app-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={__( 'Search by name, reference, email...', 'codeclove-school-management' )}
                  className="pl-9 bg-bg-surface border-border text-sm"
                />
              </div>
            </FormField>
          </div>

          <div className="w-full sm:w-44 lg:flex-1 lg:max-w-xs min-w-[140px]">
            <FormField label={__( 'Application Status', 'codeclove-school-management' )}>
              <Select
                value={status}
                onValueChange={setStatus}
                placeholder={__( 'All statuses', 'codeclove-school-management' )}
                options={[
                  { value: '', label: __( 'All statuses', 'codeclove-school-management' ) },
                  ...Object.entries(statusConfig).map(([k, v]) => ({
                    value: k,
                    label: v.label,
                  })),
                ]}
              />
            </FormField>
          </div>

          <div className="w-full sm:w-44 lg:flex-1 lg:max-w-xs min-w-[140px]">
            <FormField label={__( 'Submission Date', 'codeclove-school-management' )}>
              <Select
                value={datePreset}
                onValueChange={setDatePreset}
                placeholder={__( 'All time', 'codeclove-school-management' )}
                options={[
                  { value: '', label: __( 'All time', 'codeclove-school-management' ) },
                  { value: 'today', label: __( 'Today', 'codeclove-school-management' ) },
                  { value: 'this_week', label: __( 'Last 7 days', 'codeclove-school-management' ) },
                  { value: 'this_month', label: __( 'Last 30 days', 'codeclove-school-management' ) },
                ]}
              />
            </FormField>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 h-9">
            {(status || datePreset || search) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStatus('')
                  setDatePreset('')
                  setSearch('')
                  table.resetPage()
                  table.clearSelection()
                }}
              >
                <X size={12} className="me-1" />
                {__( 'Clear Filters', 'codeclove-school-management' )}
              </Button>
            )}
            <Button
              variant="secondary"
              size="icon"
              onClick={handleExportCSV}
              disabled={!applications.length}
              className="flex-shrink-0"
              title={__( 'Export CSV', 'codeclove-school-management' )}
              aria-label={__( 'Export CSV', 'codeclove-school-management' )}
            >
              <Download size={15} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Applications Data Table */}
      <DataTable<StaffApplication>
        data={applications}
        columns={columns}
        table={table}
        total={total}
        isLoading={isLoading}
        isError={isError}
        errorMessage={__( 'Could not load staff applications.', 'codeclove-school-management' )}
        onRetry={() => refetch()}
        selectable
        onRowClick={(app) => navigate(`/staff/applications/${app.id}`)}
        bulkActions={
          <Select
            value=""
            onValueChange={(val) => {
              if (val === 'delete') {
                handleBulkDelete()
              } else if (val.startsWith('status:')) {
                handleBulkStatus(val.replace('status:', ''))
              }
            }}
            placeholder={__( 'Bulk Actions', 'codeclove-school-management' )}
            options={[
              { value: '', label: __( 'Bulk Actions', 'codeclove-school-management' ) },
              { value: 'status:under_review', label: __( 'Mark Under Review', 'codeclove-school-management' ) },
              { value: 'status:interview_scheduled', label: __( 'Schedule Interview', 'codeclove-school-management' ) },
              { value: 'status:accepted', label: __( 'Mark Accepted', 'codeclove-school-management' ) },
              { value: 'status:rejected', label: __( 'Mark Rejected', 'codeclove-school-management' ) },
              { value: 'delete', label: __( 'Delete Selected', 'codeclove-school-management' ) },
            ]}
            className="h-7 text-xs w-full sm:w-48 bg-bg-surface"
          />
        }
        emptyState={{
          icon: Briefcase,
          message:
            debouncedSearch || status || datePreset
              ? __( 'No Applications Match Filters', 'codeclove-school-management' )
              : __( 'No Staff Applications Found', 'codeclove-school-management' ),
          description:
            debouncedSearch || status || datePreset
              ? __( 'Try adjusting your search query or status filter.', 'codeclove-school-management' )
              : __( 'No staff recruitment applications have been submitted yet.', 'codeclove-school-management' ),
          action:
            debouncedSearch || status || datePreset ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setStatus('')
                  setDatePreset('')
                  setSearch('')
                  table.resetPage()
                  table.clearSelection()
                }}
              >
                {__( 'Clear Filters', 'codeclove-school-management' )}
              </Button>
            ) : undefined,
        }}
      />
    </div>
  )
}
