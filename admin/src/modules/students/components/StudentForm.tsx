import { useState, useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  User,
  Shield,
  GraduationCap,
  MapPin,
  Users,
  Copy,
  Camera,
  CheckCircle2,
  Plus,
  X,
  Search,
} from 'lucide-react'
import { studentSchema, type StudentFormValues } from '@/schemas/students'
import {
  useGroupEnrollmentCounts,
  useGuardians,
  useStudents,
  type FullStudent,
  type StudentDocument,
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
  Card,
  Alert,
  Badge,
  Button,
  Select,
  Combobox,
  FormActionFooter,
} from '@/components/ui'
import {
  Form,
  FormInput,
  FormSelect,
  FormDatePicker,
  AvatarUpload,
  AddressFields,
  DocumentManager,
  uploadPendingDocuments,
  type ManagedDocument,
} from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import { api } from '@/lib/api-client'
import SubjectEnrollmentSection from './SubjectEnrollmentSection'
interface StudentFormProps {
  mode: 'admit' | 'edit'
  initialData?: FullStudent | null
  onSubmit: (data: StudentFormValues) => void
  onCancel?: () => void
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
  const [siblingClassFilter, setSiblingClassFilter] = useState<string>('')

  // Query enrolled students for sibling fast-fill, scoped optionally by class/academic unit
  const { data: studentsData, isLoading: isStudentsLoading } = useStudents({
    academic_unit_id: siblingClassFilter ? Number(siblingClassFilter) : undefined,
    status: 'active',
    per_page: siblingClassFilter ? 100 : 200,
  })
  const studentsList = useMemo(() => studentsData?.data ?? [], [studentsData?.data])
  const toast = useToast()
  const [documents, setDocuments] = useState<ManagedDocument[]>(() =>
    (initialData?.documents || []).map((d, index) => ({
      ...d,
      id: d.id || ('doc_' + (d.attachment_id ? `${d.attachment_id}_${index}` : `${index}_${Date.now()}`)),
    }))
  )
  const [isUploadingDoc, setIsUploadingDoc] = useState(false)
  const [showOtherGuardian, setShowOtherGuardian] = useState(
    Boolean(
      initialData?.guardian?.first_name ||
      initialData?.guardian_first_name ||
      (initialData?.relationship && initialData.relationship !== 'guardian') ||
      (initialData?.guardians && initialData.guardians.some((g) => g.relationship !== 'Father' && g.relationship !== 'Mother'))
    )
  )
  const [linkedSibling, setLinkedSibling] = useState<{ id: number; name: string; classInfo: string } | null>(null)

  const { getLabel } = useLabels()
  const studentLabelSingular = getLabel('student', false, __( 'Student', 'codeclove-school-management' ))
  const unitLabelSingular = getLabel('academic_unit', false, __( 'Class Level', 'codeclove-school-management' ))
  const unitLabelPlural = getLabel('academic_unit', true, __( 'Classes', 'codeclove-school-management' ))
  const groupLabelSingular = getLabel('academic_group', false, __( 'Section', 'codeclove-school-management' ))
  const groupLabelPlural = getLabel('academic_group', true, __( 'Sections', 'codeclove-school-management' ))
  const subjectLabelPlural = getLabel('subject', true, __( 'Subjects', 'codeclove-school-management' ))
  const guardianLabelSingular = getLabel('guardian', false, __( 'Guardian', 'codeclove-school-management' ))

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
      primary_contact: 'father',
      father_guardian_id: '',
      father_first_name: '',
      father_last_name: '',
      father_email: '',
      father_phone: '',
      father_occupation: '',
      mother_guardian_id: '',
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

  // Watch fields
  const activeSessionId = watch('academic_session_id')
  const currentSessionId = Number(activeSessionId || initialData?.enrollment?.academic_session_id || session?.id) || undefined
  const selectedSubjectIds = watch('subject_ids') || []
  const linkExisting = watch('link_existing_guardian')
  const autoGenerateAdm = watch('auto_generate_admission')
  const activeUnit = watch('academic_unit_id') ? String(watch('academic_unit_id')) : ''
  const activeGroup = watch('academic_group_id') ? String(watch('academic_group_id')) : ''
  const currentGender = watch('gender')
  const currentStatus = watch('status') || 'active'
  const fatherFirst = watch('father_first_name')
  const motherFirst = watch('mother_first_name')
  const guardianFirst = watch('guardian_first_name')
  const guardianId = watch('guardian_id')
  const currentPrimary = watch('primary_contact')
  const hasAnyParent = Boolean(fatherFirst || motherFirst)

  // Smart auto-select primary contact if currently selected contact has no data but another one does
  useEffect(() => {
    const hasFather = Boolean(fatherFirst)
    const hasMother = Boolean(motherFirst)
    const hasGuardian = Boolean(linkExisting ? guardianId : guardianFirst)

    if (currentPrimary === 'father' && !hasFather) {
      if (hasMother) {
        setValue('primary_contact', 'mother')
      } else if (hasGuardian) {
        setValue('primary_contact', 'guardian')
      }
    } else if (currentPrimary === 'mother' && !hasMother) {
      if (hasFather) {
        setValue('primary_contact', 'father')
      } else if (hasGuardian) {
        setValue('primary_contact', 'guardian')
      }
    } else if (currentPrimary === 'guardian' && !hasGuardian) {
      if (hasFather) {
        setValue('primary_contact', 'father')
      } else if (hasMother) {
        setValue('primary_contact', 'mother')
      }
    }
  }, [fatherFirst, motherFirst, guardianFirst, guardianId, linkExisting, currentPrimary, setValue])
  // Dynamically enriched Primary Contact options with live name previews and colored icons
  const fatherName = [fatherFirst, watch('father_last_name')].filter(Boolean).join(' ')
  const motherName = [motherFirst, watch('mother_last_name')].filter(Boolean).join(' ')
  const guardianName = [watch('guardian_first_name'), watch('guardian_last_name')].filter(Boolean).join(' ')

