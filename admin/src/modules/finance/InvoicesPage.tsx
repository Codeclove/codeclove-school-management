import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, X, Printer, SlidersHorizontal, Wallet, CheckCircle2, AlertCircle } from 'lucide-react'
import { __, sprintf } from '@/lib/i18n'
import { getStatusVariant } from './finance-utils'
import {
  useInvoices,
  useDeleteInvoice,
  useBulkInvoicesAction,
  type Invoice,
} from '@/api/finance'
import { useUnits, useTerms } from '@/api/academics'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { useLabels } from '@/lib/labels'
import { useFormatter } from '@/lib/formatter'
import { useSession } from '@/lib/session-context'
import { useSettings } from '@/api/settings'
import { useEntity } from '@/lib/useEntity'
import { api } from '@/lib/api-client'
import { printElement } from '@/lib/print'
import PrintInvoiceSheet from './PrintInvoiceSheet'
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
import {
  Button,
  PageHeader,
  Spinner,
  DataTable,
  type DataTableColumn,
  Card,
  Badge,
  FormField,
  Input,
  Select,
  DatePicker,
  PersonAvatar,
  StatCard,
  Modal,
  ModalFooter,
} from '@/components/ui'

export default function InvoicesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const entity = useEntity('invoice')
  const invoiceLabel = entity.singular
  const invoiceLabelPlural = entity.plural
  const { getLabel } = useLabels()
  const { formatCurrency, formatDate } = useFormatter()
  const { session } = useSession()
  const { data: settingsData } = useSettings()

  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null)
  const [isPrintLoading, setIsPrintLoading] = useState<number | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (printingInvoice && printRef.current) {
      printElement(printRef.current)
      setPrintingInvoice(null)
    }
  }, [printingInvoice])

  const handlePrintInvoice = async (invoiceId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setIsPrintLoading(invoiceId)
    try {
      const res = await api.get<Invoice>('invoices/' + invoiceId)
      setPrintingInvoice(res.data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      toast.error(message || __('Failed to fetch invoice details for printing.', 'codeclove-school-management'))
    } finally {
      setIsPrintLoading(null)
    }
  }

  const table = useTableState({
    defaultPerPage: 25,
    defaultOrderBy: 'created_at',
    defaultOrder: 'desc',
  })
  const { selectedIds, clearSelection } = table
  const [discountModalOpen, setDiscountModalOpen] = useState(false)
  const [discountAmount, setDiscountAmount] = useState('')
  const [discountNote, setDiscountNote] = useState('')
  const [printingInvoices, setPrintingInvoices] = useState<Invoice[] | null>(null)
  const [isBulkPrintLoading, setIsBulkPrintLoading] = useState(false)

  const bulkActionMutation = useBulkInvoicesAction()

  useEffect(() => {
    if (printingInvoices && printRef.current) {
      printElement(printRef.current)
      setPrintingInvoices(null)
    }
  }, [printingInvoices])

  const handleBulkPrintInvoices = async () => {
    setIsBulkPrintLoading(true)
    try {
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          const res = await api.get<Invoice>('invoices/' + id)
          return res.data
        })
      )
      setPrintingInvoices(results)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      toast.error(message || __('Failed to fetch invoice details for printing.', 'codeclove-school-management'))
    } finally {
      setIsBulkPrintLoading(false)
    }
  }

  const handleBulkSendReminders = () => {
    bulkActionMutation.mutate(
      { action: 'send_reminders', ids: selectedIds },
      {
        onSuccess: (res) => {
          clearSelection()
          toast.success(sprintf(__('Successfully sent reminders for selected %s!', 'codeclove-school-management'), invoiceLabelPlural.toLowerCase()))
          if (res.errors && res.errors.length > 0) {
            toast.error(sprintf(__('Some reminders failed to send: %s', 'codeclove-school-management'), res.errors.join('; ')))
          }
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : ''
          toast.error(message || __('Failed to send bulk reminders.', 'codeclove-school-management'))
        }
      }
    )
  }

  const handleBulkCancel = async () => {
    const isConfirmed = await confirm({
      title: sprintf(__('Bulk Cancel %s', 'codeclove-school-management'), invoiceLabelPlural),
      message: sprintf(__('Are you sure you want to cancel the %1$d selected %2$s?', 'codeclove-school-management'), selectedIds.length, invoiceLabelPlural.toLowerCase()),
      variant: 'warning',
      confirmText: __('Cancel Invoices', 'codeclove-school-management')
    })
    if (!isConfirmed) return

    bulkActionMutation.mutate(
      { action: 'cancel', ids: selectedIds },
      {
        onSuccess: (res) => {
          clearSelection()
          toast.success(sprintf(__('Successfully cancelled selected %s!', 'codeclove-school-management'), invoiceLabelPlural.toLowerCase()))
          if (res.errors && res.errors.length > 0) {
            toast.error(sprintf(__('Some invoices could not be cancelled: %s', 'codeclove-school-management'), res.errors.join('; ')))
          }
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : ''
          toast.error(message || __('Failed to bulk cancel invoices.', 'codeclove-school-management'))
        }
      }
    )
  }

  const handleBulkVoid = async () => {
    const isConfirmed = await confirm({
      title: sprintf(__('Bulk Void %s', 'codeclove-school-management'), invoiceLabelPlural),
      message: sprintf(__('Are you sure you want to void the %1$d selected %2$s?', 'codeclove-school-management'), selectedIds.length, invoiceLabelPlural.toLowerCase()),
      confirmText: __('Void Invoices', 'codeclove-school-management')
    })
    if (!isConfirmed) return

    bulkActionMutation.mutate(
      { action: 'void', ids: selectedIds },
      {
        onSuccess: (res) => {
          clearSelection()
          toast.success(sprintf(__('Successfully voided selected %s!', 'codeclove-school-management'), invoiceLabelPlural.toLowerCase()))
          if (res.errors && res.errors.length > 0) {
            toast.error(sprintf(__('Some invoices could not be voided: %s', 'codeclove-school-management'), res.errors.join('; ')))
          }
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : ''
          toast.error(message || __('Failed to bulk void invoices.', 'codeclove-school-management'))
        }
      }
    )
  }

  const handleBulkDiscountSubmit = () => {
    const minorAmount = Math.round(parseFloat(discountAmount) * 100)
    if (isNaN(minorAmount) || minorAmount < 0) {
      toast.error(__('Please enter a valid concession amount.', 'codeclove-school-management'))
      return
    }
    bulkActionMutation.mutate(
      {
        action: 'discount',
        ids: selectedIds,
        discount_minor: minorAmount,
        discount_note: discountNote,
      },
      {
        onSuccess: (res) => {
          clearSelection()
          setDiscountModalOpen(false)
          setDiscountAmount('')
          setDiscountNote('')
          toast.success(__('Successfully applied concessions to selected invoices!', 'codeclove-school-management'))
          if (res.errors && res.errors.length > 0) {
            toast.error(sprintf(__('Some concessions could not be applied: %s', 'codeclove-school-management'), res.errors.join('; ')))
          }
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : ''
          toast.error(message || __('Failed to apply concessions.', 'codeclove-school-management'))
        }
      }
    )
  }

  const studentLabel = getLabel('student', false, __('Student', 'codeclove-school-management'))
  const unitLabelSingular = getLabel('academic_unit', false, __('Class Level', 'codeclove-school-management'))
  const unitLabelPlural = getLabel('academic_unit', true, __('Classes', 'codeclove-school-management'))
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [status, setStatus] = useState('')
  const [unitId, setUnitId] = useState('')
  const [termId, setTermId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dateType, setDateType] = useState<'issue_date' | 'due_date'>('issue_date')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Fetch Class Levels
  const { data: unitsData } = useUnits({
    session_id: session?.id,
    per_page: 100,
  })
  const units = unitsData?.data || []

  // Fetch Academic Terms
  const { data: termsData } = useTerms(Number(session?.id ?? 0))
  const terms = termsData || []

  // Reset filters on session change
  useEffect(() => {
    setUnitId('')
    setTermId('')
    setStartDate('')
    setEndDate('')
    setDateType('issue_date')
    table.resetPage()
    clearSelection()
  }, [session?.id, table.resetPage, clearSelection])

  // Clear selection when debounced search changes
  useEffect(() => {
    clearSelection()
  }, [debouncedSearch, clearSelection])

  // Show advanced if start or end date is set initially
  useEffect(() => {
    if (startDate || endDate) {
      setShowAdvanced(true)
    }
  }, [])

  // Queries
  const { data: invoicesData, isLoading, isError, refetch } = useInvoices({
    academic_session_id: session?.id,
    academic_unit_id: unitId ? Number(unitId) : undefined,
    academic_term_id: termId ? Number(termId) : undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    date_type: (startDate || endDate) ? dateType : undefined,
    search: debouncedSearch,
    status,
    ...table.params,
  })
  const deleteInvoiceMutation = useDeleteInvoice()
  const list = invoicesData?.data || []
  const total = invoicesData?.pagination?.total || 0

  // Reset selection on data change
  useEffect(() => {
    clearSelection()
  }, [invoicesData, clearSelection])

  const metrics = useMemo(() => {
    let totalInvoiced = 0
    let totalCollected = 0
    let totalOverdue = 0

    list.forEach((inv) => {
      const net = (inv.total_minor ?? 0) / 100
      const paid = (inv.paid_minor ?? 0) / 100
      const bal = (inv.balance_minor ?? (inv.total_minor - inv.paid_minor)) / 100
      totalInvoiced += net
      totalCollected += paid
      if (inv.status === 'overdue' || (inv.status === 'issued' && inv.due_date && new Date(inv.due_date) < new Date())) {
        totalOverdue += bal
      }
    })

    return { totalInvoiced, totalCollected, totalOverdue }
  }, [list])

  const handleOpenAdd = () => navigate('/finance/invoices/new')

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const isConfirmed = await confirm({
      title: sprintf(__('Void/Cancel %s', 'codeclove-school-management'), invoiceLabel),
      message: sprintf(__('Are you sure you want to void/cancel this %s?', 'codeclove-school-management'), invoiceLabel.toLowerCase()),
      confirmText: __('Void/Cancel', 'codeclove-school-management')
    })
    if (!isConfirmed) return

    deleteInvoiceMutation.mutate(id, {
      onSuccess: () => {
        toast.success(sprintf(__('%s cancelled/voided.', 'codeclove-school-management'), invoiceLabel))
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : ''
        toast.error(message || sprintf(__('Failed to void %s', 'codeclove-school-management'), invoiceLabel.toLowerCase()))
      }
    })
  }
  // Clear selection when filters change
  useEffect(() => {
    clearSelection()
  }, [unitId, termId, status, startDate, endDate, dateType, clearSelection])

  const columns: DataTableColumn<Invoice>[] = useMemo(
    () => [
      {
        key: 'invoice_number',
        header: __('Invoice #', 'codeclove-school-management'),
        type: 'code',
        sortable: true,
        render: (row) => row.invoice_number,
      },
      {
        key: 'student_name',
        header: studentLabel,
        type: 'primary',
        sortable: true,
        render: (row) => (
          <PersonAvatar
            name={`${row.student_first_name} ${row.student_last_name}`}
            subtitle={row.student_number || undefined}
          />
        ),
      },
      {
        key: 'due_date',
        header: __('Due Date', 'codeclove-school-management'),
        type: 'date',
        sortable: true,
        render: (row) => formatDate(row.due_date),
      },
      {
        key: 'total',
        header: __('Total', 'codeclove-school-management'),
        type: 'number',
        sortable: true,
        render: (row) => formatCurrency(row.total_minor),
      },
      {
        key: 'balance',
        header: __('Balance', 'codeclove-school-management'),
        type: 'number',
        sortable: true,
        render: (row) => (
          <span className={row.balance_minor > 0 ? 'text-danger' : 'text-text-muted'}>
            {formatCurrency(row.balance_minor)}
          </span>
        ),
      },
      {
        key: 'status',
        header: __('Status', 'codeclove-school-management'),
        type: 'badge',
        render: (row) => (
          <Badge variant={getStatusVariant(row.status)}>
            {row.status.replace('_', ' ')}
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
              onClick={(e) => handlePrintInvoice(row.id, e)}
              disabled={isPrintLoading === row.id}
              className="h-8 w-8 text-text-subtle hover:text-brand"
              title={__('Print Invoice', 'codeclove-school-management')}
            >
              {isPrintLoading === row.id ? (
                <Spinner size="xs" />
              ) : (
                <Printer size={14} />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => handleDelete(row.id, e)}
              disabled={deleteInvoiceMutation.isPending}
              className="h-8 w-8 text-text-subtle hover:text-danger"
              title={__('Cancel/Void Invoice', 'codeclove-school-management')}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [studentLabel, formatDate, formatCurrency, isPrintLoading, deleteInvoiceMutation.isPending]
  )

  const bulkActions = useMemo(
    () => (
      <>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleBulkPrintInvoices}
          disabled={isBulkPrintLoading}
          className="h-7 text-xs"
        >
          {isBulkPrintLoading ? <Spinner size="xs" /> : <Printer size={12} className="mr-1" />}
          {__('Print Selected', 'codeclove-school-management')}
        </Button>
        <Select
          value=""
          onValueChange={(val) => {
            if (val === 'cancel') {
              handleBulkCancel()
            } else if (val === 'void') {
              handleBulkVoid()
            } else if (val === 'send_reminders') {
              handleBulkSendReminders()
            } else if (val === 'discount') {
              setDiscountModalOpen(true)
            }
          }}
          placeholder={__('Bulk Actions', 'codeclove-school-management')}
          options={[
            { value: '', label: __('Bulk Actions', 'codeclove-school-management') },
            { value: 'send_reminders', label: __('Send Reminders', 'codeclove-school-management') },
            { value: 'discount', label: __('Apply Concession / Waiver', 'codeclove-school-management') },
            { value: 'cancel', label: __('Cancel Selected', 'codeclove-school-management') },
            { value: 'void', label: __('Void Selected', 'codeclove-school-management') },
          ]}
          className="h-7 text-xs w-full sm:w-48 bg-bg-surface border border-border"
        />
      </>
    ),
    [isBulkPrintLoading, selectedIds]
  )
  return (
    <div className="space-y-6">
      <PageHeader
        title={invoiceLabelPlural}
        description={__('Manage and track outstanding billing balances, fee invoices, and collections for the session.', 'codeclove-school-management')}
        breadcrumbs={[{ label: __('Finance', 'codeclove-school-management') }, { label: invoiceLabelPlural }]}
        actions={
          <Button size="sm" onClick={handleOpenAdd} className="flex items-center gap-1.5 font-semibold text-xs h-9" disabled={!session}>
            <Plus className="h-4 w-4" />
            {sprintf(__('Create %s', 'codeclove-school-management'), invoiceLabel)}
          </Button>
        }
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={__('Total Invoiced', 'codeclove-school-management')}
          value={formatCurrency(metrics.totalInvoiced)}
          icon={Wallet}
          iconColor="text-brand"
          iconBg="bg-brand-dim"
          compact={true}
        />
        <StatCard
          label={__('Total Collected', 'codeclove-school-management')}
          value={formatCurrency(metrics.totalCollected)}
          icon={CheckCircle2}
          iconColor="text-success"
          iconBg="bg-success-dim"
          compact={true}
        />
        <StatCard
          label={__('Overdue Balance', 'codeclove-school-management')}
          value={formatCurrency(metrics.totalOverdue)}
          icon={AlertCircle}
          iconColor="text-warning"
          iconBg="bg-warning-dim"
          compact={true}
        />
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          {/* Main Filters */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <FormField label={sprintf(__('Search %s', 'codeclove-school-management'), invoiceLabelPlural)}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <Input
                    type="text"
                    placeholder={__('Search by invoice #, student name, or guardian...', 'codeclove-school-management')}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      table.resetPage()
                      clearSelection()
                    }}
                    className="pl-9"
                  />
                </div>
              </FormField>
            </div>
            <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
              <FormField label={unitLabelSingular}>
                <Select
                  value={unitId}
                  onValueChange={(val) => {
                    setUnitId(val)
                    table.resetPage()
                    clearSelection()
                  }}
                  placeholder={sprintf(__('All %s', 'codeclove-school-management'), unitLabelPlural.toLowerCase())}
                  options={[
                    { value: '', label: sprintf(__('All %s', 'codeclove-school-management'), unitLabelPlural.toLowerCase()) },
                    ...units.map(u => ({ value: String(u.id), label: u.name }))
                  ]}
                />
              </FormField>
            </div>
            <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
              <FormField label={__('Academic Term', 'codeclove-school-management')}>
                <Select
                  value={termId}
                  onValueChange={(val) => {
                    setTermId(val)
                    table.resetPage()
                    clearSelection()
                  }}
                  placeholder={__('All Terms', 'codeclove-school-management')}
                  options={[
                    { value: '', label: __('All Terms', 'codeclove-school-management') },
                    ...terms.map(t => ({ value: String(t.id), label: t.name }))
                  ]}
                />
              </FormField>
            </div>
            <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
              <FormField label={__('Status', 'codeclove-school-management')}>
                <Select
                  value={status}
                  onValueChange={(val) => {
                    setStatus(val)
                    table.resetPage()
                    clearSelection()
                  }}
                  placeholder={__('All Statuses', 'codeclove-school-management')}
                  options={[
                    { value: '', label: __('All Statuses', 'codeclove-school-management') },
                    { value: 'unpaid', label: __('Unpaid (Outstanding)', 'codeclove-school-management') },
                    { value: 'paid', label: __('Paid', 'codeclove-school-management') },
                    { value: 'overdue', label: __('Overdue', 'codeclove-school-management') },
                    { value: 'draft', label: __('Draft', 'codeclove-school-management') },
                    { value: 'cancelled', label: __('Cancelled', 'codeclove-school-management') },
                    { value: 'void', label: __('Void', 'codeclove-school-management') },
                  ]}
                />
              </FormField>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 h-9">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`text-xs gap-1.5 h-9 ${showAdvanced ? 'bg-bg-surface text-brand border border-border' : 'text-text-muted hover:text-text'}`}
              >
                <SlidersHorizontal size={12} />
                {showAdvanced ? __('Hide Dates', 'codeclove-school-management') : __('Date Range', 'codeclove-school-management')}
              </Button>
              {(search || status || unitId || termId || startDate || endDate) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch('')
                    setStatus('')
                    setUnitId('')
                    setTermId('')
                    setStartDate('')
                    setEndDate('')
                    setDateType('issue_date')
                    table.resetPage()
                    clearSelection()
                  }}
                  className="text-xs text-text-muted hover:text-text gap-1"
                >
                  <X size={12} />
                  {__('Clear Filters', 'codeclove-school-management')}
                </Button>
              )}
            </div>
          </div>

          {/* Date Range Filters */}
          {showAdvanced && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3 border-t border-border pt-3 animate-in fade-in duration-200">
              <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
                <FormField label={__('Start Date', 'codeclove-school-management')}>
                  <DatePicker
                    value={startDate}
                    onChange={(val) => {
                      setStartDate(val)
                      table.resetPage()
                      clearSelection()
                    }}
                  />
                </FormField>
              </div>
              <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
                <FormField label={__('End Date', 'codeclove-school-management')}>
                  <DatePicker
                    value={endDate}
                    onChange={(val) => {
                      setEndDate(val)
                      table.resetPage()
                      clearSelection()
                    }}
                  />
                </FormField>
              </div>
              
              {(startDate || endDate) && (
                <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px] animate-in fade-in slide-in-from-top-1 duration-150">
                  <FormField label={__('Filter Date Field', 'codeclove-school-management')}>
                    <Select
                      value={dateType}
                      onValueChange={(val) => {
                        setDateType(val as 'issue_date' | 'due_date')
                        table.resetPage()
                        clearSelection()
                      }}
                      options={[
                        { value: 'issue_date', label: __('Issue Date', 'codeclove-school-management') },
                        { value: 'due_date', label: __('Due Date', 'codeclove-school-management') },
                      ]}
                    />
                  </FormField>
                </div>
              )}

            </div>
          )}
        </div>
      </Card>

      {/* Main List */}
      <DataTable<Invoice>
        data={list}
        columns={columns}
        table={table}
        total={total}
        isLoading={isLoading}
        isError={isError}
        errorMessage={__('Error Loading Invoices', 'codeclove-school-management')}
        onRetry={() => refetch()}
        selectable
        bulkActions={bulkActions}
        onRowClick={(row) => navigate(`/finance/invoices/${row.id}`)}
        keyExtractor={(row) => row.id}
        emptyState={{
          message: sprintf(__('No %s found', 'codeclove-school-management'), invoiceLabelPlural),
          description: session
            ? __('Get started by creating your first student invoice.', 'codeclove-school-management')
            : __('Please select an academic session to manage invoices.', 'codeclove-school-management'),
          icon: entity.icon,
          action:
            session ? (
              <Button size="sm" onClick={handleOpenAdd}>
                {sprintf(__('Create %s', 'codeclove-school-management'), invoiceLabel)}
              </Button>
            ) : undefined,
        }}
      />

      {/* Hidden print container */}
      {printingInvoice && (
        <div style={{ visibility: 'hidden', position: 'fixed', top: 0, left: 0, pointerEvents: 'none' }}>
          <div ref={printRef}>
            <PrintInvoiceSheet
              invoice={printingInvoice}
              school={settingsData?.school}
            />
          </div>
        </div>
      )}

      {/* Hidden print container for multiple invoices */}
      {printingInvoices && (
        <div style={{ visibility: 'hidden', position: 'fixed', top: 0, left: 0, pointerEvents: 'none' }}>
          <div ref={printRef}>
            {printingInvoices.map((inv, idx) => (
              <div
                key={inv.id}
                className={idx < printingInvoices.length - 1 ? 'print-page-break' : ''}
                style={{
                  display: 'block',
                  pageBreakAfter: idx < printingInvoices.length - 1 ? 'always' : 'auto',
                  breakAfter: idx < printingInvoices.length - 1 ? 'page' : 'auto',
                }}
              >
                <PrintInvoiceSheet
                  invoice={inv}
                  school={settingsData?.school}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discount Concession Modal */}
      <Modal
        open={discountModalOpen}
        onOpenChange={setDiscountModalOpen}
        title={__('Apply Concession / Waiver', 'codeclove-school-management')}
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-text-muted">
            {sprintf(__('Apply a batch discount / concession to the %d selected invoices. This will reduce the payable amount and recalculate their outstanding balance.', 'codeclove-school-management'), selectedIds.length)}
          </p>
          <FormField label={__('Concession Amount (e.g. 50.00)', 'codeclove-school-management')}>
            <Input
              type="number"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono text-sm"
            />
          </FormField>
          <FormField label={__('Reason / Note', 'codeclove-school-management')}>
            <Input
              value={discountNote}
              onChange={(e) => setDiscountNote(e.target.value)}
              placeholder={__('Scholarship, sibling discount, waiver, etc.', 'codeclove-school-management')}
            />
          </FormField>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDiscountModalOpen(false)}>
            {__('Cancel', 'codeclove-school-management')}
          </Button>
          <Button onClick={handleBulkDiscountSubmit} disabled={bulkActionMutation.isPending}>
            {__('Apply Concession', 'codeclove-school-management')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
