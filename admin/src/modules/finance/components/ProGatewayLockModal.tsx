import { useNavigate } from 'react-router-dom'
import {
  QrCode,
  Lock,
  Sparkles,
  Zap,
  CheckCircle2,
  Receipt,
  RefreshCw,
  Globe,
} from 'lucide-react'
import { Button, Modal, ModalFooter } from '@/components/ui'
import { __ } from '@/lib/i18n'

export interface ProGatewayLockModalProps {
  isOpen?: boolean
  open?: boolean
  onClose: () => void
}

export function ProGatewayLockModal({ isOpen, open, onClose }: ProGatewayLockModalProps) {
  const navigate = useNavigate()
  const isVisible = isOpen ?? open ?? false

  const handleUpgrade = () => {
    onClose()
    navigate('/pro-upgrade?feature=payment_gateways')
  }

  return (
    <Modal
      open={isVisible}
      onOpenChange={(val) => !val && onClose()}
      size="lg"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0">
            <Lock size={16} />
          </div>
          <div>
            <span className="font-bold text-text text-base leading-snug">
              {__('Automated Online Payment Gateways', 'codeclove-school-management')}
            </span>
          </div>
          <span className="ms-auto shrink-0 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/25">
            PRO
          </span>
        </div>
      }
      description={__(
        'Accept fee collections with automated invoice reconciliation and zero manual cashier entry.',
        'codeclove-school-management'
      )}
    >
      <div className="space-y-5 pt-1">
        {/* Gateway options grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Razorpay (India & UPI) */}
          <div className="rounded-xl border border-border bg-bg-surface p-4 flex flex-col justify-between space-y-3 shadow-2xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <QrCode size={16} />
                  </div>
                  <h4 className="font-semibold text-sm text-text">Razorpay</h4>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {__('India & South Asia', 'codeclove-school-management')}
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {__(
                  'Direct UPI QR codes, Google Pay, PhonePe, Paytm, plus 50+ domestic banks and cards.',
                  'codeclove-school-management'
                )}
              </p>
            </div>
            <ul className="text-2xs text-text-muted space-y-1 pt-2 border-t border-border/60">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                <span>{__('Dynamic QR codes per invoice', 'codeclove-school-management')}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                <span>{__('Instant domestic settlement', 'codeclove-school-management')}</span>
              </li>
            </ul>
          </div>

          {/* Stripe (Global & Cards) */}
          <div className="rounded-xl border border-border bg-bg-surface p-4 flex flex-col justify-between space-y-3 shadow-2xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                    <Globe size={16} />
                  </div>
                  <h4 className="font-semibold text-sm text-text">Stripe</h4>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {__('Global / Worldwide', 'codeclove-school-management')}
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {__(
                  'Visa, MasterCard, Amex from 135+ countries with 1-click Apple Pay and Google Pay checkouts.',
                  'codeclove-school-management'
                )}
              </p>
            </div>
            <ul className="text-2xs text-text-muted space-y-1 pt-2 border-t border-border/60">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                <span>{__('International cards & wallets', 'codeclove-school-management')}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                <span>{__('PCI-DSS Level 1 compliant', 'codeclove-school-management')}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Benefits breakdown */}
        <div className="rounded-xl border border-border bg-bg-surface p-4 space-y-3">
          <h4 className="text-xs font-semibold text-text uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={14} className="text-amber-500" />
            <span>{__('Key Automation Benefits', 'codeclove-school-management')}</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-text flex items-center gap-1.5">
                <Receipt size={13} className="text-brand" />
                <span>{__('Zero Manual Entry', 'codeclove-school-management')}</span>
              </div>
              <p className="text-2xs text-text-muted leading-relaxed">
                {__('No manual bank slip uploads or cashier ledger typing needed.', 'codeclove-school-management')}
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-text flex items-center gap-1.5">
                <RefreshCw size={13} className="text-brand" />
                <span>{__('Automatic Marking', 'codeclove-school-management')}</span>
              </div>
              <p className="text-2xs text-text-muted leading-relaxed">
                {__('Invoices instantly update to Paid when online webhook triggers.', 'codeclove-school-management')}
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-text flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-brand" />
                <span>{__('Instant Receipts', 'codeclove-school-management')}</span>
              </div>
              <p className="text-2xs text-text-muted leading-relaxed">
                {__('Digital PDF payment receipts generated and emailed automatically.', 'codeclove-school-management')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ModalFooter className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-4">
        <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
          {__('Close', 'codeclove-school-management')}
        </Button>
        <Button
          variant="default"
          onClick={handleUpgrade}
          className="w-full sm:w-auto gap-1.5 shadow-xs"
        >
          <Sparkles size={14} />
          <span>{__('Upgrade to CodeClove Pro', 'codeclove-school-management')}</span>
        </Button>
      </ModalFooter>
    </Modal>
  )
}
export default ProGatewayLockModal