  const primaryContactOptions = useMemo(() => [
    {
      value: 'father',
      label: fatherName ? `${__( 'Father', 'codeclove-school-management' )} (${fatherName})` : __( 'Father', 'codeclove-school-management' ),
      prefix: (
        <span className="w-5 h-5 rounded flex items-center justify-center bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
          <User size={12} className="stroke-[2.5]" />
        </span>
      ),
    },
    {
      value: 'mother',
      label: motherName ? `${__( 'Mother', 'codeclove-school-management' )} (${motherName})` : __( 'Mother', 'codeclove-school-management' ),
      prefix: (
        <span className="w-5 h-5 rounded flex items-center justify-center bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
          <User size={12} className="stroke-[2.5]" />
        </span>
      ),
    },
    {
      value: 'guardian',
      label: guardianName
        ? `${sprintf( __( 'Legal %s', 'codeclove-school-management' ), guardianLabelSingular )} (${guardianName})`
        : sprintf( __( 'Legal %s', 'codeclove-school-management' ), guardianLabelSingular ),
      prefix: (
        <span className="w-5 h-5 rounded flex items-center justify-center bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
          <Shield size={12} className="stroke-[2.5]" />
        </span>
      ),
    },
  ], [fatherName, motherName, guardianName, guardianLabelSingular])

  const siblingOptions = useMemo(() => {
    return studentsList
      .filter((s) => !initialData || s.id !== initialData.id)
      .map((s) => {
        const familyParts: string[] = []
        if (s.guardian_first_name) {
          familyParts.push(`${s.guardian_first_name} ${s.guardian_last_name || ''}`.trim())
        }
        const classInfo = [s.unit_name, s.group_name].filter(Boolean).join(' • ')
        return {
          value: String(s.id),
          label: `${s.first_name} ${s.last_name}`,
          description: [classInfo, s.admission_number ? `#${s.admission_number}` : '', familyParts.length > 0 ? sprintf( __( 'Family: %s', 'codeclove-school-management' ), familyParts.join(', ') ) : ''].filter(Boolean).join(' • '),
          keywords: [s.first_name, s.last_name, s.admission_number || '', s.guardian_first_name || '', s.guardian_last_name || ''],
        }
      })
  }, [studentsList, initialData])

  const handleSiblingSelect = async (studentIdStr: string) => {
    if (!studentIdStr) return
    const sId = Number(studentIdStr)
    try {
      const res = await api.get<FullStudent>(`students/${sId}`)
      const sibling = res.data
      if (!sibling) return

      // 1. Copy Residential Address
      if (sibling.address) setValue('address', sibling.address, { shouldDirty: true })
      if (sibling.city) setValue('city', sibling.city, { shouldDirty: true })
      if (sibling.state) setValue('state', sibling.state, { shouldDirty: true })
      if (sibling.postal_code) setValue('postal_code', sibling.postal_code, { shouldDirty: true })
      if (sibling.country) setValue('country', sibling.country, { shouldDirty: true })

      // 2. Copy & Link Father
      if (sibling.father) {
        setValue('father_first_name', sibling.father.first_name, { shouldDirty: true })
        setValue('father_last_name', sibling.father.last_name, { shouldDirty: true })
        setValue('father_phone', sibling.father.phone || '', { shouldDirty: true })
        setValue('father_email', sibling.father.email || '', { shouldDirty: true })
        setValue('father_occupation', sibling.father.occupation || '', { shouldDirty: true })
        setValue('father_guardian_id', String(sibling.father.id), { shouldDirty: true })
      }

      // 3. Copy & Link Mother
      if (sibling.mother) {
        setValue('mother_first_name', sibling.mother.first_name, { shouldDirty: true })
        setValue('mother_last_name', sibling.mother.last_name, { shouldDirty: true })
        setValue('mother_phone', sibling.mother.phone || '', { shouldDirty: true })
        setValue('mother_email', sibling.mother.email || '', { shouldDirty: true })
        setValue('mother_occupation', sibling.mother.occupation || '', { shouldDirty: true })
        setValue('mother_guardian_id', String(sibling.mother.id), { shouldDirty: true })
      }

      // 4. Copy & Link Other Guardian if any
      if (sibling.guardian) {
        setShowOtherGuardian(true)
        setValue('link_existing_guardian', true, { shouldDirty: true })
        setValue('guardian_id', String(sibling.guardian.id), { shouldDirty: true })
        setValue('guardian_first_name', sibling.guardian.first_name, { shouldDirty: true })
        setValue('guardian_last_name', sibling.guardian.last_name, { shouldDirty: true })
        setValue('guardian_phone', sibling.guardian.phone || '', { shouldDirty: true })
        setValue('guardian_email', sibling.guardian.email || '', { shouldDirty: true })
        setValue('relationship', sibling.relationship || 'guardian', { shouldDirty: true })
      }

      // 5. Sync Primary Contact
      if (sibling.primary_contact) {
        setValue('primary_contact', sibling.primary_contact, { shouldDirty: true })
      }

      const classInfo = [sibling.enrollment?.unit_name, sibling.enrollment?.group_name].filter(Boolean).join(' • ')
      const siblingName = `${sibling.first_name} ${sibling.last_name}`
      setLinkedSibling({
        id: sibling.id,
        name: siblingName,
        classInfo,
      })

      toast.success(sprintf( __( 'Copied household address & linked parents from %s.', 'codeclove-school-management' ), siblingName ))
    } catch {
      toast.error( __( 'Failed to load sibling household details.', 'codeclove-school-management' ) )
    }
  }

  const handleClearSibling = () => {
    setLinkedSibling(null)
    setValue('father_guardian_id', '', { shouldDirty: true })
    setValue('mother_guardian_id', '', { shouldDirty: true })
    toast.info( __( 'Sibling household link removed.', 'codeclove-school-management' ) )
  }

