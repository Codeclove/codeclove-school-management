/**
 * ConfirmDialog — shadcn/ui style AlertDialog confirmation modal for CodeClove admin UI.
 *
 * Implements:
 *   - Modal with size="sm" (max-w-[425px])
 *   - Clean typographic AlertDialogHeader (Title + Description)
 *   - Async pending state with <Spinner size="xs" />
 *   - Tactile destructive micro-icon in confirmation button
 *   - Disabled cancel and confirm buttons while mutation is pending
 *   - Prevention of modal dismissal (outside click, escape key) while running
 *   - WCAG AA accessibility and design token alignment (Overlay Layer 3)
 */

import { useState, type ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Spinner } from './Spinner'
import { Trash2, AlertTriangle } from 'lucide-react'
import { __ } from '@/lib/i18n'

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info' | 'default'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  variant?: ConfirmDialogVariant
  confirmText?: string
  cancelText?: string
  onConfirm: () => Promise<void> | void
  isLoading?: boolean
  children?: ReactNode
  className?: string
  container?: HTMLElement | null
}

const VARIANT_CONFIG: Record<
  ConfirmDialogVariant,
  {
    buttonVariant: 'danger' | 'default'
    defaultConfirmText: string
  }
> = {
  danger: {
    buttonVariant: 'danger',
    defaultConfirmText: __( 'Delete', 'codeclove-school-management' ),
  },
  warning: {
    buttonVariant: 'danger',
    defaultConfirmText: __( 'Confirm', 'codeclove-school-management' ),
  },
  info: {
    buttonVariant: 'default',
    defaultConfirmText: __( 'Confirm', 'codeclove-school-management' ),
  },
  default: {
    buttonVariant: 'default',
    defaultConfirmText: __( 'Confirm', 'codeclove-school-management' ),
  },
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = 'default',
  confirmText,
  cancelText,
  onConfirm,
  isLoading = false,
  children,
  className,
  container,
}: ConfirmDialogProps) {
  const [isInternalLoading, setIsInternalLoading] = useState(false)
  const isPending = isLoading || isInternalLoading

  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.default
  const isDestructive = variant === 'danger' || variant === 'warning'
  const titleStr = typeof title === 'string' ? title : ''
  const isDelete =
    /delete|remove|trash|purge|erase/i.test(titleStr) ||
    /delete|remove|trash|purge|erase/i.test(confirmText || '')

  const handleOpenChange = (nextOpen: boolean) => {
    // Prevent closing via backdrop, Escape key, or close button while action is running
    if (isPending) return
    onOpenChange(nextOpen)
  }

  const handleConfirm = async () => {
    if (isPending) return
    try {
      const result = onConfirm()
      if (result && typeof (result as Promise<void>).then === 'function') {
        setIsInternalLoading(true)
        await result
      }
    } finally {
      setIsInternalLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      isLoading={isPending}
      title={title}
      description={description}
      size="sm"
      className={className}
      container={container}
      hideHeader
      noHeaderBorder
    >
      <div className="p-6 space-y-4">
        {/* shadcn AlertDialogHeader */}
        <div className="space-y-2 text-left">
          <h3 className="text-lg font-semibold tracking-tight text-text leading-tight">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-text-muted leading-relaxed">
              {description}
            </p>
          )}
          {children && (
            <div className="text-sm text-text-muted leading-relaxed">
              {children}
            </div>
          )}
        </div>

        {/* shadcn AlertDialogFooter */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            data-dialog-cancel
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
            className="h-9 px-4 text-sm font-medium"
          >
            {cancelText ?? __( 'Cancel', 'codeclove-school-management' )}
          </Button>
          <Button
            type="button"
            variant={config.buttonVariant}
            data-dialog-confirm
            onClick={handleConfirm}
            disabled={isPending}
            className="h-9 px-4 text-sm font-medium gap-1.5 shadow-sm"
          >
            {isPending ? (
              <Spinner size="xs" className="text-current shrink-0" />
            ) : isDelete ? (
              <Trash2 size={14} className="shrink-0" />
            ) : isDestructive ? (
              <AlertTriangle size={14} className="shrink-0" />
            ) : null}
            <span>{confirmText ?? config.defaultConfirmText}</span>
          </Button>
        </div>
      </div>
    </Modal>
  )
}
