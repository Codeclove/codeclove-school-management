import type { LucideIcon } from 'lucide-react'
import { Shield } from 'lucide-react'
import { Button } from './Button'
import { Spinner } from './Spinner'
import { __ } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface FormActionFooterProps {
  icon?: LucideIcon
  title: string
  description?: string
  submitText: string
  submittingText?: string
  submitType?: 'submit' | 'button'
  onSubmit?: () => void
  cancelText?: string
  onCancel?: () => void
  isPending?: boolean
  disabled?: boolean
  formId?: string
  extraActions?: React.ReactNode
  className?: string
}

export function FormActionFooter({
  icon: Icon = Shield,
  title,
  description,
  submitText,
  submittingText,
  submitType = 'submit',
  onSubmit,
  cancelText = __( 'Cancel', 'codeclove-school-management' ),
  onCancel,
  isPending = false,
  disabled = false,
  formId,
  extraActions,
  className,
}: FormActionFooterProps) {
  return (
    <div
      className={cn(
        'border border-border bg-bg-elevated shadow-xs rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4',
        className
      )}
    >
      {/* Left Side: Icon + Title + Description */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg border border-border bg-bg-surface flex items-center justify-center text-text shrink-0 shadow-2xs">
          <Icon className="w-4 h-4 text-text-muted" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-text truncate">{title}</h4>
          {description && (
            <p className="text-2xs text-text-muted truncate mt-0.5">{description}</p>
          )}
        </div>
      </div>

      {/* Right Side: Action Buttons */}
      <div className="flex items-center justify-end gap-2.5 shrink-0">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isPending || disabled}
            className="h-8 px-3.5 text-xs font-medium rounded-lg bg-bg-surface hover:bg-hover-bg"
          >
            {cancelText}
          </Button>
        )}
        {extraActions}
        <Button
          type={submitType}
          form={formId}
          onClick={onSubmit}
          disabled={isPending || disabled}
          className="h-8 px-4 text-xs font-semibold rounded-lg shadow-xs"
        >
          {isPending ? (
            <>
              <Spinner size="xs" className="text-current me-1.5" />
              {submittingText || submitText}
            </>
          ) : (
            submitText
          )}
        </Button>
      </div>
    </div>
  )
}
