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
import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from './Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
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
  compact?: boolean
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
}: StatCardProps) {
  if (loading) {
    if (compact) {
      return (
        <div
          className={cn(
            'rounded-lg bg-bg-elevated border border-border p-3.5 flex items-center gap-3.5',
            className
          )}
        >
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        </div>
      )
    }
    return (
      <div
        className={cn(
          'rounded-2xl bg-bg-elevated border border-border p-5 space-y-4',
          className
        )}
      >
        <div className="flex items-start justify-between">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <Skeleton className="w-12 h-5 rounded" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'rounded-lg bg-bg-elevated border border-border p-3.5 flex items-center gap-3.5',
          'transition-all duration-150',
          clickable
            ? 'cursor-pointer hover:border-border-strong hover:-translate-y-[1px] hover:shadow-card'
            : 'hover:border-border-strong',
          className
        )}
      >
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            iconBg
          )}
        >
          <Icon size={16} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold text-text tabular-nums leading-none">
            {value}
          </p>
          <p className="text-xs text-text-muted mt-1 leading-none">{label}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl bg-bg-elevated border border-border p-5',
        'transition-all duration-150',
        clickable
          ? 'cursor-pointer hover:border-border-strong hover:-translate-y-[1px] hover:shadow-card'
          : 'hover:border-border-strong',
        className
      )}
    >
      {/* ── Top row: icon + delta ────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
            iconBg
          )}
        >
          <Icon size={17} className={iconColor} />
        </div>

        {badge ? (
          badge
        ) : delta !== undefined ? (
          <DeltaBadge delta={delta} positive={deltaPositive} />
        ) : null}
      </div>
      {/* ── Value ────────────────────────────────────────────────── */}
      <p className="text-3xl font-bold text-text tabular-nums tracking-tight leading-none">
        {value}
      </p>

      {/* ── Label ────────────────────────────────────────────────── */}
      <p className="text-sm font-medium text-text-muted mt-2">{label}</p>

      {/* ── Delta context label or subtext ────────────────────────── */}
      {(subtext || deltaLabel) && (
        <p className="text-xs text-text-subtle mt-1">{subtext || deltaLabel}</p>
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
        'inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded',
        isPositive && 'text-success bg-success/10',
        isNegative && 'text-danger bg-danger/10',
        isNeutral  && 'text-text-muted bg-bg-overlay'
      )}
    >
      {TrendIcon && <TrendIcon size={11} />}
      {isPositive && '+'}
      {delta}
    </span>
  )
}
