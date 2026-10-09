import * as React from 'react'
import {
  useController,
  type Control,
  type FieldValues,
  type FieldPath,
} from 'react-hook-form'
import { cn } from '@/lib/utils'

export interface FormCheckboxProps<TFieldValues extends FieldValues = FieldValues> {
  /** Form field key path */
  name: FieldPath<TFieldValues> | string
  /** Visible label text */
  label: React.ReactNode
  /** Explanatory description below the label */
  description?: React.ReactNode
  /** Optional react-hook-form control (defaults to context from FormProvider) */
  control?: Control<TFieldValues>
  /** Mark field as required */
  required?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Manual error override */
  error?: string
  /** Outer container class */
  className?: string
  /** Custom ID for element and accessibility linkages */
  id?: string
  /** Secondary change callback */
  onChange?: (checked: boolean) => void
}

/**
 * Tier 2 FormCheckbox — Accessible styled checkbox bound to react-hook-form via useController.
 * Enforces visible WCAG AA focus rings, aria-describedby for descriptions and validation errors,
 * and high-contrast indicators.
 */
export function FormCheckbox<TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  description,
  control,
  required = false,
  disabled = false,
  error,
  className,
  id,
  onChange,
}: FormCheckboxProps<TFieldValues>) {
  const {
    field,
    fieldState: { error: fieldError },
  } = useController({ name: name as unknown as FieldPath<TFieldValues>, control })

  const checked = Boolean(field.value)
  const isInputDisabled = disabled || field.disabled
  const errorMessage = error ?? fieldError?.message

  // Generate deterministic accessible IDs
  const checkboxId = id || `form-checkbox-${name.replace(/[.[\]]/g, '-')}`
  const descId = `${checkboxId}-desc`
  const errorId = `${checkboxId}-error`
  const describedBy = [
    errorMessage ? errorId : undefined,
    description ? descId : undefined,
  ].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('py-1', className)}>
      <label
        htmlFor={checkboxId}
        className={cn(
          'flex items-start gap-2.5 group select-none',
          isInputDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        )}
      >
        <input
          type="checkbox"
          id={checkboxId}
          name={field.name}
          checked={checked}
          disabled={isInputDisabled}
          ref={field.ref}
          onBlur={field.onBlur}
          onChange={(e) => {
            field.onChange(e.target.checked)
            onChange?.(e.target.checked)
          }}
          aria-invalid={!!errorMessage}
          aria-describedby={describedBy}
          aria-required={required ? true : undefined}
          className="peer sr-only"
        />

        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex-shrink-0 h-4 w-4 rounded-[4px] border transition-colors duration-100',
            'flex items-center justify-center',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-ring peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-bg-base',
            errorMessage && 'border-danger peer-focus-visible:ring-danger',
            !errorMessage && !checked && 'bg-bg-surface border-border group-hover:border-border-strong',
            !errorMessage && checked && 'bg-brand border-brand',
            errorMessage && checked && 'bg-danger border-danger'
          )}
        >
          <svg
            className={cn(
              'w-2.5 h-2.5 text-text-inverted transition-transform duration-100',
              checked ? 'scale-100' : 'scale-0'
            )}
            viewBox="0 0 10 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 4l3 3 5-5" />
          </svg>
        </span>

        <div className="flex flex-col">
          <span className="text-sm font-medium text-text leading-tight">
            {label}
            {required && (
              <span className="text-danger ms-0.5" aria-hidden="true">
                *
              </span>
            )}
          </span>

          {description && (
            <span id={descId} className="text-2xs text-text-muted leading-normal mt-0.5">
              {description}
            </span>
          )}
        </div>
      </label>

      {errorMessage && (
        <p id={errorId} role="alert" className="text-2xs text-danger leading-tight mt-1 ms-6.5">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
