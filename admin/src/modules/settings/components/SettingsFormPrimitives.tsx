/**
 * Settings form primitives — shared across all settings tabs.
 *
 * These are internal-only components (not exported from the global UI lib)
 * because they accept react-hook-form's `register` directly, which is a
 * settings-module concern, not a general UI concern.
 */
import { useState } from 'react'
import { useController, useWatch } from 'react-hook-form'
import { Plus, Trash2, Image, Upload, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Card, Spinner } from '@/components/ui'
import { api } from '@/lib/api-client'
import { useToast } from '@/lib/toast'
import { __ } from '@/lib/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

type Register = (...args: any[]) => any
type Control  = any

// ─── FormGroup ───────────────────────────────────────────────────────────────
// A Card with an icon header and a 2-col grid body — wraps a group of fields.

interface FormGroupProps {
  title: string
  description?: string
  icon?: LucideIcon
  children: React.ReactNode
  cols?: 1 | 2 | 3
}

export function FormGroup({
  title,
  description,
  icon: Icon,
  children,
  cols = 2,
}: FormGroupProps) {
  const colClass = cols === 1 ? 'grid-cols-1' : cols === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
  return (
    <Card className="p-6 space-y-4">
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
      <div className={cn('grid gap-4 pt-1', colClass)}>{children}</div>
    </Card>
  )
}

// ─── FormGroupHeader ─────────────────────────────────────────────────────────
// Just the header without a Card wrapper — for use inside custom Card layouts.

export function FormGroupHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description?: string
  icon?: LucideIcon
}) {
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

// ─── FormInput ────────────────────────────────────────────────────────────────

interface FormInputProps {
  label: string
  name: string
  register: Register
  type?: string
  placeholder?: string
  className?: string
  description?: string
  error?: string
  required?: boolean
  fullWidth?: boolean
  [key: string]: unknown
}

export function FormInput({
  label,
  name,
  register,
  type = 'text',
  placeholder,
  className,
  description,
  error,
  required = false,
  fullWidth = false,
  ...props
}: FormInputProps) {
  const id = `settings-input-${name}`
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className={cn('space-y-1', fullWidth && 'col-span-full')}>
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label}
        {required && <span className="text-danger ms-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...register(name)}
        className={cn(
          'w-full h-8 px-3 rounded border bg-bg-surface text-sm text-text transition-colors duration-100',
          'placeholder:text-text-subtle',
          error
            ? 'border-danger focus:ring-1 focus:ring-danger/50 focus:border-danger'
            : 'border-border hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-brand-ring focus:border-brand',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
      {description && !error && (
        <p className="text-xs text-text-muted leading-normal pt-0.5">{description}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger leading-normal pt-0.5">{error}</p>
      )}
    </div>
  )
}

// ─── FormSelect ───────────────────────────────────────────────────────────────

interface FormSelectProps {
  label: string
  name: string
  register: Register
  options: { value: string | number; label: string }[]
  className?: string
  description?: string
  error?: string
  required?: boolean
  fullWidth?: boolean
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

export function FormSelect({
  label,
  name,
  register,
  options,
  className,
  description,
  error,
  required = false,
  fullWidth = false,
  onChange,
}: FormSelectProps) {
  const id = `settings-select-${name}`
  const errorId = error ? `${id}-error` : undefined
  const registered = register(name)
  return (
    <div className={cn('space-y-1', fullWidth && 'col-span-full')}>
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label}
        {required && <span className="text-danger ms-0.5">*</span>}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...registered}
        onChange={(e) => {
          registered.onChange(e)
          onChange?.(e)
        }}
        className={cn(
          'w-full h-8 pl-3 pr-8 rounded border bg-bg-surface text-sm text-text transition-colors duration-100 truncate',
          error
            ? 'border-danger focus:ring-1 focus:ring-danger/50 focus:border-danger'
            : 'border-border hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-brand-ring focus:border-brand',
          "appearance-none bg-[position:right_8px_center] bg-[size:14px_14px] bg-no-repeat",
          "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')]",
          "dark:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')]",
          className
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-bg-surface text-text">
            {opt.label}
          </option>
        ))}
      </select>
      {description && !error && (
        <p className="text-xs text-text-muted leading-normal pt-0.5">{description}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger leading-normal pt-0.5">{error}</p>
      )}
    </div>
  )
}

