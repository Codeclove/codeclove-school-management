import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, AlertTriangle, FileText, Search, X } from 'lucide-react'
import { __, _n, sprintf } from '@/lib/i18n'
import { useDefaultersReport } from '@/api/finance'
import { useUnits } from '@/api/academics'
import { useFormatter } from '@/lib/formatter'
import { useSession } from '@/lib/session-context'
import { useLabels } from '@/lib/labels'
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
  FormField,
  Input,
  Select,
} from '@/components/ui'

export default function DefaultersReportPage() {
  const navigate = useNavigate()
  const { formatCurrency, formatDate } = useFormatter()
  const { session } = useSession()
  const { getLabel } = useLabels()
  const unitLabelSingular = getLabel('academic_unit', false, __('Class / Grade', 'codeclove-school-management'))
  const unitLabelPlural = getLabel('academic_unit', true, __('Classes', 'codeclove-school-management'))
  const invoiceLabel = getLabel('invoice', false, __('Invoice', 'codeclove-school-management'))
  const pageTitle = sprintf(__('%s Defaulters Report', 'codeclove-school-management'), invoiceLabel)
  const pageBreadcrumb = __('Defaulters Report', 'codeclove-school-management')
  const [unitId, setUnitId] = useState('all')
  const [search, setSearch] = useState('')
  const [daysOverdueMin, setDaysOverdueMin] = useState('30')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number | 'all'>(25)

  // Fetch Class Levels
  const { data: unitsData } = useUnits({
    session_id: session?.id,
    per_page: 100,
  })
  const units = unitsData?.data || []

  // Reset filters on session change
  useEffect(() => {
    setUnitId('all')
    setSearch('')
    setDaysOverdueMin('30')
    setPage(1)
  }, [session?.id])

  // Queries
  const { data: reportData, isLoading, isError, refetch } = useDefaultersReport({
    academic_session_id: session?.id,
    academic_unit_id: unitId && unitId !== 'all' ? Number(unitId) : undefined,
    days_overdue_min: daysOverdueMin ? Number(daysOverdueMin) : undefined,
    search: search || undefined,
    page,
    per_page: perPage === 'all' ? -1 : perPage,
  })

  const list = reportData?.data || []
  const total = reportData?.total || 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        description={__('List of students with outstanding unpaid or partially paid overdue invoices.', 'codeclove-school-management')}
        breadcrumbs={[
          { label: __('Finance', 'codeclove-school-management') },
          { label: __('Dashboard', 'codeclove-school-management'), href: '/finance' },
          { label: pageBreadcrumb },
        ]}
        onBack={() => navigate('/finance')}
      />

      {/* Filters Card */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <FormField label={__('Search Students', 'codeclove-school-management')}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    type="text"
                    placeholder={__('Search by student name, number, or invoice #...', 'codeclove-school-management')}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
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
                    setPage(1)
                  }}
                  placeholder={sprintf(__('All %s', 'codeclove-school-management'), unitLabelPlural.toLowerCase())}
                  options={[
                    { value: 'all', label: sprintf(__('All %s', 'codeclove-school-management'), unitLabelPlural.toLowerCase()) },
                    ...units.map((u) => ({ value: String(u.id), label: u.name })),
                  ]}
                />
              </FormField>
            </div>
            <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
              <FormField label={__('Minimum Days Overdue', 'codeclove-school-management')}>
                <Input
                  type="number"
                  min="0"
                  value={daysOverdueMin}
                  onChange={(e) => {
                    setDaysOverdueMin(e.target.value)
                    setPage(1)
                  }}
                  placeholder={__('e.g. 30', 'codeclove-school-management')}
                />
              </FormField>
            </div>

            <div className="flex items-center gap-2 h-9">
              {(search || unitId || daysOverdueMin !== '30') && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch('')
                    setUnitId('')
                    setDaysOverdueMin('30')
                    setPage(1)
                  }}
                  className="text-xs text-text-muted hover:text-text gap-1"
                >
                  <X size={12} />
                  {__('Clear Filters', 'codeclove-school-management')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Report Table Card */}
      <Card>
        <CardContent className="p-0">
          <TableRoot>
            <Thead>
              <Tr>
                <Th type="primary">{__('Student Name', 'codeclove-school-management')}</Th>
                <Th>{unitLabelSingular}</Th>
                <Th type="code">{__('Invoice #', 'codeclove-school-management')}</Th>
                <Th type="date">{__('Due Date', 'codeclove-school-management')}</Th>
                <Th type="number">{__('Days Overdue', 'codeclove-school-management')}</Th>
                <Th type="number">{__('Total Billed', 'codeclove-school-management')}</Th>
                <Th type="number">{__('Outstanding Balance', 'codeclove-school-management')}</Th>
                <Th type="actions">{__('Actions', 'codeclove-school-management')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <TableSkeleton columns={8} rows={5} />
              ) : isError ? (
                <TableEmpty
                  colSpan={8}
                  message={__('Error Loading Report', 'codeclove-school-management')}
                  description={__("We couldn't load the fee defaulters report dataset. Please try again.", 'codeclove-school-management')}
                  icon={AlertTriangle}
                  action={<Button size="sm" onClick={() => refetch()}>{__('Retry', 'codeclove-school-management')}</Button>}
                />
              ) : list.length === 0 ? (
                <TableEmpty
                  colSpan={8}
                  message={__('No Defaulters Found', 'codeclove-school-management')}
                  description={__('Hooray! No student matches the defaulter criteria for this academic session.', 'codeclove-school-management')}
                  icon={FileText}
                />
              ) : (
                list.map((row) => (
                  <Tr
                    key={row.invoice_id}
                    onClick={() => navigate(`/finance/invoices/${row.invoice_id}`)}
                    className="cursor-pointer hover:bg-bg-base/20 transition-colors"
                  >
                    <Td type="primary">
                      {row.student_first_name} {row.student_last_name}
                      <div className="text-2xs text-text-muted font-mono">{row.student_number}</div>
                    </Td>
                    <Td>{row.academic_unit_name || 'N/A'}</Td>
                    <Td type="code">{row.invoice_number}</Td>
                    <Td type="date">{formatDate(row.due_date)}</Td>
                    <Td type="number" className="text-danger">
                      {sprintf(_n('%d day', '%d days', row.days_overdue, 'codeclove-school-management'), row.days_overdue)}
                    </Td>
                    <Td type="number">{formatCurrency(row.total_minor)}</Td>
                    <Td type="number" className="text-danger">{formatCurrency(row.balance_minor)}</Td>
                    <Td type="actions" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate('/finance/invoices/' + row.invoice_id)}
                          className="h-8 w-8 text-text-subtle hover:text-brand"
                          title={__('View Invoice Details', 'codeclove-school-management')}
                        >
                          <Eye size={14} />
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
