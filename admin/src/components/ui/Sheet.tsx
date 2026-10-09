/**
 * Sheet — Slide-over drawer panel built on Radix UI Dialog.
 *
 * Usage:
 *   <Sheet open={isOpen} onOpenChange={setIsOpen} title="Student Details" size="lg">
 *     <SheetBody>Content</SheetBody>
 *     <SheetFooter>
 *       <Button onClick={() => setIsOpen(false)}>Close</Button>
 *     </SheetFooter>
 *   </Sheet>
 */

import { useRef, type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn, getPortalContainer } from '@/lib/utils'
import { __ } from '@/lib/i18n'

export type SheetSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'
export type SheetSide = 'right' | 'left'

export interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
  description?: ReactNode
  size?: SheetSize
  side?: SheetSide
  children: ReactNode
  className?: string
  hideHeader?: boolean
  container?: HTMLElement | null
}

const SHEET_SIZE_CLASSES: Record<SheetSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
  full: 'max-w-full',
}

const SIDE_STYLES: Record<
  SheetSide,
  {
    position: string
    border: string
    animation: string
  }
> = {
  right: {
    position: 'inset-y-0 right-0',
    border: 'border-l border-border',
    animation:
      'data-[state=open]:animate-slide-in-from-right data-[state=closed]:animate-slide-out-to-right',
  },
  left: {
    position: 'inset-y-0 left-0',
    border: 'border-r border-border',
    animation:
      'data-[state=open]:animate-slide-in-from-left data-[state=closed]:animate-slide-out-to-left',
  },
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  side = 'right',
  children,
  className,
  hideHeader = false,
  container,
}: SheetProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const portalContainer = getPortalContainer(container)
  const sideConfig = SIDE_STYLES[side] ?? SIDE_STYLES.right

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={portalContainer}>
        {/* Full-screen backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[100000] bg-black/60 dark:bg-black/75 backdrop-blur-sm',
            'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out'
          )}
        />

        {/* Slide-over panel */}
        <DialogPrimitive.Content
          ref={contentRef}
          onPointerDownOutside={(e) => {
            const ev = e.detail.originalEvent
            if (!contentRef.current || !ev) return
            const rect = contentRef.current.getBoundingClientRect()
            const inRect =
              typeof ev.clientX === 'number' &&
              typeof ev.clientY === 'number' &&
              ev.clientX >= rect.left &&
              ev.clientX <= rect.right &&
              ev.clientY >= rect.top &&
              ev.clientY <= rect.bottom
            if (
              inRect ||
              (ev.target as HTMLElement)?.closest?.(
                '[data-radix-popper-content-wrapper], [data-radix-focus-guard]'
              )
            ) {
              e.preventDefault()
            }
          }}
          className={cn(
            'fixed z-[100001] h-full w-full flex flex-col',
            'bg-bg-overlay text-text shadow-modal outline-none focus-visible:ring-0 focus-visible:ring-offset-0 overflow-hidden',
            sideConfig.position,
            sideConfig.border,
            sideConfig.animation,
            SHEET_SIZE_CLASSES[size],
            className
          )}
        >
          {/* Accessible title when header is visually hidden */}
          {hideHeader && (
            <DialogPrimitive.Title className="sr-only">
              {title || __( 'Panel', 'codeclove-school-management' )}
            </DialogPrimitive.Title>
          )}

          {/* Drawer Header */}
          {!hideHeader && (
            <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-border flex-shrink-0">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-lg font-semibold text-text leading-tight truncate">
                  {title || __( 'Panel', 'codeclove-school-management' )}
                </DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="text-sm text-text-muted mt-1 leading-relaxed">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close
                aria-label={__( 'Close', 'codeclove-school-management' )}
                className={cn(
                  'flex-shrink-0 flex items-center justify-center -mr-1',
                  'text-text-muted hover:text-text hover:bg-hover-bg rounded-lg p-1.5 transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-brand-ring'
                )}
              >
                <X size={16} />
              </DialogPrimitive.Close>
            </div>
          )}

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

export function SheetHeader({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('px-6 py-5 border-b border-border flex-shrink-0', className)}>
      {children}
    </div>
  )
}

export function SheetBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('flex-1 overflow-y-auto px-6 py-5', className)}>{children}</div>
}

export function SheetFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-overlay flex-shrink-0 mt-auto',
        className
      )}
    >
      {children}
    </div>
  )
}
