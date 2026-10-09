import * as React from 'react'
import { useController, type Control } from 'react-hook-form'
import {
  Select,
  type SelectOption,
  type SelectGroup,
} from '@/components/ui/Select'
import { cn } from '@/lib/utils'

export interface FormSelectProps {
  /** Form field key path */
  name: string
  /** Optional react-hook-form control (defaults to context from FormProvider) */
  control?: Control<any>
  /** Visible label text */
  label?: React.ReactNode
  /** Flat list of selectable options */
  options?: SelectOption[]
  /** Grouped options */
  groups?: SelectGroup[]
  /** Placeholder when nothing is selected */
  placeholder?: string
  /** Mark field as required */
  required?: boolean
  /** Explanatory hint text */
  hint?: React.ReactNode
  /** Disabled state */
  disabled?: boolean
  /** Manual error override */
  error?: string
  /** Wrapper container class */
  className?: string
  /** Inner select trigger class */
  selectClassName?: string
  /** Label class */
  labelClassName?: string
  /** Expand across full grid width */
  fullWidth?: boolean
  /** Custom ID for element and accessibility linkages */
  id?: string
  /** Optional portal container for select dropdown */
  container?: HTMLElement | null
  /** Optional secondary change callback */
  onValueChange?: (value: string) => void
}

/**
 * Tier 2 FormSelect — Accessible select dropdown bound to react-hook-form via useController.
 * Bridges value and onValueChange cleanly with Radix Select primitive while enforcing
 * WCAG AA label and error accessibility.
 */
export function FormSelect({
  name,
  control,
  label,
  options = [],
  groups,
  placeholder,
  required = false,
  hint,
  disabled = false,
  error,
  className,
  selectClassName,
  labelClassName,
  fullWidth = false,
  id,
  container,
  onValueChange,
}: FormSelectProps) {
  const {
    field,
    fieldState: { error: fieldError },
  } = useController({ name, control })

  const errorMessage = error ?? fieldError?.message

  // Generate deterministic accessible IDs
  const selectId = id || `form-select-${name.replace(/[.[\]]/g, '-')}`
  const errorId = `${selectId}-error`
  const hintId = `${selectId}-hint`
  const describedBy = errorMessage ? errorId : hint ? hintId : undefined

  // Bridge string/number/null value to Radix Select's expected string | undefined
  const selectValue =
    field.value !== undefined && field.value !== null && field.value !== ''
      ? String(field.value)
      : undefined

  const handleValueChange = (val: string) => {
    field.onChange(val)
    onValueChange?.(val)
  }

  return (
    <div className={cn('space-y-1 min-w-0', fullWidth && 'col-span-full', className)}>
      {label && (
        <label
          htmlFor={selectId}
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

      <Select
        id={selectId}
        name={field.name}
        value={selectValue}
        onValueChange={handleValueChange}
        options={options}
        groups={groups}
        placeholder={placeholder}
        disabled={disabled || field.disabled}
        error={!!errorMessage}
        className={selectClassName}
        container={container}
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
