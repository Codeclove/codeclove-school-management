/**
 * Centralized Print System.
 *
 * Single source of truth for printable school documents and the iframe print engine.
 * Shared across the Admin dashboard and the Student & Guardian Portal.
 */

export { printElement } from '@/lib/print'

export {
  PrintLetterhead,
  type PrintLetterheadProps,
  type PrintLetterheadMetaRow,
  type SchoolSettings,
} from '@/components/ui/PrintLetterhead'

export { default as PrintInvoiceSheet } from '@/modules/finance/PrintInvoiceSheet'
export { default as PrintPaymentReceipt } from '@/modules/finance/PrintPaymentReceipt'
export { StudentIdCard, type StudentIdCardProps } from '@/modules/students/components/StudentIdCard'
export { StaffIdCard, type StaffIdCardProps } from '@/modules/staff/components/StaffIdCard'
export { StudentIdCardSection, type StudentIdCardSectionProps } from '@/components/id-card/StudentIdCardSection'
