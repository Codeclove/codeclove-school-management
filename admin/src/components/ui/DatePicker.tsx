/**
 * DatePicker — Premium Radix-based date picker wrapped in CodeClove design tokens.
 * Supports both calendar selection and manual keyboard input matching the school localization settings.
 *
 * Usage:
 *   <DatePicker value={date} onChange={setDate} placeholder="Pick a date..." />
 */
import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { DayPicker } from 'react-day-picker'
import { format, parse, isValid } from 'date-fns'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { cn, getPortalContainer } from '@/lib/utils'
import { useSettings } from '@/api/settings'
import { Input } from './Input'
import { __ } from '@/lib/i18n'
import { isRtl } from '@/lib/rtl'
// Styles for react-day-picker (v10 format defaults fallback)
import 'react-day-picker/style.css'

// Helper to parse dates with multiple formats and delimiters flexibly
export function parseFlexibleDate(val: string, formatStr: string): Date | null {
  const cleanVal = val.trim()
  if (!cleanVal) return null

  // 1. Try exact parse with the format string first
  let parsed = parse(cleanVal, formatStr, new Date())
  if (isValid(parsed)) return parsed

  // 2. Try normalizing delimiters and matching formats
  const normalizedVal = cleanVal.replace(/[-.\s]/g, '/')
  const normalizedFormat = formatStr.replace(/[-.\s]/g, '/')
  parsed = parse(normalizedVal, normalizedFormat, new Date())
  if (isValid(parsed)) return parsed

  // 3. Positional parsing based on component indices (DMY, MDY, YMD)
  const lowerFormat = formatStr.toLowerCase()
  const dIdx = lowerFormat.indexOf('d')
  const mIdx = lowerFormat.indexOf('m')
  const yIdx = lowerFormat.indexOf('y')

  const parts = cleanVal.split(/[^0-9]+/)
  if (parts.length === 3) {
    let day = 0, month = 0, year = 0

    const indices = [
      { name: 'd', idx: dIdx },
      { name: 'm', idx: mIdx },
      { name: 'y', idx: yIdx },
    ].sort((a, b) => a.idx - b.idx)

    indices.forEach((item, index) => {
      const partVal = parseInt(parts[index] || '', 10)
      if (item.name === 'd') day = partVal
      if (item.name === 'm') month = partVal
      if (item.name === 'y') year = partVal
    })

    if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      if (year < 100) {
        year = year >= 50 ? 1900 + year : 2000 + year
      }
      const testDate = new Date(year, month - 1, day)
      if (
        isValid(testDate) &&
        testDate.getDate() === day &&
        testDate.getMonth() === month - 1 &&
        testDate.getFullYear() === year
      ) {
        return testDate
      }
    }
  }

  // 4. Native JS date parse fallback
  const nativeTime = Date.parse(cleanVal)
  if (!isNaN(nativeTime)) {
    const nativeDate = new Date(nativeTime)
    if (isValid(nativeDate)) return nativeDate
  }

  return null
}

