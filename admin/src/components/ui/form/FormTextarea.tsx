import * as React from 'react'
import {
  useFormContext,
  type UseFormRegister,
  type FieldValues,
  type FieldPath,
} from 'react-hook-form'
import { Textarea, type TextareaProps } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'

export interface FormTextareaProps<TFieldValues extends FieldValues = FieldValues>
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'> {
  /** Form field key path */
  name: FieldPath<TFieldValues> | string
  /** Visible label text */
  label?: React.ReactNode
  /** Mark field as required */
  required?: boolean
  /** Explanatory hint text below textarea */
  hint?: React.ReactNode
  /** Explanatory description below textarea (alias for hint) */
  description?: React.ReactNode
  /** Manual error override */
  error?: string
  /** Whether to render character counter */
  showCharCount?: boolean
  /** Expand across full grid width (defaults to true for textareas) */
  fullWidth?: boolean
  /** Outer container class */
  className?: string
  /** Inner <textarea> element class */
  textareaClassName?: string
  /** Label class */
  labelClassName?: string
  /** Optional register function passed explicitly */
  register?: UseFormRegister<TFieldValues> | ((name: string, options?: unknown) => Record<string, unknown>) | ((...args: unknown[]) => unknown)
}

/**
 * Tier 2 FormTextarea — Accessible multiline textarea bound to react-hook-form context or direct register prop.
 * Complies with WCAG AA form accessibility: deterministic IDs, explicit label linkage,
 * aria-invalid, character counter, and aria-describedby for error/hint narration.
 */
export function FormTextarea<TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  register: propRegister,
  required = false,
  hint,
  description,
  error,
  maxLength,
  showCharCount = false,
  fullWidth = true,
  rows = 3,
  placeholder,
  disabled,
  className,
  textareaClassName,
  labelClassName,
  id,
  ...props
}: FormTextareaProps<TFieldValues>) {
  const formContext = useFormContext<TFieldValues>()
  const register = propRegister ?? formContext?.register
  const formState = formContext?.formState
  const getFieldState = formContext?.getFieldState
  const watch = formContext?.watch

  // Retrieve field error from form context (supports dotted paths)
  const fieldState = getFieldState ? getFieldState(name as unknown as FieldPath<TFieldValues>, formState) : undefined
  const contextError =
    fieldState?.error?.message ??
    (formState?.errors
      ? name.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' && key in acc ? (acc as Record<string, unknown>)[key] : undefined), formState.errors as unknown)
      : undefined)
  const errorMessage = error ?? (contextError && typeof contextError === 'object' && 'message' in contextError && typeof contextError.message === 'string' ? contextError.message : typeof contextError === 'string' ? contextError : undefined)
  const hintContent = description ?? hint

  // Generate deterministic accessible IDs
  const textareaId = id || `form-textarea-${name.replace(/[.[\]]/g, '-')}`
  const errorId = `${textareaId}-error`
  const hintId = `${textareaId}-hint`
  const describedBy = errorMessage ? errorId : hintContent ? hintId : undefined

  // Character counter tracking
  const rawWatchedValue: unknown =
    (showCharCount || maxLength !== undefined) && watch
      ? watch(name as unknown as FieldPath<TFieldValues>)
      : undefined
  const currentLength =
    typeof rawWatchedValue === 'string'
      ? rawWatchedValue.length
      : typeof rawWatchedValue === 'number'
      ? String(rawWatchedValue).length
      : 0

  const registeredProps = register
    ? typeof register === 'function'
      ? (register as (name: string, opts?: unknown) => Record<string, unknown>)(name, { disabled })
      : {}
    : {}

  return (
    <div className={cn('space-y-1 min-w-0', fullWidth && 'col-span-full', className)}>
      {label && (
        <label
          htmlFor={textareaId}
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

      <Textarea
        id={textareaId}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        error={!!errorMessage}
        aria-invalid={!!errorMessage}
        aria-describedby={describedBy}
        aria-required={required ? true : undefined}
        className={textareaClassName}
        {...registeredProps}
        {...(props as TextareaProps)}
      />

      <div className="flex items-start justify-between gap-2 mt-1 min-h-[1.25rem]">
        <div className="min-w-0 flex-1">
          {errorMessage && (
            <p id={errorId} role="alert" className="text-2xs text-danger leading-tight">
              {errorMessage}
            </p>
          )}

          {!errorMessage && hintContent && (
            <p id={hintId} className="text-2xs text-text-muted leading-normal">
              {hintContent}
            </p>
          )}
        </div>

        {(showCharCount || maxLength !== undefined) && (
          <span
            className={cn(
              'text-2xs tabular-nums transition-colors shrink-0',
              maxLength && currentLength >= maxLength
                ? 'text-danger font-semibold'
                : 'text-text-subtle'
            )}
          >
            {currentLength}
            {maxLength !== undefined && ` / ${maxLength}`}
          </span>
        )}
      </div>
    </div>
  )
}
