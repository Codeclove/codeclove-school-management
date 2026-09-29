import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, AlertTriangle, Coins } from 'lucide-react'
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
import { TablePagination } from '@/components/ui/TablePagination'
import {
  Button,
  PageHeader,
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableSkeleton,
  TableEmpty,
  Card,
  CardContent,
  Badge,
  Input,
  Select,
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
  const [status, setStatus] = useState('all')
  const [frequency, setFrequency] = useState('all')
  const [scope, setScope] = useState('all')
  const [hasOverrides, setHasOverrides] = useState<'all' | 'yes' | 'no'>('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number | 'all'>(25)

  // Queries / Mutations
  const { data, isLoading, isError, refetch } = useFeeTypes({
    search: search || undefined,
    frequency: frequency && frequency !== 'all' ? frequency : undefined,
    scope: scope && scope !== 'all' ? scope : undefined,
    status: status && status !== 'all' ? status : undefined,
    has_overrides: hasOverrides && hasOverrides !== 'all' ? hasOverrides : undefined,
    page,
    per_page: perPage === 'all' ? -1 : perPage,
  })

  const deleteMutation = useDeleteFeeType()
  const list = data?.data || []
  const total = data?.pagination?.total || 0

  const handleOpenAdd = () => navigate('/finance/fee-types/new')
  const handleOpenEdit = (feeType: FeeType) => navigate(`/finance/fee-types/${feeType.id}/edit`)

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={feeTypeLabelPlural}
        description={sprintf(__('Manage fee templates, pricing defaults, and payment schedules for %s.', 'codeclove-school-management'), feeTypeLabelPlural.toLowerCase())}
        breadcrumbs={[{ label: __('Finance', 'codeclove-school-management') }, { label: feeTypeLabelPlural }]}
        actions={
          <Button size="sm" onClick={handleOpenAdd} className="flex items-center gap-1.5">
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
                  setPage(1)
                }}
                className="pl-9 w-full"
              />
            </div>
            <div>
              <Select
                value={frequency}
                onValueChange={(val) => {
                  setFrequency(val)
                  setPage(1)
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
                  setPage(1)
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
                  setPage(1)
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
                  setPage(1)
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
      <Card>
        <CardContent className="p-0">
          <TableRoot>
            <Thead>
              <Tr>
                <Th type="primary">{__('Name', 'codeclove-school-management')}</Th>
                <Th type="code">{__('Code', 'codeclove-school-management')}</Th>
                <Th>{__('Description', 'codeclove-school-management')}</Th>
                <Th type="number">{__('Default Amount', 'codeclove-school-management')}</Th>
                <Th type="badge">{__('Frequency', 'codeclove-school-management')}</Th>
                <Th type="badge">{__('Status', 'codeclove-school-management')}</Th>
                <Th type="actions">{__('Actions', 'codeclove-school-management')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <TableSkeleton columns={7} rows={5} />
              ) : isError ? (
                <TableEmpty
                  colSpan={7}
                  message={__('Error Loading Data', 'codeclove-school-management')}
                  description={sprintf(__("We couldn't retrieve the list of %s. Please try again.", 'codeclove-school-management'), feeTypeLabelPlural.toLowerCase())}
                  icon={AlertTriangle}
                  action={<Button size="sm" onClick={() => refetch()}>{__('Retry', 'codeclove-school-management')}</Button>}
                />
              ) : list.length === 0 ? (
                <TableEmpty
                  colSpan={7}
                  message={sprintf(__('No %s found', 'codeclove-school-management'), feeTypeLabelPlural)}
                  description={__('Get started by creating your first reusable school fee template.', 'codeclove-school-management')}
                  icon={Coins}
                  action={
                    <Button size="sm" onClick={handleOpenAdd}>
                      {sprintf(__('Add %s', 'codeclove-school-management'), feeTypeLabel)}
                    </Button>
                  }
                />
              ) : (
                list.map((row) => (
                  <Tr key={row.id} className="hover:bg-bg-base/20 transition-colors">
                    <Td type="primary">{row.name}</Td>
                    <Td type="code">{row.code || '—'}</Td>
                    <Td className="max-w-xs truncate">{row.description || '—'}</Td>
                    <Td type="number">
                      <div>{formatCurrency(row.default_amount_minor)}</div>
                      {row.overrides_count && row.overrides_count > 0 ? (
                        <span className="text-2xs text-text-muted font-normal block mt-0.5">
                          {sprintf(_n('%d override', '%d overrides', row.overrides_count, 'codeclove-school-management'), row.overrides_count)}
                        </span>
                      ) : null}
                    </Td>
                    <Td type="badge">
                      <span className="text-xs text-text-muted font-medium bg-bg-base px-2 py-1 rounded inline-block">
                        {getFrequencyBadge(row.frequency)}
                      </span>
                    </Td>
                    <Td type="badge">
                      <Badge variant={row.status}>
                        {row.status}
                      </Badge>
                    </Td>
                    <Td type="actions">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(row)}
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
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </TableRoot>
        </CardContent>

        {/* Pagination */}
        {!isLoading && !isError && (
          <TablePagination
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
          />
        )}
      </Card>
    </div>
  )
}
