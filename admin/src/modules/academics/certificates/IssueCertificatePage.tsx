import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Printer,
  CheckCircle2,
  ArrowLeft,
  Users,
  User,
  FileCheck,
  Award,
} from 'lucide-react'
import {
  PageHeader,
  Button,
  Spinner,
  Modal,
  ModalFooter,
} from '@/components/ui'
import {
  useCertificateTemplates,
  useStudentFeeSummary,
  useIssueCertificate,
  useBulkIssueCertificates,
  type IssuedCertificate,
  type CertificateTemplate,
  resolveCertificatePrintData,
} from '@/api/certificates'
import { useStudents, useStudentDetails, type FullStudent } from '@/api/students'
import { useUnits, useGroups } from '@/api/academics'
import { useSettings } from '@/api/settings'
import { useSession } from '@/lib/session-context'
import { useToast } from '@/lib/toast'
import { printElement } from '@/lib/print'
import { CertificateDocument } from './components/CertificateDocument'
import { SingleIssueForm } from './components/SingleIssueForm'
import { BatchIssueForm } from './components/BatchIssueForm'
import { CertificateLivePreview } from './components/CertificateLivePreview'
import { formatCertificateNumber } from './certificate-defaults'
import { cn } from '@/lib/utils'
import { useLabels } from '@/lib/labels'
import { __, sprintf } from '@/lib/i18n'

