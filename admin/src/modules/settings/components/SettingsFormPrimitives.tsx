/**
 * Settings form primitives — shared across all settings tabs.
 *
 * Uses Tier 2 form suite components (@/components/ui/form) where possible,
 * with settings-module specific composites and adaptors.
 */
import { useState } from 'react'
import {
  Controller,
  useController,
  useWatch,
  useFormContext,
  type Control,
  type FieldValues,
  type FieldPath,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form'
import { Plus, Trash2, Image, Upload, X, ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Card, Spinner, Input } from '@/components/ui'
import { api } from '@/lib/api-client'
import { useToast } from '@/lib/toast'
import { __ } from '@/lib/i18n'

// ─── Re-exports from Tier 2 Form Suite ─────────────────────────────────────────
export { FormInput, type FormInputProps } from '@/components/ui/form/FormInput'
export { FormTextarea, type FormTextareaProps } from '@/components/ui/form/FormTextarea'
export { FormCheckbox, type FormCheckboxProps } from '@/components/ui/form/FormCheckbox'

// ─── FormGroupHeader ─────────────────────────────────────────────────────────
// Just the header without a Card wrapper — for use inside custom Card layouts.

export interface FormGroupHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
}

export function FormGroupHeader({
  title,
  description,
  icon: Icon,
}: FormGroupHeaderProps) {
  return (
    <div className="flex items-start gap-3 border-b border-border pb-4">
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center text-brand flex-shrink-0">
          <Icon size={16} />
        </div>
      )}
      <div>
        <h3 className="text-base font-semibold text-text leading-tight">{title}</h3>
        {description && (
          <p className="text-sm text-text-muted mt-0.5 leading-normal">{description}</p>
        )}
      </div>
    </div>
  )
}

// ─── FormGroup ───────────────────────────────────────────────────────────────
// A Card with an icon header and a grid body — wraps a group of fields.

export interface FormGroupProps {
  title: string
  description?: string
  icon?: LucideIcon
  children: React.ReactNode
  cols?: 1 | 2 | 3
}

export function FormGroup({
  title,
  description,
  icon,
  children,
  cols = 2,
}: FormGroupProps) {
  const colClass =
    cols === 1 ? 'grid-cols-1' : cols === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
  return (
    <Card className="p-6 space-y-4">
      <FormGroupHeader title={title} description={description} icon={icon} />
      <div className={cn('grid gap-4 pt-1', colClass)}>{children}</div>
    </Card>
  )
}

// ─── FormSelect ───────────────────────────────────────────────────────────────

