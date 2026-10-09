/**
 * SegmentedTabs Component.
 *
 * Accessible tab switcher following CodeClove design system tokens.
 * Provides accessible role="tablist" / role="tab" controls with
 * full keyboard focus styling, icon rendering, and tabular-nums counters.
 */

import React, { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SegmentedTab<T extends string | number = string> {
  id: T
  label: ReactNode
  icon?: LucideIcon
  count?: number | string
  dot?: boolean
  badge?: ReactNode
  ariaControls?: string
  disabled?: boolean
  className?: string
}

export interface SegmentedTabsProps<T extends string | number = string> {
  tabs: Array<SegmentedTab<T>>
  activeTab: T
  onChange: (tabId: T) => void
  ariaLabel?: string
  className?: string
  size?: 'sm' | 'md'
}

export function SegmentedTabs<T extends string | number = string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
  className,
  size = 'md',
}: SegmentedTabsProps<T>): React.ReactElement {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center bg-bg-base/80 border border-border/80 rounded-xl p-1 gap-1 max-w-full overflow-x-auto shadow-2xs w-fit',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const Icon = tab.icon
        const tabIdStr = String(tab.id)
        const ariaControls = tab.ariaControls ?? `panel-${tabIdStr}`

        return (
          <button
            key={tabIdStr}
            type="button"
            role="tab"
            id={`tab-${tabIdStr}`}
            aria-selected={isActive}
            aria-controls={ariaControls}
            disabled={tab.disabled}
            onClick={() => {
              if (!tab.disabled) {
                onChange(tab.id)
              }
            }}
            className={cn(
              'flex items-center rounded-lg font-semibold transition-all select-none outline-none whitespace-nowrap',
              size === 'sm' ? 'px-3 py-1.5 text-xs gap-1.5' : 'px-3.5 py-2 text-xs gap-2',
              tab.disabled
                ? 'opacity-50 cursor-not-allowed pointer-events-none'
                : 'cursor-pointer',
              isActive
                ? 'bg-bg-surface text-brand font-bold shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-bg-surface/50',
              tab.className
            )}
          >
            {tab.dot && (
              <span
                aria-hidden="true"
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-colors shrink-0',
                  isActive ? 'bg-brand' : 'bg-brand/50'
                )}
              />
            )}
            {Icon && (
              <Icon
                aria-hidden="true"
                className={cn(
                  size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4',
                  'shrink-0 transition-colors',
                  isActive ? 'text-brand' : 'text-text-subtle'
                )}
              />
            )}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count !== null && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-3xs font-bold rounded-full transition-colors font-mono tabular-nums',
                  isActive
                    ? 'bg-brand-dim text-brand'
                    : 'bg-border/60 text-text-subtle'
                )}
              >
                {tab.count}
              </span>
            )}
            {tab.badge}
          </button>
        )
      })}
    </div>
  )
}

export default SegmentedTabs
