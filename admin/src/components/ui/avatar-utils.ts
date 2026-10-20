export const AVATAR_COLORS = [
  'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40',
  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/40',
  'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/40',
  'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/40',
  'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40',
  'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/40',
  'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/40',
]

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
