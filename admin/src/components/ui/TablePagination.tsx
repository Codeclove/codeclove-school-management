import { Button } from './Button'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export interface TablePaginationProps {
  page: number
  perPage: number | 'all'
  total: number
  onPageChange: (page: number | ((prev: number) => number)) => void
  onPerPageChange?: (perPage: number | 'all') => void
  perPageOptions?: Array<number | 'all'>
  className?: string
}

export function TablePagination({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  perPageOptions = [10, 25, 50, 100, 'all'],
  className,
}: TablePaginationProps) {
  if (total <= 0) return null

  const isAll = perPage === 'all'
  const numericPerPage = isAll ? total : perPage
  const totalPages = Math.ceil(total / numericPerPage)
  const from = isAll ? 1 : Math.min((page - 1) * numericPerPage + 1, total)
  const to = isAll ? total : Math.min(page * numericPerPage, total)
  const canPrev = !isAll && page > 1
  const canNext = !isAll && page < totalPages
  // ponytail: hide when all records fit on one page and perPage is fixed
  if (total <= numericPerPage && !onPerPageChange) {
    return null
  }

  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border px-4 sm:px-6 py-4', className)}>
      <span className="text-xs text-text-muted">
        {sprintf(__('Showing %1$d to %2$d of %3$d records', 'codeclove-school-management'), from, to, total)}
      </span>
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
        {onPerPageChange && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span>{__('Rows:', 'codeclove-school-management')}</span>
            <select
              aria-label={__('Rows per page', 'codeclove-school-management')}
              value={perPage}
              onChange={(e) => {
                const val = e.target.value
                onPerPageChange(val === 'all' ? 'all' : Number(val))
                onPageChange(1)
              }}
              className="bg-bg-surface border border-border rounded px-2 py-1 text-text text-xs focus:outline-none focus:border-brand cursor-pointer"
            >
              {perPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'all' ? __('All', 'codeclove-school-management') : opt}
                </option>
              ))}
            </select>
          </div>
        )}
        {!isAll && totalPages > 1 && (
          <>
            <span className="text-xs text-text-muted font-medium">
              {sprintf(__('Page %1$d of %2$d', 'codeclove-school-management'), page, totalPages)}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => onPageChange(1)}
                disabled={!canPrev}
                aria-label={__('First page', 'codeclove-school-management')}
                title={__('First page', 'codeclove-school-management')}
              >
                <ChevronsLeft size={14} className="rtl:rotate-180" />
              </Button>
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => onPageChange(page - 1)}
                disabled={!canPrev}
                aria-label={__('Previous page', 'codeclove-school-management')}
                title={__('Previous page', 'codeclove-school-management')}
              >
                <ChevronLeft size={14} className="rtl:rotate-180" />
              </Button>
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => onPageChange(page + 1)}
                disabled={!canNext}
                aria-label={__('Next page', 'codeclove-school-management')}
                title={__('Next page', 'codeclove-school-management')}
              >
                <ChevronRight size={14} className="rtl:rotate-180" />
              </Button>
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => onPageChange(totalPages)}
                disabled={!canNext}
                aria-label={__('Last page', 'codeclove-school-management')}
                title={__('Last page', 'codeclove-school-management')}
              >
                <ChevronsRight size={14} className="rtl:rotate-180" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
