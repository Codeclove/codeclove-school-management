/**
 * Staff Directory Page — Admin CRUD.
 *
 * Displays a searchable, paginated grid of faculty and administrative staff.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Trash2, Pencil, Eye, Mail, Phone, Upload, Printer
} from 'lucide-react'
import {
  useStaff,
  useDeleteStaff,
  useBulkStaffAction,
  type Staff,
  type Staff as StaffMember,
} from '@/api/staff'
import { useRoles } from '@/api/roles'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { useEntity } from '@/lib/useEntity'
import { useSettings } from '@/api/settings'
import { useSession } from '@/lib/session-context'
import { useFormatter } from '@/lib/formatter'
import { printElement } from '@/lib/print'
import { __, sprintf } from '@/lib/i18n'
import { StaffIdCard } from './components/StaffIdCard'
import {
  Button, Badge,
  Select,
  PageHeader, PersonAvatar,
  DataTable, FilterBar, type DataTableColumn
} from '@/components/ui'
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
// ─── Main Component ───────────────────────────────────────────────────────────

export default function StaffDirectoryPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const entity = useEntity('staff')
  const staffLabelSingular = entity.singular
  const staffLabelPlural = entity.plural
  const table = useTableState({ defaultOrderBy: 'id', defaultOrder: 'desc' })
  const { selectedIds, setSelectedIds, clearSelection } = table
  const { session } = useSession()
  const { data: settings } = useSettings()
  const { formatDate } = useFormatter()
  const [status, setStatus] = useState<string>('')
  const [roleId, setRoleId] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const debouncedSearch = useDebounce(search, 350)

  const [printingStaff, setPrintingStaff] = useState<Staff[] | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (printingStaff && printRef.current) {
      printElement(printRef.current)
      setPrintingStaff(null)
    }
  }, [printingStaff])

  const handleBulkPrintIdCards = () => {
    const selected = staffList.filter((s) => selectedIds.includes(s.id))
    setPrintingStaff(selected)
  }
  const { data: roles = [] } = useRoles()

  // Fetch staff list
  const { data, isLoading, isError, refetch } = useStaff({
    status: status || undefined,
    role_id: roleId || undefined,
    search: debouncedSearch || undefined,
    ...table.params,
  })

  const deleteMutation = useDeleteStaff()
  const bulkActionMutation = useBulkStaffAction()

  const staffList = data?.data ?? []
  const total = data?.total ?? 0

  // Reset selection on data change
  useEffect(() => {
    setSelectedIds([])
  }, [data])

  const handleBulkStatus = (newStatus: string) => {
    bulkActionMutation.mutate(
      { action: 'status', ids: selectedIds, status: newStatus },
      {
        onSuccess: () => {
          setSelectedIds([])
          toast.success(
            sprintf(
              __('Successfully updated status for selected %s!', 'codeclove-school-management'),
              staffLabelPlural.toLowerCase()
            )
          )
        },
        onError: (err) => {
          toast.error(err.message || __('Failed to perform bulk status update.', 'codeclove-school-management'))
        }
      }
    )
  }

  const handleBulkDelete = async () => {
    const isConfirmed = await confirm({
      title: sprintf(__('Delete Selected %s', 'codeclove-school-management'), staffLabelPlural),
      message: sprintf(
        __('Are you sure you want to delete the %1$d selected %2$s?', 'codeclove-school-management'),
        selectedIds.length,
        staffLabelPlural.toLowerCase()
      ),
    })
    if (!isConfirmed) return

    bulkActionMutation.mutate(
      { action: 'delete', ids: selectedIds },
      {
        onSuccess: (res) => {
          clearSelection()
          toast.success(
            sprintf(
              __('Successfully deleted %1$d %2$s!', 'codeclove-school-management'),
              res.deleted_count,
              staffLabelPlural.toLowerCase()
            )
          )
        },
        onError: (err) => {
          toast.error(
            err.message ||
              sprintf(__('Failed to bulk delete %s.', 'codeclove-school-management'), staffLabelPlural.toLowerCase())
          )
        }
      }
    )
  }

  // Reset to page 1 and clear selection on filter changes
  useEffect(() => {
    table.resetPage()
    table.clearSelection()
  }, [status, roleId, debouncedSearch, table.resetPage, table.clearSelection])

  // Handle delete
  const handleDelete = async (staff: Staff) => {
    const isConfirmed = await confirm({
      title: sprintf(__('Delete %s Record', 'codeclove-school-management'), staffLabelSingular),
      message: sprintf(
        __('Are you absolutely sure you want to remove %1$s %2$s (%3$s)? This will hide them from active view.', 'codeclove-school-management'),
        staff.first_name,
        staff.last_name,
        staff.staff_number
      ),
    })
    if (!isConfirmed) return

    deleteMutation.mutate(staff.id, {
      onSuccess: () => {
        toast.success(
          sprintf(
            __('Successfully removed %1$s %2$s from records.', 'codeclove-school-management'),
            staff.first_name,
            staff.last_name
          )
        )
      },
      onError: (err) => {
        toast.error(
          err.message ||
            sprintf(__('Failed to delete %s.', 'codeclove-school-management'), staffLabelSingular.toLowerCase())
        )
      },
    })
  }

  const columns: DataTableColumn<StaffMember>[] = useMemo(
    () => [
      {
        key: 'last_name',
        header: staffLabelSingular,
        type: 'primary',
        sortable: true,
        sortKey: 'last_name',
        render: (staff) => (
          <PersonAvatar
            name={`${staff.first_name} ${staff.last_name}${staff.preferred_name ? ` (${staff.preferred_name})` : ''}`}
            subtitle={staff.staff_number || undefined}
            photoUrl={staff.photo_url}
          />
        ),
      },
      {
        key: 'designation',
        header: __('Designation & Dept', 'codeclove-school-management'),
        render: (staff) => (
          <div className="flex flex-col">
            <span className="text-text text-sm font-medium whitespace-nowrap">{staff.designation || '—'}</span>
            <span className="text-text-muted text-2xs mt-0.5 whitespace-nowrap">{staff.department || '—'}</span>
          </div>
        ),
      },
      {
        key: 'contact',
        header: __('Contact Details', 'codeclove-school-management'),
        render: (staff) => (
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5 text-text-subtle">
              <Mail size={12} className="text-text-muted" />
              <span>{staff.email}</span>
            </div>
            {staff.phone && (
              <div className="flex items-center gap-1.5 text-text-subtle">
                <Phone size={12} className="text-text-muted" />
                <span>{staff.phone}</span>
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'role',
        header: __('System Role', 'codeclove-school-management'),
        type: 'badge',
        render: (staff) =>
          staff.role_name ? (
            <Badge variant="brand" size="sm" className="font-medium">
              {staff.role_name}
            </Badge>
          ) : (
            <span className="text-text-subtle italic text-xs">—</span>
          ),
      },
      {
        key: 'joined_on',
        header: __('Joined On', 'codeclove-school-management'),
        type: 'date',
        sortable: true,
        sortKey: 'joined_on',
        render: (staff) => staff.joined_on || '—',
      },
      {
        key: 'status',
        header: __('Status', 'codeclove-school-management'),
        type: 'badge',
        render: (staff) => (
          <Badge variant={staff.status}>{staff.status}</Badge>
        ),
      },
      {
        key: 'actions',
        header: __('Actions', 'codeclove-school-management'),
        type: 'actions',
        render: (staff) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/staff/${staff.id}`)}
              className="h-8 w-8 text-text-subtle hover:text-brand"
              title={__('View Profile', 'codeclove-school-management')}
            >
              <Eye size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/staff/${staff.id}/edit`)}
              className="h-8 w-8 text-text-subtle hover:text-brand"
              title={__('Edit Profile', 'codeclove-school-management')}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(staff)}
              className="h-8 w-8 text-text-subtle hover:text-danger"
              title={__('Delete Record', 'codeclove-school-management')}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [staffLabelSingular, navigate]
  )
  return (
    <div className="space-y-6">
      <PageHeader
        title={sprintf(__('%s Directory', 'codeclove-school-management'), staffLabelSingular)}
        breadcrumbs={[{ label: __('Staff & HR', 'codeclove-school-management') }, { label: sprintf(__('%s Directory', 'codeclove-school-management'), staffLabelSingular) }]}
        description={__('Manage faculty details, departments, and roles in one dashboard.', 'codeclove-school-management')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/staff/import')} className="gap-1.5">
              <Upload size={14} />
              {__('Bulk Import', 'codeclove-school-management')}
            </Button>
            <Button onClick={() => navigate('/staff/new')} className="gap-1.5">
              <Plus size={14} />
              {sprintf(__('Add %s', 'codeclove-school-management'), staffLabelSingular)}
            </Button>
          </div>
        }
      />

      {/* ── Filter Bar ───────────────────────────────────────────────────────── */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={__('Search by name, email, designation...', 'codeclove-school-management')}
        activeFilterCount={(status ? 1 : 0) + (roleId ? 1 : 0)}
        onClearAll={() => {
          setStatus('')
          setRoleId('')
          setSearch('')
          table.clearSelection()
        }}
      >
        <div className="w-full sm:w-40 lg:w-48 shrink-0">
          <Select
            aria-label={__('Filter by status', 'codeclove-school-management')}
            value={status}
            onValueChange={(val) => setStatus(val)}
            placeholder={__('All Statuses', 'codeclove-school-management')}
            options={[
              { value: '', label: __('All Statuses', 'codeclove-school-management') },
              { value: 'active', label: __('Active', 'codeclove-school-management') },
              { value: 'inactive', label: __('Inactive', 'codeclove-school-management') },
              { value: 'suspended', label: __('Suspended', 'codeclove-school-management') },
            ]}
          />
        </div>

        <div className="w-full sm:w-40 lg:w-48 shrink-0">
          <Select
            aria-label={__('Filter by system role', 'codeclove-school-management')}
            value={roleId}
            onValueChange={(val) => setRoleId(val)}
            placeholder={__('All System Roles', 'codeclove-school-management')}
            options={[
              { value: '', label: __('All System Roles', 'codeclove-school-management') },
              ...roles.map((r) => ({ value: String(r.id), label: r.name })),
            ]}
          />
        </div>
      </FilterBar>

      {/* ── Data Grid ────────────────────────────────────────────────────────── */}
      <DataTable<StaffMember>
        data={staffList}
        columns={columns}
        table={table}
        total={total}
        isLoading={isLoading}
        isError={isError}
        errorMessage={sprintf(__('Failed to fetch %s directory.', 'codeclove-school-management'), staffLabelPlural.toLowerCase())}
        onRetry={() => refetch()}
        selectable
        onRowClick={(staff) => navigate(`/staff/${staff.id}`)}
        bulkActions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkPrintIdCards}
              className="gap-1.5 h-7 text-xs bg-bg-surface"
            >
              <Printer size={12} />
              {__('Print ID Badges', 'codeclove-school-management')}
            </Button>
            <Select
              value=""
              onValueChange={(val) => {
                if (val === 'delete') {
                  handleBulkDelete()
                } else if (val.startsWith('status:')) {
                  handleBulkStatus(val.replace('status:', ''))
                }
              }}
              placeholder={__('Bulk Actions', 'codeclove-school-management')}
              options={[
                { value: '', label: __('Bulk Actions', 'codeclove-school-management') },
                { value: 'status:active', label: __('Mark Active', 'codeclove-school-management') },
                { value: 'status:inactive', label: __('Mark Inactive', 'codeclove-school-management') },
                { value: 'status:suspended', label: __('Mark Suspended', 'codeclove-school-management') },
                { value: 'delete', label: __('Delete Selected', 'codeclove-school-management') },
              ]}
              className="h-7 text-xs w-full sm:w-48 bg-bg-surface"
            />
          </>
        }
        emptyState={{
          icon: entity.icon,
          message:
            debouncedSearch || status || roleId
              ? __('No Staff Match Filters', 'codeclove-school-management')
              : sprintf(__('No %s Found', 'codeclove-school-management'), staffLabelPlural),
          description:
            debouncedSearch || status || roleId
              ? __('Try adjusting your search query, status, or role filter.', 'codeclove-school-management')
              : __('Add your first school staff member to configure roles and permissions.', 'codeclove-school-management'),
          action:
            !debouncedSearch && !status && !roleId ? (
              <Button size="sm" onClick={() => navigate('/staff/new')}>
                {sprintf(__('Add %s', 'codeclove-school-management'), staffLabelSingular)}
              </Button>
            ) : undefined,
        }}
      />

      {/* Hidden print container for Staff ID Badges */}
      {printingStaff && (
        <div style={{ visibility: 'hidden', position: 'fixed', top: 0, left: 0, pointerEvents: 'none' }}>
          <div ref={printRef} className="bg-white text-black font-sans">
            {Array.from({ length: Math.ceil(printingStaff.length / 2) }, (_, pageIdx) => {
              const pageMembers = printingStaff.slice(pageIdx * 2, pageIdx * 2 + 2)
              const isLastPage = pageIdx === Math.ceil(printingStaff.length / 2) - 1
              return (
                <div key={pageIdx} className={!isLastPage ? 'print-page-break' : ''}>
                  <div className="flex flex-col gap-5 w-full max-w-[180mm] mx-auto py-2">
                    {pageMembers.map((member) => (
                      <StaffIdCard
                        key={member.id}
                        staff={member}
                        school={settings?.school}
                        sessionLabel={session?.label}
                        formatDate={formatDate}
                        dual={true}
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
