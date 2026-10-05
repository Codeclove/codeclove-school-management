import React, { createContext, useContext, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { toast as sonnerToast, Toaster } from 'sonner'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useTheme } from './theme'

interface ToastContextType {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()

  const success = useCallback((message: string) => {
    sonnerToast.success(message)
  }, [])

  const error = useCallback((message: string) => {
    sonnerToast.error(message)
  }, [])

  const info = useCallback((message: string) => {
    sonnerToast.info(message)
  }, [])

  const toaster = (
    <Toaster
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      style={{ zIndex: 99999 }}
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-success shrink-0" />,
        error: <AlertCircle className="h-5 w-5 text-danger shrink-0" />,
        info: <Info className="h-5 w-5 text-info shrink-0" />,
      }}
      toastOptions={{
        classNames: {
          closeButton: 'toast-close-button',
        },
      }}
    />
  )

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      {typeof document !== 'undefined' ? createPortal(toaster, document.body) : toaster}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