export default function IssueCertificatePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
   const { session } = useSession()
   const { data: settings } = useSettings()
  const { getLabel } = useLabels()
  const classLabel = getLabel('academic_unit', false, 'Class')
  const sectionLabel = getLabel('academic_group', false, 'Section')
  const studentLabel = getLabel('student', false, 'Student')

  const printRef = useRef<HTMLDivElement>(null)
  const [printQueue, setPrintQueue] = useState<{
    template: CertificateTemplate
    certs: Record<string, string>[]
  } | null>(null)

  useEffect(() => {
    if (printQueue && printRef.current) {
      printElement(printRef.current)
    }
  }, [printQueue])

  // Scope Switcher: 'single' vs 'batch'
  const [mode, setMode] = useState<'single' | 'batch'>('single')

  // Batch scope: 'selectedUnitIds' (multi-class selection)
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(undefined)
  const [filterUnitId, setFilterUnitId] = useState<string>('')

  // Template and general fields
  const initialStudentId = Number(searchParams.get('student_id')) || 0
  const initialTemplateId = Number(searchParams.get('template_id')) || 0

  const [selectedStudentId, setSelectedStudentId] = useState<number>(initialStudentId)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(initialTemplateId)
   const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().split('T')[0] ?? '')
  const [reason, setReason] = useState('')
  const [conduct, setConduct] = useState('Exemplary')
  const [duesStatus, setDuesStatus] = useState('')

  // Single mode specific
  const [certificateNo, setCertificateNo] = useState('')
  const [updateStatus, setUpdateStatus] = useState(true)
  const [issuedSuccess, setIssuedSuccess] = useState<{
    studentName: string
    certificateNo: string
    template: CertificateTemplate
    docData: Record<string, string>
  } | null>(null)

  // Batch mode specific
  const [excludedStudentIds, setExcludedStudentIds] = useState<Set<number>>(new Set())
  const [previewStudentId, setPreviewStudentId] = useState<number | null>(null)
  const [numberScheme, setNumberScheme] = useState<'sequential' | 'admission_no' | 'roll_no'>('sequential')
  const [numberPrefix, setNumberPrefix] = useState('CERT')
  const [startNumber, setStartNumber] = useState(1)

  // Reset batch exclusions when switching cohort (classes or section) to ensure 100% inclusion by default
  useEffect(() => {
    setExcludedStudentIds(new Set())
    setPreviewStudentId(null)
  }, [selectedUnitIds, selectedGroupId])

  // Clear group selection when multiple classes are selected
  useEffect(() => {
    if (selectedUnitIds.length !== 1) {
      setSelectedGroupId(undefined)
    }
  }, [selectedUnitIds.length])
  // Post-batch success modal
  const [batchSuccessModalOpen, setBatchSuccessModalOpen] = useState(false)
  const [batchIssuedCerts, setBatchIssuedCerts] = useState<IssuedCertificate[]>([])

  // Batch execution chunked progress
  const [batchProgress, setBatchProgress] = useState<{
    isOpen: boolean
    current: number
    total: number
    statusText: string
  }>({
    isOpen: false,
    current: 0,
    total: 0,
    statusText: '',
  })
  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: templatesData } = useCertificateTemplates()
  const templates = templatesData?.templates || []

  const { data: unitsData } = useUnits({ session_id: session?.id, per_page: 100 })
  const units = unitsData?.data || []

  const isMultiClass = selectedUnitIds.length > 1
  const isSingleClass = selectedUnitIds.length === 1
  const singleUnitId = isSingleClass ? selectedUnitIds[0] : undefined
  const { data: groupsData } = useGroups(
    singleUnitId ? { unit_id: singleUnitId, per_page: 100 } : undefined
  )
  const groups = groupsData?.data || []

  // Initialize selected units with first unit when units load
  const hasInitializedUnitsRef = useRef(false)
  useEffect(() => {
    if (!hasInitializedUnitsRef.current && units.length > 0 && units[0]) {
      hasInitializedUnitsRef.current = true
      setSelectedUnitIds([units[0].id])
    }
  }, [units])

  // Query students for Single Mode
  const { data: singleStudentsData, isLoading: loadingSingleStudents } = useStudents({
    academic_session_id: session?.id,
    academic_unit_id: filterUnitId ? Number(filterUnitId) : undefined,
    per_page: 200,
  })
  const singleStudents = (singleStudentsData?.data || []) as FullStudent[]

  // Query students for Batch Mode (uncapped with per_page: -1 for whole school)
  // Query students for Batch Mode:
  // If exactly 1 unit: pass academic_unit_id and per_page: 300
  // If multiple units: query all session students (per_page: -1) and filter by selectedUnitIds
  const { data: batchStudentsData, isLoading: loadingBatchStudents } = useStudents({
    academic_session_id: session?.id,
    academic_unit_id: isSingleClass ? singleUnitId : undefined,
    academic_group_id: isSingleClass ? (selectedGroupId || undefined) : undefined,
    status: 'active',
    per_page: isSingleClass ? 300 : -1,
  })

  const rawBatchStudents = (batchStudentsData?.data || []) as FullStudent[]

  const batchStudents = useMemo(() => {
    if (selectedUnitIds.length === 0) return []
    if (isSingleClass) return rawBatchStudents
    const allowedUnitIds = new Set(selectedUnitIds)
    return rawBatchStudents.filter(
      (s) => s.enrollment?.academic_unit_id && allowedUnitIds.has(s.enrollment.academic_unit_id)
    )
  }, [selectedUnitIds, isSingleClass, rawBatchStudents])

  // Included target cohort students (excluding any students manually opted out)
  const targetStudents = useMemo(() => {
    return batchStudents.filter((s) => !excludedStudentIds.has(s.id))
  }, [batchStudents, excludedStudentIds])

  // Query single student details if passed via URL or actively selected
  const { data: specificStudent } = useStudentDetails(
    selectedStudentId > 0 ? selectedStudentId : 0
  )

  // Active student object for single mode
  const activeSingleStudent = useMemo(() => {
    if (specificStudent && specificStudent.id === selectedStudentId) {
      return specificStudent
    }
    return singleStudents.find((s) => s.id === selectedStudentId)
  }, [specificStudent, selectedStudentId, singleStudents])

  // Active preview student in batch mode (defaults to first included target student)
  const activeBatchStudent = useMemo(() => {
    if (previewStudentId) {
      const match = batchStudents.find((s) => s.id === previewStudentId)
      if (match) return match
    }
    return targetStudents[0] || batchStudents[0] || null
  }, [previewStudentId, batchStudents, targetStudents])

  // Active student for canvas rendering
  const canvasStudent = mode === 'single' ? activeSingleStudent : activeBatchStudent

  // Fee summary check for active student
  const { data: feeSummary, isLoading: loadingFeeSummary } = useStudentFeeSummary(
    mode === 'single' && selectedStudentId > 0 ? selectedStudentId : undefined
  )

  // Mutations
  const issueMutation = useIssueCertificate()
  const bulkIssueMutation = useBulkIssueCertificates()

  // Select initial template once on load
  const hasInitializedTemplateRef = useRef(false)
  useEffect(() => {
    if (hasInitializedTemplateRef.current || templates.length === 0) return

    hasInitializedTemplateRef.current = true
    if (initialTemplateId && templates.some((t) => t.id === initialTemplateId)) {
      setSelectedTemplateId(initialTemplateId)
    } else if (templates[0]) {
      setSelectedTemplateId(templates[0].id)
    }
  }, [templates, initialTemplateId])

  // Select initial student once on load
  const hasInitializedStudentRef = useRef(false)
  useEffect(() => {
    if (hasInitializedStudentRef.current || singleStudents.length === 0) return

    hasInitializedStudentRef.current = true
    if (initialStudentId && singleStudents.some((s) => s.id === initialStudentId)) {
      setSelectedStudentId(initialStudentId)
    }
  }, [singleStudents, initialStudentId])

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || templates[0]
  }, [templates, selectedTemplateId])
  // Dynamic defaults based on template type
  const prevTemplateTypeRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!selectedTemplate) return
    if (prevTemplateTypeRef.current !== selectedTemplate.type) {
      prevTemplateTypeRef.current = selectedTemplate.type
      if (selectedTemplate.type === 'merit') {
        setReason(__('In recognition of outstanding academic performance and exemplary conduct', 'codeclove-school-management'))
        setConduct('Exemplary')
        setDuesStatus('')
      } else if (selectedTemplate.type === 'transfer') {
        setReason(__('Parent transfer to another city', 'codeclove-school-management'))
        setConduct('Good')
        setDuesStatus(__('All dues cleared', 'codeclove-school-management'))
      } else if (selectedTemplate.type === 'character') {
        setReason(__('Exhibited exemplary moral conduct and discipline', 'codeclove-school-management'))
        setConduct('Exemplary')
        setDuesStatus('')
      } else {
        setReason('')
        setConduct('Good')
        setDuesStatus('')
      }
    }
  }, [selectedTemplate])


  // Update default prefix and certificate number based on template and student
  useEffect(() => {
    if (selectedTemplate) {
      const pfx = selectedTemplate.type === 'transfer' ? 'TC' : 'CERT'
      setNumberPrefix(pfx)
      if (mode === 'single' && activeSingleStudent) {
        const year = new Date(issueDate || Date.now()).getFullYear()
        const ref = activeSingleStudent.admission_number || activeSingleStudent.student_number || String(activeSingleStudent.id)
        setCertificateNo(formatCertificateNumber({ scheme: 'admission_no', prefix: pfx, year, admissionNo: ref }))
        setUpdateStatus(selectedTemplate.type === 'transfer')
      }
    }
  }, [selectedTemplate, mode, activeSingleStudent, issueDate])

  const handleRegenerateSingleCertNo = () => {
    const pfx = selectedTemplate?.type === 'transfer' ? 'TC' : 'CERT'
    const year = new Date(issueDate || Date.now()).getFullYear()
    const ref = activeSingleStudent?.admission_number || activeSingleStudent?.student_number || String(activeSingleStudent?.id || '0001')
    setCertificateNo(formatCertificateNumber({ scheme: 'admission_no', prefix: pfx, year, admissionNo: ref }))
  }

  // Document data for live canvas preview
  const livePreviewDocData: Record<string, string> = useMemo(() => {
    const st = canvasStudent
    const curCertNo = mode === 'single'
      ? certificateNo
      : formatCertificateNumber({
          scheme: numberScheme,
          prefix: numberPrefix,
          year: new Date(issueDate || Date.now()).getFullYear(),
          index: startNumber,
        })

    const base = {
      certificate_no: curCertNo,
      issue_date: issueDate,
      reason,
      conduct,
      dues_status: duesStatus,
      school_name: settings?.school?.name || 'School Name',
      school_logo: settings?.school?.logo || '',
      principal_signature: 'Principal & Head of School',
      principal_signature_image: settings?.school?.signature || '',
      session_name: session?.label || '2026–2027',
    }

    if (!st) {
      return {
        ...base,
        student_name: 'Student Name',
        first_name: 'Student',
        last_name: 'Name',
        admission_no: 'ADM-0001',
        student_no: 'STU-0001',
        dob: '2010-01-01',
        gender: 'Male',
        father_name: 'Guardian Name',
        mother_name: '',
        guardian_name: 'Guardian Name',
        class_name: 'Class 10',
        section_name: 'Section A',
        roll_no: '01',
      }
    }

    const fullName = [st.first_name, st.middle_name, st.last_name].filter(Boolean).join(' ')
    const fatherName = st.father ? [st.father.first_name, st.father.last_name].filter(Boolean).join(' ') : ''
    const motherName = st.mother ? [st.mother.first_name, st.mother.last_name].filter(Boolean).join(' ') : ''
    const guardianName = st.primary_guardian
      ? [st.primary_guardian.first_name, st.primary_guardian.last_name].filter(Boolean).join(' ')
      : fatherName || motherName

    return {
      ...base,
      student_name: fullName,
      first_name: st.first_name || '',
      last_name: st.last_name || '',
      admission_no: st.admission_number || '',
      student_no: st.student_number || '',
      dob: st.date_of_birth || '',
      gender: st.gender || 'Male',
      father_name: fatherName,
      mother_name: motherName,
      guardian_name: guardianName,
      class_name: st.enrollment?.unit_name || '',
      section_name: st.enrollment?.group_name || '',
      roll_no: st.enrollment?.roll_number || '',
    }
  }, [
    canvasStudent,
    mode,
    certificateNo,
    numberScheme,
    numberPrefix,
    startNumber,
    issueDate,
    session,
    reason,
    conduct,
    duesStatus,
    settings,
  ])

  // Live sample generated certificate serials for batch preview
  const sampleBatchSerials = useMemo(() => {
    if (targetStudents.length === 0) return []

    const year = new Date(issueDate || Date.now()).getFullYear()
    const pfx = numberPrefix.trim() || 'CERT'
    const unitCode = isMultiClass
      ? 'MULTI'
      : isSingleClass && singleUnitId
      ? units.find((u) => u.id === singleUnitId)?.name?.replace(/[^A-Za-z0-9]/g, '') || 'STD'
      : 'ALL'
    const fmt = (s?: FullStudent, idx = 0) =>
      formatCertificateNumber({
        scheme: isMultiClass && numberScheme === 'roll_no' ? 'sequential' : numberScheme,
        prefix: pfx,
        year,
        unitCode,
        admissionNo: s?.admission_number || s?.student_number || `ADM${idx + 1}`,
        rollNo: s?.enrollment?.roll_number || String(idx + 1),
        index: startNumber + idx,
      })

    return [fmt(targetStudents[0], 0), fmt(targetStudents[targetStudents.length - 1], targetStudents.length - 1)]
  }, [numberScheme, numberPrefix, startNumber, issueDate, targetStudents, units, singleUnitId, isMultiClass, isSingleClass])

  // ─── Single Mode Submission ────────────────────────────────────────────────
  const handleSingleIssue = async () => {
    if (!selectedStudentId) {
      toast.error(__('Please select a student.', 'codeclove-school-management'))
      return
    }

    const currentStudentName = activeSingleStudent
      ? `${activeSingleStudent.first_name} ${activeSingleStudent.last_name}`
      : 'Student'
    const currentCertNo = certificateNo
    const currentDocData = { ...livePreviewDocData }
    const currentTemplate = selectedTemplate

    try {
      await issueMutation.mutateAsync({
        student_id: selectedStudentId,
        template_id: selectedTemplateId,
        certificate_no: certificateNo,
        issue_date: issueDate,
        reason,
        conduct,
        dues_status: duesStatus,
        update_student_status: updateStatus ? 'withdrawn' : '',
      })

      if (currentTemplate) {
        setIssuedSuccess({
          studentName: currentStudentName,
          certificateNo: currentCertNo,
          template: currentTemplate,
          docData: currentDocData,
        })
      }

      toast.success(__('Certificate successfully issued.', 'codeclove-school-management'))
    } catch {
      toast.error(__('Failed to issue certificate.', 'codeclove-school-management'))
    }
  }

  // ─── Batch Mode Submission (Chunked for scalability & zero timeouts) ─────
  const handleBatchIssue = async () => {
    if (targetStudents.length === 0) {
      toast.error(__('Please include at least one student for batch issuance.', 'codeclove-school-management'))
      return
    }

    const CHUNK_SIZE = 50
    const studentIds = targetStudents.map((s) => s.id)
    const totalStudents = studentIds.length
    // If large batch (> CHUNK_SIZE), show progress dialog
    if (totalStudents > CHUNK_SIZE) {
      setBatchProgress({
        isOpen: true,
        current: 0,
        total: totalStudents,
        statusText: sprintf(__('Preparing to issue %d certificates...', 'codeclove-school-management'), totalStudents),
      })
    }

    const accumulatedCerts: IssuedCertificate[] = []
    let currentStartNumber = startNumber

    try {
      for (let i = 0; i < totalStudents; i += CHUNK_SIZE) {
        const chunk = studentIds.slice(i, i + CHUNK_SIZE)

        if (totalStudents > CHUNK_SIZE) {
          setBatchProgress({
            isOpen: true,
            current: i,
            total: totalStudents,
            statusText: sprintf(
              __('Issuing certificates: %d of %d complete...', 'codeclove-school-management'),
              i,
              totalStudents
            ),
          })
        }

        const result = await bulkIssueMutation.mutateAsync({
          student_ids: chunk,
          template_id: selectedTemplateId,
          number_scheme: numberScheme,
          number_prefix: numberPrefix,
          start_number: currentStartNumber,
          issue_date: issueDate,
          reason,
          conduct,
          dues_status: duesStatus,
        })

        if (result.certificates) {
          accumulatedCerts.push(...result.certificates)
        }

        currentStartNumber += chunk.length
      }

      setBatchProgress((prev) => ({ ...prev, isOpen: false }))

      if (accumulatedCerts.length > 0) {
        setBatchIssuedCerts(accumulatedCerts)
        setBatchSuccessModalOpen(true)
        toast.success(
          sprintf(
            __('Successfully issued %d certificates.', 'codeclove-school-management'),
            accumulatedCerts.length
          )
        )
      } else {
        toast.error(__('No certificates could be issued.', 'codeclove-school-management'))
      }
    } catch {
      setBatchProgress((prev) => ({ ...prev, isOpen: false }))
      toast.error(__('Failed to issue batch certificates.', 'codeclove-school-management'))
    }
  }

  const handlePrintCurrentPreview = () => {
    if (selectedTemplate) {
      setPrintQueue({ template: selectedTemplate, certs: [livePreviewDocData] })
    }
  }

  const handlePrintLastIssued = () => {
    if (issuedSuccess) {
      setPrintQueue({ template: issuedSuccess.template, certs: [issuedSuccess.docData] })
    }
  }

  const handleTriggerBatchPrint = () => {
    if (selectedTemplate && batchIssuedCerts.length > 0) {
      setPrintQueue({
        template: selectedTemplate,
        certs: batchIssuedCerts.map((c) => resolveCertificatePrintData(c)),
      })
    }
  }

  const handleTriggerClassBatchPrint = (classCerts: IssuedCertificate[]) => {
    if (selectedTemplate && classCerts.length > 0) {
      setPrintQueue({
        template: selectedTemplate,
        certs: classCerts.map((c) => resolveCertificatePrintData(c)),
      })
    }
  }

  // Group issued batch certificates by academic unit for organized classroom distribution
  const batchIssuedCertsByClass = useMemo(() => {
    const groupsMap = new Map<string, IssuedCertificate[]>()
    for (const cert of batchIssuedCerts) {
      const className = cert.metadata?.academic?.unit_name || __('Other / Unassigned', 'codeclove-school-management')
      const existing = groupsMap.get(className) || []
      existing.push(cert)
      groupsMap.set(className, existing)
    }
    return Array.from(groupsMap.entries()).map(([className, certs]) => ({
      className,
      certs,
    }))
  }, [batchIssuedCerts])

  const handleToggleExcludeStudent = (id: number) => {
    setExcludedStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleIncludeAll = () => {
    setExcludedStudentIds(new Set())
  }

  const handleExcludeAll = () => {
    setExcludedStudentIds(new Set(batchStudents.map((s) => s.id)))
  }

  const isPending = issueMutation.isPending || bulkIssueMutation.isPending

  return (
    <div className="space-y-5">
      <PageHeader
        title={__('Issue Certificate', 'codeclove-school-management')}
        description={sprintf(
          __('Issue certificates individually or in batches by %s and %s.', 'codeclove-school-management'),
          classLabel.toLowerCase(),
          sectionLabel.toLowerCase()
        )}
        breadcrumbs={[
          { label: __('Academics', 'codeclove-school-management'), href: '/academics/sessions' },
          { label: __('Certificates', 'codeclove-school-management'), href: '/academics/certificates' },
          { label: __('Issue Certificate', 'codeclove-school-management') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate('/academics/certificates')}
              className="gap-1.5"
            >
              <ArrowLeft size={14} />
              <span>{__('Cancel', 'codeclove-school-management')}</span>
            </Button>

            {mode === 'single' ? (
              <>
                <Button
                  variant="secondary"
                  onClick={handlePrintCurrentPreview}
                  disabled={!selectedStudentId}
                  className="gap-1.5"
                  title={__('Print current certificate preview', 'codeclove-school-management')}
                >
                  <Printer size={14} />
                  <span>{__('Print Preview', 'codeclove-school-management')}</span>
                </Button>

                <Button
                  onClick={handleSingleIssue}
                  disabled={isPending || !selectedStudentId}
                  className="gap-1.5"
                >
                  {issueMutation.isPending ? <Spinner size="sm" /> : <Award size={14} />}
                  <span>{__('Issue Certificate', 'codeclove-school-management')}</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={handlePrintCurrentPreview}
                  disabled={batchStudents.length === 0}
                  className="gap-1.5"
                  title={__('Print preview of active student certificate', 'codeclove-school-management')}
                >
                  <Printer size={14} />
                  <span>{__('Print Preview', 'codeclove-school-management')}</span>
                </Button>

                <Button
                  onClick={handleBatchIssue}
                  disabled={isPending || targetStudents.length === 0}
                  className="gap-1.5"
                >
                  {bulkIssueMutation.isPending ? <Spinner size="sm" /> : <FileCheck size={14} />}
                  <span>
                    {targetStudents.length > 0
                      ? sprintf(
                          __('Issue %d Certificates', 'codeclove-school-management'),
                          targetStudents.length
                        )
                      : __('No Students Selected', 'codeclove-school-management')}
                  </span>
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* ─── Single Mode Success Alert Banner ──────────────────────────────────── */}
      {issuedSuccess && mode === 'single' && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 dark:text-emerald-200 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">
                {sprintf(__('Certificate %s Successfully Issued!', 'codeclove-school-management'), issuedSuccess.certificateNo)}
              </div>
              <p className="text-2xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                {sprintf(__('Issued for %s. You can print it now, or select another student below to continue issuing.', 'codeclove-school-management'), issuedSuccess.studentName)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePrintLastIssued}
              className="gap-1.5 h-8 text-xs bg-white dark:bg-bg-elevated border-emerald-600/30 text-emerald-900 dark:text-emerald-100"
            >
              <Printer size={13} />
              <span>{__('Print Certificate', 'codeclove-school-management')}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate('/academics/certificates?tab=issued')}
              className="h-8 text-xs text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/15"
            >
              <span>{__('View in Register', 'codeclove-school-management')}</span>
            </Button>
          </div>
        </div>
      )}

      {/* ─── Mode Switcher: Single Student vs Class / Section Batch ───────────── */}
      <div className="p-1 rounded-xl bg-bg-surface border border-border inline-flex items-center gap-1 self-start text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer select-none text-xs',
            mode === 'single'
              ? 'bg-bg-elevated text-text font-semibold shadow-xs border border-border'
              : 'text-text-muted hover:text-text hover:bg-hover-bg'
          )}
        >
          <User size={14} className={mode === 'single' ? 'text-brand' : 'text-text-muted'} />
          <span className="whitespace-nowrap">{sprintf(__('Single %s', 'codeclove-school-management'), studentLabel)}</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('batch')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer select-none text-xs',
            mode === 'batch'
              ? 'bg-bg-elevated text-text font-semibold shadow-xs border border-border'
              : 'text-text-muted hover:text-text hover:bg-hover-bg'
          )}
        >
          <Users size={14} className={mode === 'batch' ? 'text-brand' : 'text-text-muted'} />
          <span className="whitespace-nowrap">{sprintf(__('%s / %s Batch', 'codeclove-school-management'), classLabel, sectionLabel)}</span>
        </button>
      </div>

      {/* ─── Two-Column Workspace ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form (Single or Batch) */}
        <div className="lg:col-span-5">
          {mode === 'single' ? (
            <SingleIssueForm
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onSelectTemplateId={setSelectedTemplateId}
              selectedTemplate={selectedTemplate}
              units={units}
              filterUnitId={filterUnitId}
              onFilterUnitIdChange={setFilterUnitId}
              students={singleStudents}
              loadingStudents={loadingSingleStudents}
              selectedStudentId={selectedStudentId}
              onSelectStudentId={setSelectedStudentId}
              feeSummary={feeSummary}
              loadingFeeSummary={loadingFeeSummary}
              certificateNo={certificateNo}
              onCertificateNoChange={setCertificateNo}
              onRegenerateCertNo={handleRegenerateSingleCertNo}
              issueDate={issueDate}
              onIssueDateChange={setIssueDate}
              reason={reason}
              onReasonChange={setReason}
              conduct={conduct}
              onConductChange={setConduct}
              duesStatus={duesStatus}
              onDuesStatusChange={setDuesStatus}
              updateStatus={updateStatus}
              onUpdateStatusChange={setUpdateStatus}
            />
          ) : (
            <BatchIssueForm
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onSelectTemplateId={setSelectedTemplateId}
              selectedTemplate={selectedTemplate}
              units={units}
              selectedUnitIds={selectedUnitIds}
              onSelectUnitIds={(ids) => {
                setSelectedUnitIds(ids)
                if (ids.length !== 1) {
                  setSelectedGroupId(undefined)
                }
              }}
              groups={groups}
              selectedGroupId={selectedGroupId}
              onSelectGroupId={setSelectedGroupId}
              batchStudents={batchStudents}
              loadingBatchStudents={loadingBatchStudents}
              excludedStudentIds={excludedStudentIds}
              onToggleExcludeStudent={handleToggleExcludeStudent}
              onIncludeAll={handleIncludeAll}
              onExcludeAll={handleExcludeAll}
              previewStudentId={previewStudentId}
              onSelectPreviewStudent={setPreviewStudentId}
              numberScheme={numberScheme}
              onNumberSchemeChange={setNumberScheme}
              numberPrefix={numberPrefix}
              onNumberPrefixChange={setNumberPrefix}
              startNumber={startNumber}
              onStartNumberChange={setStartNumber}
              issueDate={issueDate}
              onIssueDateChange={setIssueDate}
              sampleBatchSerials={sampleBatchSerials}
              reason={reason}
              onReasonChange={setReason}
              conduct={conduct}
              onConductChange={setConduct}
              duesStatus={duesStatus}
              onDuesStatusChange={setDuesStatus}
            />
          )}
        </div>

        {/* Right Column: Live A4 Document Preview */}
        <div className="lg:col-span-7 sticky top-4">
          <CertificateLivePreview
            mode={mode}
            canvasStudent={canvasStudent || null}
            selectedTemplate={selectedTemplate}
            livePreviewDocData={livePreviewDocData}
          />
        </div>
      </div>

      {/* ─── Unified Hidden Print Container ──────────────────────────────────── */}
      {printQueue && (
        <div ref={printRef} className="hidden">
          {printQueue.certs.map((docData, i) => (
            <div key={i} style={i > 0 ? { pageBreakBefore: 'always', breakBefore: 'page' } : undefined}>
              <CertificateDocument
                template={printQueue.template}
                data={docData}
              />
            </div>
          ))}
        </div>
      )}
      {/* ─── Batch Issuance Progress Modal ──────────────────────────────────── */}
      <Modal
        open={batchProgress.isOpen}
        onOpenChange={() => {}}
        title={__('Issuing Official Certificates', 'codeclove-school-management')}
      >
        <div className="py-4 space-y-4">
          <div className="flex items-center gap-3">
            <Spinner size="md" className="text-brand shrink-0" />
            <div className="min-w-0">
              <span className="text-sm font-semibold text-text block">
                {batchProgress.statusText}
              </span>
              <span className="text-xs text-text-muted">
                {__('Generating secure certificate snapshots and cryptographic verification hashes in chunks...', 'codeclove-school-management')}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-bg-surface border border-border rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-brand h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100)}%`,
              }}
            />
          </div>

          <div className="flex justify-between text-2xs font-mono text-text-muted">
            <span>{sprintf(__('%d of %d complete', 'codeclove-school-management'), batchProgress.current, batchProgress.total)}</span>
            <span>{`${Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100)}%`}</span>
          </div>
        </div>
      </Modal>

      {/* ─── Batch Success Modal ────────────────────────────────────────────── */}
      <Modal
        open={batchSuccessModalOpen}
        onOpenChange={setBatchSuccessModalOpen}
        title={__('Certificates Successfully Issued', 'codeclove-school-management')}
      >
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold text-sm block">
                {sprintf(
                  __('%d Official Certificates Successfully Issued', 'codeclove-school-management'),
                  batchIssuedCerts.length
                )}
              </span>
              <span className="text-xs text-text-muted">
                {__('Each certificate has been recorded in the official register with an immutable snapshot and unique verification token.', 'codeclove-school-management')}
              </span>
            </div>
          </div>

          {batchIssuedCertsByClass.length > 1 ? (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text uppercase tracking-wider">
                  {__('Print by Class Cohort', 'codeclove-school-management')}
                </span>
                <span className="text-2xs font-mono text-text-muted">
                  {sprintf(__('%d classes in batch', 'codeclove-school-management'), batchIssuedCertsByClass.length)}
                </span>
              </div>
              <p className="text-xs text-text-muted">
                {__('Recommended: Print each class separately so individual class teachers receive organized stacks ready for distribution.', 'codeclove-school-management')}
              </p>
              <div className="max-h-48 overflow-y-auto divide-y divide-border/50 border border-border rounded-lg bg-bg-surface">
                {batchIssuedCertsByClass.map(({ className, certs }) => (
                  <div key={className} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-text block">{className}</span>
                      <span className="text-2xs text-text-muted font-mono">
                        {sprintf(__('%d certificates', 'codeclove-school-management'), certs.length)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => handleTriggerClassBatchPrint(certs)}
                    >
                      <Printer size={13} />
                      <span>{__('Print Packet', 'codeclove-school-management')}</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-muted">
              {__('You can immediately batch print all issued certificates formatted on individual A4 pages, or view them in the Issued Register.', 'codeclove-school-management')}
            </p>
          )}

          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setBatchSuccessModalOpen(false)
                navigate('/academics/certificates')
              }}
            >
              {__('Go to Issued Register', 'codeclove-school-management')}
            </Button>
            <Button
              onClick={handleTriggerBatchPrint}
              className="gap-1.5"
            >
              <Printer size={14} />
              <span>{sprintf(__('Batch Print All (%d)', 'codeclove-school-management'), batchIssuedCerts.length)}</span>
            </Button>
          </ModalFooter>
          {batchIssuedCerts.length > 50 && (
            <span className="text-3xs text-text-muted block text-right">
              {__('Note: For large print jobs, printing by class is recommended to prevent browser print dialog lag.', 'codeclove-school-management')}
            </span>
          )}
        </div>
      </Modal>
    </div>
  )
}