export interface FormSelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface FormSelectProps<TFieldValues extends FieldValues = FieldValues> {
  label: React.ReactNode
  name: FieldPath<TFieldValues> | string
  options: FormSelectOption[]
  register?: UseFormRegister<TFieldValues> | ((name: string, options?: unknown) => Record<string, unknown>) | ((...args: unknown[]) => unknown)
  control?: Control<TFieldValues>
  className?: string
  description?: React.ReactNode
  error?: string
  required?: boolean
  fullWidth?: boolean
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

function FormSelectField<TFieldValues extends FieldValues = FieldValues>({
  fieldProps,
  fieldError,
  ...props
}: FormSelectProps<TFieldValues> & {
  fieldProps?: Record<string, unknown>
  fieldError?: string
}) {
  const {
    label,
    name,
    options,
    className,
    description,
    error,
    required = false,
    fullWidth = false,
    onChange,
  } = props

  const selectId = `form-select-${name.replace(/[.[\]]/g, '-')}`
  const errorId = `${selectId}-error`
  const hintId = `${selectId}-hint`
  const errorMessage = error ?? fieldError
  const describedBy = errorMessage ? errorId : description ? hintId : undefined

  return (
    <div className={cn('space-y-1 min-w-0', fullWidth && 'col-span-full')}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-text leading-tight"
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
        <select
          id={selectId}
          aria-invalid={!!errorMessage}
          aria-describedby={describedBy}
          aria-required={required ? true : undefined}
          {...(fieldProps as React.SelectHTMLAttributes<HTMLSelectElement>)}
          onChange={(e) => {
            const reg = fieldProps as { onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void } | undefined
            reg?.onChange?.(e)
            onChange?.(e)
          }}
          className={cn(
            'w-full h-8 ps-3 pe-8 rounded border bg-bg-surface text-sm text-text transition-colors duration-100 truncate appearance-none',
            errorMessage
              ? 'border-danger focus:ring-1 focus:ring-danger/50 focus:border-danger'
              : 'border-border hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-brand-ring focus:border-brand',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-bg-surface text-text"
              disabled={opt.disabled}
            >
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
          aria-hidden="true"
        />
      </div>
      {errorMessage && (
        <p id={errorId} role="alert" className="text-2xs text-danger leading-tight mt-1">
          {errorMessage}
        </p>
      )}
      {!errorMessage && description && (
        <p id={hintId} className="text-2xs text-text-muted leading-normal mt-1">
          {description}
        </p>
      )}
    </div>
  )
}

export function FormSelect<TFieldValues extends FieldValues = FieldValues>(
  props: FormSelectProps<TFieldValues>
) {
  const formContext = useFormContext<TFieldValues>()
  const resolvedRegister = props.register ?? formContext?.register
  const effectiveControl = props.control ?? (!resolvedRegister ? formContext?.control : undefined)

  if (resolvedRegister) {
    const reg = (resolvedRegister as (name: string) => Record<string, unknown>)(props.name)
    return <FormSelectField {...props} fieldProps={reg} />
  }

  if (effectiveControl) {
    return (
      <Controller
        name={props.name as unknown as FieldPath<TFieldValues>}
        control={effectiveControl}
        render={({ field, fieldState }) => (
          <FormSelectField
            {...props}
            fieldProps={field as unknown as Record<string, unknown>}
            fieldError={fieldState.error?.message}
          />
        )}
      />
    )
  }

  return <FormSelectField {...props} fieldProps={{ name: props.name }} />
}

// ─── StringListEditor ─────────────────────────────────────────────────────────

export interface StringListEditorProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues> | string
  title: string
  description?: string
  placeholder: string
  emptyText: string
}

export function StringListEditor<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  title,
  description,
  placeholder,
  emptyText,
}: StringListEditorProps<TFieldValues>) {
  const { field } = useController({
    control,
    name: name as unknown as FieldPath<TFieldValues>,
  })
  const values = Array.isArray(field.value)
    ? (field.value as unknown[]).filter((v): v is string => typeof v === 'string')
    : []
  const [newValue, setNewValue] = useState('')

  const addValue = () => {
    const v = newValue.trim()
    if (!v || values.includes(v)) return
    field.onChange([...values, v])
    setNewValue('')
  }

  const removeValue = (i: number) => {
    field.onChange(values.filter((_, idx) => idx !== i))
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="border-b border-border pb-4">
        <h4 className="text-sm font-semibold text-text leading-tight">{title}</h4>
        {description && (
          <p className="text-2xs text-text-muted mt-1 leading-normal">{description}</p>
        )}
      </div>
      <div className="space-y-3 pt-1">
        <div className="flex gap-2">
          <Input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addValue()
              }
            }}
            placeholder={placeholder}
            className="flex-1"
          />
          <Button type="button" onClick={addValue} size="default">
            <Plus size={14} />
            {__( 'Add', 'codeclove-school-management' )}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {values.map((v, i) => (
            <div
              key={`${v}-${i}`}
              className="flex items-center gap-1.5 bg-brand-dim text-brand text-xs font-semibold px-2.5 py-1 rounded-lg border border-brand/10"
            >
              <span>{v}</span>
              <button
                type="button"
                onClick={() => removeValue(i)}
                className="hover:text-brand-strong transition-colors p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                aria-label={`Remove ${v}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {values.length === 0 && (
            <p className="text-2xs text-text-muted italic">{emptyText}</p>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── FormMediaUpload ──────────────────────────────────────────────────────────

export interface FormMediaUploadProps<TFieldValues extends FieldValues = FieldValues> {
  label: string
  name: FieldPath<TFieldValues> | string
  control: Control<TFieldValues>
  setValue: UseFormSetValue<TFieldValues>
  placeholder?: string
}

export function FormMediaUpload<TFieldValues extends FieldValues = FieldValues>({
  label,
  name,
  control,
  setValue,
  placeholder,
}: FormMediaUploadProps<TFieldValues>) {
  const toast = useToast()
  const value = useWatch({
    control,
    name: name as unknown as FieldPath<TFieldValues>,
  }) as string | undefined
  const [isUploading, setIsUploading] = useState(false)

  const pluginUrl = (window as unknown as { CodeCloveConfig?: { pluginUrl?: string } }).CodeCloveConfig?.pluginUrl || ''
  let defaultPreviewUrl = ''
  if (name === 'school.logo') {
    defaultPreviewUrl = `${pluginUrl}assets/defaults/logo.svg`
  } else if (name === 'school.signature') {
    defaultPreviewUrl = `${pluginUrl}assets/defaults/signature.svg`
  }

  const previewUrl = value || defaultPreviewUrl

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await api.post<{ id: number; url: string }>('media/upload', formData)
      if (res.success && res.data.url) {
        setValue(
          name as unknown as FieldPath<TFieldValues>,
          res.data.url as unknown as TFieldValues[FieldPath<TFieldValues>],
          { shouldDirty: true, shouldValidate: true }
        )
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'Failed to upload image'
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleClearMedia = () => {
    setValue(
      name as unknown as FieldPath<TFieldValues>,
      '' as unknown as TFieldValues[FieldPath<TFieldValues>],
      { shouldDirty: true, shouldValidate: true }
    )
  }

  return (
    <div className="space-y-1">
      <label htmlFor={`file-input-${name}`} className="block text-sm font-medium text-text">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept="image/*"
          id={`file-input-${name}`}
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        {isUploading ? (
          <div className="w-14 h-14 rounded-lg border border-border bg-bg-surface flex items-center justify-center flex-shrink-0">
            <Spinner size="sm" />
          </div>
        ) : previewUrl ? (
          <div className="relative group w-14 h-14 rounded-lg border border-border bg-bg-surface overflow-hidden flex items-center justify-center flex-shrink-0 p-1">
            <img src={previewUrl} alt={label} className="w-full h-full object-contain" />
            {value && (
              <button
                type="button"
                onClick={handleClearMedia}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center text-white focus:outline-none"
                title={__( 'Remove image', 'codeclove-school-management' )}
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="w-14 h-14 rounded-lg border border-dashed border-border bg-bg-surface flex items-center justify-center text-text-subtle flex-shrink-0">
            <Image size={20} />
          </div>
        )}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          {value ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xs text-text-muted font-mono max-w-full flex-1 truncate">
                {value.split('/').pop()}
              </span>
              <button
                type="button"
                onClick={() => document.getElementById(`file-input-${name}`)?.click()}
                disabled={isUploading}
                className="text-2xs text-brand hover:underline font-semibold flex-shrink-0"
              >
                {__( 'Change', 'codeclove-school-management' )}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => document.getElementById(`file-input-${name}`)?.click()}
                size="sm"
                variant="secondary"
                disabled={isUploading}
                className="w-fit h-7 text-xs px-2.5"
              >
                <Upload size={12} className="me-1" />
                {__( 'Choose Image', 'codeclove-school-management' )}
              </Button>
              {defaultPreviewUrl && (
                <span className="text-2xs text-text-subtle italic">
                  {__( 'Using default fallback', 'codeclove-school-management' )}
                </span>
              )}
            </div>
          )}
          <p className="text-2xs text-text-subtle truncate">
            {placeholder || __( 'PNG, JPG, or SVG.', 'codeclove-school-management' )}
          </p>
        </div>
      </div>
    </div>
  )
}
