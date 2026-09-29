import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  User, ClipboardList, ArrowRight, Pencil, AlertTriangle
} from 'lucide-react'
import {
  useAdmissionDetails,
  useUpdateAdmissionStatus,
  type AdmissionApplication,
} from '@/api/students'
import {
  useSessions,
  useUnits,
} from '@/api/academics'
import { useSettings } from '@/api/settings'
import { useToast } from '@/lib/toast'
import {
  Button, Badge, Card,
  Select, PageHeader, EmptyState, FormGroupHeader, Skeleton
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { useFormatter, formatGender } from '@/lib/formatter'
import { useLabels } from '@/lib/labels'
import { __, sprintf } from '@/lib/i18n'

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<
  AdmissionApplication['status'],
  'default' | 'brand' | 'info' | 'success' | 'danger'
> = {
  inquiry:             'default',
  submitted:           'info',
  under_review:        'brand',
  more_info_needed:    'danger',
  interview_scheduled: 'brand',
  accepted:            'success',
  waitlisted:          'default',
  rejected:            'danger',
  admitted:            'success',
  withdrawn:           'default',
}

const getStatusLabels = (): Record<AdmissionApplication['status'], string> => ({
  inquiry:             __( 'Inquiry', 'codeclove-school-management' ),
  submitted:           __( 'Submitted', 'codeclove-school-management' ),
  under_review:        __( 'Under Review', 'codeclove-school-management' ),
  more_info_needed:    __( 'More Info Needed', 'codeclove-school-management' ),
  interview_scheduled: __( 'Interview Scheduled', 'codeclove-school-management' ),
  accepted:            __( 'Accepted', 'codeclove-school-management' ),
  waitlisted:          __( 'Waitlisted', 'codeclove-school-management' ),
  rejected:            __( 'Rejected', 'codeclove-school-management' ),
  admitted:            __( 'Admitted', 'codeclove-school-management' ),
  withdrawn:           __( 'Withdrawn', 'codeclove-school-management' ),
})

const TIMELINE_NODE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  inquiry:             { bg: 'bg-text-muted/20', border: 'border-text-muted/30', text: 'text-text-muted' },
  submitted:           { bg: 'bg-info/20',       border: 'border-info/30',       text: 'text-info' },
  under_review:        { bg: 'bg-brand/20',      border: 'border-brand/30',      text: 'text-brand' },
  more_info_needed:    { bg: 'bg-danger/20',     border: 'border-danger/30',     text: 'text-danger' },
  interview_scheduled: { bg: 'bg-brand/20',      border: 'border-brand/30',      text: 'text-brand' },
  accepted:            { bg: 'bg-success/20',    border: 'border-success/30',    text: 'text-success' },
  waitlisted:          { bg: 'bg-text-muted/20', border: 'border-text-muted/30', text: 'text-text-muted' },
  rejected:            { bg: 'bg-danger/20',     border: 'border-danger/30',     text: 'text-danger' },
  admitted:            { bg: 'bg-success/20',    border: 'border-success/30',    text: 'text-success' },
  withdrawn:           { bg: 'bg-text-muted/20', border: 'border-text-muted/30', text: 'text-text-muted' },
}

interface TimelineEvent {
  status: string
  title: string
  description: string
  timestamp: string
  actor: string
  completed: boolean
}

