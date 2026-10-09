import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { Link } from 'react-router-dom'
export interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  actions?: React.ReactNode
  className?: string
  onBack?: () => void
  breadcrumbs?: BreadcrumbItem[]
}

export function PageHeader({ title, description, icon: Icon, actions, className, onBack, breadcrumbs }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-2.5 mb-6 w-full', className)}>
      {/* Breadcrumbs Row */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-text-muted flex-wrap">
          {breadcrumbs.map((item, idx) => {
            const isLast = idx === breadcrumbs.length - 1
            return (
              <div key={idx} className="flex items-center gap-1.5">
                {idx > 0 && <span className="text-text-subtle font-normal">/</span>}
                {item.href && !isLast ? (
                  <Link to={item.href} className="hover:text-brand transition-colors font-medium">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-text font-semibold" : "font-medium"}>{item.label}</span>
                )}
              </div>
            )
          })}
        </nav>
      )}

      {/* Main Title & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 w-full">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button
                variant="ghost"
                onClick={onBack}
                size="sm"
                className="h-9 w-9 p-0 flex-shrink-0 hover:bg-hover-bg rounded-lg text-text-muted hover:text-text transition-colors"
              >
                <ArrowLeft size={16} className="rtl:rotate-180" />
              </Button>
            )}
            {Icon && (
              <div className="w-9 h-9 rounded-lg bg-brand-dim flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-brand" />
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-text leading-tight">{title}</h1>
          </div>
          {description && (
            <p className={cn("text-sm text-text-muted mt-1 leading-normal", onBack || Icon ? "ps-11" : "")}>
              {description}
            </p>
          )}
        </div>

        {actions && <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto sm:flex-shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
