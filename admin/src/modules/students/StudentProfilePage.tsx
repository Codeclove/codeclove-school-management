import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  User, Coins, BookOpen, Pencil, AlertTriangle,
  ArrowLeftRight, IdCard, KeyRound, UserX, CheckCircle2,
  Copy, History, MoreHorizontal,
  Link2, Send, PhoneCall, Mail, FileText, type LucideIcon
} from 'lucide-react'
import {
  useStudentDetails,
  useTransferStudent,
  useUnlinkPortalAccount,
  useResetPortalPassword,
  type Guardian,
} from '@/api/students'
import {
  useUnits,
  useGroups,
  useSubjects,
  useTerms,
} from '@/api/academics'
import { useStudentAttendanceHistory } from '@/api/attendance'
import {
  Button, Badge, Card, PageHeader, Spinner, EmptyState,
  Modal, ModalFooter, ConfirmDialog, FormField, Input, Select,
  TableRoot, Thead, Tbody, Tr, Th, Td, Avatar,
  Dropdown, DropdownItem, DropdownSeparator
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { useFormatter, formatGender, calculateAge, formatCountry } from '@/lib/formatter'
import { useLabels } from '@/lib/labels'
import { useSettings } from '@/api/settings'
import { useInvoices } from '@/api/finance'
import { useToast } from '@/lib/toast'
import { useSession } from '@/lib/session-context'
import { __, _n, sprintf } from '@/lib/i18n'
import { StudentIdCardSection } from '@/components/print'
import PortalAccessModal, { type PortalMemberTarget } from './components/PortalAccessModal'
import { StudentDocumentsTab } from './components/StudentDocumentsTab'
import { StudentProfileFinanceTab } from './components/StudentProfileFinanceTab'

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'active' | 'inactive' | 'graduated' | 'archived' | 'default' }
> = {
  active: { label: 'Active', variant: 'active' },
  inactive: { label: 'Inactive', variant: 'inactive' },
  graduated: { label: 'Graduated', variant: 'graduated' },
  archived: { label: 'Archived', variant: 'archived' },
}

const ENROLLMENT_STATUS_VARIANTS: Record<string, 'success' | 'brand' | 'default' | 'warning' | 'danger'> = {
  active: 'success',
  promoted: 'brand',
  completed: 'default',
  retained: 'warning',
  withdrawn: 'danger',
  transferred: 'danger',
}

