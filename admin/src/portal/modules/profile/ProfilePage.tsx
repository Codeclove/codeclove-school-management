/**
 * Portal Profile Page.
 *
 * Student & family profile for parent and student self-service.
 * Focused on official record verification, authorized guardian status,
 * health profile verification, and direct access to school administration.
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Copy,
  GraduationCap,
  IdCard,
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
import { calculateAge, formatAddress, formatDate, formatGender, getInitials } from '../../lib/formatter'
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Spinner,
} from '@/components/ui'
import { StudentIdCardSection } from '@/components/print'
import { SegmentedTabs } from '../../components/SegmentedTabs'
import { __, _n, sprintf } from '@/lib/i18n'
import { cn } from '@/lib/utils'

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
const CopyBtn: React.FC<{ text?: string; label: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false)
  if (!text) return null
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      className="p-1 rounded text-text-subtle hover:text-brand hover:bg-bg-surface transition-colors cursor-pointer shrink-0"
      title={label}
      aria-label={label}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

export const ProfilePage: React.FC = () => {
  const { currentStudent, school } = usePortal()
  const { getLabel } = usePortalLabels()
  const [activeTab, setActiveTab] = useState<'profile' | 'idcard'>('profile')
  const { data: profileData, isLoading } = useProfile(currentStudent?.id)
  const updateProfileMutation = useUpdateProfile()
  const student = profileData?.student ?? currentStudent
  const guardians = useMemo(() => profileData?.guardians ?? [], [profileData?.guardians])
  // Contact edit mode state
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [formData, setFormData] = useState<ContactFormData>({
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
      const addr =
        typeof student.address === 'object' && student.address !== null
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
    const addr =
      typeof student?.address === 'object' && student?.address !== null
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
      address:
        typeof student?.address === 'string'
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

  const admNumber = student?.admission_number ? String(student.admission_number).trim() : ''
  const stuNumber = student?.student_number ? String(student.student_number).trim() : ''
  const hasDistinctStudentNumber = Boolean(stuNumber) && stuNumber !== admNumber
  const age = calculateAge(student?.date_of_birth)

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header Bar */}
      <PageHeader
        title={sprintf(
          __( '%s Profile', 'codeclove-school-management' ),
          getLabel('student', false, __( 'Student', 'codeclove-school-management' ))
        )}
        description={__( 'Academic enrollment, verified records, and family directory', 'codeclove-school-management' )}
      />

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-lg border text-xs transition-all ${
            feedback.type === 'success'
              ? 'bg-success-dim border border-success text-success'
              : 'bg-danger-dim border border-danger text-danger'
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

      {/* Unified Student Identity Card with Docked Subtabs */}
      <Card className="overflow-hidden border border-border shadow-xs">
        <div className="p-6 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Student Avatar / Photo & Primary Meta */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0">
              {student?.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.full_name}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2 border-border shadow-xs shrink-0 ring-4 ring-bg-surface"
                />
              ) : (
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-full bg-brand-dim text-brand text-xl sm:text-2xl font-bold border-2 border-brand-border shadow-xs ring-4 ring-bg-surface">
                  {getInitials(student?.full_name)}
                </div>
              )}

              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text truncate">
                    {student?.full_name}
                  </h2>
                  <Badge variant="active" size="sm">
                    {student?.status || __( 'Active Enrollment', 'codeclove-school-management' )}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-text-muted flex-wrap">
                  <span className="font-semibold text-text">{className}</span>
                  <span className="text-text-subtle">•</span>
                  <span>{sessionName}</span>
                  {student?.roll_number && (
                    <>
                      <span className="text-text-subtle">•</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-bg-surface text-text border border-border font-mono">
                        {sprintf( __( 'Roll #%s', 'codeclove-school-management' ), student.roll_number )}
                      </span>
                    </>
                  )}
                </div>

                {/* Identifier Chips with One-Click Copy */}
                <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
                  {admNumber && (
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-bg-surface px-2.5 py-1 text-2xs font-medium text-text border border-border shadow-2xs">
                      <span className="text-text-subtle uppercase tracking-wider text-3xs font-bold">
                        {__( 'Adm', 'codeclove-school-management' )}
                      </span>
                      <span className="font-mono font-semibold text-text">{admNumber}</span>
                      <CopyBtn text={admNumber} label={__( 'Copy Admission Number', 'codeclove-school-management' )} />
                    </div>
                  )}

                  {hasDistinctStudentNumber && (
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-bg-surface px-2.5 py-1 text-2xs font-medium text-text border border-border shadow-2xs">
                      <span className="text-text-subtle uppercase tracking-wider text-3xs font-bold">
                        {__( 'ID', 'codeclove-school-management' )}
                      </span>
                      <span className="font-mono font-semibold text-text">{stuNumber}</span>
                      <CopyBtn text={stuNumber} label={__( 'Copy Student ID', 'codeclove-school-management' )} />
                    </div>
                  )}

                  {student?.admission_date && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-bg-surface px-2.5 py-1 text-2xs font-medium text-text-muted border border-border shadow-2xs">
                      <span className="text-text-subtle uppercase tracking-wider text-3xs font-bold">
                        {__( 'Enrolled', 'codeclove-school-management' )}
                      </span>
                      <span className="font-semibold text-text font-mono">{formatDate(student.admission_date)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Docked Subtabs Navigation Bar */}
        <div className="border-t border-border bg-bg-surface/50 px-6 py-2.5 flex items-center justify-between gap-3">
          <SegmentedTabs<'profile' | 'idcard'>
            ariaLabel={__( 'Profile views', 'codeclove-school-management' )}
            activeTab={activeTab}
            onChange={setActiveTab}
            size="sm"
            tabs={[
              { id: 'profile', label: __( 'Profile Details', 'codeclove-school-management' ), icon: User },
              { id: 'idcard', label: __( 'Identity Card', 'codeclove-school-management' ), icon: IdCard },
            ]}
          />
          <p className="text-2xs text-text-subtle hidden sm:block">
            {activeTab === 'profile'
              ? __( 'Academic enrollment, verified records, and family directory', 'codeclove-school-management' )
              : __( 'Official printable student identity card', 'codeclove-school-management' )}
          </p>
        </div>
      </Card>

      {/* Main Tab Panels */}
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
          {/* Balanced 12-Column Grid (7 cols / 5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (7 cols): Academic Demographics & Self-Service Contact */}
            <div className="lg:col-span-7 space-y-6">
              {/* Card 1: Official Academic & Institutional Demographics */}
              <Card className="p-6 space-y-5">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-surface border border-border text-text">
                      <GraduationCap className="h-4.5 w-4.5 text-text-muted" />
                    </div>
                    <h3 className="text-base font-semibold text-text leading-tight">
                      {__( 'Academic & Institutional Record', 'codeclove-school-management' )}
                    </h3>
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-text-muted bg-bg-surface px-2.5 py-1 rounded-md border border-border shrink-0 whitespace-nowrap">
                    <Lock className="w-3 h-3 text-text-subtle shrink-0" />
                    <span>{__( 'Official Record', 'codeclove-school-management' )}</span>
                  </span>
                </div>

                {/* 3-Column Balanced Definition Grid: No Text Truncations */}
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 text-xs">
                  <div className="space-y-1">
                    <dt className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                      {getLabel('academic_unit', false, __( 'Class', 'codeclove-school-management' ))} & {getLabel('academic_group', false, __( 'Section', 'codeclove-school-management' ))}
                    </dt>
                    <dd className="text-sm font-semibold text-text">
                      {className}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                      {__( 'Academic Session', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text">
                      {sessionName}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                      {__( 'Enrollment Status', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text">
                      <Badge variant="active" size="sm">
                        {student?.status || __( 'Active', 'codeclove-school-management' )}
                      </Badge>
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                      {__( 'Roll Number', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text font-mono">
                      {student?.roll_number ? `#${student.roll_number}` : '—'}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                      {__( 'Admission No', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text font-mono">
                      {admNumber || '—'}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                      {__( 'Enrollment Date', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text font-mono">
                      {student?.admission_date ? formatDate(student.admission_date) : '—'}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                      {__( 'Date of Birth', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text">
                      {student?.date_of_birth ? (
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="whitespace-nowrap font-mono">{formatDate(student.date_of_birth)}</span>
                          {age !== null && (
                            <span className="text-text-subtle text-xs font-normal whitespace-nowrap">
                              ({sprintf( __( '%d yrs', 'codeclove-school-management' ), age )})
                            </span>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                      {__( 'Gender', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text capitalize">
                      {formatGender(student?.gender)}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                      {__( 'Blood Group', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text">
                      {student?.blood_group ? (
                        <Badge variant="danger" size="xs">{student.blood_group}</Badge>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="pt-3 border-t border-border/60 flex items-center gap-2 text-2xs text-text-subtle">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-text-subtle" />
                  <span>
                    {__( 'Official records are verified by the school administration. To request updates, please contact the registrar.', 'codeclove-school-management' )}
                  </span>
                </div>
              </Card>

              {/* Card 2: Contact Channels & Residence (Self-Service Editable) */}
              <Card className="p-6 space-y-5">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-surface border border-border text-text">
                      <MapPin className="h-4.5 w-4.5 text-text-muted" />
                    </div>
                    <h3 className="text-base font-semibold text-text leading-tight">
                      {__( 'Contact & Address', 'codeclove-school-management' )}
                    </h3>
                  </div>

                  {/* Edit Toggle Button */}
                  {!isEditingContact ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsEditingContact(true)}
                      className="print:hidden h-8 text-xs font-semibold shrink-0 whitespace-nowrap gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5 text-text-subtle" />
                      <span>{__( 'Edit Contact', 'codeclove-school-management' )}</span>
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingContact(false)}
                      className="h-8 text-xs shrink-0 whitespace-nowrap gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{__( 'Cancel', 'codeclove-school-management' )}</span>
                    </Button>
                  )}
                </div>

                {/* View Mode: Unconstrained Full-Row Layout to Prevent Any Email/Address Truncation */}
                {!isEditingContact ? (
                  <div className="space-y-4 text-xs">
                    {/* Residential Address */}
                    <div className="space-y-1">
                      <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                        {__( 'Residential Address', 'codeclove-school-management' )}
                      </span>
                      <p className="text-sm font-medium text-text leading-relaxed">
                        {formatAddress(student?.address)}
                      </p>
                    </div>

                    <div className="border-t border-border/60 pt-4 space-y-3.5">
                      {/* Email Address with Copy Utility */}
                      <div className="space-y-1">
                        <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                          {__( 'Email Address', 'codeclove-school-management' )}
                        </span>
                        {student?.email ? (
                          <div className="flex items-center gap-2">
                            <a href={`mailto:${student.email}`} className="text-sm font-medium text-text font-mono hover:text-brand hover:underline break-all" title={student.email}>
                              {student.email}
                            </a>
                            <CopyBtn text={student.email} label={__( 'Copy Email Address', 'codeclove-school-management' )} />
                          </div>
                        ) : (
                          <span className="text-sm text-text-subtle block">{__( 'Not provided', 'codeclove-school-management' )}</span>
                        )}
                      </div>

                      {/* Phone Number with Copy Utility */}
                      <div className="space-y-1">
                        <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                          {__( 'Phone Number', 'codeclove-school-management' )}
                        </span>
                        {student?.phone ? (
                          <div className="flex items-center gap-2">
                            <a href={`tel:${student.phone}`} className="text-sm font-semibold text-text font-mono hover:text-brand hover:underline">
                              {student.phone}
                            </a>
                            <CopyBtn text={student.phone} label={__( 'Copy Phone Number', 'codeclove-school-management' )} />
                          </div>
                        ) : (
                          <span className="text-sm text-text-subtle block">{__( 'Not provided', 'codeclove-school-management' )}</span>
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

            {/* Right Column (5 cols): Household & Guardians + School Support (Fills the Void) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Card 1: Family & Guardians Directory (Concise Title, No Truncation) */}
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-surface border border-border text-text">
                      <Users className="h-4.5 w-4.5 text-text-muted" />
                    </div>
                    <h3 className="text-base font-semibold text-text leading-tight">
                      {__( 'Family & Guardians', 'codeclove-school-management' )}
                    </h3>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-bg-surface text-text-muted border border-border shrink-0 whitespace-nowrap">
                    {sprintf(
                      _n( '%d Guardian', '%d Guardians', guardians.length, 'codeclove-school-management' ),
                      guardians.length
                    )}
                  </span>
                </div>

                {guardians.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-bg-surface p-6 text-center space-y-1">
                    <User className="mx-auto h-6 w-6 text-text-subtle" />
                    <p className="text-xs font-semibold text-text">{__( 'No guardian records linked', 'codeclove-school-management' )}</p>
                    <p className="text-3xs text-text-subtle max-w-xs mx-auto">
                      {__( 'Contact school administration to link authorized guardian profiles.', 'codeclove-school-management' )}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {guardians.map((guardian, idx) => {
                      const gFullName =
                        guardian.full_name ||
                        [guardian.first_name, guardian.last_name].filter(Boolean).join(' ') ||
                        __( 'Authorized Guardian', 'codeclove-school-management' )

                      const subtitle = [guardian.relationship, guardian.occupation].filter(Boolean).join(' • ')

                      return (
                        <div
                          key={guardian.id}
                          className={cn(
                            'space-y-2.5',
                            idx === 0 ? 'pb-4' : 'py-4',
                            idx === guardians.length - 1 ? 'pb-0' : ''
                          )}
                        >
                          {/* Guardian Name, Authorization Badges & Relationship */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-text leading-snug break-words">
                                {gFullName}
                              </p>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {guardian.is_primary && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-success-dim text-success border border-success-border whitespace-nowrap">
                                    {__( 'Primary Guardian', 'codeclove-school-management' )}
                                  </span>
                                )}
                                {guardian.is_emergency_contact && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-warning-dim text-warning border border-warning-border whitespace-nowrap">
                                    {__( 'Emergency Pick-Up', 'codeclove-school-management' )}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-2xs font-medium text-text-muted capitalize">
                              {subtitle || __( 'Guardian', 'codeclove-school-management' )}
                            </p>
                          </div>

                          {/* Verified Contact Records on File (Informational Verification) */}
                          {(guardian.phone || guardian.email) && (
                            <div className="space-y-1.5 pt-0.5 text-xs">
                              {guardian.phone && (
                                <div className="flex items-center justify-between gap-3 min-w-0 bg-bg-surface/50 rounded-md px-2.5 py-1.5 border border-border/70">
                                  <a href={`tel:${guardian.phone}`} className="text-text-muted hover:text-brand flex items-center gap-2 font-mono text-xs truncate min-w-0">
                                    <Phone className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                                    <span className="truncate">{guardian.phone}</span>
                                  </a>
                                  <CopyBtn text={guardian.phone} label={__( 'Copy Phone Number', 'codeclove-school-management' )} />
                                </div>
                              )}

                              {guardian.email && (
                                <div className="flex items-center justify-between gap-3 min-w-0 bg-bg-surface/50 rounded-md px-2.5 py-1.5 border border-border/70">
                                  <a href={`mailto:${guardian.email}`} className="text-text-muted hover:text-brand flex items-center gap-2 text-xs truncate min-w-0">
                                    <Mail className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                                    <span className="truncate" title={guardian.email}>{guardian.email}</span>
                                  </a>
                                  <CopyBtn text={guardian.email} label={__( 'Copy Email Address', 'codeclove-school-management' )} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="pt-2 border-t border-border/60 text-2xs text-text-subtle flex items-center gap-1.5">
                  <Lock className="w-3 h-3 shrink-0 text-text-subtle" />
                  <span>{__( 'To modify authorized pick-up permissions or link new guardians, contact administration.', 'codeclove-school-management' )}</span>
                </div>
              </Card>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
