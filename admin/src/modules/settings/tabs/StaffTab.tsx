/** Tab: Staff — settings section for staff recruitment, account provisioning, and workflow */
import { useMemo } from 'react'
import { Briefcase, Settings as SettingsIcon } from 'lucide-react'
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

interface StaffTabProps {
  register: Register
  control: Control<CodeCloveSettings>
}

export function StaffTab({ register, control }: StaffTabProps) {
  const behaviorOptions = useMemo(() => [
    { value: 'invite',       label: __( 'Email Invite Login Link (Recommended)', 'codeclove-school-management' ) },
    { value: 'immediate',    label: __( 'Create Account Instantly', 'codeclove-school-management' ) },
    { value: 'profile_only', label: __( 'Create Directory Record Only', 'codeclove-school-management' ) },
  ], [])

  const staffStatusOptions = useMemo(() => [
    { value: 'submitted',           label: __( 'Submitted', 'codeclove-school-management' ) },
    { value: 'under_review',        label: __( 'Under Review', 'codeclove-school-management' ) },
    { value: 'more_info_needed',    label: __( 'More Info Needed', 'codeclove-school-management' ) },
    { value: 'interview_scheduled', label: __( 'Interview Scheduled', 'codeclove-school-management' ) },
    { value: 'offer_sent',          label: __( 'Offer Sent', 'codeclove-school-management' ) },
    { value: 'accepted',            label: __( 'Accepted', 'codeclove-school-management' ) },
    { value: 'rejected',            label: __( 'Rejected', 'codeclove-school-management' ) },
    { value: 'hired',               label: __( 'Hired', 'codeclove-school-management' ) },
    { value: 'withdrawn',           label: __( 'Withdrawn', 'codeclove-school-management' ) },
  ], [])

  return (
    <div className="space-y-6">
      <FormGroup
        title={__( 'Recruitment Configuration', 'codeclove-school-management' )}
        description={__( 'Activate and manage employee application settings.', 'codeclove-school-management' )}
        icon={Briefcase}
      >
        <div className="col-span-full space-y-3">
          <FormCheckbox
            label={__( 'Enable Public Staff Applications Form', 'codeclove-school-management' )}
            name="staff_onboarding.enable_form"
            control={control}
            description={__( 'Exposes employee recruitment job application form.', 'codeclove-school-management' )}
          />
          <FormCheckbox
            label={__( 'Enable Application Status Tracker', 'codeclove-school-management' )}
            name="staff_onboarding.enable_status_lookup"
            control={control}
            description={__( 'Enables candidate review tracking by email reference.', 'codeclove-school-management' )}
          />
        </div>
      </FormGroup>

      <FormGroup
        title={__( 'Account Configuration', 'codeclove-school-management' )}
        description={__( 'Default options and role mapping.', 'codeclove-school-management' )}
        icon={SettingsIcon}
      >
        <FormSelect
          label={__( 'Login Creation Flow', 'codeclove-school-management' )}
          name="staff_onboarding.login_creation_behavior"
          register={register}
          options={behaviorOptions}
        />
        <FormInput
          label={__( 'Default Role Assigned on Entry', 'codeclove-school-management' )}
          name="staff_onboarding.default_role"
          register={register}
          placeholder={__( 'e.g. staff', 'codeclove-school-management' )}
        />
        <FormSelect
          label={__( 'Default Application Status', 'codeclove-school-management' )}
          name="staff_onboarding.default_status"
          register={register}
          options={staffStatusOptions}
        />
        <FormInput
          label={__( 'Staff Alert Email Recipients', 'codeclove-school-management' )}
          name="staff_onboarding.notification_recipients"
          register={register}
          placeholder={__( 'comma-separated emails list', 'codeclove-school-management' )}
          fullWidth
        />
      </FormGroup>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <StringListEditor
          control={control}
          name="staff_onboarding.allowed_statuses"
          title={__( 'Allowed Staff Application Statuses', 'codeclove-school-management' )}
          placeholder={__( 'e.g. interview_scheduled', 'codeclove-school-management' )}
          emptyText={__( 'No statuses configured.', 'codeclove-school-management' )}
        />
        <StringListEditor
          control={control}
          name="staff_onboarding.verification_fields"
          title={__( 'Public Lookup Verification Fields', 'codeclove-school-management' )}
          placeholder={__( 'e.g. email', 'codeclove-school-management' )}
          emptyText={__( 'No verification fields configured.', 'codeclove-school-management' )}
        />
      </div>

      <StringListEditor
        control={control}
        name="staff_onboarding.required_documents"
        title={__( 'Mandatory Hiring Documents Required', 'codeclove-school-management' )}
        description={__( 'Documents that candidates must attach to their recruitment forms.', 'codeclove-school-management' )}
        placeholder={__( 'e.g. Previous Employment Offer Letter', 'codeclove-school-management' )}
        emptyText={__( 'No hiring documents required currently.', 'codeclove-school-management' )}
      />
    </div>
  )
}
