export interface PersonAvatarProps {
  name: string
  subtitle?: string
  idNumber?: string
  photoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const AVATAR_COLORS = [
  'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  'bg-blue-500/15 text-blue-600 border-blue-500/30',
  'bg-indigo-500/15 text-indigo-600 border-indigo-500/30',
  'bg-purple-500/15 text-purple-600 border-purple-500/30',
  'bg-amber-500/15 text-amber-600 border-amber-500/30',
  'bg-rose-500/15 text-rose-600 border-rose-500/30',
  'bg-cyan-500/15 text-cyan-600 border-cyan-500/30',
]

const SIZE_STYLES = {
  sm: 'w-7 h-7 text-3xs rounded-lg',
  md: 'w-9 h-9 text-xs rounded-xl',
  lg: 'w-11 h-11 text-sm rounded-2xl',
}

export function PersonAvatar({ name, subtitle, idNumber, photoUrl, size = 'md', className = '' }: PersonAvatarProps) {
  const cleanName = name.trim() || 'User'
  const parts = cleanName.split(' ').filter(Boolean)
  const p0 = parts[0]
  const pLast = parts[parts.length - 1]
  const initials = (p0 && pLast && parts.length >= 2)
    ? `${p0[0]}${pLast[0]}`.toUpperCase()
    : cleanName.slice(0, 2).toUpperCase()

  // Hash string to pick a deterministic color
  let charCodeSum = 0
  for (let i = 0; i < cleanName.length; i++) {
    charCodeSum += cleanName.charCodeAt(i)
  }
  const colorStyle = AVATAR_COLORS[charCodeSum % AVATAR_COLORS.length]
  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.md

  const hasValidPhoto = photoUrl && !photoUrl.endsWith('avatar.svg') && !photoUrl.includes('placeholder')

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {hasValidPhoto ? (
        <div className={`${sizeStyle} border border-border/60 overflow-hidden shrink-0 shadow-sm bg-bg-surface`}>
          <img src={photoUrl} alt={cleanName} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`${sizeStyle} border flex items-center justify-center font-bold shrink-0 shadow-sm ${colorStyle}`}>
          {initials}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text text-sm truncate leading-snug">
            {cleanName}
          </span>
          {idNumber && (
            <span className="px-1.5 py-0.5 rounded text-2xs font-mono font-medium bg-bg-surface text-text-subtle border border-border/40 shrink-0">
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
