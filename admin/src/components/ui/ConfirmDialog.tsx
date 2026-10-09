/**
 * ConfirmDialog — Tier 2 reusable confirmation modal for CodeClove admin UI.
 *
 * Implements:
 *   - Modal with size="sm"
 *   - Variant styling ('danger' | 'warning' | 'info' | 'default') with contextual icons
 *   - Async pending state with <Spinner size="xs" />
 *   - Disabled cancel and confirm buttons while mutation is pending
 *   - Prevention of modal dismissal (outside click, escape key) while running
 *   - WCAG AA accessibility and design token alignment (Overlay Layer 3)
 */

import { useState, type ReactNode } from 'react'
import { AlertTriangle, Info, HelpCircle, type LucideIcon } from 'lucide-react'
import { Modal, ModalFooter } from './Modal'
import { Button } from './Button'
import { Spinner } from './Spinner'
import { cn } from '@/lib/utils'
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
    icon: LucideIcon
    iconClass: string
    iconBgClass: string
    buttonVariant: 'danger' | 'default'
    defaultConfirmText: string
  }
> = {
  danger: {
    icon: AlertTriangle,
    iconClass: 'text-danger',
    iconBgClass: 'bg-danger-dim border border-danger-border',
    buttonVariant: 'danger',
    defaultConfirmText: __( 'Delete', 'codeclove-school-management' ),
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-warning',
    iconBgClass: 'bg-warning-dim border border-warning-border',
    buttonVariant: 'danger',
    defaultConfirmText: __( 'Confirm', 'codeclove-school-management' ),
  },
  info: {
    icon: Info,
    iconClass: 'text-brand',
    iconBgClass: 'bg-brand-dim border border-brand-border',
    buttonVariant: 'default',
    defaultConfirmText: __( 'Confirm', 'codeclove-school-management' ),
  },
  default: {
    icon: HelpCircle,
    iconClass: 'text-text-subtle',
    iconBgClass: 'bg-bg-surface border border-border',
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
  const IconComponent = config.icon

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
      title={
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
              config.iconBgClass
            )}
            aria-hidden="true"
          >
            <IconComponent size={16} className={config.iconClass} />
          </span>
          <span className="leading-tight font-semibold text-text">{title}</span>
        </div>
      }
      description={description}
      size="sm"
      className={className}
      container={container}
      noHeaderBorder
    >
      <div className="space-y-4">
        {children && (
          <div className="text-sm text-text-muted leading-relaxed">
            {children}
          </div>
        )}

        <ModalFooter className={cn('border-t border-border pt-3 mt-4')}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            {cancelText ?? __( 'Cancel', 'codeclove-school-management' )}
          </Button>
          <Button
            type="button"
            variant={config.buttonVariant}
            onClick={handleConfirm}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending && <Spinner size="xs" className="text-current shrink-0" />}
            <span>{confirmText ?? config.defaultConfirmText}</span>
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
