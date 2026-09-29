import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  User, Pencil, Trash2, Mail, Briefcase, AlertTriangle, Plus, FileText, Clock, Calendar, MapPin, IdCard, Printer, CalendarCheck,
  PhoneCall, ShieldCheck
} from 'lucide-react'
import {
  useStaffMember,
  useDeleteStaff,
} from '@/api/staff'
import {
  Button, Badge, Card, PageHeader, Spinner, EmptyState, Modal, ModalFooter,
  TableRoot, Thead, Tbody, Tr, Th, Td
} from '@/components/ui'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { useStaffAttendanceHistory } from '@/api/attendance'
import { useSettings } from '@/api/settings'
import { useSession } from '@/lib/session-context'
import { useFormatter, formatGender } from '@/lib/formatter'
import { printElement } from '@/lib/print'
import { __, sprintf } from '@/lib/i18n'
import { StaffIdCard } from './components/StaffIdCard'

export default function StaffProfilePage() {
  const { id } = useParams<{ id: string }>()
  const staffId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { getLabel } = useLabels()
  const staffLabelSingular = getLabel('staff_member', false, __( 'Staff Member', 'codeclove-school-management' ))
  const staffLabelPlural = getLabel('staff_member', true, __( 'Staff Members', 'codeclove-school-management' ))
  const { session } = useSession()
  const { data: settingsData } = useSettings()
  const { formatDate } = useFormatter()
  const { data: staff, isLoading: isStaffLoading, isError } = useStaffMember(staffId)
  const { data: attendanceHistory, isLoading: isAttendanceLoading } = useStaffAttendanceHistory(staffId)
  const deleteMutation = useDeleteStaff()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'idcard' | 'attendance' | 'leaves'>('overview')
  const [badgeDual, setBadgeDual] = useState(true)
  const [isPrintingBadge, setIsPrintingBadge] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isPrintingBadge && printRef.current) {
      printElement(printRef.current)
      setIsPrintingBadge(false)
    }
  }, [isPrintingBadge])
  const [yearFilter, setYearFilter] = useState<string>('')
  const [monthFilter, setMonthFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(1)

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

  const handleDeleteConfirm = () => {
    if (!staff) return
    deleteMutation.mutate(staff.id, {
      onSuccess: () => {
        toast.success(sprintf( __( "Successfully deleted %1$s %2$s's record.", 'codeclove-school-management' ), staff.first_name, staff.last_name ))
        setShowDeleteModal(false)
        navigate('/staff')
      },
      onError: (err) => {
        toast.error(err.message || sprintf( __( 'Failed to delete %s.', 'codeclove-school-management' ), staffLabelSingular.toLowerCase() ))
      },
    })
  }

  if (isStaffLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isError || !staff) {
    return (
      <EmptyState
        title={sprintf( __( '%s not found', 'codeclove-school-management' ), staffLabelSingular )}
        description={sprintf( __( 'The %s record you are trying to view does not exist or has been deleted.', 'codeclove-school-management' ), staffLabelSingular.toLowerCase() )}
        icon={AlertTriangle}
        action={<Button size="sm" onClick={() => navigate('/staff')}>{__( 'Back to Directory', 'codeclove-school-management' )}</Button>}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={sprintf( __( '%s Profile', 'codeclove-school-management' ), staffLabelSingular )}
        description={__( 'View professional details, contact information, and record details.', 'codeclove-school-management' )}
        onBack={() => navigate('/staff')}
        breadcrumbs={[
          { label: staffLabelPlural },
          { label: __( 'Directory', 'codeclove-school-management' ), href: '/staff' },
          { label: `${staff.first_name} ${staff.last_name}` }
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column - Profile Sidebar Card */}
        <div className="lg:col-span-1">
          <Card className="p-6 flex flex-col items-center text-center space-y-4">
            {staff.photo_url && !staff.photo_url.endsWith('avatar.svg') ? (
              <div className="w-20 h-20 rounded-full border-4 border-brand/10 shadow-sm overflow-hidden flex-shrink-0 select-none relative">
                <img src={staff.photo_url} alt={`${staff.first_name} ${staff.last_name}`} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-dim border-4 border-brand/10 shadow-sm flex items-center justify-center text-brand font-bold text-2xl flex-shrink-0 select-none">
                {staff.first_name[0] ?? ''}{staff.last_name[0] ?? ''}
              </div>
            )}
            
            <div className="space-y-1">
              <h2 className="text-base font-bold text-text">
                {staff.first_name} {staff.last_name}
              </h2>
              <p className="text-xs text-text-muted">{staff.designation || staffLabelSingular}</p>
              <div className="flex justify-center pt-1">
                <Badge
                  variant={
                    staff.status === 'active'
                      ? 'success'
                      : staff.status === 'inactive'
                      ? 'inactive'
                      : 'suspended'
                  }
                  size="sm"
                >
                  {staff.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="w-full border-t border-border/60 my-2"></div>

            <div className="w-full space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border/30 items-center">
                <span className="text-text-muted">{sprintf( __( '%s Code', 'codeclove-school-management' ), staffLabelSingular )}</span>
                <span className="font-mono font-medium text-text">{staff.staff_number}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30 items-center">
                <span className="text-text-muted">{__( 'Department', 'codeclove-school-management' )}</span>
                <span className="font-medium text-text">{staff.department || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 items-center">
                <span className="text-text-muted">{__( 'Joined On', 'codeclove-school-management' )}</span>
                <span className="font-medium text-text">{staff.joined_on || '—'}</span>
              </div>
            </div>

            <div className="w-full space-y-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => navigate(`/staff/${staff.id}/edit`)}
                className="w-full gap-1.5 text-xs py-2"
              >
                <Pencil size={12} />
                {__( 'Edit Profile', 'codeclove-school-management' )}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setActiveSubTab('idcard')}
                className="w-full gap-1.5 text-xs py-2"
              >
                <IdCard size={12} />
                {__( 'Identity Card', 'codeclove-school-management' )}
              </Button>
              <Button
                variant="danger"
                onClick={() => setShowDeleteModal(true)}
                className="w-full gap-1.5 text-xs py-2 bg-danger/5 hover:bg-danger/10 border-danger/10 hover:border-danger/20 text-danger"
              >
                <Trash2 size={12} />
                {__( 'Delete Profile', 'codeclove-school-management' )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column - Profile Detail Cards */}
        <div className="lg:col-span-3 space-y-5">
          {/* Tabs Switcher */}
          <div
            role="tablist"
            aria-label={sprintf( __( '%s profile sections', 'codeclove-school-management' ), staffLabelSingular )}
            className="border-b border-border flex overflow-x-auto gap-6 pb-px scrollbar-none"
          >
            {([
              { id: 'overview', label: __( 'Overview', 'codeclove-school-management' ), icon: User },
              { id: 'idcard', label: __( 'Identity Card', 'codeclove-school-management' ), icon: IdCard },
              { id: 'attendance', label: __( 'Attendance History', 'codeclove-school-management' ), icon: CalendarCheck },
              { id: 'leaves', label: __( 'Leave Requests', 'codeclove-school-management' ), icon: Calendar },
            ] as const).map((tab) => {
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
                <div>
                  <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-4">
                    <User size={16} className="text-brand" />
                    {__( 'Personal Information', 'codeclove-school-management' )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Title', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.title || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Staff ID / Code', 'codeclove-school-management' )}</span>
                      <span className="font-mono font-medium text-text">{staff.staff_number || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'First Name', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.first_name}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Last Name', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.last_name}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Middle Name', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.middle_name || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Preferred Name', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.preferred_name || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Date of Birth', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.date_of_birth ? formatDate(staff.date_of_birth) : '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Gender', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{formatGender(staff.gender)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-4">
                    <Mail size={16} className="text-brand" />
                    {__( 'Contact Details', 'codeclove-school-management' )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Email Address', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.email}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Phone Number', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.phone || '—'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-4">
                    <MapPin size={16} className="text-brand" />
                    {__( 'Physical Address', 'codeclove-school-management' )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
                    <div className="flex justify-between py-2 border-b border-border/30 col-span-full">
                      <span className="text-text-muted font-medium">{__( 'Street Address', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.address || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'City', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.city || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'State / Province', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.state || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'ZIP / Postal Code', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.postal_code || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Country', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.country || '—'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-4">
                    <Briefcase size={16} className="text-brand" />
                    {__( 'Employment Information', 'codeclove-school-management' )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Designation', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.designation || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Department', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.department || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Staff Category', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text capitalize">{staff.staff_category ? staff.staff_category.replace(/_/g, ' ') : '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Employment Model', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text capitalize">{staff.employment_type ? staff.employment_type.replace(/_/g, ' ') : '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Highest Qualification', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.highest_qualification || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Subject / Specialization', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.specialization || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Joined Date', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.joined_on ? formatDate(staff.joined_on) : '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Associated User ID', 'codeclove-school-management' )}</span>
                      <span className="font-mono font-medium text-text">{staff.user_id || '—'}</span>
                    </div>
                    {staff.user_id && (
                      <div className="flex justify-between py-2 border-b border-border/30">
                        <span className="text-text-muted font-medium">{__( 'WordPress Username', 'codeclove-school-management' )}</span>
                        <span className="font-medium text-text">{staff.username || '—'}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-text-muted font-medium">{__( 'Assigned System Role', 'codeclove-school-management' )}</span>
                      <span className="font-medium text-text">{staff.role_name || '—'}</span>
                    </div>
                  </div>
                </div>

                {(staff.emergency_contact_name || staff.emergency_contact_phone) && (
                  <div>
                    <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-4">
                      <PhoneCall size={16} className="text-brand" />
                      {__( 'Emergency Contact', 'codeclove-school-management' )}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4 text-xs">
                      <div className="flex justify-between py-2 border-b border-border/30">
                        <span className="text-text-muted font-medium">{__( 'Contact Person', 'codeclove-school-management' )}</span>
                        <span className="font-medium text-text">{staff.emergency_contact_name || '—'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border/30">
                        <span className="text-text-muted font-medium">{__( 'Relationship', 'codeclove-school-management' )}</span>
                        <span className="font-medium text-text">{staff.emergency_contact_relationship || '—'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border/30">
                        <span className="text-text-muted font-medium">{__( 'Emergency Phone', 'codeclove-school-management' )}</span>
                        <span className="font-medium text-text">{staff.emergency_contact_phone || '—'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {(() => {
                  const metaEntries = Object.entries(staff.metadata ?? {}).filter(([, val]) => val !== null && val !== undefined && val !== '')
                  if (metaEntries.length === 0) return null
                  return (
                    <div>
                      <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-4">
                        <ShieldCheck size={16} className="text-brand" />
                        {__( 'Regional Compliance & Statutory Details', 'codeclove-school-management' )}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
                        {metaEntries.map(([key, val]) => (
                          <div key={key} className="flex justify-between py-2 border-b border-border/30">
                            <span className="text-text-muted font-medium capitalize">
                              {key.replace(/_/g, ' ')}
                            </span>
                            <span className="font-medium text-text">
                              {String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                <div className="border-t border-border/60 pt-6">
                  <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-4">
                    <FileText size={16} className="text-brand" />
                    {__( 'Uploaded Documents', 'codeclove-school-management' )}
                  </h3>
                  {staff.documents && staff.documents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {staff.documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-bg-base/30 hover:bg-bg-elevated border border-border/40 rounded-lg transition-colors">
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-text">{doc.label}</p>
                            <p className="text-2xs text-text-muted font-mono">{sprintf( __( 'ID: %s', 'codeclove-school-management' ), doc.attachment_id )}</p>
                          </div>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs bg-brand-dim text-brand hover:bg-brand/15 px-2.5 py-1.5 rounded font-medium transition-colors"
                          >
                            {__( 'View File', 'codeclove-school-management' )}
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted italic py-2">{__( 'No documents have been uploaded to this profile.', 'codeclove-school-management' )}</p>
                  )}
                </div>
              </div>
            )}
            {activeSubTab === 'idcard' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                      <IdCard size={16} className="text-brand" />
                      {__( 'Staff Identity Card', 'codeclove-school-management' )}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      {badgeDual ? __( 'CR80 dual-sided foldable credential preview.', 'codeclove-school-management' ) : __( 'CR80 single-sided badge preview.', 'codeclove-school-management' )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-bg-base/60 p-0.5 rounded-lg border border-border text-xs">
                      <button
                        type="button"
                        onClick={() => setBadgeDual(false)}
                        className={`px-2.5 py-1 rounded-md transition-colors ${!badgeDual ? 'bg-bg-surface text-text font-semibold shadow-xs' : 'text-text-muted hover:text-text'}`}
                      >
                        {__( 'Single Side', 'codeclove-school-management' )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBadgeDual(true)}
                        className={`px-2.5 py-1 rounded-md transition-colors ${badgeDual ? 'bg-bg-surface text-text font-semibold shadow-xs' : 'text-text-muted hover:text-text'}`}
                      >
                        {__( 'Dual Side', 'codeclove-school-management' )}
                      </button>
                    </div>
                    <Button onClick={() => setIsPrintingBadge(true)} className="gap-1.5 text-xs h-8">
                      <Printer size={13} />
                      {__( 'Print ID Card', 'codeclove-school-management' )}
                    </Button>
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-border rounded-2xl p-8 flex flex-col items-center justify-center overflow-x-auto">
                  <StaffIdCard
                    staff={staff}
                    school={settingsData?.school}
                    sessionLabel={session?.label}
                    formatDate={formatDate}
                    dual={badgeDual}
                  />
                </div>
              </div>
            )}

            {activeSubTab === 'attendance' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-text uppercase tracking-wider">{__( 'Attendance Logs', 'codeclove-school-management' )}</h3>
                </div>
                {isAttendanceLoading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : !attendanceHistory || attendanceHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-brand-dim flex items-center justify-center text-brand/80 mb-1">
                      <Clock size={22} />
                    </div>
                    <p className="text-sm font-bold text-text">{__( 'No attendance logs found', 'codeclove-school-management' )}</p>
                    <p className="text-xs text-text-muted max-w-sm leading-normal">
                      {__( 'Daily check-ins, monthly summary, and shift tracking logs will populate here once active schedules commence.', 'codeclove-school-management' )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Summary stats */}
                    <div className="flex flex-wrap gap-3">
                      {staff.staff_number && (
                        <div className="px-3 py-1.5 bg-bg-surface border border-border/40 rounded flex items-center gap-2">
                          <span className="text-2xs text-text-muted">{__( 'Staff Code', 'codeclove-school-management' )}</span>
                          <span className="text-xs font-bold text-text">
                            {staff.staff_number}
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
                      <div className="px-3 py-1.5 bg-bg-surface border border-border/40 rounded flex items-center gap-2">
                        <span className="text-2xs text-text-muted">{__( 'On Leave', 'codeclove-school-management' )}</span>
                        <span className="text-xs font-bold text-warning">
                          {sprintf( __( '%d days', 'codeclove-school-management' ), attendanceHistory.filter(h => h.status === 'on_leave').length )}
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
                          {['present', 'absent', 'late', 'half_day', 'on_leave', 'excused', 'holiday'].map(st => (
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
                        <TableRoot>
                          <Thead>
                            <Tr>
                              <Th>{__( 'Date', 'codeclove-school-management' )}</Th>
                              <Th type="badge">{__( 'Status', 'codeclove-school-management' )}</Th>
                              <Th>{__( 'Note', 'codeclove-school-management' )}</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {paginatedLogs.map((h) => (
                              <Tr key={h.id}>
                                <Td className="font-mono font-medium">{h.attendance_date}</Td>
                                <Td type="badge">
                                  <Badge size="sm" variant={(h.status || 'default') as any} className="capitalize">
                                    {h.status.replace('_', ' ')}
                                  </Badge>
                                </Td>
                                <Td className="text-text-muted italic">{h.note || '—'}</Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </TableRoot>
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
            )}

            {activeSubTab === 'leaves' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
                <div className="w-12 h-12 rounded-full bg-brand-dim flex items-center justify-center text-brand/80 mb-1">
                  <Calendar size={22} />
                </div>
                <p className="text-sm font-bold text-text">{__( 'No leave requests found', 'codeclove-school-management' )}</p>
                <p className="text-xs text-text-muted max-w-sm leading-normal">{__( 'Time-off applications, approval workflows, and annual leave balance tracking will populate here.', 'codeclove-school-management' )}</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────────────── */}
      <Modal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title={sprintf( __( 'Delete %s Record', 'codeclove-school-management' ), staffLabelSingular )}
        description={sprintf( __( 'Are you absolutely sure you want to remove this %s? This will soft-delete the record from active directories, preserving historical database records.', 'codeclove-school-management' ), staffLabelSingular.toLowerCase() )}
      >
        <div className="space-y-4 pt-2">
          <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 flex gap-3 text-sm text-text">
            <Plus size={16} className="text-danger flex-shrink-0 mt-0.5 rotate-45" />
            <div className="space-y-1">
              <p className="font-semibold text-danger">{__( 'Warning: Deletion is permanent for active views', 'codeclove-school-management' )}</p>
              <p className="text-xs text-text-subtle leading-relaxed">
                {sprintf( __( 'Removing %1$s %2$s (%3$s) will hide them from the directory, timetables, and list views.', 'codeclove-school-management' ), staff.first_name, staff.last_name, staff.staff_number )}
              </p>
            </div>
          </div>

          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleteMutation.isPending}
            >
              {__( 'Cancel', 'codeclove-school-management' )}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Spinner size="sm" className="text-current mr-1.5" />
                  {__( 'Deleting...', 'codeclove-school-management' )}
                </>
              ) : (
                __( 'Yes, Delete Record', 'codeclove-school-management' )
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
      {/* Hidden printable elements container */}
      {isPrintingBadge && (
        <div className="hidden">
          <div ref={printRef} className="bg-white text-black font-sans">
            <StaffIdCard
              staff={staff}
              school={settingsData?.school}
              sessionLabel={session?.label}
              formatDate={formatDate}
              dual={badgeDual}
            />
          </div>
        </div>
      )}
    </div>
  )
}
