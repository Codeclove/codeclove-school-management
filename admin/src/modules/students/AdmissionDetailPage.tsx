import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  User,
  Users,
  ClipboardList,
  ArrowRight,
  Pencil,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  History,
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
  Button,
  Badge,
  Card,
  Select,
  PageHeader,
  EmptyState,
  FormGroupHeader,
  Skeleton,
  Avatar,
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
  inquiry:             { bg: 'bg-hover-bg',      border: 'border-border',  text: 'text-text-muted' },
  submitted:           { bg: 'bg-info-dim',      border: 'border-info',    text: 'text-info' },
  under_review:        { bg: 'bg-brand-dim',     border: 'border-brand',   text: 'text-brand' },
  more_info_needed:    { bg: 'bg-danger-dim',    border: 'border-danger',  text: 'text-danger' },
  interview_scheduled: { bg: 'bg-brand-dim',     border: 'border-brand',   text: 'text-brand' },
  accepted:            { bg: 'bg-success-dim',   border: 'border-success', text: 'text-success' },
  waitlisted:          { bg: 'bg-hover-bg',      border: 'border-border',  text: 'text-text-muted' },
  rejected:            { bg: 'bg-danger-dim',    border: 'border-danger',  text: 'text-danger' },
  admitted:            { bg: 'bg-success-dim',   border: 'border-success', text: 'text-success' },
  withdrawn:           { bg: 'bg-hover-bg',      border: 'border-border',  text: 'text-text-muted' },
}