export interface DatePickerProps {
  value?: string // YYYY-MM-DD format
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  error?: boolean
  className?: string
  id?: string
  name?: string
  minDate?: Date
  maxDate?: Date
  container?: HTMLElement | null
  modal?: boolean
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
  'aria-label'?: string
}
export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      placeholder,
      disabled = false,
      clearable = true,
      error = false,
      className,
      id,
      name,
      minDate,
      maxDate,
      container,
      modal = true,
      'aria-invalid': ariaInvalid,
      'aria-describedby': ariaDescribedBy,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const { data: settings } = useSettings()
    const portalContainer = getPortalContainer(container)
    const dateFormat = settings?.localization?.date_format || 'd/m/Y'

    // Map PHP date format to date-fns format strings for the text input
    const formatString = React.useMemo(() => {
      if (dateFormat.startsWith('Y')) {
        return 'yyyy-MM-dd'
      }
      
      const mIdx = Math.max(dateFormat.indexOf('m'), dateFormat.indexOf('F'), dateFormat.indexOf('M'))
      const dIdx = Math.max(dateFormat.indexOf('d'), dateFormat.indexOf('j'))
      
      if (mIdx !== -1 && dIdx !== -1 && mIdx < dIdx) {
        if (dateFormat.includes('-')) return 'MM-dd-yyyy'
        return 'MM/dd/yyyy'
      } else {
        if (dateFormat.includes('-')) return 'dd-MM-yyyy'
        return 'dd/MM/yyyy'
      }
    }, [dateFormat])

    // Map PHP date format to user placeholder guide
    const placeholderText = React.useMemo(() => {
      if (placeholder) return placeholder
      if (formatString === 'yyyy-MM-dd') return 'YYYY-MM-DD'
      if (formatString === 'MM-dd-yyyy') return 'MM-DD-YYYY'
      if (formatString === 'dd-MM-yyyy') return 'DD-MM-YYYY'
      if (formatString === 'MM/dd/yyyy') return 'MM/DD/YYYY'
      return 'DD/MM/YYYY'
    }, [formatString, placeholder])

    // Local text input state
    const [inputValue, setInputValue] = React.useState('')

    // Convert value (YYYY-MM-DD string) to Date object
    const selectedDate = React.useMemo(() => {
      if (!value) return undefined
      const parsed = parse(value, 'yyyy-MM-dd', new Date())
      return isValid(parsed) ? parsed : undefined
    }, [value])

    // Keep local text input synchronized with incoming value prop (unless focused)
    React.useEffect(() => {
      if (selectedDate) {
        setInputValue(format(selectedDate, formatString))
      } else {
        setInputValue('')
      }
    }, [value, selectedDate, formatString])

    // Handle manual typing change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setInputValue(val)

      if (!onChange) return

      if (!val) {
        onChange('')
        return
      }

      // Quick validation if typed length matches format exactly
      if (val.length === formatString.length) {
        const parsed = parse(val, formatString, new Date())
        if (isValid(parsed)) {
          if (minDate && parsed < minDate) return
          if (maxDate && parsed > maxDate) return
          onChange(format(parsed, 'yyyy-MM-dd'))
        }
      }
    }

    // Handle blur: commit parsed value or reset input text
    const handleBlur = () => {
      if (!onChange) return

      if (!inputValue.trim()) {
        onChange('')
        setInputValue('')
        return
      }

      const parsed = parseFlexibleDate(inputValue, formatString)
      if (parsed) {
        if (minDate && parsed < minDate) {
          setInputValue(selectedDate ? format(selectedDate, formatString) : '')
          return
        }
        if (maxDate && parsed > maxDate) {
          setInputValue(selectedDate ? format(selectedDate, formatString) : '')
          return
        }
        const formattedValue = format(parsed, 'yyyy-MM-dd')
        onChange(formattedValue)
        setInputValue(format(parsed, formatString))
      } else {
        // Revert to previously selected date or empty
        setInputValue(selectedDate ? format(selectedDate, formatString) : '')
      }
    }

    // Handle keydown: commit and close popover on Enter, open on ArrowDown
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

    // Handle selecting from calendar grid
    const handleSelect = React.useCallback(
      (date: Date | undefined) => {
        if (!onChange) return
        if (!date) {
          onChange('')
          setInputValue('')
        } else {
          onChange(format(date, 'yyyy-MM-dd'))
          setInputValue(format(date, formatString))
        }
        setOpen(false)
      },
      [onChange, formatString]
    )

    const handleClear = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        setInputValue('')
        if (onChange) {
          onChange('')
        }
      },
      [onChange]
    )

    // Build disabled matcher array dynamically for react-day-picker v10
    const disabledMatchers = React.useMemo(() => {
      const matchers: any[] = []
      if (minDate) matchers.push({ before: minDate })
      if (maxDate) matchers.push({ after: maxDate })
      return matchers.length > 0 ? matchers : undefined
    }, [minDate, maxDate])

    const defaultStartMonth = React.useMemo(() => new Date(new Date().getFullYear() - 100, 0), [])
    const defaultEndMonth = React.useMemo(() => new Date(new Date().getFullYear() + 10, 11), [])

    return (
      <PopoverPrimitive.Root modal={modal} open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Anchor asChild>
          {/* Trigger Container matching exactly our standard inputs */}
          <div className="relative w-full min-w-[140px]">
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
              className={cn('pe-12 truncate text-sm', className)}
            />
            <div className="absolute end-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {value && !disabled && clearable && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-0.5 rounded hover:bg-hover-bg text-text-subtle hover:text-text transition-colors outline-none"
                  title={__( 'Clear date', 'codeclove-school-management' )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <PopoverPrimitive.Trigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className="p-0.5 rounded hover:bg-hover-bg text-text-subtle hover:text-text transition-colors cursor-pointer outline-none"
                  title={__( 'Open Calendar', 'codeclove-school-management' )}
                >
                  <CalendarIcon className="h-4 w-4" />
                </button>
              </PopoverPrimitive.Trigger>
            </div>
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Portal container={portalContainer}>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            className="z-[10000] p-3 rounded-lg border border-border bg-bg-overlay shadow-modal outline-none"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DayPicker
              dir={isRtl() ? 'rtl' : 'ltr'}
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              disabled={disabledMatchers}
              captionLayout="dropdown"
              startMonth={minDate || defaultStartMonth}
              endMonth={maxDate || defaultEndMonth}
              classNames={{
                months: 'flex flex-col space-y-4',
                month: 'space-y-4',
                month_caption: 'flex justify-between items-center px-1 pb-2 gap-4',
                caption_label: 'text-sm font-semibold text-text hidden',
                dropdowns: 'flex gap-1.5 items-center',
                dropdown: 'bg-bg-base dark:bg-bg-overlay text-text text-xs font-semibold border border-border rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-border-strong transition-colors',
                nav: 'flex items-center gap-1',
                button_previous: cn(
                  'h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100 transition-opacity flex items-center justify-center rounded border border-border hover:bg-hover-bg text-text cursor-pointer'
                ),
                button_next: cn(
                  'h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100 transition-opacity flex items-center justify-center rounded border border-border hover:bg-hover-bg text-text cursor-pointer'
                ),
                month_grid: 'w-full border-collapse space-y-1',
                weekdays: 'flex',
                weekday: 'text-text-muted rounded-md w-8 font-normal text-[0.75rem] text-center uppercase tracking-wider',
                week: 'flex w-full mt-1.5',
                day: cn(
                  'h-8 w-8 p-0 font-normal aria-selected:opacity-100 flex items-center justify-center rounded hover:bg-hover-bg transition-colors cursor-pointer text-text text-sm'
                ),
                day_button: 'w-full h-full flex items-center justify-center bg-transparent border-none outline-none cursor-pointer',
                selected: 'bg-brand text-white hover:bg-brand-strong hover:text-white focus:bg-brand focus:text-white',
                today: 'bg-bg-base border border-brand/40 text-brand font-semibold',
                outside: 'text-text-muted opacity-40 aria-selected:opacity-30',
                disabled: 'text-text-muted opacity-20 cursor-not-allowed hover:bg-transparent',
                hidden: 'invisible',
              }}
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    )
  }
)

DatePicker.displayName = 'DatePicker'
