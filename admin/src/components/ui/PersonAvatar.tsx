import { Avatar, type AvatarSize, AVATAR_COLORS } from './Avatar'

export { AVATAR_COLORS }

export interface PersonAvatarProps {
  name: string
  subtitle?: string
  idNumber?: string
  photoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PersonAvatar({
  name,
  subtitle,
  idNumber,
  photoUrl,
  size = 'md',
  className = '',
}: PersonAvatarProps) {
  const cleanName = name?.trim() || 'User'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Avatar
        name={cleanName}
        photoUrl={photoUrl}
        size={size as AvatarSize}
        shape="rounded"
      />
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text text-sm truncate leading-snug">
            {cleanName}
          </span>
          {idNumber && (
            <span className="px-1.5 py-0.5 rounded text-2xs font-mono font-medium bg-bg-surface text-text-subtle border border-border shrink-0">
              {idNumber}
            </span>
          )}
        </div>
        {subtitle && (
          <span className="text-2xs text-text-subtle truncate font-sans">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  )
}
