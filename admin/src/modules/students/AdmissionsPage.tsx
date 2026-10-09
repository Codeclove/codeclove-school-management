import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/lib/session-context'
import { __, sprintf } from '@/lib/i18n'
import {
  Search, Eye, Pencil, X, Download, Trash2
} from 'lucide-react'
import {
  useAdmissions,
  useBulkAdmissionsAction,
  type AdmissionApplication,
} from '@/api/students'
import {
  useUnits,
  useSessions,
  useGroups,
} from '@/api/academics'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import {
  Button, Badge, Card,
  FormField, Input, Select,
  PageHeader, Modal, ModalFooter,
  DataTable, type DataTableColumn,
  type BadgeProps
} from '@/components/ui'
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
import { useFormatter } from '@/lib/formatter'
import { useLabels } from '@/lib/labels'
import { useEntity } from '@/lib/useEntity'

export default function AdmissionsPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const sessionId = session ? String(session.id) : ''
  const { formatDate } = useFormatter()
  const entity = useEntity('admission')
  const admissionLabelSingular = entity.singular
  const admissionLabelPlural = entity.plural
  const { getLabel } = useLabels()
  const studentLabelSingular = getLabel('student', false, __( 'Student', 'codeclove-school-management' ))
  const studentLabelPlural = getLabel('student', true, __( 'Students', 'codeclove-school-management' ))
  const unitLabelSingular = getLabel('academic_unit', false, __( 'Class Level', 'codeclove-school-management' ))
  const unitLabelPlural = getLabel('academic_unit', true, __( 'Class Levels', 'codeclove-school-management' ))
  const groupLabelSingular = getLabel('academic_group', false, __( 'Section', 'codeclove-school-management' ))
  const guardianLabelSingular = getLabel('guardian', false, __( 'Guardian', 'codeclove-school-management' ))
  const sessionLabelSingular = getLabel('academic_session', false, __( 'Academic Session', 'codeclove-school-management' ))
  const toast = useToast()
  const confirm = useConfirm()
  const [unitId, setUnitId] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [datePreset, setDatePreset] = useState<string>('')
  
  // Search input debouncing
  const [search, setSearch] = useState<string>('')
  const debouncedSearch = useDebounce(search, 350)

  const table = useTableState()
  const { selectedIds, clearSelection } = table

  const statusConfig: Record<
    AdmissionApplication['status'],
    { label: string; variant: BadgeProps['variant'] }
  > = useMemo(() => ({
    inquiry:             { label: __( 'Inquiry', 'codeclove-school-management' ),             variant: 'inquiry' },
    submitted:           { label: __( 'Submitted', 'codeclove-school-management' ),           variant: 'submitted' },
    under_review:        { label: __( 'Under Review', 'codeclove-school-management' ),        variant: 'under_review' },
    more_info_needed:    { label: __( 'More Info Needed', 'codeclove-school-management' ),    variant: 'more_info_needed' },
    interview_scheduled: { label: __( 'Interview Scheduled', 'codeclove-school-management' ), variant: 'interview_scheduled' },
    accepted:            { label: __( 'Accepted', 'codeclove-school-management' ),            variant: 'accepted' },
    waitlisted:          { label: __( 'Waitlisted', 'codeclove-school-management' ),          variant: 'waitlisted' },
    rejected:            { label: __( 'Rejected', 'codeclove-school-management' ),            variant: 'rejected' },
    admitted:            { label: __( 'Admitted', 'codeclove-school-management' ),            variant: 'admitted' },
    withdrawn:           { label: __( 'Withdrawn', 'codeclove-school-management' ),           variant: 'withdrawn' },
  }), [])

  // Reset class level filter if the globally active session changes
  useEffect(() => {
    setUnitId('')
    table.clearSelection()
  }, [sessionId, table.clearSelection])

  // Reset page and selection when filters change
  useEffect(() => {
    table.resetPage()
    table.clearSelection()
  }, [unitId, status, datePreset, debouncedSearch, table.resetPage, table.clearSelection])

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

  const { data: unitData } = useUnits({ per_page: 200 })

  const { data: admissionsData, isLoading, isError, refetch } = useAdmissions({
    academic_session_id: sessionId ? Number(sessionId) : undefined,
    academic_unit_id: unitId ? Number(unitId) : undefined,
    status: status || undefined,
    search: debouncedSearch || undefined,
    date_from,
    date_to,
    ...table.params,
  })

  const bulkActionMutation = useBulkAdmissionsAction()

  // Reset selection on data change
  useEffect(() => {
    clearSelection()
  }, [admissionsData, clearSelection])

  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [targetSessionId, setTargetSessionId] = useState('')
  const [targetUnitId, setTargetUnitId] = useState('')
  const [targetGroupId, setTargetGroupId] = useState('')

  // Fetch academic sessions for conversion
  const { data: sessionsData } = useSessions()
  const sessions = sessionsData?.data ?? []

  // Fetch target units based on target session
  const { data: targetUnitsData } = useUnits({
    session_id: targetSessionId ? Number(targetSessionId) : undefined,
    per_page: 200,
  })
  const targetUnits = targetUnitsData?.data ?? []

  // Fetch target sections based on target unit
  const { data: targetGroupsData } = useGroups({
    academic_unit_id: targetUnitId ? Number(targetUnitId) : undefined,
    per_page: 200,
  })
  const targetGroups = targetGroupsData?.data ?? []

  // Set default target session on open
  useEffect(() => {
    if (convertModalOpen && !targetSessionId) {
      setTargetSessionId(sessionId)
    }
  }, [convertModalOpen, sessionId])

  const handleBulkConvert = () => {
    if (!targetSessionId || !targetUnitId) {
      toast.error(__( 'Academic Session and Class Level are required.', 'codeclove-school-management' ))
      return
    }

    bulkActionMutation.mutate(
      {
        action: 'convert',
        ids: selectedIds,
        session_id: Number(targetSessionId),
        unit_id: Number(targetUnitId),
        group_id: targetGroupId ? Number(targetGroupId) : undefined,
      },
      {
        onSuccess: (res) => {
          clearSelection()
          setConvertModalOpen(false)
          setTargetUnitId('')
          setTargetGroupId('')
          toast.success(__( 'Successfully batch enrolled selected applicants!', 'codeclove-school-management' ))
          if (res.errors && res.errors.length > 0) {
            toast.error(sprintf(__( 'Some applications could not be converted: %s', 'codeclove-school-management' ), res.errors.join('; ')))
          }
        },
        onError: (err) => {
          toast.error(err.message || __( 'Failed to bulk convert applications.', 'codeclove-school-management' ))
        }
      }
    )
  }

  const handleBulkStatus = (newStatus: string) => {
    bulkActionMutation.mutate(
      { action: 'status', ids: selectedIds, status: newStatus },
      {
        onSuccess: () => {
          clearSelection()
          toast.success(sprintf(__( 'Successfully updated status for selected %s!', 'codeclove-school-management' ), admissionLabelPlural.toLowerCase()))
        },
        onError: (err) => {
          toast.error(err.message || __( 'Failed to perform bulk status update.', 'codeclove-school-management' ))
        }
      }
    )
  }

  const handleBulkDelete = async () => {
    const isConfirmed = await confirm({
      title: sprintf(__( 'Delete Selected %s', 'codeclove-school-management' ), admissionLabelPlural),
      message: sprintf(__( 'Are you sure you want to delete the %1$d selected %2$s?', 'codeclove-school-management' ), selectedIds.length, admissionLabelPlural.toLowerCase()),
    })
    if (!isConfirmed) return

    bulkActionMutation.mutate(
      { action: 'delete', ids: selectedIds },
      {
        onSuccess: (res) => {
          clearSelection()
          toast.success(sprintf(__( 'Successfully deleted %1$d %2$s!', 'codeclove-school-management' ), res.deleted_count, admissionLabelPlural.toLowerCase()))
          if (res.errors && res.errors.length > 0) {
            toast.error(sprintf(__( 'Some %1$s could not be deleted: %2$s', 'codeclove-school-management' ), admissionLabelPlural.toLowerCase(), res.errors.join('; ')))
          }
        },
        onError: (err) => {
          toast.error(err.message || sprintf(__( 'Failed to bulk delete %s.', 'codeclove-school-management' ), admissionLabelPlural.toLowerCase()))
        }
      }
    )
  }

  const handleSingleDelete = async (id: number, name: string) => {
    const isConfirmed = await confirm({
      title: sprintf(__( 'Delete %s', 'codeclove-school-management' ), admissionLabelSingular),
      message: sprintf(__( 'Are you sure you want to delete the admission application for %s?', 'codeclove-school-management' ), name),
    })
    if (!isConfirmed) return

    bulkActionMutation.mutate(
      { action: 'delete', ids: [id] },
      {
        onSuccess: (res) => {
          toast.success(sprintf(__( 'Successfully deleted application for %s!', 'codeclove-school-management' ), name))
          if (res.errors && res.errors.length > 0) {
            toast.error(sprintf(__( 'Could not delete application: %s', 'codeclove-school-management' ), res.errors.join('; ')))
          }
        },
        onError: (err) => {
          toast.error(err.message || __( 'Failed to delete application.', 'codeclove-school-management' ))
        }
      }
    )
  }

  const units = unitData?.data ?? []
  const applications = admissionsData?.data ?? []
  const total = admissionsData?.total ?? 0

  const handleExportCSV = () => {
    const listToExport = selectedIds.length > 0
      ? applications.filter(app => selectedIds.includes(app.id))
      : applications

    if (!listToExport.length) return
    const headers = [
      __( 'Reference', 'codeclove-school-management' ),
      __( 'Applicant Name', 'codeclove-school-management' ),
      unitLabelSingular,
      sprintf(__( 'Primary %s', 'codeclove-school-management' ), guardianLabelSingular),
      __( 'Submission Date', 'codeclove-school-management' ),
      __( 'Status', 'codeclove-school-management' )
    ]
    const rows = listToExport.map((app) => {
      const matchedUnit = units.find((u) => u.id === app.academic_unit_id)
      const statusCfg = statusConfig[app.status] ?? { label: app.status }
      const formattedDate = formatDate(app.submitted_at)
      return [
        app.reference_number,
        `${app.student_first_name} ${app.student_last_name}`,
        matchedUnit?.name ?? '—',
        app.guardian_name || '—',
        formattedDate,
        statusCfg.label
      ]
    })
    const csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `admissions_export_${Date.now()}.csv`)
    link.click()
  }

  const columns: DataTableColumn<AdmissionApplication>[] = useMemo(
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
        key: 'student_first_name',
        header: __( 'Applicant Name', 'codeclove-school-management' ),
        type: 'primary',
        sortable: true,
        sortKey: 'student_first_name',
        render: (app) => `${app.student_first_name} ${app.student_last_name}`,
      },
      {
        key: 'academic_unit_id',
        header: unitLabelSingular,
        render: (app) => {
          const matchedUnit = units.find((u) => u.id === app.academic_unit_id)
          return matchedUnit?.name ?? '—'
        },
      },
      {
        key: 'guardian_name',
        header: sprintf(__( 'Primary %s', 'codeclove-school-management' ), guardianLabelSingular),
        render: (app) => app.guardian_name || '—',
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
          const statusCfg = statusConfig[app.status] ?? { label: app.status, variant: 'default' as const }
          return (
            <Badge variant={statusCfg.variant} size="sm">
              {statusCfg.label}
            </Badge>
          )
        },
      },
      {
        key: 'actions',
        header: __( 'Actions', 'codeclove-school-management' ),
        type: 'actions',
        render: (app) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/students/admissions/${app.id}`)}
              className="h-8 w-8 text-text-subtle hover:text-brand"
              title={__( 'View Details', 'codeclove-school-management' )}
            >
              <Eye size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/students/admissions/${app.id}/edit`)}
              className="h-8 w-8 text-text-subtle hover:text-brand"
              title={__( 'Edit Application', 'codeclove-school-management' )}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSingleDelete(app.id, `${app.student_first_name} ${app.student_last_name}`)}
              className="h-8 w-8 text-text-subtle hover:text-danger"
              title={__( 'Delete Record', 'codeclove-school-management' )}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [unitLabelSingular, guardianLabelSingular, units, statusConfig, formatDate, navigate]
  )
  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title={sprintf(__( '%s Dashboard', 'codeclove-school-management' ), admissionLabelPlural)}
        breadcrumbs={[{ label: studentLabelPlural }, { label: admissionLabelPlural }]}
        description={sprintf(
          __( 'Review incoming %1$s applications, manage document checks, and convert accepted applicants to registered %2$s.', 'codeclove-school-management' ),
          studentLabelSingular.toLowerCase(),
          studentLabelPlural.toLowerCase()
        )}
      />

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <FormField label={__( 'Search Applicants', 'codeclove-school-management' )}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={__( 'Search by name, reference...', 'codeclove-school-management' )}
                  className="pl-9"
                />
              </div>
            </FormField>
          </div>
          <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
            <FormField label={unitLabelSingular}>
              <Select
                value={unitId}
                onValueChange={setUnitId}
                placeholder={sprintf(__( 'All %s', 'codeclove-school-management' ), unitLabelPlural.toLowerCase())}
                options={[
                  { value: '', label: sprintf(__( 'All %s', 'codeclove-school-management' ), unitLabelPlural.toLowerCase()) },
                  ...units.map((u) => ({ value: String(u.id), label: u.name })),
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
                  ...Object.entries(statusConfig).map(([k, v]) => ({
                    value: k,
                    label: v.label,
                  })),
                ]}
              />
            </FormField>
          </div>
          <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
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
            {(unitId || status || datePreset || search) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setUnitId('')
                  setStatus('')
                  setDatePreset('')
                  setSearch('')
                  table.resetPage()
                  table.clearSelection()
                }}
              >
                <X size={12} />
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
            >
              <Download size={15} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Applications Data Table */}
      <DataTable<AdmissionApplication>
        data={applications}
        columns={columns}
        table={table}
        total={total}
        isLoading={isLoading}
        isError={isError}
        errorMessage={sprintf(__( 'Could not load %s', 'codeclove-school-management' ), admissionLabelPlural.toLowerCase())}
        onRetry={() => refetch()}
        selectable
        onRowClick={(app) => navigate(`/students/admissions/${app.id}`)}
        bulkActions={
          <Select
            value=""
            onValueChange={(val) => {
              if (val === 'delete') {
                handleBulkDelete()
              } else if (val === 'convert') {
                setConvertModalOpen(true)
              } else if (val === 'export') {
                handleExportCSV()
              } else if (val.startsWith('status:')) {
                handleBulkStatus(val.replace('status:', ''))
              }
            }}
            placeholder={__( 'Bulk Actions', 'codeclove-school-management' )}
            options={[
              { value: '', label: __( 'Bulk Actions', 'codeclove-school-management' ) },
              ...Object.entries(statusConfig).map(([k, v]) => ({
                value: `status:${k}`,
                label: sprintf(__( 'Mark %s', 'codeclove-school-management' ), v.label),
              })),
              { value: 'convert', label: __( 'Convert to Students', 'codeclove-school-management' ) },
              { value: 'export', label: __( 'Export Selected to CSV', 'codeclove-school-management' ) },
              { value: 'delete', label: __( 'Delete Selected', 'codeclove-school-management' ) },
            ]}
            className="h-7 text-xs w-full sm:w-48 bg-bg-surface"
          />
        }
        emptyState={{
          icon: entity.icon,
          message:
            debouncedSearch || unitId || status || datePreset
              ? __( 'No Applications Match Filters', 'codeclove-school-management' )
              : sprintf(__( 'No %s Found', 'codeclove-school-management' ), admissionLabelPlural),
          description:
            debouncedSearch || unitId || status || datePreset
              ? __( 'Try adjusting your search query, class level, or status filter.', 'codeclove-school-management' )
              : __( 'No admission applications are currently registered in the database.', 'codeclove-school-management' ),
          action:
            debouncedSearch || unitId || status || datePreset ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setUnitId('')
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

      {/* Bulk Conversion Modal */}
      <Modal
        open={convertModalOpen}
        onOpenChange={setConvertModalOpen}
        title={sprintf(__( 'Batch Convert to %s', 'codeclove-school-management' ), studentLabelPlural)}
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-text-muted">
            {sprintf(
              __( 'Batch enroll the %1$d selected applicants as registered %2$s. This will create student records, link guardians, and assign class level enrollments.', 'codeclove-school-management' ),
              selectedIds.length,
              studentLabelPlural.toLowerCase()
            )}
          </p>

          <FormField label={sessionLabelSingular}>
            <Select
              value={targetSessionId}
              onValueChange={setTargetSessionId}
              options={sessions.map((s) => ({ value: String(s.id), label: s.name }))}
              placeholder={sprintf(__( 'Select %s', 'codeclove-school-management' ), sessionLabelSingular.toLowerCase())}
            />
          </FormField>

          <FormField label={unitLabelSingular}>
            <Select
              value={targetUnitId}
              onValueChange={setTargetUnitId}
              options={targetUnits.map((u) => ({ value: String(u.id), label: u.name }))}
              placeholder={sprintf(__( 'Select %s', 'codeclove-school-management' ), unitLabelSingular.toLowerCase())}
              disabled={!targetSessionId}
            />
          </FormField>

          <FormField label={sprintf(__( '%s (Optional)', 'codeclove-school-management' ), groupLabelSingular)}>
            <Select
              value={targetGroupId}
              onValueChange={setTargetGroupId}
              options={targetGroups.map((g) => ({ value: String(g.id), label: g.name }))}
              placeholder={sprintf(__( 'Select %s', 'codeclove-school-management' ), groupLabelSingular.toLowerCase())}
              disabled={!targetUnitId}
            />
          </FormField>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setConvertModalOpen(false)}>
            {__( 'Cancel', 'codeclove-school-management' )}
          </Button>
          <Button onClick={handleBulkConvert} disabled={bulkActionMutation.isPending}>
            {__( 'Convert & Enroll', 'codeclove-school-management' )}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
