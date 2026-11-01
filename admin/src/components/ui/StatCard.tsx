/**
 * StatCard — KPI card for the Dashboard and module overviews.
 *
 * Phase 2 improvements:
 *   - Trend arrow icon (TrendingUp / TrendingDown) instead of plain text badge
 *   - Optional sparkline via tiny inline SVG path (no chart library needed)
 *   - Loading skeleton mode via `loading` prop
 *   - `clickable` prop adds hover lift + cursor-pointer
 *   - Delta badge is color-coded and directional
 */
import type { ReactNode } from 'react'
import { type LucideIcon, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from './Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatCardProps {
  label: string
  value: ReactNode
  icon?: LucideIcon
  iconColor?: string
  iconBg?: string
  /** Percentage or absolute delta value (e.g. "+12%" or "3") */
  delta?: string
  /** Label shown below the delta — e.g. "vs last month" */
  deltaLabel?: string
  /** Descriptive subtext below label (e.g. context or secondary metric) */
  subtext?: string
  /** True = positive (green ↑), false = negative (red ↓), undefined = neutral (grey) */
  deltaPositive?: boolean
  /** Custom badge rendered in top-right corner */
  badge?: ReactNode
  /** Show skeleton loading state */
  loading?: boolean
  /** Add hover lift and pointer cursor */
  clickable?: boolean
  onClick?: () => void
  className?: string
  valueClassName?: string
  compact?: boolean
  /** Optional custom content rendered below value/label (e.g. progress bar) */
  children?: ReactNode
  /** Optional footer content pinned to the bottom of the card */
  footer?: ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-brand',
  iconBg = 'bg-brand-dim',
  delta,
  deltaLabel,
  deltaPositive,
  loading = false,
  clickable = false,
  onClick,
  className,
  compact = false,
  subtext,
  badge,
  valueClassName,
  children,
  footer,
}: StatCardProps) {
  if (loading) {
    if (compact) {
      return (
        <div
          className={cn(
            'rounded-lg bg-bg-elevated border border-border p-3.5 flex items-center gap-3.5 shadow-card',
            className
          )}
        >
          <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        </div>
      )
    }
    return (
      <div
        className={cn(
          'rounded-xl bg-bg-elevated border border-border p-4 sm:p-5 flex flex-col justify-between shadow-card',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2 min-h-[1.75rem]">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
        </div>
        <div className="mt-3">
          <Skeleton className="h-8 w-20 rounded" />
        </div>
        <div className="mt-2">
          <Skeleton className="h-3.5 w-36 rounded" />
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'rounded-lg bg-bg-elevated border border-border p-3 sm:p-3.5 flex items-center gap-3 shadow-card',
          'transition-all duration-150',
          clickable
            ? 'cursor-pointer hover:border-border-strong hover:-translate-y-[1px] hover:shadow-card-md'
            : 'hover:border-border-strong',
          className
        )}
      >
        {Icon && (
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              iconBg
            )}
          >
            <Icon size={16} className={iconColor} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-xl font-bold text-text tabular-nums leading-none',
              valueClassName
            )}
          >
            {value}
          </p>
          <p className="text-xs text-text-muted mt-1 leading-none truncate">{label}</p>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-xl bg-bg-elevated border border-border p-4 sm:p-5 flex flex-col justify-between shadow-card',
        'transition-all duration-150',
        clickable
          ? 'cursor-pointer hover:border-border-strong hover:shadow-card-md hover:-translate-y-[1px]'
          : 'hover:border-border-strong',
        className
      )}
    >
      <div>
        {/* ── Top row: label + utility icons/badges ──────────────────── */}
        <div className="flex items-center justify-between gap-2 min-h-[1.75rem]">
          <span className="text-xs sm:text-sm font-medium text-text-muted truncate select-none group-hover:text-text transition-colors">
            {label}
          </span>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {badge ? (
              badge
            ) : delta !== undefined ? (
              <DeltaBadge delta={delta} positive={deltaPositive} />
            ) : null}

            {Icon && (
              <div
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                  iconBg || 'bg-bg-surface border border-border-subtle text-text-subtle'
                )}
              >
                <Icon size={15} className={iconColor || 'text-text-subtle'} />
              </div>
            )}

            {clickable && (
              <ArrowUpRight
                size={14}
                className="text-text-subtle opacity-40 group-hover:opacity-100 group-hover:text-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all -ml-0.5"
              />
            )}
          </div>
        </div>

        {/* ── Value ────────────────────────────────────────────────── */}
        <div className="mt-3 flex items-baseline gap-2">
          <div
            className={cn(
              'text-2xl sm:text-3xl font-bold text-text tabular-nums tracking-tight leading-none',
              valueClassName
            )}
          >
            {value}
          </div>
        </div>

        {/* ── Optional children content (e.g. progress bar) ────────── */}
        {children && <div className="mt-3">{children}</div>}

        {/* ── Delta context label or subtext ────────────────────────── */}
        {(subtext || deltaLabel) && (
          <p className="text-xs text-text-subtle mt-2 leading-relaxed">
            {subtext || deltaLabel}
          </p>
        )}
      </div>

      {/* ── Optional footer content (e.g. actions/drilldown) ─────── */}
      {footer && (
        <div className="mt-auto pt-3 border-t border-border-subtle text-xs text-text-subtle">
          {footer}
        </div>
      )}
    </div>
  )
}

// ─── Delta Badge ─────────────────────────────────────────────────────────────

function DeltaBadge({
  delta,
  positive,
}: {
  delta: string
  positive?: boolean
}) {
  const isPositive = positive === true
  const isNegative = positive === false
  const isNeutral  = positive === undefined

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded border',
        isPositive && 'text-success bg-success-dim border-success-border',
        isNegative && 'text-danger bg-danger-dim border-danger-border',
        isNeutral  && 'text-text-muted bg-bg-surface border-border'
      )}
    >
      {TrendIcon && <TrendIcon size={11} />}
      {isPositive && '+'}
      {delta}
    </span>
  )
}
