/**
 * Table — CodeClove design-token-styled table shell.
 *
 * Headless — markup is owned by CodeClove, ready for TanStack Table integration.
 *
 * Usage:
 *   <TableRoot responsiveMode="scroll">
 *     <Thead>
 *       <Tr><Th sticky="left">Name</Th><Th priority="medium">Status</Th><Th sticky="right">Actions</Th></Tr>
 *     </Thead>
 *     <Tbody>
 *       <Tr className="table-row-hover"><Td sticky="left">Alice</Td><Td priority="medium">Active</Td><Td sticky="right">Edit</Td></Tr>
 *     </Tbody>
 *   </TableRoot>
 */
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown, ArrowUpDown, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'

// ─── Table Root ───────────────────────────────────────────────────────────────

export type TableColumnType =
  | 'primary'
  | 'code'
  | 'number'
  | 'date'
  | 'badge'
  | 'actions'

const COLUMN_TYPE_CONFIG: Record<TableColumnType, {
  align: 'left' | 'center' | 'right'
  thClass?: string
  tdClass?: string
}> = {
  primary: {
    align: 'left',
    thClass: 'min-w-[200px]',
    tdClass: 'font-medium text-text',
  },
  code: {
    align: 'left',
    thClass: 'w-24 sm:w-28',
    tdClass: 'font-mono text-xs text-text-subtle',
  },
  number: {
    align: 'right',
    tdClass: 'tabular-nums font-medium text-text',
  },
  date: {
    align: 'left',
    thClass: 'w-32 sm:w-36',
    tdClass: 'font-mono text-xs text-text-muted',
  },
  badge: {
    align: 'center',
    thClass: 'w-28',
  },
  actions: {
    align: 'right',
    thClass: 'w-24 sm:w-28 pe-6',
    tdClass: 'pe-6',
  },
}

export interface TableRootProps extends React.HTMLAttributes<HTMLTableElement> {
  containerClassName?: string
  responsiveMode?: 'scroll'
}

export function TableRoot({
  className,
  containerClassName,
  responsiveMode,
  ...props
}: TableRootProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasScrollLeft, setHasScrollLeft] = useState(false)
  const [hasScrollRight, setHasScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const absScrollLeft = Math.abs(scrollLeft)
    setHasScrollLeft(absScrollLeft > 2)
    setHasScrollRight(absScrollLeft + clientWidth < scrollWidth - 2)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    const handleResize = () => checkScroll()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [checkScroll])

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden',
        containerClassName
      )}
    >
      {/* Scroll indicator shadows (only active in scroll mode) */}
      {true && (
        <>
          <div
            className={cn(
              'pointer-events-none absolute start-0 top-0 bottom-0 z-20 w-6 bg-gradient-to-r rtl:bg-gradient-to-l from-bg-elevated via-bg-elevated/80 to-transparent transition-opacity duration-200',
              hasScrollLeft ? 'opacity-100' : 'opacity-0'
            )}
          />
          <div
            className={cn(
              'pointer-events-none absolute end-0 top-0 bottom-0 z-20 w-6 bg-gradient-to-l rtl:bg-gradient-to-r from-bg-elevated via-bg-elevated/80 to-transparent transition-opacity duration-200',
              hasScrollRight ? 'opacity-100' : 'opacity-0'
            )}
          />
        </>
      )}

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={cn(
          'w-full overflow-x-auto scrollbar-thin'
        )}
      >
        <table
          className={cn(
            'w-full text-sm border-collapse',
            className
          )}
          {...props}
        />
      </div>
    </div>
  )
}

// ─── Thead ────────────────────────────────────────────────────────────────────

export function Thead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'border-b border-border bg-bg-base/90 sticky top-0 z-10 backdrop-blur-sm',
        className
      )}
      {...props}
    />
  )
}

// ─── Tbody ────────────────────────────────────────────────────────────────────

export function Tbody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('divide-y divide-border/60', className)}
      {...props}
    />
  )
}

// ─── Tr ───────────────────────────────────────────────────────────────────────

export function Tr({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'group hover:bg-hover-bg/60 transition-colors duration-150',
        className
      )}
      {...props}
    />
  )
}

// ─── Th ───────────────────────────────────────────────────────────────────────

export interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  type?: TableColumnType
  sortable?: boolean
  sorted?: 'asc' | 'desc' | false
  onSort?: () => void
  priority?: 'high' | 'medium' | 'low'
  align?: 'left' | 'center' | 'right'
}

