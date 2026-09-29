import { type LucideIcon, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from './Card'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  variant?: 'default' | 'dashed'
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  variant = 'default',
}: EmptyStateProps) {
  const isDashed = variant === 'dashed'

  const content = (
    <div className={cn('flex flex-col items-center justify-center text-center', !isDashed && className)}>
      <div
        className={cn(
          'rounded-xl flex items-center justify-center mb-4',
          isDashed
            ? 'w-14 h-14 rounded-2xl bg-brand-dim text-brand shadow-inner'
            : 'w-12 h-12 bg-bg-elevated border border-border text-text-subtle'
        )}
      >
        <Icon size={isDashed ? 24 : 20} />
      </div>
      <p className={cn('font-semibold text-text mb-1', isDashed ? 'text-base' : 'text-sm')}>{title}</p>
      {description && (
        <p className={cn('text-text-muted max-w-sm leading-relaxed', isDashed ? 'text-xs' : 'text-sm')}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )

  if (isDashed) {
    return (
      <Card className={cn('py-16 border-dashed border-2', className)}>
        <CardContent className="flex flex-col items-center justify-center text-center max-w-md mx-auto p-0">
          {content}
        </CardContent>
      </Card>
    )
  }

  return content
}
