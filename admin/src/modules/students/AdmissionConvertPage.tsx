import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle, Eye, BookOpen, Users, Hash } from 'lucide-react'
import {
  useAdmissionDetails,
  useConvertAdmission,
  useGuardians,
  useGroupEnrollmentCounts,
} from '@/api/students'
import {
  useSessions,
  useUnits,
  useGroups,
} from '@/api/academics'
import { useSettings } from '@/api/settings'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import {
  Button, Card, FormField, Select, PageHeader, Spinner, EmptyState, FormGroup, FormGroupHeader, Alert, Skeleton
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'

export default function AdmissionConvertPage() {
  const { id } = useParams<{ id: string }>()
  const applicationId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { getLabel } = useLabels()
  const admissionLabelSingular = getLabel('admission_application', false, __( 'Admission Application', 'codeclove-school-management' ))
  const admissionLabelPlural = getLabel('admission_application', true, __( 'Admission Applications', 'codeclove-school-management' ))
  const studentLabelSingular = getLabel('student', false, __( 'Student', 'codeclove-school-management' ))
  const studentLabelPlural = getLabel('student', true, __( 'Students', 'codeclove-school-management' ))
  const unitLabelSingular = getLabel('academic_unit', false, __( 'Class Level', 'codeclove-school-management' ))
  const groupLabelSingular = getLabel('academic_group', false, __( 'Section', 'codeclove-school-management' ))
  const guardianLabelSingular = getLabel('guardian', false, __( 'Guardian', 'codeclove-school-management' ))
  const sessionLabelSingular = getLabel('academic_session', false, __( 'Academic Session', 'codeclove-school-management' ))

  const { data: application, isLoading: isAppLoading, isError } = useAdmissionDetails(applicationId)
  const { data: settings } = useSettings()
  const { data: sessionData } = useSessions()
  const { data: guardians } = useGuardians()
  const { data: mockCounts } = useGroupEnrollmentCounts()

  const sessions = sessionData?.data ?? []
  
  // Placement/mapping states
  const [sessionVal, setSessionVal] = useState('')
  const [unitVal, setUnitVal] = useState('')
  const [groupVal, setGroupVal] = useState('')

  // Sibling Linking states
  const [linkExisting, setLinkExisting] = useState(false)
  const [selectedGuardianId, setSelectedGuardianId] = useState('')

  // Pre-fill session and unit values from application details
  useEffect(() => {
    if (application) {
      setSessionVal(String(application.academic_session_id))
      setUnitVal(String(application.academic_unit_id))
    }
  }, [application])

  const { data: unitData } = useUnits({ session_id: Number(sessionVal || 1) })
  const units = unitData?.data ?? []

  const { data: groupData } = useGroups({ academic_unit_id: Number(unitVal || 1) })
  const groups = groupData?.data ?? []

  const convertMutation = useConvertAdmission()

  if (isAppLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !application) {
    return (
      <EmptyState
        title={sprintf( __( '%s not found', 'codeclove-school-management' ), admissionLabelSingular )}
        description={sprintf( __( 'The %s you are trying to convert does not exist.', 'codeclove-school-management' ), admissionLabelSingular.toLowerCase() )}
        icon={AlertTriangle}
        action={<Button size="sm" onClick={() => navigate('/students/admissions')}>{__( 'Back to Admissions', 'codeclove-school-management' )}</Button>}
      />
    )
  }

  // Capacity calculations
  const selectedGroup = groups.find((g) => String(g.id) === groupVal)
  const groupMockCount = selectedGroup ? (mockCounts?.[selectedGroup.id] || 0) : 0
  const groupCapacity = selectedGroup?.capacity ?? 30
  const isOverCapacity = selectedGroup ? (groupMockCount >= groupCapacity) : false

  const handleConvert = () => {
    convertMutation.mutate(
      {
        id: applicationId,
        session_id: Number(sessionVal),
        unit_id: Number(unitVal),
        group_id: groupVal ? Number(groupVal) : null,
        guardian_id: linkExisting && selectedGuardianId ? Number(selectedGuardianId) : null,
      },
      {
        onSuccess: () => {
          toast.success(sprintf( __( 'Applicant converted to %s successfully!', 'codeclove-school-management' ), studentLabelSingular ))
          navigate('/students/admissions')
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : '')
          toast.error(message || sprintf( __( 'Failed to convert applicant to %s', 'codeclove-school-management' ), studentLabelSingular.toLowerCase() ))
        }
      }
    )
  }

  // Pre-generate preview format strings
  const year = new Date().getFullYear()
  const nextStudentNum = settings?.identifiers?.student_number?.next_number ?? 1
  const nextAdmissionNum = settings?.identifiers?.admission_number?.next_number ?? 1

  const formatIdPreview = (format: { prefix?: string; sequence_padding?: number; year_token?: string; separator?: string } | undefined, num: number) => {
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

  // Format section select options to include capacity
  const sectionOptions = groups.map((g) => {
    const count = mockCounts?.[g.id] || 0
    const cap = g.capacity ?? 30
    const label = `${g.name} (${count}/${cap})${count >= cap ? ` [${__( 'FULL', 'codeclove-school-management' )}]` : ''}`
    return { value: String(g.id), label }
  })

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={sprintf( __( 'Approval & %s Conversion', 'codeclove-school-management' ), studentLabelSingular )}
        description={sprintf( __( 'Confirm session placement and class section assignment for %1$s %2$s.', 'codeclove-school-management' ), application.student_first_name, application.student_last_name )}
        onBack={() => navigate(`/students/admissions/${applicationId}`)}
        breadcrumbs={[
          { label: studentLabelPlural },
          { label: admissionLabelPlural, href: '/students/admissions' },
          { label: sprintf( __( '%s Details', 'codeclove-school-management' ), admissionLabelSingular ), href: `/students/admissions/${applicationId}` },
          { label: __( 'Approve & Convert', 'codeclove-school-management' ) }
        ]}
      />

      <div className="space-y-6">
        {/* Info Banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-info/5 border border-info/20 text-xs text-info leading-relaxed">
          <Eye size={15} className="flex-shrink-0 mt-0.5" />
          <p>
            {sprintf( __( 'Confirm session placement and class section assignment. CodeClove will generate permanent %s credentials.', 'codeclove-school-management' ), studentLabelSingular.toLowerCase() )}
          </p>
        </div>

        {/* Placement FormGroup Card */}
        <FormGroup
          title={__( 'Placement Configuration', 'codeclove-school-management' )}
          description={sprintf( __( 'Select the %1$s, %2$s, and %3$s to enroll this %4$s.', 'codeclove-school-management' ), sessionLabelSingular.toLowerCase(), unitLabelSingular.toLowerCase(), groupLabelSingular.toLowerCase(), studentLabelSingular.toLowerCase() )}
          icon={BookOpen}
          cols={1}
        >
          <FormField label={sessionLabelSingular} required>
            <Select
              value={sessionVal}
              onValueChange={(val) => {
                setSessionVal(val)
                setUnitVal('')
                setGroupVal('')
              }}
              options={sessions.map((s) => ({ value: String(s.id), label: s.name }))}
            />
          </FormField>

          <FormField label={unitLabelSingular} required>
            <Select
              value={unitVal}
              onValueChange={(val) => {
                setUnitVal(val)
                setGroupVal('')
              }}
              options={units.map((u) => ({ value: String(u.id), label: u.name }))}
            />
          </FormField>

          <FormField label={sprintf( __( '%s / Class Room', 'codeclove-school-management' ), groupLabelSingular )}>
            <Select
              value={groupVal}
              onValueChange={setGroupVal}
              placeholder={sprintf( __( 'Assign %s...', 'codeclove-school-management' ), groupLabelSingular )}
              options={sectionOptions}
            />
            {isOverCapacity && (
              <Alert variant="warning" title={sprintf( __( '%s Capacity Reached', 'codeclove-school-management' ), groupLabelSingular )} className="mt-2">
                {sprintf( __( 'The selected %1$s has reached its maximum capacity (%2$d/%3$d). Proceeding will override this limit.', 'codeclove-school-management' ), groupLabelSingular.toLowerCase(), groupMockCount, groupCapacity )}
              </Alert>
            )}
          </FormField>
        </FormGroup>

        {/* Guardian Link FormGroup Card */}
        <FormGroup
          title={sprintf( __( '%s Link Option', 'codeclove-school-management' ), guardianLabelSingular )}
          description={sprintf( __( 'Link this new %1$s to an existing %2$s to avoid duplicate family records.', 'codeclove-school-management' ), studentLabelSingular.toLowerCase(), guardianLabelSingular.toLowerCase() )}
          icon={Users}
          cols={1}
        >
          {/* Styled checkbox matching Settings FormCheckbox visual */}
          <div className="flex items-start gap-2.5 py-1 select-none col-span-full">
            <input
              type="checkbox"
              id="link_existing_guardian_convert"
              checked={linkExisting}
              onChange={(e) => setLinkExisting(e.target.checked)}
              className="sr-only"
            />
            <label
              htmlFor="link_existing_guardian_convert"
              className="flex items-start gap-2.5 cursor-pointer group"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 flex-shrink-0 h-4 w-4 rounded-[4px] border transition-colors duration-100 flex items-center justify-center group-hover:border-border-strong',
                  linkExisting ? 'bg-brand border-brand' : 'bg-bg-surface border-border'
                )}
              >
                <svg
                  className={cn('w-2.5 h-2.5 text-white transition-transform duration-100', linkExisting ? 'scale-100' : 'scale-0')}
                  viewBox="0 0 10 8" fill="none" stroke="currentColor"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 4l3 3 5-5" />
                </svg>
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text leading-tight">{sprintf( __( 'Link to Existing %s', 'codeclove-school-management' ), guardianLabelSingular )}</span>
                <span className="text-xs text-text-muted leading-tight mt-0.5">{__( 'Avoid duplicate records if applicant has a sibling in the school.', 'codeclove-school-management' )}</span>
              </div>
            </label>
          </div>

          {linkExisting && (
            <div className="col-span-full">
              <FormField label={sprintf( __( 'Select %s', 'codeclove-school-management' ), guardianLabelSingular )} required>
                <Select
                  value={selectedGuardianId || undefined}
                  onValueChange={setSelectedGuardianId}
                  placeholder={sprintf( __( 'Search/Select %s...', 'codeclove-school-management' ), guardianLabelSingular )}
                  options={guardians?.map((g) => ({
                    value: String(g.id),
                    label: `${g.first_name} ${g.last_name} (${g.email || __( 'No Email', 'codeclove-school-management' )})`,
                  })) ?? []}
                />
              </FormField>
            </div>
          )}
        </FormGroup>

        {/* Credentials Preview Card */}
        <Card className="p-6 space-y-4">
          <FormGroupHeader
            title={__( 'Generated Credentials Preview', 'codeclove-school-management' )}
            description={__( 'These identifiers will be permanently assigned upon conversion.', 'codeclove-school-management' )}
            icon={Hash}
          />
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-bg-surface/50 border border-border/60">
              <p className="text-text-subtle font-medium leading-none mb-1.5">{sprintf( __( '%s Number', 'codeclove-school-management' ), studentLabelSingular )}</p>
              <p className="font-mono text-text font-bold leading-none tracking-wider">{formatIdPreview(settings?.identifiers?.student_number, nextStudentNum)}</p>
            </div>
            <div className="p-3 rounded-lg bg-bg-surface/50 border border-border/60">
              <p className="text-text-subtle font-medium leading-none mb-1.5">{__( 'Admission ID', 'codeclove-school-management' )}</p>
              <p className="font-mono text-text font-bold leading-none tracking-wider">{formatIdPreview(settings?.identifiers?.admission_number, nextAdmissionNum)}</p>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={() => navigate(`/students/admissions/${applicationId}`)} disabled={convertMutation.isPending}>
            {__( 'Cancel', 'codeclove-school-management' )}
          </Button>
          <Button onClick={handleConvert} disabled={convertMutation.isPending} className="gap-1.5">
            {convertMutation.isPending && <Spinner size="xs" />}
            {__( 'Approve & Register', 'codeclove-school-management' )}
          </Button>
        </div>
      </div>
    </div>
  )
}
