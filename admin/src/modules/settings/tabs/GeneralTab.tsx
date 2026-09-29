/** Tab: General — settings section for institution profile and contact information */

import { Settings as SettingsIcon, Mail } from 'lucide-react'
import type { UseFormRegister, Control, UseFormSetValue } from 'react-hook-form'
import type { CodeCloveSettings } from '@/api/settings'
import { FormGroup, FormInput, FormMediaUpload } from '../components/SettingsFormPrimitives'
import { Textarea } from '@/components/ui'
import { __ } from '@/lib/i18n'

type Register = UseFormRegister<CodeCloveSettings>

interface GeneralTabProps {
  register: Register
  control: Control<CodeCloveSettings>
  setValue: UseFormSetValue<CodeCloveSettings>
}

export function GeneralTab({ register, control, setValue }: GeneralTabProps) {
  return (
    <div className="space-y-6">
      <FormGroup
        title={__( 'Institution Profile', 'codeclove-school-management' )}
        description={__( 'Basic school registration values.', 'codeclove-school-management' )}
        icon={SettingsIcon}
      >
        <FormInput
          label={__( 'School Name', 'codeclove-school-management' )}
          name="school.name"
          register={register}
        />
        <FormInput
          label={__( 'School Code / Registration ID', 'codeclove-school-management' )}
          name="school.code"
          register={register}
          placeholder={__( 'e.g. SCH-1002', 'codeclove-school-management' )}
        />

        {/* WordPress Media Logo Attachment */}
        <FormMediaUpload
          label={__( 'School Logo', 'codeclove-school-management' )}
          name="school.logo"
          control={control}
          setValue={setValue}
          placeholder={__( 'Upload school logo (PNG or JPG recommended)', 'codeclove-school-management' )}
        />

        {/* WordPress Media Signature Attachment */}
        <FormMediaUpload
          label={__( 'Authorized Signature', 'codeclove-school-management' )}
          name="school.signature"
          control={control}
          setValue={setValue}
          placeholder={__( 'Principal / Registrar signature for cards & invoices', 'codeclove-school-management' )}
        />
      </FormGroup>

      <FormGroup
        title={__( 'Contact Information', 'codeclove-school-management' )}
        description={__( 'How candidates and parents reach the school.', 'codeclove-school-management' )}
        icon={Mail}
      >
        <FormInput
          label={__( 'Primary Email Address', 'codeclove-school-management' )}
          name="school.email"
          register={register}
          type="email"
        />
        <FormInput
          label={__( 'Primary Telephone', 'codeclove-school-management' )}
          name="school.phone"
          register={register}
          placeholder={__( 'e.g. +91 99999 99999', 'codeclove-school-management' )}
        />
        <FormInput
          label={__( 'Institution Website', 'codeclove-school-management' )}
          name="school.website"
          register={register}
          type="url"
        />
        <div className="col-span-full space-y-1">
          <label htmlFor="settings-input-school.address" className="text-xs font-semibold text-text-muted">
            {__( 'Postal Address', 'codeclove-school-management' )}
          </label>
          <Textarea id="settings-input-school.address" {...register('school.address')} rows={3} />
        </div>
      </FormGroup>
    </div>
  )
}
