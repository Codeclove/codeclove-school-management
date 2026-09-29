import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { staffSchema, type StaffFormValues } from '@/schemas/staff'
import { User, FileText, X, Globe, GraduationCap, PhoneCall } from 'lucide-react'
import { useRoles } from '@/api/roles'
import type { Staff } from '@/api/staff'
import { useSettings } from '@/api/settings'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { GENDER_OPTIONS } from '@/lib/constants'
import {
  Button, Card, FormField, Input, Select, Spinner, DatePicker
} from '@/components/ui'
import { api } from '@/lib/api-client'
import { __, sprintf } from '@/lib/i18n'

interface StaffDoc {
  label: string
  attachment_id: number
  url: string
}

interface StaffFormProps {
  mode: 'add' | 'edit'
  initialData?: Staff | null
  onSubmit: (data: StaffFormValues & { documents: StaffDoc[] }) => void
  onCancel: () => void
  isPending?: boolean
}

const TITLE_OPTIONS = [
  { value: '', label: __( 'None / Select', 'codeclove-school-management' ) },
  { value: 'Mr.', label: __( 'Mr.', 'codeclove-school-management' ) },
  { value: 'Ms.', label: __( 'Ms.', 'codeclove-school-management' ) },
  { value: 'Mrs.', label: __( 'Mrs.', 'codeclove-school-management' ) },
  { value: 'Dr.', label: __( 'Dr.', 'codeclove-school-management' ) },
  { value: 'Prof.', label: __( 'Prof.', 'codeclove-school-management' ) },
]

const STAFF_CATEGORY_OPTIONS = [
  { value: '', label: __( 'Select Category', 'codeclove-school-management' ) },
  { value: 'teaching', label: __( 'Teaching / Academic Faculty', 'codeclove-school-management' ) },
  { value: 'administrative', label: __( 'Administrative / Office Staff', 'codeclove-school-management' ) },
  { value: 'leadership', label: __( 'Leadership / Management', 'codeclove-school-management' ) },
  { value: 'support', label: __( 'Support / Auxiliary Staff', 'codeclove-school-management' ) },
]

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: '', label: __( 'Select Employment Model', 'codeclove-school-management' ) },
  { value: 'full_time', label: __( 'Full-Time Permanent', 'codeclove-school-management' ) },
  { value: 'part_time', label: __( 'Part-Time', 'codeclove-school-management' ) },
  { value: 'contract', label: __( 'Contract / Fixed-Term', 'codeclove-school-management' ) },
  { value: 'substitute', label: __( 'Substitute / Supply', 'codeclove-school-management' ) },
]

interface PresetField {
  name: string
  label: string
  type?: 'text' | 'date' | 'select'
  placeholder?: string
  maxLength?: number
  options?: { value: string; label: string }[]
}

