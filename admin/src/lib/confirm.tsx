import React, { createContext, useContext, useState, useRef } from 'react'
import { Modal, Button } from '@/components/ui'
import { Trash2, AlertTriangle } from 'lucide-react'
import { __ } from '@/lib/i18n'

export type ConfirmVariant = 'default' | 'danger' | 'warning' | 'success' | 'info'

export interface ConfirmOptions {
  title?: string
  message: string
  description?: string
  variant?: ConfirmVariant
  confirmText?: string
  cancelText?: string
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = (opts: ConfirmOptions) => {
    const title = opts.title || __( 'Confirm Action', 'codeclove-school-management' )
    const variant: ConfirmVariant =
      opts.variant ||
      (/delete|remove|void|cancel|reverse|clear|purge|reset/i.test(title)
        ? 'danger'
        : 'default')
    const confirmText =
      opts.confirmText ||
      (variant === 'danger'
        ? __( 'Delete', 'codeclove-school-management' )
        : __( 'Confirm', 'codeclove-school-management' ))

    setOptions({
      ...opts,
      title,
      variant,
      confirmText,
      cancelText: opts.cancelText || __( 'Cancel', 'codeclove-school-management' ),
    })
    setIsOpen(true)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }

  const handleClose = (value: boolean) => {
    setIsOpen(false)
    if (resolveRef.current) {
      resolveRef.current(value)
      resolveRef.current = null
    }
  }

  const variant = options?.variant || 'default'
  const isDestructive = variant === 'danger' || variant === 'warning'
  const isDelete =
    /delete|remove|trash|purge|erase/i.test(options?.title || '') ||
    /delete|remove|trash|purge|erase/i.test(options?.confirmText || '')

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        open={isOpen}
        onOpenChange={(open) => !open && handleClose(false)}
        title={options?.title || __( 'Confirm Action', 'codeclove-school-management' )}
        size="sm"
        hideHeader
      >
        <div className="p-6 space-y-4">
          {/* shadcn AlertDialogHeader */}
          <div className="space-y-2 text-left">
            <h3 className="text-lg font-semibold tracking-tight text-text leading-tight">
              {options?.title || __( 'Confirm Action', 'codeclove-school-management' )}
            </h3>
            {options?.message && (
              <p className="text-sm text-text-muted leading-relaxed">
                {options.message}
              </p>
            )}
            {options?.description && (
              <p className="text-xs text-text-subtle leading-relaxed">
                {options.description}
              </p>
            )}
          </div>

          {/* shadcn AlertDialogFooter */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              data-dialog-cancel
              onClick={() => handleClose(false)}
              className="h-9 px-4 text-sm font-medium"
            >
              {options?.cancelText || __( 'Cancel', 'codeclove-school-management' )}
            </Button>
            <Button
              type="button"
              variant={isDestructive ? 'danger' : 'default'}
              data-dialog-confirm
              onClick={() => handleClose(true)}
              className="h-9 px-4 text-sm font-medium gap-1.5 shadow-sm"
            >
              {isDelete ? (
                <Trash2 size={14} className="shrink-0" />
              ) : isDestructive ? (
                <AlertTriangle size={14} className="shrink-0" />
              ) : null}
              <span>{options?.confirmText}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const context = useContext(ConfirmContext)
  return (
    context?.confirm ??
    (async (opts) => (typeof window !== 'undefined' ? window.confirm(opts.message || '') : true))
  )
}
