import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-8 w-full rounded px-3 text-sm',
        'bg-bg-surface border transition-colors duration-100',
        'placeholder:text-text-subtle text-text',
        'focus:outline-none focus:ring-1 focus:ring-brand-ring',
        error
          ? 'border-danger focus:ring-danger/50'
          : 'border-border hover:border-border-strong focus:border-brand',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
