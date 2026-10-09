import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    const isError = Boolean(
      error ||
      props['aria-invalid'] === true ||
      props['aria-invalid'] === 'true'
    )

    return (
      <input
        ref={ref}
        aria-invalid={isError ? true : undefined}
        className={cn(
          'flex h-8 w-full rounded px-3 text-sm',
          'bg-bg-surface border transition-colors duration-100',
          'placeholder:text-text-subtle text-text',
          'focus:outline-none focus:ring-1 focus:ring-brand-ring',
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
Input.displayName = 'Input'
