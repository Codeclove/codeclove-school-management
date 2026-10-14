import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import {
  User,
  Briefcase,
  Phone,
  Award,
  AlertTriangle,
} from 'lucide-react'
import {
  useStaffApplicationDetails,
  useUpdateStaffApplication,
  type UpdateStaffApplicationPayload,
} from '@/api/staff'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { GENDER_OPTIONS } from '@/lib/constants'
import {
  Button,
  FormField,
  Input,
  Select,
  PageHeader,
  Spinner,
  EmptyState,
  FormGroup,
  DatePicker,
  Skeleton,
  Badge,
} from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'
import { onFormError } from '@/lib/form-errors'

interface FormValues {
  first_name: string
  middle_name: string
  last_name: string
  date_of_birth: string
  gender: string
  desired_role: string
  department: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  postal_code: string
  country: string
  qualification: string
  specialization: string
  experience_years: string
  experience_details: string
  cover_letter: string
  remarks: string
}

export default function StaffApplicationEditPage() {
  const { id } = useParams<{ id: string }>()
  const applicationId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { getLabel } = useLabels()
  const staffLabelPlural = getLabel('staff_member', true, __( 'Staff & HR', 'codeclove-school-management' ))

  const { data: application, isLoading: isAppLoading, isError } = useStaffApplicationDetails(applicationId)
  const updateMutation = useUpdateStaffApplication()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      first_name: '',
      middle_name: '',
      last_name: '',
      date_of_birth: '',
      gender: 'male',
      desired_role: '',
      department: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      qualification: '',
      specialization: '',
      experience_years: '',
      experience_details: '',
      cover_letter: '',
      remarks: '',
    },
  })

  const genderVal = watch('gender')

  useEffect(() => {
    if (!application) return

    let addr: Record<string, any> = {}
    try { addr = JSON.parse(application.address_json || '{}') } catch {}

    let exp: Record<string, any> = {}
    try { exp = JSON.parse(application.experience_json || '{}') } catch {}

    let custom: Record<string, any> = {}
    try { custom = JSON.parse(application.custom_fields_json || '{}') } catch {}

    reset({
      first_name: application.first_name || '',
      middle_name: application.middle_name || '',
      last_name: application.last_name || '',
      date_of_birth: application.date_of_birth || '',
      gender: application.gender || custom.gender || 'male',
      desired_role: application.desired_role || '',
      department: application.department || '',
      email: application.email || '',
      phone: application.phone || '',
      address: addr.address || addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      postal_code: addr.postal_code || addr.zip || '',
      country: addr.country || '',
      qualification: custom.qualification || '',
      specialization: custom.specialization || '',
      experience_years: exp.years || '',
      experience_details: exp.details || '',
      cover_letter: custom.cover_letter || '',
      remarks: custom.remarks || '',
    })
  }, [application, reset])

  const onSubmit = (data: FormValues) => {
    const payload: UpdateStaffApplicationPayload = {
      id: applicationId,
      first_name: data.first_name,
      middle_name: data.middle_name || undefined,
      last_name: data.last_name,
      date_of_birth: data.date_of_birth || undefined,
      gender: data.gender || undefined,
      desired_role: data.desired_role,
      department: data.department || undefined,
      email: data.email,
      phone: data.phone || undefined,
      address: data.address || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      postal_code: data.postal_code || undefined,
      country: data.country || undefined,
      qualification: data.qualification || undefined,
      specialization: data.specialization || undefined,
      experience_years: data.experience_years || undefined,
      experience_details: data.experience_details || undefined,
      cover_letter: data.cover_letter || undefined,
      remarks: data.remarks || undefined,
    }

    updateMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(__( 'Candidate application details updated successfully.', 'codeclove-school-management' ))
        navigate(`/staff/applications/${applicationId}`)
      },
      onError: (err) => {
        toast.error(err.message || __( 'Failed to update application.', 'codeclove-school-management' ))
      },
    })
  }

  if (isAppLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !application) {
    return (
      <EmptyState
        title={__( 'Staff Application Not Found', 'codeclove-school-management' )}
        description={__( 'The application you are trying to edit does not exist or has been removed.', 'codeclove-school-management' )}
        icon={AlertTriangle}
        action={
          <Button size="sm" onClick={() => navigate('/staff/applications')}>
            {__( 'Back to Staff Applications', 'codeclove-school-management' )}
          </Button>
        }
      />
    )
  }

  const fullName = [application.first_name, application.middle_name, application.last_name].filter(Boolean).join(' ')

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={__( 'Edit Staff Application', 'codeclove-school-management' )}
        description={sprintf(
          __( 'Update personal details, applied role, qualifications, and employment history for %s.', 'codeclove-school-management' ),
          fullName
        )}
        onBack={() => navigate(`/staff/applications/${applicationId}`)}
        breadcrumbs={[
          { label: staffLabelPlural },
          { label: __( 'Applications', 'codeclove-school-management' ), href: '/staff/applications' },
          { label: sprintf( __( '%s Details', 'codeclove-school-management' ), fullName ), href: `/staff/applications/${applicationId}` },
          { label: __( 'Edit', 'codeclove-school-management' ) },
        ]}
      />

      {/* Reference & Status Bar */}
      <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-bg-surface text-xs">
        <div className="flex items-center gap-3">
          <span className="text-text-muted">{__( 'Reference Number:', 'codeclove-school-management' )}</span>
          <span className="font-mono font-medium text-text">{application.reference_number}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted">{__( 'Current Status:', 'codeclove-school-management' )}</span>
          <Badge variant="brand" size="sm">
            {application.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onFormError)} className="space-y-6">
        {/* Card 1: Personal Details */}
        <FormGroup
          title={__( '1. Candidate Personal Details', 'codeclove-school-management' )}
          description={__( 'Applicant names, gender demographics, and date of birth.', 'codeclove-school-management' )}
          icon={User}
          cols={3}
        >
          <FormField label={__( 'First Name', 'codeclove-school-management' )} error={errors.first_name?.message} required>
            <Input {...register('first_name', { required: __( 'First name is required.', 'codeclove-school-management' ) })} error={Boolean(errors.first_name)} />
          </FormField>

          <FormField label={__( 'Middle Name', 'codeclove-school-management' )}>
            <Input {...register('middle_name')} />
          </FormField>

          <FormField label={__( 'Last Name', 'codeclove-school-management' )} error={errors.last_name?.message} required>
            <Input {...register('last_name', { required: __( 'Last name is required.', 'codeclove-school-management' ) })} error={Boolean(errors.last_name)} />
          </FormField>

          <FormField label={__( 'Date of Birth', 'codeclove-school-management' )}>
            <Controller
              name="date_of_birth"
              control={control}
              render={({ field }) => (
                <DatePicker
                  value={field.value || ''}
                  onChange={field.onChange}
                  disabled={updateMutation.isPending}
                />
              )}
            />
          </FormField>

          <FormField label={__( 'Gender', 'codeclove-school-management' )}>
            <Select
              value={genderVal || 'male'}
              onValueChange={(val) => setValue('gender', val)}
              options={[...GENDER_OPTIONS]}
            />
          </FormField>
        </FormGroup>

        {/* Card 2: Position & Department */}
        <FormGroup
          title={__( '2. Position & Department', 'codeclove-school-management' )}
          description={__( 'Desired employment role, specialization, and assigned department.', 'codeclove-school-management' )}
          icon={Briefcase}
          cols={2}
        >
          <FormField label={__( 'Desired Role / Position', 'codeclove-school-management' )} error={errors.desired_role?.message} required>
            <Input {...register('desired_role', { required: __( 'Desired role is required.', 'codeclove-school-management' ) })} placeholder={__( 'e.g. Mathematics Teacher', 'codeclove-school-management' )} error={Boolean(errors.desired_role)} />
          </FormField>

          <FormField label={__( 'Department', 'codeclove-school-management' )}>
            <Input {...register('department')} placeholder={__( 'e.g. Science & Mathematics', 'codeclove-school-management' )} />
          </FormField>
        </FormGroup>

        {/* Card 3: Contact & Address */}
        <FormGroup
          title={__( '3. Contact Information & Residential Address', 'codeclove-school-management' )}
          description={__( 'Primary email, telephone number, and residential location.', 'codeclove-school-management' )}
          icon={Phone}
          cols={2}
        >
          <FormField label={__( 'Email Address', 'codeclove-school-management' )} error={errors.email?.message} required>
            <Input type="email" {...register('email', { required: __( 'Email is required.', 'codeclove-school-management' ) })} error={Boolean(errors.email)} />
          </FormField>

          <FormField label={__( 'Mobile Phone', 'codeclove-school-management' )}>
            <Input {...register('phone')} placeholder="+1 (555) 000-0000" />
          </FormField>

          <FormField label={__( 'Street Address', 'codeclove-school-management' )} className="col-span-full">
            <Input {...register('address')} placeholder={__( 'House / Building / Street address', 'codeclove-school-management' )} />
          </FormField>

          <FormField label={__( 'City', 'codeclove-school-management' )}>
            <Input {...register('city')} placeholder={__( 'City', 'codeclove-school-management' )} />
          </FormField>

          <FormField label={__( 'State / Province', 'codeclove-school-management' )}>
            <Input {...register('state')} placeholder={__( 'State / Province', 'codeclove-school-management' )} />
          </FormField>

          <FormField label={__( 'Postal / Zip Code', 'codeclove-school-management' )}>
            <Input {...register('postal_code')} placeholder={__( 'ZIP Code', 'codeclove-school-management' )} />
          </FormField>

          <FormField label={__( 'Country', 'codeclove-school-management' )}>
            <Input {...register('country')} placeholder={__( 'Country', 'codeclove-school-management' )} />
          </FormField>
        </FormGroup>

        {/* Card 4: Qualifications & Experience */}
        <FormGroup
          title={__( '4. Qualifications & Professional Background', 'codeclove-school-management' )}
          description={__( 'Academic degrees, years of relevant experience, past work history, and statement.', 'codeclove-school-management' )}
          icon={Award}
          cols={2}
        >
          <FormField label={__( 'Highest Qualification', 'codeclove-school-management' )}>
            <Input {...register('qualification')} placeholder={__( 'e.g. Master of Science in Mathematics', 'codeclove-school-management' )} />
          </FormField>

          <FormField label={__( 'Total Experience (Years)', 'codeclove-school-management' )}>
            <Input {...register('experience_years')} placeholder={__( 'e.g. 5', 'codeclove-school-management' )} />
          </FormField>

          <FormField label={__( 'Specialization / Field', 'codeclove-school-management' )} className="col-span-full">
            <Input {...register('specialization')} placeholder={__( 'e.g. Pure Mathematics & Statistics', 'codeclove-school-management' )} />
          </FormField>

          <FormField label={__( 'Detailed Work History & Background', 'codeclove-school-management' )} className="col-span-full">
            <textarea
              {...register('experience_details')}
              rows={4}
              placeholder={__( 'Chronological background, previous employers, subjects taught...', 'codeclove-school-management' )}
              className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-xs text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </FormField>

          <FormField label={__( 'Cover Letter / Statement of Purpose', 'codeclove-school-management' )} className="col-span-full">
            <textarea
              {...register('cover_letter')}
              rows={4}
              placeholder={__( 'Applicant cover letter or personal statement...', 'codeclove-school-management' )}
              className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-xs text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </FormField>

          <FormField label={__( 'Internal Notes & Remarks', 'codeclove-school-management' )} className="col-span-full">
            <textarea
              {...register('remarks')}
              rows={3}
              placeholder={__( 'Internal HR remarks or candidate notes...', 'codeclove-school-management' )}
              className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-xs text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </FormField>
        </FormGroup>

        <div className="flex justify-end gap-3 pt-3">
          <Button type="button" variant="ghost" onClick={() => navigate(`/staff/applications/${applicationId}`)} disabled={updateMutation.isPending}>
            {__( 'Cancel', 'codeclove-school-management' )}
          </Button>
          <Button type="submit" disabled={updateMutation.isPending} className="gap-1.5">
            {updateMutation.isPending && <Spinner size="xs" />}
            {__( 'Save Changes', 'codeclove-school-management' )}
          </Button>
        </div>
      </form>
    </div>
  )
}
