/**
 * FilterBar — Tier 2 reusable composite filter toolbar for CodeClove admin pages.
 *
 * Provides:
 *   - Search input with clear button (X icon) when text is entered.
 *   - Slot for filter controls (Selects, DatePickers, custom dropdowns).
 *   - Active filter count badge with "Clear Filters" ghost button.
 *   - Actions slot for secondary actions (Export CSV, Refresh, Date Range toggle).
 *   - Responsive layout: search + filters wrap cleanly on desktop and stack cleanly on mobile.
 *   - Surfaces and tokens strictly adhering to CodeClove design system (Card Layer 1, Input Layer 2).
 */

import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { __, sprintf } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Card } from './Card'
import { Input } from './Input'
import { Button } from './Button'
import { Badge } from './Badge'

export interface FilterBarProps {
  /** Current value of the search input */
  search?: string
  /** Callback fired when search text changes or is cleared */
  onSearchChange?: (value: string) => void
  /** Placeholder text for search input. Defaults to __('Search...', 'codeclove-school-management') */
  searchPlaceholder?: string
  /** Filter selects, date pickers, or secondary control elements */
  children?: ReactNode
  /** Count of currently active filters. Badge renders when count > 0 */
  activeFilterCount?: number
  /** Callback fired when user clicks "Clear Filters" button */
  onClearAll?: () => void
  /** Explicit control over showing the Clear Filters button. Defaults to true when filters or search are active */
  showClear?: boolean
  /** Secondary action buttons (e.g. Export CSV, Refresh, Toggle Advanced Filters) */
  actions?: ReactNode
  /** Additional CSS class names for the outer container */
  className?: string
  /** Whether to render inside a Card container. Defaults to true */
  cardWrapper?: boolean
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  children,
  activeFilterCount,
  onClearAll,
  showClear,
  actions,
  className,
  cardWrapper = true,
}: FilterBarProps) {
  const hasSearch = search !== undefined || onSearchChange !== undefined
  const hasActiveCount = typeof activeFilterCount === 'number' && activeFilterCount > 0
  const hasSearchText = Boolean(search && search.trim().length > 0)

  // Clear button is visible when explicitly set to true, or when omitted and active filters/search exist
  const isClearVisible = showClear !== undefined ? showClear : (hasActiveCount || hasSearchText)

  const content = (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      {/* Primary filter area: Search + Custom filters + Active status */}
      <div className="flex flex-1 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 min-w-0">
        {hasSearch && (
          <div className="relative w-full sm:w-64 lg:w-72 shrink-0">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none select-none"
              aria-hidden="true"
            />
            <Input
              value={search ?? ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder || __('Search...', 'codeclove-school-management')}
              className="pl-9 pr-8"
              aria-label={searchPlaceholder || __('Search', 'codeclove-school-management')}
            />
            {hasSearchText && onSearchChange && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text transition-colors p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                aria-label={__('Clear search', 'codeclove-school-management')}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {children}

        {/* Active filters counter badge & Clear Filters ghost button */}
        {(hasActiveCount || (isClearVisible && Boolean(onClearAll))) && (
          <div className="flex items-center gap-2 shrink-0">
            {hasActiveCount && (
              <Badge variant="brand" size="sm" className="tabular-nums font-medium">
                {sprintf(__('%d active', 'codeclove-school-management'), activeFilterCount)}
              </Badge>
            )}

            {isClearVisible && onClearAll && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="h-8 text-xs text-text-muted hover:text-text gap-1 px-2.5"
                aria-label={__('Clear all filters', 'codeclove-school-management')}
              >
                <X size={12} aria-hidden="true" />
                {__('Clear Filters', 'codeclove-school-management')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Secondary Actions area */}
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0 justify-start sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  )

  if (!cardWrapper) {
    return <div className={className}>{content}</div>
  }

  return (
    <Card className={cn('p-3.5', className)}>
      {content}
    </Card>
  )
}
