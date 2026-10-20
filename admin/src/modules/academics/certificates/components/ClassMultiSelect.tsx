import React, { useState, useMemo } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn, getPortalContainer } from '@/lib/utils'
import { Badge } from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'
import type { AcademicUnit } from '@/api/academics'
import { useLabels } from '@/lib/labels'

export interface ClassMultiSelectProps {
  units: AcademicUnit[]
  selectedUnitIds: number[]
  onChange: (unitIds: number[]) => void
  disabled?: boolean
  placeholder?: string
}

export const ClassMultiSelect: React.FC<ClassMultiSelectProps> = ({
  units,
  selectedUnitIds,
  onChange,
  disabled = false,
  placeholder,
}) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { getLabel } = useLabels()
  const classPluralLabel = getLabel('academic_unit', true, 'Classes')

  const isAllSelected = selectedUnitIds.length === units.length && units.length > 0
  const isNoneSelected = selectedUnitIds.length === 0
  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return units
    return units.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.code && u.code.toLowerCase().includes(q))
    )
  }, [units, search])

  const handleToggleUnit = (unitId: number) => {
    if (selectedUnitIds.includes(unitId)) {
      onChange(selectedUnitIds.filter((id) => id !== unitId))
    } else {
      onChange([...selectedUnitIds, unitId])
    }
  }
  // Summary label shown on the collapsed trigger
  const triggerLabel = useMemo(() => {
    if (isNoneSelected) {
      return placeholder || sprintf(__('Select %s...', 'codeclove-school-management'), classPluralLabel)
    }
    if (isAllSelected) {
      return sprintf(__('All %s', 'codeclove-school-management'), classPluralLabel)
    }
    const selectedNames = units
      .filter((u) => selectedUnitIds.includes(u.id))
      .map((u) => u.name)
    if (selectedNames.length === 1) {
      return selectedNames[0]
    }
    if (selectedNames.length === 2) {
      return selectedNames.join(', ')
    }
    return sprintf(__('%d %s Selected', 'codeclove-school-management'), selectedUnitIds.length, classPluralLabel)
  }, [isNoneSelected, isAllSelected, units, selectedUnitIds, classPluralLabel, placeholder])

  const portalContainer = typeof document !== 'undefined' ? getPortalContainer() : null

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          disabled={disabled}
          className={cn(
            'flex h-8 w-full items-center justify-between gap-2 rounded px-3 text-sm min-w-0',
            'bg-bg-surface border border-border transition-colors duration-100 text-text text-start',
            'hover:border-border-strong focus:outline-hidden focus:border-brand focus:ring-1 focus:ring-brand-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer',
            isNoneSelected && 'text-text-subtle'
          )}
        >
          <span className="truncate block font-normal text-xs sm:text-sm">
            {triggerLabel}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedUnitIds.length > 1 && (
              <Badge
                variant={isAllSelected ? 'brand' : 'secondary'}
                className="text-3xs font-mono font-medium px-1.5 py-0 shrink-0"
              >
                {isAllSelected
                  ? __('All', 'codeclove-school-management')
                  : `${selectedUnitIds.length}/${units.length}`}
              </Badge>
            )}
            <ChevronDown
              size={13}
              className={cn(
                'text-text-subtle transition-transform duration-150',
                open && 'rotate-180 text-brand'
              )}
              aria-hidden="true"
            />
          </div>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal container={portalContainer}>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-[100050] overflow-hidden rounded-xl outline-none p-2.5 space-y-2',
            'bg-bg-overlay border border-border shadow-modal',
            'w-[max(var(--radix-popover-trigger-width),300px)] min-w-[300px] max-w-[calc(100vw-2rem)] flex flex-col'
          )}
        >
          {/* Quick Actions Header */}
          <div className="flex items-center justify-between gap-2 px-1 text-xs">
            <span className="text-2xs font-mono font-medium text-text-muted whitespace-nowrap">
              {sprintf(__('%d of %d selected', 'codeclove-school-management'), selectedUnitIds.length, units.length)}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onChange(units.map((u) => u.id))}
                disabled={isAllSelected || units.length === 0}
                className="h-6 text-2xs font-semibold px-2 rounded text-brand hover:text-brand hover:bg-brand/10 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                {__('Select All', 'codeclove-school-management')}
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                disabled={isNoneSelected}
                className="h-6 text-2xs font-medium px-2 rounded text-text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                {__('Clear', 'codeclove-school-management')}
              </button>
            </div>
          </div>

          {/* Quick Filter Search if > 5 units */}
          {units.length > 5 && (
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none select-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={sprintf(__('Filter %s...', 'codeclove-school-management'), classPluralLabel.toLowerCase())}
                className="w-full h-7 pl-7 pr-6 text-xs bg-bg-surface border border-border rounded-md text-text placeholder:text-text-subtle focus:outline-hidden focus:border-brand"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-text-subtle hover:text-text rounded"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          )}

          {/* Units Checkbox List */}
          <div className="max-h-52 overflow-y-auto divide-y divide-border/30 border border-border rounded-lg bg-bg-surface pr-0.5">
            {filteredUnits.length === 0 ? (
              <div className="p-4 text-center text-xs text-text-muted">
                {__('No matching classes found.', 'codeclove-school-management')}
              </div>
            ) : (
              filteredUnits.map((u) => {
                const isSelected = selectedUnitIds.includes(u.id)
                return (
                  <div
                    key={u.id}
                    onClick={() => handleToggleUnit(u.id)}
                    className={cn(
                      'px-3 py-2 flex items-center justify-between gap-2.5 text-xs transition-colors cursor-pointer select-none',
                      isSelected ? 'bg-brand/10 dark:bg-brand/15 text-text font-medium' : 'hover:bg-hover-bg text-text'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by row onClick
                        className="w-3.5 h-3.5 rounded text-brand focus:ring-brand cursor-pointer shrink-0"
                      />
                      <span className="truncate">{u.name}</span>
                    </div>

                    {u.code && (
                      <span className="text-3xs font-mono text-text-muted uppercase shrink-0 px-1.5 py-0.5 rounded bg-bg-elevated border border-border/50">
                        {u.code}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <p className="text-3xs text-text-muted px-1.5 pt-0.5 leading-relaxed">
            {__('Select multiple classes to issue across grade bands (e.g. Primary Wing).', 'codeclove-school-management')}
          </p>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
