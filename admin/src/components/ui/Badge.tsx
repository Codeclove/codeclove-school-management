import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-xl font-medium leading-none border border-transparent capitalize whitespace-nowrap shrink-0',
  {
    variants: {
      variant: {
        default:  'bg-text-muted/5 text-text-muted border-text-muted/20',
        brand:    'bg-brand-dim text-brand border-brand/20',
        success:  'bg-success/5 text-success border-success/30',
        warning:  'bg-warning/5 text-warning border-warning/20',
        danger:   'bg-danger/5 text-danger border-danger/20',
        info:     'bg-info/5 text-info border-info/20',

        // Workflow & System status variants
        inquiry:              'bg-text-muted/5 text-text-muted border-text-muted/20',
        submitted:            'bg-info/5 text-info border-info/20',
        under_review:         'bg-brand-dim text-brand border-brand/20',
        more_info_needed:     'bg-warning/5 text-warning border-warning/20',
        interview_scheduled:  'bg-status-interview_scheduled/10 text-status-interview_scheduled border-status-interview_scheduled/20',
        accepted:             'bg-success/5 text-success border-success/30',
        waitlisted:           'bg-status-waitlisted/10 text-status-waitlisted border-status-waitlisted/20',
        rejected:             'bg-danger/5 text-danger border-danger/20',
        admitted:             'bg-success/5 text-success border-success/30',
        withdrawn:            'bg-text-muted/5 text-text-subtle border-text-muted/20',
        hired:                'bg-success/5 text-success border-success/30',
        offer_sent:           'bg-status-offer_sent/10 text-status-offer_sent border-status-offer_sent/20',
        active:               'bg-success/5 text-success border-success/30',
        inactive:             'bg-text-muted/5 text-text-muted border-text-muted/20',
        archived:             'bg-text-muted/5 text-text-subtle border-text-muted/20',
        draft:                'bg-text-muted/5 text-text-muted border-text-muted/20',
        current:              'bg-success/5 text-success border-success/30',
        future:               'bg-info/5 text-info border-info/20',

        // Core system status variants
        suspended:            'bg-danger/5 text-danger border-danger/20',
        graduated:            'bg-brand-dim text-brand border-brand/20',
        upcoming:             'bg-info/5 text-info border-info/20',
        completed:            'bg-success/5 text-success border-success/30',
        issued:               'bg-brand-dim text-brand border-brand/20',
        void:                 'bg-text-muted/5 text-text-muted border-text-muted/20',
        cancelled:            'bg-text-muted/5 text-text-muted border-text-muted/20',
        paid:                 'bg-success/5 text-success border-success/30',
        partially_paid:       'bg-warning/5 text-warning border-warning/20',
        overdue:              'bg-danger/5 text-danger border-danger/20',

        // Attendance status variants
        present:              'bg-success/5 text-success border-success/30',
        absent:               'bg-danger/5 text-danger border-danger/20',
        late:                 'bg-warning/5 text-warning border-warning/20',
        half_day:             'bg-warning/5 text-warning border-warning/20',
        on_leave:             'bg-warning/5 text-warning border-warning/20',
        excused:              'bg-info/5 text-info border-info/20',
        holiday:              'bg-text-muted/5 text-text-muted border-text-muted/20',

        // Payment status variants
        pending:              'bg-warning/5 text-warning border-warning/20',
        failed:               'bg-danger/5 text-danger border-danger/20',
        refunded:             'bg-info/5 text-info border-info/20',
      },
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
    VariantProps<typeof badgeVariants> {
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
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-current opacity-80 flex-shrink-0"
        />
      )}
      {formatChildren(children)}
    </span>
  )
}
