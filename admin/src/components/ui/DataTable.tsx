import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, type LucideIcon } from 'lucide-react'
import {
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableEmpty,
  TableSkeleton,
  type TableColumnType,
} from './Table'
import { TablePagination } from './TablePagination'
import { Card, CardContent } from './Card'
import { Button } from './Button'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'
import { cycleSort, type UseTableStateReturn } from '@/lib/useTableState'

// ─── Column Definition ───────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  type?: TableColumnType
  sortable?: boolean
  sortKey?: string
  align?: 'left' | 'center' | 'right'
  priority?: 'high' | 'medium' | 'low'
  className?: string
  render?: (row: T, index: number) => ReactNode
}

// ─── Component Props ─────────────────────────────────────────────────────────

export interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  table?: UseTableStateReturn<any>
  keyExtractor?: (row: T) => string | number
  isLoading?: boolean
  loading?: boolean
  isError?: boolean
  error?: unknown
  errorMessage?: string
  emptyMessage?: string
  onRetry?: () => void
  emptyState?: {
    message?: string
    description?: string
    icon?: LucideIcon
    action?: ReactNode
  }
  selectable?: boolean
  onRowClick?: (row: T) => void
  bulkActions?: ReactNode
  total?: number
  skeletonRows?: number
  cardWrapper?: boolean
  className?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCellValue<T>(row: T, key: string): ReactNode {
  if (!row || typeof row !== 'object') return null
  const obj = row as Record<string, unknown>
  if (key in obj) {
    const val = obj[key]
    if (val === null || val === undefined) return null
    return val as ReactNode
  }
  if (key.includes('.')) {
    const parts = key.split('.')
    let current: unknown = row
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return null
      }
      current = (current as Record<string, unknown>)[part]
    }
    if (current === null || current === undefined) return null
    return current as ReactNode
  }
  return null
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DataTable<T>({
  data = [],
  columns,
  table,
  keyExtractor,
  isLoading = false,
  loading,
  isError = false,
  error,
  errorMessage,
  emptyMessage,
  onRetry,
  emptyState,
  selectable = false,
  onRowClick,
  bulkActions,
  total,
  skeletonRows = 5,
  cardWrapper = true,
  className,
}: DataTableProps<T>) {
  const actualLoading = loading !== undefined ? loading : isLoading
  const actualIsError = error !== undefined ? Boolean(error) : isError
  const actualErrorMessage =
    errorMessage ??
    (typeof error === 'string'
      ? error
      : error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : undefined) ??
    emptyState?.message ??
    __('Failed to load data', 'codeclove-school-management')
  const actualEmptyMessage = emptyState?.message ?? emptyMessage ?? __('No records found.', 'codeclove-school-management')
  // ─── Sorting State (Client fallback when table is omitted) ────────────────
  const [clientOrderBy, setClientOrderBy] = useState<string>('')
  const [clientOrder, setClientOrder] = useState<'asc' | 'desc'>('asc')

  const handleClientSort = useCallback(
    (field: string) => {
      const next = cycleSort(clientOrderBy, clientOrder, field)
      setClientOrderBy(next.orderby)
      setClientOrder(next.order)
    },
    [clientOrderBy, clientOrder]
  )

  const sortedData = useMemo(() => {
    if (table || !clientOrderBy || !data || data.length === 0) {
      return data ?? []
    }
    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)?.[clientOrderBy]
      const bVal = (b as Record<string, unknown>)?.[clientOrderBy]
      if (aVal === bVal) return 0
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return clientOrder === 'asc' ? aVal - bVal : bVal - aVal
      }
      const strA = String(aVal).toLowerCase()
      const strB = String(bVal).toLowerCase()
      return clientOrder === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA)
    })
  }, [data, table, clientOrderBy, clientOrder])

  // ─── Keys & Selection ──────────────────────────────────────────────────────
  const getKey = useCallback(
    (row: T, index: number): string | number => {
      if (keyExtractor) return keyExtractor(row)
      const obj = row as { id?: string | number; key?: string | number }
      return obj?.id ?? obj?.key ?? index
    },
    [keyExtractor]
  )

  const rowIds = useMemo(() => {
    return sortedData.map((row, idx) => getKey(row, idx))
  }, [sortedData, getKey])

  const [clientSelectedIds, setClientSelectedIds] = useState<(string | number)[]>([])

  const selectedIds = useMemo(() => {
    if (table) return table.selectedIds
    return clientSelectedIds
  }, [table, clientSelectedIds])

  const isSelected = useCallback(
    (id: string | number) => {
      if (table) return table.isSelected(id)
      return clientSelectedIds.includes(id)
    },
    [table, clientSelectedIds]
  )

  const toggleSelect = useCallback(
    (id: string | number) => {
      if (table) {
        table.toggleSelect(id)
      } else {
        setClientSelectedIds((prev) =>
          prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        )
      }
    },
    [table]
  )

  const toggleSelectAll = useCallback(
    (ids: (string | number)[]) => {
      if (table) {
        table.toggleSelectAll(ids)
      } else {
        const allCurrentlySelected =
          ids.length > 0 && ids.every((id) => clientSelectedIds.includes(id))
        if (allCurrentlySelected) {
          setClientSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
        } else {
          setClientSelectedIds((prev) => {
            const unseen = ids.filter((id) => !prev.includes(id))
            return [...prev, ...unseen]
          })
        }
      }
    },
    [table, clientSelectedIds]
  )

  const clearSelection = useCallback(() => {
    if (table) {
      table.clearSelection()
    } else {
      setClientSelectedIds([])
    }
  }, [table])

  const allSelected = rowIds.length > 0 && rowIds.every((id) => isSelected(id))
  const someSelected = rowIds.some((id) => isSelected(id))
  const isIndeterminate = someSelected && !allSelected

  const headerCheckboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate
    }
  }, [isIndeterminate])

  const totalColumns = columns.length + (selectable ? 1 : 0)

  // ─── Table Content ─────────────────────────────────────────────────────────
  const content = (
    <>
      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 bg-brand-dim border-b border-border text-xs font-semibold text-brand animate-in fade-in duration-150"
          role="region"
          aria-label={__('Bulk actions', 'codeclove-school-management')}
        >
          <div className="flex items-center gap-2">
            <span>
              {sprintf(
                __('%1$d selected', 'codeclove-school-management'),
                selectedIds.length
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-6 px-2 text-xs text-text-subtle hover:text-text"
            >
              {__('Clear selection', 'codeclove-school-management')}
            </Button>
          </div>
          {bulkActions && (
            <div className="flex items-center gap-2 flex-wrap">
              {bulkActions}
            </div>
          )}
        </div>
      )}

      {/* Responsive Scroll Container */}
      <TableRoot responsiveMode="scroll">
        <Thead>
          <Tr>
            {selectable && (
              <Th className="w-10 px-3 py-3">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  aria-label={__('Select all rows', 'codeclove-school-management')}
                  checked={allSelected}
                  onChange={() => toggleSelectAll(rowIds)}
                  disabled={isLoading || isError || rowIds.length === 0}
                  className="rounded border-border text-brand focus:ring-brand focus:ring-offset-bg-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </Th>
            )}
            {columns.map((col) => {
              const sortKey = col.sortKey || col.key
              let sorted: 'asc' | 'desc' | false = false
              let onSort: (() => void) | undefined

              if (col.sortable) {
                if (table) {
                  const sortProps = table.getSortProps(sortKey)
                  sorted = sortProps.sorted
                  onSort = sortProps.onSort
                } else {
                  sorted = clientOrderBy === sortKey ? clientOrder : false
                  onSort = () => handleClientSort(sortKey)
                }
              }

              const effectiveAlign =
                col.align ??
                (col.type === 'number' || col.type === 'actions'
                  ? 'right'
                  : col.type === 'badge'
                  ? 'center'
                  : 'left')

              return (
                <Th
                  key={col.key}
                  type={col.type}
                  align={effectiveAlign}
                  priority={col.priority}
                  sortable={col.sortable}
                  sorted={sorted}
                  onSort={onSort}
                  className={col.className}
                >
                  {col.header}
                </Th>
              )
            })}
          </Tr>
        </Thead>

        <Tbody>
          {actualLoading ? (
            <TableSkeleton columns={totalColumns} rows={skeletonRows} />
          ) : actualIsError ? (
            <TableEmpty
              colSpan={totalColumns}
              icon={emptyState?.icon ?? AlertTriangle}
              message={
                actualErrorMessage ??
                emptyState?.message ??
                __('Failed to load data', 'codeclove-school-management')
              }
              description={
                emptyState?.description ??
                __('An error occurred while fetching records.', 'codeclove-school-management')
              }
              action={
                emptyState?.action ?? (
                  onRetry ? (
                    <Button size="sm" variant="secondary" onClick={onRetry}>
                      {__('Try again', 'codeclove-school-management')}
                    </Button>
                  ) : undefined
                )
              }
            />
          ) : sortedData.length === 0 ? (
            <TableEmpty
              colSpan={totalColumns}
              icon={emptyState?.icon}
              message={
                actualEmptyMessage ??
                __('No records found.', 'codeclove-school-management')
              }
              description={emptyState?.description}
              action={emptyState?.action}
            />
          ) : (
            sortedData.map((row, rowIndex) => {
              const rowId = getKey(row, rowIndex)
              const isRowSelected = selectable ? isSelected(rowId) : false

              return (
                <Tr
                  key={rowId}
                  className={cn(
                    isRowSelected && 'bg-brand-dim',
                    onRowClick && 'cursor-pointer hover:bg-hover-bg focus-visible:bg-hover-bg focus:outline-none'
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {selectable && (
                    <Td
                      className="w-10 px-3 py-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={__('Select row', 'codeclove-school-management')}
                        checked={isRowSelected}
                        onChange={() => toggleSelect(rowId)}
                        className="rounded border-border text-brand focus:ring-brand focus:ring-offset-bg-base cursor-pointer"
                      />
                    </Td>
                  )}
                  {columns.map((col) => {
                    const effectiveAlign =
                      col.align ??
                      (col.type === 'number' || col.type === 'actions'
                        ? 'right'
                        : col.type === 'badge'
                        ? 'center'
                        : 'left')
                    const isNumber = col.type === 'number' || effectiveAlign === 'right'

                    return (
                      <Td
                        key={col.key}
                        type={col.type}
                        align={effectiveAlign}
                        priority={col.priority}
                        className={cn(
                          isNumber && 'tabular-nums',
                          col.className
                        )}
                        onClick={
                          col.type === 'actions'
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                      >
                        {col.render
                          ? col.render(row, rowIndex)
                          : getCellValue(row, col.key)}
                      </Td>
                    )
                  })}
                </Tr>
              )
            })
          )}
        </Tbody>
      </TableRoot>

      {/* Pagination */}
      {!actualIsError && table && typeof total === 'number' && (
        <TablePagination
          page={table.page}
          perPage={table.perPage}
          total={total}
          onPageChange={table.paginationProps?.onPageChange ?? table.setPage}
          onPerPageChange={table.paginationProps?.onPerPageChange ?? table.setPerPage}
        />
      )}
    </>
  )

  if (cardWrapper) {
    return (
      <Card className={cn('shadow-card overflow-hidden', className)}>
        <CardContent className="p-0 overflow-hidden">
          {content}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-bg-elevated', className)}>
      {content}
    </div>
  )
}