  // Query academic units & groups scoped strictly to the student's academic session
  const { data: unitData } = useUnits({
    session_id: currentSessionId,
    per_page: 200,
  })
  const { data: groupData } = useGroups({
    session_id: currentSessionId,
    unit_id: Number(activeUnit),
    academic_unit_id: Number(activeUnit),
    per_page: 200,
  })
  const { data: unitSubjectsData } = useUnitSubjects(Number(activeUnit), { enabled: !!activeUnit })

  const groups = groupData?.data ?? []
  const units = unitData?.data ?? []
  const unitSubjects = unitSubjectsData ?? []
  const classFilterOptions = [
    { value: '', label: sprintf( __( 'All %s', 'codeclove-school-management' ), unitLabelPlural ) },
    ...units.map((u) => ({
      value: String(u.id),
      label: u.name,
    })),
  ]

  const selectedClassName = siblingClassFilter
    ? units.find((u) => String(u.id) === siblingClassFilter)?.name || ''
    : ''

  const selectedExistingGuardian = guardianId && guardians
    ? guardians.find((g) => String(g.id) === String(guardianId)) || null
    : null
  useEffect(() => {
    if (initialData) {
      const pCode = initialData.postal_code || ''
      const unitIdStr = initialData.enrollment?.academic_unit_id ? String(initialData.enrollment.academic_unit_id) : ''
      const groupIdStr = initialData.enrollment?.academic_group_id ? String(initialData.enrollment.academic_group_id) : ''
      const sessionIdStr = initialData.enrollment?.academic_session_id
        ? String(initialData.enrollment.academic_session_id)
        : (session ? String(session.id) : '1')

      reset({
        first_name: initialData.first_name || '',
        middle_name: initialData.middle_name || '',
        last_name: initialData.last_name || '',
        date_of_birth: initialData.date_of_birth || '',
        gender: (initialData.gender
          ? String(initialData.gender).toLowerCase().trim().replace(/[-\s]+/g, '_')
          : 'male') as StudentFormValues['gender'],
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
        father_guardian_id: initialData.father ? String(initialData.father.id) : '',
        father_first_name: initialData.father?.first_name || '',
        father_last_name: initialData.father?.last_name || '',
        father_email: initialData.father?.email || '',
        father_phone: initialData.father?.phone || '',
        father_occupation: initialData.father?.occupation || '',
        mother_guardian_id: initialData.mother ? String(initialData.mother.id) : '',
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
        primary_contact: initialData.primary_contact || (initialData.mother?.is_primary ? 'mother' : (initialData.guardian?.is_primary ? 'guardian' : 'father')),
        status: initialData.status || 'active',
      })
      setPhotoUrl(initialData.photo_url || '')
      if (initialData.documents) {
        setDocuments(
          initialData.documents.map((d, index) => ({
            ...d,
            id: d.id || ('doc_' + (d.attachment_id ? `${d.attachment_id}_${index}` : `${index}_${Date.now()}`)),
          }))
        )
      }
    } else if (session) {
      setValue('academic_session_id', String(session.id))
    }
  }, [initialData, reset, setValue, session, units.length, groups.length])

  const autoPopulatedUnitRef = useRef<string | null>(
    initialData?.enrollment?.academic_unit_id
      ? String(initialData.enrollment.academic_unit_id)
      : (initialData?.subject_ids && initialData.subject_ids.length > 0 ? activeUnit : null)
  )

  useEffect(() => {
    if (mode === 'admit' && activeUnit && unitSubjectsData && autoPopulatedUnitRef.current !== activeUnit) {
      autoPopulatedUnitRef.current = activeUnit
      const coreIds = unitSubjectsData
        .filter((s) => s.subject_type === 'core' && s.is_required !== false)
        .map((s) => s.subject_id)
      setValue('subject_ids', coreIds, { shouldDirty: true })
    }
  }, [activeUnit, unitSubjectsData, mode, setValue])
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


  const selectedGroup = groups.find((g) => String(g.id) === activeGroup)
  const groupMockCount = selectedGroup ? (mockCounts?.[selectedGroup.id] || 0) : 0
  const groupCapacity = selectedGroup?.capacity ?? 30
  const isOverCapacity = selectedGroup && (mode === 'admit' || String(initialData?.enrollment?.academic_group_id) !== activeGroup)
    ? (groupMockCount >= groupCapacity)
    : false

  const year = new Date().getFullYear()
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

