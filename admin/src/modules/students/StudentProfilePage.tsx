import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  User, RefreshCw, Coins, BookOpen, Pencil, AlertTriangle, MapPin, Users,
  Eye, Printer, ArrowLeftRight, IdCard, KeyRound, UserX, CheckCircle2,
  UserPlus, Copy, History, Receipt, Plus
} from 'lucide-react'
import {
  useStudentDetails,
  useTransferStudent,
  useCreatePortalAccount,
  useUnlinkPortalAccount,
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
  Button, Badge, Card, PageHeader, Spinner, EmptyState, FormGroupHeader,
  Modal, ModalFooter, FormField, Input, Select, Skeleton,
  TableRoot, Thead, Tbody, Tr, Th, Td, TableEmpty
} from '@/components/ui'
import { TablePagination } from '@/components/ui/TablePagination'
import { cn } from '@/lib/utils'
import { useInvoices, usePayments, type Invoice, type Payment } from '@/api/finance'
import { getStatusVariant, getMethodLabel } from '@/modules/finance/finance-utils'
import { useFormatter, formatGender } from '@/lib/formatter'
import { useLabels } from '@/lib/labels'
import { useSettings } from '@/api/settings'
import { api } from '@/lib/api-client'
import { useToast } from '@/lib/toast'
import { printElement } from '@/lib/print'
import { useSession } from '@/lib/session-context'
import { __, sprintf } from '@/lib/i18n'
import PrintInvoiceSheet from '../finance/PrintInvoiceSheet'
import PrintPaymentReceipt from '../finance/PrintPaymentReceipt'
import { StudentIdCardSection } from '@/components/print'

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

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'portal' | 'idcard' | 'enrollment' | 'finance' | 'academics'>('overview')

  // Portal account management state & mutations
  const createPortalAccountMutation = useCreatePortalAccount()
  const unlinkPortalAccountMutation = useUnlinkPortalAccount()

  const [enablingId, setEnablingId] = useState<string | null>(null)
  const [createdCreds, setCreatedCreds] = useState<{ name: string; username: string; password?: string } | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createTarget, setCreateTarget] = useState<{
    type: 'student' | 'guardian'
    entityId: number
    guardianId?: number
    name: string
  } | null>(null)
  const [formUsername, setFormUsername] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formSendEmail, setFormSendEmail] = useState(true)

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

  const [financePage, setFinancePage] = useState<number>(1)
  const [paymentPage, setPaymentPage] = useState<number>(1)
  const [selectedTermFilter, setSelectedTermFilter] = useState<string>('all')

  const toast = useToast()
  const { data: settingsData } = useSettings()
  const school = settingsData?.school

  // Finance tab selections
  const [financeTab, setFinanceTab] = useState<'ledger' | 'history'>('ledger')

  // Printing states
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null)
  const [printingPayment, setPrintingPayment] = useState<Payment | null>(null)
  const [isPrintLoading, setIsPrintLoading] = useState<number | null>(null)
  const [printType, setPrintType] = useState<'invoice' | 'receipt' | 'badge' | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  // Trigger print logic after data resolution
  useEffect(() => {
    if (printType === 'invoice' && printingInvoice && printRef.current) {
      printElement(printRef.current)
      setPrintingInvoice(null)
      setPrintType(null)
    } else if (printType === 'receipt' && printingPayment && printingInvoice && printRef.current) {
      printElement(printRef.current)
      setPrintingPayment(null)
      setPrintingInvoice(null)
      setPrintType(null)
    } else if (printType === 'badge' && printRef.current) {
      printElement(printRef.current)
      setPrintType(null)
    }
  }, [printingInvoice, printingPayment, printType])

  const handlePrintInvoice = async (inv: Invoice) => {
    setIsPrintLoading(inv.id)
    setPrintType('invoice')
    try {
      const res = await api.get<Invoice>(`invoices/${inv.id}`)
      setPrintingInvoice(res.data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : '')
      toast.error(message || __( 'Failed to fetch invoice details for printing.', 'codeclove-school-management' ))
      setPrintType(null)
    } finally {
      setIsPrintLoading(null)
    }
  }

  const handlePrintReceipt = async (payment: Payment) => {
    setIsPrintLoading(payment.id)
    setPrintType('receipt')
    try {
      const res = await api.get<Invoice>(`invoices/${payment.invoice_id}`)
      setPrintingInvoice(res.data)
      setPrintingPayment(payment)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : '')
      toast.error(message || __( 'Failed to fetch invoice details for printing.', 'codeclove-school-management' ))
      setPrintType(null)
    } finally {
      setIsPrintLoading(null)
    }
  }

  const { data: invoicesData, isLoading: isInvoicesLoading } = useInvoices({
    student_id: studentId,
    per_page: 100,
  })
  const { data: paymentsData, isLoading: isPaymentsLoading } = usePayments({
    student_id: studentId,
    per_page: 100,
  })

  const invoices = invoicesData?.data ?? []
  const payments = paymentsData?.data ?? []

  const activeInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status !== 'cancelled' && inv.status !== 'void')
  }, [invoices])

  const totalBilled = useMemo(() => {
    return activeInvoices.reduce((sum, inv) => sum + inv.total_minor, 0)
  }, [activeInvoices])

  const totalPaid = useMemo(() => {
    return activeInvoices.reduce((sum, inv) => sum + inv.paid_minor, 0)
  }, [activeInvoices])

  const outstandingBalance = useMemo(() => {
    return activeInvoices.reduce((sum, inv) => sum + inv.balance_minor, 0)
  }, [activeInvoices])

  const handleTermFilterChange = (val: string) => {
    setSelectedTermFilter(val)
    setFinancePage(1)
  }

  const filteredInvoices = useMemo(() => {
    if (selectedTermFilter === 'all') {
      return invoices
    }
    const termId = Number(selectedTermFilter)
    return invoices.filter((inv) => inv.academic_term_id === termId)
  }, [invoices, selectedTermFilter])

  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => new Date(b.paid_on).getTime() - new Date(a.paid_on).getTime())
  }, [payments])

  const FINANCE_ITEMS_PER_PAGE = 5
  const paginatedInvoices = useMemo(() => {
    return filteredInvoices.slice((financePage - 1) * FINANCE_ITEMS_PER_PAGE, financePage * FINANCE_ITEMS_PER_PAGE)
  }, [filteredInvoices, financePage])
  const paginatedPayments = useMemo(() => {
    return sortedPayments.slice((paymentPage - 1) * FINANCE_ITEMS_PER_PAGE, paymentPage * FINANCE_ITEMS_PER_PAGE)
  }, [sortedPayments, paymentPage])
  const uniqueYears = useMemo(() => {
    if (!attendanceHistory) return []
    const years = attendanceHistory.map(h => new Date(h.attendance_date).getFullYear())
    return Array.from(new Set(years)).sort((a, b) => b - a)
  }, [attendanceHistory])

  const filteredLogs = useMemo(() => {
    if (!attendanceHistory) return []
    return attendanceHistory.filter((h) => {
      const dateObj = new Date(h.attendance_date)
      const matchYear = !yearFilter || dateObj.getFullYear() === Number(yearFilter)
      const matchMonth = !monthFilter || (dateObj.getMonth() + 1) === Number(monthFilter)
      const matchStatus = !statusFilter || h.status === statusFilter
      return matchYear && matchMonth && matchStatus
    })
  }, [attendanceHistory, yearFilter, monthFilter, statusFilter])

  const ITEMS_PER_PAGE = 10
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE)
  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  }, [filteredLogs, currentPage])

  // Query units & groups based on student's enrollment
  const sessionId = student?.enrollment?.academic_session_id ?? 1
  const { data: termsData } = useTerms(Number(sessionId))
  const { data: unitData } = useUnits({ session_id: Number(sessionId) })
  const { data: groupData } = useGroups({ academic_unit_id: Number(student?.enrollment?.academic_unit_id) })
  // All groups in the session — used by Transfer modal to populate section options per class
  const { data: allGroupsData } = useGroups({ per_page: 500 })
  const { data: subjectData } = useSubjects()

  const units = unitData?.data ?? []
  const groups = groupData?.data ?? []
  const allSessionGroups = allGroupsData?.data ?? []
  const subjects = subjectData?.data ?? []

  if (isStudentLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded" />
          <Skeleton className="h-4 w-96 rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <div className="lg:col-span-1">
            <Card className="p-6 flex flex-col items-center space-y-4">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="space-y-2 w-full flex flex-col items-center">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
              <div className="w-full border-t border-border/60 my-2" />
              <div className="w-full space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </Card>
          </div>
          <div className="lg:col-span-3 space-y-6">
            <Card className="p-6 space-y-4">
              <div className="flex gap-2 border-b border-border/60 pb-3">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-32 rounded-lg" />
              </div>
              <div className="space-y-4 pt-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
              </div>
            </Card>
          </div>
        </div>
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

  const matchedUnit = units.find((u) => u.id === student.enrollment?.academic_unit_id)
  const matchedGroup = groups.find((g) => g.id === student.enrollment?.academic_group_id)
  const studentSubjects = subjects.filter((s) => student.subject_ids?.includes(s.id))

  const tabs = [
    { id: 'overview', label: __( 'Overview', 'codeclove-school-management' ), icon: User },
    { id: 'portal', label: __( 'Portal Access', 'codeclove-school-management' ), icon: KeyRound },
    { id: 'idcard', label: __( 'ID Card', 'codeclove-school-management' ), icon: IdCard },
    { id: 'enrollment', label: __( 'Enrollment History', 'codeclove-school-management' ), icon: History },
    { id: 'finance', label: __( 'Finance & Invoices', 'codeclove-school-management' ), icon: Coins },
    { id: 'academics', label: __( 'Academics & Attendance', 'codeclove-school-management' ), icon: BookOpen },
  ] as const

  const linkedGuardiansList: (Guardian & { relationship?: string })[] =
    student.guardians && student.guardians.length > 0
      ? student.guardians
      : [
          ...(student.father ? [{ ...student.father, relationship: __( 'Father', 'codeclove-school-management' ) }] : []),
          ...(student.mother ? [{ ...student.mother, relationship: __( 'Mother', 'codeclove-school-management' ) }] : []),
          ...(student.guardian ? [{ ...student.guardian, relationship: student.relationship || guardianLabelSingular }] : []),
        ]

  const openCreatePortalModal = (
    type: 'student' | 'guardian',
    entityId: number,
    name: string,
    defaultUsername: string,
    defaultEmail: string,
    guardianId?: number
  ) => {
    const cleanUsername = defaultUsername.toLowerCase().replace(/[^a-z0-9_.-]/g, '')
    setCreateTarget({ type, entityId, guardianId, name })
    setFormUsername(cleanUsername || (type === 'student' ? `student_${entityId}` : `guardian_${entityId}`))
    setFormEmail(defaultEmail || '')
    setFormPassword('')
    setFormSendEmail(true)
    setCreateModalOpen(true)
  }

  const handleConfirmCreatePortal = async () => {
    if (!createTarget) return
    if (!formUsername.trim()) {
      toast.error(__( 'Username is required.', 'codeclove-school-management' ))
      return
    }

    try {
      const res = await createPortalAccountMutation.mutateAsync({
        studentId,
        data: {
          type: createTarget.type,
          guardian_id: createTarget.guardianId,
          username: formUsername.trim(),
          email: formEmail.trim() || undefined,
          password: formPassword.trim() || undefined,
          send_email: formSendEmail && Boolean(formEmail.trim()),
        },
      })
      setCreateModalOpen(false)
      if (res.password && !formEmail.trim()) {
        setCreatedCreds({
          name: createTarget.name,
          username: res.username,
          password: res.password,
        })
      } else {
        toast.success(sprintf( __( 'Portal account created for %1$s (@%2$s).', 'codeclove-school-management' ), createTarget.name, res.username ))
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to create portal account.', 'codeclove-school-management' )
      toast.error(message)
    }
  }

  const handleQuickEnable = async (member: {
    id: string
    name: string
    type: 'student' | 'guardian'
    entityId: number
    guardianId?: number
    defaultUsername: string
    email?: string
  }) => {
    setEnablingId(member.id)
    try {
      const res = await createPortalAccountMutation.mutateAsync({
        studentId,
        data: {
          type: member.type,
          guardian_id: member.guardianId,
          username: member.defaultUsername,
          email: member.email,
          send_email: Boolean(member.email),
        },
      })
      if (res.password && !member.email) {
        setCreatedCreds({
          name: member.name,
          username: res.username,
          password: res.password,
        })
      } else {
        toast.success(
          member.email
            ? sprintf( __( 'Portal access enabled for %1$s (@%2$s). Login details sent.', 'codeclove-school-management' ), member.name, res.username )
            : sprintf( __( 'Portal access enabled for %1$s (@%2$s).', 'codeclove-school-management' ), member.name, res.username )
        )
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to create portal account.', 'codeclove-school-management' )
      toast.error(message)
    } finally {
      setEnablingId(null)
    }
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
      toast.success(sprintf( __( 'Portal access unlinked for %s.', 'codeclove-school-management' ), revokeTarget.name ))
      setRevokeModalOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to unlink portal account.', 'codeclove-school-management' )
      toast.error(message)
    }
  }

  const portalMembers = [
    {
      id: `student_${student.id}`,
      name: `${student.first_name} ${student.last_name}`.trim(),
      role: studentLabelSingular,
      isStudent: true,
      avatarText: 'ST',
      identifier: student.admission_number
        ? sprintf( __( 'Admission: %s', 'codeclove-school-management' ), student.admission_number )
        : (student.student_number ? sprintf( __( 'ID: %s', 'codeclove-school-management' ), student.student_number ) : __( 'Student Profile', 'codeclove-school-management' )),
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
        identifier: g.email ? sprintf( __( 'Email: %s', 'codeclove-school-management' ), g.email ) : (g.phone ? sprintf( __( 'Phone: %s', 'codeclove-school-management' ), g.phone ) : __( 'No contact on file', 'codeclove-school-management' )),
        email: g.email || undefined,
        defaultUsername: defaultUser || `guardian_${g.id}`,
        type: 'guardian' as const,
        entityId: g.id,
        guardianId: g.id,
        portalAccount: g.portal_account,
      }
    }),
  ]

  const renderPortalAccessSection = () => (
    <div className="rounded-xl border border-border bg-bg-surface overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-text flex items-center gap-2">
            <KeyRound size={16} className="text-brand" />
            {__( 'Portal Access & Accounts', 'codeclove-school-management' )}
          </h4>
          <p className="text-xs text-text-muted mt-0.5">
            {__( 'Manage login accounts for this student and linked family members.', 'codeclove-school-management' )}
          </p>
        </div>
      </div>

      <div className="divide-y divide-border">
        {portalMembers.map((member) => {
          const isLinked = Boolean(member.portalAccount)
          const isPending = enablingId === member.id

          return (
            <div
              key={member.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-bg-base/30 transition-colors"
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
                    <span className="text-3xs font-medium px-2 py-0.5 rounded-md bg-bg-base border border-border text-text-muted">
                      {member.role}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted truncate mt-0.5">
                    {member.identifier}
                  </p>
                </div>
              </div>

              {/* Right: Status badge + Actions */}
              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                {isLinked && member.portalAccount ? (
                  <>
                    <div className="text-right hidden md:block">
                      <span className="font-mono text-xs font-semibold text-text block">
                        @{member.portalAccount.username}
                      </span>
                      {member.portalAccount.email && (
                        <span
                          className="text-3xs text-text-muted block truncate max-w-[160px]"
                          title={member.portalAccount.email}
                        >
                          {member.portalAccount.email}
                        </span>
                      )}
                    </div>
                    <Badge variant="active" className="gap-1 px-2.5 py-1">
                      <CheckCircle2 size={12} />
                      {__( 'Active', 'codeclove-school-management' )}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        openRevokePortalModal(
                          member.type,
                          member.entityId,
                          member.name,
                          member.portalAccount!.username,
                          member.guardianId
                        )
                      }
                      className="text-text-danger hover:text-text-danger hover:bg-danger/10 text-xs h-8 px-2.5"
                    >
                      <UserX size={13} className="mr-1" />
                      {__( 'Revoke', 'codeclove-school-management' )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="default" className="px-2.5 py-1 text-text-muted">
                      {__( 'No Access', 'codeclove-school-management' )}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => handleQuickEnable(member)}
                        disabled={isPending}
                        className="gap-1.5 text-xs h-8"
                      >
                        {isPending ? <Spinner size="xs" /> : <UserPlus size={13} />}
                        {__( 'Enable Access', 'codeclove-school-management' )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          openCreatePortalModal(
                            member.type,
                            member.entityId,
                            member.name,
                            member.defaultUsername,
                            member.email || '',
                            member.guardianId
                          )
                        }
                        title={__( 'Customize account details before creating', 'codeclove-school-management' )}
                        className="text-text-muted hover:text-text text-xs h-8 px-2"
                      >
                        {__( 'Customize', 'codeclove-school-management' )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}

        {linkedGuardiansList.length === 0 && (
          <div className="p-4 text-center text-xs text-text-muted bg-bg-base/20">
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
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column - Profile Sidebar Card */}
        <div className="lg:col-span-1">
          <Card className="p-6 flex flex-col items-center text-center space-y-4">
            {student.photo_url ? (
              <div className="w-20 h-20 rounded-full border-4 border-brand/10 shadow-sm overflow-hidden flex-shrink-0 select-none relative">
                <img src={student.photo_url} alt={`${student.first_name} ${student.last_name}`} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-dim border-4 border-brand/10 shadow-sm flex items-center justify-center text-brand font-bold text-2xl flex-shrink-0 select-none">
                {student.first_name[0] ?? ''}{student.last_name[0] ?? ''}
              </div>
            )}
            <div className="space-y-1">
              <h2 className="text-base font-bold text-text">
                {student.first_name} {student.last_name}
              </h2>
              <div className="flex justify-center">
                <Badge variant={statusCfg.variant as any} size="sm">
                  {statusCfg.label.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="w-full border-t border-border/60 my-2"></div>

            <div className="w-full space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border/30 items-center">
                <span className="text-text-muted">{sprintf( __( '%s ID', 'codeclove-school-management' ), studentLabelSingular )}</span>
                <span className="font-mono font-medium text-text">{student.student_number}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30 items-center">
                <span className="text-text-muted">{__( 'Admission No', 'codeclove-school-management' )}</span>
                <span className="font-mono font-medium text-text">{student.admission_number}</span>
              </div>
              {student.enrollment?.roll_number && (
                <div className="flex justify-between py-1.5 border-b border-border/30 items-center">
                  <span className="text-text-muted">{__( 'Roll No', 'codeclove-school-management' )}</span>
                  <span className="font-mono font-medium text-text">{student.enrollment.roll_number}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-border/30 items-center">
                <span className="text-text-muted">{sprintf( __( 'Current %s', 'codeclove-school-management' ), unitLabelSingular )}</span>
                <span className="font-medium text-text">{matchedUnit?.name || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 items-center">
                <span className="text-text-muted">{groupLabelSingular}</span>
                <span className="font-medium text-text">{matchedGroup?.name || '—'}</span>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => navigate(`/students/${student.id}/edit`)}
              className="w-full gap-1.5 text-xs py-2 mt-2"
            >
              <Pencil size={12} />
              {__( 'Edit Profile', 'codeclove-school-management' )}
            </Button>

            <Button
              variant="secondary"
              onClick={() => setActiveSubTab('idcard')}
              className="w-full gap-1.5 text-xs py-2 mt-2"
            >
              <IdCard size={12} />
              {__( 'Identity Card', 'codeclove-school-management' )}
            </Button>

            {/* Transfer button — only for active enrolled students */}
            {student.status === 'active' && student.enrollment && (
              <Button
                variant="secondary"
                onClick={openTransferModal}
                className="w-full gap-1.5 text-xs py-2"
              >
                <ArrowLeftRight size={12} />
                {__( 'Transfer Class', 'codeclove-school-management' )}
              </Button>
            )}
          </Card>
        </div>

        {/* Right Column - Tabs & Detail Panels */}
        <div className="lg:col-span-3 space-y-5">
          {/* Tabs Switcher */}
          <div
            role="tablist"
            aria-label={__( 'Student profile sections', 'codeclove-school-management' )}
            className="border-b border-border flex overflow-x-auto gap-6 pb-px scrollbar-none"
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
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-semibold text-xs transition-all whitespace-nowrap -mb-px ${
                    isActive
                      ? 'border-brand text-brand'
                      : 'border-transparent text-text-muted hover:text-text hover:border-border'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-brand' : 'text-text-muted/70'} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Active Tab Panel Card */}
          <Card
            role="tabpanel"
            id={`panel-${activeSubTab}`}
            aria-labelledby={`tab-${activeSubTab}`}
            className="p-6"
          >
            {activeSubTab === 'overview' && (
              <div className="space-y-6">
                {/* 1. Personal Information */}
                <div>
                  <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-4">
                    <User size={16} className="text-brand" />
                    {__( 'Personal Information', 'codeclove-school-management' )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'First Name', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{student.first_name}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Last Name', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{student.last_name}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Middle Name', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{student.middle_name || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Date of Birth', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{formatDate(student.date_of_birth)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Gender', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{formatGender(student.gender)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Admission Date', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{student.admission_date ? formatDate(student.admission_date) : '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Graduation Year', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{student.graduation_year || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Registered On', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{formatDate(student.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Contact & Address Details */}
                <div>
                  <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-4">
                    <MapPin size={16} className="text-brand" />
                    {__( 'Contact & Address Details', 'codeclove-school-management' )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
                    <div className="flex justify-between py-2 border-b border-border/30 col-span-full">
                      <span className="text-text-muted font-medium">{__( 'Street Address', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{student.address || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'City', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{student.city || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'State / Province', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{student.state || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'ZIP / Postal Code', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{student.postal_code || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30 col-span-full">
                      <span className="text-text-muted font-medium">{__( 'Country', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{student.country || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Parent & Guardian Contacts */}
                <div>
                  <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-4">
                    <Users size={16} className="text-brand" />
                    {guardianLabelSingular.toLowerCase().includes('parent') ? sprintf( __( '%s Contacts', 'codeclove-school-management' ), guardianLabelSingular ) : sprintf( __( 'Parent & %s Contacts', 'codeclove-school-management' ), guardianLabelSingular )}
                  </h3>
                  
                  <div className="space-y-6 divide-y divide-border/30">
                    {/* Father's Details */}
                    <div className="pt-2">
                      <p className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <span className="w-1.5 h-3 rounded-full bg-brand/75"></span>
                        {__( "Father's Details", 'codeclove-school-management' )}
                      </p>
                      {student.father ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
                          <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium">{__( 'Name', 'codeclove-school-management' )}</span>
                            <span className="font-medium text-text">{student.father.first_name} {student.father.last_name}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium">{__( 'Phone', 'codeclove-school-management' )}</span>
                            <span className="font-medium text-text">{student.father.phone || '—'}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium">{__( 'Email', 'codeclove-school-management' )}</span>
                            <span className="font-medium text-text">{student.father.email || '—'}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium">{__( 'Occupation', 'codeclove-school-management' )}</span>
                            <span className="font-medium text-text">{student.father.occupation || '—'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-xs text-text-muted border border-dashed border-border rounded-xl">
                          {__( 'No Father profile registered.', 'codeclove-school-management' )}
                        </div>
                      )}
                    </div>

                    {/* Mother's Details */}
                    <div className="pt-5">
                      <p className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <span className="w-1.5 h-3 rounded-full bg-brand/75"></span>
                        {__( "Mother's Details", 'codeclove-school-management' )}
                      </p>
                      {student.mother ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
                          <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium">{__( 'Name', 'codeclove-school-management' )}</span>
                            <span className="font-medium text-text">{student.mother.first_name} {student.mother.last_name}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium">{__( 'Phone', 'codeclove-school-management' )}</span>
                            <span className="font-medium text-text">{student.mother.phone || '—'}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium">{__( 'Email', 'codeclove-school-management' )}</span>
                            <span className="font-medium text-text">{student.mother.email || '—'}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium">{__( 'Occupation', 'codeclove-school-management' )}</span>
                            <span className="font-medium text-text">{student.mother.occupation || '—'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-xs text-text-muted border border-dashed border-border rounded-xl">
                          {__( 'No Mother profile registered.', 'codeclove-school-management' )}
                        </div>
                      )}
                    </div>

                    {/* Legal Guardian / Contact */}
                    <div className="pt-5">
                      <p className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <span className="w-1.5 h-3 rounded-full bg-brand/75"></span>
                        {sprintf( __( 'Primary Legal %s / Contact', 'codeclove-school-management' ), guardianLabelSingular )}
                      </p>
                      {student.guardian ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
                          <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium">{__( 'Name', 'codeclove-school-management' )}</span>
                            <span className="font-medium text-text">{student.guardian.first_name} {student.guardian.last_name}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium">{__( 'Relationship', 'codeclove-school-management' )}</span>
                            <span className="font-medium text-text capitalize">{student.relationship || guardianLabelSingular}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium">{__( 'Phone', 'codeclove-school-management' )}</span>
                            <span className="font-medium text-text">{student.guardian.phone || '—'}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium">{__( 'Email', 'codeclove-school-management' )}</span>
                            <span className="font-medium text-text">{student.guardian.email || '—'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-xs text-text-muted border border-dashed border-border rounded-xl">
                          {sprintf( __( 'No other legal %s registered.', 'codeclove-school-management' ), guardianLabelSingular.toLowerCase() )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {activeSubTab === 'portal' && (
              <div className="space-y-5">
                {renderPortalAccessSection()}
              </div>
            )}
            {activeSubTab === 'idcard' && (
              <StudentIdCardSection
                student={student}
                unitName={matchedUnit?.name}
                groupName={matchedGroup?.name}
                rollNumber={student.enrollment?.roll_number}
                school={school}
                sessionLabel={session?.label}
                formatDate={formatDate}
              />
            )}

            {activeSubTab === 'enrollment' && (
              <div className="space-y-6">
                <div>
                  <FormGroupHeader title={__( 'Current Enrollment Placement', 'codeclove-school-management' )} icon={RefreshCw} />
                  {student.enrollment ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-xs">
                      <div className="flex justify-between py-2.5 border-b border-border/40 items-center">
                        <span className="text-text-muted font-medium">{sprintf( __( 'Current %s', 'codeclove-school-management' ), unitLabelSingular )}</span>
                        <span className="text-text font-medium">{matchedUnit?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between py-2.5 border-b border-border/40 items-center">
                        <span className="text-text-muted font-medium">{sprintf( __( 'Assigned %s', 'codeclove-school-management' ), groupLabelSingular )}</span>
                        <span className="text-text font-medium">{matchedGroup?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between py-2.5 border-b border-border/40 items-center">
                        <span className="text-text-muted font-medium">{__( 'Academic Roll Number', 'codeclove-school-management' )}</span>
                        <span className="font-mono text-text font-medium">{student.enrollment.roll_number || '—'}</span>
                      </div>
                      <div className="flex justify-between py-2.5 border-b border-border/40 items-center">
                        <span className="text-text-muted font-medium">{__( 'Placement Start Date', 'codeclove-school-management' )}</span>
                        <span className="text-text font-medium">{formatDate(student.enrollment.starts_on)}</span>
                      </div>
                      <div className="flex justify-between py-2.5 border-b border-border/40 items-center">
                        <span className="text-text-muted font-medium">{__( 'Status', 'codeclove-school-management' )}</span>
                        <span className="text-text font-medium capitalize">{student.enrollment.status}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-text-muted">{__( 'No active enrollment record found.', 'codeclove-school-management' )}</div>
                  )}
                </div>

                {/* Academic Session History */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                      {__( 'Academic Session History', 'codeclove-school-management' )}
                    </h4>
                    <span className="text-2xs text-text-muted font-medium">
                      {sprintf( __( '%d session(s) recorded', 'codeclove-school-management' ), student.enrollments?.length ?? 0 )}
                    </span>
                  </div>

                  {student.enrollments?.length ? (
                    <div className="border border-border/40 rounded overflow-hidden">
                      <TableRoot>
                        <Thead>
                          <Tr>
                            <Th className="p-3">{__( 'Academic Session', 'codeclove-school-management' )}</Th>
                            <Th className="p-3">{unitLabelSingular}</Th>
                            <Th className="p-3">{groupLabelSingular}</Th>
                            <Th className="p-3">{__( 'Roll Number', 'codeclove-school-management' )}</Th>
                            <Th className="p-3">{__( 'Placement Period', 'codeclove-school-management' )}</Th>
                            <Th className="p-3 text-center">{__( 'Status', 'codeclove-school-management' )}</Th>
                          </Tr>
                        </Thead>
                        <Tbody className="divide-y divide-border/20 text-xs">
                          {student.enrollments.map((enr) => (
                            <Tr key={enr.id} className="hover:bg-bg-overlay/10">
                              <Td className="p-3 font-medium text-text">
                                {enr.session_name || sprintf( __( 'Session #%s', 'codeclove-school-management' ), enr.academic_session_id )}
                              </Td>
                              <Td className="p-3 text-text-muted">
                                {enr.unit_name || sprintf( __( 'Class #%s', 'codeclove-school-management' ), enr.academic_unit_id )}
                              </Td>
                              <Td className="p-3 text-text-muted">
                                {enr.group_name || '—'}
                              </Td>
                              <Td className="p-3 font-mono text-text">
                                {enr.roll_number || '—'}
                              </Td>
                              <Td className="p-3 text-text-muted">
                                {enr.starts_on ? formatDate(enr.starts_on) : '—'}
                                {enr.ends_on ? ` – ${formatDate(enr.ends_on)}` : ''}
                              </Td>
                              <Td className="p-3 text-center">
                                <Badge size="sm" variant={ENROLLMENT_STATUS_VARIANTS[enr.status] ?? 'default'} className="capitalize">
                                  {enr.status}
                                </Badge>
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </TableRoot>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted italic py-2">{__( 'No historical enrollments recorded.', 'codeclove-school-management' )}</p>
                  )}
                </div>
              </div>
            )}

            {activeSubTab === 'finance' && (
              <div className="space-y-6">
                {isInvoicesLoading || isPaymentsLoading ? (
                  <div className="flex h-48 items-center justify-center">
                    <Spinner size="md" />
                  </div>
                ) : invoices.length === 0 && payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-brand-dim flex items-center justify-center text-brand/80 mb-1">
                      <Coins size={22} />
                    </div>
                    <p className="text-sm font-bold text-text">{__( 'No invoices or billing data found', 'codeclove-school-management' )}</p>
                    <p className="text-xs text-text-muted max-w-sm leading-normal">
                      {__( 'All tuition structures, invoice history, and fee collections are managed securely in the central Finance module.', 'codeclove-school-management' )}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Zone 2 — Financial Summary Card */}
                    <div className="bg-bg-surface border border-border rounded-xl p-5">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        {/* KPI Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-border flex-1">
                          <div className="space-y-1">
                            <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block">
                              {__( 'Total Billed', 'codeclove-school-management' )}
                            </span>
                            <div className="text-xl font-bold text-text tabular-nums leading-tight">
                              {formatCurrency(totalBilled)}
                            </div>
                            <span className="text-3xs text-text-muted">
                              {sprintf( __( '%1$d %2$s', 'codeclove-school-management' ), activeInvoices.length, activeInvoices.length === 1 ? __( 'invoice', 'codeclove-school-management' ) : __( 'invoices', 'codeclove-school-management' ) )}
                            </span>
                          </div>

                          <div className="space-y-1 sm:pl-6">
                            <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block">
                              {__( 'Total Collected', 'codeclove-school-management' )}
                            </span>
                            <div className="text-xl font-bold text-success tabular-nums leading-tight">
                              {formatCurrency(totalPaid)}
                            </div>
                            <span className="text-3xs text-text-muted">
                              {sprintf( __( '%d%% collected', 'codeclove-school-management' ), totalBilled > 0 ? Math.min(100, Math.round((totalPaid / totalBilled) * 100)) : 0 )}
                            </span>
                          </div>

                          <div className="space-y-1 sm:pl-6">
                            <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider block">
                              {__( 'Outstanding Balance', 'codeclove-school-management' )}
                            </span>
                            <div className={cn(
                              'text-xl font-bold tabular-nums leading-tight',
                              outstandingBalance > 0 ? 'text-danger' : 'text-text'
                            )}>
                              {formatCurrency(outstandingBalance)}
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              {invoices.filter((i) => i.status === 'overdue').length > 0 ? (
                                 <Badge variant="danger" size="sm">
                                  {sprintf( __( '%d Overdue', 'codeclove-school-management' ), invoices.filter((i) => i.status === 'overdue').length )}
                                </Badge>
                              ) : (
                                <span className="text-3xs text-text-muted">{__( 'No overdue balance', 'codeclove-school-management' )}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick Action */}
                        <div className="flex items-center lg:self-center">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => navigate(`/finance/invoices/new?student_id=${studentId}&unit_id=${student.enrollment?.academic_unit_id ?? ''}`)}
                            className="gap-1.5"
                          >
                            <Plus size={14} />
                            {__( 'Create Invoice', 'codeclove-school-management' )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Finance Sub-tabs & Filter bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 inline-flex items-center gap-1 self-start text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => setFinanceTab('ledger')}
                          className={cn(
                            'inline-flex items-center justify-center gap-2 font-medium text-xs rounded-lg transition-all h-8 px-3.5 select-none cursor-pointer',
                            financeTab === 'ledger'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/40 dark:hover:bg-slate-800/60'
                          )}
                        >
                          <span>{__( 'Invoice Ledger', 'codeclove-school-management' )}</span>
                          <span className={cn(
                            'px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono',
                            financeTab === 'ledger'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          )}>
                            {filteredInvoices.length}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFinanceTab('history')}
                          className={cn(
                            'inline-flex items-center justify-center gap-2 font-medium text-xs rounded-lg transition-all h-8 px-3.5 select-none cursor-pointer',
                            financeTab === 'history'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/40 dark:hover:bg-slate-800/60'
                          )}
                        >
                          <span>{__( 'Payment History', 'codeclove-school-management' )}</span>
                          <span className={cn(
                            'px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono',
                            financeTab === 'history'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          )}>
                            {payments.length}
                          </span>
                        </button>
                      </div>

                      {/* Term filter select */}
                      {financeTab === 'ledger' && (
                        <div className="w-48 self-end sm:self-auto">
                          <Select
                            value={selectedTermFilter}
                            onValueChange={handleTermFilterChange}
                            options={[
                              { value: 'all', label: __( 'All Terms', 'codeclove-school-management' ) },
                              ...(termsData ?? []).map((term) => ({
                                value: String(term.id),
                                label: term.name,
                              })),
                            ]}
                            placeholder={__( 'Filter by Term', 'codeclove-school-management' )}
                          />
                        </div>
                      )}
                    </div>

                    {/* Tab Contents */}
                    {financeTab === 'ledger' ? (
                      <div className="space-y-4">
                        <TableRoot>
                          <Thead>
                            <Tr>
                              <Th type="code">{__( 'Invoice #', 'codeclove-school-management' )}</Th>
                              <Th type="date">{__( 'Issue Date', 'codeclove-school-management' )}</Th>
                              <Th>{__( 'Fee Description', 'codeclove-school-management' )}</Th>
                              <Th type="number">{__( 'Amount', 'codeclove-school-management' )}</Th>
                              <Th type="badge">{__( 'Status', 'codeclove-school-management' )}</Th>
                              <Th type="actions">{__( 'Actions', 'codeclove-school-management' )}</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {paginatedInvoices.length === 0 ? (
                              <TableEmpty
                                colSpan={6}
                                icon={Coins}
                                message={__( 'No invoices found.', 'codeclove-school-management' )}
                                description={__( 'No invoices match the selected academic term.', 'codeclove-school-management' )}
                              />
                            ) : (
                              paginatedInvoices.map((inv) => {
                                const badgeVariant = getStatusVariant(inv.status)
                                const isOverdue = inv.status === 'overdue' || (inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'void' && inv.due_date && new Date(inv.due_date) < new Date())
                                return (
                                  <Tr key={inv.id}>
                                    <Td type="code">
                                      <Link
                                        to={`/finance/invoices/${inv.id}`}
                                        className="font-mono font-semibold text-text hover:text-brand hover:underline transition-colors"
                                      >
                                        {inv.invoice_number}
                                      </Link>
                                    </Td>
                                    <Td type="date">
                                      {formatDate(inv.issue_date)}
                                    </Td>
                                    <Td>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-text">
                                          {inv.first_item_description || __( 'Tuition & Fees', 'codeclove-school-management' )}
                                        </span>
                                        {inv.academic_term_name && (
                                          <Badge variant="default" size="sm" className="font-normal text-text-muted">
                                            {inv.academic_term_name}
                                          </Badge>
                                        )}
                                      </div>
                                    </Td>
                                    <Td type="number">
                                      <div className="font-semibold text-text tabular-nums">
                                        {formatCurrency(inv.total_minor)}
                                      </div>
                                      {inv.paid_minor > 0 && inv.balance_minor > 0 && (
                                        <div className="text-3xs text-danger font-medium">
                                          {sprintf( __( 'Bal: %s', 'codeclove-school-management' ), formatCurrency(inv.balance_minor) )}
                                        </div>
                                      )}
                                    </Td>
                                    <Td type="badge">
                                      <Badge size="sm" variant={badgeVariant} className="capitalize">
                                        {inv.status.replace('_', ' ')}
                                      </Badge>
                                      {isOverdue && inv.status !== 'overdue' && (
                                        <div className="text-3xs text-danger font-semibold mt-0.5">{__( 'Overdue', 'codeclove-school-management' )}</div>
                                      )}
                                    </Td>
                                    <Td type="actions">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          disabled={isPrintLoading === inv.id}
                                          onClick={() => handlePrintInvoice(inv)}
                                          className="h-8 w-8 text-text-subtle hover:text-brand"
                                          title={__( 'Print Invoice', 'codeclove-school-management' )}
                                        >
                                          {isPrintLoading === inv.id && printType === 'invoice' ? (
                                            <Spinner size="xs" />
                                          ) : (
                                            <Printer size={13} />
                                          )}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => navigate(`/finance/invoices/${inv.id}`)}
                                          className="h-8 w-8 text-text-subtle hover:text-brand"
                                          title={__( 'View Details', 'codeclove-school-management' )}
                                        >
                                          <Eye size={13} />
                                        </Button>
                                      </div>
                                    </Td>
                                  </Tr>
                                )
                              })
                            )}
                          </Tbody>
                        </TableRoot>

                        <TablePagination
                          page={financePage}
                          perPage={FINANCE_ITEMS_PER_PAGE}
                          total={filteredInvoices.length}
                          onPageChange={setFinancePage}
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <TableRoot>
                          <Thead>
                            <Tr>
                              <Th type="code">{__( 'Receipt #', 'codeclove-school-management' )}</Th>
                              <Th type="date">{__( 'Date', 'codeclove-school-management' )}</Th>
                              <Th type="code">{__( 'Invoice #', 'codeclove-school-management' )}</Th>
                              <Th>{__( 'Method & Ref', 'codeclove-school-management' )}</Th>
                              <Th type="number">{__( 'Amount', 'codeclove-school-management' )}</Th>
                              <Th type="actions">{__( 'Actions', 'codeclove-school-management' )}</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {paginatedPayments.length === 0 ? (
                              <TableEmpty
                                colSpan={6}
                                icon={Receipt}
                                message={__( 'No payments recorded yet.', 'codeclove-school-management' )}
                                description={__( 'Completed payments and receipts will appear here.', 'codeclove-school-management' )}
                              />
                            ) : (
                              paginatedPayments.map((p) => {
                                const isReversed = p.status === 'cancelled' || p.status === 'refunded'
                                return (
                                  <Tr key={p.id} className="hover:bg-bg-base/20 transition-colors">
                                    <Td type="code">
                                      <span className="font-mono font-semibold text-text">{p.payment_number}</span>
                                    </Td>
                                    <Td type="date">{formatDate(p.paid_on)}</Td>
                                    <Td type="code">
                                      {p.invoice_id ? (
                                        <Link
                                          to={`/finance/invoices/${p.invoice_id}`}
                                          className="font-mono text-text-muted hover:text-brand hover:underline font-medium text-xs transition-colors"
                                        >
                                          {p.invoice_number || `INV #${p.invoice_id}`}
                                        </Link>
                                      ) : (
                                        <span className="text-text-muted">—</span>
                                      )}
                                    </Td>
                                    <Td>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="default" size="sm" className="font-normal text-text-muted">
                                          {getMethodLabel(p.method)}
                                        </Badge>
                                        {p.reference && (
                                          <span className="text-xs font-mono text-text-subtle">
                                            {p.reference}
                                          </span>
                                        )}
                                      </div>
                                    </Td>
                                    <Td type="number">
                                      <div className={cn('tabular-nums font-semibold text-text', isReversed && 'text-text-muted line-through')}>
                                        {formatCurrency(p.amount_minor)}
                                      </div>
                                      {isReversed && (
                                        <div className="text-3xs text-danger font-medium uppercase">
                                          {p.status}
                                        </div>
                                      )}
                                    </Td>
                                    <Td type="actions">
                                      <div className="flex items-center justify-end">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          disabled={isPrintLoading === p.id}
                                          onClick={() => handlePrintReceipt(p)}
                                          className="h-8 w-8 text-text-subtle hover:text-brand"
                                          title={__( 'Print Receipt', 'codeclove-school-management' )}
                                        >
                                          {isPrintLoading === p.id && printType === 'receipt' ? (
                                            <Spinner size="xs" />
                                          ) : (
                                            <Printer size={13} />
                                          )}
                                        </Button>
                                      </div>
                                    </Td>
                                  </Tr>
                                )
                              })
                            )}
                          </Tbody>
                        </TableRoot>

                        <TablePagination
                          page={paymentPage}
                          perPage={FINANCE_ITEMS_PER_PAGE}
                          total={sortedPayments.length}
                          onPageChange={setPaymentPage}
                        />
                      </div>
                    )}

                  </>
                )}
              </div>
            )}

            {activeSubTab === 'academics' && (
              <div className="space-y-4">
                <FormGroupHeader title={__( 'Academics & Subject selection', 'codeclove-school-management' )} icon={BookOpen} />
                <div className="space-y-3 pb-3">
                  <p className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1">{__( 'Enrolled Subjects', 'codeclove-school-management' )}</p>
                  {studentSubjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-text-muted">
                      <BookOpen size={20} className="text-text-subtle mb-1" />
                      {sprintf( __( 'No academic %s enrolled yet.', 'codeclove-school-management' ), subjectLabelPlural.toLowerCase() )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {studentSubjects.map((sub) => (
                        <Badge key={sub.id} variant={sub.type === 'core' ? 'brand' : 'default'} size="sm" className="capitalize">
                          {sub.name} ({sub.type})
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-border/40 pt-4 space-y-4">
                  <h3 className="text-xs font-bold text-text uppercase tracking-wider">{__( 'Attendance Logs', 'codeclove-school-management' )}</h3>
                  {isAttendanceLoading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                  ) : !attendanceHistory || attendanceHistory.length === 0 ? (
                    <p className="text-xs text-text-muted italic py-2">{__( 'No attendance records found for this student.', 'codeclove-school-management' )}</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary stats */}
                      <div className="flex flex-wrap gap-3">
                        {student.enrollment?.roll_number && (
                          <div className="px-3 py-1.5 bg-bg-surface border border-border/40 rounded flex items-center gap-2">
                            <span className="text-2xs text-text-muted">{__( 'Roll No', 'codeclove-school-management' )}</span>
                            <span className="text-xs font-bold text-text">
                              {student.enrollment.roll_number}
                            </span>
                          </div>
                        )}
                        <div className="px-3 py-1.5 bg-bg-surface border border-border/40 rounded flex items-center gap-2">
                          <span className="text-2xs text-text-muted">{__( 'Rate', 'codeclove-school-management' )}</span>
                          <span className="text-xs font-bold text-text">
                            {(() => {
                              const total = attendanceHistory.length;
                              const present = attendanceHistory.filter(h => h.status === 'present').length;
                              return total > 0 ? `${Math.round((present / total) * 100)}%` : '0%';
                            })()}
                          </span>
                        </div>
                        <div className="px-3 py-1.5 bg-bg-surface border border-border/40 rounded flex items-center gap-2">
                          <span className="text-2xs text-text-muted">{__( 'Present', 'codeclove-school-management' )}</span>
                          <span className="text-xs font-bold text-success">
                            {sprintf( __( '%d days', 'codeclove-school-management' ), attendanceHistory.filter(h => h.status === 'present').length )}
                          </span>
                        </div>
                        <div className="px-3 py-1.5 bg-bg-surface border border-border/40 rounded flex items-center gap-2">
                          <span className="text-2xs text-text-muted">{__( 'Absent', 'codeclove-school-management' )}</span>
                          <span className="text-xs font-bold text-danger">
                            {sprintf( __( '%d days', 'codeclove-school-management' ), attendanceHistory.filter(h => h.status === 'absent').length )}
                          </span>
                        </div>
                      </div>

                      {/* Filters */}
                      <div className="flex flex-wrap gap-4 items-center py-2 px-4 bg-bg-overlay/5 border border-border/40 rounded text-xs">
                        <span className="font-semibold text-text-muted">{__( 'Filters:', 'codeclove-school-management' )}</span>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-text-subtle font-medium">{__( 'Year:', 'codeclove-school-management' )}</span>
                          <select
                            value={yearFilter}
                            onChange={(e) => {
                              setYearFilter(e.target.value)
                              setCurrentPage(1)
                            }}
                            className="bg-bg-surface border border-border rounded px-2 py-1 text-text outline-none focus:border-brand/60"
                          >
                            <option value="">{__( 'All Years', 'codeclove-school-management' )}</option>
                            {uniqueYears.map(y => (
                              <option key={y} value={String(y)}>{y}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-text-subtle font-medium">{__( 'Month:', 'codeclove-school-management' )}</span>
                          <select
                            value={monthFilter}
                            onChange={(e) => {
                              setMonthFilter(e.target.value)
                              setCurrentPage(1)
                            }}
                            className="bg-bg-surface border border-border rounded px-2 py-1 text-text outline-none focus:border-brand/60"
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
                              { v: '12', l: __( 'December', 'codeclove-school-management' ) }
                            ].map(m => (
                              <option key={m.v} value={m.v}>{m.l}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-text-subtle font-medium">{__( 'Status:', 'codeclove-school-management' )}</span>
                          <select
                            value={statusFilter}
                            onChange={(e) => {
                              setStatusFilter(e.target.value)
                              setCurrentPage(1)
                            }}
                            className="bg-bg-surface border border-border rounded px-2 py-1 text-text outline-none focus:border-brand/60 capitalize"
                          >
                            <option value="">{__( 'All Statuses', 'codeclove-school-management' )}</option>
                            {['present', 'absent', 'late', 'half_day', 'excused', 'holiday'].map(st => (
                              <option key={st} value={st}>{st.replace('_', ' ')}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Log Table */}
                      {paginatedLogs.length === 0 ? (
                        <p className="text-xs text-text-muted italic py-4 text-center">{__( 'No attendance records match your active filters.', 'codeclove-school-management' )}</p>
                      ) : (
                        <>
                          <div className="border border-border/40 rounded overflow-hidden">
                            <TableRoot>
                              <Thead>
                                <Tr>
                                  <Th className="p-3">{__( 'Date', 'codeclove-school-management' )}</Th>
                                  <Th type="badge" className="p-3">{__( 'Status', 'codeclove-school-management' )}</Th>
                                  <Th className="p-3">{__( 'Session & Class', 'codeclove-school-management' )}</Th>
                                  <Th className="p-3">{__( 'Note', 'codeclove-school-management' )}</Th>
                                </Tr>
                              </Thead>
                              <Tbody className="divide-y divide-border/20 text-xs">
                                {paginatedLogs.map((h) => (
                                  <Tr key={h.id} className="hover:bg-bg-overlay/10">
                                    <Td className="p-3 font-mono font-medium">{h.attendance_date}</Td>
                                    <Td type="badge" className="p-3">
                                      <Badge size="sm" variant={(h.status || 'default') as any} className="capitalize">
                                        {h.status.replace('_', ' ')}
                                      </Badge>
                                    </Td>
                                    <Td className="p-3 text-text-muted">
                                      {h.session_name || '—'} • {h.unit_name || '—'}{h.group_name ? ` (${h.group_name})` : ''}
                                    </Td>
                                    <Td className="p-3 text-text-muted italic">{h.note || '—'}</Td>
                                  </Tr>
                                ))}
                              </Tbody>
                            </TableRoot>
                          </div>

                          {/* Pagination controls */}
                          {totalPages > 1 && (
                            <div className="flex justify-between items-center text-xs py-2 px-1 text-text-muted">
                              <span>
                                {sprintf( __( 'Showing %1$d to %2$d of %3$d logs', 'codeclove-school-management' ), ((currentPage - 1) * ITEMS_PER_PAGE) + 1, Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length), filteredLogs.length )}
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={currentPage === 1}
                                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
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
                                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                  className="h-7 px-3 text-2xs"
                                >
                                  {__( 'Next', 'codeclove-school-management' )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
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
              <div className="p-3 rounded-lg bg-bg-base border border-border text-xs text-text-muted">
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

      {/* Create Portal Account Modal */}
      {createModalOpen && createTarget && (
        <Modal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          title={sprintf( __( 'Configure %s Portal Account', 'codeclove-school-management' ), createTarget.type === 'student' ? studentLabelSingular : guardianLabelSingular )}
          description={sprintf( __( 'Set up login credentials for %s.', 'codeclove-school-management' ), createTarget.name )}
        >
          <div className="space-y-4 p-1">
            <FormField label={__( 'Username', 'codeclove-school-management' )} required>
              <Input
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                placeholder="e.g. john.doe"
              />
            </FormField>

            <FormField label={__( 'Email Address (optional)', 'codeclove-school-management' )}>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="e.g. parent@example.com"
              />
            </FormField>

            <FormField label={__( 'Password (optional)', 'codeclove-school-management' )}>
              <Input
                type="text"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder={__( 'Leave blank to auto-generate a secure password', 'codeclove-school-management' )}
              />
            </FormField>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-bg-base border border-border cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={formSendEmail}
                onChange={(e) => setFormSendEmail(e.target.checked)}
                className="mt-0.5 rounded border-border text-brand focus:ring-brand"
              />
              <div>
                <span className="font-semibold text-text block">{__( 'Send welcome notification email', 'codeclove-school-management' )}</span>
                <span className="text-text-muted text-xs block mt-0.5">
                  {__( 'Sends an email with password setup instructions so the user can log in immediately.', 'codeclove-school-management' )}
                </span>
              </div>
            </label>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              {__( 'Cancel', 'codeclove-school-management' )}
            </Button>
            <Button
              onClick={handleConfirmCreatePortal}
              disabled={createPortalAccountMutation.isPending || !formUsername.trim()}
            >
              {createPortalAccountMutation.isPending ? __( 'Creating Account…', 'codeclove-school-management' ) : __( 'Create Portal Account', 'codeclove-school-management' )}
            </Button>
          </ModalFooter>
        </Modal>
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
            <div className="bg-bg-base rounded-xl border border-border p-4 space-y-2.5 text-xs font-mono">
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

      {/* Revoke Portal Access Modal */}
      {revokeModalOpen && revokeTarget && (
        <Modal
          open={revokeModalOpen}
          onOpenChange={setRevokeModalOpen}
          title={__( 'Revoke Portal Access', 'codeclove-school-management' )}
          description={sprintf( __( 'Are you sure you want to revoke portal access for %1$s (@%2$s)?', 'codeclove-school-management' ), revokeTarget.name, revokeTarget.username )}
        >
          <div className="p-3 rounded-lg bg-danger/5 border border-danger/20 text-xs text-text space-y-2">
            <p className="font-semibold text-danger flex items-center gap-1.5">
              <AlertTriangle size={15} />
              {__( 'Account will be unlinked', 'codeclove-school-management' )}
            </p>
            <p className="text-text-muted">
              {sprintf(
                __( 'This will disconnect the WordPress login account from this %s profile. The user will no longer be able to access portal features for this record.', 'codeclove-school-management' ),
                revokeTarget.type === 'student' ? studentLabelSingular.toLowerCase() : guardianLabelSingular.toLowerCase()
              )}
            </p>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => setRevokeModalOpen(false)}>
              {__( 'Cancel', 'codeclove-school-management' )}
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmRevokePortal}
              disabled={unlinkPortalAccountMutation.isPending}
            >
              {unlinkPortalAccountMutation.isPending ? __( 'Revoking…', 'codeclove-school-management' ) : __( 'Confirm Revoke Access', 'codeclove-school-management' )}
            </Button>
          </ModalFooter>
        </Modal>
      )}
      {/* Hidden printable elements container */}
      <div className="hidden">
        {printType === 'invoice' && printingInvoice && (
          <div ref={printRef}>
            <PrintInvoiceSheet invoice={printingInvoice} school={school} />
          </div>
        )}
        {printType === 'receipt' && printingPayment && printingInvoice && (
          <div ref={printRef}>
            <PrintPaymentReceipt
              payment={printingPayment}
              invoice={printingInvoice}
              school={school}
            />
          </div>
        )}
      </div>
    </div>
  )
}
