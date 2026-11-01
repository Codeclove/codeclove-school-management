/**
 * TimeRangePicker — Simple, intuitive examination time slot picker.
 *
 * Features:
 * - 1-Click Standard Shifts: Click any preset to immediately select both Start and End time.
 * - Clean Start & End Selectors: 30-minute intervals with auto-duration calculation.
 * - Single-line table trigger: Displays "09:00 – 11:30 AM • 2.5h" with a clear button.
 * - Zero nested scrollbars or multi-step wizards.
 *
 * Usage:
 *   <TimeRangePicker
 *     startTime={row.start_time}
 *     endTime={row.end_time}
 *     onChange={(start, end) => handleSlotChange(start, end)}
 *   />
 */
import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Clock, X, Check } from 'lucide-react'
import { cn, getPortalContainer } from '@/lib/utils'
import { formatTimeDisplay } from './TimePicker'
import { __ } from '@/lib/i18n'

export interface TimeSlotPreset {
  label: string
  startTime: string // HH:mm (24h)
  endTime: string   // HH:mm (24h)
}

export interface TimeRangePickerProps {
  startTime?: string | null // HH:mm (24h)
  endTime?: string | null   // HH:mm (24h)
  onChange?: (startTime: string, endTime: string) => void
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
  presets?: TimeSlotPreset[]
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
  'aria-label'?: string
}

/**
 * Common standard school exam shifts
 */
export const DEFAULT_EXAM_PRESETS: TimeSlotPreset[] = [
  { label: 'Morning Session (2.5 hrs)', startTime: '09:00', endTime: '11:30' },
  { label: 'Morning Full-Length (3.0 hrs)', startTime: '09:00', endTime: '12:00' },
  { label: 'Late Morning (3.0 hrs)', startTime: '09:30', endTime: '12:30' },
  { label: 'Afternoon Session (2.5 hrs)', startTime: '13:30', endTime: '16:00' },
  { label: 'Short Paper / Practical (1.5 hrs)', startTime: '09:00', endTime: '10:30' },
]

/**
 * Standard 30-minute school time intervals
 */
const TIME_OPTIONS = [
  '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
  '16:30', '17:00', '17:30', '18:00',
]

/**
 * Calculate duration text from two HH:mm strings
 */
export function calculateDurationText(startTime?: string | null, endTime?: string | null): string | null {
  if (!startTime || !endTime || !startTime.includes(':') || !endTime.includes(':')) return null
  const sParts = startTime.split(':')
  const eParts = endTime.split(':')
  if (sParts.length < 2 || eParts.length < 2) return null

  const sh = parseInt(sParts[0] ?? '', 10)
  const sm = parseInt(sParts[1] ?? '', 10)
  const eh = parseInt(eParts[0] ?? '', 10)
  const em = parseInt(eParts[1] ?? '', 10)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null

  const totalStart = sh * 60 + sm
  const totalEnd = eh * 60 + em
  const diffMinutes = totalEnd - totalStart
  if (diffMinutes <= 0) return null

  const hours = Math.floor(diffMinutes / 60)
  const mins = diffMinutes % 60
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
  if (hours > 0) return `${hours}h`
  return `${mins}m`
}

/**
 * Add minutes to a 24-hour HH:mm string
 */
function addMinutes(time24: string, minutesToAdd: number): string {
  const parts = time24.split(':')
  const h = parseInt(parts[0] || '9', 10)
  const m = parseInt(parts[1] || '0', 10)
  const total = h * 60 + m + minutesToAdd
  const nextH = Math.floor(total / 60) % 24
  const nextM = total % 60
  return `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`
}

