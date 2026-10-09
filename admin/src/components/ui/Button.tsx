import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Base styles
  [
    'inline-flex items-center justify-center gap-1.5 font-medium',
    'rounded transition-all duration-100 focus-visible:ring-2',
    'focus-visible:ring-brand-ring focus-visible:ring-offset-1',
    'focus-visible:ring-offset-bg-base disabled:opacity-50',
    'disabled:pointer-events-none select-none active:scale-[0.98]',
  ],
  {
    variants: {
      variant: {
        default:   'bg-brand text-text-inverted hover:bg-brand-strong shadow-sm',
        secondary: 'bg-bg-elevated text-text hover:bg-hover-bg border border-border shadow-sm',
        ghost:     'text-text-muted hover:text-text hover:bg-hover-bg',
        danger:    'bg-danger text-text-inverted hover:opacity-90 border border-transparent shadow-sm',
        link:      'text-brand hover:text-brand-strong underline-offset-4 hover:underline p-0 h-auto active:scale-100',
      },
      size: {
        sm:      'h-7 px-2.5 text-xs',
        default: 'h-8 px-3.5 text-sm',
        lg:      'h-9 px-4 text-base',
        icon:    'h-8 w-8 p-0',
        'icon-sm': 'h-7 w-7 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size:    'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Button.displayName = 'Button'
