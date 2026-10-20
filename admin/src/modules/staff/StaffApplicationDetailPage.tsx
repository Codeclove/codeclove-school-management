import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  User,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  History,
  Award,
  FileText,
  UserCheck,
  Check,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import {
  useStaffApplicationDetails,
  useUpdateStaffApplicationStatus,
  useConvertStaffApplication,
  type StaffApplication,
} from '@/api/staff'
import { useRoles } from '@/api/roles'
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
  Modal,
  ModalFooter,
  FormField,
  Input,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { useFormatter, formatGender } from '@/lib/formatter'
import { useLabels } from '@/lib/labels'
import { __, sprintf } from '@/lib/i18n'

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<string, 'default' | 'brand' | 'info' | 'success' | 'danger'> = {
  submitted:           'info',
  under_review:        'brand',
  more_info_needed:    'danger',
  interview_scheduled: 'brand',
  offer_sent:          'brand',
  accepted:            'success',
  hired:               'success',
  rejected:            'danger',
  withdrawn:           'default',
}

const getStatusLabels = (): Record<string, string> => ({
  submitted:           __( 'Submitted', 'codeclove-school-management' ),
  under_review:        __( 'Under Review', 'codeclove-school-management' ),
  more_info_needed:    __( 'More Info Needed', 'codeclove-school-management' ),
  interview_scheduled: __( 'Interview Scheduled', 'codeclove-school-management' ),
  offer_sent:          __( 'Offer Sent', 'codeclove-school-management' ),
  accepted:            __( 'Accepted', 'codeclove-school-management' ),
  hired:               __( 'Hired', 'codeclove-school-management' ),
  rejected:            __( 'Rejected', 'codeclove-school-management' ),
  withdrawn:           __( 'Withdrawn', 'codeclove-school-management' ),
})

const TIMELINE_NODE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  submitted:           { bg: 'bg-info-dim',    border: 'border-info',    text: 'text-info' },
  under_review:        { bg: 'bg-brand-dim',   border: 'border-brand',   text: 'text-brand' },
  more_info_needed:    { bg: 'bg-danger-dim',  border: 'border-danger',  text: 'text-danger' },
  interview_scheduled: { bg: 'bg-brand-dim',   border: 'border-brand',   text: 'text-brand' },
  offer_sent:          { bg: 'bg-brand-dim',   border: 'border-brand',   text: 'text-brand' },
  accepted:            { bg: 'bg-success-dim', border: 'border-success', text: 'text-success' },
  hired:               { bg: 'bg-success-dim', border: 'border-success', text: 'text-success' },
  rejected:            { bg: 'bg-danger-dim',  border: 'border-danger',  text: 'text-danger' },
  withdrawn:           { bg: 'bg-hover-bg',    border: 'border-border',  text: 'text-text-muted' },
}

interface TimelineEvent {
  status: string
  title: string
  description: string
  timestamp: string
  actor: string
  completed: boolean
}