const PRESET_CONFIGS: Record<string, { desc: string; fields: PresetField[] }> = {
  US: {
    desc: __( 'Statutory fields aligned with state licensing and Common Education Data Standards (CEDS).', 'codeclove-school-management' ),
    fields: [
      { name: 'state_educator_id', label: __( 'State Educator ID', 'codeclove-school-management' ), placeholder: 'e.g. ED-982142' },
      { name: 'license_number', label: __( 'State License / Credential #', 'codeclove-school-management' ), placeholder: 'e.g. LIC-48210' },
      { name: 'license_expiry', label: __( 'Credential Expiration Date', 'codeclove-school-management' ), type: 'date' },
      { name: 'fte', label: __( 'Full-Time Equivalency (FTE)', 'codeclove-school-management' ), placeholder: 'e.g. 1.0 (Full) or 0.5 (Half)' },
      {
        name: 'contract_term',
        label: __( 'Contract Term', 'codeclove-school-management' ),
        type: 'select',
        options: [
          { value: '10_month', label: __( '10-Month Standard', 'codeclove-school-management' ) },
          { value: '11_month', label: __( '11-Month', 'codeclove-school-management' ) },
          { value: '12_month', label: __( '12-Month Year-Round', 'codeclove-school-management' ) },
          { value: 'hourly', label: __( 'Hourly / Per-Diem', 'codeclove-school-management' ) },
        ],
      },
      { name: 'ssn_last4', label: __( 'SSN (Last 4 Digits)', 'codeclove-school-management' ), placeholder: 'e.g. 4821', maxLength: 4 },
    ],
  },
  GB: {
    desc: __( 'Statutory verification compliant with DfE School Workforce Census & Single Central Record (KCSIE).', 'codeclove-school-management' ),
    fields: [
      { name: 'trn', label: __( 'Teacher Reference Number (TRN)', 'codeclove-school-management' ), placeholder: 'e.g. 1234567' },
      {
        name: 'qts_status',
        label: __( 'QTS / QTLS Status', 'codeclove-school-management' ),
        type: 'select',
        options: [
          { value: 'qualified', label: __( 'Qualified Teacher Status (QTS)', 'codeclove-school-management' ) },
          { value: 'ect', label: __( 'Early Career Teacher (ECT)', 'codeclove-school-management' ) },
          { value: 'unqualified', label: __( 'Unqualified Teacher', 'codeclove-school-management' ) },
          { value: 'not_applicable', label: __( 'Not Applicable (Support Staff)', 'codeclove-school-management' ) },
        ],
      },
      { name: 'ni_number', label: __( 'National Insurance (NI) Number', 'codeclove-school-management' ), placeholder: 'e.g. QQ 12 34 56 A' },
      { name: 'dbs_number', label: __( 'Enhanced DBS Certificate #', 'codeclove-school-management' ), placeholder: 'e.g. 001234567890' },
      { name: 'dbs_check_date', label: __( 'DBS Check Date', 'codeclove-school-management' ), type: 'date' },
      { name: 'barred_list_check_date', label: __( 'Barred List Check Date', 'codeclove-school-management' ), type: 'date' },
      { name: 'prohibition_check_date', label: __( 'Prohibition from Teaching Check Date', 'codeclove-school-management' ), type: 'date' },
      {
        name: 'right_to_work_verified',
        label: __( 'Right to Work in the UK', 'codeclove-school-management' ),
        type: 'select',
        options: [
          { value: 'verified_uk_citizen', label: __( 'British Citizen / Passport Verified', 'codeclove-school-management' ) },
          { value: 'settled_status', label: __( 'EU Settled / Pre-Settled Status', 'codeclove-school-management' ) },
          { value: 'visa_sponsored', label: __( 'Skilled Worker / Visa Sponsored', 'codeclove-school-management' ) },
          { value: 'pending', label: __( 'Pending Verification', 'codeclove-school-management' ) },
        ],
      },
    ],
  },
  IN: {
    desc: __( 'Statutory verification compliant with Ministry of Education UDISE+ Teacher Module and CBSE norms.', 'codeclove-school-management' ),
    fields: [
      { name: 'ntc', label: __( 'National Teacher Code (NTC)', 'codeclove-school-management' ), placeholder: 'e.g. TC-9218401' },
      { name: 'aadhaar_number', label: __( 'Aadhaar Number (or Last 4 Digits)', 'codeclove-school-management' ), placeholder: 'e.g. XXXX-XXXX-4819', maxLength: 16 },
      { name: 'pan_number', label: __( 'PAN Number (Tax ID)', 'codeclove-school-management' ), placeholder: 'e.g. ABCDE1234F', maxLength: 10 },
      {
        name: 'social_category',
        label: __( 'Social Category (UDISE+)', 'codeclove-school-management' ),
        type: 'select',
        options: [
          { value: 'general', label: __( 'General', 'codeclove-school-management' ) },
          { value: 'obc', label: __( 'OBC (Other Backward Class)', 'codeclove-school-management' ) },
          { value: 'sc', label: __( 'SC (Scheduled Caste)', 'codeclove-school-management' ) },
          { value: 'st', label: __( 'ST (Scheduled Tribe)', 'codeclove-school-management' ) },
        ],
      },
      {
        name: 'teacher_cadre',
        label: __( 'Teacher Cadre / Teaching Level', 'codeclove-school-management' ),
        type: 'select',
        options: [
          { value: 'prt', label: __( 'PRT (Primary Teacher: Grades 1-5)', 'codeclove-school-management' ) },
          { value: 'tgt', label: __( 'TGT (Trained Graduate Teacher: Grades 6-10)', 'codeclove-school-management' ) },
          { value: 'pgt', label: __( 'PGT (Post Graduate Teacher: Grades 11-12)', 'codeclove-school-management' ) },
          { value: 'other', label: __( 'Special Educator / Non-Teaching', 'codeclove-school-management' ) },
        ],
      },
      {
        name: 'professional_qualification',
        label: __( 'Professional Teaching Degree', 'codeclove-school-management' ),
        type: 'select',
        options: [
          { value: 'b_ed', label: __( 'B.Ed (Bachelor of Education)', 'codeclove-school-management' ) },
          { value: 'd_el_ed', label: __( 'D.El.Ed / BTC', 'codeclove-school-management' ) },
          { value: 'm_ed', label: __( 'M.Ed (Master of Education)', 'codeclove-school-management' ) },
          { value: 'b_el_ed', label: __( 'B.El.Ed (4-Year Integrated)', 'codeclove-school-management' ) },
          { value: 'none', label: __( 'None / Other', 'codeclove-school-management' ) },
        ],
      },
    ],
  },
}