// ponytail: dynamic timeline builder from status_history
function getTimelineEvents(application: AdmissionApplication): TimelineEvent[] {
  const statusLabels = getStatusLabels()
  if (application.status_history && application.status_history.length > 0) {
    return application.status_history.map((evt) => {
      const statusLabel = statusLabels[evt.to_status as AdmissionApplication['status']] ?? evt.to_status
      let title = evt.reason || sprintf( __( 'Status changed to %s', 'codeclove-school-management' ), statusLabel )
      if (!evt.from_status && evt.to_status === 'submitted') {
        title = __( 'Application Submitted', 'codeclove-school-management' )
      }
      return {
        status: evt.to_status,
        title,
        description: evt.message || sprintf(
          __( 'Transitioned %1$sto %2$s.', 'codeclove-school-management' ),
          evt.from_status ? sprintf( __( 'from %s ', 'codeclove-school-management' ), statusLabels[evt.from_status as AdmissionApplication['status']] ?? evt.from_status ) : '',
          statusLabel
        ),
        timestamp: evt.changed_at,
        actor: evt.actor_name || __( 'System Auto', 'codeclove-school-management' ),
        completed: true,
      }
    })
  }

  const currentLabel = statusLabels[application.status] ?? application.status
  return [{
    status: application.status,
    title: sprintf( __( 'Application %s', 'codeclove-school-management' ), currentLabel ),
    description: sprintf( __( 'Current status is %s.', 'codeclove-school-management' ), currentLabel ),
    timestamp: application.submitted_at || application.created_at,
    actor: __( 'System Auto', 'codeclove-school-management' ),
    completed: true,
  }]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const applicationId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { formatDate, formatDateTime } = useFormatter()
  const { getLabel } = useLabels()
  const admissionLabelSingular = getLabel('admission_application', false, __( 'Admission Application', 'codeclove-school-management' ))
  const admissionLabelPlural = getLabel('admission_application', true, __( 'Admission Applications', 'codeclove-school-management' ))
  const studentLabelPlural = getLabel('student', true, __( 'Students', 'codeclove-school-management' ))
  const unitLabelSingular = getLabel('academic_unit', false, __( 'Class Level', 'codeclove-school-management' ))
  const guardianLabelSingular = getLabel('guardian', false, __( 'Guardian', 'codeclove-school-management' ))

  const { data: application, isLoading: isAppLoading, isError, refetch } = useAdmissionDetails(applicationId)
  const { data: settings } = useSettings()
  const { data: sessionData } = useSessions()
  const { data: unitData } = useUnits({ per_page: 200 })
  const updateStatusMutation = useUpdateAdmissionStatus()

  // Manage approved documents checklist locally
  const [approvedDocs, setApprovedDocs] = useState<Record<string, boolean>>({})

  const statusLabels = getStatusLabels()

  if (isAppLoading) {
    return (
      <div className="space-y-6 w-full">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !application) {
    return (
      <EmptyState
        title={sprintf( __( '%s not found', 'codeclove-school-management' ), admissionLabelSingular )}
        description={sprintf( __( 'The %s you are trying to view does not exist.', 'codeclove-school-management' ), admissionLabelSingular.toLowerCase() )}
        icon={AlertTriangle}
        action={<Button size="sm" onClick={() => navigate('/students/admissions')}>{__( 'Back to Admissions', 'codeclove-school-management' )}</Button>}
      />
    )
  }

  const requiredDocs = settings?.admissions?.required_documents ?? []
  const sessions = sessionData?.data ?? []
  const units = unitData?.data ?? []

  const matchedSession = sessions.find((s) => s.id === application.academic_session_id)
  const matchedUnit = units.find((u) => u.id === application.academic_unit_id)

  const handleStatusChange = (newStatus: AdmissionApplication['status']) => {
    updateStatusMutation.mutate(
      { id: application.id, status: newStatus },
      {
        onSuccess: () => {
          refetch()
          toast.success(sprintf( __( 'Status updated to %s', 'codeclove-school-management' ), statusLabels[newStatus] ?? newStatus ))
        },
        onError: () => {
          toast.error(__( 'Failed to update status.', 'codeclove-school-management' ))
        },
      }
    )
  }

  const toggleDoc = (doc: string) => {
    setApprovedDocs((prev) => ({
      ...prev,
      [doc]: !prev[doc],
    }))
  }

  const statusLabel = statusLabels[application.status] ?? application.status
  const statusVariant = STATUS_VARIANTS[application.status] ?? 'default'

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title={sprintf( __( '%s Details', 'codeclove-school-management' ), admissionLabelSingular )}
        description={__( 'Review applicant files, check requirements checklist, and transition pipeline status.', 'codeclove-school-management' )}
        onBack={() => navigate('/students/admissions')}
        breadcrumbs={[
          { label: studentLabelPlural },
          { label: admissionLabelPlural, href: '/students/admissions' },
          { label: sprintf( __( '%s Details', 'codeclove-school-management' ), admissionLabelSingular ) }
        ]}
      />

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Left Column (Details, docs) - spans 3 */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Banner & Actions Card */}
          <Card className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              
              {/* Profile Details (Left) */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {application.student_photo_url ? (
                  <div className="w-16 h-16 rounded-full border-2 border-brand/20 overflow-hidden flex-shrink-0 select-none">
                    <img src={application.student_photo_url} alt="Applicant" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-brand-dim/35 border-2 border-brand/20 flex items-center justify-center text-brand font-bold text-xl flex-shrink-0 select-none">
                    {application.student_first_name[0] ?? ''}{application.student_last_name[0] ?? ''}
                  </div>
                )}
                <div className="text-center sm:text-left space-y-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-lg font-bold text-text">
                      {application.student_first_name} {application.student_last_name}
                    </h2>
                    <Badge variant={statusVariant} size="sm">
                      {statusLabel.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-xs text-text-muted space-x-2 font-mono flex items-center justify-center sm:justify-start">
                    <span>{sprintf( __( 'Ref No: %s', 'codeclove-school-management' ), application.reference_number )}</span>
                    <span>•</span>
                    <span>{sprintf( __( 'Intended Session: %s', 'codeclove-school-management' ), matchedSession?.name.replace('Academic Year ', '') ?? '—' )}</span>
                  </div>
                </div>
              </div>

              {/* Action Controls (Right) */}
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-text-muted font-semibold">{__( 'Status:', 'codeclove-school-management' )}</span>
                  <Select
                    value={application.status}
                    onValueChange={(val) => handleStatusChange(val as AdmissionApplication['status'])}
                    options={Object.entries(statusLabels)
                      .filter(([k]) => k !== 'admitted')
                      .map(([k, label]) => ({ value: k, label }))}
                  />
                </div>
                
                {application.status === 'accepted' && (
                  <Button onClick={() => navigate(`/students/admissions/${application.id}/convert`)} className="gap-1.5 h-9 text-xs">
                    {__( 'Approve & Convert', 'codeclove-school-management' )}
                    <ArrowRight size={13} />
                  </Button>
                )}
                
                <Button variant="secondary" onClick={() => navigate(`/students/admissions/${application.id}/edit`)} className="gap-1.5 h-9 text-xs">
                  <Pencil size={13} />
                  {__( 'Edit Details', 'codeclove-school-management' )}
                </Button>
              </div>

            </div>
          </Card>

          {/* Placement & Personal Details Card */}
          <Card className="p-6 space-y-6">
            <FormGroupHeader
              title={sprintf( __( 'Personal & %s Details', 'codeclove-school-management' ), guardianLabelSingular )}
              description={__( 'Applicant profile, intended placement, and primary emergency contact information.', 'codeclove-school-management' )}
              icon={User}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Personal */}
              <div className="space-y-3">
                <p className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1">{__( 'Applicant Profile', 'codeclove-school-management' )}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between py-2.5 border-b border-border/30">
                    <span className="text-text-muted">{sprintf( __( 'Intended %s', 'codeclove-school-management' ), unitLabelSingular )}</span>
                    <span className="text-text font-medium">{matchedUnit?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between py-2.5 border-b border-border/30">
                    <span className="text-text-muted">{__( 'Intended Session', 'codeclove-school-management' )}</span>
                    <span className="text-text font-medium">{matchedSession?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between py-2.5 border-b border-border/30">
                    <span className="text-text-muted">{__( 'Gender', 'codeclove-school-management' )}</span>
                    <span className="text-text font-medium">{formatGender(application.student_gender)}</span>
                  </div>
                  <div className="flex justify-between py-2.5 border-b border-border/30">
                    <span className="text-text-muted">{__( 'Date of Birth', 'codeclove-school-management' )}</span>
                    <span className="text-text font-medium">{formatDate(application.student_date_of_birth)}</span>
                  </div>
                  {(() => {
                    let custom: Record<string, string> = {}
                    try { custom = JSON.parse(application.custom_fields_json || '{}') } catch {}
                    return (
                      <>
                        {custom.blood_group && (
                          <div className="flex justify-between py-2.5 border-b border-border/30">
                            <span className="text-text-muted">{__( 'Blood Group', 'codeclove-school-management' )}</span>
                            <span className="text-text font-medium">{custom.blood_group}</span>
                          </div>
                        )}
                        {custom.nationality && (
                          <div className="flex justify-between py-2.5 border-b border-border/30">
                            <span className="text-text-muted">{__( 'Nationality', 'codeclove-school-management' )}</span>
                            <span className="text-text font-medium">{custom.nationality}</span>
                          </div>
                        )}
                        {custom.previous_school_name && (
                          <div className="flex justify-between py-2.5 border-b border-border/30">
                            <span className="text-text-muted">{__( 'Previous School', 'codeclove-school-management' )}</span>
                            <span className="text-text font-medium">{custom.previous_school_name}</span>
                          </div>
                        )}
                        {custom.previous_grade_completed && (
                          <div className="flex justify-between py-2.5 border-b border-border/30">
                            <span className="text-text-muted">{__( 'Last Grade Completed', 'codeclove-school-management' )}</span>
                            <span className="text-text font-medium">{custom.previous_grade_completed}</span>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* Guardian */}
              <div className="space-y-3">
                <p className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1">{__( 'Parent & Guardian Details', 'codeclove-school-management' )}</p>
                <div className="space-y-1 text-xs">
                  {(() => {
                    let custom: Record<string, string> = {}
                    try { custom = JSON.parse(application.custom_fields_json || '{}') } catch {}
                    const hasParents = custom.father_name || custom.mother_name || custom.guardian_other_name
                    if (hasParents) {
                      return (
                        <>
                          {custom.father_name && (
                            <div className="py-2 border-b border-border/30 space-y-1">
                              <span className="text-text-muted font-bold text-2xs uppercase tracking-wider">{__( "Father's Profile", 'codeclove-school-management' )}</span>
                              <div className="flex justify-between"><span>{__( 'Name', 'codeclove-school-management' )}</span><span className="font-medium text-text">{custom.father_name}</span></div>
                              <div className="flex justify-between"><span>{__( 'Phone', 'codeclove-school-management' )}</span><span className="font-medium text-text">{custom.father_phone || '—'}</span></div>
                              {custom.father_email && <div className="flex justify-between"><span>{__( 'Email', 'codeclove-school-management' )}</span><span className="font-medium text-text">{custom.father_email}</span></div>}
                              {custom.father_occupation && <div className="flex justify-between"><span>{__( 'Occupation', 'codeclove-school-management' )}</span><span className="font-medium text-text">{custom.father_occupation}</span></div>}
                            </div>
                          )}
                          {custom.mother_name && (
                            <div className="py-2 border-b border-border/30 space-y-1">
                              <span className="text-text-muted font-bold text-2xs uppercase tracking-wider">{__( "Mother's Profile", 'codeclove-school-management' )}</span>
                              <div className="flex justify-between"><span>{__( 'Name', 'codeclove-school-management' )}</span><span className="font-medium text-text">{custom.mother_name}</span></div>
                              <div className="flex justify-between"><span>{__( 'Phone', 'codeclove-school-management' )}</span><span className="font-medium text-text">{custom.mother_phone || '—'}</span></div>
                              {custom.mother_email && <div className="flex justify-between"><span>{__( 'Email', 'codeclove-school-management' )}</span><span className="font-medium text-text">{custom.mother_email}</span></div>}
                              {custom.mother_occupation && <div className="flex justify-between"><span>{__( 'Occupation', 'codeclove-school-management' )}</span><span className="font-medium text-text">{custom.mother_occupation}</span></div>}
                            </div>
                          )}
                          {custom.guardian_other_name && (
                            <div className="py-2 border-b border-border/30 space-y-1">
                              <span className="text-text-muted font-bold text-2xs uppercase tracking-wider">{sprintf( __( 'Legal Guardian / Alternate (%s)', 'codeclove-school-management' ), custom.guardian_other_rel || __( 'Guardian', 'codeclove-school-management' ) )}</span>
                              <div className="flex justify-between"><span>{__( 'Name', 'codeclove-school-management' )}</span><span className="font-medium text-text">{custom.guardian_other_name}</span></div>
                              <div className="flex justify-between"><span>{__( 'Phone', 'codeclove-school-management' )}</span><span className="font-medium text-text">{custom.guardian_other_phone || '—'}</span></div>
                              {custom.guardian_other_email && <div className="flex justify-between"><span>{__( 'Email', 'codeclove-school-management' )}</span><span className="font-medium text-text">{custom.guardian_other_email}</span></div>}
                            </div>
                          )}
                        </>
                      )
                    }
                    return (
                      <>
                        <div className="flex justify-between py-2.5 border-b border-border/30">
                          <span className="text-text-muted">{sprintf( __( '%s Name', 'codeclove-school-management' ), guardianLabelSingular )}</span>
                          <span className="text-text font-medium">{application.guardian_name}</span>
                        </div>
                        {custom.guardian_relationship && (
                          <div className="flex justify-between py-2.5 border-b border-border/30">
                            <span className="text-text-muted">{__( 'Relationship', 'codeclove-school-management' )}</span>
                            <span className="text-text font-medium">{custom.guardian_relationship}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-2.5 border-b border-border/30">
                          <span className="text-text-muted">{__( 'Email Address', 'codeclove-school-management' )}</span>
                          <span className="text-text font-medium">{application.guardian_email}</span>
                        </div>
                        <div className="flex justify-between py-2.5 border-b border-border/30">
                          <span className="text-text-muted">{__( 'Phone Number', 'codeclove-school-management' )}</span>
                          <span className="text-text font-medium">{application.guardian_phone || '—'}</span>
                        </div>
                      </>
                    )
                  })()}
                  {(() => {
                    let addr: Record<string, string> = {}
                    try { addr = JSON.parse(application.address_json || '{}') } catch {}
                    const street = addr.street || addr.street_address || addr.address || ''
                    const city = addr.city || ''
                    const state = addr.state || ''
                    const pcode = addr.postal_code || addr.zip_code || addr.zip || ''
                    const country = addr.country || ''
                    const hasAddress = street || city || state || pcode || country
                    if (!hasAddress) return null
                    return (
                      <div className="py-2 border-b border-border/30 space-y-1.5">
                        <span className="text-text-muted font-bold text-2xs uppercase tracking-wider">{__( 'Applicant Address', 'codeclove-school-management' )}</span>
                        {street && <div className="flex justify-between"><span>{__( 'Street Address', 'codeclove-school-management' )}</span><span className="font-medium text-text">{street}</span></div>}
                        {city && <div className="flex justify-between"><span>{__( 'City', 'codeclove-school-management' )}</span><span className="font-medium text-text">{city}</span></div>}
                        {state && <div className="flex justify-between"><span>{__( 'State / Province', 'codeclove-school-management' )}</span><span className="font-medium text-text">{state}</span></div>}
                        {pcode && <div className="flex justify-between"><span>{__( 'ZIP / Postal Code', 'codeclove-school-management' )}</span><span className="font-medium text-text">{pcode}</span></div>}
                        {country && <div className="flex justify-between"><span>{__( 'Country', 'codeclove-school-management' )}</span><span className="font-medium text-text">{country}</span></div>}
                      </div>
                    )
                  })()}
                  <div className="flex justify-between py-2.5 border-b border-border/30">
                    <span className="text-text-muted">{__( 'Application Source', 'codeclove-school-management' )}</span>
                    <span className="text-text font-medium capitalize">{application.source.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Document Checklist Card */}
          {requiredDocs.length > 0 && (
            <Card className="p-6 space-y-4">
              <FormGroupHeader
                title={__( 'Required Document Checklist', 'codeclove-school-management' )}
                description={__( 'Verify and mark off all mandatory documents submitted by the applicant.', 'codeclove-school-management' )}
                icon={ClipboardList}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {requiredDocs.map((doc) => {
                  const isChecked = Boolean(approvedDocs[doc])
                  return (
                    <label
                      key={doc}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-bg-base/60 hover:bg-hover-bg cursor-pointer select-none group transition-all duration-100 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-ring outline-none"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDoc(doc)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex-shrink-0 h-4 w-4 rounded-[4px] border transition-colors duration-100 flex items-center justify-center',
                          'group-hover:border-border-strong',
                          isChecked ? 'bg-brand border-brand' : 'bg-bg-surface border-border'
                        )}
                      >
                        <svg
                          className={cn('w-2.5 h-2.5 text-white transition-transform duration-100', isChecked ? 'scale-100' : 'scale-0')}
                          viewBox="0 0 10 8" fill="none" stroke="currentColor"
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M1 4l3 3 5-5" />
                        </svg>
                      </span>
                      <span className={isChecked ? 'text-text-muted line-through font-medium text-xs' : 'text-text font-medium text-xs group-hover:text-brand transition-colors'}>
                        {doc.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </label>
                  )
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column (Audit timeline) - spans 1 */}
        <div className="lg:col-span-1">
          <Card className="p-6 h-full space-y-4">
            <FormGroupHeader
              title={__( 'Audit History & Timeline', 'codeclove-school-management' )}
              description={__( 'Chronological log of every status change and action taken on this application.', 'codeclove-school-management' )}
              icon={ClipboardList}
            />
            <div className="relative space-y-5 pl-2">
              {/* Vertical Line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border/60" />
              
              {getTimelineEvents(application).map((event, idx) => {
                const nodeStyle = event.completed
                  ? (TIMELINE_NODE_STYLES[event.status] || TIMELINE_NODE_STYLES.inquiry) as { bg: string; border: string; text: string }
                  : { bg: 'bg-bg-surface', border: 'border-border', text: 'text-text-muted/50' }
                
                const formattedTime = event.completed
                  ? formatDateTime(event.timestamp)
                  : '—'

                return (
                  <div key={idx} className="flex gap-4 relative items-start group">
                    {/* Timeline Point */}
                    <div className={`w-[14px] h-[14px] rounded-full border-2 ${nodeStyle.bg} ${nodeStyle.border} z-10 mt-1 flex-shrink-0`} />
                    
                    {/* Event Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-0.5">
                        <p className={`text-xs font-bold leading-snug ${event.completed ? 'text-text' : 'text-text-muted/50'}`}>
                          {event.title}
                        </p>
                        <span className="text-2xs text-text-muted/70 font-mono">
                          {formattedTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-2xs text-text-muted mt-0.5 font-medium">
                        <span>{sprintf( __( 'Actor: %s', 'codeclove-school-management' ), event.actor )}</span>
                      </div>
                      <p className={`text-xs mt-1 leading-relaxed ${event.completed ? 'text-text-subtle' : 'text-text-muted/40'}`}>
                        {event.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
