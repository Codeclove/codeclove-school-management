import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    const isError = Boolean(
      error ||
      props['aria-invalid'] === true ||
      props['aria-invalid'] === 'true'
    )

    return (
      <textarea
        ref={ref}
        aria-invalid={isError ? true : undefined}
        className={cn(
          'flex min-h-[80px] w-full rounded px-3 py-2 text-sm',
          'bg-bg-surface border transition-colors duration-100',
          'placeholder:text-text-subtle text-text',
          'focus:outline-none focus:ring-1 focus:ring-brand-ring',
          'resize-y',
          isError
            ? 'border-danger focus:ring-danger'
            : 'border-border hover:border-border-strong focus:border-brand',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'