export const TimeRangePicker = React.forwardRef<HTMLButtonElement, TimeRangePickerProps>(
  (
    {
      startTime = '',
      endTime = '',
      onChange,
      placeholder = __('Select time slot...', 'codeclove-school-management'),
      disabled = false,
      clearable = true,
      error = false,
      className,
      id,
      container,
      modal = true,
      use12Hours: explicit12Hours,
      presets = DEFAULT_EXAM_PRESETS,
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

    // Normalize zero-value times ('00:00', '00:00:00') into empty state
    const isZeroTime = (t?: string | null) => !t || t === '00:00' || t === '00:00:00' || t === '0:00'
    const safeStart = isZeroTime(startTime) ? '' : (startTime ?? '')
    const safeEnd = isZeroTime(endTime) ? '' : (endTime ?? '')

    // Current duration
    const durationText = React.useMemo(
      () => calculateDurationText(safeStart, safeEnd),
      [safeStart, safeEnd]
    )

    const isInvalid = Boolean(safeStart && safeEnd && safeEnd <= safeStart)
    const hasSlot = Boolean(safeStart && safeEnd && !isInvalid)

    // Dynamic options ensuring current values are always available
    const startOptions = React.useMemo(() => {
      const set = new Set(TIME_OPTIONS)
      if (safeStart && safeStart.includes(':')) set.add(safeStart)
      return Array.from(set).sort()
    }, [safeStart])

    const endOptions = React.useMemo(() => {
      const set = new Set(TIME_OPTIONS)
      if (safeEnd && safeEnd.includes(':')) set.add(safeEnd)
      return Array.from(set).sort()
    }, [safeEnd])

    // Formatted label for trigger display
    const triggerLabel = React.useMemo(() => {
      if (!safeStart && !safeEnd) return null
      if (safeStart && safeEnd) {
        const startStr = formatTimeDisplay(safeStart, is12Hours)
        const endStr = formatTimeDisplay(safeEnd, is12Hours)
        return `${startStr} – ${endStr}`
      }
      if (safeStart) {
        return `${formatTimeDisplay(safeStart, is12Hours)} – ?`
      }
      return `? – ${formatTimeDisplay(safeEnd, is12Hours)}`
    }, [safeStart, safeEnd, is12Hours])

    // Commit time slot change
    const commitSlot = React.useCallback(
      (nextStart: string, nextEnd: string) => {
        if (!onChange) return
        onChange(nextStart, nextEnd)
      },
      [onChange]
    )

    // Handle clear
    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation()
      commitSlot('', '')
    }

    // Handle Start dropdown change (auto-defaults End to +2.5 hours if unset or invalid)
    const handleStartChange = (newStart: string) => {
      let targetEnd = endTime
      if (!targetEnd || targetEnd <= newStart) {
        targetEnd = addMinutes(newStart, 150)
      }
      commitSlot(newStart, targetEnd)
    }

    // Handle End dropdown change
    const handleEndChange = (newEnd: string) => {
      const targetStart = startTime || '09:00'
      commitSlot(targetStart, newEnd)
    }

    return (
      <PopoverPrimitive.Root modal={modal} open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Anchor asChild>
          <div className="relative inline-flex items-center w-full min-w-[190px]">
            <button
              ref={ref}
              type="button"
              id={id}
              disabled={disabled}
              onClick={() => setOpen((prev) => !prev)}
              aria-invalid={ariaInvalid ?? (error ? true : undefined)}
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              aria-expanded={open}
              className={cn(
                'w-full h-8 px-2.5 rounded border border-border shadow-xs text-start transition-colors flex items-center justify-between gap-1.5 outline-none select-none',
                error || isInvalid
                  ? 'border-danger focus-visible:ring-2 focus-visible:ring-danger/20'
                  : 'hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand',
                disabled
                  ? 'bg-bg-elevated/50 text-text-muted/40 cursor-not-allowed pointer-events-none'
                  : 'bg-bg-surface text-text cursor-pointer hover:bg-hover-bg/40',
                className
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Clock className="h-3.5 w-3.5 text-text-subtle shrink-0" />
                {triggerLabel ? (
                  <span className="font-mono text-xs font-medium text-text truncate">
                    {triggerLabel}
                  </span>
                ) : (
                  <span className="text-xs text-text-subtle/70 truncate">
                    {placeholder}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {hasSlot && durationText && (
                  <span className="font-mono text-3xs font-semibold px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-text-muted shrink-0">
                    {durationText}
                  </span>
                )}

                {hasSlot && !disabled && clearable && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={handleClear}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation()
                        commitSlot('', '')
                      }
                    }}
                    className="p-0.5 rounded hover:bg-hover-bg text-text-subtle hover:text-text transition-colors cursor-pointer"
                    title={__('Clear time slot', 'codeclove-school-management')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </button>
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Portal container={portalContainer}>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            className="z-[100050] p-3 rounded-xl border border-border bg-bg-overlay shadow-modal outline-none w-80 select-none space-y-3"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {/* 1. Custom Start & End Dropdowns */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-3xs font-semibold uppercase tracking-wider text-text-subtle">
                  {__('Session Timing', 'codeclove-school-management')}
                </span>
                {durationText && !isInvalid && (
                  <span className="font-mono text-3xs font-bold px-1.5 py-0.5 rounded bg-brand-dim text-brand border border-brand/20">
                    {durationText}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-3xs text-text-muted block mb-1 font-medium">
                    {__('Start Time', 'codeclove-school-management')}
                  </label>
                  <select
                    value={startTime || '09:00'}
                    onChange={(e) => handleStartChange(e.target.value)}
                    className="w-full h-8 px-2 text-xs font-mono rounded-lg border border-border bg-bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
                  >
                    {startOptions.map((t) => (
                      <option key={t} value={t}>
                        {formatTimeDisplay(t, is12Hours)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-3xs text-text-muted block mb-1 font-medium">
                    {__('End Time', 'codeclove-school-management')}
                  </label>
                  <select
                    value={endTime || '11:30'}
                    onChange={(e) => handleEndChange(e.target.value)}
                    className="w-full h-8 px-2 text-xs font-mono rounded-lg border border-border bg-bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
                  >
                    {endOptions.map((t) => (
                      <option key={t} value={t}>
                        {formatTimeDisplay(t, is12Hours)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isInvalid && (
                <p className="text-3xs text-danger font-medium leading-tight">
                  {__('End time must be after start time', 'codeclove-school-management')}
                </p>
              )}
            </div>

            {/* 2. Standard Institutional Shifts (1-Click Fill) */}
            {presets.length > 0 && (
              <div className="pt-2.5 border-t border-border space-y-1">
                <span className="text-3xs font-semibold uppercase tracking-wider text-text-subtle block mb-1">
                  {__('Standard Shifts (1-Click)', 'codeclove-school-management')}
                </span>

                <div className="space-y-0.5">
                  {presets.map((preset) => {
                    const isSelected =
                      startTime === preset.startTime && endTime === preset.endTime
                    const presetDuration = calculateDurationText(
                      preset.startTime,
                      preset.endTime
                    )

                    return (
                      <button
                        key={`${preset.startTime}-${preset.endTime}`}
                        type="button"
                        onClick={() => {
                          commitSlot(preset.startTime, preset.endTime)
                          setOpen(false)
                        }}
                        className={cn(
                          'w-full px-2.5 py-1.5 rounded-lg text-left transition-colors flex items-center justify-between group cursor-pointer',
                          isSelected
                            ? 'bg-brand text-text-inverted font-semibold shadow-xs'
                            : 'hover:bg-hover-bg text-text'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected ? (
                            <Check className="h-3.5 w-3.5 text-text-inverted shrink-0" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-text-subtle group-hover:text-text shrink-0" />
                          )}
                          <span className="text-xs font-medium truncate">
                            {preset.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 font-mono text-3xs shrink-0">
                          <span className={isSelected ? 'text-text-inverted/90' : 'text-text-muted'}>
                            {formatTimeDisplay(preset.startTime, is12Hours)} – {formatTimeDisplay(preset.endTime, is12Hours)}
                          </span>
                          {presetDuration && (
                            <span
                              className={cn(
                                'px-1.5 py-0.2 rounded font-semibold',
                                isSelected
                                  ? 'bg-white/20 text-text-inverted'
                                  : 'bg-bg-elevated border border-border text-text-subtle'
                              )}
                            >
                              {presetDuration}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    )
  }
)

TimeRangePicker.displayName = 'TimeRangePicker'
