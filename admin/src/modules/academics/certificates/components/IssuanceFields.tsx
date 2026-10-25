import React from 'react'
import { FormField, Input, Select, Checkbox } from '@/components/ui'
import type { CertificateTemplate } from '@/api/certificates'
import { __ } from '@/lib/i18n'

export interface IssuanceFieldsProps {
  templateType?: CertificateTemplate['type']
  reason: string
  onReasonChange: (reason: string) => void
  conduct: string
  onConductChange: (conduct: string) => void
  duesStatus: string
  onDuesStatusChange: (status: string) => void
  updateStatus?: boolean
  onUpdateStatusChange?: (update: boolean) => void
}

const CONDUCT_OPTIONS = [
  { value: 'Exemplary', label: __('Exemplary', 'codeclove-school-management') },
  { value: 'Good', label: __('Good', 'codeclove-school-management') },
  { value: 'Satisfactory', label: __('Satisfactory', 'codeclove-school-management') },
]

export const IssuanceFields: React.FC<IssuanceFieldsProps> = ({
  templateType = 'general',
  reason,
  onReasonChange,
  conduct,
  onConductChange,
  duesStatus,
  onDuesStatusChange,
  updateStatus,
  onUpdateStatusChange,
}) => {
  if (templateType === 'transfer') {
    return (
      <div className="space-y-3 pt-1 border-t border-border/40">
        <FormField label={__('Reason for Leaving', 'codeclove-school-management')}>
          <Input
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            className="text-xs h-8"
            placeholder={__('e.g. Parent transfer to another city', 'codeclove-school-management')}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label={__('General Conduct', 'codeclove-school-management')}>
            <Select
              value={conduct}
              onValueChange={onConductChange}
              options={CONDUCT_OPTIONS}
            />
          </FormField>

          <FormField label={__('Dues Clearance Statement', 'codeclove-school-management')}>
            <Input
              value={duesStatus}
              onChange={(e) => onDuesStatusChange(e.target.value)}
              className="text-xs h-8"
              placeholder={__('e.g. All dues cleared', 'codeclove-school-management')}
            />
          </FormField>
        </div>

        {onUpdateStatusChange && (
          <div className="p-3 bg-bg-surface border border-border rounded-lg">
            <Checkbox
              id="cert-update-status"
              checked={Boolean(updateStatus)}
              onChange={(e) => onUpdateStatusChange(e.target.checked)}
              label={__('Mark Student as Withdrawn upon Issuance', 'codeclove-school-management')}
              labelClassName="text-xs font-semibold text-text"
              description={__('Automatically completes active enrollment and marks student as withdrawn.', 'codeclove-school-management')}
            />
          </div>
        )}
      </div>
    )
  }

  if (templateType === 'merit') {
    return (
      <div className="pt-1 border-t border-border/40">
        <FormField label={__('Award Remarks', 'codeclove-school-management')}>
          <Input
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            className="text-xs h-8"
            placeholder={__('e.g. In recognition of outstanding academic performance and exemplary conduct', 'codeclove-school-management')}
          />
        </FormField>
      </div>
    )
  }

  if (templateType === 'character') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
        <FormField label={__('General Conduct', 'codeclove-school-management')}>
          <Select
            value={conduct}
            onValueChange={onConductChange}
            options={CONDUCT_OPTIONS}
          />
        </FormField>
        <FormField label={__('Character Remarks', 'codeclove-school-management')}>
          <Input
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            className="text-xs h-8"
            placeholder={__('e.g. Exhibited exemplary moral conduct and discipline', 'codeclove-school-management')}
          />
        </FormField>
      </div>
    )
  }

  return (
    <div className="pt-1 border-t border-border/40">
      <FormField label={__('Remarks / Notes', 'codeclove-school-management')}>
        <Input
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          className="text-xs h-8"
          placeholder={__('e.g. Issued on student request', 'codeclove-school-management')}
        />
      </FormField>
    </div>
  )
}
