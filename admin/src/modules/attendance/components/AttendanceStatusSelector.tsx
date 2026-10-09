import { useState, KeyboardEvent } from 'react'
import { Check, X, Clock, Sun, ChevronDown, CalendarMinus, ShieldCheck, CalendarOff } from 'lucide-react'
import { Dropdown, DropdownItem } from '@/components/ui'
import { __ } from '@/lib/i18n'

export interface AttendanceStatusSelectorProps {
  status: string
  onChange: (newStatus: string) => void
  disabled?: boolean
  label?: string
  fullWidth?: boolean
  className?: string
}

const PRIMARY_STATUSES = [
  {
    key: 'present',
    labelKey: 'Present',
    shortLabelKey: 'P',
    icon: Check,
    activeBg: 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-500 font-semibold',
  },
  {
    key: 'absent',
    labelKey: 'Absent',
    shortLabelKey: 'A',
    icon: X,
    activeBg: 'bg-rose-600 text-white shadow-xs ring-1 ring-rose-500 font-semibold',
  },
  {
    key: 'late',
    labelKey: 'Late',
    shortLabelKey: 'Late',
    icon: Clock,
    activeBg: 'bg-amber-400 text-amber-950 shadow-xs ring-1 ring-amber-500 font-semibold',
  },
  {
    key: 'on_leave',
    labelKey: 'Leave',
    shortLabelKey: 'Leave',
    icon: CalendarMinus,
    activeBg: 'bg-purple-600 text-white shadow-xs ring-1 ring-purple-500 font-semibold',
  },
] as const

const SECONDARY_STATUSES = [
  { key: 'half_day', labelKey: 'Half Day', icon: Sun, color: 'text-orange-500' },
  { key: 'excused', labelKey: 'Excused', icon: ShieldCheck, color: 'text-sky-500' },
  { key: 'holiday', labelKey: 'Holiday', icon: CalendarOff, color: 'text-text-subtle' },
] as const

const ALL_STATUS_KEYS = ['present', 'absent', 'late', 'on_leave', 'half_day', 'excused', 'holiday'] as const

export function AttendanceStatusSelector({
  status,
  onChange,
  disabled = false,
  label,
  fullWidth = false,
  className = '',
}: AttendanceStatusSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const secondaryMatch = SECONDARY_STATUSES.find((s) => s.key === status)
  const isPrimarySelected = PRIMARY_STATUSES.some((p) => p.key === status)

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0
    if (delta) {
      e.preventDefault()
      const nextIndex = (ALL_STATUS_KEYS.indexOf(status as (typeof ALL_STATUS_KEYS)[number]) + delta + ALL_STATUS_KEYS.length) % ALL_STATUS_KEYS.length
      onChange(ALL_STATUS_KEYS[nextIndex]!)
    }
  }

  const secLabel = secondaryMatch ? __(secondaryMatch.labelKey, 'codeclove-school-management') : ''

  const dropdownTriggerBtn = (
    <button
      type="button"
      role="radio"
      aria-checked={!!secondaryMatch}
      tabIndex={secondaryMatch ? 0 : -1}
      disabled={disabled}
      className={`select-none transition-transform duration-100 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        fullWidth
          ? 'w-full min-h-[46px] h-11.5 px-0.5 py-1 rounded-lg flex flex-col items-center justify-center gap-0.5 active:scale-95'
          : 'inline-flex items-center justify-center gap-1 px-2 py-1 text-xs rounded-md'
      } ${
        secondaryMatch
          ? 'bg-violet-600 text-white font-semibold shadow-xs ring-1 ring-violet-500'
          : 'bg-transparent text-text-muted hover:text-text hover:bg-hover-bg font-medium'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      title={secLabel || __('More Statuses', 'codeclove-school-management')}
    >
      {secondaryMatch ? (
        <>
          <secondaryMatch.icon size={fullWidth ? 15 : 13} className="text-white shrink-0 stroke-[2.5]" />
          <span className={`truncate leading-none ${fullWidth ? 'text-3xs font-semibold mt-0.5 max-w-full' : 'text-xs'}`}>
            {secLabel}
          </span>
        </>
      ) : (
        <>
          <ChevronDown size={fullWidth ? 14 : 11} className={`text-text-subtle transition-transform duration-200 shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} />
          <span className={`truncate leading-none ${fullWidth ? 'text-3xs font-medium' : 'text-xs'}`}>
            {__('More', 'codeclove-school-management')}
          </span>
        </>
      )}
    </button>
  )

  const containerClasses = fullWidth
    ? `w-full grid grid-cols-5 p-1 rounded-xl bg-bg-surface border border-border shadow-xs gap-1 ${className}`
    : `inline-flex items-center p-0.5 rounded-lg bg-bg-surface border border-border shadow-2xs gap-0.5 ${className}`

  return (
    <div
      role="radiogroup"
      aria-label={label || __('Attendance status', 'codeclove-school-management')}
      onKeyDown={handleKeyDown}
      className={containerClasses}
    >
      {PRIMARY_STATUSES.map((item) => {
        const Icon = item.icon
        const isSelected = status === item.key
        const itemLabel = __(item.labelKey, 'codeclove-school-management')
        const itemShortLabel = __(item.shortLabelKey, 'codeclove-school-management')

        return (
          <button
            key={item.key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected || (!isPrimarySelected && !secondaryMatch && item.key === 'present') ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(item.key)}
            className={`relative select-none transition-transform duration-100 touch-manipulation group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              fullWidth
                ? 'w-full min-h-[46px] h-11.5 px-0.5 py-1 rounded-lg flex flex-col items-center justify-center gap-0.5 active:scale-95'
                : 'inline-flex items-center justify-center gap-1 px-2.5 py-1 text-xs rounded-md'
            } ${
              isSelected
                ? item.activeBg
                : 'bg-transparent text-text-muted hover:text-text hover:bg-hover-bg font-medium'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Icon
              size={fullWidth ? 15 : 13}
              className={`shrink-0 ${
                isSelected
                  ? (item.key === 'late' ? 'text-amber-950 stroke-[2.5]' : 'text-white stroke-[2.5]')
                  : 'text-text-subtle group-hover:text-text'
              }`}
            />
            <span className={`leading-none ${fullWidth ? 'text-3xs font-semibold mt-0.5 truncate' : 'hidden sm:inline'}`}>
              {itemLabel}
            </span>
            {!fullWidth && <span className="inline sm:hidden">{itemShortLabel}</span>}
          </button>
        )
      })}

      <Dropdown
        trigger={dropdownTriggerBtn}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        align="end"
      >
        {SECONDARY_STATUSES.map((sec) => {
          const SecIcon = sec.icon
          const isSecSelected = status === sec.key
          const label = __(sec.labelKey, 'codeclove-school-management')

          return (
            <DropdownItem
              key={sec.key}
              onClick={() => {
                onChange(sec.key)
                setDropdownOpen(false)
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                isSecSelected ? 'bg-brand-dim text-brand font-semibold' : 'hover:bg-hover-bg text-text-muted hover:text-text'
              }`}
            >
              <SecIcon size={14} className={sec.color} />
              <span>{label}</span>
              {isSecSelected && <Check size={12} className="ml-auto text-brand" />}
            </DropdownItem>
          )
        })}
      </Dropdown>
    </div>
  )
}
