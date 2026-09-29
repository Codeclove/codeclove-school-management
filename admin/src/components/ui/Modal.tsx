/**
 * Modal — Radix UI Dialog wrapped in CodeClove design tokens.
 *
 * Usage:
 *   <Modal open={open} onOpenChange={setOpen} title="Apply Preset" description="...">
 *     <p>Content</p>
 *     <ModalFooter>
 *       <Button onClick={() => setOpen(false)}>Cancel</Button>
 *     </ModalFooter>
 *   </Modal>
 */
import { useRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn, getPortalContainer } from '@/lib/utils'
import { __ } from '@/lib/i18n'

// ─── Modal Root ───────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  hideHeader?: boolean
  noHeaderBorder?: boolean
  container?: HTMLElement | null
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
  className,
  hideHeader = false,
  noHeaderBorder = false,
  container,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const portalContainer = getPortalContainer(container)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={portalContainer}>
        {/* Backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[9990] bg-black/50 backdrop-blur-[2px]',
            'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out'
          )}
        />

        {/* Panel */}
        <DialogPrimitive.Content
          ref={contentRef}
          onPointerDownOutside={(e) => {
            const originalEvent = e.detail.originalEvent
            if (contentRef.current && originalEvent) {
              const rect = contentRef.current.getBoundingClientRect()
              const { clientX, clientY } = originalEvent
              if (
                typeof clientX === 'number' &&
                typeof clientY === 'number' &&
                clientX >= rect.left &&
                clientX <= rect.right &&
                clientY >= rect.top &&
                clientY <= rect.bottom
              ) {
                e.preventDefault()
              }
            }
          }}
          className={cn(
            'fixed z-[9995] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-[calc(100vw-2rem)] flex flex-col',
            'max-h-[min(90vh,720px)]',
            'bg-bg-surface border border-border rounded-xl shadow-modal outline-none focus-visible:ring-0 focus-visible:ring-offset-0 overflow-hidden',
            'data-[state=open]:animate-scale-in',
            SIZE_CLASSES[size],
            className
          )}
        >
          {/* Accessibility Title if header is hidden */}
          {hideHeader && (
            <DialogPrimitive.Title className="sr-only">
              {title}
            </DialogPrimitive.Title>
          )}

          {/* Header */}
          {!hideHeader && (
            <div className={cn(
              "flex items-start justify-between gap-3 px-6 pt-5 flex-shrink-0",
              noHeaderBorder ? "pb-1" : "pb-4 border-b border-border"
            )}>
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-lg font-semibold text-text leading-tight">
                  {title}
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
                  'flex-shrink-0 w-7 h-7 flex items-center justify-center rounded',
                  'text-text-subtle hover-bg transition-colors duration-100',
                  'focus-visible:ring-2 focus-visible:ring-brand-ring'
                )}
              >
                <X size={15} />
              </DialogPrimitive.Close>
            </div>
          )}

          {/* Scrollable body */}
          <div className={cn("flex-1 overflow-y-auto", hideHeader ? "p-0" : "px-6 py-5")}>
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ─── Modal Footer ─────────────────────────────────────────────────────────────

export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 pt-4 border-t border-border mt-4',
        className
      )}
    >
      {children}
    </div>
  )
}
