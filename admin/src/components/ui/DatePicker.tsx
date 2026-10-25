/**
 * DatePicker — Premium Radix-based date picker wrapped in CodeClove design tokens.
 * Supports both calendar selection and manual keyboard input matching the school localization settings.
 *
 * Usage:
 *   <DatePicker value={date} onChange={setDate} placeholder="Pick a date..." />
 */
import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { DayPicker, DayButton, type Matcher } from 'react-day-picker'
import { format, parse, isValid } from 'date-fns'
import { Calendar as CalendarIcon, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn, getPortalContainer } from '@/lib/utils'
import { useSettings } from '@/api/settings'
import { Input } from './Input'
import { __ } from '@/lib/i18n'
import { isRtl } from '@/lib/rtl'
import { parseFlexibleDate } from './date-picker-utils'

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

function CalendarDayButton({ day, modifiers, className, ...props }: React.ComponentProps<typeof DayButton>) {
  const isSelected = Boolean(modifiers.selected)
  const isToday = Boolean(modifiers.today) && !isSelected

  return (
    <button
      type="button"
      className={cn(
        'h-8 w-8 mx-auto p-0 flex items-center justify-center rounded-md text-sm font-medium transition-colors select-none outline-none text-text hover:bg-hover-bg cursor-pointer focus-visible:ring-2 focus-visible:ring-brand',
        modifiers.outside && 'text-text-muted/40 font-normal hover:bg-transparent',
        isToday && 'bg-brand-dim text-brand font-bold border border-brand-border hover:bg-brand-dim',
        isSelected && 'bg-brand text-text-inverted font-semibold hover:bg-brand-strong shadow-xs',
        modifiers.disabled && 'text-text-muted/20 cursor-not-allowed hover:bg-transparent pointer-events-none',
        className
      )}
      {...props}
    >
      {day.date.getDate()}
    </button>
  )
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
      (e?: React.MouseEvent) => {
        e?.stopPropagation()
        setInputValue('')
        if (onChange) {
          onChange('')
        }
      },
      [onChange]
    )

    // Keep calendar viewing month synchronized with value
    const [month, setMonth] = React.useState<Date>(() => selectedDate || new Date())
    React.useEffect(() => {
      if (selectedDate) {
        setMonth(selectedDate)
      }
    }, [selectedDate])

    // Build disabled matcher array dynamically for react-day-picker v10
    const disabledMatchers = React.useMemo(() => {
      const matchers: Matcher[] = []
      if (minDate) matchers.push({ before: minDate })
      if (maxDate) matchers.push({ after: maxDate })
      return matchers.length > 0 ? matchers : undefined
    }, [minDate, maxDate])

    const defaultStartMonth = React.useMemo(() => new Date(new Date().getFullYear() - 100, 0), [])
    const defaultEndMonth = React.useMemo(() => new Date(new Date().getFullYear() + 10, 11), [])

    const isTodayDisabled = React.useMemo(() => {
      const today = new Date().setHours(0, 0, 0, 0)
      return Boolean(
        (minDate && today < new Date(minDate).setHours(0, 0, 0, 0)) ||
        (maxDate && today > new Date(maxDate).setHours(0, 0, 0, 0))
      )
    }, [minDate, maxDate])

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
            className="z-[100050] p-3 rounded-xl border border-border bg-bg-overlay shadow-modal outline-none w-auto select-none"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DayPicker
              dir={isRtl() ? 'rtl' : 'ltr'}
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              month={month}
              onMonthChange={setMonth}
              disabled={disabledMatchers}
              captionLayout="dropdown"
              showOutsideDays={true}
              startMonth={minDate || defaultStartMonth}
              endMonth={maxDate || defaultEndMonth}
              components={{
                Chevron: ({ orientation, className, ...chevronProps }) => {
                  if (orientation === 'left' || orientation === 'right') {
                    const Icon = (orientation === 'left') !== isRtl() ? ChevronLeft : ChevronRight
                    return <Icon className={cn('h-4 w-4 text-text', className)} {...chevronProps} />
                  }
                  return <ChevronDown className={cn('h-3.5 w-3.5 text-text-muted', className)} {...chevronProps} />
                },
                DayButton: CalendarDayButton,
              }}
              classNames={{
                root: 'w-[256px] select-none',
                months: 'relative flex flex-col',
                month: 'space-y-3',
                nav: 'absolute inset-x-0 top-0 flex w-full items-center justify-between pointer-events-none z-10',
                button_previous:
                  'pointer-events-auto h-8 w-8 bg-bg-surface p-0 flex items-center justify-center rounded-md border border-border hover:bg-hover-bg text-text transition-colors shadow-xs cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-brand',
                button_next:
                  'pointer-events-auto h-8 w-8 bg-bg-surface p-0 flex items-center justify-center rounded-md border border-border hover:bg-hover-bg text-text transition-colors shadow-xs cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-brand',
                month_caption: 'flex h-8 w-full items-center justify-center px-9',
                dropdowns: 'flex h-8 items-center justify-center gap-1.5',
                dropdown_root:
                  'relative inline-flex h-8 items-center rounded-md border border-border bg-bg-surface px-2.5 text-xs font-semibold text-text shadow-xs hover:bg-hover-bg hover:border-border-strong transition-colors cursor-pointer',
                dropdown: 'absolute inset-0 w-full h-full opacity-0 cursor-pointer',
                caption_label:
                  'flex h-8 items-center gap-1 text-xs font-semibold text-text select-none',
                month_grid: 'w-full border-collapse',
                weekdays: 'flex w-full mb-1',
                weekday:
                  'flex-1 h-8 text-center text-text-subtle font-semibold text-[0.72rem] uppercase tracking-wider select-none flex items-center justify-center',
                week: 'flex w-full mt-1',
                day: 'flex-1 h-8 text-center p-0 select-none flex items-center justify-center',
                hidden: 'invisible',
              }}
            />

            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border text-xs">
              {clearable ? (
                <button
                  type="button"
                  onClick={() => {
                    handleClear()
                    setOpen(false)
                  }}
                  disabled={!value}
                  className={cn(
                    'font-medium px-2.5 py-1 rounded-md transition-colors text-text-muted hover:text-text hover:bg-hover-bg cursor-pointer',
                    !value && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-text-muted'
                  )}
                >
                  {__( 'Clear', 'codeclove-school-management' )}
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                disabled={isTodayDisabled}
                onClick={() => {
                  const today = new Date()
                  handleSelect(today)
                }}
                className={cn(
                  'font-semibold px-2.5 py-1 rounded-md transition-colors text-brand hover:text-brand-strong hover:bg-brand-dim cursor-pointer',
                  isTodayDisabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
                )}
              >
                {__( 'Today', 'codeclove-school-management' )}
              </button>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    )
  }
)

DatePicker.displayName = 'DatePicker'
