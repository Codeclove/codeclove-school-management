import { useFormatter } from '@/lib/formatter'
import { type Invoice } from '@/api/finance'
import { PrintLetterhead, type SchoolSettings } from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'
interface PrintInvoiceSheetProps {
  invoice: Invoice
  school?: SchoolSettings
}

/**
 * Clean, uncluttered, professional print-only invoice sheet.
 * High-contrast typography, perfect alignment and symmetry, generous whitespace,
 * and zero boxy clutter.
 */
export default function PrintInvoiceSheet({ invoice, school }: PrintInvoiceSheetProps) {
  const { formatCurrency, formatDate } = useFormatter()
  const isCancelled = invoice.status === 'cancelled' || invoice.status === 'void'

  // Format academic class & section cleanly
  const studentClass = invoice.academic_unit_name
    ? invoice.academic_group_name
      ? `${invoice.academic_unit_name} — ${invoice.academic_group_name}`
      : invoice.academic_unit_name
    : invoice.academic_unit_id
    ? `Class ${invoice.academic_unit_id}`
    : null

  return (
    <div
      data-print-area
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
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
      {/* Cancelled watermark */}
      {isCancelled && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 10,
            opacity: 0.08,
          }}
        >
          <span
            style={{
              color: '#555',
              fontWeight: 900,
              fontSize: '5rem',
              transform: 'rotate(-30deg)',
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              border: '6px solid #555',
              padding: '0.5rem 1.5rem',
            }}
          >
            {invoice.status === 'void' ? __( 'Void', 'codeclove-school-management' ) : __( 'Cancelled', 'codeclove-school-management' )}
          </span>
        </div>
      )}

      {/* ─── 1. HEADER / SCHOOL LETTERHEAD ─────────────────────────────── */}
      <PrintLetterhead
        school={school}
        documentType={__( 'Fee Invoice', 'codeclove-school-management' )}
        documentNumber={invoice.invoice_number}
        metaRows={[
          { label: __( 'Issue Date', 'codeclove-school-management' ), value: formatDate(invoice.issue_date) },
          ...(invoice.due_date ? [{ label: __( 'Due Date', 'codeclove-school-management' ), value: formatDate(invoice.due_date) }] : []),
        ]}
      />

      {/* ─── 2. STUDENT + GUARDIAN INFO (CLEAN 2-COLUMN BALANCED GRID) ──── */}
      <div
        style={{
          paddingBottom: '1.5rem',
          marginBottom: '1.75rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2.5rem',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div>
          <p style={{ margin: '0 0 0.35rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280' }}>
            {__( 'Student Details', 'codeclove-school-management' )}
          </p>
          <p style={{ margin: 0, fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>
            {invoice.student_first_name} {invoice.student_last_name}
          </p>
          <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem' }}>
            <p style={{ margin: 0 }}>
              <span style={{ color: '#6b7280' }}>{__( 'Student ID:', 'codeclove-school-management' )} </span>
              <span style={{ fontWeight: 600, color: '#111827', fontFamily: 'monospace' }}>{invoice.student_number || '—'}</span>
            </p>
            {studentClass && (
              <p style={{ margin: 0 }}>
                <span style={{ color: '#6b7280' }}>{__( 'Class / Grade:', 'codeclove-school-management' )} </span>
                <span style={{ fontWeight: 600, color: '#111827' }}>{studentClass}</span>
              </p>
            )}
          </div>
        </div>

        <div>
          <p style={{ margin: '0 0 0.35rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280' }}>
            {__( 'Parent / Guardian', 'codeclove-school-management' )}
          </p>
          <p style={{ margin: 0, fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>
            {invoice.guardian_name || '—'}
          </p>
          <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem' }}>
            <p style={{ margin: 0 }}>
              <span style={{ color: '#6b7280' }}>{__( 'Email:', 'codeclove-school-management' )} </span>
              <span style={{ color: '#111827' }}>{invoice.guardian_email || '—'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ─── 3. FEE SCHEDULE TABLE WITH UNIFIED TOTALS FOOTER ───────────── */}
      <div style={{ paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280' }}>
          {__( 'Fee Schedule', 'codeclove-school-management' )}
        </p>
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <colgroup>
            <col style={{ width: '48%' }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: '24%' }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', paddingBottom: '0.5rem', fontWeight: 700, color: '#4b5563', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {__( 'Description', 'codeclove-school-management' )}
              </th>
              <th style={{ textAlign: 'right', paddingBottom: '0.5rem', fontWeight: 700, color: '#4b5563', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {__( 'Concession', 'codeclove-school-management' )}
              </th>
              <th style={{ textAlign: 'right', paddingBottom: '0.5rem', fontWeight: 700, color: '#4b5563', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {__( 'Amount', 'codeclove-school-management' )}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.line_items && invoice.line_items.length > 0 ? (
              invoice.line_items.map((li) => (
                <tr key={li.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem 0', fontWeight: 500, color: '#111827' }}>{li.description}</td>
                  <td style={{ padding: '0.75rem 0', textAlign: 'right', color: li.discount_minor > 0 ? '#059669' : '#6b7280', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
                    {li.discount_minor > 0 ? `-${formatCurrency(li.discount_minor)}` : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(li.total_minor || 0)}
                  </td>
                </tr>
              ))
            ) : (
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.75rem 0', fontWeight: 500, color: '#111827' }}>{__( 'Standard Academic Fee', 'codeclove-school-management' )}</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right', color: '#6b7280' }}>—</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(invoice.total_minor || 0)}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            {/* Total Fees */}
            <tr>
              <td style={{ padding: '0.75rem 0 0.35rem' }} />
              <td style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 0 0.35rem', textAlign: 'right', fontSize: '0.85rem', color: '#4b5563' }}>
                {__( 'Total Fees', 'codeclove-school-management' )}
              </td>
              <td style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 0 0.35rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(invoice.subtotal_minor)}
              </td>
            </tr>

            {/* Concession if applicable */}
            {invoice.discount_minor > 0 && (
              <tr>
                <td style={{ padding: '0.35rem 0' }} />
                <td style={{ padding: '0.35rem 0', textAlign: 'right', fontSize: '0.85rem', color: '#059669' }}>
                  {sprintf( __( 'Concession (%s)', 'codeclove-school-management' ), invoice.discount_note || __( 'Waiver', 'codeclove-school-management' ) )}
                </td>
                <td style={{ padding: '0.35rem 0', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                  -{formatCurrency(invoice.discount_minor)}
                </td>
              </tr>
            )}

            {/* Net Payable */}
            <tr>
              <td style={{ padding: '0.5rem 0 0.35rem' }} />
              <td style={{ borderTop: '1px solid #e5e7eb', padding: '0.5rem 0 0.35rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>
                {__( 'Net Payable', 'codeclove-school-management' )}
              </td>
              <td style={{ borderTop: '1px solid #e5e7eb', padding: '0.5rem 0 0.35rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(invoice.total_minor)}
              </td>
            </tr>

            {/* Amount Received */}
            <tr>
              <td style={{ padding: '0.35rem 0' }} />
              <td style={{ padding: '0.35rem 0', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#4b5563' }}>
                {__( 'Amount Received', 'codeclove-school-management' )}
              </td>
              <td style={{ padding: '0.35rem 0', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(invoice.paid_minor)}
              </td>
            </tr>

            {/* Balance Outstanding */}
            <tr>
              <td style={{ padding: '0.6rem 0 0.5rem' }} />
              <td style={{ borderTop: '2px solid #111827', borderBottom: '1px solid #111827', padding: '0.6rem 0 0.5rem', textAlign: 'right', fontSize: '0.95rem', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap' }}>
                {__( 'Balance Outstanding', 'codeclove-school-management' )}
              </td>
              <td style={{ borderTop: '2px solid #111827', borderBottom: '1px solid #111827', padding: '0.6rem 0 0.5rem', textAlign: 'right', fontSize: '0.95rem', fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(invoice.balance_minor)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ─── 4. RECEIPT HISTORY (MATCHING MINIMAL TABLE) ─────────────── */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div style={{ paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280' }}>
            {__( 'Receipt History', 'codeclove-school-management' )}
          </p>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                <th style={{ textAlign: 'left', paddingBottom: '0.4rem', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>{__( 'Receipt No', 'codeclove-school-management' )}</th>
                <th style={{ textAlign: 'left', paddingBottom: '0.4rem', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>{__( 'Date', 'codeclove-school-management' )}</th>
                <th style={{ textAlign: 'left', paddingBottom: '0.4rem', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>{__( 'Method', 'codeclove-school-management' )}</th>
                <th style={{ textAlign: 'left', paddingBottom: '0.4rem', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>{__( 'Reference', 'codeclove-school-management' )}</th>
                <th style={{ textAlign: 'right', paddingBottom: '0.4rem', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>{__( 'Amount', 'codeclove-school-management' )}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.5rem 0', fontFamily: 'monospace', fontWeight: 600, color: '#111827' }}>
                    {p.payment_number}
                  </td>
                  <td style={{ padding: '0.5rem 0', color: '#4b5563' }}>
                    {formatDate(p.paid_on)}
                  </td>
                  <td style={{ padding: '0.5rem 0', textTransform: 'capitalize', color: '#4b5563' }}>
                    {p.method.replace('_', ' ')}
                  </td>
                  <td style={{ padding: '0.5rem 0', color: '#6b7280' }}>
                    {p.reference ? p.reference.replace(/^Ref:\s*/i, '') : '—'}
                  </td>
                  <td
                    style={{
                      padding: '0.5rem 0',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: p.status === 'cancelled' ? '#9ca3af' : '#111827',
                      textDecoration: p.status === 'cancelled' ? 'line-through' : 'none',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCurrency(p.amount_minor)}
                    {p.status === 'cancelled' && (
                      <span style={{ marginLeft: '4px', fontSize: '0.65rem', fontWeight: 400, color: '#991b1b' }}>{__( '(Void)', 'codeclove-school-management' )}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── 5. FOOTER / LEGAL NOTICE (HIGH CONTRAST & CENTERED) ───────── */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem', marginTop: '2.5rem', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '0.72rem', color: '#4b5563', fontWeight: 500 }}>
          {__( 'This is a computer-generated fee invoice and does not require a physical signature.', 'codeclove-school-management' )}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#4b5563' }}>
          {sprintf( __( 'For queries, contact the accounts department at %s.', 'codeclove-school-management' ), school?.email ?? __( 'the school office', 'codeclove-school-management' ) )}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: '0.65rem', color: '#6b7280' }}>
          {__( 'Generated via CodeClove School Management System', 'codeclove-school-management' )}
        </p>
      </div>
    </div>
  )
}