// ─── FormCheckbox ─────────────────────────────────────────────────────────────

interface FormCheckboxProps {
  label: string
  name: string
  description?: string
  control: Control
}

export function FormCheckbox({ label, name, description, control }: FormCheckboxProps) {
  const { field } = useController({ control, name })
  const checked = Boolean(field.value)

  return (
    <label
      htmlFor={name}
      className="flex items-start gap-2.5 py-1 cursor-pointer group select-none"
    >
      <input
        type="checkbox"
        id={name}
        checked={checked}
        onChange={(e) => field.onChange(e.target.checked)}
        onBlur={field.onBlur}
        name={field.name}
        ref={field.ref}
        className="sr-only"
      />

      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex-shrink-0 h-4 w-4 rounded-[4px] border transition-colors duration-100',
          'flex items-center justify-center',
          'group-hover:border-border-strong',
          checked
            ? 'bg-brand border-brand'
            : 'bg-bg-surface border-border',
        )}
      >
        <svg
          className={cn(
            'w-2.5 h-2.5 text-white transition-transform duration-100',
            checked ? 'scale-100' : 'scale-0',
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
        </span>
        {description && (
          <span className="text-xs text-text-muted leading-normal mt-0.5">
            {description}
          </span>
        )}
      </div>
    </label>
  )
}

// ─── StringListEditor ─────────────────────────────────────────────────────────

interface StringListEditorProps {
  control: Control
  name: string
  title: string
  description?: string
  placeholder: string
  emptyText: string
}

export function StringListEditor({
  control,
  name,
  title,
  description,
  placeholder,
  emptyText,
}: StringListEditorProps) {
  const { field } = useController({ control, name })
  const values = Array.isArray(field.value)
    ? field.value.filter((v): v is string => typeof v === 'string')
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
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addValue() }
            }}
            placeholder={placeholder}
            className="flex-1 h-8 px-3 rounded border border-border bg-bg-surface text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-1 focus:ring-brand-ring focus:border-brand hover:border-border-strong transition-colors duration-100"
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
                className="hover:text-brand-strong transition-colors"
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

interface FormMediaUploadProps {
  label: string
  name: string
  control: any
  setValue: any
  placeholder?: string
}

export function FormMediaUpload({
  label,
  name,
  control,
  setValue,
  placeholder,
}: FormMediaUploadProps) {
  const toast = useToast()
  const value = useWatch({ control, name })
  const [isUploading, setIsUploading] = useState(false)

  const pluginUrl = window.CodeCloveConfig?.pluginUrl || ''
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
        setValue(name, res.data.url, { shouldDirty: true, shouldValidate: true })
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClearMedia = () => {
    setValue(name, '', { shouldDirty: true, shouldValidate: true })
  }

  return (
    <div className="space-y-1">
      <label htmlFor={`file-input-${name}`} className="text-xs font-semibold text-text-muted">{label}</label>
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
          <div className="relative group w-14 h-14 rounded-lg border border-border bg-bg-surface overflow-hidden flex items-center justify-center flex-shrink-0 bg-white">
            <img src={previewUrl} alt={label} className="w-full h-full object-contain p-1" />
            {value && (
              <button
                type="button"
                onClick={handleClearMedia}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                title={__( 'Remove image', 'codeclove-school-management' )}
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="w-14 h-14 rounded-lg border border-dashed border-border bg-bg-surface/50 flex items-center justify-center text-text-subtle flex-shrink-0">
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
                <span className="text-2xs text-text-subtle italic">{__( 'Using default fallback', 'codeclove-school-management' )}</span>
              )}
            </div>
          )}
          <p className="text-2xs text-text-subtle truncate">{placeholder || __( 'PNG, JPG, or SVG.', 'codeclove-school-management' )}</p>
        </div>
      </div>
    </div>
  )
}
