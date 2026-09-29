/**
 * Spinner — consistent loading indicator.
 *
 * Usage:
 *   <Spinner />
 *   <Spinner size="sm" />
 *   <Spinner className="text-brand" />
 */
import { cn } from '@/lib/utils'
import { __ } from '@/lib/i18n'

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<SpinnerProps['size']>, string> = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border',
  md: 'h-5 w-5 border-2',
  lg: 'h-7 w-7 border-2',
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={__('Loading', 'codeclove-school-management')}
      className={cn(
        'inline-block rounded-full border-transparent animate-spin',
        'border-t-current',
        'text-brand',
        SIZE_CLASSES[size],
        className
      )}
      style={{ borderTopColor: 'currentColor', borderStyle: 'solid' }}
    />
  )
}