function getTimelineEvents(application: StaffApplication): TimelineEvent[] {
  const statusLabels = getStatusLabels()
  const isWalkIn = application.source === 'walk_in'
  const initialActor = isWalkIn
    ? __( 'HR Staff (Walk-In)', 'codeclove-school-management' )
    : __( 'Applicant (Online Form)', 'codeclove-school-management' )

  if (application.status_history && application.status_history.length > 0) {
    return application.status_history.map((evt) => {
      const statusLabel = statusLabels[evt.to_status] ?? evt.to_status
      const isInitial = !evt.from_status && evt.to_status === 'submitted'
      const title = evt.reason || (
        isInitial
          ? (isWalkIn ? __( 'Staff Application Recorded (Walk-In)', 'codeclove-school-management' ) : __( 'Application Submitted Online', 'codeclove-school-management' ))
          : sprintf( __( 'Status: %s', 'codeclove-school-management' ), statusLabel )
      )
      const actor = evt.actor_name || (isInitial ? initialActor : __( 'Staff Administrator', 'codeclove-school-management' ))
      const description = evt.message || (evt.from_status ? sprintf(
        __( 'Status transitioned from %1$s to %2$s.', 'codeclove-school-management' ),
        statusLabels[evt.from_status] ?? evt.from_status,
        statusLabel
      ) : '')

      return {
        status: evt.to_status,
        title,
        description,
        timestamp: evt.changed_at,
        actor,
        completed: true,
      }
    })
  }

  const currentLabel = statusLabels[application.status] ?? application.status
  const events: TimelineEvent[] = [{
    status: 'submitted',
    title: isWalkIn
      ? __( 'Staff Application Recorded (Walk-In)', 'codeclove-school-management' )
      : __( 'Application Submitted Online', 'codeclove-school-management' ),
    description: '',
    timestamp: application.submitted_at || application.created_at,
    actor: initialActor,
    completed: true,
  }]

  if (application.status !== 'submitted') {
    events.push({
      status: application.status,
      title: sprintf( __( 'Current Status: %s', 'codeclove-school-management' ), currentLabel ),
      description: '',
      timestamp: application.decision_at || application.reviewed_at || application.updated_at,
      actor: __( 'Staff Administrator', 'codeclove-school-management' ),
      completed: true,
    })
  }

  return events
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StaffApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const applicationId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { formatDate, formatDateTime } = useFormatter()
  const { getLabel } = useLabels()

  const staffLabelPlural = getLabel('staff_member', true, __( 'Staff & HR', 'codeclove-school-management' ))

  const { data: application, isLoading: isAppLoading, isError, refetch } = useStaffApplicationDetails(applicationId)
  const { data: settings } = useSettings()
  const { data: roles = [] } = useRoles()

  const updateStatusMutation = useUpdateStaffApplicationStatus()
  const convertMutation = useConvertStaffApplication()

  // Modals & Checklist State
  const [approvedDocs, setApprovedDocs] = useState<Record<string, boolean>>({})
  const [hireModalOpen, setHireModalOpen] = useState(false)
  const [hireRoleId, setHireRoleId] = useState('')
  const [hireDesignation, setHireDesignation] = useState('')
  const [hireDepartment, setHireDepartment] = useState('')

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
        title={__( 'Staff Application Not Found', 'codeclove-school-management' )}
        description={__( 'The application you are trying to view does not exist or has been deleted.', 'codeclove-school-management' )}
        icon={AlertTriangle}
        action={
          <Button size="sm" onClick={() => navigate('/staff/applications')}>
            {__( 'Back to Staff Applications', 'codeclove-school-management' )}
          </Button>
        }
      />
    )
  }

  const onboardingSettings = settings?.staff_onboarding
  const requiredDocs = onboardingSettings?.required_documents ?? []

  const handleStatusChange = (status: string) => {
    updateStatusMutation.mutate(
      { id: application.id, status },
      {
        onSuccess: () => {
          refetch()
          toast.success(sprintf( __( 'Status updated to %s', 'codeclove-school-management' ), statusLabels[status] ?? status ))
        },
        onError: (err) => {
          toast.error(err.message || __( 'Failed to update status.', 'codeclove-school-management' ))
        },
      }
    )
  }

  const handleOpenHireModal = () => {
    setHireDesignation(application.desired_role || '')
    setHireDepartment(application.department || '')
    const defaultRoleSlug = onboardingSettings?.default_role || 'staff'
    const matchedRole = roles.find((r) => r.slug === defaultRoleSlug) || roles[0]
    setHireRoleId(matchedRole ? String(matchedRole.id) : '')
    setHireModalOpen(true)
  }

  const handleExecuteHire = () => {
    convertMutation.mutate(
      {
        id: application.id,
        payload: {
          role_id: hireRoleId ? Number(hireRoleId) : null,
          designation: hireDesignation || application.desired_role,
          department: hireDepartment || application.department,
        },
      },
      {
        onSuccess: (res) => {
          setHireModalOpen(false)
          refetch()
          toast.success(
            sprintf(
              __( 'Candidate successfully hired! Created staff member %s.', 'codeclove-school-management' ),
              res.staff_number
            )
          )
        },
        onError: (err) => {
          toast.error(err.message || __( 'Failed to hire and convert candidate.', 'codeclove-school-management' ))
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

  let custom: Record<string, any> = {}
  try { custom = JSON.parse(application.custom_fields_json || '{}') } catch {}

  let address: Record<string, any> = {}
  try { address = JSON.parse(application.address_json || '{}') } catch {}

  let experience: Record<string, any> = {}
  try { experience = JSON.parse(application.experience_json || '{}') } catch {}

  const formattedAddress = [
    address.address || address.street,
    address.city,
    address.state,
    address.postal_code || address.zip,
    address.country,
  ].filter(Boolean).join(', ')

  const fullName = [
    application.first_name,
    application.middle_name,
    application.last_name,
  ].filter(Boolean).join(' ')

  const isHired = application.status === 'hired'

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title={__( 'Staff Application Details', 'codeclove-school-management' )}
        description={__( 'Review candidate qualifications, work history, manage hiring stages, and onboard active staff.', 'codeclove-school-management' )}
        onBack={() => navigate('/staff/applications')}
        breadcrumbs={[
          { label: staffLabelPlural },
          { label: __( 'Applications', 'codeclove-school-management' ), href: '/staff/applications' },
          { label: sprintf( __( '%s Details', 'codeclove-school-management' ), fullName ) },
        ]}
      />

      {/* Top Banner & Lifecycle Actions Card */}
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Candidate Identity */}
          <div className="flex items-center gap-4">
            <Avatar
              name={fullName}
              size="xl"
              shape="circle"
            />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-bold text-text capitalize">
                  {fullName}
                </h2>
                <Badge variant={statusVariant} size="sm">
                  {statusLabel.toUpperCase()}
                </Badge>
              </div>
              <div className="text-xs text-text-muted flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="font-mono">{sprintf( __( 'Ref: %s', 'codeclove-school-management' ), application.reference_number )}</span>
                <span className="text-text-subtle/50">•</span>
                <span className="font-medium text-text">{application.desired_role || __( 'Position Unassigned', 'codeclove-school-management' )}</span>
                {application.department && (
                  <>
                    <span className="text-text-subtle/50">•</span>
                    <span>{application.department}</span>
                  </>
                )}
                <span className="text-text-subtle/50">•</span>
                <span>{application.email}</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!isHired && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-muted">{__( 'Status:', 'codeclove-school-management' )}</span>
                <div className="w-40">
                  <Select
                    value={application.status}
                    onValueChange={(val) => handleStatusChange(val)}
                    options={Object.entries(statusLabels)
                      .filter(([k]) => k !== 'hired')
                      .map(([k, label]) => ({ value: k, label }))}
                  />
                </div>
              </div>
            )}

            <Button
              variant="secondary"
              onClick={() => navigate(`/staff/applications/${application.id}/edit`)}
              className="gap-1.5"
            >
              <Pencil size={14} />
              {__( 'Edit Details', 'codeclove-school-management' )}
            </Button>

            {isHired ? (
              application.converted_staff_member_id && (
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/staff/${application.converted_staff_member_id}`)}
                  className="gap-1.5"
                >
                  <User size={14} />
                  {__( 'View Staff Profile', 'codeclove-school-management' )}
                </Button>
              )
            ) : application.status === 'rejected' ? (
              <Button
                variant="secondary"
                onClick={() => handleStatusChange('under_review')}
                className="gap-1.5"
              >
                <RotateCcw size={14} />
                {__( 'Reopen Application', 'codeclove-school-management' )}
              </Button>
            ) : application.status !== 'withdrawn' ? (
              <Button
                variant="default"
                onClick={handleOpenHireModal}
                className="gap-1.5"
              >
                <UserCheck size={14} />
                {__( 'Hire & Convert to Staff', 'codeclove-school-management' )}
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Main 2 : 1 Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column (Details) — spans 2 */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Candidate Profile & Position Card */}
          <Card className="p-6 space-y-5">
            <FormGroupHeader
              title={__( 'Candidate Profile & Position', 'codeclove-school-management' )}
              description={__( 'Personal demographics, position applied for, and application metadata.', 'codeclove-school-management' )}
              icon={User}
            />

            <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-xs">
              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Desired Role', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text text-sm">
                  {application.desired_role || '—'}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Department', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text text-sm">
                  {application.department || '—'}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Gender', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text capitalize">
                  {formatGender(application.gender)}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Date of Birth', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text">
                  {application.date_of_birth ? formatDate(application.date_of_birth) : '—'}
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
                  {__( 'Submission Date', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text">
                  {application.submitted_at || application.created_at
                    ? formatDateTime(application.submitted_at || application.created_at)
                    : '—'}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Contact & Residential Details Card */}
          <Card className="p-6 space-y-5">
            <FormGroupHeader
              title={__( 'Contact & Address Information', 'codeclove-school-management' )}
              description={__( 'Applicant primary telephone, email communication, and residential home address.', 'codeclove-school-management' )}
              icon={Phone}
            />

            <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-xs">
              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Email Address', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text">
                  {application.email ? (
                    <a href={`mailto:${application.email}`} className="text-brand hover:underline inline-flex items-center gap-1">
                      <Mail size={12} className="text-text-subtle" />
                      {application.email}
                    </a>
                  ) : '—'}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Mobile Phone', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text">
                  {application.phone ? (
                    <a href={`tel:${application.phone}`} className="text-brand hover:underline inline-flex items-center gap-1">
                      <Phone size={12} className="text-text-subtle" />
                      {application.phone}
                    </a>
                  ) : '—'}
                </dd>
              </div>

              <div className="space-y-1 sm:col-span-2 md:col-span-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Residential Address', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text flex items-start gap-1">
                  {formattedAddress ? (
                    <>
                      <MapPin size={12} className="text-text-subtle mt-0.5 flex-shrink-0" />
                      <span>{formattedAddress}</span>
                    </>
                  ) : '—'}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Qualifications & Professional Experience Card */}
          <Card className="p-6 space-y-5">
            <FormGroupHeader
              title={__( 'Qualifications & Experience', 'codeclove-school-management' )}
              description={__( 'Academic credentials, relevant professional background, and past experience details.', 'codeclove-school-management' )}
              icon={Award}
            />

            <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-xs">
              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Highest Qualification', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text text-sm">
                  {custom.qualification || '—'}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Total Experience', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text text-sm">
                  {experience.years ? `${experience.years} ${__( 'Years', 'codeclove-school-management' )}` : '—'}
                </dd>
              </div>

              <div className="space-y-1">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Specialization / Field', 'codeclove-school-management' )}
                </dt>
                <dd className="font-medium text-text text-sm">
                  {custom.specialization || '—'}
                </dd>
              </div>
            </dl>

            {experience.details && (
              <div className="space-y-1.5 pt-3 border-t border-border">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Work History & Background', 'codeclove-school-management' )}
                </dt>
                <dd className="p-3.5 rounded-lg bg-bg-surface border border-border text-xs text-text whitespace-pre-line leading-relaxed">
                  {experience.details}
                </dd>
              </div>
            )}

            {custom.cover_letter && (
              <div className="space-y-1.5 pt-3 border-t border-border">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Cover Letter / Statement of Purpose', 'codeclove-school-management' )}
                </dt>
                <dd className="p-3.5 rounded-lg bg-bg-surface border border-border text-xs text-text whitespace-pre-line leading-relaxed">
                  {custom.cover_letter}
                </dd>
              </div>
            )}

            {custom.remarks && (
              <div className="space-y-1.5 pt-3 border-t border-border">
                <dt className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {__( 'Applicant Notes & Remarks', 'codeclove-school-management' )}
                </dt>
                <dd className="p-3 rounded-lg bg-bg-surface border border-border text-xs text-text-muted">
                  {custom.remarks}
                </dd>
              </div>
            )}
          </Card>



        </div>

        {/* Right Column (Sidebar: Timeline, Checklist & Summary) — spans 1 */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-5 space-y-4">
            <FormGroupHeader
              title={__( 'Audit History & Timeline', 'codeclove-school-management' )}
              description={__( 'Chronological log of recruitment pipeline status transitions.', 'codeclove-school-management' )}
              icon={History}
            />
            <div className="pt-2">
              {getTimelineEvents(application).map((event, idx, arr) => {
                const isLast = idx === arr.length - 1
                const nodeStyle = event.completed
                  ? (TIMELINE_NODE_STYLES[event.status] || TIMELINE_NODE_STYLES.submitted) as { bg: string; border: string; text: string }
                  : { bg: 'bg-bg-surface', border: 'border-border', text: 'text-text-muted/50' }

                return (
                  <div key={idx} className="flex gap-3 relative group">
                    {/* Node point & vertical connecting line */}
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0 z-10 transition-colors',
                          nodeStyle.bg,
                          nodeStyle.border
                        )}
                      />
                      {!isLast && (
                        <div className="w-0.5 flex-1 bg-border/60 my-1 min-h-[32px]" />
                      )}
                    </div>

                    {/* Event details */}
                    <div className={cn('min-w-0 flex-1', !isLast ? 'pb-5' : 'pb-1')}>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-xs font-semibold text-text leading-snug">
                            {event.title}
                          </p>
                          <span className="text-2xs text-text-muted font-mono">
                            {event.completed ? formatDateTime(event.timestamp) : '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-2xs text-text-muted font-medium mt-0.5">
                          <User size={11} className="shrink-0 text-text-muted/70" />
                          <span>{event.actor}</span>
                        </div>
                      </div>
                      {event.description && (
                        <p className={cn(
                          'text-xs mt-1.5 leading-relaxed',
                          event.status === 'rejected'
                            ? 'text-danger bg-danger-dim/30 p-2 rounded border border-danger/20 font-medium'
                            : 'text-text-muted'
                        )}>
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Hiring Documents Checklist Card */}
          {requiredDocs.length > 0 && (
            <Card className="p-5 space-y-4">
              <FormGroupHeader
                title={__( 'Mandatory Documents', 'codeclove-school-management' )}
                description={__( 'Verification checklist for hiring documentation.', 'codeclove-school-management' )}
                icon={FileText}
              />

              <div className="space-y-2">
                {requiredDocs.map((doc: string) => {
                  const isChecked = Boolean(approvedDocs[doc])
                  return (
                    <label
                      key={doc}
                      onClick={() => toggleDoc(doc)}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-bg-surface hover:bg-hover-bg transition-colors cursor-pointer select-none group"
                    >
                      <div className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                        isChecked ? 'bg-success border-success text-white' : 'border-border bg-bg-elevated'
                      )}>
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>
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

      </div>

      {/* Hire & Convert Candidate Modal */}
      <Modal open={hireModalOpen} onOpenChange={setHireModalOpen} title={__( 'Hire Candidate & Convert to Staff Member', 'codeclove-school-management' )}>
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-bg-surface border border-border space-y-1">
            <div className="font-semibold text-text">{fullName}</div>
            <div className="text-xs text-text-muted">{application.email} • {application.reference_number}</div>
          </div>

          <p className="text-sm text-text-muted">
            {__(
              'This will create an official staff member record in the Staff Directory, generate an Employee ID, and provision account access according to your Staff Onboarding settings.',
              'codeclove-school-management'
            )}
          </p>

          <FormField label={__( 'Designation / Job Title', 'codeclove-school-management' )} required>
            <Input
              value={hireDesignation}
              onChange={(e) => setHireDesignation(e.target.value)}
              placeholder={__( 'e.g. Senior Mathematics Teacher', 'codeclove-school-management' )}
              className="bg-bg-surface border-border"
            />
          </FormField>

          <FormField label={__( 'Department', 'codeclove-school-management' )}>
            <Input
              value={hireDepartment}
              onChange={(e) => setHireDepartment(e.target.value)}
              placeholder={__( 'e.g. Mathematics & Science', 'codeclove-school-management' )}
              className="bg-bg-surface border-border"
            />
          </FormField>

          <FormField label={__( 'Assigned Role', 'codeclove-school-management' )} required>
            <Select
              value={hireRoleId}
              onValueChange={setHireRoleId}
              placeholder={__( 'Select staff role', 'codeclove-school-management' )}
              options={roles.map((r) => ({
                value: String(r.id),
                label: r.name,
              }))}
            />
          </FormField>

          <ModalFooter>
            <Button variant="secondary" onClick={() => setHireModalOpen(false)} disabled={convertMutation.isPending}>
              {__( 'Cancel', 'codeclove-school-management' )}
            </Button>
            <Button variant="default" onClick={handleExecuteHire} disabled={convertMutation.isPending}>
              <UserCheck size={14} className="me-1.5" />
              {convertMutation.isPending ? __( 'Hiring...', 'codeclove-school-management' ) : __( 'Confirm Hire', 'codeclove-school-management' )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>

    </div>
  )
}