export function Th({
  type,
  className,
  children,
  sortable = false,
  sorted,
  onSort,
  priority = 'high',
  align,
  ...props
}: ThProps) {
  const typeCfg = type ? COLUMN_TYPE_CONFIG[type] : undefined
  const effectiveAlign = align ?? typeCfg?.align
  const priorityClass =
    priority === 'medium'
      ? 'hidden sm:table-cell'
      : priority === 'low'
      ? 'hidden lg:table-cell'
      : ''

  const isRight = effectiveAlign === 'right'
  const isCenter = effectiveAlign === 'center'

  return (
    <th
      className={cn(
        'group px-3 py-3 sm:px-4 sm:py-3.5 text-xs font-semibold uppercase tracking-wider text-text-subtle',
        'whitespace-nowrap select-none bg-bg-base/90',
        isRight ? 'text-end' : isCenter ? 'text-center' : 'text-start',
        sortable && 'cursor-pointer hover:text-text transition-colors',
        priorityClass,
        typeCfg?.thClass,
        className
      )}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      {sortable ? (
        <span
          className={cn(
            'flex items-center gap-1.5 w-full',
            isRight ? 'justify-end' : isCenter ? 'justify-center' : 'justify-start'
          )}
        >
          {children}
          <span className="inline-flex shrink-0 ms-1">
            {sorted === 'asc' ? (
              <ArrowUp size={13} className="text-brand stroke-[2.25]" />
            ) : sorted === 'desc' ? (
              <ArrowDown size={13} className="text-brand stroke-[2.25]" />
            ) : (
              <ArrowUpDown size={13} className="text-text-subtle/50 group-hover:text-text-muted transition-colors" />
            )}
          </span>
        </span>
      ) : (
        children
      )}
    </th>
  )
}

// ─── Td ───────────────────────────────────────────────────────────────────────

export interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  type?: TableColumnType
  priority?: 'high' | 'medium' | 'low'
  align?: 'left' | 'center' | 'right'
}

export function Td({
  type,
  className,
  priority = 'high',
  align,
  children,
  ...props
}: TdProps) {
  const typeCfg = type ? COLUMN_TYPE_CONFIG[type] : undefined
  const effectiveAlign = align ?? typeCfg?.align
  const priorityClass =
    priority === 'medium'
      ? 'hidden sm:table-cell'
      : priority === 'low'
      ? 'hidden lg:table-cell'
      : ''

  return (
    <td
      className={cn(
        'px-3 py-3 sm:px-4 sm:py-3.5 text-xs sm:text-sm text-text-muted align-middle transition-colors duration-150',
        effectiveAlign === 'right' ? 'text-end' : effectiveAlign === 'center' ? 'text-center' : effectiveAlign === 'left' ? 'text-start' : undefined,
        priorityClass,
        typeCfg?.tdClass,
        className
      )}
      {...props}
    >
      {children}
    </td>
  )
}

// ─── Table Empty ──────────────────────────────────────────────────────────────

export function TableEmpty({
  colSpan,
  message = 'No records found.',
  description,
  icon,
  action,
}: {
  colSpan: number
  message?: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <EmptyState
          icon={icon}
          title={message}
          description={description}
          action={action}
          className="py-12 border-0 bg-transparent"
        />
      </td>
    </tr>
  )
}

// ─── Table Skeleton ───────────────────────────────────────────────────────────

export function TableSkeleton({
  columns,
  rows = 5,
}: {
  columns: number
  rows?: number
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Tr key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => {
            let widthClass = 'w-24'
            if (colIndex === 0) {
              const firstWidths = ['w-36', 'w-44', 'w-32', 'w-40', 'w-28']
              widthClass = firstWidths[rowIndex % firstWidths.length] ?? 'w-36'
            } else if (colIndex === columns - 1) {
              widthClass = 'w-8 h-8 rounded-lg ms-auto'
            } else {
              const midWidths = ['w-20', 'w-16', 'w-24', 'w-12']
              widthClass = midWidths[(rowIndex + colIndex) % midWidths.length] ?? 'w-20'
            }

            return (
              <Td key={colIndex}>
                <Skeleton className={cn('h-4', widthClass)} />
              </Td>
            )
          })}
        </Tr>
      ))}
    </>
  )
}
