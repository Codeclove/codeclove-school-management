import React from 'react'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import {
  FormField,
  Input,
  Select,
  Alert,
  Badge,
  Spinner,
  Button,
  DatePicker,
} from '@/components/ui'
import type { FullStudent } from '@/api/students'
import type { AcademicUnit } from '@/api/academics'
import type { CertificateTemplate, CertificateFeeSummary } from '@/api/certificates'
import { useFormatter } from '@/lib/formatter'
import { useLabels } from '@/lib/labels'
import { IssuanceFields } from './IssuanceFields'
import { __, sprintf } from '@/lib/i18n'
export interface SingleIssueFormProps {
  templates: CertificateTemplate[]
  selectedTemplateId: number
  onSelectTemplateId: (id: number) => void
  selectedTemplate?: CertificateTemplate
  units: AcademicUnit[]
  filterUnitId: string
  onFilterUnitIdChange: (unitId: string) => void
  students: FullStudent[]
  loadingStudents: boolean
  selectedStudentId: number
  onSelectStudentId: (id: number) => void
  feeSummary?: CertificateFeeSummary
  loadingFeeSummary: boolean
  certificateNo: string
  onCertificateNoChange: (no: string) => void
  onRegenerateCertNo?: () => void
  issueDate: string
  onIssueDateChange: (date: string) => void
  reason: string
  onReasonChange: (reason: string) => void
  conduct: string
  onConductChange: (conduct: string) => void
  duesStatus: string
  onDuesStatusChange: (status: string) => void
  updateStatus: boolean
  onUpdateStatusChange: (update: boolean) => void
}

