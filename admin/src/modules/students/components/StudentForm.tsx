import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { studentSchema, type StudentFormValues } from '@/schemas/students'
import {
  useGroupEnrollmentCounts,
  useGuardians,
  type FullStudent,
} from '@/api/students'
import {
  useUnits,
  useGroups,
  useUnitSubjects,
} from '@/api/academics'
import { useSettings, type IdentifierFormat } from '@/api/settings'
import { useSession } from '@/lib/session-context'
import { useLabels } from '@/lib/labels'
import { GENDER_OPTIONS } from '@/lib/constants'
import { __, sprintf } from '@/lib/i18n'
import {
  Button, Card, Spinner, Alert
} from '@/components/ui'
import {
  Form, FormInput, FormSelect, FormDatePicker, AvatarUpload, AddressFields
} from '@/components/ui/form'


interface StudentFormProps {
  mode: 'admit' | 'edit'
  initialData?: FullStudent | null
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

  const form = useForm<StudentFormValues>({
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

  const {
    setValue,
    watch,
    reset,
    formState: { errors },
  } = form

  // Watch fields — guaranteed string values for Radix UI select options matching
  const selectedSubjectIds = watch('subject_ids') || []
  const linkExisting = watch('link_existing_guardian')
  const autoGenerateAdm = watch('auto_generate_admission')
  const activeUnit = watch('academic_unit_id') ? String(watch('academic_unit_id')) : ''
  const activeGroup = watch('academic_group_id') ? String(watch('academic_group_id')) : ''
  const currentGender = watch('gender')

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

  const formatIdPreview = (format: IdentifierFormat | undefined, num: number) => {
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
    <Form form={form} onSubmit={handleFormSubmit} className="space-y-5">
      
      {/* CATEGORIZED CARD 1: Student & Academic Details */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
          <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Student & Academic Details', 'codeclove-school-management' )}</h3>
        </div>

        {/* Photo + Status Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-bg-surface rounded-lg p-3 border border-border">
          <AvatarUpload
            photoUrl={photoUrl}
            onPhotoChange={(id, url) => {
              setValue('photo_id', id, { shouldDirty: true })
              setPhotoUrl(url)
            }}
            disabled={isPending}
            label={sprintf( __( '%s Photo', 'codeclove-school-management' ), studentLabelSingular )}
          />

          {mode === 'edit' && (
            <div className="flex items-center gap-2 ms-auto">
              <span className="text-xs font-semibold text-text">{__( 'Status:', 'codeclove-school-management' )}</span>
              <div className="w-32">
                <FormSelect
                  name="status"
                  disabled={isPending}
                  options={[
                    { value: 'active', label: __( 'Active', 'codeclove-school-management' ) },
                    { value: 'inactive', label: __( 'Inactive', 'codeclove-school-management' ) },
                    { value: 'graduated', label: __( 'Graduated', 'codeclove-school-management' ) },
                    { value: 'withdrawn', label: __( 'Withdrawn', 'codeclove-school-management' ) },
                  ]}
                />
              </div>
            </div>
          )}
        </div>

        {/* Row 1: Student Full Name */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormInput
            name="first_name"
            label={__( 'First Name', 'codeclove-school-management' )}
            placeholder={__( 'e.g. Alice', 'codeclove-school-management' )}
            required
            disabled={isPending}
            inputClassName="h-9"
          />
          <FormInput
            name="middle_name"
            label={__( 'Middle Name', 'codeclove-school-management' )}
            placeholder={__( 'e.g. Marie', 'codeclove-school-management' )}
            disabled={isPending}
            inputClassName="h-9"
          />
          <FormInput
            name="last_name"
            label={__( 'Last Name', 'codeclove-school-management' )}
            placeholder={__( 'e.g. Smith', 'codeclove-school-management' )}
            required
            disabled={isPending}
            inputClassName="h-9"
          />
        </div>

        {/* Row 2: Demographics & Admission Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <FormDatePicker
            name="date_of_birth"
            label={__( 'Date of Birth', 'codeclove-school-management' )}
            required
            disabled={isPending}
          />
          <FormSelect
            name="gender"
            label={__( 'Gender', 'codeclove-school-management' )}
            required
            disabled={isPending}
            options={[
              ...GENDER_OPTIONS.map((opt) => ({ value: opt.value, label: __( opt.label, 'codeclove-school-management' ) })),
              ...(currentGender === 'other' ? [{ value: 'other', label: __( 'Other (Legacy)', 'codeclove-school-management' ) }] : []),
            ]}
          />
          <FormDatePicker
            name="admission_date"
            label={__( 'Admission Date', 'codeclove-school-management' )}
            required
            disabled={isPending}
          />
        </div>

        {/* Row 3: Class & Placement Credentials */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <FormSelect
            name="academic_unit_id"
            label={unitLabelSingular}
            required
            disabled={isPending}
            placeholder={sprintf( __( 'Select %s...', 'codeclove-school-management' ), unitLabelSingular.toLowerCase() )}
            options={units.map((u) => ({ value: String(u.id), label: u.name }))}
            onValueChange={() => {
              setValue('academic_group_id', '', { shouldDirty: true })
            }}
          />

          <div>
            <FormSelect
              name="academic_group_id"
              label={groupLabelSingular}
              disabled={!activeUnit || isPending}
              placeholder={sprintf( __( 'Assign %s...', 'codeclove-school-management' ), groupLabelSingular.toLowerCase() )}
              options={sectionOptions}
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
          </div>

          <FormInput
            name="graduation_year"
            type="number"
            label={__( 'Graduation Year', 'codeclove-school-management' )}
            placeholder={__( 'e.g. 2030', 'codeclove-school-management' )}
            disabled={isPending}
            inputClassName="h-9"
          />
        </div>

        {/* Row 4: Admission Identifier Settings & Preview */}
        <div className="pt-2">
          {mode === 'admit' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-border bg-bg-surface space-y-2">
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
                    <FormInput
                      name="admission_number"
                      label={__( 'Manual Admission ID', 'codeclove-school-management' )}
                      required
                      placeholder={__( 'e.g. ADM-2026-0099', 'codeclove-school-management' )}
                      inputClassName="h-8 font-mono text-xs"
                      disabled={isPending}
                    />
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg border border-border bg-bg-surface space-y-2">
                <p className="text-2xs font-bold text-text-muted uppercase tracking-wider">{__( 'Identifiers Preview', 'codeclove-school-management' )}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-bg-elevated border border-border">
                    <p className="text-text-subtle font-medium text-2xs">{sprintf( __( 'Auto %s #', 'codeclove-school-management' ), studentLabelSingular )}</p>
                    <p className="font-mono text-text font-bold text-xs truncate mt-0.5">
                      {formatIdPreview(settings?.identifiers?.student_number, nextStudentNum)}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-bg-elevated border border-border">
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
            <FormInput
              name="admission_number"
              label={__( 'Admission ID', 'codeclove-school-management' )}
              required
              placeholder={__( 'e.g. ADM-2026-0099', 'codeclove-school-management' )}
              inputClassName="h-9 font-mono tracking-wide"
              className="max-w-md"
              disabled={isPending}
            />
          )}
        </div>
      </Card>

      {/* CATEGORIZED CARD 2: Contact & Address Details */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
          <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Address Details', 'codeclove-school-management' )}</h3>
        </div>

        <AddressFields
          register={form.register}
          errors={form.formState.errors}
          disabled={isPending}
        />
      </Card>

      {/* CATEGORIZED CARD 3: Course Electives & Subjects */}
      <Card className="p-5 space-y-4">
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
                      ? 'border-brand bg-brand-dim text-brand'
                      : 'border-border bg-bg-surface text-text hover:border-brand-ring hover:bg-hover-bg'
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
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
          <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Family & Guardians', 'codeclove-school-management' )}</h3>
        </div>

        <div className="space-y-4">
          {/* Father's Details */}
          <div className="space-y-2.5">
            <h4 className="text-sm font-semibold text-text">{__( "Father's Details (Optional)", 'codeclove-school-management' )}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput
                name="father_first_name"
                label={__( 'First Name', 'codeclove-school-management' )}
                placeholder={__( 'e.g. John', 'codeclove-school-management' )}
                inputClassName="h-8 text-xs"
                disabled={isPending}
              />
              <FormInput
                name="father_last_name"
                label={__( 'Last Name', 'codeclove-school-management' )}
                placeholder={__( 'e.g. Smith', 'codeclove-school-management' )}
                required={!!watch('father_first_name')}
                inputClassName="h-8 text-xs"
                disabled={isPending}
              />
              <FormInput
                name="father_phone"
                label={__( 'Phone Number', 'codeclove-school-management' )}
                placeholder={__( 'e.g. +1 (555) 019-8765', 'codeclove-school-management' )}
                inputClassName="h-8 text-xs"
                disabled={isPending}
              />
              <FormInput
                name="father_email"
                type="email"
                label={__( 'Email Address', 'codeclove-school-management' )}
                placeholder={__( 'e.g. john.smith@gmail.com', 'codeclove-school-management' )}
                inputClassName="h-8 text-xs"
                disabled={isPending}
              />
              <FormInput
                name="father_occupation"
                label={__( 'Occupation', 'codeclove-school-management' )}
                placeholder={__( 'e.g. Software Engineer', 'codeclove-school-management' )}
                className="sm:col-span-2"
                inputClassName="h-8 text-xs"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Mother's Details */}
          <div className="space-y-2.5 pt-2 border-t border-border/40">
            <h4 className="text-sm font-semibold text-text">{__( "Mother's Details (Optional)", 'codeclove-school-management' )}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput
                name="mother_first_name"
                label={__( 'First Name', 'codeclove-school-management' )}
                placeholder={__( 'e.g. Jane', 'codeclove-school-management' )}
                inputClassName="h-8 text-xs"
                disabled={isPending}
              />
              <FormInput
                name="mother_last_name"
                label={__( 'Last Name', 'codeclove-school-management' )}
                placeholder={__( 'e.g. Smith', 'codeclove-school-management' )}
                required={!!watch('mother_first_name')}
                inputClassName="h-8 text-xs"
                disabled={isPending}
              />
              <FormInput
                name="mother_phone"
                label={__( 'Phone Number', 'codeclove-school-management' )}
                placeholder={__( 'e.g. +1 (555) 019-8766', 'codeclove-school-management' )}
                inputClassName="h-8 text-xs"
                disabled={isPending}
              />
              <FormInput
                name="mother_email"
                type="email"
                label={__( 'Email Address', 'codeclove-school-management' )}
                placeholder={__( 'e.g. jane.smith@gmail.com', 'codeclove-school-management' )}
                inputClassName="h-8 text-xs"
                disabled={isPending}
              />
              <FormInput
                name="mother_occupation"
                label={__( 'Occupation', 'codeclove-school-management' )}
                placeholder={__( 'e.g. Pediatrist', 'codeclove-school-management' )}
                className="sm:col-span-2"
                inputClassName="h-8 text-xs"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Legal Guardian Details */}
          <div className="space-y-2.5 pt-2 border-t border-border/40">
            <h4 className="text-sm font-semibold text-text">{sprintf( __( 'Legal %s / Secondary Contact', 'codeclove-school-management' ), guardianLabelSingular )}</h4>
            
            <div className="p-2.5 rounded-lg border border-border bg-bg-surface flex items-center gap-2 select-none cursor-pointer">
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
                <FormSelect
                  name="guardian_id"
                  label={sprintf( __( 'Select %s', 'codeclove-school-management' ), guardianLabelSingular )}
                  required
                  disabled={isPending}
                  placeholder={sprintf( __( 'Search/Select %s...', 'codeclove-school-management' ), guardianLabelSingular )}
                  options={guardians?.map((g) => ({
                    value: String(g.id),
                    label: `${g.first_name} ${g.last_name} (${g.email || __( 'No Email', 'codeclove-school-management' )})`,
                  })) ?? []}
                  onValueChange={handleGuardianChange}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput
                name="guardian_first_name"
                label={sprintf( __( '%s First Name', 'codeclove-school-management' ), guardianLabelSingular )}
                placeholder={__( 'e.g. Robert', 'codeclove-school-management' )}
                disabled={linkExisting || isPending}
                required={!linkExisting && !!watch('guardian_last_name')}
                inputClassName="h-8 text-xs"
              />
              <FormInput
                name="guardian_last_name"
                label={sprintf( __( '%s Last Name', 'codeclove-school-management' ), guardianLabelSingular )}
                placeholder={__( 'e.g. Miller', 'codeclove-school-management' )}
                disabled={linkExisting || isPending}
                required={!linkExisting && !!watch('guardian_first_name')}
                inputClassName="h-8 text-xs"
              />
              <FormInput
                name="guardian_phone"
                label={sprintf( __( '%s Phone', 'codeclove-school-management' ), guardianLabelSingular )}
                placeholder={__( 'e.g. +1 (555) 012-3456', 'codeclove-school-management' )}
                disabled={linkExisting || isPending}
                inputClassName="h-8 text-xs"
              />
              <FormInput
                name="guardian_email"
                type="email"
                label={sprintf( __( '%s Email', 'codeclove-school-management' ), guardianLabelSingular )}
                placeholder={__( 'e.g. robert.miller@gmail.com', 'codeclove-school-management' )}
                disabled={linkExisting || isPending}
                inputClassName="h-8 text-xs"
              />
              <FormSelect
                name="relationship"
                label={sprintf( __( 'Relationship to %s', 'codeclove-school-management' ), studentLabelSingular )}
                disabled={isPending}
                className="sm:col-span-2"
                options={[
                  { value: 'guardian', label: sprintf( __( 'Legal %s', 'codeclove-school-management' ), guardianLabelSingular ) },
                  { value: 'grandparent', label: __( 'Grandparent', 'codeclove-school-management' ) },
                  { value: 'uncle_aunt', label: __( 'Uncle / Aunt', 'codeclove-school-management' ) },
                  { value: 'foster_parent', label: __( 'Foster Parent', 'codeclove-school-management' ) },
                  { value: 'sibling', label: __( 'Sibling', 'codeclove-school-management' ) },
                  { value: 'other', label: __( 'Other Relative', 'codeclove-school-management' ) },
                ]}
              />
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
    </Form>
  )
}
