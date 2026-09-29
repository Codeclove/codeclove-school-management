import React, { createContext, useContext, useState, useRef } from 'react'
import { Modal, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { ShieldAlert, AlertTriangle, CheckCircle2, Info, HelpCircle } from 'lucide-react'
import { __ } from '@/lib/i18n'

interface ConfirmOptions {
  title?: string
  message: string
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'info'
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
    const variant = opts.variant || (
      /delete|remove|void|cancel|reverse|clear/i.test(title) ? 'danger' : 'default'
    )
    const confirmText = opts.confirmText || (
      variant === 'danger' ? __( 'Delete', 'codeclove-school-management' ) : __( 'Confirm', 'codeclove-school-management' )
    )

    setOptions({
      ...opts,
      title,
      variant,
      confirmText,
      cancelText: opts.cancelText || 'Cancel'
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

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        open={isOpen}
        onOpenChange={(open) => !open && handleClose(false)}
        title={options?.title || __( 'Confirm Action', 'codeclove-school-management' )}
        size="sm"
        noHeaderBorder
      >
        <div className="space-y-6">
          {/* Simple flat warning text and icon with no border box */}
          <div className="flex items-start gap-3 pt-1">
            <div className={cn(
              "shrink-0 mt-0.5",
              options?.variant === 'danger' && "text-danger",
              options?.variant === 'warning' && "text-warning",
              options?.variant === 'success' && "text-success",
              options?.variant === 'info' && "text-brand",
              (!options?.variant || options?.variant === 'default') && "text-text-subtle"
            )}>
              {options?.variant === 'danger' && <ShieldAlert size={20} />}
              {options?.variant === 'warning' && <AlertTriangle size={20} />}
              {options?.variant === 'success' && <CheckCircle2 size={20} />}
              {options?.variant === 'info' && <Info size={20} />}
              {(!options?.variant || options?.variant === 'default') && <HelpCircle size={20} />}
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              {options?.message}
            </p>
          </div>

          {/* Footer controls without top border line */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="text-sm font-semibold text-text-muted hover:text-text bg-transparent hover:bg-transparent transition-colors px-3 py-2"
            >
              {options?.cancelText || __( 'Cancel', 'codeclove-school-management' )}
            </button>
            <Button
              variant={options?.variant === 'danger' || options?.variant === 'warning' ? 'danger' : 'default'}
              onClick={() => handleClose(true)}
              className="h-10 px-4 text-sm font-semibold rounded-lg"
            >
              {options?.confirmText || __( 'Confirm', 'codeclove-school-management' )}
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
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context.confirm
}
