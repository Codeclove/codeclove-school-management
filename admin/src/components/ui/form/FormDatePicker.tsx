import * as React from 'react'
import { useController, type Control } from 'react-hook-form'
import { DatePicker } from '@/components/ui/DatePicker'
import { cn } from '@/lib/utils'

export interface FormDatePickerProps {
  /** Form field key path */
  name: string
  /** Optional react-hook-form control (defaults to context from FormProvider) */
  control?: Control<any>
  /** Visible label text */
  label?: React.ReactNode
  /** Mark field as required */
  required?: boolean
  /** Explanatory hint text */
  hint?: React.ReactNode
  /** Disabled state */
  disabled?: boolean
  /** Input placeholder guide */
  placeholder?: string
  /** Allow clearing selected date */
  clearable?: boolean
  /** Earliest selectable date */
  minDate?: Date
  /** Latest selectable date */
  maxDate?: Date
  /** Portal container */
  container?: HTMLElement | null
  /** Radix modal behavior */
  modal?: boolean
  /** Manual error override */
  error?: string
  /** If true, converts YYYY-MM-DD value to full ISO timestamp on change */
  isoFormat?: boolean
  /** Wrapper container class */
  className?: string
  /** Inner date picker trigger class */
  pickerClassName?: string
  /** Label class */
  labelClassName?: string
  /** Expand across full grid width */
  fullWidth?: boolean
  /** Custom ID for element and accessibility linkages */
  id?: string
  /** Secondary change callback */
  onChange?: (value: string) => void
}

/**
 * Tier 2 FormDatePicker — Accessible date picker bound to react-hook-form via useController.
 * Bridges full ISO string date / YYYY-MM-DD representations cleanly with the DatePicker primitive.
 */
export function FormDatePicker({
  name,
  control,
  label,
  required = false,
  hint,
  disabled = false,
  placeholder,
  clearable = true,
  minDate,
  maxDate,
  container,
  modal = true,
  error,
  isoFormat = false,
  className,
  pickerClassName,
  labelClassName,
  fullWidth = false,
  id,
  onChange,
}: FormDatePickerProps) {
  const {
    field,
    fieldState: { error: fieldError },
  } = useController({ name, control })

  const errorMessage = error ?? fieldError?.message

  // Generate deterministic accessible IDs
  const pickerId = id || `form-datepicker-${name.replace(/[.[\]]/g, '-')}`
  const errorId = `${pickerId}-error`
  const hintId = `${pickerId}-hint`
  const describedBy = errorMessage ? errorId : hint ? hintId : undefined

  // Bridge incoming date value (Date object, full ISO timestamp, or YYYY-MM-DD) to YYYY-MM-DD string
  const dateValue = React.useMemo(() => {
    if (!field.value) return ''
    if (field.value instanceof Date) {
      if (isNaN(field.value.getTime())) return ''
      const year = field.value.getFullYear()
      const month = String(field.value.getMonth() + 1).padStart(2, '0')
      const day = String(field.value.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    if (typeof field.value === 'string') {
      if (field.value.includes('T')) {
        return field.value.split('T')[0] || ''
      }
      return field.value
    }
    return ''
  }, [field.value])

  const handleChange = (val: string) => {
    const result = isoFormat && val ? new Date(`${val}T00:00:00Z`).toISOString() : val
    field.onChange(result)
    onChange?.(result)
  }

  return (
    <div className={cn('space-y-1 min-w-0', fullWidth && 'col-span-full', className)}>
      {label && (
        <label
          htmlFor={pickerId}
          className={cn('block text-sm font-medium text-text leading-tight', labelClassName)}
        >
          {label}
          {required && (
            <span className="text-danger ms-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <DatePicker
        id={pickerId}
        name={field.name}
        value={dateValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled || field.disabled}
        clearable={clearable}
        minDate={minDate}
        maxDate={maxDate}
        container={container}
        modal={modal}
        error={!!errorMessage}
        className={pickerClassName}
        aria-invalid={!!errorMessage}
        aria-describedby={describedBy}
      />

      {errorMessage && (
        <p id={errorId} role="alert" className="text-2xs text-danger leading-tight mt-1">
          {errorMessage}
        </p>
      )}

      {!errorMessage && hint && (
        <p id={hintId} className="text-2xs text-text-muted leading-normal mt-1">
          {hint}
        </p>
      )}
    </div>
  )
}
