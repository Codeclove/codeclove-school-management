import * as React from 'react'
import { User, Camera } from 'lucide-react'
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
  /** Avatar size: sm (36px), md (44px), lg (64px), xl (96px-112px) */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Layout orientation: 'horizontal' (inline) or 'vertical' (stacked/centered) */
  layout?: 'horizontal' | 'vertical'
  /** Helper text displayed below */
  helperText?: React.ReactNode
}

const BOX_SIZES: Record<string, string> = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24 sm:w-28 sm:h-28',
}

const ICON_SIZES: Record<string, number> = {
  sm: 14,
  md: 16,
  lg: 24,
  xl: 36,
}

/**
 * AvatarUpload — Reusable avatar/photo uploader component.
 *
 * Handles file selection, uploading to WP REST via `media/upload`, previewing,
 * loading spinner state, and photo removal. Supports horizontal and vertical layouts.
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
  size = 'md',
  layout = 'horizontal',
  helperText,
}: AvatarUploadProps) {
  const [internalUploading, setInternalUploading] = React.useState(false)
  const uploading = isUploading !== undefined ? isUploading : internalUploading
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id || `avatar-upload-${autoId}`
  const toast = useToast()

  const isVertical = layout === 'vertical'
  const boxClass = BOX_SIZES[size] || BOX_SIZES.md
  const iconSize = ICON_SIZES[size] || ICON_SIZES.md
  const isLarge = size === 'lg' || size === 'xl'

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
    <div
      className={cn(
        'flex',
        isVertical ? 'flex-col items-center justify-center text-center gap-3' : 'items-center gap-3',
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        id={inputId}
        className="hidden"
        accept={accept}
        onChange={handleFileChange}
        disabled={uploading || disabled}
      />

      {/* Avatar circular frame */}
      <div className="relative group">
        <div
          onClick={!disabled && !uploading ? handleChoose : undefined}
          role={!disabled && !uploading ? 'button' : undefined}
          tabIndex={!disabled && !uploading ? 0 : undefined}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled && !uploading) {
              e.preventDefault()
              handleChoose()
            }
          }}
          className={cn(
            'relative rounded-full border border-border bg-bg-surface overflow-hidden flex items-center justify-center flex-shrink-0 select-none transition-all',
            boxClass,
            isVertical && 'border-2 border-border/80 ring-4 ring-bg-surface shadow-xs',
            !disabled && !uploading && 'cursor-pointer hover:border-brand'
          )}
          title={photoUrl ? __( 'Click to change photo', 'codeclove-school-management' ) : __( 'Click to upload photo', 'codeclove-school-management' )}
        >
          {uploading ? (
            <div className="flex flex-col items-center justify-center gap-1 text-brand">
              <Spinner size={isLarge ? 'md' : 'sm'} />
            </div>
          ) : photoUrl ? (
            <>
              <img
                src={photoUrl}
                alt={typeof label === 'string' ? label : __( 'Avatar preview', 'codeclove-school-management' )}
                className="w-full h-full object-cover"
              />
              {!disabled && isVertical && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-3xs font-medium gap-1">
                  <Camera size={18} />
                  <span>{__( 'Change', 'codeclove-school-management' )}</span>
                </div>
              )}
            </>
          ) : (
            <User size={iconSize} className="text-text-subtle" />
          )}
        </div>

        {/* Floating camera badge on large vertical avatar */}
        {!disabled && !uploading && isVertical && (
          <button
            type="button"
            onClick={handleChoose}
            className="absolute rounded-full bg-brand text-white border-2 border-bg-elevated shadow-xs flex items-center justify-center hover:bg-brand/90 transition-all cursor-pointer w-7 h-7 bottom-0.5 right-0.5"
            title={__( 'Change photo', 'codeclove-school-management' )}
            aria-label={__( 'Change photo', 'codeclove-school-management' )}
          >
            <Camera size={14} />
          </button>
        )}
      </div>

      {/* Action Controls & Metadata */}
      <div className={cn('space-y-1', isVertical && 'space-y-1.5 flex flex-col items-center')}>
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
            className={isVertical ? 'h-7 px-3 text-xs font-semibold' : 'h-6 text-2xs px-2'}
          >
            {photoUrl
              ? __( 'Change Photo', 'codeclove-school-management' )
              : __( 'Choose Photo', 'codeclove-school-management' )}
          </Button>

          {photoUrl && !uploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
              className={cn(
                'text-text-muted hover:text-danger font-medium transition-colors cursor-pointer',
                isVertical ? 'h-7 px-2.5 text-xs' : 'h-6 text-2xs px-1.5'
              )}
            >
              {__( 'Remove', 'codeclove-school-management' )}
            </Button>
          )}
        </div>

        {helperText && (
          <p className="text-3xs text-text-muted mt-0.5">{helperText}</p>
        )}
      </div>
    </div>
  )
}
