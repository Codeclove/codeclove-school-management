import * as React from 'react'
import {
  useFormContext,
  type UseFormRegister,
  type FieldErrors,
  type FieldValues,
  type Path,
} from 'react-hook-form'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { __ } from '@/lib/i18n'

export interface AddressFieldNames {
  address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

export interface AddressFieldsProps<TFieldValues extends FieldValues = FieldValues> {
  /** Optional react-hook-form register function (auto-detected from FormContext if omitted) */
  register?: UseFormRegister<TFieldValues>
  /** Optional react-hook-form errors object (auto-detected from FormContext if omitted) */
  errors?: FieldErrors<TFieldValues>
  /** Field name mapping for form schema keys (defaults: address, city, state, postal_code, country) */
  names?: AddressFieldNames
  /** Disable all address inputs */
  disabled?: boolean
  /** Outer container CSS classes */
  className?: string
  /** Input height/style classes (defaults to "h-9") */
  inputClassName?: string
  /** Column count for the bottom location fields grid (default: 4, options: 2 or 4) */
  columns?: 2 | 4
  /** Custom label overrides */
  streetLabel?: React.ReactNode
  cityLabel?: React.ReactNode
  stateLabel?: React.ReactNode
  postalCodeLabel?: React.ReactNode
  countryLabel?: React.ReactNode
  /** Custom placeholder overrides */
  streetPlaceholder?: string
  cityPlaceholder?: string
  statePlaceholder?: string
  postalCodePlaceholder?: string
  countryPlaceholder?: string
  /** Mark all or individual address fields as required */
  required?:
    | boolean
    | {
        address?: boolean
        city?: boolean
        state?: boolean
        postal_code?: boolean
        country?: boolean
      }
}

const DEFAULT_FIELD_NAMES: Required<AddressFieldNames> = {
  address: 'address',
  city: 'city',
  state: 'state',
  postal_code: 'postal_code',
  country: 'country',
}

/**
 * AddressFields — Reusable street address + location composite form fields.
 *
 * Renders Street Address on top, and City, State / Province, Postal Code, and Country
 * in a responsive grid. Compatible with both direct react-hook-form register/errors
 * and FormContext / FormProvider wrappers.
 */
export function AddressFields<TFieldValues extends FieldValues = FieldValues>({
  register,
  errors,
  names,
  disabled = false,
  className,
  inputClassName = 'h-9',
  columns = 4,
  streetLabel,
  cityLabel,
  stateLabel,
  postalCodeLabel,
  countryLabel,
  streetPlaceholder,
  cityPlaceholder,
  statePlaceholder,
  postalCodePlaceholder,
  countryPlaceholder,
  required = false,
}: AddressFieldsProps<TFieldValues>) {
  const formContext = useFormContext<TFieldValues>()
  const effectiveRegister = register ?? formContext?.register
  const effectiveErrors = errors ?? formContext?.formState?.errors

  const fieldNames = React.useMemo(
    () => ({ ...DEFAULT_FIELD_NAMES, ...names }),
    [names]
  )

  const getErrorMessage = (fieldName: string): string | undefined => {
    if (!effectiveErrors) return undefined
    const parts = fieldName.split('.')
    let current: unknown = effectiveErrors
    for (const part of parts) {
      if (current == null || typeof current !== 'object' || !(part in current)) {
        return undefined
      }
      const record: Record<string, unknown> = current as Record<string, unknown>
      current = record[part]
    }
    if (current && typeof current === 'object' && 'message' in current) {
      const msg = current.message
      return typeof msg === 'string' ? msg : undefined
    }
    return undefined
  }

  const isRequired = (key: keyof AddressFieldNames): boolean => {
    if (typeof required === 'boolean') return required
    return !!required?.[key]
  }

  const addressError = getErrorMessage(fieldNames.address)
  const cityError = getErrorMessage(fieldNames.city)
  const stateError = getErrorMessage(fieldNames.state)
  const postalError = getErrorMessage(fieldNames.postal_code)
  const countryError = getErrorMessage(fieldNames.country)

  const getRegistration = (name: string) => {
    if (!effectiveRegister) return { name }
    return effectiveRegister(name as unknown as Path<TFieldValues>)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Street Address */}
      <FormField
        label={streetLabel ?? __( 'Street Address', 'codeclove-school-management' )}
        error={addressError}
        required={isRequired('address')}
      >
        <Input
          {...getRegistration(fieldNames.address)}
          placeholder={
            streetPlaceholder ??
            __( 'e.g. 123 Main St, Apt 4B', 'codeclove-school-management' )
          }
          disabled={disabled}
          error={!!addressError}
          className={inputClassName}
        />
      </FormField>

      {/* Location Row: City, State, Postal Code, Country */}
      <div
        className={cn(
          'grid grid-cols-1 gap-4',
          columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 md:grid-cols-4'
        )}
      >
        {([
          { key: 'city' as const, name: fieldNames.city, label: cityLabel ?? __( 'City', 'codeclove-school-management' ), placeholder: cityPlaceholder ?? __( 'e.g. Springfield', 'codeclove-school-management' ), error: cityError },
          { key: 'state' as const, name: fieldNames.state, label: stateLabel ?? __( 'State / Province', 'codeclove-school-management' ), placeholder: statePlaceholder ?? __( 'e.g. Illinois', 'codeclove-school-management' ), error: stateError },
          { key: 'postal_code' as const, name: fieldNames.postal_code, label: postalCodeLabel ?? __( 'ZIP / Postal Code', 'codeclove-school-management' ), placeholder: postalCodePlaceholder ?? __( 'e.g. 62701', 'codeclove-school-management' ), error: postalError },
          { key: 'country' as const, name: fieldNames.country, label: countryLabel ?? __( 'Country', 'codeclove-school-management' ), placeholder: countryPlaceholder ?? __( 'e.g. United States', 'codeclove-school-management' ), error: countryError },
        ]).map((field) => (
          <FormField key={field.key} label={field.label} error={field.error} required={isRequired(field.key)}>
            <Input
              {...getRegistration(field.name)}
              placeholder={field.placeholder}
              disabled={disabled}
              error={!!field.error}
              className={inputClassName}
            />
          </FormField>
        ))}
      </div>
    </div>
  )
}
