import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Coins } from 'lucide-react'
import { __, _n, sprintf } from '@/lib/i18n'
import {
  useFeeTypes,
  useDeleteFeeType,
  type FeeType,
} from '@/api/finance'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { useLabels } from '@/lib/labels'
import { useFormatter } from '@/lib/formatter'
import { useDebounce } from '@/lib/useDebounce'
import { useTableState } from '@/lib/useTableState'
import {
  Button,
  PageHeader,
  Card,
  CardContent,
  Badge,
  Input,
  Select,
  DataTable,
  type DataTableColumn,
} from '@/components/ui'

export default function FeeTypesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const { getLabel } = useLabels()
  const { formatCurrency } = useFormatter()

  const feeTypeLabel = getLabel('fee_type', false, __('Fee Type', 'codeclove-school-management'))
  const feeTypeLabelPlural = getLabel('fee_type', true, __('Fee Types', 'codeclove-school-management'))

  // State
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [status, setStatus] = useState('all')
  const [frequency, setFrequency] = useState('all')
  const [scope, setScope] = useState('all')
  const [hasOverrides, setHasOverrides] = useState<'all' | 'yes' | 'no'>('all')
  const table = useTableState({ defaultPerPage: 25 })

  // Reset page when debounced search changes
  useEffect(() => {
    table.resetPage()
  }, [debouncedSearch])

  // Queries / Mutations
  const { data, isLoading, isError, refetch } = useFeeTypes({
    search: debouncedSearch || undefined,
    frequency: frequency && frequency !== 'all' ? frequency : undefined,
    scope: scope && scope !== 'all' ? scope : undefined,
    status: status && status !== 'all' ? status : undefined,
    has_overrides: hasOverrides && hasOverrides !== 'all' ? hasOverrides : undefined,
    page: table.page,
    per_page: table.perPage === 'all' ? -1 : table.perPage,
  })
  const deleteMutation = useDeleteFeeType()
  const feeTypes = data?.data || []
  const total = data?.pagination?.total || 0

  const handleDelete = async (id: number) => {
    const isConfirmed = await confirm({
      title: sprintf(__('Archive %s', 'codeclove-school-management'), feeTypeLabel),
      message: sprintf(__('Are you sure you want to archive this %s?', 'codeclove-school-management'), feeTypeLabel.toLowerCase()),
      variant: 'warning',
      confirmText: __('Archive', 'codeclove-school-management')
    })
    if (!isConfirmed) return

    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(sprintf(__('%s archived successfully.', 'codeclove-school-management'), feeTypeLabel))
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : ''
        toast.error(message || sprintf(__('Failed to delete %s', 'codeclove-school-management'), feeTypeLabel.toLowerCase()))
      },
    })
  }

  const getFrequencyBadge = (freq: string) => {
    const labels: Record<string, string> = {
      one_time: __('One Time', 'codeclove-school-management'),
      monthly: __('Monthly', 'codeclove-school-management'),
      quarterly: __('Quarterly', 'codeclove-school-management'),
      term_wise: __('Per Term', 'codeclove-school-management'),
      annual: __('Annual', 'codeclove-school-management'),
      custom: __('Custom', 'codeclove-school-management'),
    }
    return labels[freq] || freq
  }

  const columns = useMemo<DataTableColumn<FeeType>[]>(
    () => [
      {
        key: 'name',
        header: __('Name', 'codeclove-school-management'),
        type: 'primary',
      },
      {
        key: 'code',
        header: __('Code', 'codeclove-school-management'),
        type: 'code',
        render: (row) => row.code || '—',
      },
      {
        key: 'description',
        header: __('Description', 'codeclove-school-management'),
        className: 'max-w-xs truncate',
        render: (row) => row.description || '—',
      },
      {
        key: 'default_amount_minor',
        header: __('Default Amount', 'codeclove-school-management'),
        type: 'number',
        render: (row) => (
          <div>
            <div className="tabular-nums font-semibold">{formatCurrency(row.default_amount_minor)}</div>
            {row.overrides_count && row.overrides_count > 0 ? (
              <span className="text-2xs text-text-muted font-normal block mt-0.5">
                {sprintf(_n('%d override', '%d overrides', row.overrides_count, 'codeclove-school-management'), row.overrides_count)}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'frequency',
        header: __('Frequency', 'codeclove-school-management'),
        type: 'badge',
        render: (row) => (
          <span className="text-xs text-text-muted font-medium bg-bg-surface border border-border px-2 py-1 rounded inline-block">
            {getFrequencyBadge(row.frequency)}
          </span>
        ),
      },
      {
        key: 'status',
        header: __('Status', 'codeclove-school-management'),
        type: 'badge',
        render: (row) => (
          <Badge variant={row.status}>
            {row.status}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: __('Actions', 'codeclove-school-management'),
        type: 'actions',
        render: (row) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/finance/fee-types/${row.id}/edit`)}
              className="h-8 w-8 text-text-subtle hover:text-brand"
              title={__('Edit Template', 'codeclove-school-management')}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(row.id)}
              className="h-8 w-8 text-text-subtle hover:text-danger"
              title={__('Delete Template', 'codeclove-school-management')}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [formatCurrency, navigate]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={feeTypeLabelPlural}
        description={sprintf(__('Manage fee templates, pricing defaults, and payment schedules for %s.', 'codeclove-school-management'), feeTypeLabelPlural.toLowerCase())}
        breadcrumbs={[{ label: __('Finance', 'codeclove-school-management') }, { label: feeTypeLabelPlural }]}
        actions={
          <Button size="sm" onClick={() => navigate('/finance/fee-types/new')} className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            {sprintf(__('Add %s', 'codeclove-school-management'), feeTypeLabel)}
          </Button>
        }
      />

      {/* Filters Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                type="text"
                placeholder={__('Search templates...', 'codeclove-school-management')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  table.resetPage()
                }}
                className="pl-9 w-full"
              />
            </div>
            <div>
              <Select
                value={frequency}
                onValueChange={(val) => {
                  setFrequency(val)
                  table.resetPage()
                }}
                placeholder={__('All Frequencies', 'codeclove-school-management')}
                options={[
                  { value: 'all', label: __('All Frequencies', 'codeclove-school-management') },
                  { value: 'one_time', label: __('One Time', 'codeclove-school-management') },
                  { value: 'monthly', label: __('Monthly', 'codeclove-school-management') },
                  { value: 'quarterly', label: __('Quarterly', 'codeclove-school-management') },
                  { value: 'term_wise', label: __('Per Term', 'codeclove-school-management') },
                  { value: 'annual', label: __('Annual', 'codeclove-school-management') },
                  { value: 'custom', label: __('Custom', 'codeclove-school-management') },
                ]}
              />
            </div>
            <div>
              <Select
                value={scope}
                onValueChange={(val) => {
                  setScope(val)
                  table.resetPage()
                }}
                placeholder={__('All Scopes', 'codeclove-school-management')}
                options={[
                  { value: 'all', label: __('All Scopes', 'codeclove-school-management') },
                  { value: 'global', label: __('Global Scope', 'codeclove-school-management') },
                  { value: 'unit_specific', label: __('Class Scope', 'codeclove-school-management') },
                ]}
              />
            </div>
            <div>
              <Select
                value={hasOverrides}
                onValueChange={(val) => {
                  setHasOverrides(val as 'all' | 'yes' | 'no')
                  table.resetPage()
                }}
                placeholder={__('All Customizations', 'codeclove-school-management')}
                options={[
                  { value: 'all', label: __('All Customizations', 'codeclove-school-management') },
                  { value: 'no', label: __('Standard (No Overrides)', 'codeclove-school-management') },
                  { value: 'yes', label: __('Customized (Has Overrides)', 'codeclove-school-management') },
                ]}
              />
            </div>
            <div>
              <Select
                value={status}
                onValueChange={(val) => {
                  setStatus(val)
                  table.resetPage()
                }}
                placeholder={__('All Statuses', 'codeclove-school-management')}
                options={[
                  { value: 'all', label: __('All Statuses', 'codeclove-school-management') },
                  { value: 'active', label: __('Active', 'codeclove-school-management') },
                  { value: 'inactive', label: __('Inactive', 'codeclove-school-management') },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main List */}
      <DataTable<FeeType>
        columns={columns}
        data={feeTypes}
        table={table}
        total={total}
        loading={isLoading}
        isLoading={isLoading}
        error={isError}
        isError={isError}
        errorMessage={sprintf(__("We couldn't retrieve the list of %s. Please try again.", 'codeclove-school-management'), feeTypeLabelPlural.toLowerCase())}
        onRetry={() => refetch()}
        keyExtractor={(row) => row.id}
        emptyMessage={sprintf(__('No %s found', 'codeclove-school-management'), feeTypeLabelPlural)}
        emptyState={{
          message: sprintf(__('No %s found', 'codeclove-school-management'), feeTypeLabelPlural),
          description: __('Get started by creating your first reusable school fee template.', 'codeclove-school-management'),
          icon: Coins,
          action: (
            <Button size="sm" onClick={() => navigate('/finance/fee-types/new')}>
              {sprintf(__('Add %s', 'codeclove-school-management'), feeTypeLabel)}
            </Button>
          ),
        }}
      />
    </div>
  )
}