const ATTENDANCE_BADGE_VARIANTS: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  half_day: 'warning',
  excused: 'info',
  holiday: 'default',
}

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>()
  const studentId = Number(id)
  const { session } = useSession()
  const navigate = useNavigate()
  const { formatDate, formatCurrency } = useFormatter()
  const { getLabel } = useLabels()
  const studentLabelSingular = getLabel('student', false, __( 'Student', 'codeclove-school-management' ))
  const studentLabelPlural = getLabel('student', true, __( 'Students', 'codeclove-school-management' ))
  const unitLabelSingular = getLabel('academic_unit', false, __( 'Class Level', 'codeclove-school-management' ))
  const groupLabelSingular = getLabel('academic_group', false, __( 'Section', 'codeclove-school-management' ))
  const guardianLabelSingular = getLabel('guardian', false, __( 'Guardian', 'codeclove-school-management' ))
  const subjectLabelPlural = getLabel('subject', true, __( 'Subjects', 'codeclove-school-management' ))

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'portal' | 'idcard' | 'enrollment' | 'finance' | 'academics' | 'documents'>('overview')
  // Portal account management state & mutations
  const unlinkPortalAccountMutation = useUnlinkPortalAccount()
  const resetPortalPasswordMutation = useResetPortalPassword()

  const [createdCreds, setCreatedCreds] = useState<{ name: string; username: string; password?: string } | null>(null)
  const [portalModalOpen, setPortalModalOpen] = useState(false)
  const [portalModalTarget, setPortalModalTarget] = useState<PortalMemberTarget | null>(null)
  const [portalModalInitialTab, setPortalModalInitialTab] = useState<'create' | 'link'>('create')

  const [revokeModalOpen, setRevokeModalOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<{
    type: 'student' | 'guardian'
    entityId: number
    guardianId?: number
    name: string
    username: string
  } | null>(null)

  // Transfer modal state
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferUnitId, setTransferUnitId] = useState('')
  const [transferGroupId, setTransferGroupId] = useState('')
  const [transferRoll, setTransferRoll] = useState('')
  const transferMutation = useTransferStudent()

  const openTransferModal = () => {
    setTransferUnitId(student?.enrollment?.academic_unit_id?.toString() ?? '')
    setTransferGroupId(student?.enrollment?.academic_group_id?.toString() ?? '')
    setTransferRoll(student?.enrollment?.roll_number ?? '')
    setTransferOpen(true)
  }

  const handleTransfer = async () => {
    if (!transferUnitId) {
      toast.error(__( 'Please select a target class.', 'codeclove-school-management' ))
      return
    }
    try {
      await transferMutation.mutateAsync({
        id: studentId,
        target_unit_id: parseInt(transferUnitId),
        target_group_id: transferGroupId ? parseInt(transferGroupId) : null,
        roll_number: transferRoll || undefined,
      })
      toast.success(__( 'Student transferred successfully.', 'codeclove-school-management' ))
      setTransferOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : '')
      toast.error(message || __( 'Transfer failed.', 'codeclove-school-management' ))
    }
  }

  const { data: student, isLoading: isStudentLoading, isError } = useStudentDetails(studentId)
  const { data: attendanceHistory, isLoading: isAttendanceLoading } = useStudentAttendanceHistory(studentId)

  const [yearFilter, setYearFilter] = useState<string>('')
  const [monthFilter, setMonthFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const toast = useToast()
  const { data: settingsData } = useSettings()
  const school = settingsData?.school

  const { data: invoicesData } = useInvoices({
    student_id: studentId,
    per_page: 100,
  })
  const invoices = useMemo(() => invoicesData?.data ?? [], [invoicesData?.data])
  const activeInvoices = useMemo(() => invoices.filter((inv) => inv.status !== 'cancelled' && inv.status !== 'void'), [invoices])
  const outstandingBalance = useMemo(() => activeInvoices.reduce((sum, inv) => sum + inv.balance_minor, 0), [activeInvoices])
  const overdueInvoicesCount = useMemo(() => invoices.filter((i) => i.status === 'overdue').length, [invoices])

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return
    void navigator.clipboard?.writeText(text).then(() => {
      toast.success(sprintf( __( '%s copied to clipboard.', 'codeclove-school-management' ), label ))
    })
  }
  const uniqueYears = useMemo(() => {
    if (!attendanceHistory) return []
    // ponytail: parse YYYY-MM-DD directly by splitting on '-' to avoid UTC midnight shifts
    const years = attendanceHistory.map((h) => {
      const [y] = (h.attendance_date || '').split('-').map(Number)
      return y
    }).filter((y): y is number => Boolean(y && !isNaN(y)))
    return Array.from(new Set(years)).sort((a, b) => b - a)
  }, [attendanceHistory])

  const filteredLogs = useMemo(() => {
    if (!attendanceHistory) return []
    return attendanceHistory.filter((h) => {
      // ponytail: split on '-' to extract year/month safely across all timezones
      const [y, m] = (h.attendance_date || '').split('-').map(Number)
      const matchYear = !yearFilter || y === Number(yearFilter)
      const matchMonth = !monthFilter || m === Number(monthFilter)
      const matchStatus = !statusFilter || h.status === statusFilter
      return matchYear && matchMonth && matchStatus
    })
  }, [attendanceHistory, yearFilter, monthFilter, statusFilter])

  const ITEMS_PER_PAGE = 10
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE)
  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  }, [filteredLogs, currentPage])

  // ponytail: single-pass tally across attendance records
  const attendanceStats = useMemo(() => {
    const counts = { total: 0, present: 0, absent: 0, late: 0, half_day: 0, excused: 0, rate: 0 }
    if (!attendanceHistory?.length) return counts
    counts.total = attendanceHistory.length
    for (const h of attendanceHistory) {
      if (h.status in counts) counts[h.status as keyof typeof counts]++
    }
    const effective = counts.present + counts.late + (counts.half_day * 0.5)
    counts.rate = Math.round((effective / counts.total) * 100)
    return counts
  }, [attendanceHistory])

  const formatAttendanceDate = (dateStr: string) => {
    if (!dateStr) return '—'
    const [y, m, d] = dateStr.split('-').map(Number)
    const localDate = y && m && d ? new Date(y, m - 1, d) : new Date(dateStr)
    if (isNaN(localDate.getTime())) return dateStr
    const weekday = localDate.toLocaleDateString(undefined, { weekday: 'short' })
    return `${weekday}, ${formatDate(dateStr)}`
  }
  // Query units & groups based on student's enrollment
  const sessionId = student?.enrollment?.academic_session_id ?? 1
  const { data: termsData } = useTerms(Number(sessionId))
  const terms = termsData ?? []
  const { data: unitData } = useUnits({ session_id: Number(sessionId), per_page: 200 })
  const { data: groupData } = useGroups({ academic_unit_id: Number(student?.enrollment?.academic_unit_id), per_page: 200 })
  // All groups in the session — used by Transfer modal to populate section options per class
  const { data: allGroupsData } = useGroups({ per_page: 500 })
  const { data: subjectData } = useSubjects({ per_page: 500 })

  const units = unitData?.data ?? []
  const groups = groupData?.data ?? []
  const allSessionGroups = allGroupsData?.data ?? []
  const subjects = subjectData?.data ?? []

  if (isStudentLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isError || !student) {
    return (
      <EmptyState
        title={sprintf( __( '%s not found', 'codeclove-school-management' ), studentLabelSingular )}
        description={sprintf( __( 'The %s record you are trying to view does not exist or has been deleted.', 'codeclove-school-management' ), studentLabelSingular.toLowerCase() )}
        icon={AlertTriangle}
        action={<Button size="sm" onClick={() => navigate('/students')}>{__( 'Back to Directory', 'codeclove-school-management' )}</Button>}
      />
    )
  }

  const matchedUnit = units.find((u) => u.id === Number(student.enrollment?.academic_unit_id))
  const matchedGroup = groups.find((g) => g.id === Number(student.enrollment?.academic_group_id))
  const currentUnitName =
    matchedUnit?.name ||
    student.enrollment?.unit_name ||
    ''
  const currentGroupName =
    matchedGroup?.name ||
    student.enrollment?.group_name ||
    ''
  const currentClassSection =
    [currentUnitName, currentGroupName].filter(Boolean).join(' • ') ||
    __( 'Not assigned', 'codeclove-school-management' )

  const rawSessionName =
    session?.label ||
    student.enrollment?.session_name ||
    __( 'Current Session', 'codeclove-school-management' )
  const sessionName = rawSessionName
  const hasDistinctStudentNumber =
    Boolean(student.student_number && student.student_number !== student.admission_number)

  const formattedAddress = (
    [student.address, student.city, student.state, student.postal_code, formatCountry(student.country)]
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      .join(', ') || __( 'No residential address recorded', 'codeclove-school-management' )
  )

  const studentSubjects = subjects.filter((s) => student.subject_ids?.includes(s.id))
  const coreSubjects = studentSubjects.filter((s) => s.type === 'core' || !s.type)
  const electiveSubjects = studentSubjects.filter((s) => s.type === 'elective')
  const otherSubjects = studentSubjects.filter((s) => s.type && s.type !== 'core' && s.type !== 'elective')
  type SubTabId = 'overview' | 'portal' | 'idcard' | 'enrollment' | 'finance' | 'academics' | 'documents'
  interface ProfileTab {
    id: SubTabId
    label: string
    icon: LucideIcon
    count?: number
  }
  const tabs: ProfileTab[] = [
    { id: 'overview', label: __( 'Overview', 'codeclove-school-management' ), icon: User },
    { id: 'academics', label: __( 'Academics', 'codeclove-school-management' ), icon: BookOpen },
    { id: 'finance', label: __( 'Finance', 'codeclove-school-management' ), icon: Coins, count: activeInvoices.length },
    { id: 'documents', label: __( 'Documents', 'codeclove-school-management' ), icon: FileText, count: student.documents?.length || 0 },
    { id: 'portal', label: __( 'Portal', 'codeclove-school-management' ), icon: KeyRound },
    { id: 'enrollment', label: __( 'Enrollment', 'codeclove-school-management' ), icon: History },
    { id: 'idcard', label: __( 'ID Card', 'codeclove-school-management' ), icon: IdCard },
  ]

  const linkedGuardiansList: (Guardian & { relationship?: string })[] =
    student.guardians && student.guardians.length > 0
      ? student.guardians
      : [
          ...(student.father ? [{ ...student.father, relationship: __( 'Father', 'codeclove-school-management' ) }] : []),
          ...(student.mother ? [{ ...student.mother, relationship: __( 'Mother', 'codeclove-school-management' ) }] : []),
          ...(student.guardian ? [{ ...student.guardian, relationship: student.relationship || guardianLabelSingular }] : []),
        ]

  // ponytail: derive primary contact from already-resolved guardian list
  const primaryGuardian = linkedGuardiansList.find(
    (g) => g.is_primary || g.id === student.primary_guardian?.id || (student.primary_contact && g.relationship?.toLowerCase() === student.primary_contact.toLowerCase())
  ) || linkedGuardiansList[0]

  const primaryGuardianContact = primaryGuardian ? {
    name: `${primaryGuardian.first_name} ${primaryGuardian.last_name}`.trim(),
    relationship: primaryGuardian.relationship || guardianLabelSingular,
    phone: primaryGuardian.phone,
    email: primaryGuardian.email,
  } : null
  const openPortalAccessModal = (member: PortalMemberTarget, initialTab: 'create' | 'link' = 'create') => {
    setPortalModalTarget(member)
    setPortalModalInitialTab(initialTab)
    setPortalModalOpen(true)
  }

  const handleSendPasswordReset = async (member: PortalMemberTarget) => {
    try {
      const res = await resetPortalPasswordMutation.mutateAsync({
        studentId,
        data: {
          type: member.type,
          guardian_id: member.guardianId,
        },
      })
      toast.success(res.message || sprintf( __( 'Password reset instructions sent for %s.', 'codeclove-school-management' ), member.name ))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : __( 'Failed to send password reset email.', 'codeclove-school-management' )
      toast.error(msg)
    }
  }

  const handleCopyPortalUrl = () => {
    const portalUrl = window.CodeCloveConfig?.portalUrl || `${window.location.origin}/student-portal/`
    navigator.clipboard?.writeText(portalUrl)
    toast.success(__( 'Portal login URL copied to clipboard.', 'codeclove-school-management' ))
  }

  const openRevokePortalModal = (
    type: 'student' | 'guardian',
    entityId: number,
    name: string,
    username: string,
    guardianId?: number
  ) => {
    setRevokeTarget({ type, entityId, guardianId, name, username })
    setRevokeModalOpen(true)
  }

  const handleConfirmRevokePortal = async () => {
    if (!revokeTarget) return
    try {
      await unlinkPortalAccountMutation.mutateAsync({
        studentId,
        data: {
          type: revokeTarget.type,
          guardian_id: revokeTarget.guardianId,
        },
      })
      toast.success(sprintf( __( 'Disconnected portal account for %s.', 'codeclove-school-management' ), revokeTarget.name ))
      setRevokeModalOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to disconnect portal account.', 'codeclove-school-management' )
      toast.error(message)
    }
  }

  const portalMembers: PortalMemberTarget[] = [
    {
      id: `student_${student.id}`,
      name: `${student.first_name} ${student.last_name}`.trim(),
      role: studentLabelSingular,
      isStudent: true,
      avatarText: 'ST',
      identifier: student.email || (student.admission_number ? sprintf( __( 'Admission: %s', 'codeclove-school-management' ), student.admission_number ) : (student.student_number ? sprintf( __( 'ID: %s', 'codeclove-school-management' ), student.student_number ) : '')),
      email: student.email || undefined,
      defaultUsername: (student.admission_number || `${student.first_name}.${student.last_name}`).toLowerCase().replace(/[^a-z0-9_.-]/g, ''),
      type: 'student' as const,
      entityId: student.id,
      guardianId: undefined,
      portalAccount: student.portal_account,
    },
    ...linkedGuardiansList.map((g) => {
      const rel = g.relationship || guardianLabelSingular
      const defaultUser = `${g.first_name}.${g.last_name}`.toLowerCase().replace(/[^a-z0-9_.-]/g, '')
      return {
        id: `guardian_${g.id}`,
        name: `${g.first_name} ${g.last_name}`.trim(),
        role: rel,
        isStudent: false,
        avatarText: rel.substring(0, 2).toUpperCase() || 'GD',
        identifier: g.email || g.phone || __( 'No contact on file', 'codeclove-school-management' ),
        email: g.email || undefined,
        defaultUsername: defaultUser || `guardian_${g.id}`,
        type: 'guardian' as const,
        entityId: g.id,
        guardianId: g.id,
        portalAccount: g.portal_account,
      }
    }),
  ]


  const age = calculateAge(student?.date_of_birth)
  const renderPortalAccessSection = () => (
    <div className="divide-y divide-border">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-text flex items-center gap-2">
            <KeyRound size={16} className="text-brand" />
            <span>{__( 'Portal Access & Accounts', 'codeclove-school-management' )}</span>
          </h4>
          <p className="text-xs text-text-muted mt-0.5">
            {__( 'Manage login accounts for this student and linked family members.', 'codeclove-school-management' )}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyPortalUrl}
          className="gap-1.5 text-xs h-7.5 px-2.5 font-medium shrink-0"
        >
          <Copy size={12} />
          <span>{__( 'Copy Portal Link', 'codeclove-school-management' )}</span>
        </Button>
      </div>

      <div className="divide-y divide-border">
        {portalMembers.map((member) => {
          const isLinked = Boolean(member.portalAccount)
          return (
            <div
              key={member.id}
              className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-hover-bg transition-colors"
            >
              {/* Left: Avatar + Identity */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    member.isStudent ? 'bg-brand/10 text-brand' : 'bg-info/10 text-info'
                  }`}
                >
                  {member.avatarText}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-text text-sm truncate">{member.name}</span>
                    <span className="text-3xs font-medium px-2 py-0.5 rounded-md bg-bg-surface border border-border text-text-muted">
                      {member.role}
                    </span>
                  </div>
                  {isLinked && member.portalAccount ? (
                    <div className="flex items-center gap-1.5 text-xs text-text-muted mt-0.5 truncate">
                      <span className="font-mono font-medium text-text">@{member.portalAccount.username}</span>
                      {member.portalAccount.email && (
                        <>
                          <span className="text-text-subtle/50">•</span>
                          <span className="truncate">{member.portalAccount.email}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      {member.identifier}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-3 shrink-0">
                {isLinked && member.portalAccount ? (
                  <>
                    <Badge variant="active" className="gap-1 px-2.5 py-1">
                      <CheckCircle2 size={12} />
                      {__( 'Active', 'codeclove-school-management' )}
                    </Badge>

                    <Dropdown
                      align="end"
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-text-muted hover:text-text rounded-lg hover:bg-bg-subtle"
                          title={__( 'Account options', 'codeclove-school-management' )}
                        >
                          <MoreHorizontal size={15} />
                        </Button>
                      }
                    >
                      <DropdownItem
                        icon={Copy}
                        label={__( 'Copy Portal Login Link', 'codeclove-school-management' )}
                        onClick={handleCopyPortalUrl}
                      />
                      <DropdownItem
                        icon={Send}
                        label={__( 'Send Password Reset Email', 'codeclove-school-management' )}
                        onClick={() => handleSendPasswordReset(member)}
                      />
                      <DropdownItem
                        icon={Link2}
                        label={__( 'Change Connected Account', 'codeclove-school-management' )}
                        onClick={() => openPortalAccessModal(member, 'link')}
                      />
                      <DropdownSeparator />
                      <DropdownItem
                        icon={UserX}
                        label={__( 'Disconnect Account', 'codeclove-school-management' )}
                        onClick={() =>
                          openRevokePortalModal(
                            member.type,
                            member.entityId,
                            member.name,
                            member.portalAccount!.username,
                            member.guardianId
                          )
                        }
                        danger
                      />
                    </Dropdown>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => openPortalAccessModal(member, 'create')}
                    className="gap-1.5 text-xs h-8 font-medium"
                  >
                    <KeyRound size={13} />
                    {__( 'Set Up Access', 'codeclove-school-management' )}
                  </Button>
                )}
              </div>
            </div>
          )
        })}

        {linkedGuardiansList.length === 0 && (
          <div className="p-4 text-center text-xs text-text-muted bg-bg-surface">
            {__( 'No legal guardians registered for this student.', 'codeclove-school-management' )}
          </div>
        )}
      </div>
    </div>
  )

  const statusLabels: Record<string, string> = {
    active: __( 'Active', 'codeclove-school-management' ),
    inactive: __( 'Inactive', 'codeclove-school-management' ),
    graduated: __( 'Graduated', 'codeclove-school-management' ),
    archived: __( 'Archived', 'codeclove-school-management' ),
  }
  const statusCfg = {
    label: statusLabels[student.status] || student.status,
    variant: STATUS_CONFIG[student.status]?.variant || 'default',
  }

  return (
    <div className="space-y-4 w-full">
      <PageHeader
        title={sprintf( __( '%s Profile', 'codeclove-school-management' ), studentLabelSingular )}
        description={__( 'Manage academic records, billing summaries, and associated family contacts.', 'codeclove-school-management' )}
        onBack={() => navigate('/students')}
        breadcrumbs={[
          { label: studentLabelPlural },
          { label: __( 'Directory', 'codeclove-school-management' ), href: '/students' },
          { label: `${student.first_name} ${student.last_name}` }
        ]}
      />

      {/* 1. Executive Student Dossier Hero Card */}
      <Card className="overflow-hidden border border-border shadow-xs">
        <div className="p-6 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Student Avatar / Photo & Primary Demographics */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0">
              <Avatar
                name={`${student.first_name} ${student.last_name}`}
                photoUrl={student.photo_url}
                size="2xl"
                shape="circle"
                className="h-16 w-16 sm:h-20 sm:w-20 ring-4 ring-bg-surface border-2 border-border shadow-xs shrink-0"
              />

              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text truncate">
                    {student.first_name} {student.last_name}
                  </h1>
                  <Badge variant={statusCfg.variant} size="sm">
                    {statusCfg.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-text-muted flex-wrap">
                  <span className="font-semibold text-text">
                    {currentClassSection}
                  </span>
                  <span className="text-text-subtle">•</span>
                  <span>{sessionName}</span>
                  {student.enrollment?.roll_number && (
                    <>
                      <span className="text-text-subtle">•</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-bg-surface text-text border border-border font-mono">
                        {sprintf( __( 'Roll #%s', 'codeclove-school-management' ), student.enrollment.roll_number )}
                      </span>
                    </>
                  )}
                </div>

                {/* Identity Metadata Badges with One-Click Copy */}
                <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
                  {student.admission_number && (
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-bg-surface px-2.5 py-1 text-xs font-medium text-text border border-border shadow-2xs">
                      <span className="text-text-subtle font-medium text-xs">
                        {__( 'Adm:', 'codeclove-school-management' )}
                      </span>
                      <span className="font-mono font-semibold text-text">{student.admission_number}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(student.admission_number || '', __( 'Admission Number', 'codeclove-school-management' ))}
                        className="text-text-subtle hover:text-brand transition-colors ml-0.5 cursor-pointer"
                        title={__( 'Copy Admission Number', 'codeclove-school-management' )}
                        aria-label={__( 'Copy Admission Number', 'codeclove-school-management' )}
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {hasDistinctStudentNumber && (
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-bg-surface px-2.5 py-1 text-xs font-medium text-text border border-border shadow-2xs">
                      <span className="text-text-subtle font-medium text-xs">
                        {sprintf( __( '%s ID:', 'codeclove-school-management' ), studentLabelSingular )}
                      </span>
                      <span className="font-mono font-semibold text-text">{student.student_number}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(student.student_number || '', sprintf( __( '%s ID', 'codeclove-school-management' ), studentLabelSingular ))}
                        className="text-text-subtle hover:text-brand transition-colors ml-0.5 cursor-pointer"
                        title={sprintf( __( 'Copy %s ID', 'codeclove-school-management' ), studentLabelSingular )}
                        aria-label={sprintf( __( 'Copy %s ID', 'codeclove-school-management' ), studentLabelSingular )}
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {student.admission_date && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-bg-surface px-2.5 py-1 text-xs font-medium text-text-muted border border-border shadow-2xs">
                      <span className="text-text-subtle font-medium">
                        {__( 'Enrolled:', 'codeclove-school-management' )}
                      </span>
                      <span className="font-semibold text-text font-mono">{formatDate(student.admission_date)}</span>
                    </span>
                  )}

                  {age !== null && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-bg-surface px-2.5 py-1 text-xs font-medium text-text-muted border border-border shadow-2xs">
                      <span className="text-text-subtle font-medium">
                        {__( 'Age:', 'codeclove-school-management' )}
                      </span>
                      <span className="font-semibold text-text">{sprintf( __( '%d yrs', 'codeclove-school-management' ), age )}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap shrink-0 self-start lg:self-center">
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate(`/students/${student.id}/edit`)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Pencil size={13} />
                <span>{__( 'Edit Student', 'codeclove-school-management' )}</span>
              </Button>

              {student.status === 'active' && student.enrollment && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={openTransferModal}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <ArrowLeftRight size={13} />
                  <span>{__( 'Transfer Class', 'codeclove-school-management' )}</span>
                </Button>
              )}

              <Dropdown
                align="end"
                trigger={
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1 text-xs font-semibold px-2.5"
                    title={__( 'More Actions', 'codeclove-school-management' )}
                  >
                    <MoreHorizontal size={14} />
                  </Button>
                }
              >
                <DropdownItem
                  icon={IdCard}
                  label={__( 'Print ID Card', 'codeclove-school-management' )}
                  onClick={() => setActiveSubTab('idcard')}
                />
                <DropdownItem
                  icon={Coins}
                  label={__( 'Create Invoice', 'codeclove-school-management' )}
                  onClick={() => navigate(`/finance/invoices/new?student_id=${studentId}&unit_id=${student.enrollment?.academic_unit_id ?? ''}`)}
                />
                <DropdownSeparator />
                <DropdownItem
                  icon={Copy}
                  label={__( 'Copy Portal Login Link', 'codeclove-school-management' )}
                  onClick={handleCopyPortalUrl}
                />
              </Dropdown>
            </div>
          </div>
        </div>

        {/* Integrated Executive Vitals Strip (Single monolithic container, divide-x) */}
        <div className="border-t border-border bg-bg-surface/50 grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* Metric 1: Attendance Standing */}
          <div className="p-4 sm:px-6 sm:py-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-text-subtle">
              <span className="font-medium">{__( 'Attendance Standing', 'codeclove-school-management' )}</span>
              <BookOpen className="w-3.5 h-3.5 opacity-70" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn(
                'text-xl font-bold font-mono tabular-nums leading-tight',
                attendanceStats.total === 0
                  ? 'text-text-subtle'
                  : attendanceStats.rate >= 90
                  ? 'text-success'
                  : attendanceStats.rate >= 75
                  ? 'text-warning'
                  : 'text-danger'
              )}>
                {attendanceStats.total > 0 ? `${attendanceStats.rate}%` : '—'}
              </span>
              <span className="text-2xs text-text-muted">
                {attendanceStats.total > 0
                  ? sprintf( __( '%1$d/%2$d sessions attended', 'codeclove-school-management' ), attendanceStats.present + attendanceStats.late + Math.floor(attendanceStats.half_day * 0.5), attendanceStats.total )
                  : __( 'No logs recorded', 'codeclove-school-management' )}
              </span>
            </div>
          </div>

          {/* Metric 2: Financial Clearance */}
          <div className="p-4 sm:px-6 sm:py-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-text-subtle">
              <span className="font-medium">{__( 'Financial Clearance', 'codeclove-school-management' )}</span>
              <Coins className="w-3.5 h-3.5 opacity-70" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn(
                'text-xl font-bold font-mono tabular-nums leading-tight',
                outstandingBalance > 0 ? 'text-danger' : 'text-success'
              )}>
                {outstandingBalance > 0 ? formatCurrency(outstandingBalance) : __( 'All Clear', 'codeclove-school-management' )}
              </span>
              <span className="text-2xs text-text-muted">
                {outstandingBalance > 0
                  ? sprintf( __( '%d overdue invoice(s)', 'codeclove-school-management' ), overdueInvoicesCount )
                  : __( 'No pending student dues', 'codeclove-school-management' )}
              </span>
            </div>
          </div>

          {/* Metric 3: Academic Curriculum */}
          <div className="p-4 sm:px-6 sm:py-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-text-subtle">
              <span className="font-medium">{__( 'Academic Placement', 'codeclove-school-management' )}</span>
              <BookOpen className="w-3.5 h-3.5 opacity-70" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono tabular-nums text-text leading-tight">
                {studentSubjects.length > 0
                  ? sprintf( __( '%d Subjects', 'codeclove-school-management' ), studentSubjects.length )
                  : (currentUnitName || __( 'Enrolled', 'codeclove-school-management' ))}
              </span>
              <span className="text-2xs text-text-muted truncate">
                {currentClassSection}
              </span>
            </div>
          </div>

          {/* Metric 4: Primary Contact */}
          <div className="p-4 sm:px-6 sm:py-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-text-subtle">
              <span className="font-medium">{__( 'Primary Contact', 'codeclove-school-management' )}</span>
              <PhoneCall className="w-3.5 h-3.5 opacity-70" />
            </div>
            {primaryGuardianContact ? (
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-text truncate">
                  {primaryGuardianContact.name} <span className="text-text-subtle font-normal text-xs">({primaryGuardianContact.relationship})</span>
                </p>
                {primaryGuardianContact.phone ? (
                  <a
                    href={`tel:${primaryGuardianContact.phone}`}
                    className="text-xs font-mono font-medium text-brand hover:underline inline-flex items-center gap-1"
                  >
                    <PhoneCall size={11} className="shrink-0" />
                    <span>{primaryGuardianContact.phone}</span>
                  </a>
                ) : primaryGuardianContact.email ? (
                  <a
                    href={`mailto:${primaryGuardianContact.email}`}
                    className="text-xs font-mono font-medium text-brand hover:underline inline-flex items-center gap-1 truncate"
                  >
                    <Mail size={11} className="shrink-0" />
                    <span className="truncate">{primaryGuardianContact.email}</span>
                  </a>
                ) : (
                  <span className="text-2xs text-text-subtle">{__( 'No direct contact', 'codeclove-school-management' )}</span>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-subtle italic">{__( 'None recorded', 'codeclove-school-management' )}</p>
            )}
          </div>
        </div>
      </Card>

      {/* 2. Unified Content Card with Embedded Tab Navigation Header */}
      <div className="bg-bg-elevated border border-border rounded-xl shadow-xs overflow-hidden mt-6">
        {/* Card Header: Tab Navigation Bar */}
        <div className="border-b border-border px-4 sm:px-6 flex items-center bg-bg-surface/30">
          {/* Left: Scrollable Underline Tabs */}
          <div
            className="flex items-center gap-1 sm:gap-2 -mb-px overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-w-0 flex-1"
            role="tablist"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeSubTab === tab.id
              return (
                <button
                  key={tab.id}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={cn(
                    'group inline-flex items-center gap-2 py-3.5 px-3 sm:px-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer select-none shrink-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                    isActive
                      ? 'border-brand text-brand font-semibold'
                      : 'border-transparent text-text-muted hover:text-text hover:border-border'
                  )}
                >
                  <Icon size={15} className={cn('transition-colors', isActive ? 'text-brand' : 'text-text-subtle group-hover:text-text')} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={cn(
                        'ms-1 px-1.5 py-0.5 rounded-full text-2xs font-bold font-mono transition-colors',
                        isActive
                          ? 'bg-brand/10 text-brand'
                          : 'bg-bg-surface border border-border text-text-subtle group-hover:text-text'
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Card Body: Active Tab Workspace */}
        <div
          role="tabpanel"
          id={`panel-${activeSubTab}`}
          aria-labelledby={`tab-${activeSubTab}`}
        >
          {/* Overview Tab: Unified Executive Dossier */}
          {activeSubTab === 'overview' && (
            <div className="divide-y divide-border">
              {/* Section 1: Academic & Demographic Details */}
              <div>
                <div className="px-6 py-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-tight text-text">
                    {__( 'Personal & Academic Details', 'codeclove-school-management' )}
                  </h2>
                </div>

              <div className="px-6 pb-6 pt-1">
                <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-5 gap-x-8 text-xs">
                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-text-muted">
                      {__( 'Admission Date', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text font-mono">
                      {student.admission_date ? formatDate(student.admission_date) : '—'}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-text-muted">
                      {__( 'Date of Birth', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text">
                      {student.date_of_birth ? (
                        <span className="font-mono">
                          {formatDate(student.date_of_birth)}
                          {age !== null && (
                            <span className="text-text-subtle text-xs font-normal ml-1.5 font-sans">
                              ({sprintf( __( '%d yrs', 'codeclove-school-management' ), age )})
                            </span>
                          )}
                        </span>
                      ) : '—'}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-text-muted">
                      {__( 'Gender', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text capitalize">
                      {formatGender(student.gender)}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-text-muted">
                      {__( 'Blood Group', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text">
                      {student.blood_group ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-danger-dim text-danger border border-danger-border font-mono">
                          {student.blood_group}
                        </span>
                      ) : (
                        <span className="text-text-subtle italic text-xs">{__( 'Not on file', 'codeclove-school-management' )}</span>
                      )}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-text-muted">
                      {__( 'Nationality', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text">
                      {formatCountry(student.country) || '—'}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-text-muted">
                      {__( 'Curriculum Enrolled', 'codeclove-school-management' )}
                    </dt>
                    <dd className="text-sm font-semibold text-text">
                      {studentSubjects.length > 0
                        ? sprintf( __( '%d Subjects', 'codeclove-school-management' ), studentSubjects.length )
                        : __( 'General Track', 'codeclove-school-management' )}
                    </dd>
                  </div>

                </dl>
              </div>
            </div>

            {/* Section 2: Contact Channels & Residence */}
            <div>
              <div className="px-6 py-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight text-text">
                  {__( 'Contact & Address Details', 'codeclove-school-management' )}
                </h2>
              </div>

              <div className="px-6 pb-6 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-text-muted block">
                      {__( 'Direct Student Email', 'codeclove-school-management' )}
                    </span>
                    {student.email ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={`mailto:${student.email}`}
                          className="text-sm font-medium text-text font-mono hover:text-brand hover:underline truncate"
                          title={student.email}
                        >
                          {student.email}
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(student.email || '', __( 'Student email', 'codeclove-school-management' ))}
                          className="p-1 rounded text-text-subtle hover:text-brand transition-colors cursor-pointer shrink-0"
                          title={__( 'Copy email address', 'codeclove-school-management' )}
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-text-subtle italic">{__( 'Not provided', 'codeclove-school-management' )}</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-medium text-text-muted block">
                      {__( 'Direct Student Mobile', 'codeclove-school-management' )}
                    </span>
                    {student.phone ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${student.phone}`}
                          className="text-sm font-semibold text-text font-mono hover:text-brand hover:underline"
                        >
                          {student.phone}
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(student.phone || '', __( 'Student phone', 'codeclove-school-management' ))}
                          className="p-1 rounded text-text-subtle hover:text-brand transition-colors cursor-pointer shrink-0"
                          title={__( 'Copy phone number', 'codeclove-school-management' )}
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-text-subtle italic">{__( 'Not provided', 'codeclove-school-management' )}</span>
                    )}
                  </div>

                  <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                    <span className="text-xs font-medium text-text-muted block">
                      {__( 'Residential Address', 'codeclove-school-management' )}
                    </span>
                    <p className="text-sm font-medium text-text leading-relaxed">
                      {formattedAddress}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Parent & Guardian Contacts */}
            <div>
              <div className="px-6 py-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight text-text">
                  {guardianLabelSingular.toLowerCase().includes('parent')
                    ? sprintf( __( '%s Contacts', 'codeclove-school-management' ), guardianLabelSingular )
                    : sprintf( __( 'Parent & %s Contacts', 'codeclove-school-management' ), guardianLabelSingular )}
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-2xs font-mono font-medium bg-bg-surface text-text-subtle border border-border">
                  {sprintf(
                    _n( '%d Contact', '%d Contacts', linkedGuardiansList.length, 'codeclove-school-management' ),
                    linkedGuardiansList.length
                  )}
                </span>
              </div>

              <div className="divide-y divide-border/60">
                {linkedGuardiansList.map((p, idx) => {
                  const isPrimary = Boolean(
                    p.is_primary ||
                    (student.primary_guardian && p.id === student.primary_guardian.id) ||
                    (student.primary_contact && p.relationship?.toLowerCase() === student.primary_contact.toLowerCase())
                  )
                  const rel = p.relationship || guardianLabelSingular

                  return (
                    <div
                      key={p.id ?? idx}
                      className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Guardian Name, Relationship, Occupation */}
                      <div className="space-y-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-text">
                            {p.first_name} {p.last_name}
                          </h4>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-bg-surface text-text-muted border border-border">
                            {rel}
                          </span>
                          {isPrimary && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-brand-dim text-brand border border-brand/20">
                              {__( 'Primary Contact', 'codeclove-school-management' )}
                            </span>
                          )}
                        </div>
                        {p.occupation && (
                          <p className="text-xs text-text-subtle capitalize">
                            {p.occupation}
                          </p>
                        )}
                      </div>

                      {/* Contact Channels (Phone & Email) */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-xs min-w-0">
                        {p.phone && (
                          <div className="flex items-center gap-1.5 font-mono">
                            <PhoneCall className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                            <a
                              href={`tel:${p.phone}`}
                              className="text-text font-medium hover:text-brand hover:underline"
                              title={__( 'Call', 'codeclove-school-management' )}
                            >
                              {p.phone}
                            </a>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(p.phone || '', __( 'Phone number', 'codeclove-school-management' ))}
                              className="p-1 rounded text-text-subtle hover:text-brand hover:bg-bg-surface transition-colors cursor-pointer"
                              title={__( 'Copy phone number', 'codeclove-school-management' )}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {p.email && (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Mail className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                            <a
                              href={`mailto:${p.email}`}
                              className="text-text font-medium hover:text-brand hover:underline truncate max-w-[220px]"
                              title={p.email}
                            >
                              {p.email}
                            </a>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(p.email || '', __( 'Email address', 'codeclove-school-management' ))}
                              className="p-1 rounded text-text-subtle hover:text-brand hover:bg-bg-surface transition-colors cursor-pointer shrink-0"
                              title={__( 'Copy email address', 'codeclove-school-management' )}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Portal Access Status */}
                      <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/40">
                        {p.portal_account ? (
                          <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <KeyRound size={12} className="text-success shrink-0" />
                            <span className="font-mono text-2xs font-medium text-text">@{p.portal_account.username}</span>
                            <Badge variant="active" size="xs">{__( 'Active Portal', 'codeclove-school-management' )}</Badge>
                          </div>
                        ) : (
                          <span className="text-2xs text-text-subtle italic">{__( 'No portal account linked', 'codeclove-school-management' )}</span>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-xs text-brand hover:bg-brand/10 font-medium"
                          onClick={() => setActiveSubTab('portal')}
                        >
                          {p.portal_account ? __( 'Manage', 'codeclove-school-management' ) : __( 'Set Up', 'codeclove-school-management' )}
                        </Button>
                      </div>
                    </div>
                  )
                })}

                {linkedGuardiansList.length === 0 && (
                  <div className="p-8 text-center text-xs text-text-muted">
                    {__( 'No legal parents or guardians registered.', 'codeclove-school-management' )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

            {activeSubTab === 'portal' && (
              renderPortalAccessSection()
            )}
            {activeSubTab === 'idcard' && (
              <div className="p-6">
                <StudentIdCardSection
                  student={student}
                  unitName={matchedUnit?.name}
                  groupName={matchedGroup?.name}
                  rollNumber={student.enrollment?.roll_number}
                  school={school}
                  sessionLabel={session?.label}
                  formatDate={formatDate}
                  studentLabel={studentLabelSingular}
                />
              </div>
            )}

            {activeSubTab === 'enrollment' && (
              <div className="divide-y divide-border">
                {/* Section 1: Current Enrollment Placement */}
                <div>
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight text-text">
                        {__( 'Current Enrollment Placement', 'codeclove-school-management' )}
                      </h2>
                    </div>
                    {student.enrollment && (
                      <Badge size="sm" variant={ENROLLMENT_STATUS_VARIANTS[student.enrollment.status] ?? 'default'} className="capitalize">
                        {student.enrollment.status}
                      </Badge>
                    )}
                  </div>

                  <div className="p-6">
                    {student.enrollment ? (
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 text-xs">
                        <div className="space-y-1">
                          <dt className="text-xs font-medium text-text-muted">{sprintf( __( 'Current %s', 'codeclove-school-management' ), unitLabelSingular )}</dt>
                          <dd className="text-sm font-semibold text-text">{matchedUnit?.name || '—'}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs font-medium text-text-muted">{sprintf( __( 'Assigned %s', 'codeclove-school-management' ), groupLabelSingular )}</dt>
                          <dd className="text-sm font-semibold text-text">{matchedGroup?.name || '—'}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs font-medium text-text-muted">{__( 'Academic Roll Number', 'codeclove-school-management' )}</dt>
                          <dd className="text-sm font-semibold font-mono text-text">{student.enrollment.roll_number || '—'}</dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs font-medium text-text-muted">{__( 'Placement Start Date', 'codeclove-school-management' )}</dt>
                          <dd className="text-sm font-semibold text-text">{formatDate(student.enrollment.starts_on)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <div className="text-center py-6 text-xs text-text-muted">{__( 'No active enrollment record found.', 'codeclove-school-management' )}</div>
                    )}
                  </div>
                </div>

                {/* Section 2: Academic Session History */}
                <div>
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight text-text">
                        {__( 'Academic Session History', 'codeclove-school-management' )}
                      </h2>
                    </div>
                    <span className="text-2xs font-mono font-medium text-text-subtle bg-bg-surface px-2.5 py-0.5 rounded-md border border-border">
                      {sprintf( __( '%d session(s) recorded', 'codeclove-school-management' ), student.enrollments?.length ?? 0 )}
                    </span>
                  </div>

                  {student.enrollments?.length ? (
                    <TableRoot>
                      <Thead>
                        <Tr>
                          <Th className="p-3.5 ps-6">{__( 'Academic Session', 'codeclove-school-management' )}</Th>
                          <Th className="p-3.5">{unitLabelSingular}</Th>
                          <Th className="p-3.5">{groupLabelSingular}</Th>
                          <Th className="p-3.5">{__( 'Roll Number', 'codeclove-school-management' )}</Th>
                          <Th className="p-3.5">{__( 'Placement Period', 'codeclove-school-management' )}</Th>
                          <Th className="p-3.5 pe-6 text-center">{__( 'Status', 'codeclove-school-management' )}</Th>
                        </Tr>
                      </Thead>
                      <Tbody className="divide-y divide-border/40 text-xs">
                        {student.enrollments.map((enr) => (
                          <Tr key={enr.id} className="hover:bg-bg-overlay/10">
                            <Td className="p-3.5 ps-6 font-medium text-text">
                              {enr.session_name || sprintf( __( 'Session #%s', 'codeclove-school-management' ), enr.academic_session_id )}
                            </Td>
                            <Td className="p-3.5 text-text-muted">
                              {enr.unit_name || sprintf( __( 'Class #%s', 'codeclove-school-management' ), enr.academic_unit_id )}
                            </Td>
                            <Td className="p-3.5 text-text-muted">
                              {enr.group_name || '—'}
                            </Td>
                            <Td className="p-3.5 font-mono text-text">
                              {enr.roll_number || '—'}
                            </Td>
                            <Td className="p-3.5 text-text-muted">
                              {enr.starts_on ? formatDate(enr.starts_on) : '—'}
                              {enr.ends_on ? ` – ${formatDate(enr.ends_on)}` : ''}
                            </Td>
                            <Td className="p-3.5 pe-6 text-center">
                              <Badge size="sm" variant={ENROLLMENT_STATUS_VARIANTS[enr.status] ?? 'default'} className="capitalize">
                                {enr.status}
                              </Badge>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </TableRoot>
                  ) : (
                    <div className="p-6 text-center text-xs text-text-muted">{__( 'No historical enrollments recorded.', 'codeclove-school-management' )}</div>
                  )}
                </div>
              </div>
            )}

            {activeSubTab === 'finance' && student && (
              <StudentProfileFinanceTab
                studentId={studentId}
                student={student}
                terms={terms}
                school={school}
              />
            )}

            {activeSubTab === 'academics' && (
              <div className="divide-y divide-border">
                {/* Section 1: Enrolled Subjects & Coursework */}
                <div>
                  <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold tracking-tight text-text">
                      {__( 'Enrolled Coursework & Subjects', 'codeclove-school-management' )}
                    </h2>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-bg-surface border border-border text-text font-mono tabular-nums shadow-2xs">
                        {sprintf( __( '%d Subjects', 'codeclove-school-management' ), studentSubjects.length )}
                      </span>
                    </div>
                  </div>

                  {studentSubjects.length === 0 ? (
                    <div className="p-8 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-1.5">
                      <BookOpen size={20} className="text-text-subtle mb-1" />
                      <p>{sprintf( __( 'No academic %s enrolled yet.', 'codeclove-school-management' ), subjectLabelPlural.toLowerCase() )}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                      {/* Left Column: Core Curriculum */}
                      <div className="p-5 sm:p-6 space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-text">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-brand shrink-0" aria-hidden="true" />
                            <span>{__( 'Core Curriculum', 'codeclove-school-management' )}</span>
                          </div>
                          <span className="text-2xs text-text-muted font-mono tabular-nums">
                            {sprintf( __( '%d subjects', 'codeclove-school-management' ), coreSubjects.length )}
                          </span>
                        </div>

                        {coreSubjects.length === 0 ? (
                          <div className="px-3.5 py-6 text-center text-xs text-text-muted border border-dashed border-border rounded-lg bg-bg-surface/30">
                            {__( 'No core subjects enrolled.', 'codeclove-school-management' )}
                          </div>
                        ) : (
                          <div className="divide-y divide-border/60 border border-border rounded-lg overflow-hidden bg-bg-surface shadow-2xs">
                            {coreSubjects.map((sub) => (
                              <div
                                key={sub.id}
                                className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-hover-bg/40 transition-colors duration-150 select-none"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {sub.code ? (
                                    <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-brand-dim text-brand tracking-wide shrink-0">
                                      {sub.code}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-2xs text-text-subtle bg-hover-bg px-1.5 py-0.5 rounded shrink-0">—</span>
                                  )}
                                  <span className="font-medium text-text truncate">{sub.name}</span>
                                </div>
                                <span className="text-3xs font-semibold uppercase px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 shrink-0 font-mono tracking-wide">
                                  {__( 'Core', 'codeclove-school-management' )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right Column: Electives & Tracks */}
                      <div className="p-5 sm:p-6 space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-text">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
                            <span>{__( 'Electives & Specializations', 'codeclove-school-management' )}</span>
                          </div>
                          <span className="text-2xs text-text-muted font-mono tabular-nums">
                            {sprintf( __( '%d subjects', 'codeclove-school-management' ), electiveSubjects.length + otherSubjects.length )}
                          </span>
                        </div>

                        {electiveSubjects.length === 0 && otherSubjects.length === 0 ? (
                          <div className="px-3.5 py-6 text-center text-xs text-text-muted border border-dashed border-border rounded-lg bg-bg-surface/30">
                            {__( 'No elective tracks enrolled.', 'codeclove-school-management' )}
                          </div>
                        ) : (
                          <div className="divide-y divide-border/60 border border-border rounded-lg overflow-hidden bg-bg-surface shadow-2xs">
                            {[...electiveSubjects, ...otherSubjects].map((sub) => (
                              <div
                                key={sub.id}
                                className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-hover-bg/40 transition-colors duration-150 select-none"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {sub.code ? (
                                    <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-hover-bg text-text-subtle tracking-wide shrink-0">
                                      {sub.code}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-2xs text-text-subtle bg-hover-bg px-1.5 py-0.5 rounded shrink-0">—</span>
                                  )}
                                  <span className="font-medium text-text truncate">{sub.name}</span>
                                </div>
                                <span className="text-3xs font-semibold uppercase px-2 py-0.5 rounded-full bg-bg-elevated text-text-subtle border border-border shrink-0 font-mono tracking-wide">
                                  {sub.type === 'activity' ? __( 'Activity', 'codeclove-school-management' ) : __( 'Elective', 'codeclove-school-management' )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Attendance Standing & Metrics */}
                <div>
                  <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight text-text">
                        {__( 'Attendance Standing & History', 'codeclove-school-management' )}
                      </h2>
                    </div>

                    {/* Integrated Filters Toolbar */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs">
                        <select
                          value={yearFilter}
                          onChange={(e) => {
                            setYearFilter(e.target.value)
                            setCurrentPage(1)
                          }}
                          className="bg-bg-surface border border-border rounded-md px-2 py-1 text-xs text-text outline-none focus:ring-1 focus:ring-brand-ring cursor-pointer"
                        >
                          <option value="">{__( 'All Years', 'codeclove-school-management' )}</option>
                          {uniqueYears.map((y) => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs">
                        <select
                          value={monthFilter}
                          onChange={(e) => {
                            setMonthFilter(e.target.value)
                            setCurrentPage(1)
                          }}
                          className="bg-bg-surface border border-border rounded-md px-2 py-1 text-xs text-text outline-none focus:ring-1 focus:ring-brand-ring cursor-pointer"
                        >
                          <option value="">{__( 'All Months', 'codeclove-school-management' )}</option>
                          {[
                            { v: '1', l: __( 'January', 'codeclove-school-management' ) },
                            { v: '2', l: __( 'February', 'codeclove-school-management' ) },
                            { v: '3', l: __( 'March', 'codeclove-school-management' ) },
                            { v: '4', l: __( 'April', 'codeclove-school-management' ) },
                            { v: '5', l: __( 'May', 'codeclove-school-management' ) },
                            { v: '6', l: __( 'June', 'codeclove-school-management' ) },
                            { v: '7', l: __( 'July', 'codeclove-school-management' ) },
                            { v: '8', l: __( 'August', 'codeclove-school-management' ) },
                            { v: '9', l: __( 'September', 'codeclove-school-management' ) },
                            { v: '10', l: __( 'October', 'codeclove-school-management' ) },
                            { v: '11', l: __( 'November', 'codeclove-school-management' ) },
                            { v: '12', l: __( 'December', 'codeclove-school-management' ) },
                          ].map((m) => (
                            <option key={m.v} value={m.v}>{m.l}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs">
                        <select
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value)
                            setCurrentPage(1)
                          }}
                          className="bg-bg-surface border border-border rounded-md px-2 py-1 text-xs text-text outline-none focus:ring-1 focus:ring-brand-ring capitalize cursor-pointer"
                        >
                          <option value="">{__( 'All Statuses', 'codeclove-school-management' )}</option>
                          {['present', 'absent', 'late', 'half_day', 'excused', 'holiday'].map((st) => (
                            <option key={st} value={st} className="capitalize">{st.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Ribbon with Vertical Hairline Dividers */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-border bg-bg-surface/30 border-b border-border">
                    {[
                      { label: __( 'Attendance Rate', 'codeclove-school-management' ), value: `${attendanceStats.rate}%`, color: attendanceStats.rate >= 75 ? 'text-success' : 'text-danger' },
                      { label: __( 'Present', 'codeclove-school-management' ), value: sprintf( __( '%d days', 'codeclove-school-management' ), attendanceStats.present ), color: 'text-success' },
                      { label: __( 'Late', 'codeclove-school-management' ), value: sprintf( __( '%d days', 'codeclove-school-management' ), attendanceStats.late ), color: 'text-warning' },
                      { label: __( 'Half Day', 'codeclove-school-management' ), value: sprintf( __( '%d days', 'codeclove-school-management' ), attendanceStats.half_day ), color: 'text-warning' },
                      { label: __( 'Absent', 'codeclove-school-management' ), value: sprintf( __( '%d days', 'codeclove-school-management' ), attendanceStats.absent ), color: 'text-danger' },
                    ].map((stat) => (
                      <div key={stat.label} className="p-4 space-y-1">
                        <span className="text-2xs text-text-muted uppercase tracking-wider font-semibold block">{stat.label}</span>
                        <span className={cn('text-lg font-bold block', stat.color)}>{stat.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Attendance Log Table */}
                  {isAttendanceLoading ? (
                    <div className="flex justify-center py-12"><Spinner /></div>
                  ) : !attendanceHistory || attendanceHistory.length === 0 ? (
                    <div className="p-8 text-center text-xs text-text-muted italic">{__( 'No attendance records found for this student.', 'codeclove-school-management' )}</div>
                  ) : (
                    <div>
                      <TableRoot>
                        <Thead>
                          <Tr>
                            <Th className="p-3.5 ps-6">{__( 'Date', 'codeclove-school-management' )}</Th>
                            <Th className="p-3.5 text-center">{__( 'Status', 'codeclove-school-management' )}</Th>
                            <Th className="p-3.5 pe-6">{__( 'Note / Remarks', 'codeclove-school-management' )}</Th>
                          </Tr>
                        </Thead>
                        <Tbody className="divide-y divide-border/40 text-xs">
                          {paginatedLogs.map((h) => (
                            <Tr key={h.id} className="hover:bg-bg-overlay/10">
                              <Td className="p-3.5 ps-6 font-mono text-text">
                                {formatAttendanceDate(h.attendance_date)}
                              </Td>
                              <Td className="p-3.5 text-center">
                                <Badge size="sm" variant={ATTENDANCE_BADGE_VARIANTS[h.status] || 'default'} className="capitalize">
                                  {h.status.replace('_', ' ')}
                                </Badge>
                              </Td>
                              <Td className="p-3.5 pe-6 text-text-muted italic">
                                {h.note || '—'}
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </TableRoot>

                      {/* Pagination Footer */}
                      {totalPages > 1 && (
                        <div className="border-t border-border px-6 py-3 flex justify-between items-center text-xs text-text-muted bg-bg-surface/20">
                          <span>
                            {sprintf(
                              __( 'Showing %1$d to %2$d of %3$d logs', 'codeclove-school-management' ),
                              ((currentPage - 1) * ITEMS_PER_PAGE) + 1,
                              Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length),
                              filteredLogs.length
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={currentPage === 1}
                              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                              className="h-7 px-3 text-2xs"
                            >
                              {__( 'Previous', 'codeclove-school-management' )}
                            </Button>
                            <span className="font-semibold text-text">
                              {sprintf( __( 'Page %1$d of %2$d', 'codeclove-school-management' ), currentPage, totalPages )}
                            </span>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={currentPage === totalPages}
                              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                              className="h-7 px-3 text-2xs"
                            >
                              {__( 'Next', 'codeclove-school-management' )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSubTab === 'documents' && (
              <StudentDocumentsTab student={student} studentId={studentId} />
            )}
        </div>
      </div>

      {/* Transfer Class Modal */}
      {transferOpen && (() => {
        // Groups filtered to whatever unit is selected in the modal
        const transferGroups = allSessionGroups.filter(
          (g) => transferUnitId && g.unit_id === parseInt(transferUnitId)
        )
        const unitOptions = units.map((u) => ({ value: u.id.toString(), label: u.name }))
        const groupOptions = transferGroups.map((g) => ({ value: g.id.toString(), label: g.name }))

        return (
          <Modal
            open={transferOpen}
            onOpenChange={setTransferOpen}
            title={sprintf( __( 'Transfer %1$s %2$s', 'codeclove-school-management' ), studentLabelSingular, unitLabelSingular )}
            description={sprintf( __( 'Move %1$s %2$s to a different %3$s or %4$s within the current academic session.', 'codeclove-school-management' ), student.first_name, student.last_name, unitLabelSingular, groupLabelSingular )}
          >
            <div className="space-y-4 p-1">
              <div className="p-3 rounded-lg bg-bg-surface border border-border text-xs text-text-muted">
                {__( 'Currently enrolled in', 'codeclove-school-management' )}{' '}
                <span className="font-semibold text-text">{matchedUnit?.name || '—'}</span>
                {matchedGroup && (
                  <> · <span className="font-semibold text-text">{matchedGroup.name}</span></>
                )}
              </div>

              <FormField label={sprintf( __( 'Target %s', 'codeclove-school-management' ), unitLabelSingular )} required>
                <Select
                  value={transferUnitId}
                  onValueChange={(val) => {
                    setTransferUnitId(val)
                    setTransferGroupId('')
                  }}
                  options={unitOptions}
                  placeholder={sprintf( __( 'Select %s', 'codeclove-school-management' ), unitLabelSingular )}
                />
              </FormField>

              {groupOptions.length > 0 && (
                <FormField label={sprintf( __( 'Target %s', 'codeclove-school-management' ), groupLabelSingular )}>
                  <Select
                    value={transferGroupId}
                    onValueChange={setTransferGroupId}
                    options={groupOptions}
                    placeholder={sprintf( __( 'Select %s', 'codeclove-school-management' ), groupLabelSingular )}
                  />
                </FormField>
              )}

              <FormField label={__( 'New Roll Number (optional)', 'codeclove-school-management' )}>
                <Input
                  value={transferRoll}
                  onChange={(e) => setTransferRoll(e.target.value)}
                  placeholder={__( 'Leave blank to keep current', 'codeclove-school-management' )}
                />
              </FormField>
            </div>

            <ModalFooter>
              <Button variant="secondary" onClick={() => setTransferOpen(false)}>
                {__( 'Cancel', 'codeclove-school-management' )}
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={transferMutation.isPending || !transferUnitId}
              >
                {transferMutation.isPending ? __( 'Transferring…', 'codeclove-school-management' ) : __( 'Confirm Transfer', 'codeclove-school-management' )}
              </Button>
            </ModalFooter>
          </Modal>
        )
      })()}

      {/* Set Up Portal Access Modal */}
      {portalModalOpen && portalModalTarget && (
        <PortalAccessModal
          open={portalModalOpen}
          onOpenChange={setPortalModalOpen}
          studentId={studentId}
          member={portalModalTarget}
          initialTab={portalModalInitialTab}
          onSuccess={(creds) => {
            if (creds?.password && !portalModalTarget.email) {
              setCreatedCreds(creds)
            }
          }}
        />
      )}

      {/* Credentials Created Modal */}
      {createdCreds && (
        <Modal
          open={Boolean(createdCreds)}
          onOpenChange={(open) => {
            if (!open) setCreatedCreds(null)
          }}
          title={__( 'Portal Credentials Created', 'codeclove-school-management' )}
          description={sprintf( __( 'Portal access enabled for %s. Share these credentials so they can sign in.', 'codeclove-school-management' ), createdCreds.name )}
        >
          <div className="space-y-3 p-1">
            <div className="bg-bg-surface rounded-xl border border-border p-4 space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-sans font-medium">{__( 'Username:', 'codeclove-school-management' )}</span>
                <span className="font-semibold text-text">@{createdCreds.username}</span>
              </div>
              {createdCreds.password && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted font-sans font-medium">{__( 'Password:', 'codeclove-school-management' )}</span>
                  <span className="font-semibold text-brand">{createdCreds.password}</span>
                </div>
              )}
            </div>
            <p className="text-3xs text-text-muted">
              {__( 'These credentials can be used directly on the portal login page.', 'codeclove-school-management' )}
            </p>
          </div>
          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => {
                const text = `Username: ${createdCreds.username}\nPassword: ${createdCreds.password || ''}`
                void navigator.clipboard?.writeText(text).then(() => {
                  toast.success(__( 'Credentials copied to clipboard.', 'codeclove-school-management' ))
                })
              }}
              className="gap-1.5"
            >
              <Copy size={13} />
              {__( 'Copy Credentials', 'codeclove-school-management' )}
            </Button>
            <Button onClick={() => setCreatedCreds(null)}>
              {__( 'Done', 'codeclove-school-management' )}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Disconnect Portal Access Modal */}
      {revokeModalOpen && revokeTarget && (
        <ConfirmDialog
          open={revokeModalOpen}
          onOpenChange={setRevokeModalOpen}
          onConfirm={handleConfirmRevokePortal}
          title={__( 'Disconnect Portal Account', 'codeclove-school-management' )}
          description={sprintf(
            __( 'Are you sure you want to disconnect @%1$s from %2$s?', 'codeclove-school-management' ),
            revokeTarget.username,
            revokeTarget.name
          )}
          variant="danger"
          confirmText={__( 'Disconnect Account', 'codeclove-school-management' )}
          isLoading={unlinkPortalAccountMutation.isPending}
        >
          <div className="p-3 rounded-lg bg-danger/5 border border-danger/20 text-xs text-text space-y-2">
            <p className="font-semibold text-danger flex items-center gap-1.5">
              <AlertTriangle size={15} />
              {__( 'Account will be disconnected', 'codeclove-school-management' )}
            </p>
            <p className="text-text-muted">
              {sprintf(
                __( 'This will disconnect the WordPress login account from this %s record. Their WordPress user account will remain safe and will not be deleted.', 'codeclove-school-management' ),
                revokeTarget.type === 'student' ? studentLabelSingular.toLowerCase() : guardianLabelSingular.toLowerCase()
              )}
            </p>
          </div>
        </ConfirmDialog>
      )}
    </div>
  )
}