interface TimelineEvent {
  status: string
  title: string
  description: string
  timestamp: string
  actor: string
  completed: boolean
}

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

  let custom: Record<string, string> = {}
  try { custom = JSON.parse(application.custom_fields_json || '{}') } catch {}

  let address: Record<string, string> = {}
  try { address = JSON.parse(application.address_json || '{}') } catch {}

  const formattedAddress = [
    address.street || address.street_address || address.address,
    address.city,
    address.state,
    address.postal_code || address.zip_code || address.zip,
    address.country,
  ].filter(Boolean).join(', ')

  const parents = [
    { title: __( "Father's Profile", 'codeclove-school-management' ), name: custom.father_name, phone: custom.father_phone, email: custom.father_email, occ: custom.father_occupation },
    { title: __( "Mother's Profile", 'codeclove-school-management' ), name: custom.mother_name, phone: custom.mother_phone, email: custom.mother_email, occ: custom.mother_occupation },
  ].filter((p) => Boolean(p.name))

  const hasGuardianOther = Boolean(custom.guardian_other_name)
  const hasStructuredParents = parents.length > 0 || hasGuardianOther

  const fullName = [
    application.student_first_name,
    application.student_middle_name,
    application.student_last_name,
  ].filter(Boolean).join(' ')

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title={sprintf( __( '%s Details', 'codeclove-school-management' ), admissionLabelSingular )}
        description={__( 'Review applicant profile, manage guardian contacts, and track application lifecycle.', 'codeclove-school-management' )}
        onBack={() => navigate('/students/admissions')}
        breadcrumbs={[
          { label: studentLabelPlural },
          { label: admissionLabelPlural, href: '/students/admissions' },
          { label: sprintf( __( '%s Details', 'codeclove-school-management' ), admissionLabelSingular ) },
        ]}
      />

      {/* Top Banner & Lifecycle Actions Card */}
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Applicant Identity */}
          <div className="flex items-center gap-4">
            <Avatar
              name={fullName}
              photoUrl={application.student_photo_url}
              size="xl"
              shape="circle"
            />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-bold text-text">
                  {fullName}
                </h2>
                <Badge variant={statusVariant} size="sm">
                  {statusLabel.toUpperCase()}
                </Badge>
              </div>
              <div className="text-xs text-text-muted flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="font-mono">{sprintf( __( 'Ref: %s', 'codeclove-school-management' ), application.reference_number )}</span>
                <span className="text-text-subtle/50">•</span>
                <span>{matchedUnit?.name || __( 'Class Level Unassigned', 'codeclove-school-management' )}</span>
                <span className="text-text-subtle/50">•</span>
                <span>{matchedSession?.name.replace('Academic Year ', '') ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-muted">{__( 'Status:', 'codeclove-school-management' )}</span>
              <div className="w-36">
                <Select
                  value={application.status}
                  onValueChange={(val) => handleStatusChange(val as AdmissionApplication['status'])}
                  options={Object.entries(statusLabels)
                    .filter(([k]) => k !== 'admitted')
                    .map(([k, label]) => ({ value: k, label }))}
                />
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => navigate(`/students/admissions/${application.id}/edit`)}
              className="gap-1.5"
            >
              <Pencil size={14} />
              {__( 'Edit Details', 'codeclove-school-management' )}
            </Button>

            {application.status === 'accepted' && (
              <Button
                onClick={() => navigate(`/students/admissions/${application.id}/convert`)}
                className="gap-1.5"
              >
                {__( 'Approve & Convert', 'codeclove-school-management' )}
                <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main 2 : 1 Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column (Details) — spans 2 */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Applicant Profile & Academic Placement Card */}
          <Card className="p-6 space-y-5">
            <FormGroupHeader
              title={__( 'Applicant Profile & Placement', 'codeclove-school-management' )}
              description={__( 'Personal demographics, identity details, and intended academic level.', 'codeclove-school-management' )}
              icon={User}
            />

            <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-xs">
              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {sprintf( __( 'Intended %s', 'codeclove-school-management' ), unitLabelSingular )}
                </dt>
                <dd className="font-medium text-text">
                  {matchedUnit?.name ?? '—'}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Intended Session', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text">
                  {matchedSession?.name ?? '—'}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Gender', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text">
                  {formatGender(application.student_gender)}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Date of Birth', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text">
                  {formatDate(application.student_date_of_birth)}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Application Source', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text capitalize">
                  {application.source.replace('_', ' ')}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Submitted Date', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text">
                  {application.submitted_at || application.created_at
                    ? formatDateTime(application.submitted_at || application.created_at)
                    : '—'}
                </dd>
              </div>

              {custom.blood_group && (
                <div className="space-y-1">
                  <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                    {__( 'Blood Group', 'codeclove-school-management' )}
                  </dt>
                  <dd className="font-medium text-text">
                    {custom.blood_group}
                  </dd>
                </div>
              )}

              {custom.nationality && (
                <div className="space-y-1">
                  <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                    {__( 'Nationality', 'codeclove-school-management' )}
                  </dt>
                  <dd className="font-medium text-text">
                    {custom.nationality}
                  </dd>
                </div>
              )}

              {custom.previous_school_name && (
                <div className="space-y-1">
                  <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                    {__( 'Previous School', 'codeclove-school-management' )}
                  </dt>
                  <dd className="font-medium text-text">
                    {custom.previous_school_name}
                  </dd>
                </div>
              )}

              {custom.previous_grade_completed && (
                <div className="space-y-1">
                  <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                    {__( 'Last Grade Completed', 'codeclove-school-management' )}
                  </dt>
                  <dd className="font-medium text-text">
                    {custom.previous_grade_completed}
                  </dd>
                </div>
              )}
            </dl>

            {custom.remarks && (
              <div className="pt-3 border-t border-border/40">
                <p className="text-2xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  {__( 'Applicant Notes & Remarks', 'codeclove-school-management' )}
                </p>
                <p className="text-xs text-text-muted leading-relaxed bg-bg-elevated p-3 rounded-lg border border-border/50">
                  {custom.remarks}
                </p>
              </div>
            )}
          </Card>

          {/* Family & Guardian Details Card */}
          <Card className="p-6 space-y-5">
            <FormGroupHeader
              title={sprintf( __( 'Family & %s Details', 'codeclove-school-management' ), guardianLabelSingular )}
              description={__( 'Parent contact numbers, email addresses, and residential home address.', 'codeclove-school-management' )}
              icon={Users}
            />

            {hasStructuredParents ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {parents.map((parent) => (
                  <div key={parent.title} className="p-3.5 rounded-lg border border-border/70 bg-bg-surface space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                      <span className="text-xs font-bold text-text uppercase tracking-wide">
                        {parent.title}
                      </span>
                      {parent.occ && (
                        <span className="text-2xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded">
                          {parent.occ}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">{__( 'Name', 'codeclove-school-management' )}</span>
                        <span className="font-medium text-text">{parent.name}</span>
                      </div>
                      {parent.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">{__( 'Phone', 'codeclove-school-management' )}</span>
                          <a href={`tel:${parent.phone}`} className="font-medium text-brand hover:underline inline-flex items-center gap-1">
                            <Phone size={11} />
                            {parent.phone}
                          </a>
                        </div>
                      )}
                      {parent.email && (
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">{__( 'Email', 'codeclove-school-management' )}</span>
                          <a href={`mailto:${parent.email}`} className="font-medium text-brand hover:underline inline-flex items-center gap-1">
                            <Mail size={11} />
                            {parent.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Other Guardian */}
                {hasGuardianOther && (
                  <div className="p-3.5 rounded-lg border border-border/70 bg-bg-surface space-y-2.5 col-span-full">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                      <span className="text-xs font-bold text-text uppercase tracking-wide">
                        {custom.guardian_other_rel || guardianLabelSingular}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-text-muted block text-2xs uppercase tracking-wider">{__( 'Name', 'codeclove-school-management' )}</span>
                        <span className="font-medium text-text">{custom.guardian_other_name}</span>
                      </div>
                      {custom.guardian_other_phone && (
                        <div>
                          <span className="text-text-muted block text-2xs uppercase tracking-wider">{__( 'Phone', 'codeclove-school-management' )}</span>
                          <a href={`tel:${custom.guardian_other_phone}`} className="font-medium text-brand hover:underline inline-flex items-center gap-1">
                            <Phone size={11} />
                            {custom.guardian_other_phone}
                          </a>
                        </div>
                      )}
                      {custom.guardian_other_email && (
                        <div>
                          <span className="text-text-muted block text-2xs uppercase tracking-wider">{__( 'Email', 'codeclove-school-management' )}</span>
                          <a href={`mailto:${custom.guardian_other_email}`} className="font-medium text-brand hover:underline inline-flex items-center gap-1">
                            <Mail size={11} />
                            {custom.guardian_other_email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback single guardian view */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block">
                    {sprintf( __( '%s Name', 'codeclove-school-management' ), guardianLabelSingular )}
                  </span>
                  <span className="font-medium text-text">{application.guardian_name || '—'}</span>
                </div>
                {custom.guardian_relationship && (
                  <div className="space-y-1">
                    <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block">
                      {__( 'Relationship', 'codeclove-school-management' )}
                    </span>
                    <span className="font-medium text-text">{custom.guardian_relationship}</span>
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block">
                    {__( 'Phone Number', 'codeclove-school-management' )}
                  </span>
                  {application.guardian_phone ? (
                    <a href={`tel:${application.guardian_phone}`} className="font-medium text-brand hover:underline inline-flex items-center gap-1">
                      <Phone size={11} />
                      {application.guardian_phone}
                    </a>
                  ) : <span className="font-medium text-text">—</span>}
                </div>
                <div className="space-y-1">
                  <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block">
                    {__( 'Email Address', 'codeclove-school-management' )}
                  </span>
                  {application.guardian_email ? (
                    <a href={`mailto:${application.guardian_email}`} className="font-medium text-brand hover:underline inline-flex items-center gap-1">
                      <Mail size={11} />
                      {application.guardian_email}
                    </a>
                  ) : <span className="font-medium text-text">—</span>}
                </div>
              </div>
            )}

            {/* Residential Address */}
            {formattedAddress && (
              <div className="pt-3 border-t border-border/40">
                <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
                  {__( 'Residential Address', 'codeclove-school-management' )}
                </span>
                <div className="flex items-start gap-2 text-xs text-text bg-bg-surface p-3 rounded-lg border border-border/60">
                  <MapPin size={14} className="text-text-muted mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{formattedAddress}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Document Checklist Card (conditional) */}
          {requiredDocs.length > 0 && (
            <Card className="p-6 space-y-4">
              <FormGroupHeader
                title={__( 'Required Document Checklist', 'codeclove-school-management' )}
                description={__( 'Verify and mark off mandatory admission documents submitted by the applicant.', 'codeclove-school-management' )}
                icon={ClipboardList}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {requiredDocs.map((doc) => {
                  const isChecked = Boolean(approvedDocs[doc])
                  return (
                    <label
                      key={doc}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bg-surface hover:bg-hover-bg cursor-pointer select-none group transition-all duration-100 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-ring"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDoc(doc)}
                        className="h-4 w-4 rounded border-border text-brand accent-brand cursor-pointer"
                      />
                      <span className={cn('text-xs font-medium transition-colors', isChecked ? 'text-text-muted line-through' : 'text-text group-hover:text-brand')}>
                        {doc.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </label>
                  )
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column (Sidebar: Audit timeline) — spans 1 */}
        <div className="lg:col-span-1">
          <Card className="p-5 space-y-4">
            <FormGroupHeader
              title={__( 'Audit History & Timeline', 'codeclove-school-management' )}
              description={__( 'Chronological log of pipeline status transitions.', 'codeclove-school-management' )}
              icon={History}
            />
            <div className="relative space-y-5 pl-1.5 pt-1">
              {/* Vertical connecting line */}
              <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-border/60" />
              
              {getTimelineEvents(application).map((event, idx) => {
                const nodeStyle = event.completed
                  ? (TIMELINE_NODE_STYLES[event.status] || TIMELINE_NODE_STYLES.inquiry) as { bg: string; border: string; text: string }
                  : { bg: 'bg-bg-surface', border: 'border-border', text: 'text-text-muted/50' }

                return (
                  <div key={idx} className="flex gap-3.5 relative items-start group">
                    {/* Node point */}
                    <div className={`w-[13px] h-[13px] rounded-full border-2 ${nodeStyle.bg} ${nodeStyle.border} z-10 mt-1 flex-shrink-0`} />
                    
                    {/* Event details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-0.5">
                        <p className={`text-xs font-bold leading-snug ${event.completed ? 'text-text' : 'text-text-muted/50'}`}>
                          {event.title}
                        </p>
                        <span className="text-[11px] text-text-muted font-mono">
                          {event.completed ? formatDateTime(event.timestamp) : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-2xs text-text-muted mt-0.5 font-medium">
                        <span>{sprintf( __( 'Actor: %s', 'codeclove-school-management' ), event.actor )}</span>
                      </div>
                      <p className={`text-xs mt-1 leading-relaxed ${event.completed ? 'text-text-muted' : 'text-text-muted/40'}`}>
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
