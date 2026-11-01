/**
 * TimePicker — Accessible, high-precision time picker primitive for CodeClove.
 *
 * Supports:
 * - 12-hour (AM/PM) and 24-hour displays with school localization settings.
 * - Quick school shift presets (e.g. 09:00 AM, 11:30 AM, 01:30 PM).
 * - Interactive hour/minute selection popover.
 * - Flexible direct keyboard typing ('9', '9:30', '9am', '1:30pm', '1130').
 *
 * Usage:
 *   <TimePicker value={startTime} onChange={setStartTime} />
 */
import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Clock, X, Check } from 'lucide-react'
import { cn, getPortalContainer } from '@/lib/utils'
import { Input } from './Input'
import { __ } from '@/lib/i18n'

export interface TimePickerPreset {
  label: string
  value: string // HH:mm (24-hour)
}

export interface TimePickerProps {
  value?: string // HH:mm format, e.g. '09:00' or '11:30'
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  error?: boolean
  className?: string
  id?: string
  name?: string
  container?: HTMLElement | null
  modal?: boolean
  use12Hours?: boolean
  presets?: TimePickerPreset[]
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
  'aria-label'?: string
}

/**
 * Common default school exam/period time presets
 */
const DEFAULT_SCHOOL_PRESETS: TimePickerPreset[] = [
  { label: '08:30 AM', value: '08:30' },
  { label: '09:00 AM', value: '09:00' },
  { label: '09:30 AM', value: '09:30' },
  { label: '10:00 AM', value: '10:00' },
  { label: '11:30 AM', value: '11:30' },
  { label: '12:00 PM', value: '12:00' },
  { label: '01:30 PM', value: '13:30' },
  { label: '02:00 PM', value: '14:00' },
  { label: '03:30 PM', value: '15:30' },
  { label: '04:00 PM', value: '16:00' },
]

/**
 * Format HH:mm string for user display based on 12h/24h preference
 */
export function formatTimeDisplay(value24?: string | null, is12Hours = true): string {
  if (!value24 || !value24.trim()) return ''
  const clean = value24.trim()
  const parts = clean.split(':')
  if (parts.length < 2) return clean

  const h = parseInt(parts[0] || '0', 10)
  const m = parseInt(parts[1] || '0', 10)
  if (isNaN(h) || isNaN(m)) return clean

  const mmStr = String(m).padStart(2, '0')

  if (!is12Hours) {
    return `${String(h).padStart(2, '0')}:${mmStr}`
  }

  const period = h >= 12 ? 'PM' : 'AM'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  const hhStr = String(h12).padStart(2, '0')

  return `${hhStr}:${mmStr} ${period}`
}

/**
 * Parse flexible user input strings into canonical HH:mm format
 */
