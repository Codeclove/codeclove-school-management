import { useState } from 'react'
import { cn } from '@/lib/utils'

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

export const AVATAR_COLORS = [
  'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40',
  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/40',
  'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/40',
  'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/40',
  'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40',
  'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/40',
  'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/40',
]

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

export function getAvatarInitials(name: string): string {
  const cleanName = name.trim() || 'User'
  const parts = cleanName.split(/\s+/).filter(Boolean)
  const p0 = parts[0]
  const pLast = parts[parts.length - 1]
  if (p0 && pLast && parts.length >= 2) {
    return `${p0[0]}${pLast[0]}`.toUpperCase()
  }
  return cleanName.slice(0, 2).toUpperCase()
}

export function getAvatarColor(name: string): string {
  const cleanName = name.trim() || 'User'
  let charCodeSum = 0
  for (let i = 0; i < cleanName.length; i++) {
    charCodeSum += cleanName.charCodeAt(i)
  }
  return AVATAR_COLORS[charCodeSum % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!
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
