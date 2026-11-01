/**
 * Popover — Canonical Radix UI Popover wrapped in CodeClove design tokens.
 *
 * Provides accessible, floating overlay surfaces for secondary controls,
 * layout customizers, and interactive popovers without clipping.
 */
import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn, getPortalContainer } from '@/lib/utils'

export interface PopoverProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  container?: HTMLElement | null
}

export const Popover = React.forwardRef<HTMLButtonElement, PopoverProps>(
  (
    {
      trigger,
      children,
      align = 'end',
      sideOffset = 6,
      className,
      open,
      onOpenChange,
      container,
    },
    ref
  ) => {
    const portalContainer = getPortalContainer(container)

    return (
      <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <PopoverPrimitive.Trigger asChild ref={ref}>
          {trigger}
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal container={portalContainer}>
          <PopoverPrimitive.Content
            align={align}
            sideOffset={sideOffset}
            className={cn(
              'z-[100050] w-80 rounded-xl p-3.5',
              'bg-bg-overlay border border-border shadow-modal outline-none',
              'animate-slide-down overscroll-contain text-xs text-text',
              className
            )}
          >
            {children}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    )
  }
)

Popover.displayName = 'Popover'