export default function StaffForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isPending = false,
}: StaffFormProps) {
  const toast = useToast()
  const { data: roles = [] } = useRoles()
  const { data: settings } = useSettings()
  const { getLabel } = useLabels()
  const staffLabelSingular = getLabel('staff_member', false, __( 'Staff Member', 'codeclove-school-management' ))

  const activePreset = settings?.education_system?.preset || 'US'
  const activePresetName = settings?.education_system?.preset_name || (
    activePreset === 'GB' ? __( 'United Kingdom', 'codeclove-school-management' ) : activePreset === 'IN' ? __( 'India', 'codeclove-school-management' ) : __( 'United States', 'codeclove-school-management' )
  )

  // Local state for photo and documents list
  const [photoUrl, setPhotoUrl] = useState<string>('')
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false)
  const [documents, setDocuments] = useState<StaffDoc[]>([])
  const [docLabel, setDocLabel] = useState<string>('')
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false)

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      staff_number: '',
      title: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      preferred_name: '',
      date_of_birth: '',
      gender: undefined,
      email: '',
      phone: '',
      department: '',
      designation: '',
      staff_category: '',
      employment_type: '',
      joined_on: new Date().toISOString().split('T')[0],
      status: 'active',
      photo_id: null,
      role_id: '',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      emergency_contact_name: '',
      emergency_contact_relationship: '',
      emergency_contact_phone: '',
      highest_qualification: '',
      specialization: '',
      metadata: {},
      user_id: null,
      create_user: false,
      username: '',
      password: '',
    },
  })

  const createUserChecked = watch('create_user')

  // Load details into form when initialData changes
  useEffect(() => {
    if (initialData) {
      reset({
        staff_number: initialData.staff_number || '',
        title: initialData.title || '',
        first_name: initialData.first_name || '',
        middle_name: initialData.middle_name || '',
        last_name: initialData.last_name || '',
        preferred_name: initialData.preferred_name || '',
        date_of_birth: initialData.date_of_birth || '',
        gender: (initialData.gender || undefined) as StaffFormValues['gender'],
        email: initialData.email || '',
        phone: initialData.phone || '',
        department: initialData.department || '',
        designation: initialData.designation || '',
        staff_category: initialData.staff_category || '',
        employment_type: initialData.employment_type || '',
        joined_on: initialData.joined_on || '',
        status: initialData.status || 'active',
        photo_id: initialData.photo_id || null,
        role_id: initialData.role_id ? String(initialData.role_id) : '',
        address: initialData.address || '',
        city: initialData.city || '',
        state: initialData.state || '',
        postal_code: initialData.postal_code || '',
        country: initialData.country || '',
        emergency_contact_name: initialData.emergency_contact_name || '',
        emergency_contact_relationship: initialData.emergency_contact_relationship || '',
        emergency_contact_phone: initialData.emergency_contact_phone || '',
        highest_qualification: initialData.highest_qualification || '',
        specialization: initialData.specialization || '',
        metadata: initialData.metadata || {},
        user_id: initialData.user_id || null,
        create_user: false,
        username: initialData.username || '',
        password: '',
      })
      if (initialData.photo_url && !initialData.photo_url.endsWith('avatar.svg')) {
        setPhotoUrl(initialData.photo_url)
      } else {
        setPhotoUrl('')
      }
      if (initialData.documents) {
        setDocuments(initialData.documents)
      }
    }
  }, [initialData, reset, roles.length])

  // Profile photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post<{ id: number; url: string }>('media/upload', formData)
      if (res.success) {
        setValue('photo_id', res.data.id, { shouldDirty: true })
        setPhotoUrl(res.data.url)
        toast.success(__( 'Profile photo uploaded successfully!', 'codeclove-school-management' ))
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : __( 'Failed to upload image', 'codeclove-school-management' ))
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Document upload handler
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingDoc(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post<{ id: number; url: string }>('media/upload', formData)
      if (res.success) {
        const newDoc: StaffDoc = {
          label: docLabel.trim() || file.name || __( 'Document', 'codeclove-school-management' ),
          attachment_id: res.data.id,
          url: res.data.url,
        }
        setDocuments((prev) => [...prev, newDoc])
        setDocLabel('')
        toast.success(__( 'Document uploaded successfully!', 'codeclove-school-management' ))
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : __( 'Failed to upload document', 'codeclove-school-management' ))
    } finally {
      setIsUploadingDoc(false)
    }
  }

  const onFormSubmit = (values: StaffFormValues) => {
    onSubmit({
      ...values,
      documents,
    })
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* ─── CARD 1: Identity & Demographics ──────────────────────────────── */}
      <Card className="overflow-hidden border border-border/60 bg-bg-surface shadow-xs rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
          <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Identity & Demographics', 'codeclove-school-management' )}</h3>
        </div>

        {/* Profile Photo Uploader */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-bg-light/30 rounded-lg p-3 border border-border/40">
          <div className="flex items-center gap-3">
            <input
              type="file"
              id="staff-photo-input"
              className="hidden"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={isUploadingPhoto || isPending}
            />
            {isUploadingPhoto ? (
              <div className="w-11 h-11 rounded-full border border-border bg-bg-surface flex items-center justify-center flex-shrink-0">
                <Spinner size="sm" />
              </div>
            ) : photoUrl ? (
              <div className="relative group w-11 h-11 rounded-full border border-border overflow-hidden flex items-center justify-center bg-bg-surface flex-shrink-0">
                <img src={photoUrl} alt={staffLabelSingular} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setValue('photo_id', null, { shouldDirty: true })
                    setPhotoUrl('')
                  }}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white rounded-full"
                  title={__( 'Remove photo', 'codeclove-school-management' )}
                  disabled={isPending}
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
              <p className="text-xs font-semibold text-text">{sprintf( __( '%s Photo', 'codeclove-school-management' ), staffLabelSingular )}</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => document.getElementById('staff-photo-input')?.click()}
                  size="sm"
                  variant="secondary"
                  disabled={isUploadingPhoto || isPending}
                  className="h-6 text-2xs px-2"
                >
                  {photoUrl ? __( 'Change Photo', 'codeclove-school-management' ) : __( 'Choose Photo', 'codeclove-school-management' )}
                </Button>
                {photoUrl && !isUploadingPhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      setValue('photo_id', null, { shouldDirty: true })
                      setPhotoUrl('')
                    }}
                    className="text-text-muted hover:text-danger text-2xs"
                    disabled={isPending}
                  >
                    {__( 'Remove', 'codeclove-school-management' )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Staff ID Number */}
          <div className="w-full sm:w-auto min-w-[200px]">
            <FormField label={__( 'Staff ID / Employee Code', 'codeclove-school-management' )}>
              <Input
                {...register('staff_number')}
                placeholder={mode === 'add' ? __( 'Auto-generated if blank', 'codeclove-school-management' ) : 'e.g. STF-001'}
                className="h-8 text-xs font-mono"
                disabled={isPending}
              />
            </FormField>
          </div>
        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-2">
            <FormField label={__( 'Title', 'codeclove-school-management' )} error={errors.title?.message}>
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    disabled={isPending}
                    options={TITLE_OPTIONS}
                  />
                )}
              />
            </FormField>
          </div>
          <div className="sm:col-span-3">
            <FormField label={__( 'First Name', 'codeclove-school-management' )} error={errors.first_name?.message} required>
              <Input {...register('first_name')} placeholder="e.g. Alice" error={!!errors.first_name} className="h-9" disabled={isPending} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label={__( 'Middle Name', 'codeclove-school-management' )} error={errors.middle_name?.message}>
              <Input {...register('middle_name')} placeholder="e.g. Marie" className="h-9" disabled={isPending} />
            </FormField>
          </div>
          <div className="sm:col-span-3">
            <FormField label={__( 'Last Name', 'codeclove-school-management' )} error={errors.last_name?.message} required>
              <Input {...register('last_name')} placeholder="e.g. Smith" error={!!errors.last_name} className="h-9" disabled={isPending} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label={__( 'Preferred Name', 'codeclove-school-management' )} error={errors.preferred_name?.message}>
              <Input {...register('preferred_name')} placeholder="e.g. Ali" className="h-9" disabled={isPending} />
            </FormField>
          </div>
        </div>

        {/* Demographics: Date of Birth & Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <FormField label={__( 'Date of Birth', 'codeclove-school-management' )} error={errors.date_of_birth?.message}>
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

          <FormField label={__( 'Gender', 'codeclove-school-management' )} error={errors.gender?.message}>
            <Controller
              name="gender"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || ''}
                  onValueChange={field.onChange}
                  disabled={isPending}
                  placeholder={__( 'Select gender identity', 'codeclove-school-management' )}
                  options={[
                    { value: '', label: __( 'Select gender identity', 'codeclove-school-management' ) },
                    ...GENDER_OPTIONS.map((o) => ({ value: o.value, label: __( o.label, 'codeclove-school-management' ) })),
                  ]}
                />
              )}
            />
          </FormField>
        </div>
      </Card>

      {/* ─── CARD 2: Contact & Emergency Information ───────────────────────── */}
      <Card className="overflow-hidden border border-border/60 bg-bg-surface shadow-xs rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
          <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Contact & Emergency Details', 'codeclove-school-management' )}</h3>
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={__( 'Email Address', 'codeclove-school-management' )} error={errors.email?.message} required>
            <Input type="email" {...register('email')} placeholder="e.g. alice.smith@school.com" error={!!errors.email} className="h-9" disabled={isPending} />
          </FormField>
          <FormField label={__( 'Primary Phone Number', 'codeclove-school-management' )} error={errors.phone?.message}>
            <Input {...register('phone')} placeholder="e.g. +1 (555) 012-3456" className="h-9" disabled={isPending} />
          </FormField>
        </div>

        {/* Street Address */}
        <FormField label={__( 'Residential Street Address', 'codeclove-school-management' )} error={errors.address?.message}>
          <Input {...register('address')} placeholder="e.g. 123 Main St, Apt 4B" disabled={isPending} className="h-9" />
        </FormField>

        {/* Location Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <FormField label={__( 'City', 'codeclove-school-management' )} error={errors.city?.message}>
            <Input {...register('city')} placeholder="e.g. Springfield" disabled={isPending} className="h-9" />
          </FormField>
          <FormField label={__( 'State / Province', 'codeclove-school-management' )} error={errors.state?.message}>
            <Input {...register('state')} placeholder="e.g. Illinois" disabled={isPending} className="h-9" />
          </FormField>
          <FormField label={__( 'ZIP / Postal Code', 'codeclove-school-management' )} error={errors.postal_code?.message}>
            <Input
              {...register('postal_code')}
              placeholder="e.g. 62701"
              error={!!errors.postal_code}
              className="h-9"
              disabled={isPending}
            />
          </FormField>
          <FormField label={__( 'Country', 'codeclove-school-management' )} error={errors.country?.message}>
            <Input {...register('country')} placeholder="e.g. United States" disabled={isPending} className="h-9" />
          </FormField>
        </div>

        {/* Emergency Contact Sub-section */}
        <div className="border-t border-border/40 pt-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text">
            <PhoneCall className="w-3.5 h-3.5 text-brand" />
            <span>{__( 'Emergency Contact (Duty of Care)', 'codeclove-school-management' )}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label={__( 'Contact Person Name', 'codeclove-school-management' )} error={errors.emergency_contact_name?.message}>
              <Input
                {...register('emergency_contact_name')}
                placeholder="e.g. John Smith"
                className="h-9"
                disabled={isPending}
              />
            </FormField>
            <FormField label={__( 'Relationship', 'codeclove-school-management' )} error={errors.emergency_contact_relationship?.message}>
              <Input
                {...register('emergency_contact_relationship')}
                placeholder="e.g. Spouse / Parent / Sibling"
                className="h-9"
                disabled={isPending}
              />
            </FormField>
            <FormField label={__( 'Emergency Phone', 'codeclove-school-management' )} error={errors.emergency_contact_phone?.message}>
              <Input
                {...register('emergency_contact_phone')}
                placeholder="e.g. +1 (555) 987-6543"
                className="h-9"
                disabled={isPending}
              />
            </FormField>
          </div>
        </div>
      </Card>

      {/* ─── CARD 3: Institutional Placement & Qualifications ─────────────── */}
      <Card className="overflow-hidden border border-border/60 bg-bg-surface shadow-xs rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
          <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Institutional Placement & Qualifications', 'codeclove-school-management' )}</h3>
        </div>

        {/* Designation, Department, Joined Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label={__( 'Designation / Job Title', 'codeclove-school-management' )} error={errors.designation?.message}>
            <Input {...register('designation')} placeholder="e.g. Senior English Teacher" className="h-9" disabled={isPending} />
          </FormField>
          <FormField label={__( 'Department', 'codeclove-school-management' )} error={errors.department?.message}>
            <Input {...register('department')} placeholder="e.g. Humanities & Literature" className="h-9" disabled={isPending} />
          </FormField>
          <FormField label={__( 'Joined Date', 'codeclove-school-management' )} error={errors.joined_on?.message}>
            <Controller
              name="joined_on"
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

        {/* Staff Category & Employment Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={__( 'Staff Category', 'codeclove-school-management' )} error={errors.staff_category?.message}>
            <Controller
              name="staff_category"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || ''}
                  onValueChange={field.onChange}
                  disabled={isPending}
                  options={STAFF_CATEGORY_OPTIONS}
                />
              )}
            />
          </FormField>

          <FormField label={__( 'Employment Model', 'codeclove-school-management' )} error={errors.employment_type?.message}>
            <Controller
              name="employment_type"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || ''}
                  onValueChange={field.onChange}
                  disabled={isPending}
                  options={EMPLOYMENT_TYPE_OPTIONS}
                />
              )}
            />
          </FormField>
        </div>

        {/* Educational Credentials */}
        <div className="border-t border-border/40 pt-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text">
            <GraduationCap className="w-3.5 h-3.5 text-brand" />
            <span>{__( 'Academic Qualifications', 'codeclove-school-management' )}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={__( 'Highest Degree Earned', 'codeclove-school-management' )} error={errors.highest_qualification?.message}>
              <Input
                {...register('highest_qualification')}
                placeholder="e.g. Master of Arts in English, M.Ed, B.Sc"
                className="h-9"
                disabled={isPending}
              />
            </FormField>
            <FormField label={__( 'Primary Subject / Specialization', 'codeclove-school-management' )} error={errors.specialization?.message}>
              <Input
                {...register('specialization')}
                placeholder="e.g. Literature, AP Chemistry, Special Education"
                className="h-9"
                disabled={isPending}
              />
            </FormField>
          </div>
        </div>
      </Card>

      {/* ─── CARD 4: Regional Compliance & Presets ─────────────────────────── */}
      <Card className="overflow-hidden border border-border/60 bg-bg-surface shadow-xs rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
            <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Statutory & Regional Information', 'codeclove-school-management' )}</h3>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand/10 text-brand text-xs font-semibold">
            <Globe className="w-3 h-3" />
            <span>{sprintf( __( 'Preset: %1$s (%2$s)', 'codeclove-school-management' ), activePresetName, activePreset )}</span>
          </div>
        </div>

        {PRESET_CONFIGS[activePreset] ? (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">{PRESET_CONFIGS[activePreset].desc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {PRESET_CONFIGS[activePreset].fields.map((f) => (
                <FormField key={f.name} label={f.label}>
                  {f.type === 'select' ? (
                    <Controller
                      name={`metadata.${f.name}`}
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={typeof field.value === 'string' ? field.value : (f.options?.[0]?.value ?? '')}
                          onValueChange={field.onChange}
                          disabled={isPending}
                          options={f.options ?? []}
                        />
                      )}
                    />
                  ) : f.type === 'date' ? (
                    <Controller
                      name={`metadata.${f.name}`}
                      control={control}
                      render={({ field }) => (
                        <DatePicker
                          value={typeof field.value === 'string' ? field.value : ''}
                          onChange={field.onChange}
                          disabled={isPending}
                        />
                      )}
                    />
                  ) : (
                    <Input
                      {...register(`metadata.${f.name}`)}
                      placeholder={f.placeholder}
                      maxLength={f.maxLength}
                      className="h-9 font-mono text-xs"
                      disabled={isPending}
                    />
                  )}
                </FormField>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-bg-light/30 rounded-lg text-xs text-text-muted">
            {__( 'Standard international compliance active. No country-specific statutory preset overrides configured.', 'codeclove-school-management' )}
          </div>
        )}
      </Card>

      {/* ─── CARD 5: Account Access & Security ────────────────────────────── */}
      <Card className="overflow-hidden border border-border/60 bg-bg-surface shadow-xs rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">5</span>
          <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Account Access & Security', 'codeclove-school-management' )}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={__( 'Assigned System Role', 'codeclove-school-management' )} error={errors.role_id?.message}>
            <Controller
              name="role_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={field.onChange}
                  placeholder={__( 'No System Role Assigned', 'codeclove-school-management' )}
                  disabled={isPending}
                  options={[
                    { value: '', label: __( 'No System Role Assigned', 'codeclove-school-management' ) },
                    ...roles.map((r) => ({ value: String(r.id), label: r.name })),
                  ]}
                />
              )}
            />
          </FormField>

          <FormField label={__( 'Profile Status', 'codeclove-school-management' )} error={errors.status?.message} required>
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
                    { value: 'suspended', label: __( 'Suspended', 'codeclove-school-management' ) },
                  ]}
                />
              )}
            />
          </FormField>
        </div>

        {/* WordPress User Account Credentials */}
        <div className="border-t border-border/40 pt-3 space-y-3">
          <h4 className="text-xs font-bold text-text">{__( 'WordPress User Account', 'codeclove-school-management' )}</h4>

          {initialData?.user_id ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={__( 'Username', 'codeclove-school-management' )}>
                <Input
                  {...register('username')}
                  className="h-9 bg-bg-surface-hover"
                  disabled
                  placeholder="e.g. alicesmith"
                />
              </FormField>
              <FormField label={__( 'Update Password', 'codeclove-school-management' )} error={errors.password?.message}>
                <Input
                  type="password"
                  {...register('password')}
                  placeholder="e.g. ••••••••"
                  error={!!errors.password}
                  className="h-9"
                  disabled={isPending}
                />
                <p className="text-2xs text-text-muted mt-1 leading-normal">
                  {__( 'Leave blank to keep current password.', 'codeclove-school-management' )}
                </p>
              </FormField>
            </div>
          ) : (
            <>
              <div className="p-2.5 rounded-lg border border-border bg-bg-light/20 flex items-center gap-2 select-none cursor-pointer">
                <input
                  type="checkbox"
                  id="create_user_checkbox"
                  {...register('create_user')}
                  className="rounded border-border text-brand focus:ring-brand w-3.5 h-3.5"
                  disabled={isPending}
                />
                <label htmlFor="create_user_checkbox" className="flex flex-col cursor-pointer flex-1">
                  <span className="text-xs font-semibold text-text leading-tight">
                    {__( 'Create WordPress User Account', 'codeclove-school-management' )}
                  </span>
                  <span className="text-2xs text-text-muted mt-0.5">
                    {sprintf( __( 'Generate a login account for this %s.', 'codeclove-school-management' ), staffLabelSingular.toLowerCase() )}
                  </span>
                </label>
              </div>

              {createUserChecked && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <FormField label={__( 'Username', 'codeclove-school-management' )} error={errors.username?.message} required>
                    <Input
                      {...register('username')}
                      placeholder="e.g. alicesmith"
                      error={!!errors.username}
                      className="h-9"
                      disabled={isPending}
                    />
                  </FormField>
                  <FormField label={__( 'Password', 'codeclove-school-management' )} error={errors.password?.message} required>
                    <Input
                      type="password"
                      {...register('password')}
                      placeholder="e.g. ••••••••"
                      error={!!errors.password}
                      className="h-9"
                      disabled={isPending}
                    />
                  </FormField>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* ─── CARD 6: Documents & Certifications ────────────────────────────── */}
      <Card className="overflow-hidden border border-border/60 bg-bg-surface shadow-xs rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0">6</span>
          <h3 className="text-sm font-bold text-text tracking-tight uppercase">{__( 'Documents & Verification', 'codeclove-school-management' )}</h3>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end bg-bg-light/20 border border-border/40 p-3 rounded-lg">
            <FormField label={__( 'Document Name', 'codeclove-school-management' )} className="flex-1 w-full">
              <Input
                placeholder="e.g. Academic Resume, Certifications, Contract"
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
                disabled={isUploadingDoc || isPending}
                className="h-9"
              />
            </FormField>
            <div className="w-full sm:w-auto">
              <input
                type="file"
                id="staff-doc-input"
                className="hidden"
                onChange={handleDocUpload}
                disabled={isUploadingDoc || isPending}
              />
              <Button
                type="button"
                variant="secondary"
                className="w-full h-9 px-3 text-xs"
                onClick={() => {
                  if (!docLabel.trim()) {
                    toast.error(__( 'Please enter a document name first.', 'codeclove-school-management' ))
                    return
                  }
                  document.getElementById('staff-doc-input')?.click()
                }}
                disabled={isUploadingDoc || isPending}
              >
                {isUploadingDoc ? (
                  <>
                    <Spinner size="sm" className="text-current mr-1.5" />
                    {__( 'Uploading...', 'codeclove-school-management' )}
                  </>
                ) : (
                  __( 'Upload', 'codeclove-school-management' )
                )}
              </Button>
            </div>
          </div>

          {documents.length > 0 ? (
            <div className="divide-y divide-border border border-border/60 rounded-lg overflow-hidden">
              {documents.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2.5 text-xs bg-bg-surface hover:bg-bg-light/30 transition-colors">
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <FileText className="w-4 h-4 text-brand shrink-0" />
                    <span className="font-medium text-text truncate">{doc.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline font-medium"
                      >
                        {__( 'View', 'codeclove-school-management' )}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setDocuments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-text-muted hover:text-danger p-1"
                      title={__( 'Delete document', 'codeclove-school-management' )}
                      disabled={isPending}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-border/80 rounded-lg">
              <FileText className="w-8 h-8 text-text-subtle/50 mx-auto mb-1.5" />
              <p className="text-xs text-text-muted">{__( 'No documents uploaded yet.', 'codeclove-school-management' )}</p>
            </div>
          )}
        </div>
      </Card>

      {/* ─── Action Buttons ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isPending}
        >
          {__( 'Cancel', 'codeclove-school-management' )}
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={isPending}
          className="min-w-[120px]"
        >
          {isPending ? (
            <>
              <Spinner size="sm" className="mr-2" />
              {__( 'Saving...', 'codeclove-school-management' )}
            </>
          ) : mode === 'add' ? (
            __( 'Save Staff Member', 'codeclove-school-management' )
          ) : (
            __( 'Update Profile', 'codeclove-school-management' )
          )}
        </Button>
      </div>
    </form>
  )
}