  const handleFormSubmit = async (values: StudentFormValues) => {
    setIsUploadingDoc(true)
    try {
      const resolvedDocs = await uploadPendingDocuments(documents, 'document')
      setDocuments(resolvedDocs)
      onSubmit({
        ...values,
        documents: resolvedDocs as unknown as StudentDocument[],
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : __( 'Failed to upload documents.', 'codeclove-school-management' ))
    } finally {
      setIsUploadingDoc(false)
    }
  }


  return (
    <Form id="student-form" form={form} onSubmit={handleFormSubmit} className="space-y-6">
      {/* 2-Column Responsive Layout (Main 8 cols : Sidebar 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ─── PRIMARY DETAILS COLUMN (Left 8 cols) ─────────────────────────── */}
        <div className="order-2 lg:order-1 lg:col-span-8 space-y-6 min-w-0">

          {/* 1. PERSONAL DETAILS */}
          <Card id="section-personal" className="overflow-hidden border border-border bg-bg-elevated shadow-xs rounded-xl p-5 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <div className="w-9 h-9 rounded-xl border border-border bg-bg-surface flex items-center justify-center text-text shrink-0 shadow-2xs">
                <User className="w-4 h-4 text-text" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text tracking-tight uppercase">
                  {__( 'Personal Details', 'codeclove-school-management' )}
                </h3>
                <p className="text-2xs text-text-muted mt-0.5">
                  {__( 'Official legal name and demographic identification.', 'codeclove-school-management' )}
                </p>
              </div>
            </div>

            {/* Row 1: Student Full Name (3 columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormInput
                name="first_name"
                label={__( 'First Name', 'codeclove-school-management' )}
                placeholder={__( 'e.g. Alice', 'codeclove-school-management' )}
                required
                disabled={isPending}
                inputClassName="h-9 text-sm"
              />
              <FormInput
                name="middle_name"
                label={__( 'Middle Name', 'codeclove-school-management' )}
                placeholder={__( 'e.g. Marie', 'codeclove-school-management' )}
                disabled={isPending}
                inputClassName="h-9 text-sm"
              />
              <FormInput
                name="last_name"
                label={__( 'Last Name', 'codeclove-school-management' )}
                placeholder={__( 'e.g. Smith', 'codeclove-school-management' )}
                required
                disabled={isPending}
                inputClassName="h-9 text-sm"
              />
            </div>

            {/* Row 2: Date of Birth & Gender Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormDatePicker
                name="date_of_birth"
                label={__( 'Date of Birth', 'codeclove-school-management' )}
                required
                disabled={isPending}
              />

              <FormSelect
                name="gender"
                label={__( 'Gender Identity', 'codeclove-school-management' )}
                required
                disabled={isPending}
                options={[
                  ...GENDER_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: __( opt.label, 'codeclove-school-management' ),
                  })),
                  ...(currentGender === 'other'
                    ? [{ value: 'other', label: __( 'Other (Legacy)', 'codeclove-school-management' ) }]
                    : []),
                ]}
              />
            </div>
          </Card>

          {/* 2. FAMILY & GUARDIANS */}
          <Card id="section-family" className="overflow-hidden border border-border bg-bg-elevated shadow-xs rounded-xl p-5 space-y-5">
            {/* Header: Family & Guardians + Primary Notification Contact Dropdown */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 pb-4 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl border border-border bg-bg-surface flex items-center justify-center text-text shrink-0 shadow-2xs">
                  <Users className="w-4 h-4 text-text" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-text tracking-tight uppercase">
                    {__( 'Family & Guardians', 'codeclove-school-management' )}
                  </h3>
                  <p className="text-2xs text-text-muted mt-0.5">
                    {__( 'Parent and emergency contacts.', 'codeclove-school-management' )}
                  </p>
                </div>
              </div>

              {/* Primary Notification Contact Dropdown */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5 shrink-0 self-start md:self-center">
                <label htmlFor="primary-contact-select" className="text-2xs font-bold uppercase tracking-wider text-text-subtle shrink-0">
                  {__( 'Primary Contact:', 'codeclove-school-management' )}
                </label>
                <div className="w-full sm:w-64 md:w-72">
                  <Select
                    id="primary-contact-select"
                    value={currentPrimary}
                    onValueChange={(val) => setValue('primary_contact', val as 'father' | 'mother' | 'guardian', { shouldDirty: true })}
                    disabled={isPending}
                    options={primaryContactOptions}
                    className="h-8 text-xs font-medium bg-bg-surface"
                  />
                </div>
              </div>
            </div>

            {/* Sibling Quick-Fill Utility */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-xl bg-bg-surface border border-border">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-brand-dim text-brand flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-text truncate">
                    {__( 'Sibling Quick-Fill', 'codeclove-school-management' )}
                  </div>
                  <div className="text-2xs text-text-muted truncate">
                    {__( 'Copy household address and link parents from an enrolled student.', 'codeclove-school-management' )}
                  </div>
                </div>
              </div>

              {linkedSibling ? (
                <div className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-success-dim/40 border border-success-border text-xs shrink-0 max-w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                    <div className="min-w-0">
                      <span className="font-semibold text-text truncate text-xs">
                        {sprintf( __( 'Linked to %s’s Household', 'codeclove-school-management' ), linkedSibling.name )}
                      </span>
                      {linkedSibling.classInfo && (
                        <span className="text-text-muted text-3xs font-normal ms-1">({linkedSibling.classInfo})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ms-2">
                    <button
                      type="button"
                      onClick={() => setLinkedSibling(null)}
                      className="text-2xs font-semibold text-brand hover:underline cursor-pointer"
                    >
                      {__( 'Change', 'codeclove-school-management' )}
                    </button>
                    <span className="text-border">|</span>
                    <button
                      type="button"
                      onClick={handleClearSibling}
                      className="text-2xs font-semibold text-danger hover:underline cursor-pointer"
                    >
                      {__( 'Unlink', 'codeclove-school-management' )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full lg:w-auto">
                  {/* Class Filter Dropdown */}
                  <div className="w-full sm:w-36 md:w-40 shrink-0">
                    <Select
                      value={siblingClassFilter}
                      onValueChange={(val) => setSiblingClassFilter(val)}
                      disabled={isPending}
                      options={classFilterOptions}
                      placeholder={sprintf( __( 'All %s', 'codeclove-school-management' ), unitLabelPlural )}
                      className="h-8 text-xs font-medium bg-bg-elevated"
                    />
                  </div>

                  {/* Student Combobox */}
                  <div className="w-full sm:w-60 md:w-68 shrink-0">
                    <Combobox
                      placeholder={isStudentsLoading
                        ? __( 'Loading...', 'codeclove-school-management' )
                        : (siblingClassFilter && selectedClassName
                          ? sprintf( __( 'Select %s sibling...', 'codeclove-school-management' ), selectedClassName )
                          : __( 'Search sibling...', 'codeclove-school-management' )
                        )
                      }
                      searchPlaceholder={__( 'Search by name or ID...', 'codeclove-school-management' )}
                      emptyText={siblingClassFilter && selectedClassName
                        ? sprintf( __( 'No students in %s.', 'codeclove-school-management' ), selectedClassName )
                        : __( 'No students found.', 'codeclove-school-management' )
                      }
                      options={siblingOptions}
                      onValueChange={handleSiblingSelect}
                      disabled={isPending || isStudentsLoading}
                      className="h-8 text-xs bg-bg-elevated"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Side-by-side Parents (Clean Columns Without Nested Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              
              {/* Father's Column */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-bold text-text uppercase tracking-tight">
                  {__( "Father's Details", 'codeclove-school-management' )}
                  <span className="text-text-muted font-normal text-2xs lowercase ms-1">({__( 'optional', 'codeclove-school-management' )})</span>
                </h4>

                <div className="grid grid-cols-2 gap-2.5">
                  <FormInput
                    name="father_first_name"
                    label={__( 'First Name', 'codeclove-school-management' )}
                    placeholder={__( 'e.g. John', 'codeclove-school-management' )}
                    inputClassName="h-9 text-sm"
                    disabled={isPending}
                  />
                  <FormInput
                    name="father_last_name"
                    label={__( 'Last Name', 'codeclove-school-management' )}
                    placeholder={__( 'e.g. Smith', 'codeclove-school-management' )}
                    required={!!watch('father_first_name')}
                    inputClassName="h-9 text-sm"
                    disabled={isPending}
                  />
                </div>

                <FormInput
                  name="father_phone"
                  label={__( 'Phone Number', 'codeclove-school-management' )}
                  placeholder={__( 'e.g. +1 (555) 019-8765', 'codeclove-school-management' )}
                  inputClassName="h-9 text-sm font-mono"
                  disabled={isPending}
                />

                <FormInput
                  name="father_email"
                  type="email"
                  label={__( 'Email Address', 'codeclove-school-management' )}
                  placeholder={__( 'e.g. john.smith@gmail.com', 'codeclove-school-management' )}
                  inputClassName="h-9 text-sm"
                  disabled={isPending}
                />

                <FormInput
                  name="father_occupation"
                  label={__( 'Occupation', 'codeclove-school-management' )}
                  placeholder={__( 'e.g. Software Engineer', 'codeclove-school-management' )}
                  inputClassName="h-9 text-sm"
                  disabled={isPending}
                />
              </div>

              {/* Mother's Column */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-bold text-text uppercase tracking-tight">
                  {__( "Mother's Details", 'codeclove-school-management' )}
                  <span className="text-text-muted font-normal text-2xs lowercase ms-1">({__( 'optional', 'codeclove-school-management' )})</span>
                </h4>

                <div className="grid grid-cols-2 gap-2.5">
                  <FormInput
                    name="mother_first_name"
                    label={__( 'First Name', 'codeclove-school-management' )}
                    placeholder={__( 'e.g. Jane', 'codeclove-school-management' )}
                    inputClassName="h-9 text-sm"
                    disabled={isPending}
                  />
                  <FormInput
                    name="mother_last_name"
                    label={__( 'Last Name', 'codeclove-school-management' )}
                    placeholder={__( 'e.g. Smith', 'codeclove-school-management' )}
                    required={!!watch('mother_first_name')}
                    inputClassName="h-9 text-sm"
                    disabled={isPending}
                  />
                </div>

                <FormInput
                  name="mother_phone"
                  label={__( 'Phone Number', 'codeclove-school-management' )}
                  placeholder={__( 'e.g. +1 (555) 019-8766', 'codeclove-school-management' )}
                  inputClassName="h-9 text-sm font-mono"
                  disabled={isPending}
                />

                <FormInput
                  name="mother_email"
                  type="email"
                  label={__( 'Email Address', 'codeclove-school-management' )}
                  placeholder={__( 'e.g. jane.smith@gmail.com', 'codeclove-school-management' )}
                  inputClassName="h-9 text-sm"
                  disabled={isPending}
                />

                <FormInput
                  name="mother_occupation"
                  label={__( 'Occupation', 'codeclove-school-management' )}
                  placeholder={__( 'e.g. Pediatrist', 'codeclove-school-management' )}
                  inputClassName="h-9 text-sm"
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Legal Guardian / Secondary Contact (Progressive Disclosure) */}
            <div className="border-t border-border pt-4">
              {!showOtherGuardian ? (
                <button
                  type="button"
                  onClick={() => setShowOtherGuardian(true)}
                  className="w-full py-2.5 px-3 rounded-lg border border-dashed border-border hover:border-brand/40 text-text-muted hover:text-brand text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={13} />
                  <span>{__( 'Add Legal Guardian or Secondary Contact (Optional)', 'codeclove-school-management' )}</span>
                </button>
              ) : (
                <div className="space-y-4 animate-fadeIn">
                  {/* Clean Header: Title + Subtitle on Left, Remove Button on Right */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-text uppercase tracking-tight">
                          {__( 'Legal Guardian / Secondary Contact', 'codeclove-school-management' )}
                        </h4>
                        <p className="text-2xs text-text-muted mt-0.5">
                          {__( 'Optional legal custodian, grandparent, or emergency reachability.', 'codeclove-school-management' )}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowOtherGuardian(false)
                        setValue('guardian_first_name', '')
                        setValue('guardian_last_name', '')
                        setValue('guardian_phone', '')
                        setValue('guardian_email', '')
                        setValue('guardian_id', '')
                        setValue('link_existing_guardian', false)
                      }}
                      className="text-text-muted hover:text-danger hover:bg-danger-dim/30 h-7 px-2.5 text-2xs cursor-pointer self-start sm:self-auto font-medium"
                    >
                      <X className="w-3.5 h-3.5 me-1" />
                      <span>{__( 'Remove', 'codeclove-school-management' )}</span>
                    </Button>
                  </div>

                  {/* Mode Selector: New Guardian vs. Select from Directory */}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center rounded-lg border border-border bg-bg-surface p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setValue('link_existing_guardian', false, { shouldDirty: true })
                          setValue('guardian_id', '')
                        }}
                        className={cn(
                          'px-3 py-1 rounded-md text-2xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                          !linkExisting
                            ? 'bg-bg-elevated text-text font-semibold shadow-2xs'
                            : 'text-text-muted hover:text-text'
                        )}
                      >
                        <Plus size={12} />
                        <span>{__( 'New Guardian', 'codeclove-school-management' )}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue('link_existing_guardian', true, { shouldDirty: true })}
                        className={cn(
                          'px-3 py-1 rounded-md text-2xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                          linkExisting
                            ? 'bg-bg-elevated text-text font-semibold shadow-2xs'
                            : 'text-text-muted hover:text-text'
                        )}
                      >
                        <Search size={12} />
                        <span>{__( 'Select from Directory', 'codeclove-school-management' )}</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode 1: Select from Directory */}
                  {linkExisting ? (
                    <div className="space-y-3.5 animate-fadeIn">
                      {!selectedExistingGuardian ? (
                        <FormSelect
                          name="guardian_id"
                          label={__( 'Select Registered Guardian from Directory', 'codeclove-school-management' )}
                          required
                          searchable
                          searchPlaceholder={__( 'Search by name, email, or phone...', 'codeclove-school-management' )}
                          emptyText={__( 'No registered guardians found.', 'codeclove-school-management' )}
                          disabled={isPending}
                          placeholder={__( 'Search / Select Guardian...', 'codeclove-school-management' )}
                          options={guardians?.map((g) => {
                            const descParts: string[] = []
                            if (g.email) descParts.push(g.email)
                            if (g.phone) descParts.push(g.phone)
                            return {
                              value: String(g.id),
                              label: `${g.first_name} ${g.last_name}`,
                              description: descParts.length > 0 ? descParts.join(' • ') : (g.email || g.phone || __( 'No contact info', 'codeclove-school-management' )),
                              keywords: [g.email || '', g.phone || '', g.first_name, g.last_name],
                            }
                          }) ?? []}
                          onValueChange={handleGuardianChange}
                        />
                      ) : (
                        <div className="p-3.5 rounded-xl border border-border bg-bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold text-sm shrink-0">
                              {selectedExistingGuardian.first_name[0] || 'G'}{(selectedExistingGuardian.last_name?.[0]) || ''}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-text truncate">
                                  {selectedExistingGuardian.first_name} {selectedExistingGuardian.last_name}
                                </span>
                                <Badge variant="success" size="xs">{__( 'Linked from Directory', 'codeclove-school-management' )}</Badge>
                              </div>
                              <p className="text-2xs text-text-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                {selectedExistingGuardian.phone && (
                                  <span className="font-mono">📞 {selectedExistingGuardian.phone}</span>
                                )}
                                {selectedExistingGuardian.email && (
                                  <span>✉ {selectedExistingGuardian.email}</span>
                                )}
                                {!selectedExistingGuardian.phone && !selectedExistingGuardian.email && (
                                  <span>{__( 'No contact info on file', 'codeclove-school-management' )}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setValue('guardian_id', '', { shouldDirty: true })
                              setValue('guardian_first_name', '', { shouldDirty: true })
                              setValue('guardian_last_name', '', { shouldDirty: true })
                              setValue('guardian_phone', '', { shouldDirty: true })
                              setValue('guardian_email', '', { shouldDirty: true })
                            }}
                            className="h-7 text-2xs shrink-0 self-start sm:self-center"
                          >
                            {__( 'Change Guardian', 'codeclove-school-management' )}
                          </Button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                        <div className="sm:col-span-2">
                          <FormSelect
                            name="relationship"
                            label={sprintf( __( 'Relationship to %s', 'codeclove-school-management' ), studentLabelSingular )}
                            disabled={isPending}
                            options={[
                              { value: 'guardian', label: __( 'Legal Guardian', 'codeclove-school-management' ) },
                              { value: 'grandparent', label: __( 'Grandparent', 'codeclove-school-management' ) },
                              { value: 'uncle_aunt', label: __( 'Uncle / Aunt', 'codeclove-school-management' ) },
                              { value: 'foster_parent', label: __( 'Foster Parent', 'codeclove-school-management' ) },
                              { value: 'sibling', label: __( 'Sibling', 'codeclove-school-management' ) },
                              { value: 'other', label: __( 'Other Relative', 'codeclove-school-management' ) },
                            ]}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Mode 2: Manual New Guardian Entry */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-fadeIn">
                      <FormInput
                        name="guardian_first_name"
                        label={__( 'Guardian First Name', 'codeclove-school-management' )}
                        placeholder={__( 'e.g. Robert', 'codeclove-school-management' )}
                        disabled={isPending}
                        required={!hasAnyParent && !!watch('guardian_last_name')}
                        inputClassName="h-9 text-sm"
                      />
                      <FormInput
                        name="guardian_last_name"
                        label={__( 'Guardian Last Name', 'codeclove-school-management' )}
                        placeholder={__( 'e.g. Miller', 'codeclove-school-management' )}
                        disabled={isPending}
                        required={!hasAnyParent && !!watch('guardian_first_name')}
                        inputClassName="h-9 text-sm"
                      />
                      <FormInput
                        name="guardian_phone"
                        label={__( 'Guardian Phone Number', 'codeclove-school-management' )}
                        placeholder={__( 'e.g. +1 (555) 012-3456', 'codeclove-school-management' )}
                        disabled={isPending}
                        inputClassName="h-9 text-sm font-mono"
                      />
                      <FormInput
                        name="guardian_email"
                        type="email"
                        label={__( 'Guardian Email Address', 'codeclove-school-management' )}
                        placeholder={__( 'e.g. robert.miller@gmail.com', 'codeclove-school-management' )}
                        disabled={isPending}
                        inputClassName="h-9 text-sm"
                      />
                      <div className="sm:col-span-2">
                        <FormSelect
                          name="relationship"
                          label={sprintf( __( 'Relationship to %s', 'codeclove-school-management' ), studentLabelSingular )}
                          disabled={isPending}
                          options={[
                            { value: 'guardian', label: __( 'Legal Guardian', 'codeclove-school-management' ) },
                            { value: 'grandparent', label: __( 'Grandparent', 'codeclove-school-management' ) },
                            { value: 'uncle_aunt', label: __( 'Uncle / Aunt', 'codeclove-school-management' ) },
                            { value: 'foster_parent', label: __( 'Foster Parent', 'codeclove-school-management' ) },
                            { value: 'sibling', label: __( 'Sibling', 'codeclove-school-management' ) },
                            { value: 'other', label: __( 'Other Relative', 'codeclove-school-management' ) },
                          ]}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Validation Notice if All Family Fields are Blank */}
            {errors.father_first_name && !watch('father_first_name') && !watch('mother_first_name') && !watch('guardian_first_name') && !watch('guardian_id') && (
              <Alert variant="danger" title={__( 'Parent or Guardian Required', 'codeclove-school-management' )} className="py-2 px-3 text-xs">
                {errors.father_first_name.message}
              </Alert>
            )}
          </Card>

          {/* 3. RESIDENTIAL ADDRESS */}
          <Card id="section-address" className="overflow-hidden border border-border bg-bg-elevated shadow-xs rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <div className="w-9 h-9 rounded-xl border border-border bg-bg-surface flex items-center justify-center text-text shrink-0 shadow-2xs">
                <MapPin className="w-4 h-4 text-text" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text tracking-tight uppercase">
                  {__( 'Residential Address', 'codeclove-school-management' )}
                </h3>
                <p className="text-2xs text-text-muted mt-0.5">
                  {__( 'Permanent residence and mailing address for school records.', 'codeclove-school-management' )}
                </p>
              </div>
            </div>

            <AddressFields
              register={form.register}
              errors={form.formState.errors}
              disabled={isPending}
              columns={2}
              inputClassName="h-9 text-sm"
              streetLabel={__( 'Street Address', 'codeclove-school-management' )}
              streetPlaceholder={__( 'e.g. 123 Main St, Apt 4B', 'codeclove-school-management' )}
            />
          </Card>

          {/* 4. COURSE ELECTIVES & SUBJECTS */}
          <SubjectEnrollmentSection
            unitSubjects={unitSubjects}
            selectedSubjectIds={selectedSubjectIds}
            onChange={(ids) => setValue('subject_ids', ids, { shouldDirty: true })}
            activeUnit={activeUnit}
            unitLabelSingular={unitLabelSingular}
            subjectLabelPlural={subjectLabelPlural}
            isPending={isPending}
          />

          {/* 5. STUDENT DOCUMENTS */}
          <Card className="overflow-hidden border border-border bg-bg-elevated shadow-xs rounded-xl p-5">
            <DocumentManager
              title={__( 'Student Documents', 'codeclove-school-management' )}
              description={__( 'Attach official student certificates and records (birth certificate, transfer letter, medical reports, ID cards). Select or drop multiple PDF, JPG, or PNG files at once.', 'codeclove-school-management' )}
              documents={documents}
              onChange={setDocuments}
              disabled={isPending || isUploadingDoc}
              isUploading={isUploadingDoc}
            />
          </Card>
          {/* 5. FORM ACTION FOOTER */}
          <FormActionFooter
            icon={Shield}
            title={
              mode === 'admit'
                ? sprintf( __( 'Confirm %s Admission', 'codeclove-school-management' ), studentLabelSingular )
                : sprintf( __( 'Save %s Profile Updates', 'codeclove-school-management' ), studentLabelSingular )
            }
            description={
              mode === 'admit'
                ? sprintf( __( 'Review placement and details before confirming %s admission.', 'codeclove-school-management' ), studentLabelSingular.toLowerCase() )
                : sprintf( __( 'Changes will immediately update the %s profile and academic records.', 'codeclove-school-management' ), studentLabelSingular.toLowerCase() )
            }
            submitText={
              mode === 'admit'
                ? __( 'Confirm Admission', 'codeclove-school-management' )
                : __( 'Save Changes', 'codeclove-school-management' )
            }
            submittingText={
              mode === 'admit'
                ? __( 'Admitting...', 'codeclove-school-management' )
                : __( 'Saving...', 'codeclove-school-management' )
            }
            onCancel={onCancel}
            isPending={isPending}
          />

        </div>

        {/* ─── SIDEBAR COLUMN (Right 4 cols) ─────────────────────────────────── */}
        <div className="order-1 lg:order-2 lg:col-span-4 space-y-6 lg:sticky lg:top-4 min-w-0">

          {/* 1. STUDENT IDENTITY & STATUS CARD */}
          <Card className="overflow-hidden border border-border bg-bg-elevated shadow-xs rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg border border-border bg-bg-surface flex items-center justify-center text-text shrink-0 shadow-2xs">
                  <Camera className="w-4 h-4 text-text" />
                </div>
                <h3 className="text-xs font-bold text-text uppercase tracking-tight">
                  {__( 'Student Identity', 'codeclove-school-management' )}
                </h3>
              </div>
              <Badge variant={currentStatus} size="sm" dot>
                {currentStatus.toUpperCase()}
              </Badge>
            </div>

            {/* Photo Upload Directly (Prominent, Centered & Modern) */}
            <div className="py-2">
              <AvatarUpload
                photoUrl={photoUrl}
                onPhotoChange={(id, url) => {
                  setValue('photo_id', id, { shouldDirty: true })
                  setPhotoUrl(url)
                }}
                disabled={isPending}
                size="xl"
                layout="vertical"
              />
            </div>

            {/* Status Selector in Edit Mode */}
            {mode === 'edit' && (
              <div className="pt-1">
                <FormSelect
                  name="status"
                  label={__( 'Status', 'codeclove-school-management' )}
                  disabled={isPending}
                  options={[
                    { value: 'active', label: __( 'Active', 'codeclove-school-management' ) },
                    { value: 'inactive', label: __( 'Inactive', 'codeclove-school-management' ) },
                    { value: 'graduated', label: __( 'Graduated', 'codeclove-school-management' ) },
                    { value: 'withdrawn', label: __( 'Withdrawn', 'codeclove-school-management' ) },
                  ]}
                />
              </div>
            )}

            {/* Student Identifiers Clean Display (No Nested Card) */}
            {initialData?.student_number && (
              <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                <span>{sprintf( __( '%s Number:', 'codeclove-school-management' ), studentLabelSingular )}</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-text">{initialData.student_number}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (initialData.student_number) {
                        navigator.clipboard?.writeText(initialData.student_number)
                      }
                    }}
                    className="text-text-muted hover:text-brand transition-colors p-1 cursor-pointer"
                    title={__( 'Copy', 'codeclove-school-management' )}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* 2. ACADEMIC PLACEMENT & ENROLLMENT CARD */}
          <Card className="overflow-hidden border border-border bg-bg-elevated shadow-xs rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg border border-border bg-bg-surface flex items-center justify-center text-text shrink-0 shadow-2xs">
                  <GraduationCap className="w-4 h-4 text-text" />
                </div>
                <h3 className="text-xs font-bold text-text uppercase tracking-tight">
                  {__( 'Academic Placement', 'codeclove-school-management' )}
                </h3>
              </div>
              {session && (
                <span className="text-3xs font-mono text-text-muted bg-bg-surface px-2.5 py-0.5 rounded-full border border-border/70 shrink-0">
                  {session.label}
                </span>
              )}
            </div>

            {/* Class Level (Academic Unit) & Section (Academic Group) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3 items-start">
              <FormSelect
                name="academic_unit_id"
                label={unitLabelSingular}
                required
                searchable
                disabled={isPending}
                placeholder={sprintf( __( 'Select %s...', 'codeclove-school-management' ), unitLabelSingular.toLowerCase() )}
                searchPlaceholder={sprintf( __( 'Search %s...', 'codeclove-school-management' ), unitLabelSingular.toLowerCase() )}
                emptyText={sprintf( __( 'No %s found.', 'codeclove-school-management' ), unitLabelPlural.toLowerCase() )}
                options={units.map((u) => ({ value: String(u.id), label: u.name }))}
                onValueChange={() => {
                  setValue('academic_group_id', '', { shouldDirty: true })
                }}
              />

              <FormSelect
                name="academic_group_id"
                label={
                  <span className="flex items-center justify-between w-full">
                    <span>{groupLabelSingular}</span>
                    {selectedGroup && (
                      <span className={cn(
                        'text-3xs font-mono font-medium',
                        isOverCapacity ? 'text-danger font-semibold' : 'text-text-subtle'
                      )}>
                        {groupMockCount}/{groupCapacity}
                      </span>
                    )}
                  </span>
                }
                searchable
                disabled={!activeUnit || isPending}
                placeholder={
                  !activeUnit
                    ? sprintf( __( 'Select %s first', 'codeclove-school-management' ), unitLabelSingular.toLowerCase() )
                    : sprintf( __( 'Assign %s...', 'codeclove-school-management' ), groupLabelSingular.toLowerCase() )
                }
                searchPlaceholder={sprintf( __( 'Search %s...', 'codeclove-school-management' ), groupLabelSingular.toLowerCase() )}
                emptyText={sprintf( __( 'No %s found.', 'codeclove-school-management' ), groupLabelPlural.toLowerCase() )}
                options={sectionOptions}
              />
            </div>

            {isOverCapacity && (
              <Alert variant="warning" title={__( 'Capacity Alert', 'codeclove-school-management' )} className="py-1 px-2 text-2xs">
                {sprintf(
                  __( 'Selected %1$s is full (%2$d/%3$d). Limit will be overridden.', 'codeclove-school-management' ),
                  groupLabelSingular.toLowerCase(),
                  groupMockCount,
                  groupCapacity
                )}
              </Alert>
            )}

            {/* Admission Date & Graduation Cohort Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <FormDatePicker
                name="admission_date"
                label={__( 'Admission Date', 'codeclove-school-management' )}
                required
                clearable={false}
                disabled={isPending}
              />

              <FormInput
                name="graduation_year"
                type="number"
                label={__( 'Graduation Year', 'codeclove-school-management' )}
                placeholder={__( 'e.g. 2030', 'codeclove-school-management' )}
                disabled={isPending}
                inputClassName="h-8 text-sm tabular-nums"
              />
            </div>

            {/* Admission ID / Number */}
            {mode === 'admit' ? (
              <div className="pt-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-3xs font-semibold uppercase tracking-wider text-text-subtle">
                    {__( 'Admission Identifier', 'codeclove-school-management' )}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !autoGenerateAdm
                      setValue('auto_generate_admission', nextVal, { shouldValidate: true, shouldDirty: true })
                      if (nextVal) {
                        setValue('admission_number', '', { shouldValidate: true, shouldDirty: true })
                      }
                    }}
                    disabled={isPending}
                    className="text-3xs font-medium text-brand hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {autoGenerateAdm
                      ? __( 'Manual ID', 'codeclove-school-management' )
                      : __( 'Auto-assign', 'codeclove-school-management' )}
                  </button>
                </div>

                {autoGenerateAdm ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-bg-surface border border-border/80 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="font-mono text-xs font-semibold text-text tracking-wider tabular-nums">
                        {formatIdPreview(settings?.identifiers?.admission_number, nextAdmissionNum)}
                      </span>
                    </div>
                    <span className="text-3xs text-text-subtle font-medium bg-bg-elevated px-2 py-0.5 rounded-md border border-border/50">
                      {__( 'Auto-assigned', 'codeclove-school-management' )}
                    </span>
                  </div>
                ) : (
                  <FormInput
                    name="admission_number"
                    aria-label={__( 'Admission ID', 'codeclove-school-management' )}
                    placeholder={__( 'e.g. ADM-2026-0099', 'codeclove-school-management' )}
                    inputClassName="h-8 font-mono text-xs"
                    disabled={isPending}
                    autoFocus
                  />
                )}
              </div>
            ) : (
              <div className="pt-1">
                <FormInput
                  name="admission_number"
                  label={__( 'Admission ID', 'codeclove-school-management' )}
                  required
                  placeholder={__( 'e.g. ADM-2026-0099', 'codeclove-school-management' )}
                  inputClassName="h-8 font-mono text-xs tracking-wide"
                  disabled={isPending}
                />
              </div>
            )}
          </Card>

        </div>

      </div>

    </Form>
  )
}
