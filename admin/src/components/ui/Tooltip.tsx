/**
 * Tooltip — Radix UI primitive wrapped in CodeClove design tokens.
 *
 * Usage:
 *   <Tooltip content="Delete record">
 *     <Button size="icon"><Trash2 /></Button>
 *   </Tooltip>
 */
import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn, getPortalContainer } from '@/lib/utils'

// ─── Provider (mount once in AppShell) ───────────────────────────────────────

export const TooltipProvider = TooltipPrimitive.Provider

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipProps extends Omit<React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>, 'content'> {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delay?: number
  className?: string
  container?: HTMLElement | null
}

export const Tooltip = React.forwardRef<
  HTMLButtonElement,
  TooltipProps
>(({
  content,
  children,
  side = 'top',
  delay = 400,
  className,
  container,
  ...props
}, ref) => {
  const portalContainer = getPortalContainer(container)

  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild ref={ref} {...props}>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal container={portalContainer}>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-[10010] max-w-xs px-2.5 py-1.5 rounded text-xs font-medium',
            'bg-bg-overlay border border-border shadow-modal text-text',
            'animate-fade-in select-none',
            className
          )}
        >
          {content}
          <TooltipPrimitive.Arrow
            className="fill-border"
            width={8}
            height={4}
          />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
})

Tooltip.displayName = 'Tooltip'