export const SingleIssueForm: React.FC<SingleIssueFormProps> = ({
  templates,
  selectedTemplateId,
  onSelectTemplateId,
  selectedTemplate,
  units,
  filterUnitId,
  onFilterUnitIdChange,
  students,
  loadingStudents,
  selectedStudentId,
  onSelectStudentId,
  feeSummary,
  loadingFeeSummary,
  certificateNo,
  onCertificateNoChange,
  onRegenerateCertNo,
  issueDate,
  onIssueDateChange,
  reason,
  onReasonChange,
  conduct,
  onConductChange,
  duesStatus,
  onDuesStatusChange,
  updateStatus,
  onUpdateStatusChange,
 }) => {
   const { formatCurrency } = useFormatter()
  const { getLabel } = useLabels()
  const classLabel = getLabel('academic_unit', false, 'Class')
  const classPluralLabel = getLabel('academic_unit', true, 'Classes')
  const studentLabel = getLabel('student', false, 'Student')
  return (
    <div className="bg-bg-elevated border border-border rounded-xl shadow-xs divide-y divide-border/60">
      {/* ─── SECTION 1: Template & Student Recipient ────────────────── */}
      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text uppercase tracking-wider">
            {__('Template & Recipient', 'codeclove-school-management')}
          </span>
          {selectedTemplate && (
            <Badge variant="outline" className="text-3xs uppercase font-mono tracking-wider">
              {selectedTemplate.orientation} • {selectedTemplate.type}
            </Badge>
          )}
        </div>

        <FormField label={__('Certificate Template', 'codeclove-school-management')} required>
          <Select
            value={String(selectedTemplateId)}
            onValueChange={(val) => onSelectTemplateId(Number(val))}
            options={templates.map((tpl) => ({
              value: String(tpl.id),
              label: `${tpl.title} (${tpl.orientation})`,
            }))}
          />
        </FormField>

        {/* Filter by Class & Target Student */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
          <FormField label={sprintf(__('Filter by %s', 'codeclove-school-management'), classLabel)}>
            <Select
              value={filterUnitId}
              onValueChange={(val) => {
                onFilterUnitIdChange(val)
                onSelectStudentId(0)
              }}
              options={[
                { value: '', label: sprintf(__('All %s', 'codeclove-school-management'), classPluralLabel) },
                ...units.map((u) => ({ value: String(u.id), label: u.name })),
              ]}
            />
          </FormField>

          <FormField label={sprintf(__('Target %s', 'codeclove-school-management'), studentLabel)} required>
            <Select
              searchable
              searchPlaceholder={sprintf(__('Search %s name or ID...', 'codeclove-school-management'), studentLabel.toLowerCase())}
              emptyText={
                filterUnitId
                  ? sprintf(__('No %s found in this %s.', 'codeclove-school-management'), studentLabel.toLowerCase(), classLabel.toLowerCase())
                  : sprintf(__('No matching %s found.', 'codeclove-school-management'), studentLabel.toLowerCase())
              }
              value={selectedStudentId > 0 ? String(selectedStudentId) : ''}
              onValueChange={(val) => onSelectStudentId(Number(val))}
              options={students.map((st) => {
                const name = `${st.first_name} ${st.last_name}${st.middle_name ? ` ${st.middle_name}` : ''}`
                const idText = st.admission_number || st.student_number || ''
                const rollNo = st.enrollment?.roll_number
                const description = [idText, rollNo ? `Roll ${rollNo}` : ''].filter(Boolean).join(' • ')

                return {
                  value: String(st.id),
                  label: name,
                  description: description || undefined,
                  keywords: [
                    st.admission_number,
                    st.student_number,
                    st.email,
                    st.phone,
                    rollNo,
                  ].filter(Boolean) as string[],
                }
              })}
              placeholder={
                loadingStudents
                  ? sprintf(__('Loading %s...', 'codeclove-school-management'), studentLabel.toLowerCase())
                  : sprintf(__('Select %s...', 'codeclove-school-management'), studentLabel)
              }
              disabled={loadingStudents}
            />
          </FormField>
        </div>

        {/* Fee Arrears Advisory Banner */}
        {selectedStudentId > 0 && (
          loadingFeeSummary ? (
            <div className="flex items-center gap-2 p-2.5 bg-bg-surface border border-border rounded-lg text-xs text-text-muted">
              <Spinner size="xs" />
              <span>{__('Checking student fee records...', 'codeclove-school-management')}</span>
            </div>
          ) : feeSummary && feeSummary.has_outstanding ? (
            <Alert
              variant="warning"
              title={sprintf(
                __('Fee Advisory: Student has %s pending across %d unpaid invoice(s).', 'codeclove-school-management'),
                formatCurrency(feeSummary.outstanding_minor),
                feeSummary.unpaid_invoices_count
              )}
            >
              <p>
                {__('Administrative override permitted: You may still proceed with issuance if authorized.', 'codeclove-school-management')}
              </p>
            </Alert>
          ) : (
            <div className="flex items-center gap-2 p-2 bg-success-dim border border-success-border rounded-lg text-xs text-success">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>{__('Fee Verification: All school fee invoices are completely cleared.', 'codeclove-school-management')}</span>
            </div>
          )
        )}
      </div>

      {/* ─── SECTION 2: Certificate Details & Numbering ─────────────── */}
      <div className="p-4 sm:p-5 space-y-3.5">
        <span className="text-xs font-bold text-text uppercase tracking-wider block">
          {__('Certificate Details & Numbering', 'codeclove-school-management')}
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label={__('Certificate Serial No.', 'codeclove-school-management')} required>
            <div className="relative">
              <Input
                value={certificateNo}
                onChange={(e) => onCertificateNoChange(e.target.value)}
                className="text-xs font-mono h-8 pr-8"
                placeholder="TC-2026-0042"
              />
              {onRegenerateCertNo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRegenerateCertNo}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-text-muted hover:text-text"
                  title={__('Regenerate serial number', 'codeclove-school-management')}
                >
                  <RefreshCw size={11} />
                </Button>
              )}
            </div>
          </FormField>

          <FormField label={__('Date of Issue', 'codeclove-school-management')} required>
            <DatePicker
              value={issueDate}
              onChange={(val) => onIssueDateChange(val)}
              clearable={false}
              className="text-xs h-8"
              placeholder={__('Select issue date...', 'codeclove-school-management')}
            />
          </FormField>
        </div>

        <IssuanceFields
          templateType={selectedTemplate?.type}
          reason={reason}
          onReasonChange={onReasonChange}
          conduct={conduct}
          onConductChange={onConductChange}
          duesStatus={duesStatus}
          onDuesStatusChange={onDuesStatusChange}
          updateStatus={updateStatus}
          onUpdateStatusChange={onUpdateStatusChange}
        />
      </div>
    </div>
  )
}
