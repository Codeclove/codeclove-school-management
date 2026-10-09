import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { editAdmissionSchema, type EditAdmissionFormValues } from '@/schemas/students'
import { AlertTriangle, User, X, BookOpen, Users, MapPin } from 'lucide-react'
import { api } from '@/lib/api-client'
import {
  useAdmissionDetails,
  useUpdateAdmission,
} from '@/api/students'
import {
  useSessions,
  useUnits,
} from '@/api/academics'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { GENDER_OPTIONS } from '@/lib/constants'
import {
  Button, FormField, Input, Select, PageHeader, Spinner, EmptyState, FormGroup, DatePicker, Skeleton
} from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'
import { onFormError } from '@/lib/form-errors'

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdmissionEditPage() {
  const { id } = useParams<{ id: string }>()
  const applicationId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { getLabel } = useLabels()
  const admissionLabelSingular = getLabel('admission_application', false, __( 'Admission Application', 'codeclove-school-management' ))
  const admissionLabelPlural = getLabel('admission_application', true, __( 'Admission Applications', 'codeclove-school-management' ))
  const studentLabelPlural = getLabel('student', true, __( 'Students', 'codeclove-school-management' ))
  const unitLabelSingular = getLabel('academic_unit', false, __( 'Class Level', 'codeclove-school-management' ))
  const sessionLabelSingular = getLabel('academic_session', false, __( 'Academic Session', 'codeclove-school-management' ))

  const { data: application, isLoading: isAppLoading, isError } = useAdmissionDetails(applicationId)
  const updateMutation = useUpdateAdmission()
  const { data: sessionData } = useSessions()

  const [photoUrl, setPhotoUrl] = useState<string>('')
  const [isUploading, setIsUploading] = useState<boolean>(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<EditAdmissionFormValues>({
    resolver: zodResolver(editAdmissionSchema),
    defaultValues: {
      student_first_name: '',
      student_middle_name: '',
      student_last_name: '',
      student_date_of_birth: '',
      student_gender: 'male',
      student_photo_id: null,
      academic_session_id: '',
      academic_unit_id: '',
      father_name: '',
      father_phone: '',
      father_email: '',
      father_occupation: '',
      mother_name: '',
      mother_phone: '',
      mother_email: '',
      mother_occupation: '',
      guardian_other_name: '',
      guardian_other_relationship: 'Legal Guardian',
      guardian_other_phone: '',
      guardian_other_email: '',
      primary_communication: 'father',
      street_address: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      previous_school_name: '',
      previous_grade_completed: '',
      blood_group: '',
      nationality: '',
      remarks: '',
    }
  })

  // Watch dropdown values so Select components update reactively
  const genderVal = watch('student_gender')
  const bloodVal = watch('blood_group')
  const sessionVal = watch('academic_session_id')
  const unitVal = watch('academic_unit_id')
  const guardianRelVal = watch('guardian_other_relationship')
  const primaryCommVal = watch('primary_communication')

  const { data: unitData } = useUnits({ per_page: 200 }) // ponytail: fetch all units so pre-selected unit always matches regardless of session filter
  const modalUnits = unitData?.data ?? []
  const sessions = sessionData?.data ?? []

  // Prefill details once application is loaded
  useEffect(() => {
    if (application) {
      let custom: Record<string, string> = {}
      try {
        custom = JSON.parse(application.custom_fields_json || '{}')
      } catch {}

      let address: Record<string, string> = {}
      try {
        address = JSON.parse(application.address_json || '{}')
      } catch {}

      reset({
        student_first_name: application.student_first_name,
        student_middle_name: application.student_middle_name || '',
        student_last_name: application.student_last_name,
        student_date_of_birth: application.student_date_of_birth,
        student_gender: application.student_gender,
        student_photo_id: application.student_photo_id || null,
        academic_session_id: String(application.academic_session_id),
        academic_unit_id: String(application.academic_unit_id),

        father_name: custom.father_name || (!custom.mother_name && application.guardian_name ? application.guardian_name : ''),
        father_phone: custom.father_phone || (!custom.mother_name && application.guardian_phone ? application.guardian_phone : ''),
        father_email: custom.father_email || (!custom.mother_name && application.guardian_email ? application.guardian_email : ''),
        father_occupation: custom.father_occupation || '',

        mother_name: custom.mother_name || '',
        mother_phone: custom.mother_phone || '',
        mother_email: custom.mother_email || '',
        mother_occupation: custom.mother_occupation || '',

        guardian_other_name: custom.guardian_other_name || '',
        guardian_other_relationship: custom.guardian_other_rel || 'Legal Guardian',
        guardian_other_phone: custom.guardian_other_phone || '',
        guardian_other_email: custom.guardian_other_email || '',

        primary_communication: (custom.primary_communication as EditAdmissionFormValues['primary_communication']) || 'father',

        street_address: address.street || address.street_address || address.address || '',
        city: address.city || '',
        state: address.state || '',
        zip: address.postal_code || address.zip_code || address.zip || '',
        country: address.country || '',

        previous_school_name: custom.previous_school_name || '',
        previous_grade_completed: custom.previous_grade_completed || '',
        blood_group: custom.blood_group || '',
        nationality: custom.nationality || '',
        remarks: custom.remarks || '',
      })
      setPhotoUrl(application.student_photo_url || '')
    }
  }, [application, reset])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await api.post<{ id: number; url: string }>('media/upload', formData)
      if (res.success) {
        setValue('student_photo_id', res.data.id, { shouldDirty: true })
        setPhotoUrl(res.data.url)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to upload image', 'codeclove-school-management' )
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSelectPhoto = () => {
    document.getElementById('applicant-photo-input')?.click()
  }

  const handleRemovePhoto = () => {
    setValue('student_photo_id', null, { shouldDirty: true })
    setPhotoUrl('')
  }

  const onSubmit = (data: EditAdmissionFormValues) => {
    // Determine primary guardian details for main DB columns
    let guardianName = ''
    let guardianEmail = ''
    let guardianPhone = ''
    let relationship = __( 'Father', 'codeclove-school-management' )

    if (data.primary_communication === 'mother' && data.mother_name) {
      guardianName = data.mother_name
      guardianEmail = data.mother_email || ''
      guardianPhone = data.mother_phone || ''
      relationship = __( 'Mother', 'codeclove-school-management' )
    } else if (data.primary_communication === 'guardian' && data.guardian_other_name) {
      guardianName = data.guardian_other_name
      guardianEmail = data.guardian_other_email || ''
      guardianPhone = data.guardian_other_phone || ''
      relationship = data.guardian_other_relationship || __( 'Legal Guardian', 'codeclove-school-management' )
    } else if (data.father_name) {
      guardianName = data.father_name
      guardianEmail = data.father_email || ''
      guardianPhone = data.father_phone || ''
      relationship = __( 'Father', 'codeclove-school-management' )
    } else if (data.mother_name) {
      guardianName = data.mother_name
      guardianEmail = data.mother_email || ''
      guardianPhone = data.mother_phone || ''
      relationship = __( 'Mother', 'codeclove-school-management' )
    } else if (data.guardian_other_name) {
      guardianName = data.guardian_other_name
      guardianEmail = data.guardian_other_email || ''
      guardianPhone = data.guardian_other_phone || ''
      relationship = data.guardian_other_relationship || __( 'Legal Guardian', 'codeclove-school-management' )
    } else {
      guardianName = application?.guardian_name || __( 'Guardian', 'codeclove-school-management' )
      guardianEmail = application?.guardian_email || ''
      guardianPhone = application?.guardian_phone || ''
    }

    const addressData = {
      street: data.street_address || '',
      city: data.city || '',
      state: data.state || '',
      zip: data.zip || '',
      country: data.country || '',
    }

    const customData = {
      father_name: data.father_name || '',
      father_phone: data.father_phone || '',
      father_email: data.father_email || '',
      father_occupation: data.father_occupation || '',
      mother_name: data.mother_name || '',
      mother_phone: data.mother_phone || '',
      mother_email: data.mother_email || '',
      mother_occupation: data.mother_occupation || '',
      guardian_other_name: data.guardian_other_name || '',
      guardian_other_phone: data.guardian_other_phone || '',
      guardian_other_email: data.guardian_other_email || '',
      guardian_other_rel: data.guardian_other_relationship || '',
      primary_communication: data.primary_communication || 'father',
      guardian_relationship: relationship,
      previous_school_name: data.previous_school_name || '',
      previous_grade_completed: data.previous_grade_completed || '',
      blood_group: data.blood_group || '',
      nationality: data.nationality || '',
      remarks: data.remarks || '',
    }

    updateMutation.mutate({
      id: applicationId,
      student_first_name: data.student_first_name,
      student_middle_name: data.student_middle_name,
      student_last_name: data.student_last_name,
      student_date_of_birth: data.student_date_of_birth,
      student_gender: data.student_gender,
      academic_session_id: Number(data.academic_session_id),
      academic_unit_id: Number(data.academic_unit_id),
      guardian_name: guardianName,
      guardian_email: guardianEmail,
      guardian_phone: guardianPhone,
      student_photo_id: data.student_photo_id || null,
      address_json: JSON.stringify(addressData),
      custom_fields_json: JSON.stringify(customData),
    }, {
      onSuccess: () => {
        toast.success(sprintf( __( '%s updated successfully!', 'codeclove-school-management' ), admissionLabelSingular ))
        navigate(`/students/admissions/${applicationId}`)
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : '')
        toast.error(message || sprintf( __( 'Failed to update %s', 'codeclove-school-management' ), admissionLabelSingular.toLowerCase() ))
      }
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
        title={sprintf( __( '%s not found', 'codeclove-school-management' ), admissionLabelSingular )}
        description={sprintf( __( 'The %s you are trying to edit does not exist.', 'codeclove-school-management' ), admissionLabelSingular.toLowerCase() )}
        icon={AlertTriangle}
        action={<Button size="sm" onClick={() => navigate('/students/admissions')}>{__( 'Back to Admissions', 'codeclove-school-management' )}</Button>}
      />
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={sprintf( __( 'Edit %s Details', 'codeclove-school-management' ), admissionLabelSingular )}
        description={sprintf( __( 'Update personal, placement, guardian, and address details for %1$s %2$s.', 'codeclove-school-management' ), application.student_first_name, application.student_last_name )}
        onBack={() => navigate(`/students/admissions/${application.id}`)}
        breadcrumbs={[
          { label: studentLabelPlural },
          { label: admissionLabelPlural, href: '/students/admissions' },
          { label: __( 'Application Details', 'codeclove-school-management' ), href: `/students/admissions/${application.id}` },
          { label: __( 'Edit', 'codeclove-school-management' ) }
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit, onFormError)} className="space-y-6">
        {/* Card 1: Student Details */}
        <FormGroup
          title={__( '1. Student Details', 'codeclove-school-management' )}
          description={__( 'Update applicant profile details, gender, birth date, and photo.', 'codeclove-school-management' )}
          icon={User}
          cols={3}
        >
          {/* Applicant Photo Uploader */}
          <div className="col-span-full flex items-center gap-4 border border-border/60 bg-bg-surface/50 rounded-lg p-3">
            <input
              type="file"
              accept="image/*"
              id="applicant-photo-input"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {isUploading ? (
              <div className="w-14 h-14 rounded-full border border-border bg-bg-surface flex items-center justify-center flex-shrink-0">
                <Spinner size="sm" />
              </div>
            ) : photoUrl ? (
              <div className="relative group w-14 h-14 rounded-full border border-border overflow-hidden flex items-center justify-center bg-bg-surface flex-shrink-0">
                <img src={photoUrl} alt="Applicant" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white rounded-full"
                  title={__( 'Remove photo', 'codeclove-school-management' )}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full border border-dashed border-border bg-bg-surface/50 flex items-center justify-center text-text-subtle flex-shrink-0">
                <User size={20} />
              </div>
            )}
            <div className="flex-1 space-y-1 min-w-0">
              <p className="text-xs font-semibold text-text">{__( 'Applicant Photo', 'codeclove-school-management' )}</p>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={handleSelectPhoto} size="sm" variant="secondary" disabled={isUploading} className="h-6 text-2xs px-2">
                  {photoUrl ? __( 'Change Photo', 'codeclove-school-management' ) : __( 'Choose Photo', 'codeclove-school-management' )}
                </Button>
                {photoUrl && !isUploading && (
                  <button type="button" onClick={handleRemovePhoto} className="text-text-muted hover:text-danger font-medium text-2xs">
                    {__( 'Remove', 'codeclove-school-management' )}
                  </button>
                )}
              </div>
            </div>
          </div>

          <FormField label={__( 'First Name', 'codeclove-school-management' )} error={errors.student_first_name?.message} required>
            <Input {...register('student_first_name')} error={Boolean(errors.student_first_name)} />
          </FormField>
          <FormField label={__( 'Middle Name', 'codeclove-school-management' )} error={errors.student_middle_name?.message}>
            <Input {...register('student_middle_name')} />
          </FormField>
          <FormField label={__( 'Last Name', 'codeclove-school-management' )} error={errors.student_last_name?.message} required>
            <Input {...register('student_last_name')} error={Boolean(errors.student_last_name)} />
          </FormField>
          <FormField label={__( 'Date of Birth', 'codeclove-school-management' )} error={errors.student_date_of_birth?.message}>
            <Controller
              name="student_date_of_birth"
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
              onValueChange={(val) => setValue('student_gender', val as EditAdmissionFormValues['student_gender'])}
              options={[
                ...GENDER_OPTIONS,
                ...(genderVal === 'other' ? [{ value: 'other', label: __( 'Other (Legacy)', 'codeclove-school-management' ) }] : []),
              ]}
            />
          </FormField>
          <FormField label={__( 'Blood Group', 'codeclove-school-management' )}>
            <Select
              value={bloodVal || ''}
              onValueChange={(val) => setValue('blood_group', val)}
              placeholder={__( 'Select...', 'codeclove-school-management' )}
              options={[
                { value: '', label: __( 'Select...', 'codeclove-school-management' ) },
                { value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' },
                { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' },
                { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' },
                { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' },
              ]}
            />
          </FormField>
          <FormField label={__( 'Nationality', 'codeclove-school-management' )} className="col-span-full md:col-span-1">
            <Input {...register('nationality')} placeholder={__( 'e.g. Indian, American', 'codeclove-school-management' )} />
          </FormField>
        </FormGroup>

        {/* Card 2: Academic Information */}
        <FormGroup
          title={__( '2. Academic Information', 'codeclove-school-management' )}
          description={sprintf( __( 'Update the %1$s, intended %2$s, and previous schooling details.', 'codeclove-school-management' ), sessionLabelSingular.toLowerCase(), unitLabelSingular.toLowerCase() )}
          icon={BookOpen}
          cols={2}
        >
          <FormField label={sessionLabelSingular} error={errors.academic_session_id?.message} required>
            <Select
              value={sessionVal}
              onValueChange={(val) => {
                setValue('academic_session_id', val)
                setValue('academic_unit_id', '')
              }}
              options={sessions.map((s) => ({ value: String(s.id), label: s.name.replace('Academic Year ', '').replace('Academic Year', '') }))}
            />
          </FormField>
          <FormField label={sprintf( __( 'Intended %s', 'codeclove-school-management' ), unitLabelSingular )} error={errors.academic_unit_id?.message} required>
            <Select
              value={unitVal}
              onValueChange={(val) => setValue('academic_unit_id', val)}
              options={modalUnits.map((u) => ({ value: String(u.id), label: u.name }))}
            />
          </FormField>
          <FormField label={__( 'Previous School Attended', 'codeclove-school-management' )}>
            <Input {...register('previous_school_name')} placeholder={__( 'Previous school name', 'codeclove-school-management' )} />
          </FormField>
          <FormField label={__( 'Last Grade Completed', 'codeclove-school-management' )}>
            <Input {...register('previous_grade_completed')} placeholder={__( 'e.g. Grade 4 / 4th Standard', 'codeclove-school-management' )} />
          </FormField>
        </FormGroup>

        {/* Card 3: Parent & Guardian Details */}
        <FormGroup
          title={__( '3. Parent & Guardian Details', 'codeclove-school-management' )}
          description={__( 'Update contact and profile information for parents and legal guardians.', 'codeclove-school-management' )}
          icon={Users}
          cols={2}
        >
          {/* Father */}
          <div className="col-span-full font-bold text-xs text-text-muted uppercase tracking-wider pt-2 border-b border-border/40 pb-1">
            {__( "Father's Information", 'codeclove-school-management' )}
          </div>
          <FormField label={__( 'Father Full Name', 'codeclove-school-management' )}>
            <Input {...register('father_name')} placeholder={__( 'Father full name', 'codeclove-school-management' )} />
          </FormField>
          <FormField label={__( 'Father Mobile Number', 'codeclove-school-management' )}>
            <Input {...register('father_phone')} placeholder="+1 (555) 000-0000" />
          </FormField>
          <FormField label={__( 'Father Email Address', 'codeclove-school-management' )}>
            <Input type="email" {...register('father_email')} placeholder="father@example.com" />
          </FormField>
          <FormField label={__( 'Father Occupation', 'codeclove-school-management' )}>
            <Input {...register('father_occupation')} placeholder={__( 'Occupation / Business', 'codeclove-school-management' )} />
          </FormField>

          {/* Mother */}
          <div className="col-span-full font-bold text-xs text-text-muted uppercase tracking-wider pt-4 border-b border-border/40 pb-1">
            {__( "Mother's Information", 'codeclove-school-management' )}
          </div>
          <FormField label={__( 'Mother Full Name', 'codeclove-school-management' )}>
            <Input {...register('mother_name')} placeholder={__( 'Mother full name', 'codeclove-school-management' )} />
          </FormField>
          <FormField label={__( 'Mother Mobile Number', 'codeclove-school-management' )}>
            <Input {...register('mother_phone')} placeholder="+1 (555) 000-0000" />
          </FormField>
          <FormField label={__( 'Mother Email Address', 'codeclove-school-management' )}>
            <Input type="email" {...register('mother_email')} placeholder="mother@example.com" />
          </FormField>
          <FormField label={__( 'Mother Occupation', 'codeclove-school-management' )}>
            <Input {...register('mother_occupation')} placeholder={__( 'Occupation / Homemaker', 'codeclove-school-management' )} />
          </FormField>

          {/* Alternate / Guardian */}
          <div className="col-span-full font-bold text-xs text-text-muted uppercase tracking-wider pt-4 border-b border-border/40 pb-1">
            {__( 'Legal Guardian / Alternate Contact (Optional)', 'codeclove-school-management' )}
          </div>
          <FormField label={__( 'Guardian Full Name', 'codeclove-school-management' )}>
            <Input {...register('guardian_other_name')} placeholder={__( 'Guardian full name', 'codeclove-school-management' )} />
          </FormField>
          <FormField label={__( 'Relationship to Student', 'codeclove-school-management' )}>
            <Select
              value={guardianRelVal || 'Legal Guardian'}
              onValueChange={(val) => setValue('guardian_other_relationship', val)}
              options={[
                { value: 'Legal Guardian', label: __( 'Legal Guardian', 'codeclove-school-management' ) },
                { value: 'Grandparent', label: __( 'Grandparent', 'codeclove-school-management' ) },
                { value: 'Uncle/Aunt', label: __( 'Uncle / Aunt', 'codeclove-school-management' ) },
                { value: 'Relative', label: __( 'Relative', 'codeclove-school-management' ) },
                { value: 'Other', label: __( 'Other', 'codeclove-school-management' ) },
              ]}
            />
          </FormField>
          <FormField label={__( 'Guardian Mobile Number', 'codeclove-school-management' )}>
            <Input {...register('guardian_other_phone')} placeholder="+1 (555) 000-0000" />
          </FormField>
          <FormField label={__( 'Guardian Email Address', 'codeclove-school-management' )}>
            <Input type="email" {...register('guardian_other_email')} placeholder="guardian@example.com" />
          </FormField>

          {/* Primary Communication */}
          <div className="col-span-full pt-4">
            <FormField label={__( 'Primary Contact for School Notifications', 'codeclove-school-management' )} required>
              <Select
                value={primaryCommVal || 'father'}
                onValueChange={(val) => setValue('primary_communication', val as EditAdmissionFormValues['primary_communication'])}
                options={[
                  { value: 'father', label: __( 'Father', 'codeclove-school-management' ) },
                  { value: 'mother', label: __( 'Mother', 'codeclove-school-management' ) },
                  { value: 'guardian', label: __( 'Legal Guardian / Alternate Contact', 'codeclove-school-management' ) },
                ]}
              />
            </FormField>
          </div>
        </FormGroup>

        {/* Card 4: Address & Additional Notes */}
        <FormGroup
          title={__( '4. Address & Additional Notes', 'codeclove-school-management' )}
          description={__( 'Update emergency contact address and internal notes.', 'codeclove-school-management' )}
          icon={MapPin}
          cols={2}
        >
          <FormField label={__( 'Street Address', 'codeclove-school-management' )} className="col-span-full">
            <Input {...register('street_address')} placeholder={__( 'House / Building / Street', 'codeclove-school-management' )} />
          </FormField>
          <FormField label={__( 'City', 'codeclove-school-management' )}>
            <Input {...register('city')} placeholder={__( 'City', 'codeclove-school-management' )} />
          </FormField>
          <FormField label={__( 'State / Province', 'codeclove-school-management' )}>
            <Input {...register('state')} placeholder={__( 'State', 'codeclove-school-management' )} />
          </FormField>
          <FormField label={__( 'Postal / Zip Code', 'codeclove-school-management' )}>
            <Input {...register('zip')} placeholder={__( 'ZIP Code', 'codeclove-school-management' )} />
          </FormField>
          <FormField label={__( 'Country', 'codeclove-school-management' )}>
            <Input {...register('country')} placeholder={__( 'Country', 'codeclove-school-management' )} />
          </FormField>
          <FormField label={__( 'Additional Notes / Remarks', 'codeclove-school-management' )} className="col-span-full">
            <textarea
              {...register('remarks')}
              rows={3}
              placeholder={__( 'Any special requirements, inquiries, or notes...', 'codeclove-school-management' )}
              className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-xs text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </FormField>
        </FormGroup>

        <div className="flex justify-end gap-3 pt-3">
          <Button type="button" variant="ghost" onClick={() => navigate(`/students/admissions/${applicationId}`)} disabled={updateMutation.isPending}>
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
