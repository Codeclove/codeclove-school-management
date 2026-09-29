/**
 * Portal Profile Page.
 *
 * Student & family profile using shared CodeClove design system primitives.
 * High-end SaaS layout utilizing a balanced 12-column master grid, clean definition
 * baselines, and clear distinction between locked institutional records and self-service
 * editable contact details.
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  IdCard,
  Info,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  User,
  Users,
  X,
} from 'lucide-react'
import { usePortal } from '../../lib/portal-context'
import { usePortalLabels } from '../../lib/labels'
import { useProfile, useUpdateProfile } from '../../api/portal'
import { formatAddress, formatDate, formatGender, getInitials } from '../../lib/formatter'
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Spinner,
} from '@/components/ui'
import { StudentIdCardSection } from '@/components/print'
import { cn } from '@/lib/utils'
import { __, _n, sprintf } from '@/lib/i18n'

interface ContactFormData {
  phone: string
  email: string
  address: string
  city: string
  state: string
  postal_code: string
  country: string
}

const CONTACT_FIELDS: Array<{
  name: keyof ContactFormData
  label: string
  placeholder: string
  type?: string
  span?: boolean
}> = [
  { name: 'phone', label: __( 'Phone Number', 'codeclove-school-management' ), placeholder: '+1 (555) 000-0000', type: 'tel' },
  { name: 'email', label: __( 'Email Address', 'codeclove-school-management' ), placeholder: 'student@example.com', type: 'email' },
  { name: 'address', label: __( 'Street Address', 'codeclove-school-management' ), placeholder: __( 'Street name, building, apartment', 'codeclove-school-management' ), span: true },
  { name: 'city', label: __( 'City', 'codeclove-school-management' ), placeholder: __( 'City', 'codeclove-school-management' ) },
  { name: 'state', label: __( 'State / Province', 'codeclove-school-management' ), placeholder: __( 'State / Province', 'codeclove-school-management' ) },
  { name: 'postal_code', label: __( 'Postal / ZIP Code', 'codeclove-school-management' ), placeholder: __( 'Postal Code', 'codeclove-school-management' ) },
  { name: 'country', label: __( 'Country Code', 'codeclove-school-management' ), placeholder: __( 'e.g. IN, US, GB', 'codeclove-school-management' ) },
]

export const ProfilePage: React.FC = () => {
  const { currentStudent, school } = usePortal()
  const { getLabel } = usePortalLabels()
  const [activeTab, setActiveTab] = useState<'profile' | 'idcard'>('profile')
  const { data: profileData, isLoading } = useProfile(currentStudent?.id)
  const updateProfileMutation = useUpdateProfile()
  const student = profileData?.student ?? currentStudent
  const guardians = profileData?.guardians ?? []

  // Contact edit mode state
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  })
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Populate form with current values
  useEffect(() => {
    if (student) {
      const addr = typeof student.address === 'object' && student.address !== null
        ? (student.address as Record<string, string>)
        : null
      setFormData({
        phone: student.phone || '',
        email: student.email || '',
        address: addr?.address || addr?.address_line1 || (typeof student.address === 'string' ? student.address : ''),
        city: addr?.city || '',
        state: addr?.state || '',
        postal_code: addr?.postal_code || addr?.zip || '',
        country: addr?.country || '',
      })
    }
  }, [student, isEditingContact])

  const printableStudent = useMemo(() => {
    const addr = typeof student?.address === 'object' && student?.address !== null
      ? student.address
      : null
    return {
      id: student?.id ?? currentStudent?.id ?? 0,
      first_name: student?.first_name || '',
      middle_name: student?.middle_name,
      last_name: student?.last_name || '',
      student_number: student?.student_number || '',
      admission_number: student?.admission_number,
      date_of_birth: student?.date_of_birth,
      blood_group: student?.blood_group,
      photo_url: student?.photo_url,
      address: typeof student?.address === 'string'
        ? student.address
        : addr?.address_line1 || addr?.address || '',
      city: addr?.city,
      guardian: guardians[0]
        ? {
            first_name: guardians[0].first_name,
            last_name: guardians[0].last_name,
            phone: guardians[0].phone,
            email: guardians[0].email,
          }
        : null,
      enrollment: {
        roll_number: student?.roll_number ?? student?.enrollment?.roll_number,
      },
    }
  }, [student, currentStudent, guardians])

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentStudent?.id) return

    setFeedback(null)
    try {
      await updateProfileMutation.mutateAsync({
        studentId: currentStudent.id,
        payload: {
          phone: formData.phone,
          email: formData.email,
          address: {
            address: formData.address,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postal_code,
            country: formData.country,
          },
        },
      })
      setFeedback({ type: 'success', message: __( 'Contact information updated successfully.', 'codeclove-school-management' ) })
      setIsEditingContact(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : __( 'Failed to update contact details. Please try again.', 'codeclove-school-management' )
      setFeedback({ type: 'error', message: msg })
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-medium text-text-muted">{__( 'Loading student profile…', 'codeclove-school-management' )}</p>
      </div>
    )
  }

  const className =
    [student?.unit_name, student?.group_name].filter(Boolean).join(' • ') || __( 'Enrolled Student', 'codeclove-school-management' )
  const sessionName =
    student?.enrollment?.session_name ||
    student?.session_name ||
    getLabel('academic_session', false, __( 'Academic Session', 'codeclove-school-management' ))
  return (
    <div className="space-y-6 pb-12">
      {/* Page Header Bar */}
      <PageHeader
        title={sprintf(
          __( '%s Profile', 'codeclove-school-management' ),
          getLabel('student', false, __( 'Student', 'codeclove-school-management' ))
        )}
        description={__( 'Personal info, academic enrollment, and family contacts', 'codeclove-school-management' )}
      />

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-lg border text-xs transition-all ${
            feedback.type === 'success'
              ? 'bg-success/5 border-success/30 text-success'
              : 'bg-danger/5 border-danger/30 text-danger'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            ) : (
              <X className="w-4 h-4 text-danger shrink-0" />
            )}
            <span className="font-medium text-text">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Student Identity Overview Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Student Avatar / Photo */}
            {student?.photo_url ? (
              <img
                src={student.photo_url}
                alt={student.full_name}
                className="h-20 w-20 rounded-full object-cover border-2 border-border shadow-xs shrink-0"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-dim text-brand text-2xl font-black border-2 border-brand/20">
                {getInitials(student?.full_name)}
              </div>
            )}

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-text truncate">
                  {student?.full_name}
                </h3>
                <Badge variant="active" size="sm">
                  {student?.status || __( 'Active Enrollment', 'codeclove-school-management' )}
                </Badge>
              </div>

              <p className="text-sm font-semibold text-text-muted flex items-center gap-2 flex-wrap">
                <span>{className}</span>
                <span className="text-text-subtle">•</span>
                <span>{sessionName}</span>
                {student?.roll_number && (
                  <>
                    <span className="text-text-subtle">•</span>
                    <span className="text-brand font-mono font-bold">
                      {sprintf( __( 'Roll #%s', 'codeclove-school-management' ), student.roll_number )}
                    </span>
                  </>
                )}
              </p>

              {/* Identifier Pills */}
              <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
                {student?.admission_number && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-bg-base px-2.5 py-1 font-mono font-semibold text-text border border-border text-2xs">
                    <span className="text-text-subtle font-sans text-3xs uppercase tracking-wider">{__( 'Adm', 'codeclove-school-management' )}</span>
                    <span>{student.admission_number}</span>
                  </span>
                )}
                {student?.student_number && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-bg-base px-2.5 py-1 font-mono font-semibold text-text border border-border text-2xs">
                    <span className="text-text-subtle font-sans text-3xs uppercase tracking-wider">{__( 'ID', 'codeclove-school-management' )}</span>
                    <span>{student.student_number}</span>
                  </span>
                )}
                {student?.admission_date && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-bg-base px-2.5 py-1 text-text-muted border border-border text-2xs">
                    <span className="text-text-subtle text-3xs uppercase tracking-wider">{__( 'Enrolled', 'codeclove-school-management' )}</span>
                    <span>{formatDate(student.admission_date)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Profile Subtabs (Details vs Identity Card) — Segmented Capsule Track */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label={__( 'Profile views', 'codeclove-school-management' )}
          className="inline-flex items-center bg-bg-base/80 border border-border/80 rounded-xl p-1 gap-1 max-w-full overflow-x-auto shadow-2xs w-fit"
        >
          {[
            { id: 'profile', label: __( 'Profile Details', 'codeclove-school-management' ), icon: User },
            { id: 'idcard', label: __( 'Identity Card', 'codeclove-school-management' ), icon: IdCard },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id as 'profile' | 'idcard')}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none outline-none whitespace-nowrap',
                  isActive
                    ? 'bg-bg-surface text-brand font-bold shadow-xs'
                    : 'text-text-muted hover:text-text hover:bg-bg-surface/50'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isActive ? 'text-brand' : 'text-text-subtle'
                  )}
                />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-text-subtle font-medium">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand/50" />
          <span>
            {activeTab === 'profile'
              ? __( 'Official institutional and family record', 'codeclove-school-management' )
              : __( 'CR80 standard identity badge preview & print', 'codeclove-school-management' )}
          </span>
        </div>
      </div>

      {activeTab === 'idcard' ? (
        <Card
          role="tabpanel"
          id="panel-idcard"
          aria-labelledby="tab-idcard"
          className="p-6"
        >
          <StudentIdCardSection
            student={printableStudent}
            unitName={student?.unit_name}
            groupName={student?.group_name}
            unitLabel={getLabel('academic_unit', false, __( 'Class', 'codeclove-school-management' ))}
            groupLabel={getLabel('academic_group', false, __( 'Section', 'codeclove-school-management' ))}
            rollNumber={student?.roll_number ?? student?.enrollment?.roll_number}
            school={school}
            sessionLabel={sessionName}
            formatDate={formatDate}
          />
        </Card>
      ) : (
        <div role="tabpanel" id="panel-profile" aria-labelledby="tab-profile">
          {/* 12-Column Balanced Master Grid (7 cols / 5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (7 cols): Personal Details & Contact */}
            <div className="lg:col-span-7 space-y-6">
              {/* Section: Personal Demographics (Verified Identity) */}
              <Card className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-dim text-info">
                      <User className="h-5 w-5" />
                    </div>
                    <h4 className="text-base font-bold text-text leading-tight">
                      {__( 'Personal Information', 'codeclove-school-management' )}
                    </h4>
                  </div>

                  <Badge variant="default" size="sm" className="gap-1">
                    <Lock className="w-3 h-3 text-text-subtle" />
                    <span>{__( 'Verified Record', 'codeclove-school-management' )}</span>
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 text-xs">
                  <div className="border-b border-border/60 pb-3 sm:border-b-0 sm:pb-0">
                    <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                      {__( 'Date of Birth', 'codeclove-school-management' )}
                    </span>
                    <p className="text-sm font-semibold text-text mt-1">
                      {student?.date_of_birth ? formatDate(student.date_of_birth) : '—'}
                    </p>
                  </div>

                  <div className="border-b border-border/60 pb-3 sm:border-b-0 sm:pb-0">
                    <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                      {__( 'Gender', 'codeclove-school-management' )}
                    </span>
                    <p className="text-sm font-semibold text-text mt-1">
                      {formatGender(student?.gender)}
                    </p>
                  </div>

                  <div>
                    <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                      {__( 'Record Status', 'codeclove-school-management' )}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      <span className="text-sm font-semibold text-text">
                        {__( 'Institutional File', 'codeclove-school-management' )}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Section: Contact & Residence (Self-Service Editable) */}
              <Card className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-dim text-warning">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <h4 className="text-base font-bold text-text leading-tight">
                      {__( 'Contact & Address', 'codeclove-school-management' )}
                    </h4>
                  </div>

                  {/* Edit Toggle Button */}
                  {!isEditingContact ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsEditingContact(true)}
                      className="print:hidden h-8 text-xs font-semibold"
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1 text-text-subtle" />
                      <span>{__( 'Edit Contact', 'codeclove-school-management' )}</span>
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingContact(false)}
                      className="h-8 text-xs"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      <span>{__( 'Cancel', 'codeclove-school-management' )}</span>
                    </Button>
                  )}
                </div>

                {/* View Mode */}
                {!isEditingContact ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                    {/* Residential Address Box */}
                    <div className="space-y-2">
                      <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                        {__( 'Address', 'codeclove-school-management' )}
                      </span>
                      <p className="text-sm font-medium text-text leading-relaxed">
                        {formatAddress(student?.address)}
                      </p>
                    </div>

                    {/* Direct Communication Channels */}
                    <div className="space-y-4">
                      <div>
                        <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                          {__( 'Email', 'codeclove-school-management' )}
                        </span>
                        {student?.email ? (
                          <a
                            href={`mailto:${student.email}`}
                            className="text-sm font-semibold text-brand hover:underline block mt-1"
                          >
                            {student.email}
                          </a>
                        ) : (
                          <span className="text-sm text-text-subtle block mt-1">{__( 'Not provided', 'codeclove-school-management' )}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                          {__( 'Phone', 'codeclove-school-management' )}
                        </span>
                        {student?.phone ? (
                          <a
                            href={`tel:${student.phone}`}
                            className="text-sm font-semibold text-text hover:text-brand font-mono transition-colors block mt-1"
                          >
                            {student.phone}
                          </a>
                        ) : (
                          <span className="text-sm text-text-subtle block mt-1">{__( 'Not provided', 'codeclove-school-management' )}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Inline Edit Mode Form */
                  <form onSubmit={handleSaveContact} className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {CONTACT_FIELDS.map((f) => {
                        const inputId = `contact-field-${f.name}`
                        return (
                          <div key={f.name} className={f.span ? 'sm:col-span-2' : undefined}>
                            <label
                              htmlFor={inputId}
                              className="text-3xs font-bold uppercase tracking-wider text-text-muted block mb-1"
                            >
                              {f.label}
                            </label>
                            <input
                              id={inputId}
                              type={f.type || 'text'}
                              value={formData[f.name]}
                              onChange={(e) => setFormData((prev) => ({ ...prev, [f.name]: e.target.value }))}
                              placeholder={f.placeholder}
                              className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                            />
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsEditingContact(false)}
                      >
                        {__( 'Cancel', 'codeclove-school-management' )}
                      </Button>

                      <Button
                        type="submit"
                        variant="default"
                        size="sm"
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending && <Spinner size="xs" className="mr-1.5" />}
                        <span>{__( 'Save Changes', 'codeclove-school-management' )}</span>
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
            </div>

            {/* Right Column (5 cols): Family, Guardians & Registrar Policy */}
            <div className="lg:col-span-5 space-y-6">
              {/* Family & Authorized Guardians Card */}
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-dim text-success">
                      <Users className="h-4.5 w-4.5" />
                    </div>
                    <h4 className="text-base font-bold text-text">
                      {__( 'Family Contacts', 'codeclove-school-management' )}
                    </h4>
                  </div>
                  <Badge variant="default" size="sm">
                    {sprintf(
                      _n( '%d Contact', '%d Contacts', guardians.length, 'codeclove-school-management' ),
                      guardians.length
                    )}
                  </Badge>
                </div>

                {guardians.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-bg-base/50 p-6 text-center space-y-1">
                    <User className="mx-auto h-6 w-6 text-text-subtle" />
                    <p className="text-xs font-semibold text-text">{__( 'No guardian records linked', 'codeclove-school-management' )}</p>
                    <p className="text-3xs text-text-subtle max-w-xs mx-auto">
                      {__( 'Contact school administration to link authorized guardian profiles.', 'codeclove-school-management' )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {guardians.map((guardian) => {
                      const gFullName =
                        guardian.full_name ||
                        [guardian.first_name, guardian.last_name].filter(Boolean).join(' ') ||
                        __( 'Authorized Guardian', 'codeclove-school-management' )

                      return (
                        <div
                          key={guardian.id}
                          className="rounded-lg border border-border bg-bg-base/40 p-4 space-y-3 hover:bg-bg-surface hover:border-border-strong hover:shadow-card transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-surface text-text text-xs font-bold border border-border">
                                {getInitials(gFullName)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-text leading-tight">
                                  {gFullName}
                                </p>
                                <p className="text-3xs font-semibold text-brand capitalize mt-0.5">
                                  {guardian.relationship || __( 'Guardian', 'codeclove-school-management' )}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {guardian.is_primary && (
                                <Badge variant="success" size="sm">
                                  {__( 'Primary', 'codeclove-school-management' )}
                                </Badge>
                              )}
                              {guardian.is_emergency_contact && (
                                <Badge variant="warning" size="sm">
                                  {__( 'Emergency', 'codeclove-school-management' )}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Direct action buttons */}
                          {(guardian.phone || guardian.email) && (
                            <div className="space-y-1.5 pt-2 border-t border-border/60 text-xs">
                              {guardian.phone && (
                                <a
                                  href={`tel:${guardian.phone}`}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-bg-surface text-text hover:text-brand hover:border-brand/40 font-mono text-xs font-medium transition-all shadow-xs"
                                  title={__( 'Call guardian', 'codeclove-school-management' )}
                                >
                                  <Phone className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                                  <span className="truncate">{guardian.phone}</span>
                                </a>
                              )}

                              {guardian.email && (
                                <a
                                  href={`mailto:${guardian.email}`}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-bg-surface text-text hover:text-brand hover:border-brand/40 text-xs font-medium transition-all shadow-xs"
                                  title={__( 'Email guardian', 'codeclove-school-management' )}
                                >
                                  <Mail className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                                  <span className="truncate text-xs">{guardian.email}</span>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>

              {/* Institutional Record Advisory */}
              {/* Record Update Note */}
              <Card className="border border-border bg-bg-base/60 p-5 space-y-1.5">
                <div className="flex items-center gap-2 text-text">
                  <Info className="w-4 h-4 text-brand shrink-0" />
                  <h5 className="text-xs font-bold">{__( 'Need to update locked records?', 'codeclove-school-management' )}</h5>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {__( 'To change official details like legal name, date of birth, or admission numbers, contact the school office.', 'codeclove-school-management' )}
                </p>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