export function parseTimeInput(input: string, prefer12Hour = true): string | null {
  if (!input || !input.trim()) return null
  const str = input.trim().toLowerCase()

  const isPM = str.includes('pm') || str.includes('p')
  const isAM = str.includes('am') || str.includes('a')

  const numbersOnly = str.replace(/[^0-9:]/g, '')
  let hours = 0
  let minutes = 0

  if (numbersOnly.includes(':')) {
    const parts = numbersOnly.split(':')
    hours = parseInt(parts[0] || '0', 10)
    minutes = parseInt(parts[1] || '0', 10)
  } else if (numbersOnly.length === 3) {
    hours = parseInt(numbersOnly.slice(0, 1), 10)
    minutes = parseInt(numbersOnly.slice(1), 10)
  } else if (numbersOnly.length === 4) {
    hours = parseInt(numbersOnly.slice(0, 2), 10)
    minutes = parseInt(numbersOnly.slice(2), 10)
  } else if (numbersOnly.length >= 1 && numbersOnly.length <= 2) {
    hours = parseInt(numbersOnly, 10)
    minutes = 0
  } else {
    return null
  }

  if (isNaN(hours) || isNaN(minutes)) return null

  if (isPM && hours < 12) {
    hours += 12
  } else if (isAM && hours === 12) {
    hours = 0
  } else if (!isAM && !isPM && prefer12Hour) {
    // School context heuristic: 1 to 6 without AM/PM is afternoon (13:00 to 18:00)
    if (hours >= 1 && hours <= 6) {
      hours += 12
    }
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export const TimePicker = React.forwardRef<HTMLInputElement, TimePickerProps>(
  (
    {
      value = '',
      onChange,
      placeholder,
      disabled = false,
      clearable = true,
      error = false,
      className,
      id,
      name,
      container,
      modal = true,
      use12Hours: explicit12Hours,
      presets = DEFAULT_SCHOOL_PRESETS,
      'aria-invalid': ariaInvalid,
      'aria-describedby': ariaDescribedBy,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const portalContainer = getPortalContainer(container)

    // Mode: 12-hour format with AM/PM by default
    const is12Hours = explicit12Hours !== undefined ? explicit12Hours : true

    // Local text input state
    const [inputValue, setInputValue] = React.useState(() =>
      formatTimeDisplay(value, is12Hours)
    )

    // Sync input value when incoming value prop or mode changes
    React.useEffect(() => {
      setInputValue(formatTimeDisplay(value, is12Hours))
    }, [value, is12Hours])

    // Current parsed hour, minute, and period for the popover picker
    const { activeHour12, activeHour24, activeMinute, activePeriod } = React.useMemo(() => {
      if (!value || !value.includes(':')) {
        return { activeHour12: 9, activeHour24: 9, activeMinute: 0, activePeriod: 'AM' as const }
      }
      const [hStr, mStr] = value.split(':')
      const h = parseInt(hStr || '9', 10)
      const m = parseInt(mStr || '0', 10)
      const validH = isNaN(h) ? 9 : h
      const validM = isNaN(m) ? 0 : m
      const period = validH >= 12 ? ('PM' as const) : ('AM' as const)
      let h12 = validH % 12
      if (h12 === 0) h12 = 12

      return {
        activeHour12: h12,
        activeHour24: validH,
        activeMinute: validM,
        activePeriod: period,
      }
    }, [value])

    // Commit time change to parent
    const commitTime = React.useCallback(
      (newTime24: string) => {
        if (!onChange) return
        onChange(newTime24)
        setInputValue(formatTimeDisplay(newTime24, is12Hours))
      },
      [onChange, is12Hours]
    )

    // Handle manual text changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value)
    }

    // Handle blur: parse typed string or reset
    const handleBlur = () => {
      if (!inputValue.trim()) {
        commitTime('')
        return
      }

      const parsed = parseTimeInput(inputValue, is12Hours)
      if (parsed) {
        commitTime(parsed)
      } else {
        // Revert to current prop value
        setInputValue(formatTimeDisplay(value, is12Hours))
      }
    }

    // Handle keydown: commit on Enter, open on ArrowDown
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleBlur()
        setOpen(false)
      } else if (e.key === 'ArrowDown' && !open && !disabled) {
        e.preventDefault()
        setOpen(true)
      }
    }

    const handleClear = (e?: React.MouseEvent) => {
      e?.stopPropagation()
      commitTime('')
    }

    // Select hour in popover
    const handleSelectHour = (hourNumber: number) => {
      let next24 = hourNumber
      if (is12Hours) {
        if (activePeriod === 'PM' && hourNumber < 12) {
          next24 = hourNumber + 12
        } else if (activePeriod === 'AM' && hourNumber === 12) {
          next24 = 0
        }
      }
      const formatted = `${String(next24).padStart(2, '0')}:${String(activeMinute).padStart(2, '0')}`
      commitTime(formatted)
    }

    // Select minute in popover
    const handleSelectMinute = (minuteNumber: number) => {
      const formatted = `${String(activeHour24).padStart(2, '0')}:${String(minuteNumber).padStart(2, '0')}`
      commitTime(formatted)
    }

    // Toggle AM / PM in popover
    const handleTogglePeriod = (nextPeriod: 'AM' | 'PM') => {
      if (nextPeriod === activePeriod) return
      let next24 = activeHour24
      if (nextPeriod === 'PM' && next24 < 12) {
        next24 += 12
      } else if (nextPeriod === 'AM' && next24 >= 12) {
        next24 -= 12
      }
      const formatted = `${String(next24).padStart(2, '0')}:${String(activeMinute).padStart(2, '0')}`
      commitTime(formatted)
    }

    const placeholderText = placeholder || (is12Hours ? 'hh:mm AM' : 'HH:mm')

    // Common school exam hours
    const hours12List = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
    const minutesList = [0, 15, 30, 45]

    return (
      <PopoverPrimitive.Root modal={modal} open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Anchor asChild>
          <div className="relative w-full min-w-[110px]">
            <Input
              ref={ref}
              type="text"
              id={id}
              name={name}
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={placeholderText}
              disabled={disabled}
              error={error}
              aria-invalid={ariaInvalid ?? (error ? true : undefined)}
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              className={cn('pe-12 text-sm font-mono', className)}
            />
            <div className="absolute end-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {value && !disabled && clearable && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-0.5 rounded hover:bg-hover-bg text-text-subtle hover:text-text transition-colors outline-none"
                  title={__('Clear time', 'codeclove-school-management')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <PopoverPrimitive.Trigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className="p-0.5 rounded hover:bg-hover-bg text-text-subtle hover:text-text transition-colors cursor-pointer outline-none"
                  title={__('Open Time Picker', 'codeclove-school-management')}
                >
                  <Clock className="h-4 w-4" />
                </button>
              </PopoverPrimitive.Trigger>
            </div>
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Portal container={portalContainer}>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            className="z-[100050] p-3 rounded-xl border border-border bg-bg-overlay shadow-modal outline-none w-72 select-none space-y-3"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {/* Quick School Presets */}
            {presets.length > 0 && (
              <div>
                <p className="text-3xs font-semibold uppercase tracking-wider text-text-subtle mb-1.5">
                  {__('Standard Shifts', 'codeclove-school-management')}
                </p>
                <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto pr-0.5">
                  {presets.map((preset) => {
                    const isSelected = value === preset.value
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => {
                          commitTime(preset.value)
                          setOpen(false)
                        }}
                        className={cn(
                          'px-2 py-1 text-2xs font-mono font-medium rounded-md border text-left transition-colors flex items-center justify-between',
                          isSelected
                            ? 'bg-brand text-text-inverted border-brand font-semibold shadow-xs'
                            : 'bg-bg-surface hover:bg-hover-bg border-border text-text'
                        )}
                      >
                        <span>{preset.label}</span>
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Custom Interactive Columns */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xs font-semibold uppercase tracking-wider text-text-subtle">
                  {__('Custom Time', 'codeclove-school-management')}
                </span>

                {is12Hours && (
                  <div className="inline-flex rounded-md border border-border bg-bg-surface p-0.5 text-3xs font-semibold">
                    <button
                      type="button"
                      onClick={() => handleTogglePeriod('AM')}
                      className={cn(
                        'px-2 py-0.5 rounded transition-colors',
                        activePeriod === 'AM'
                          ? 'bg-brand text-text-inverted shadow-xs'
                          : 'text-text-muted hover:text-text'
                      )}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePeriod('PM')}
                      className={cn(
                        'px-2 py-0.5 rounded transition-colors',
                        activePeriod === 'PM'
                          ? 'bg-brand text-text-inverted shadow-xs'
                          : 'text-text-muted hover:text-text'
                      )}
                    >
                      PM
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Hours Grid */}
                <div>
                  <span className="block text-3xs text-text-muted mb-1 text-center font-medium">
                    {__('Hour', 'codeclove-school-management')}
                  </span>
                  <div className="grid grid-cols-3 gap-1 bg-bg-surface p-1.5 rounded-lg border border-border">
                    {hours12List.map((h) => {
                      const isSelected = activeHour12 === h
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => handleSelectHour(h)}
                          className={cn(
                            'h-6 text-xs font-mono font-medium rounded transition-colors flex items-center justify-center',
                            isSelected
                              ? 'bg-brand text-text-inverted font-bold shadow-xs'
                              : 'hover:bg-hover-bg text-text'
                          )}
                        >
                          {h}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Minutes Grid */}
                <div>
                  <span className="block text-3xs text-text-muted mb-1 text-center font-medium">
                    {__('Minute', 'codeclove-school-management')}
                  </span>
                  <div className="grid grid-cols-2 gap-1 bg-bg-surface p-1.5 rounded-lg border border-border">
                    {minutesList.map((m) => {
                      const isSelected = activeMinute === m
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleSelectMinute(m)}
                          className={cn(
                            'h-6 text-xs font-mono font-medium rounded transition-colors flex items-center justify-center',
                            isSelected
                              ? 'bg-brand text-text-inverted font-bold shadow-xs'
                              : 'hover:bg-hover-bg text-text'
                          )}
                        >
                          :{String(m).padStart(2, '0')}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="mt-2.5 pt-2 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-brand text-text-inverted hover:bg-brand-strong transition-colors"
                >
                  {__('Done', 'codeclove-school-management')}
                </button>
              </div>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    )
  }
)

TimePicker.displayName = 'TimePicker'
