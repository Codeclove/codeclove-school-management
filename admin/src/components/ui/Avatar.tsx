import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getAvatarInitials, getAvatarColor } from './avatar-utils'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type AvatarShape = 'circle' | 'rounded'

export interface AvatarProps {
  name: string
  photoUrl?: string | null
  size?: AvatarSize
  shape?: AvatarShape
  className?: string
  alt?: string
}

const SIZE_STYLES: Record<AvatarSize, { size: string; text: string; rounded: string }> = {
  xs: {
    size: 'w-6 h-6',
    text: 'text-3xs',
    rounded: 'rounded-md',
  },
  sm: {
    size: 'w-7 h-7',
    text: 'text-3xs',
    rounded: 'rounded-lg',
  },
  md: {
    size: 'w-9 h-9',
    text: 'text-xs',
    rounded: 'rounded-xl',
  },
  lg: {
    size: 'w-11 h-11',
    text: 'text-sm',
    rounded: 'rounded-2xl',
  },
  xl: {
    size: 'w-16 h-16',
    text: 'text-xl',
    rounded: 'rounded-2xl',
  },
  '2xl': {
    size: 'w-20 h-20',
    text: 'text-2xl',
    rounded: 'rounded-3xl',
  },
}

export function Avatar({
  name,
  photoUrl,
  size = 'md',
  shape = 'circle',
  className = '',
  alt,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false)
  const [prevUrl, setPrevUrl] = useState(photoUrl)
  if (prevUrl !== photoUrl) {
    setPrevUrl(photoUrl)
    setImageError(false)
  }

  const cleanName = name?.trim() || 'User'
  const altText = alt ?? cleanName
  const initials = getAvatarInitials(cleanName)
  const colorStyle = getAvatarColor(cleanName)
  const sizeConfig = SIZE_STYLES[size] || SIZE_STYLES.md
  const shapeClass = shape === 'circle' ? 'rounded-full' : sizeConfig.rounded

  const hasValidPhoto = Boolean(
    photoUrl &&
    !imageError &&
    !photoUrl.endsWith('avatar.svg') &&
    !photoUrl.includes('placeholder')
  )

  if (hasValidPhoto && photoUrl) {
    return (
      <div
        className={cn(
          sizeConfig.size,
          shapeClass,
          'border border-border overflow-hidden shrink-0 shadow-sm bg-bg-surface select-none relative',
          className
        )}
      >
        <img
          src={photoUrl}
          alt={altText}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    )
  }

  return (
    <div
      role="img"
      aria-label={altText}
      className={cn(
        sizeConfig.size,
        shapeClass,
        sizeConfig.text,
        'border flex items-center justify-center font-bold shrink-0 shadow-sm select-none',
        colorStyle,
        className
      )}
    >
      {initials}
    </div>
  )
}
