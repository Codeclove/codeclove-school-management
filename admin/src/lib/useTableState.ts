import { useState, useCallback, useMemo } from 'react'

export interface UseTableStateOptions {
  defaultPage?: number
  defaultPerPage?: number | 'all'
  defaultOrderBy?: string
  defaultOrder?: 'asc' | 'desc'
}

export interface TableQueryParams {
  page: number
  per_page: number
  orderby: string | undefined
  order_by: string | undefined
  order: 'asc' | 'desc' | undefined
}

export interface UseTableStateReturn<T = number> {
  /** Query params ready to spread directly into any useQuery hook */
  params: TableQueryParams
  // Pagination
  page: number
  setPage: React.Dispatch<React.SetStateAction<number>>
  perPage: number | 'all'
  setPerPage: React.Dispatch<React.SetStateAction<number | 'all'>>
  resetPage: () => void
  paginationProps: {
    page: number
    perPage: number | 'all'
    onPageChange: React.Dispatch<React.SetStateAction<number>>
    onPerPageChange: (newPerPage: number | 'all') => void
  }
  // Sorting
  orderby: string
  order: 'asc' | 'desc'
  handleSort: (field: string) => void
  getSortProps: (field: string) => {
    sortable: true
    sorted: 'asc' | 'desc' | false
    onSort: () => void
  }
  // Selection
  selectedIds: T[]
  setSelectedIds: React.Dispatch<React.SetStateAction<T[]>>
  toggleSelect: (id: T) => void
  toggleSelectAll: (allIds: T[]) => void
  isSelected: (id: T) => boolean
  isAllSelected: (allIds: T[]) => boolean
  clearSelection: () => void
}

/**
 * Pure helper to compute next sorting state.
 */
export function cycleSort(
  currentOrderBy: string,
  currentOrder: 'asc' | 'desc',
  field: string
): { orderby: string; order: 'asc' | 'desc' } {
  if (currentOrderBy === field) {
    return currentOrder === 'asc'
      ? { orderby: field, order: 'desc' }
      : { orderby: '', order: 'asc' }
  }
  return { orderby: field, order: 'asc' }
}

/**
 * Pure helper to compute API query parameters from table state.
 */
export function computeQueryParams(
  page: number,
  perPage: number | 'all',
  orderby: string,
  order: 'asc' | 'desc'
): TableQueryParams {
  const effectiveOrderBy = orderby || undefined
  return {
    page,
    per_page: perPage === 'all' ? -1 : perPage,
    orderby: effectiveOrderBy,
    order_by: effectiveOrderBy,
    order: effectiveOrderBy ? order : undefined,
  }
}

/**
 * Pure helper to toggle a single ID in a selection array.
 */
export function toggleIdInList<T>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

/**
 * Pure helper to toggle all IDs in a selection array.
 */
export function toggleAllIdsInList<T>(current: T[], all: T[]): T[] {
  const allSelected = all.length > 0 && all.every((id) => current.includes(id))
  return allSelected
    ? current.filter((id) => !all.includes(id))
    : [...new Set([...current, ...all])]
}

/**
 * useTableState — Headless state manager for server-queried data tables.
 */
export function useTableState<T = number>(
  options: UseTableStateOptions = {}
): UseTableStateReturn<T> {
  const {
    defaultPage = 1,
    defaultPerPage = 10,
    defaultOrderBy = '',
    defaultOrder = 'asc',
  } = options

  // ─── Pagination State ──────────────────────────────────────────────────────────
  const [page, setPage] = useState<number>(defaultPage)
  const [perPage, setPerPage] = useState<number | 'all'>(defaultPerPage)

  const resetPage = useCallback(() => {
    setPage(1)
  }, [])

  // ─── Sorting State ─────────────────────────────────────────────────────────────
  const [orderby, setOrderby] = useState<string>(defaultOrderBy)
  const [order, setOrder] = useState<'asc' | 'desc'>(defaultOrder)

  const handleSort = useCallback(
    (field: string) => {
      const next = cycleSort(orderby, order, field)
      setOrderby(next.orderby)
      setOrder(next.order)
      setPage(1)
    },
    [orderby, order]
  )

  const getSortProps = useCallback(
    (field: string) => ({
      sortable: true as const,
      sorted: orderby === field ? order : (false as const),
      onSort: () => handleSort(field),
    }),
    [orderby, order, handleSort]
  )

  // ─── Selection State ───────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<T[]>([])

  const toggleSelect = useCallback((id: T) => {
    setSelectedIds((prev) => toggleIdInList(prev, id))
  }, [])

  const toggleSelectAll = useCallback((allIds: T[]) => {
    setSelectedIds((prev) => toggleAllIdsInList(prev, allIds))
  }, [])

  const isSelected = useCallback(
    (id: T) => selectedIds.includes(id),
    [selectedIds]
  )

  const isAllSelected = useCallback(
    (allIds: T[]) => allIds.length > 0 && allIds.every((id) => selectedIds.includes(id)),
    [selectedIds]
  )

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

  // ─── Query Params (memoized) ───────────────────────────────────────────────────
  const params: TableQueryParams = useMemo(
    () => computeQueryParams(page, perPage, orderby, order),
    [page, perPage, orderby, order]
  )

  // ─── TablePagination Props (memoized) ──────────────────────────────────────────
  const paginationProps = useMemo(
    () => ({
      page,
      perPage,
      onPageChange: setPage,
      onPerPageChange: (newPerPage: number | 'all') => {
        setPerPage(newPerPage)
        setPage(1)
      },
    }),
    [page, perPage]
  )

  return {
    params,
    page,
    setPage,
    perPage,
    setPerPage,
    resetPage,
    paginationProps,
    orderby,
    order,
    handleSort,
    getSortProps,
    selectedIds,
    setSelectedIds,
    toggleSelect,
    toggleSelectAll,
    isSelected,
    isAllSelected,
    clearSelection,
  }
}
