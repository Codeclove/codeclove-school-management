import * as React from 'react'
import {
  useFormContext,
  type UseFormRegister,
  type FieldValues,
  type FieldPath,
} from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'
import { Input, type InputProps } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { __ } from '@/lib/i18n'

export interface FormInputProps<TFieldValues extends FieldValues = FieldValues>
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'type'> {
  /** Form field key path (e.g. 'email' or 'user.profile.name') */
  name: FieldPath<TFieldValues> | string
  /** Visible label text */
  label?: React.ReactNode
  /** Mark field as required with red asterisk and aria-required */
  required?: boolean
  /** Explanatory hint text shown below input when there are no errors */
  hint?: React.ReactNode
  /** Explanatory description below input (alias for hint) */
  description?: React.ReactNode
  /** HTML input type (text, email, number, password, etc.) */
  type?: string
  /** Manual error override */
  error?: string
  /** Optional icon rendered on the leading side */
  leftIcon?: React.ReactNode
  /** Optional interactive element or icon rendered on the trailing side */
  rightElement?: React.ReactNode
  /** Wrapper container class */
  className?: string
  /** Inner <Input> element class */
  inputClassName?: string
  /** Label class */
  labelClassName?: string
  /** Expand across full grid width */
  fullWidth?: boolean
  /** Optional register function passed explicitly */
  register?: UseFormRegister<TFieldValues> | ((name: string, options?: unknown) => Record<string, unknown>) | ((...args: unknown[]) => unknown)
}

/**
 * Tier 2 FormInput — Accessible text input bound to react-hook-form context or direct register prop.
 * Complies with WCAG AA form accessibility: deterministic IDs, explicit label linkage,
 * aria-invalid, and aria-describedby for error/hint narration.
 */
export function FormInput<TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  register: propRegister,
  required = false,
  hint,
  description,
  type = 'text',
  placeholder,
  disabled,
  error,
  leftIcon,
  rightElement,
  className,
  inputClassName,
  labelClassName,
  fullWidth = false,
  id,
  ...props
}: FormInputProps<TFieldValues>) {
  const formContext = useFormContext<TFieldValues>()
  const register = propRegister ?? formContext?.register
  const formState = formContext?.formState
  const getFieldState = formContext?.getFieldState

  // Retrieve field error from form context (supports dotted paths)
  const fieldState = getFieldState ? getFieldState(name as unknown as FieldPath<TFieldValues>, formState) : undefined
  const contextError =
    fieldState?.error?.message ??
    (formState?.errors
      ? name.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' && key in acc ? (acc as Record<string, unknown>)[key] : undefined), formState.errors as unknown)
      : undefined)
  const errorMessage = error ?? (contextError && typeof contextError === 'object' && 'message' in contextError && typeof contextError.message === 'string' ? contextError.message : typeof contextError === 'string' ? contextError : undefined)
  const hintContent = description ?? hint

  // Password visibility toggle state
  const [showPassword, setShowPassword] = React.useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type

  // Generate deterministic accessible IDs
  const inputId = id || `form-input-${name.replace(/[.[\]]/g, '-')}`
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  const describedBy = errorMessage ? errorId : hintContent ? hintId : undefined

  const passwordToggleElement = isPassword && !rightElement ? (
    <button
      type="button"
      onClick={() => setShowPassword((prev) => !prev)}
      className="p-1 rounded text-text-subtle hover:text-text hover:bg-bg-overlay/50 transition-colors focus:outline-none focus:ring-1 focus:ring-brand-ring"
      aria-label={showPassword ? __( 'Hide value', 'codeclove-school-management' ) : __( 'Show value', 'codeclove-school-management' )}
    >
      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  ) : null

  const resolvedRightElement = rightElement || passwordToggleElement
  const registeredProps = register
    ? typeof register === 'function'
      ? (register as (name: string, opts?: unknown) => Record<string, unknown>)(name, { disabled })
      : {}
    : {}

  return (
    <div className={cn('space-y-1 min-w-0', fullWidth && 'col-span-full', className)}>
      {label && (
        <label
          htmlFor={inputId}
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

      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 start-0 ps-2.5 flex items-center pointer-events-none text-text-subtle">
            {leftIcon}
          </div>
        )}

        <Input
          id={inputId}
          type={resolvedType}
          placeholder={placeholder}
          disabled={disabled}
          error={!!errorMessage}
          aria-invalid={!!errorMessage}
          aria-describedby={describedBy}
          aria-required={required ? true : undefined}
          className={cn(
            leftIcon && 'ps-8',
            resolvedRightElement && 'pe-8',
            isPassword && 'font-mono',
            inputClassName
          )}
          {...registeredProps}
          {...(props as InputProps)}
        />

        {resolvedRightElement && (
          <div className="absolute inset-y-0 end-0 pe-2.5 flex items-center">
            {resolvedRightElement}
          </div>
        )}
      </div>

      {errorMessage && (
        <p id={errorId} role="alert" className="text-2xs text-danger leading-tight mt-1">
          {errorMessage}
        </p>
      )}

      {!errorMessage && hintContent && (
        <p id={hintId} className="text-2xs text-text-muted leading-normal mt-1">
          {hintContent}
        </p>
      )}
    </div>
  )
}
