import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Optional visible label next to the checkbox */
  label?: React.ReactNode
  /** Custom class for the label text */
  labelClassName?: string
  /** Optional descriptive help text below the label */
  description?: React.ReactNode
  /** Indeterminate visual state (renders horizontal bar) */
  indeterminate?: boolean
  /** Mark field as required with red asterisk */
  required?: boolean
  /** Error message override */
  error?: string
  /** Container class */
  containerClassName?: string
}

/**
 * Checkbox — CodeClove canonical, accessible checkbox primitive.
 *
 * Implements WCAG 2.2 AA compliant focus states, accessible label linkages,
 * and high-contrast checked/indeterminate indicators matching the design system.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      id,
      label,
      labelClassName,
      description,
      indeterminate = false,
      required = false,
      error,
      className,
      containerClassName,
      disabled = false,
      checked = false,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const checkboxId = id || generatedId
    const descId = `${checkboxId}-desc`
    const errorId = `${checkboxId}-error`

    const describedBy = [
      error ? errorId : undefined,
      description ? descId : undefined,
      props['aria-describedby'],
    ]
      .filter(Boolean)
      .join(' ') || undefined

    const innerRef = React.useRef<HTMLInputElement | null>(null)

    // Handle forwarded ref & indeterminate DOM property
    React.useImperativeHandle(ref, () => innerRef.current!)

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = Boolean(indeterminate)
      }
    }, [indeterminate])

    const boxContent = (
      <span
        aria-hidden="true"
        className={cn(
          'w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors duration-150 shrink-0 select-none pointer-events-none',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-ring peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-bg-base',
          error
            ? 'border-danger peer-focus-visible:ring-danger'
            : checked || indeterminate
              ? 'bg-brand border-brand text-text-inverted'
              : 'bg-bg-surface border-border group-hover:border-border-strong',
          disabled && 'opacity-60 cursor-not-allowed',
          className
        )}
      >
        {indeterminate ? (
          <svg
            className="w-2.5 h-2.5 text-white"
            viewBox="0 0 10 2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M1 1h8" />
          </svg>
        ) : (
          <svg
            className={cn(
              'w-2.5 h-2.5 text-white transition-transform duration-150',
              checked ? 'scale-100' : 'scale-0'
            )}
            viewBox="0 0 10 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 4l3 3 5-5" />
          </svg>
        )}
      </span>
    )

    const hasDescription = Boolean(description || error)

    const inputControl = (
      <span className={cn('relative inline-flex items-center justify-center w-4 h-4 shrink-0', hasDescription && 'mt-0.5')}>
        <input
          type="checkbox"
          id={checkboxId}
          ref={innerRef}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          aria-required={required ? true : undefined}
          className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10 m-0 p-0"
          {...props}
        />
        {boxContent}
      </span>
    )

    if (!label && !description && !error) {
      return (
        <label
          htmlFor={checkboxId}
          className={cn(
            'relative inline-flex items-center justify-center shrink-0 cursor-pointer select-none',
            disabled && 'cursor-not-allowed opacity-60',
            containerClassName
          )}
        >
          {inputControl}
        </label>
      )
    }

    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          'group inline-flex gap-2.5 select-none',
          hasDescription ? 'items-start' : 'items-center',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          containerClassName
        )}
      >
        {inputControl}
        <div className="flex flex-col">
          {label && (
            <span className={cn('text-sm font-medium text-text leading-tight', labelClassName)}>
              {label}
              {required && (
                <span className="text-danger ms-0.5" aria-hidden="true">
                  *
                </span>
              )}
            </span>
          )}
          {description && (
            <p id={descId} className="text-xs text-text-muted mt-0.5 leading-normal">
              {description}
            </p>
          )}
          {error && (
            <p id={errorId} role="alert" className="text-xs text-danger mt-1 font-medium">
              {error}
            </p>
          )}
        </div>
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'
