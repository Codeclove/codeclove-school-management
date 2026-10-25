import * as React from 'react'
import {
  useController,
  type Control,
  type FieldValues,
  type FieldPath,
} from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Checkbox } from '../Checkbox'

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
 * Reuses the canonical Checkbox atom for complete DRY visual and behavioral consistency.
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

  const checkboxId = id || `form-checkbox-${name.replace(/[.[\]]/g, '-')}`

  return (
    <div className={cn('py-1', className)}>
      <Checkbox
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
        label={label}
        description={description}
        required={required}
        error={errorMessage}
      />
    </div>
  )
}
