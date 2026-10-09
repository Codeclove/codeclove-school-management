import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariantStyles = {
  default:              'bg-bg-surface text-text-muted border-border',
  secondary:            'bg-hover-bg text-text-muted border-border',
  brand:                'bg-brand-dim text-brand border-brand-border',
  success:              'bg-success-dim text-success border-success-border',
  warning:              'bg-warning-dim text-warning border-warning-border',
  danger:               'bg-danger-dim text-danger border-danger-border',
  info:                 'bg-info-dim text-info border-info-border',

  // Workflow & System status variants
  inquiry:              'bg-bg-surface text-text-muted border-border',
  submitted:            'bg-info-dim text-info border-info-border',
  under_review:         'bg-brand-dim text-brand border-brand-border',
  more_info_needed:     'bg-warning-dim text-warning border-warning-border',
  interview_scheduled:  'bg-brand-dim text-brand border-brand-border',
  accepted:             'bg-success-dim text-success border-success-border',
  waitlisted:           'bg-warning-dim text-warning border-warning-border',
  rejected:             'bg-danger-dim text-danger border-danger-border',
  admitted:             'bg-success-dim text-success border-success-border',
  withdrawn:            'bg-bg-surface text-text-subtle border-border',
  hired:                'bg-success-dim text-success border-success-border',
  offer_sent:           'bg-brand-dim text-brand border-brand-border',
  active:               'bg-success-dim text-success border-success-border',
  inactive:             'bg-bg-surface text-text-muted border-border',
  archived:             'bg-bg-surface text-text-muted border-border',
  draft:                'bg-bg-surface text-text-muted border-border',
  current:              'bg-success-dim text-success border-success-border',
  future:               'bg-info-dim text-info border-info-border',

  // Core system status variants
  suspended:            'bg-danger-dim text-danger border-danger-border',
  graduated:            'bg-brand-dim text-brand border-brand-border',
  upcoming:             'bg-info-dim text-info border-info-border',
  completed:            'bg-success-dim text-success border-success-border',
  issued:               'bg-brand-dim text-brand border-brand-border',
  void:                 'bg-bg-surface text-text-muted border-border',
  cancelled:            'bg-bg-surface text-text-muted border-border',
  paid:                 'bg-success-dim text-success border-success-border',
  partially_paid:       'bg-warning-dim text-warning border-warning-border',
  partial:              'bg-warning-dim text-warning border-warning-border',
  overdue:              'bg-danger-dim text-danger border-danger-border',

  // Attendance status variants
  present:              'bg-success-dim text-success border-success-border',
  absent:               'bg-danger-dim text-danger border-danger-border',
  late:                 'bg-warning-dim text-warning border-warning-border',
  half_day:             'bg-warning-dim text-warning border-warning-border',
  on_leave:             'bg-warning-dim text-warning border-warning-border',
  excused:              'bg-info-dim text-info border-info-border',
  holiday:              'bg-bg-surface text-text-muted border-border',

  // Payment status variants
  pending:              'bg-warning-dim text-warning border-warning-border',
  failed:               'bg-danger-dim text-danger border-danger-border',
  refunded:             'bg-info-dim text-info border-info-border',
} as const

export const VARIANT_ALIASES: Record<string, keyof typeof badgeVariantStyles> = {
  partial: 'partially_paid',
}

export type BadgeVariantKey = keyof typeof badgeVariantStyles
export type BadgeVariant = BadgeVariantKey | (string & {})

export function resolveBadgeVariant(variant?: string | null): BadgeVariantKey {
  if (!variant) return 'default'
  const normalized = variant.toLowerCase().trim()
  const aliased = VARIANT_ALIASES[normalized] || normalized
  return (aliased in badgeVariantStyles ? (aliased as BadgeVariantKey) : 'default')
}

export const badgeVariants = cva(
  'inline-flex items-center rounded-xl font-semibold leading-none border border-transparent capitalize whitespace-nowrap shrink-0',
  {
    variants: {
      variant: badgeVariantStyles,
      size: {
        sm:      'text-xs px-2 py-0.5 gap-1',
        default: 'text-xs px-2.5 py-0.5 gap-1.5',
        lg:      'text-sm px-3 py-1 gap-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size:    'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    Omit<VariantProps<typeof badgeVariants>, 'variant'> {
  variant?: BadgeVariant | null
  dot?: boolean
}

const formatChildren = (node: React.ReactNode): React.ReactNode => {
  if (typeof node === 'string') {
    return node.replace(/_/g, ' ')
  }
  if (Array.isArray(node)) {
    return node.map(formatChildren)
  }
  return node
}

export function Badge({ className, variant, size, dot = false, children, ...props }: BadgeProps) {
  const resolvedVariant = variant ? resolveBadgeVariant(variant) : 'default'
  return (
    <span className={cn(badgeVariants({ variant: resolvedVariant, size }), className)} {...props}>
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-current opacity-80 flex-shrink-0"
        />
      )}
      {formatChildren(children)}
    </span>
  )
}
