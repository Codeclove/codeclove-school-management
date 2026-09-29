/** Tab: Admissions — settings section for admissions forms, notifications, and workflow defaults */

import { useMemo } from 'react'
import { Users, Mail, Sliders } from 'lucide-react'
import type { UseFormRegister, Control } from 'react-hook-form'
import type { CodeCloveSettings } from '@/api/settings'
import {
  FormGroup,
  FormInput,
  FormSelect,
  FormCheckbox,
  StringListEditor,
} from '../components/SettingsFormPrimitives'
import { __ } from '@/lib/i18n'

type Register = UseFormRegister<CodeCloveSettings>

interface AdmissionsTabProps {
  register: Register
  control: Control<CodeCloveSettings>
}

export function AdmissionsTab({ register, control }: AdmissionsTabProps) {
  const admissionStatusOptions = useMemo(() => [
    { value: 'inquiry',             label: __( 'Inquiry', 'codeclove-school-management' ) },
    { value: 'submitted',           label: __( 'Submitted', 'codeclove-school-management' ) },
    { value: 'under_review',        label: __( 'Under Review', 'codeclove-school-management' ) },
    { value: 'more_info_needed',    label: __( 'More Info Needed', 'codeclove-school-management' ) },
    { value: 'interview_scheduled', label: __( 'Interview Scheduled', 'codeclove-school-management' ) },
    { value: 'accepted',            label: __( 'Accepted', 'codeclove-school-management' ) },
    { value: 'waitlisted',          label: __( 'Waitlisted', 'codeclove-school-management' ) },
    { value: 'rejected',            label: __( 'Rejected', 'codeclove-school-management' ) },
    { value: 'admitted',            label: __( 'Admitted', 'codeclove-school-management' ) },
    { value: 'withdrawn',           label: __( 'Withdrawn', 'codeclove-school-management' ) },
  ], [])

  return (
    <div className="space-y-6">
      {/* Forms Activation Status */}
      <FormGroup
        title={__( 'Forms Activation Status', 'codeclove-school-management' )}
        description={__( 'Toggle which public-facing admissions forms are active.', 'codeclove-school-management' )}
        icon={Users}
        cols={1}
      >
        <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormCheckbox
            label={__( 'Enable Public Admission Form', 'codeclove-school-management' )}
            name="admissions.enable_public_form"
            control={control}
            description={__( 'Allow applicants to submit an admission application on the public website.', 'codeclove-school-management' )}
          />
          <FormCheckbox
            label={__( 'Enable Status Lookup', 'codeclove-school-management' )}
            name="admissions.enable_status_lookup"
            control={control}
            description={__( 'Allow applicants to check their application status.', 'codeclove-school-management' )}
          />
          <FormCheckbox
            label={__( 'Auto-Convert Approved Applications', 'codeclove-school-management' )}
            name="admissions.auto_convert"
            control={control}
            description={__( 'Automatically convert accepted applications into enrolled student records.', 'codeclove-school-management' )}
          />
        </div>
      </FormGroup>

      {/* Alert Notifications */}
      <FormGroup
        title={__( 'Alert Notifications', 'codeclove-school-management' )}
        description={__( 'Email addresses that receive admission event alerts.', 'codeclove-school-management' )}
        icon={Mail}
      >
        <FormInput
          label={__( 'Notification Recipients', 'codeclove-school-management' )}
          name="admissions.notification_recipients"
          register={register}
          placeholder={__( 'comma-separated emails', 'codeclove-school-management' )}
          fullWidth
        />
      </FormGroup>

      {/* Workflow Defaults */}
      <FormGroup
        title={__( 'Workflow Defaults', 'codeclove-school-management' )}
        description={__( 'Default statuses applied when records are created.', 'codeclove-school-management' )}
        icon={Sliders}
      >
        <FormSelect
          label={__( 'Default Status', 'codeclove-school-management' )}
          name="admissions.default_status"
          register={register}
          options={admissionStatusOptions}
        />

        <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StringListEditor
            title={__( 'Allowed Statuses', 'codeclove-school-management' )}
            name="admissions.allowed_statuses"
            control={control}
            placeholder={__( 'e.g. pending', 'codeclove-school-management' )}
            emptyText={__( 'No statuses defined.', 'codeclove-school-management' )}
          />
          <StringListEditor
            title={__( 'Verification Fields', 'codeclove-school-management' )}
            name="admissions.verification_fields"
            control={control}
            placeholder={__( 'e.g. national_id', 'codeclove-school-management' )}
            emptyText={__( 'No verification fields defined.', 'codeclove-school-management' )}
          />
        </div>

        <div className="col-span-full">
          <StringListEditor
            title={__( 'Required Documents', 'codeclove-school-management' )}
            name="admissions.required_documents"
            control={control}
            placeholder={__( 'e.g. birth_certificate', 'codeclove-school-management' )}
            emptyText={__( 'No required documents defined.', 'codeclove-school-management' )}
          />
        </div>
      </FormGroup>
    </div>
  )
}
