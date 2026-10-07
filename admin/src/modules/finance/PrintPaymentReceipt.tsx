import { useFormatter } from '@/lib/formatter'
import { type Invoice, type Payment } from '@/api/finance'
import { PrintLetterhead, type SchoolSettings } from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'

interface PrintPaymentReceiptProps {
  payment: Payment
  invoice: Invoice
  school?: SchoolSettings
}

const getMethodLabels = (): Record<string, string> => ({
  cash:          __( 'Cash', 'codeclove-school-management' ),
  bank_transfer: __( 'Bank Transfer', 'codeclove-school-management' ),
  cheque:        __( 'Cheque', 'codeclove-school-management' ),
  upi:           __( 'UPI / QR', 'codeclove-school-management' ),
  card:          __( 'Card', 'codeclove-school-management' ),
  other:         __( 'Other', 'codeclove-school-management' ),
})

/**
 * Clean, professional payment receipt slip.
 * Built with high-contrast, print-safe colors, balanced typography,
 * symmetric information hierarchy, and zero boxy clutter.
 */
export default function PrintPaymentReceipt({ payment, invoice, school }: PrintPaymentReceiptProps) {
  const { formatCurrency, formatDate } = useFormatter()
  const methodLabels = getMethodLabels()
  const studentClass =
    [invoice.academic_unit_name, invoice.academic_group_name].filter(Boolean).join(' — ') ||
    (invoice.academic_unit_id ? `Class ${invoice.academic_unit_id}` : null)

  const previouslyPaid = Math.max(0, invoice.paid_minor - payment.amount_minor)

  return (
    <div
      data-print-area
      style={{
        width: '100%',
        maxWidth: '148mm',
        boxSizing: 'border-box',
        margin: '0 auto',
        background: '#fff',
        padding: '0',
        color: '#111827',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '13px',
        lineHeight: 1.5,
      }}
    >
      {/* ─── 1. HEADER / SCHOOL LETTERHEAD ─────────────────────────────── */}
      <PrintLetterhead
        school={school}
        documentType={__( 'Fee Receipt', 'codeclove-school-management' )}
        documentNumber={payment.payment_number}
        showCode={false}
        metaRows={[
          { label: __( 'Date', 'codeclove-school-management' ), value: formatDate(payment.paid_on) },
        ]}
        style={{ paddingBottom: '10px', marginBottom: '12px' }}
      />

      {/* ─── 2. STUDENT + GUARDIAN INFO (CLEAN 2-COLUMN GRID) ──────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '12px',
          paddingBottom: '12px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: '2px' }}>
            {__( 'Student', 'codeclove-school-management' )}
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#111827' }}>
            {invoice.student_first_name} {invoice.student_last_name}
          </div>
          <div style={{ marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '1.5px', fontSize: '0.78rem' }}>
            <div>
              <span style={{ color: '#6b7280' }}>{__( 'Student ID:', 'codeclove-school-management' )} </span>
              <span style={{ fontWeight: 600, color: '#111827', fontFamily: 'monospace' }}>{invoice.student_number || '—'}</span>
            </div>
            {studentClass && (
              <div>
                <span style={{ color: '#6b7280' }}>{__( 'Class / Grade:', 'codeclove-school-management' )} </span>
                <span style={{ fontWeight: 600, color: '#111827' }}>{studentClass}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          {invoice.guardian_name ? (
            <>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: '2px' }}>
                {__( 'Parent / Guardian', 'codeclove-school-management' )}
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#111827' }}>
                {invoice.guardian_name}
              </div>
              {invoice.guardian_email && (
                <div style={{ marginTop: '2px', fontSize: '0.78rem' }}>
                  <span style={{ color: '#6b7280' }}>{__( 'Email:', 'codeclove-school-management' )} </span>
                  <span style={{ color: '#111827' }}>{invoice.guardian_email}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: '2px' }}>
                {__( 'Fee Status', 'codeclove-school-management' )}
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: invoice.balance_minor === 0 ? '#15803d' : '#b91c1c' }}>
                {invoice.balance_minor === 0 ? __( 'Settled in Full', 'codeclove-school-management' ) : __( 'Outstanding Balance Due', 'codeclove-school-management' )}
              </div>
              <div style={{ marginTop: '2px', fontSize: '0.78rem', color: '#6b7280' }}>
                <span>{sprintf( __( 'Receipt Ref: %s', 'codeclove-school-management' ), payment.payment_number )}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── 3. PAYMENT DETAILS ────────────────────────────────────────── */}
      <div style={{ marginBottom: '12px', borderBottom: '1px solid #f3f4f6', paddingBottom: '4px', fontSize: '0.82rem' }}>
        {([
          [__( 'Invoice No.', 'codeclove-school-management' ), invoice.invoice_number],
          [__( 'Payment Method', 'codeclove-school-management' ), methodLabels[payment.method] ?? payment.method],
          ...(payment.reference ? [[__( 'Reference No.', 'codeclove-school-management' ), payment.reference.replace(/^Ref:\s*/i, '')]] : []),
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ color: '#4b5563' }}>{label}</span>
            <span style={{ fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* ─── 4. FINANCIAL SUMMARY ──────────────────────────────────────── */}
      <div style={{ marginBottom: '12px', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
          <span style={{ color: '#4b5563' }}>{__( 'Total Invoice Amount', 'codeclove-school-management' )}</span>
          <span style={{ fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(invoice.total_minor)}
          </span>
        </div>
        {previouslyPaid > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ color: '#4b5563' }}>{__( 'Previously Paid', 'codeclove-school-management' )}</span>
            <span style={{ fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(previouslyPaid)}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb', padding: '6px 0 3px', fontWeight: 700, fontSize: '0.88rem', color: '#111827' }}>
          <span>{__( 'Amount Received Now', 'codeclove-school-management' )}</span>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(payment.amount_minor)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #111827', borderBottom: '1px solid #111827', padding: '5px 0', fontWeight: 700, fontSize: '0.82rem', color: '#111827' }}>
          <span>{__( 'Balance Outstanding', 'codeclove-school-management' )}</span>
          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: invoice.balance_minor > 0 ? '#b91c1c' : '#15803d', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(invoice.balance_minor)}
          </span>
        </div>
      </div>
      {/* Notes */}
      {payment.note && (
        <div style={{ fontSize: '0.72rem', color: '#4b5563', marginBottom: '10px', fontStyle: 'italic' }}>
          Note: {payment.note}
        </div>
      )}

      {/* ─── 5. FOOTER ─────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '10px', marginTop: '14px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '0.7rem', color: '#4b5563', fontWeight: 500 }}>
          {__( 'This is a computer-generated fee receipt. Please retain for your records.', 'codeclove-school-management' )}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: '#6b7280' }}>
          {sprintf( __( 'For queries, contact %s.', 'codeclove-school-management' ), school?.email ?? __( 'the school accounts office', 'codeclove-school-management' ) )}
        </p>
      </div>
    </div>
  )
}
