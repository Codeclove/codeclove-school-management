import { useState } from 'react'
import { Database, Trash2, X } from 'lucide-react'
import { Card, Button, Spinner } from '@/components/ui'
import {
  clearDemoData,
  dismissDemoDataPrompt,
  useDemoDataStatus,
  type DemoDataStatus,
} from '@/api/demo-data'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/query-keys'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { __ } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface DemoDataActiveBannerProps {
  status?: DemoDataStatus
  onCleared?: () => void
  onDismiss?: () => void
  className?: string
}

export function DemoDataActiveBanner({
  status: propStatus,
  onCleared,
  onDismiss,
  className,
}: DemoDataActiveBannerProps = {}) {
  const [dismissedLocally, setDismissedLocally] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const toast = useToast()

  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const { data: queriedStatus } = useDemoDataStatus({ enabled: !propStatus })

  const status = propStatus ?? queriedStatus
  const isImported = Boolean(status?.imported)

  if (!isImported || dismissedLocally || status?.prompt_dismissed) {
    return null
  }

  const handleClear = async () => {
    const isConfirmed = await confirm({
      title: __( 'Clear Demo Data', 'codeclove-school-management' ),
      message: __(
        'Are you sure you want to clear all sample demo data? This will wipe demo classes, students, and invoices.',
        'codeclove-school-management'
      ),
      variant: 'danger',
      confirmText: __( 'Clear Sample Data', 'codeclove-school-management' ),
    })

    if (!isConfirmed) return

    setIsClearing(true)
    try {
      const res = await clearDemoData()
      if (res.success) {
        toast.success(
          res.message ||
            __( 'Sample records cleared successfully.', 'codeclove-school-management' )
        )
        await queryClient.invalidateQueries({ queryKey: queryKeys.demoData.all })
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
        await queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all })
        await queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
        await queryClient.invalidateQueries({ queryKey: queryKeys.finance.all })
        onCleared?.()
      } else {
        toast.error(
          res.message || __( 'Failed to clear sample data.', 'codeclove-school-management' )
        )
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : __( 'Failed to clear sample data.', 'codeclove-school-management' )
      toast.error(msg)
    } finally {
      setIsClearing(false)
    }
  }

  const handleDismiss = () => {
    setDismissedLocally(true)
    dismissDemoDataPrompt().catch((err) => {
      console.error('Failed to dismiss demo data prompt:', err)
    })
    onDismiss?.()
  }

  return (
    <Card
      className={cn(
        'p-4 sm:p-5 border border-amber-500/30 bg-bg-elevated shadow-sm relative',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <Database className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <h3 className="text-base font-semibold text-text">
              {__( 'Sample School Records Active', 'codeclove-school-management' )}
            </h3>
            <p className="text-sm text-text-muted leading-relaxed max-w-3xl">
              {__(
                'You are currently exploring CodeClove with demo classes, students, and invoices. When ready for real school operations, wipe sample records in 1 click.',
                'codeclove-school-management'
              )}
            </p>
            <div className="pt-1.5">
              <Button
                variant="danger"
                size="sm"
                onClick={handleClear}
                disabled={isClearing}
                className="gap-1.5 font-medium shadow-sm"
              >
                {isClearing ? <Spinner size="xs" /> : <Trash2 className="w-3.5 h-3.5" />}
                {__( 'Clear Sample Data', 'codeclove-school-management' )}
              </Button>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-text-muted hover:text-text rounded-md p-1 transition-colors -mr-1 -mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          aria-label={__( 'Dismiss', 'codeclove-school-management' )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </Card>
  )
}

export default DemoDataActiveBanner
