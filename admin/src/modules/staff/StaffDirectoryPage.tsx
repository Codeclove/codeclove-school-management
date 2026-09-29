/**
 * Staff Directory Page — Admin CRUD.
 *
 * Displays a searchable, paginated grid of faculty and administrative staff.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Trash2, Search, X, Pencil, Eye, Mail, Phone, Upload, Printer
} from 'lucide-react'
import {
  useStaff,
  useDeleteStaff,
  useBulkStaffAction,
  type Staff,
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
  Button, Badge, Card, CardContent, Alert,
  Select, Input,
  TableRoot, Thead, Tbody, Tr, Th, Td, TableEmpty, TableSkeleton,
  PageHeader, PersonAvatar,
} from '@/components/ui'
import { TablePagination } from '@/components/ui/TablePagination'
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
  const { selectedIds, setSelectedIds, toggleSelect, toggleSelectAll, isSelected, isAllSelected, clearSelection } = table
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

  // Reset to page 1 on filter changes
  useEffect(() => {
    table.resetPage()
  }, [status, roleId, debouncedSearch, table.resetPage])

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
      <Card className="shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <Input
              aria-label={__('Search staff members', 'codeclove-school-management')}
              placeholder={__('Search by name, email, designation...', 'codeclove-school-management')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 w-full"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text focus:outline-none"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status filter dropdown */}
          <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
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

          {/* System Role filter dropdown */}
          <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
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
        </CardContent>
      </Card>

      {/* ── Data Grid ────────────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        {selectedIds.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-wrap px-4 py-2 bg-brand-dim/10 border-b border-border/60 text-xs font-semibold text-brand rounded-t-lg">
            <span>{sprintf(__('%1$d %2$s(s) selected', 'codeclove-school-management'), selectedIds.length, staffLabelSingular.toLowerCase())}</span>
            <div className="flex items-center gap-2">
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
                className="h-7 text-xs w-full sm:w-48 bg-bg-base"
              />
            </div>
          </div>
        )}
        <CardContent className="p-0 overflow-hidden">
          {isError ? (
            <div className="p-6">
              <Alert
                variant="danger"
                title={sprintf(__('Failed to fetch %s directory.', 'codeclove-school-management'), staffLabelPlural.toLowerCase())}
              >
                <div className="flex items-center justify-between gap-4 mt-1">
                  <span>{__('An error occurred while communicating with the database.', 'codeclove-school-management')}</span>
                  <Button size="sm" variant="secondary" onClick={() => refetch()}>
                    {__('Try again', 'codeclove-school-management')}
                  </Button>
                </div>
              </Alert>
            </div>
          ) : (
            <TableRoot>
              <Thead>
                <Tr>
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      checked={staffList.length > 0 && isAllSelected(staffList.map(s => s.id))}
                      onChange={() => toggleSelectAll(staffList.map(s => s.id))}
                      className="rounded border-border text-brand focus:ring-brand"
                    />
                  </Th>
                  <Th type="primary" {...table.getSortProps('last_name')}>
                    {staffLabelSingular}
                  </Th>
                  <Th>{__('Designation & Dept', 'codeclove-school-management')}</Th>
                  <Th>{__('Contact Details', 'codeclove-school-management')}</Th>
                  <Th type="badge">{__('System Role', 'codeclove-school-management')}</Th>
                  <Th type="date" {...table.getSortProps('joined_on')}>
                    {__('Joined On', 'codeclove-school-management')}
                  </Th>
                  <Th type="badge">{__('Status', 'codeclove-school-management')}</Th>
                  <Th type="actions">{__('Actions', 'codeclove-school-management')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {isLoading ? (
                  <TableSkeleton columns={8} rows={5} />
                ) : staffList.length === 0 ? (
                <TableEmpty
                  colSpan={8}
                  icon={entity.icon}
                  message={
                    debouncedSearch || status || roleId
                      ? __('No Staff Match Filters', 'codeclove-school-management')
                      : sprintf(__('No %s Found', 'codeclove-school-management'), staffLabelPlural)
                  }
                  description={
                    debouncedSearch || status || roleId
                      ? __('Try adjusting your search query, status, or role filter.', 'codeclove-school-management')
                      : __('Add your first school staff member to configure roles and permissions.', 'codeclove-school-management')
                  }
                  action={
                    !debouncedSearch && !status && !roleId && (
                      <Button size="sm" onClick={() => navigate('/staff/new')}>
                        {sprintf(__('Add %s', 'codeclove-school-management'), staffLabelSingular)}
                      </Button>
                    )
                  }
                />
              ) : (
                staffList.map((staff) => (
                  <Tr key={staff.id} className="table-row-hover">
                    <Td className="w-10">
                      <input
                        type="checkbox"
                        checked={isSelected(staff.id)}
                        onChange={() => toggleSelect(staff.id)}
                        className="rounded border-border text-brand focus:ring-brand"
                      />
                    </Td>
                    <Td type="primary">
                      <PersonAvatar
                        name={`${staff.first_name} ${staff.last_name}${staff.preferred_name ? ` (${staff.preferred_name})` : ''}`}
                        subtitle={staff.staff_number || undefined}
                        photoUrl={staff.photo_url}
                      />
                    </Td>
                    <Td>
                      <div className="flex flex-col">
                        <span className="text-text text-sm font-medium whitespace-nowrap">{staff.designation || '—'}</span>
                        <span className="text-text-muted text-3xs mt-0.5 whitespace-nowrap">{staff.department || '—'}</span>
                      </div>
                    </Td>
                    <Td>
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
                    </Td>
                    <Td type="badge">
                      {staff.role_name ? (
                        <Badge variant="brand" size="sm" className="font-medium">
                          {staff.role_name}
                        </Badge>
                      ) : (
                        <span className="text-text-subtle italic text-xs">—</span>
                      )}
                    </Td>
                    <Td type="date">
                      {staff.joined_on || '—'}
                    </Td>
                    <Td type="badge">
                      <Badge
                        variant={
                          staff.status === 'active'
                            ? 'success'
                            : staff.status === 'inactive'
                            ? 'inactive'
                            : 'suspended'
                        }
                      >
                        {staff.status === 'active'
                          ? __('Active', 'codeclove-school-management')
                          : staff.status === 'inactive'
                          ? __('Inactive', 'codeclove-school-management')
                          : staff.status === 'suspended'
                          ? __('Suspended', 'codeclove-school-management')
                          : staff.status}
                      </Badge>
                    </Td>
                    <Td type="actions">
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
                    </Td>
                  </Tr>
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
