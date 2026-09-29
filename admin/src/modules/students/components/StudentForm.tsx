import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { studentSchema, type StudentFormValues } from '@/schemas/students'
import { User, X } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useToast } from '@/lib/toast'
import {
  useGroupEnrollmentCounts,
  useGuardians,
} from '@/api/students'
import {
  useUnits,
  useGroups,
  useUnitSubjects,
} from '@/api/academics'
import { useSettings } from '@/api/settings'
import { useSession } from '@/lib/session-context'
import { useLabels } from '@/lib/labels'
import { GENDER_OPTIONS } from '@/lib/constants'
import { __, sprintf } from '@/lib/i18n'
import {
  Button, Card, FormField, Input, Select, Spinner, DatePicker, Alert
} from '@/components/ui'


interface StudentFormProps {
  mode: 'admit' | 'edit'
  initialData?: any
  onSubmit: (data: StudentFormValues) => void
  onCancel: () => void
  isPending?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isPending = false,
}: StudentFormProps) {
  const toast = useToast()
  const { session } = useSession()
  const { data: settings } = useSettings()
  const { data: mockCounts } = useGroupEnrollmentCounts()
  const { data: guardians } = useGuardians()

  const { getLabel } = useLabels()
  const studentLabelSingular = getLabel('student', false, 'Student')
  const unitLabelSingular = getLabel('academic_unit', false, 'Class Level')
  const groupLabelSingular = getLabel('academic_group', false, 'Section')
  const subjectLabelPlural = getLabel('subject', true, 'Subjects')
  const guardianLabelSingular = getLabel('guardian', false, 'Guardian')

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
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      academic_session_id: session ? String(session.id) : '1',
      gender: 'male',
      photo_id: null,
      admission_date: new Date().toISOString().split('T')[0],
      graduation_year: '',
      subject_ids: [],
      auto_generate_admission: mode === 'admit',
      admission_number: '',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      father_first_name: '',
      father_last_name: '',
      father_email: '',
      father_phone: '',
      father_occupation: '',
      mother_first_name: '',
      mother_last_name: '',
      mother_email: '',
      mother_phone: '',
      mother_occupation: '',
      link_existing_guardian: false,
      guardian_id: '',
      guardian_first_name: '',
      guardian_last_name: '',
      guardian_email: '',
      guardian_phone: '',
      relationship: 'guardian',
      status: 'active',
    },
  })

  // Watch fields — guaranteed string values for Radix UI select options matching
  const selectedSubjectIds = watch('subject_ids') || []
  const linkExisting = watch('link_existing_guardian')
  const autoGenerateAdm = watch('auto_generate_admission')
  const activeUnit = watch('academic_unit_id') ? String(watch('academic_unit_id')) : ''
  const activeGroup = watch('academic_group_id') ? String(watch('academic_group_id')) : ''

  // Query academic units & groups cleanly without pagination truncations
  const { data: unitData } = useUnits({ per_page: 200 })
  const { data: groupData } = useGroups({
    unit_id: Number(activeUnit),
    academic_unit_id: Number(activeUnit),
    per_page: 200
  })
  const { data: unitSubjectsData } = useUnitSubjects(Number(activeUnit), { enabled: !!activeUnit })

  const groups = groupData?.data ?? []
  const units = unitData?.data ?? []
  const unitSubjects = unitSubjectsData ?? []

  useEffect(() => {
    if (initialData) {
      const pCode = initialData.postal_code || ''
      const unitIdStr = initialData.enrollment?.academic_unit_id ? String(initialData.enrollment.academic_unit_id) : ''
      const groupIdStr = initialData.enrollment?.academic_group_id ? String(initialData.enrollment.academic_group_id) : ''
      const sessionIdStr = initialData.enrollment?.academic_session_id ? String(initialData.enrollment.academic_session_id) : (session ? String(session.id) : '1')

      reset({
        first_name: initialData.first_name || '',
        middle_name: initialData.middle_name || '',
        last_name: initialData.last_name || '',
        date_of_birth: initialData.date_of_birth || '',
        gender: (initialData.gender ? String(initialData.gender).toLowerCase().trim().replace(/[-\s]+/g, '_') : 'male') as StudentFormValues['gender'],
        academic_session_id: sessionIdStr,
        academic_unit_id: unitIdStr,
        academic_group_id: groupIdStr,
        admission_date: initialData.admission_date || '',
        graduation_year: initialData.graduation_year ? String(initialData.graduation_year) : '',
        subject_ids: initialData.subject_ids || [],
        auto_generate_admission: false,
        admission_number: initialData.admission_number || '',
        address: initialData.address || '',
        city: initialData.city || '',
        state: initialData.state || '',
        postal_code: pCode,
        country: initialData.country || '',
        father_first_name: initialData.father?.first_name || '',
        father_last_name: initialData.father?.last_name || '',
        father_email: initialData.father?.email || '',
        father_phone: initialData.father?.phone || '',
        father_occupation: initialData.father?.occupation || '',
        mother_first_name: initialData.mother?.first_name || '',
        mother_last_name: initialData.mother?.last_name || '',
        mother_email: initialData.mother?.email || '',
        mother_phone: initialData.mother?.phone || '',
        mother_occupation: initialData.mother?.occupation || '',
        link_existing_guardian: !!initialData.guardian,
        guardian_id: initialData.guardian ? String(initialData.guardian.id) : '',
        guardian_first_name: initialData.guardian?.first_name || '',
        guardian_last_name: initialData.guardian?.last_name || '',
        guardian_email: initialData.guardian?.email || '',
        guardian_phone: initialData.guardian?.phone || '',
        relationship: initialData.relationship || 'guardian',
        photo_id: initialData.photo_id || null,
        status: initialData.status || 'active',
      })
      setPhotoUrl(initialData.photo_url || '')
    } else if (session) {
      setValue('academic_session_id', String(session.id))
    }
  }, [initialData, reset, setValue, session, units.length, groups.length])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await api.post<{ id: number; url: string }>('media/upload', formData)
      if (res.success) {
        setValue('photo_id', res.data.id, { shouldDirty: true })
        setPhotoUrl(res.data.url)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSelectPhoto = () => {
    document.getElementById('student-photo-input')?.click()
  }

  const handleRemovePhoto = () => {
    setValue('photo_id', null, { shouldDirty: true })
    setPhotoUrl('')
  }

  const handleSubjectToggle = (id: number) => {
    if (selectedSubjectIds.includes(id)) {
      setValue('subject_ids', selectedSubjectIds.filter((x) => x !== id), { shouldDirty: true })
    } else {
      setValue('subject_ids', [...selectedSubjectIds, id], { shouldDirty: true })
    }
  }

  const handleGuardianChange = (val: string) => {
    setValue('guardian_id', val)
    const g = guardians?.find((x) => String(x.id) === val)
    if (g) {
      setValue('guardian_first_name', g.first_name)
      setValue('guardian_last_name', g.last_name)
      setValue('guardian_email', g.email || '')
      setValue('guardian_phone', g.phone || '')
    }
  }

  const coreOrElectiveSubjects = unitSubjects.filter(
    (s) => s.subject_type === 'core' || s.subject_type === 'elective'
  )

  const selectedGroup = groups.find((g) => String(g.id) === activeGroup)
  const groupMockCount = selectedGroup ? (mockCounts?.[selectedGroup.id] || 0) : 0
  const groupCapacity = selectedGroup?.capacity ?? 30
  const isOverCapacity = selectedGroup && (mode === 'admit' || String(initialData?.enrollment?.academic_group_id) !== activeGroup)
    ? (groupMockCount >= groupCapacity)
    : false

  const year = new Date().getFullYear()
  const nextStudentNum = settings?.identifiers?.student_number?.next_number ?? 1
  const nextAdmissionNum = settings?.identifiers?.admission_number?.next_number ?? 1

  const formatIdPreview = (format: any, num: number) => {
    if (!format) return '—'
    const prefix = format.prefix ?? ''
    const padding = format.sequence_padding ?? 4
    const numStr = String(num).padStart(Number(padding), '0')
    const yearToken = format.year_token ?? ''
    const separator = format.separator ?? ''
    const yearStr = yearToken
      ? yearToken.replace('{YYYY}', String(year)).replace('{YY}', String(year).slice(-2))
      : ''
    const parts = [prefix, yearStr, numStr].filter(Boolean)
    return parts.join(separator)
  }

  const sectionOptions = groups.map((g) => {
    const count = mockCounts?.[g.id] || 0
    const cap = g.capacity ?? 30
    const fullTag = count >= cap ? ` [${__( 'FULL', 'codeclove-school-management' )}]` : ''
    const label = `${g.name} (${count}/${cap})${fullTag}`
    return { value: String(g.id), label }
  })

  const handleFormSubmit = (data: StudentFormValues) => {
    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      
      {/* CATEGORIZED CARD 1: Student & Academic Details */}
      <Card className="overflow-hidden border border-border/60 bg-bg-surface shadow-xs rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
          <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Student & Academic Details', 'codeclove-school-management' )}</h3>
        </div>

        {/* Photo + Status Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-bg-light/30 rounded-lg p-3 border border-border/40">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              id="student-photo-input"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading || isPending}
            />
            {isUploading ? (
              <div className="w-11 h-11 rounded-full border border-border bg-bg-surface flex items-center justify-center flex-shrink-0">
                <Spinner size="sm" />
              </div>
            ) : photoUrl ? (
              <div className="relative group w-11 h-11 rounded-full border border-border overflow-hidden flex items-center justify-center bg-bg-surface flex-shrink-0">
                <img src={photoUrl} alt={sprintf( __( '%s Photo', 'codeclove-school-management' ), studentLabelSingular )} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white rounded-full"
                  disabled={isPending}
                  title={__( 'Remove Photo', 'codeclove-school-management' )}
                  aria-label={__( 'Remove Photo', 'codeclove-school-management' )}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="w-11 h-11 rounded-full border border-dashed border-border bg-bg-surface flex items-center justify-center text-text-subtle flex-shrink-0">
                <User size={16} />
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text">{sprintf( __( '%s Photo', 'codeclove-school-management' ), studentLabelSingular )}</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleSelectPhoto}
                  size="sm"
                  variant="secondary"
                  disabled={isUploading || isPending}
                  className="h-6 text-2xs px-2"
                >
                  {photoUrl ? __( 'Change Photo', 'codeclove-school-management' ) : __( 'Upload Photo', 'codeclove-school-management' )}
                </Button>
                {photoUrl && !isUploading && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-text-muted hover:text-danger text-2xs"
                    disabled={isPending}
                  >
                    {__( 'Remove Photo', 'codeclove-school-management' )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {mode === 'edit' && (
            <div className="flex items-center gap-2 ms-auto">
              <span className="text-xs font-semibold text-text">{__( 'Status:', 'codeclove-school-management' )}</span>
              <div className="w-32">
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : 'active'}
                      onValueChange={field.onChange}
                      disabled={isPending}
                      options={[
                        { value: 'active', label: __( 'Active', 'codeclove-school-management' ) },
                        { value: 'inactive', label: __( 'Inactive', 'codeclove-school-management' ) },
                        { value: 'graduated', label: __( 'Graduated', 'codeclove-school-management' ) },
                        { value: 'withdrawn', label: __( 'Withdrawn', 'codeclove-school-management' ) },
                      ]}
                    />
                  )}
                />
              </div>
            </div>
          )}
        </div>

        {/* Row 1: Student Full Name */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label={__( 'First Name', 'codeclove-school-management' )} error={errors.first_name?.message} required>
            <Input {...register('first_name')} placeholder={__( 'e.g. Alice', 'codeclove-school-management' )} error={!!errors.first_name} className="h-9" disabled={isPending} />
          </FormField>
          <FormField label={__( 'Middle Name', 'codeclove-school-management' )} error={errors.middle_name?.message}>
            <Input {...register('middle_name')} placeholder={__( 'e.g. Marie', 'codeclove-school-management' )} className="h-9" disabled={isPending} />
          </FormField>
          <FormField label={__( 'Last Name', 'codeclove-school-management' )} error={errors.last_name?.message} required>
            <Input {...register('last_name')} placeholder={__( 'e.g. Smith', 'codeclove-school-management' )} error={!!errors.last_name} className="h-9" disabled={isPending} />
          </FormField>
        </div>

        {/* Row 2: Demographics & Admission Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <FormField label={__( 'Date of Birth', 'codeclove-school-management' )} error={errors.date_of_birth?.message} required>
            <Controller
              name="date_of_birth"
              control={control}
              render={({ field }) => (
                <DatePicker
                  value={field.value || ''}
                  onChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
          </FormField>
          <FormField label={__( 'Gender', 'codeclove-school-management' )} error={errors.gender?.message} required>
            <Controller
              name="gender"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || 'male'}
                  onValueChange={field.onChange}
                  disabled={isPending}
                  options={[
                    ...GENDER_OPTIONS.map((opt) => ({ value: opt.value, label: __( opt.label, 'codeclove-school-management' ) })),
                    ...(field.value === 'other' ? [{ value: 'other', label: __( 'Other (Legacy)', 'codeclove-school-management' ) }] : []),
                  ]}
                />
              )}
            />
          </FormField>
          <FormField label={__( 'Admission Date', 'codeclove-school-management' )} error={errors.admission_date?.message} required>
            <Controller
              name="admission_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  value={field.value || ''}
                  onChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
          </FormField>
        </div>

        {/* Row 3: Class & Placement Credentials */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <FormField label={unitLabelSingular} error={errors.academic_unit_id?.message} required>
            <Controller
              name="academic_unit_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={(val) => {
                    field.onChange(val)
                    setValue('academic_group_id', '', { shouldDirty: true })
                  }}
                  disabled={isPending}
                  placeholder={sprintf( __( 'Select %s...', 'codeclove-school-management' ), unitLabelSingular.toLowerCase() )}
                  options={units.map((u) => ({ value: String(u.id), label: u.name }))}
                />
              )}
            />
          </FormField>

          <FormField label={groupLabelSingular}>
            <Controller
              name="academic_group_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={field.onChange}
                  disabled={!activeUnit || isPending}
                  placeholder={sprintf( __( 'Assign %s...', 'codeclove-school-management' ), groupLabelSingular.toLowerCase() )}
                  options={sectionOptions}
                />
              )}
            />
            {isOverCapacity && (
              <Alert variant="warning" title={__( 'Capacity Alert', 'codeclove-school-management' )} className="mt-1.5 py-1 px-2 text-2xs">
                {sprintf(
                  __( 'Selected %1$s is full (%2$d/%3$d). Overriding limit.', 'codeclove-school-management' ),
                  groupLabelSingular.toLowerCase(),
                  groupMockCount,
                  groupCapacity
                )}
              </Alert>
            )}
          </FormField>

          <FormField label={__( 'Graduation Year', 'codeclove-school-management' )} error={errors.graduation_year?.message}>
            <Input type="number" placeholder={__( 'e.g. 2030', 'codeclove-school-management' )} {...register('graduation_year')} error={!!errors.graduation_year} className="h-9" disabled={isPending} />
          </FormField>
        </div>

        {/* Row 4: Admission Identifier Settings & Preview */}
        <div className="pt-2">
          {mode === 'admit' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-border bg-bg-light/20 space-y-2">
                <label className="flex items-start gap-2 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGenerateAdm}
                    onChange={(e) => {
                      setValue('auto_generate_admission', e.target.checked)
                      if (e.target.checked) {
                        setValue('admission_number', '')
                      }
                    }}
                    disabled={isPending}
                    className="rounded border-border text-brand focus:ring-brand w-3.5 h-3.5 mt-0.5"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-text">{__( 'Auto-generate Admission ID', 'codeclove-school-management' )}</span>
                    <span className="text-2xs text-text-muted mt-0.5">{__( 'Sequential ID based on preset templates.', 'codeclove-school-management' )}</span>
                  </div>
                </label>

                {!autoGenerateAdm && (
                  <div className="pt-1">
                    <FormField label={__( 'Manual Admission ID', 'codeclove-school-management' )} error={errors.admission_number?.message} required>
                      <Input
                        {...register('admission_number')}
                        error={!!errors.admission_number}
                        placeholder={__( 'e.g. ADM-2026-0099', 'codeclove-school-management' )}
                        className="h-8 font-mono text-xs"
                        disabled={isPending}
                      />
                    </FormField>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-bg-light/20 space-y-2">
                <p className="text-2xs font-bold text-text-muted uppercase tracking-wider">{__( 'Identifiers Preview', 'codeclove-school-management' )}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-bg-surface border border-border/50">
                    <p className="text-text-subtle font-medium text-2xs">{sprintf( __( 'Auto %s #', 'codeclove-school-management' ), studentLabelSingular )}</p>
                    <p className="font-mono text-text font-bold text-xs truncate mt-0.5">
                      {formatIdPreview(settings?.identifiers?.student_number, nextStudentNum)}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-bg-surface border border-border/50">
                    <p className="text-text-subtle font-medium text-2xs">{__( 'Admission ID', 'codeclove-school-management' )}</p>
                    <p className="font-mono text-text font-bold text-xs truncate mt-0.5">
                      {autoGenerateAdm
                        ? formatIdPreview(settings?.identifiers?.admission_number, nextAdmissionNum)
                        : watch('admission_number') || __( 'Manual Override', 'codeclove-school-management' )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <FormField label={__( 'Admission ID', 'codeclove-school-management' )} error={errors.admission_number?.message} required className="max-w-md">
              <Input
                {...register('admission_number')}
                error={!!errors.admission_number}
                placeholder={__( 'e.g. ADM-2026-0099', 'codeclove-school-management' )}
                className="h-9 font-mono tracking-wide"
                disabled={isPending}
              />
            </FormField>
          )}
        </div>
      </Card>

      {/* CATEGORIZED CARD 2: Contact & Address Details */}
      <Card className="overflow-hidden border border-border/60 bg-bg-surface shadow-xs rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
          <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Address Details', 'codeclove-school-management' )}</h3>
        </div>

        {/* Street Address */}
        <FormField label={__( 'Street Address', 'codeclove-school-management' )} error={errors.address?.message}>
          <Input {...register('address')} placeholder={__( 'e.g. 123 Main St, Apt 4B', 'codeclove-school-management' )} error={!!errors.address} className="h-9" disabled={isPending} />
        </FormField>

        {/* City, State, Postal/ZIP, Country */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <FormField label={__( 'City', 'codeclove-school-management' )} error={errors.city?.message}>
            <Input {...register('city')} placeholder={__( 'e.g. Springfield', 'codeclove-school-management' )} error={!!errors.city} className="h-9" disabled={isPending} />
          </FormField>
          <FormField label={__( 'State / Province', 'codeclove-school-management' )} error={errors.state?.message}>
            <Input {...register('state')} placeholder={__( 'e.g. Illinois', 'codeclove-school-management' )} error={!!errors.state} className="h-9" disabled={isPending} />
          </FormField>
          <FormField label={__( 'ZIP / Postal Code', 'codeclove-school-management' )} error={errors.postal_code?.message}>
            <Input
              {...register('postal_code')}
              placeholder={__( 'e.g. 62701', 'codeclove-school-management' )}
              error={!!errors.postal_code}
              className="h-9"
              disabled={isPending}
            />
          </FormField>
          <FormField label={__( 'Country', 'codeclove-school-management' )} error={errors.country?.message}>
            <Input {...register('country')} placeholder={__( 'e.g. United States', 'codeclove-school-management' )} error={!!errors.country} className="h-9" disabled={isPending} />
          </FormField>
        </div>
      </Card>

      {/* CATEGORIZED CARD 3: Course Electives & Subjects */}
      <Card className="overflow-hidden border border-border/60 bg-bg-surface shadow-xs rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
          <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Course Electives & Subjects', 'codeclove-school-management' )}</h3>
        </div>

        {!activeUnit ? (
          <p className="text-xs text-text-muted italic text-center py-1">{sprintf( __( 'Please select a %1$s to load available %2$s.', 'codeclove-school-management' ), unitLabelSingular.toLowerCase(), subjectLabelPlural.toLowerCase() )}</p>
        ) : coreOrElectiveSubjects.length === 0 ? (
          <p className="text-xs text-text-muted italic text-center py-1">{sprintf( __( 'No active core or elective %1$s mapped to this %2$s.', 'codeclove-school-management' ), subjectLabelPlural.toLowerCase(), unitLabelSingular.toLowerCase() )}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {coreOrElectiveSubjects.map((sub) => {
              const isChecked = selectedSubjectIds.includes(sub.subject_id)
              return (
                <label
                  key={sub.subject_id}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer select-none transition-all ${
                    isChecked
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border bg-bg-light/10 text-text hover:border-border-hover'
                  } ${isPending ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleSubjectToggle(sub.subject_id)}
                    disabled={isPending}
                    className="rounded border-border text-brand focus:ring-brand w-3.5 h-3.5"
                  />
                  <div className="text-xs font-medium leading-tight truncate">
                    <p className="truncate font-semibold">{sub.subject_name}</p>
                    <span className="text-3xs text-text-muted uppercase tracking-wider">{sub.subject_type}</span>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </Card>

      {/* CATEGORIZED CARD 4: Parents & Guardian Contacts */}
      <Card className="overflow-hidden border border-border/60 bg-bg-surface shadow-xs rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
          <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Family & Guardians', 'codeclove-school-management' )}</h3>
        </div>

        <div className="space-y-4">
          {/* Father's Details */}
          <div className="space-y-2.5">
            <h4 className="text-sm font-semibold text-text">{__( "Father's Details (Optional)", 'codeclove-school-management' )}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={__( 'First Name', 'codeclove-school-management' )} error={errors.father_first_name?.message}>
                <Input {...register('father_first_name')} placeholder={__( 'e.g. John', 'codeclove-school-management' )} error={!!errors.father_first_name} className="h-8 text-xs" disabled={isPending} />
              </FormField>
              <FormField label={__( 'Last Name', 'codeclove-school-management' )} error={errors.father_last_name?.message} required={!!watch('father_first_name')}>
                <Input {...register('father_last_name')} placeholder={__( 'e.g. Smith', 'codeclove-school-management' )} error={!!errors.father_last_name} className="h-8 text-xs" disabled={isPending} />
              </FormField>
              <FormField label={__( 'Phone Number', 'codeclove-school-management' )} error={errors.father_phone?.message}>
                <Input {...register('father_phone')} placeholder={__( 'e.g. +1 (555) 019-8765', 'codeclove-school-management' )} error={!!errors.father_phone} className="h-8 text-xs" disabled={isPending} />
              </FormField>
              <FormField label={__( 'Email Address', 'codeclove-school-management' )} error={errors.father_email?.message}>
                <Input type="email" {...register('father_email')} placeholder={__( 'e.g. john.smith@gmail.com', 'codeclove-school-management' )} error={!!errors.father_email} className="h-8 text-xs" disabled={isPending} />
              </FormField>
              <FormField label={__( 'Occupation', 'codeclove-school-management' )} error={errors.father_occupation?.message} className="sm:col-span-2">
                <Input {...register('father_occupation')} placeholder={__( 'e.g. Software Engineer', 'codeclove-school-management' )} error={!!errors.father_occupation} className="h-8 text-xs" disabled={isPending} />
              </FormField>
            </div>
          </div>

          {/* Mother's Details */}
          <div className="space-y-2.5 pt-2 border-t border-border/40">
            <h4 className="text-sm font-semibold text-text">{__( "Mother's Details (Optional)", 'codeclove-school-management' )}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={__( 'First Name', 'codeclove-school-management' )} error={errors.mother_first_name?.message}>
                <Input {...register('mother_first_name')} placeholder={__( 'e.g. Jane', 'codeclove-school-management' )} error={!!errors.mother_first_name} className="h-8 text-xs" disabled={isPending} />
              </FormField>
              <FormField label={__( 'Last Name', 'codeclove-school-management' )} error={errors.mother_last_name?.message} required={!!watch('mother_first_name')}>
                <Input {...register('mother_last_name')} placeholder={__( 'e.g. Smith', 'codeclove-school-management' )} error={!!errors.mother_last_name} className="h-8 text-xs" disabled={isPending} />
              </FormField>
              <FormField label={__( 'Phone Number', 'codeclove-school-management' )} error={errors.mother_phone?.message}>
                <Input {...register('mother_phone')} placeholder={__( 'e.g. +1 (555) 019-8766', 'codeclove-school-management' )} error={!!errors.mother_phone} className="h-8 text-xs" disabled={isPending} />
              </FormField>
              <FormField label={__( 'Email Address', 'codeclove-school-management' )} error={errors.mother_email?.message}>
                <Input type="email" {...register('mother_email')} placeholder={__( 'e.g. jane.smith@gmail.com', 'codeclove-school-management' )} error={!!errors.mother_email} className="h-8 text-xs" disabled={isPending} />
              </FormField>
              <FormField label={__( 'Occupation', 'codeclove-school-management' )} error={errors.mother_occupation?.message} className="sm:col-span-2">
                <Input {...register('mother_occupation')} placeholder={__( 'e.g. Pediatrist', 'codeclove-school-management' )} error={!!errors.mother_occupation} className="h-8 text-xs" disabled={isPending} />
              </FormField>
            </div>
          </div>

          {/* Legal Guardian Details */}
          <div className="space-y-2.5 pt-2 border-t border-border/40">
            <h4 className="text-sm font-semibold text-text">{sprintf( __( 'Legal %s / Secondary Contact', 'codeclove-school-management' ), guardianLabelSingular )}</h4>
            
            <div className="p-2 rounded-lg border border-border bg-bg-light/20 flex items-center gap-2 select-none cursor-pointer">
              <input
                type="checkbox"
                id="link_existing_guardian_admit"
                checked={linkExisting}
                onChange={(e) => setValue('link_existing_guardian', e.target.checked, { shouldDirty: true })}
                disabled={isPending}
                className="rounded border-border text-brand focus:ring-brand w-3.5 h-3.5"
              />
              <label htmlFor="link_existing_guardian_admit" className="flex flex-col cursor-pointer flex-1">
                <span className="text-xs font-semibold text-text leading-tight">
                  {sprintf( __( 'Link to Existing Registered %s', 'codeclove-school-management' ), guardianLabelSingular )}
                </span>
                <span className="text-xs text-text-muted">{__( 'Link siblings or existing registered accounts from database.', 'codeclove-school-management' )}</span>
              </label>
            </div>

            {linkExisting && (
              <div className="animate-fadeIn">
                <FormField label={sprintf( __( 'Select %s', 'codeclove-school-management' ), guardianLabelSingular )} error={errors.guardian_id?.message} required>
                  <Controller
                    name="guardian_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : undefined}
                        onValueChange={handleGuardianChange}
                        disabled={isPending}
                        placeholder={sprintf( __( 'Search/Select %s...', 'codeclove-school-management' ), guardianLabelSingular )}
                        options={guardians?.map((g) => ({
                          value: String(g.id),
                          label: `${g.first_name} ${g.last_name} (${g.email || __( 'No Email', 'codeclove-school-management' )})`,
                        })) ?? []}
                      />
                    )}
                  />
                </FormField>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={sprintf( __( '%s First Name', 'codeclove-school-management' ), guardianLabelSingular )} error={errors.guardian_first_name?.message} required={!linkExisting && !!watch('guardian_last_name')}>
                <Input {...register('guardian_first_name')} placeholder={__( 'e.g. Robert', 'codeclove-school-management' )} disabled={linkExisting || isPending} error={!!errors.guardian_first_name} className="h-8 text-xs" />
              </FormField>
              <FormField label={sprintf( __( '%s Last Name', 'codeclove-school-management' ), guardianLabelSingular )} error={errors.guardian_last_name?.message} required={!linkExisting && !!watch('guardian_first_name')}>
                <Input {...register('guardian_last_name')} placeholder={__( 'e.g. Miller', 'codeclove-school-management' )} disabled={linkExisting || isPending} error={!!errors.guardian_last_name} className="h-8 text-xs" />
              </FormField>
              <FormField label={sprintf( __( '%s Phone', 'codeclove-school-management' ), guardianLabelSingular )} error={errors.guardian_phone?.message}>
                <Input {...register('guardian_phone')} placeholder={__( 'e.g. +1 (555) 012-3456', 'codeclove-school-management' )} disabled={linkExisting || isPending} error={!!errors.guardian_phone} className="h-8 text-xs" />
              </FormField>
              <FormField label={sprintf( __( '%s Email', 'codeclove-school-management' ), guardianLabelSingular )} error={errors.guardian_email?.message}>
                <Input type="email" {...register('guardian_email')} placeholder={__( 'e.g. robert.miller@gmail.com', 'codeclove-school-management' )} disabled={linkExisting || isPending} error={!!errors.guardian_email} className="h-8 text-xs" />
              </FormField>
              <FormField label={sprintf( __( 'Relationship to %s', 'codeclove-school-management' ), studentLabelSingular )} error={errors.relationship?.message} className="sm:col-span-2">
                <Controller
                  name="relationship"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : 'guardian'}
                      onValueChange={field.onChange}
                      disabled={isPending}
                      options={[
                        { value: 'guardian', label: sprintf( __( 'Legal %s', 'codeclove-school-management' ), guardianLabelSingular ) },
                        { value: 'grandparent', label: __( 'Grandparent', 'codeclove-school-management' ) },
                        { value: 'uncle_aunt', label: __( 'Uncle / Aunt', 'codeclove-school-management' ) },
                        { value: 'foster_parent', label: __( 'Foster Parent', 'codeclove-school-management' ) },
                        { value: 'sibling', label: __( 'Sibling', 'codeclove-school-management' ) },
                        { value: 'other', label: __( 'Other Relative', 'codeclove-school-management' ) },
                      ]}
                    />
                  )}
                />
              </FormField>
            </div>
          </div>

          {errors.father_first_name && !watch('father_first_name') && !watch('mother_first_name') && !watch('guardian_first_name') && !watch('guardian_id') && (
            <p className="text-xs text-danger font-medium pt-1">{errors.father_first_name.message}</p>
          )}
        </div>
      </Card>

      {/* Form control actions */}
      <div className="flex justify-end gap-2.5 pt-1">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isPending}
          className="h-9 px-4 text-xs font-medium"
        >
          {__( 'Cancel', 'codeclove-school-management' )}
        </Button>
        <Button type="submit" disabled={isPending} className="h-9 px-5 text-xs font-semibold">
          {isPending ? (
            <>
              <Spinner size="sm" className="text-current me-1.5" />
              {__( 'Saving...', 'codeclove-school-management' )}
            </>
          ) : mode === 'admit' ? (
            __( 'Confirm Admission', 'codeclove-school-management' )
          ) : (
            __( 'Save Changes', 'codeclove-school-management' )
          )}
        </Button>
      </div>
    </form>
  )
}
