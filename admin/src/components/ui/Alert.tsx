import React from 'react'
import { type LucideIcon, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'info'
  icon?: LucideIcon
  title?: string
}

export function Alert({
  variant = 'default',
  icon: Icon,
  title,
  className,
  children,
  ...props
}: AlertProps) {
  const DefaultIcon = {
    default: Info,
    danger: AlertTriangle,
    warning: AlertCircle,
    success: CheckCircle2,
    info: Info,
  }[variant]

  const ActiveIcon = Icon || DefaultIcon

  const variantStyles = {
    default: 'bg-bg-elevated border-border text-text',
    danger: 'bg-danger-dim border border-danger/20 text-danger',
    warning: 'bg-warning-dim border border-warning/20 text-warning',
    success: 'bg-success-dim border border-success/20 text-success',
    info: 'bg-info-dim border border-info/20 text-info',
  }[variant]

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-lg text-sm leading-relaxed',
        variantStyles,
        className
      )}
      {...props}
    >
      <ActiveIcon size={16} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        {title && <p className="font-semibold text-text">{title}</p>}
        {children && <div className={cn('text-xs opacity-90', !title && 'text-sm text-text')}>{children}</div>}
      </div>
    </div>
  )
}
