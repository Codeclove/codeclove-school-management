import type { VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import {
  badgeVariants,
  resolveBadgeVariant,
  type BadgeVariant,
} from './badge-utils'

export type { BadgeVariant }

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    Omit<VariantProps<typeof badgeVariants>, 'variant'> {
  variant?: BadgeVariant | null
  dot?: boolean
}

export function Badge({ className, variant, size, dot = false, children, ...props }: BadgeProps) {
  const resolvedVariant = variant ? resolveBadgeVariant(variant) : 'default'
  return (
    <span className={cn(badgeVariants({ variant: resolvedVariant, size }), className)} {...props}>
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-current opacity-80 flex-shrink-0"
          aria-hidden="true"
        />
      )}
      {typeof children === 'string' ? children.replace(/_/g, ' ') : children}
    </span>
  )
}
