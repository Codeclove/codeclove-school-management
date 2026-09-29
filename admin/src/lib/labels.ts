import { useSettings, type TerminologyLabels } from '@/api/settings'
import { __ } from '@/lib/i18n'
// ponytail: DEFAULT_LABELS mirrors PHP get_default_labels() by design.
// Labels appear in every table header, form field, and status chip across the app.
// A skeleton flash on every label mount is worse UX than an instant English fallback
// during the initial settings fetch. Remove only when SSR or prefetch is available.
const DEFAULT_LABELS: Record<string, { singular: string; plural: string }> = {
  academic_session:         { singular: 'Academic Session', plural: 'Academic Sessions' },
  academic_term:            { singular: 'Academic Term', plural: 'Academic Terms' },
  academic_unit:            { singular: 'Academic Unit', plural: 'Academic Units' },
  academic_group:           { singular: 'Academic Group', plural: 'Academic Groups' },
  subject:                  { singular: 'Subject', plural: 'Subjects' },
  assessment:               { singular: 'Assessment', plural: 'Assessments' },
  guardian:                 { singular: 'Guardian', plural: 'Guardians' },
  student_guardian:         { singular: 'Student Guardian', plural: 'Student Guardians' },
  admission_application:    { singular: 'Admission Application', plural: 'Admission Applications' },
  admission_status:         { singular: 'Admission Status', plural: 'Admission Statuses' },
  staff_application:        { singular: 'Staff Application', plural: 'Staff Applications' },
  staff_application_status: { singular: 'Staff Application Status', plural: 'Staff Application Statuses' },
  student:                  { singular: 'Student', plural: 'Students' },
  staff_member:             { singular: 'Staff', plural: 'Staff' },
  fee_type:                 { singular: 'Fee Type', plural: 'Fee Types' },
  invoice_line_item:        { singular: 'Invoice Line Item', plural: 'Invoice Line Items' },
  invoice:                  { singular: 'Invoice', plural: 'Invoices' },
  payment:                  { singular: 'Payment', plural: 'Payments' },
  attendance_record:        { singular: 'Attendance Record', plural: 'Attendance Records' },
}

/**
 * Hook to retrieve and resolve dynamic country-aware labels.
 */
export function useLabels() {
  const { data: settings } = useSettings()

  const getLabel = (
    key: keyof TerminologyLabels,
    plural = false,
    defaultValue?: string
  ): string => {
    const group = settings?.labels?.[key] || DEFAULT_LABELS[key]
    return (plural ? group?.plural : group?.singular) ?? defaultValue ?? (plural ? __( 'Items', 'codeclove-school-management' ) : __( 'Item', 'codeclove-school-management' ))
  }
  return {
    getLabel,
    labels: settings?.labels || (DEFAULT_LABELS as unknown as TerminologyLabels),
  }
}
