import * as React from 'react'
import { User, X } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { api } from '@/lib/api-client'
import { useToast } from '@/lib/toast'
import { __ } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface AvatarUploadProps {
  /** The current photo preview URL (or empty/null) */
  photoUrl?: string | null
  /** Callback fired when a photo is uploaded or removed */
  onPhotoChange: (id: number | null, url: string) => void
  /** Controlled uploading indicator */
  isUploading?: boolean
  /** Callback when upload starts or finishes */
  onUploadingChange?: (uploading: boolean) => void
  /** Disable all upload/remove interactions */
  disabled?: boolean
  /** Accessible label describing who or what the photo is for (e.g. "Staff Photo") */
  label?: React.ReactNode
  /** Optional custom ID for the file input */
  id?: string
  /** Allowed MIME types or file extensions (defaults to "image/*") */
  accept?: string
  /** Container CSS classes */
  className?: string
}

/**
 * AvatarUpload — Reusable avatar/photo uploader component.
 *
 * Handles file selection, uploading to WP REST via `media/upload`, previewing,
 * loading spinner state, and photo removal.
 */
export function AvatarUpload({
  photoUrl,
  onPhotoChange,
  isUploading,
  onUploadingChange,
  disabled = false,
  label,
  id,
  accept = 'image/*',
  className,
}: AvatarUploadProps) {
  const [internalUploading, setInternalUploading] = React.useState(false)
  const uploading = isUploading !== undefined ? isUploading : internalUploading
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id || `avatar-upload-${autoId}`
  const toast = useToast()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setInternalUploading(true)
    onUploadingChange?.(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post<{ id: number; url: string }>('media/upload', formData)
      if (res.success) {
        onPhotoChange(res.data.id, res.data.url)
        toast.success(__( 'Profile photo uploaded successfully!', 'codeclove-school-management' ))
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : __( 'Failed to upload image', 'codeclove-school-management' )
      toast.error(message)
    } finally {
      setInternalUploading(false)
      onUploadingChange?.(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    onPhotoChange(null, '')
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const handleChoose = () => {
    inputRef.current?.click()
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <input
        ref={inputRef}
        type="file"
        id={inputId}
        className="hidden"
        accept={accept}
        onChange={handleFileChange}
        disabled={uploading || disabled}
      />

      {uploading ? (
        <div className="w-11 h-11 rounded-full border border-border bg-bg-surface flex items-center justify-center flex-shrink-0">
          <Spinner size="sm" />
        </div>
      ) : photoUrl ? (
        <div className="relative group w-11 h-11 rounded-full border border-border overflow-hidden flex items-center justify-center bg-bg-surface flex-shrink-0">
          <img
            src={photoUrl}
            alt={typeof label === 'string' ? label : __( 'Avatar preview', 'codeclove-school-management' )}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center text-white rounded-full focus:outline-none"
            title={__( 'Remove photo', 'codeclove-school-management' )}
            aria-label={__( 'Remove photo', 'codeclove-school-management' )}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="w-11 h-11 rounded-full border border-dashed border-border bg-bg-surface flex items-center justify-center text-text-subtle flex-shrink-0">
          <User size={16} />
        </div>
      )}

      <div className="space-y-1">
        {label && (
          <p className="text-xs font-semibold text-text">{label}</p>
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleChoose}
            size="sm"
            variant="secondary"
            disabled={uploading || disabled}
            className="h-6 text-2xs px-2"
          >
            {photoUrl
              ? __( 'Change Photo', 'codeclove-school-management' )
              : __( 'Choose Photo', 'codeclove-school-management' )}
          </Button>
          {photoUrl && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-text-muted hover:text-danger text-2xs transition-colors"
              disabled={disabled}
            >
              {__( 'Remove', 'codeclove-school-management' )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
