/**
 * FormField — label + input/control + error message wrapper.
 *
 * Eliminates the repeated `<div className="space-y-1"><label>...</label>...</div>`
 * pattern seen across SettingsPage and all future form pages.
 *
 * Usage:
 *   <FormField label="Email" error={errors.email?.message} required>
 *     <Input {...register('email')} type="email" />
 *   </FormField>
 */
import React, { useId } from 'react'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: React.ReactNode
  action?: React.ReactNode
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
  labelClassName?: string
  /** spans full column width in a grid — useful for textarea or wide inputs */
  fullWidth?: boolean
  /** explicitly specify the input ID when children are wrapped in icons/divs */
  inputId?: string
}

export function FormField({
  label,
  action,
  error,
  hint,
  required = false,
  children,
  className,
  labelClassName,
  fullWidth = false,
  inputId: propInputId,
}: FormFieldProps) {
  const generatedId = useId()
  const isElement = React.isValidElement<{ id?: string; name?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; error?: boolean }>(children)
  const childId = isElement ? children.props.id || children.props.name : undefined
  const inputId = propInputId || childId || generatedId
  const errorId = error ? `${inputId}-error` : undefined

  let modifiedChildren = children

  if (isElement) {
    const combinedDescribedBy =
      [children.props['aria-describedby'], errorId].filter(Boolean).join(' ') || undefined

    modifiedChildren = React.cloneElement(children, {
      id: inputId,
      error: Boolean(error || children.props.error),
      'aria-invalid': Boolean(error || children.props['aria-invalid']),
      'aria-describedby': combinedDescribedBy,
    })
  }
  return (
    <div className={cn('space-y-1 min-w-0', fullWidth && 'col-span-full', className)}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className={cn('text-sm font-medium text-text flex items-center gap-0.5', labelClassName)}
        >
          {label}
          {required && <span className="text-danger ms-0.5">*</span>}
        </label>
        {action}
      </div>
      {modifiedChildren}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger leading-tight">{error}</p>
      )}
      {!error && hint && (
        <p className="text-xs text-text-muted leading-normal mt-0.5">{hint}</p>
      )}
    </div>
  )
}
