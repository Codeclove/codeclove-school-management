import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Upload, CheckCircle2, AlertTriangle, FileText, Filter, Globe, ShieldCheck, UserCheck } from 'lucide-react'
import { useSessions, useUnits, useGroups } from '@/api/academics'
import { useImportStudentsBulk, getImportTemplate, type BulkImportResult } from '@/api/students'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { formatGender } from '@/lib/formatter'
import { parseCSVText } from '@/lib/csv'
import { __, sprintf } from '@/lib/i18n'
import {
  Button, Card, CardHeader, CardContent, FormField, Select, Alert, Badge,
  PageHeader, TableRoot, Thead, Tbody, Tr, Th, Td, Spinner
} from '@/components/ui'

interface ParsedRow {
  rowIndex: number
  raw: Record<string, string>
  studentName: string
  dob: string
  gender: string
  guardianSummary: string
  isValid: boolean
  errors: string[]
}

export default function StudentImportPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { getLabel } = useLabels()
  const studentLabelPlural = getLabel('student', true, __( 'Students', 'codeclove-school-management' ))
  const unitLabelSingular = getLabel('academic_unit', false, __( 'Class Level', 'codeclove-school-management' ))
  const groupLabelSingular = getLabel('academic_group', false, __( 'Section', 'codeclove-school-management' ))
  // Academic placement state
  const [sessionId, setSessionId] = useState<string>('')
  const [unitId, setUnitId] = useState<string>('')
  const [groupId, setGroupId] = useState<string>('')

  // Query options for placement selects
  const { data: sessionsRes, isLoading: loadingSessions } = useSessions()
  const { data: unitsRes, isLoading: loadingUnits } = useUnits()
  const { data: groupsRes, isLoading: loadingGroups } = useGroups(
    unitId ? { unit_id: Number(unitId) } : undefined
  )

  const importMutation = useImportStudentsBulk()

  // Wizard state: 'upload' | 'preview' | 'completed'
  const [step, setStep] = useState<'upload' | 'preview' | 'completed'>('upload')
  const [fileName, setFileName] = useState<string>('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'errors'>('all')
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)

  // Options for dropdowns
  const sessionOptions = useMemo(
    () => (sessionsRes?.data || []).map((s) => ({ value: String(s.id), label: s.name })),
    [sessionsRes]
  )
  const unitOptions = useMemo(
    () => (unitsRes?.data || []).map((u) => ({ value: String(u.id), label: u.name })),
    [unitsRes]
  )
  const groupOptions = useMemo(
    () => (groupsRes?.data || []).map((g) => ({ value: String(g.id), label: g.name })),
    [groupsRes]
  )

  // Pre-import client validation
  const validateRow = (row: Record<string, string>, index: number): ParsedRow => {
    const errors: string[] = []
    const firstName = row.first_name || row.given_name || ''
    const lastName = row.last_name || row.surname || row.family_name || ''
    const studentName = row.student_name || `${firstName} ${lastName}`.trim()

    if (!firstName && !row.student_name) {
      errors.push(__( 'First name or Student name is required', 'codeclove-school-management' ))
    }
    if (!lastName && !row.student_name) {
      errors.push(__( 'Last name is required', 'codeclove-school-management' ))
    }

    const hasFather = Boolean(row.father_first_name || row.father_name)
    const hasMother = Boolean(row.mother_first_name || row.mother_name)
    const hasGuardian = Boolean(row.guardian_first_name || row.guardian_name)

    if (!hasFather && !hasMother && !hasGuardian) {
      errors.push(__( 'At least one Father, Mother, or Guardian detail is required', 'codeclove-school-management' ))
    }

    const guardianParts: string[] = []
    if (hasFather) guardianParts.push(sprintf( __( 'Father: %s', 'codeclove-school-management' ), row.father_first_name || row.father_name ))
    if (hasMother) guardianParts.push(sprintf( __( 'Mother: %s', 'codeclove-school-management' ), row.mother_first_name || row.mother_name ))
    if (hasGuardian) guardianParts.push(sprintf( __( 'Guardian: %s', 'codeclove-school-management' ), row.guardian_first_name || row.guardian_name ))

    return {
      rowIndex: index + 1,
      raw: row,
      studentName: studentName || sprintf( __( 'Row #%d', 'codeclove-school-management' ), index + 1 ),
      dob: row.date_of_birth || row.dob || '-',
      gender: row.gender || row.sex || 'male',
      guardianSummary: guardianParts.join(', ') || __( 'None provided', 'codeclove-school-management' ),
      isValid: errors.length === 0,
      errors,
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!sessionId || !unitId) {
      toast.error(sprintf( __( 'Please select Academic Session and %s before uploading.', 'codeclove-school-management' ), unitLabelSingular ))
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      if (!text) {
        toast.error(__( 'File appears to be empty.', 'codeclove-school-management' ))
        return
      }
      const rawRows = parseCSVText(text)
      if (rawRows.length === 0) {
        toast.error(__( 'No valid data rows found in CSV file.', 'codeclove-school-management' ))
        return
      }
      const validated = rawRows.map((r, i) => validateRow(r, i))
      setParsedRows(validated)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true)
      const data = await getImportTemplate()
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [data.headers.join(','), ...data.samples.map((s) => s.map((v) => `"${v}"`).join(','))].join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', 'codeclove_student_import_template.csv')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success(__( 'CSV Template downloaded.', 'codeclove-school-management' ))
    } catch {
      toast.error(__( 'Failed to download CSV template.', 'codeclove-school-management' ))
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const validRowsCount = useMemo(() => parsedRows.filter((r) => r.isValid).length, [parsedRows])
  const errorRowsCount = useMemo(() => parsedRows.filter((r) => !r.isValid).length, [parsedRows])

  const filteredRows = useMemo(() => {
    if (filterMode === 'valid') return parsedRows.filter((r) => r.isValid)
    if (filterMode === 'errors') return parsedRows.filter((r) => !r.isValid)
    return parsedRows
  }, [parsedRows, filterMode])

  const handleExecuteImport = () => {
    const rowsToImport = parsedRows.filter((r) => r.isValid).map((r) => r.raw)
    if (rowsToImport.length === 0) {
      toast.error(__( 'No valid rows available to import.', 'codeclove-school-management' ))
      return
    }

    importMutation.mutate(
      {
        academic_session_id: Number(sessionId),
        academic_unit_id: Number(unitId),
        academic_group_id: groupId ? Number(groupId) : null,
        rows: rowsToImport,
      },
      {
        onSuccess: (res) => {
          setImportResult(res)
          setStep('completed')
          toast.success(sprintf( __( 'Successfully imported %1$d %2$s!', 'codeclove-school-management' ), res.imported_count, studentLabelPlural.toLowerCase() ))
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : '')
          toast.error(message || __( 'Bulk import failed.', 'codeclove-school-management' ))
        },
      }
    )
  }

  return (
    <div className="space-y-5 w-full max-w-5xl mx-auto">
      <PageHeader
        title={sprintf( __( 'Bulk Import %s', 'codeclove-school-management' ), studentLabelPlural )}
        description={sprintf( __( 'Enroll batches of %s into academic units via CSV upload with real-time pre-import verification.', 'codeclove-school-management' ), studentLabelPlural.toLowerCase() )}
        onBack={() => navigate('/students')}
        breadcrumbs={[
          { label: studentLabelPlural },
          { label: __( 'Directory', 'codeclove-school-management' ), href: '/students' },
          { label: __( 'Bulk Import', 'codeclove-school-management' ) },
        ]}
      />

      {/* Clean CodeClove Stepper Bar */}
      <div className="flex items-center gap-2 border-b border-border pb-4 overflow-x-auto scrollbar-none max-w-full">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${step === 'upload' ? 'bg-brand-dim text-brand font-semibold border border-brand/30' : step === 'preview' || step === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-subtle'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs ${step === 'upload' ? 'bg-brand text-white' : step === 'preview' || step === 'completed' ? 'bg-emerald-500 text-white' : 'bg-bg-elevated text-text-subtle border border-border'}`}>
            {step === 'preview' || step === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : '1'}
          </span>
          <span>{__( 'Placement & CSV File', 'codeclove-school-management' )}</span>
        </div>
        <span className="text-text-subtle text-xs">→</span>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${step === 'preview' ? 'bg-brand-dim text-brand font-semibold border border-brand/30' : step === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-subtle'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs ${step === 'preview' ? 'bg-brand text-white' : step === 'completed' ? 'bg-emerald-500 text-white' : 'bg-bg-elevated text-text-subtle border border-border'}`}>
            {step === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : '2'}
          </span>
          <span>{__( 'Verify & Preview', 'codeclove-school-management' )}</span>
        </div>
        <span className="text-text-subtle text-xs">→</span>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${step === 'completed' ? 'bg-emerald-500 text-white font-semibold' : 'text-text-subtle'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs ${step === 'completed' ? 'bg-white text-emerald-600' : 'bg-bg-elevated text-text-subtle border border-border'}`}>
            3
          </span>
          <span>{__( 'Import Summary', 'codeclove-school-management' )}</span>
        </div>
      </div>

      {/* STEP 1: UPLOAD & PLACEMENT */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="md:col-span-2">
            <CardHeader>
              <div>
                <h3 className="font-semibold text-sm text-text">{__( 'Target Placement & File Upload', 'codeclove-school-management' )}</h3>
                <p className="text-xs text-text-subtle mt-0.5">{__( 'Select academic target parameters and upload directory `.csv` file.', 'codeclove-school-management' )}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-bg-base p-3.5 rounded-lg border border-border">
                <FormField label={__( 'Academic Session', 'codeclove-school-management' )} required>
                  <Select
                    value={sessionId}
                    onValueChange={(val) => setSessionId(val)}
                    options={[{ value: '', label: __( 'Select Session...', 'codeclove-school-management' ) }, ...sessionOptions]}
                    disabled={loadingSessions}
                  />
                </FormField>
                <FormField label={unitLabelSingular} required>
                  <Select
                    value={unitId}
                    onValueChange={(val) => {
                      setUnitId(val)
                      setGroupId('')
                    }}
                    options={[{ value: '', label: sprintf( __( 'Select %s...', 'codeclove-school-management' ), unitLabelSingular ) }, ...unitOptions]}
                    disabled={loadingUnits}
                  />
                </FormField>
                <FormField label={sprintf( __( '%s (Optional)', 'codeclove-school-management' ), groupLabelSingular )}>
                  <Select
                    value={groupId}
                    onValueChange={(val) => setGroupId(val)}
                    options={[{ value: '', label: __( 'All / Unassigned', 'codeclove-school-management' ) }, ...groupOptions]}
                    disabled={!unitId || loadingGroups}
                  />
                </FormField>
              </div>
              <div className={`border-2 border-dashed rounded-lg p-7 text-center transition-colors ${!sessionId || !unitId ? 'border-border bg-bg-base/40 opacity-70' : 'border-border hover:border-brand bg-bg-surface hover:bg-bg-elevated cursor-pointer'}`}>
                <Upload className="w-8 h-8 text-text-subtle mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-text mb-1">
                  {__( 'Upload Directory CSV File', 'codeclove-school-management' )}
                </h4>
                <p className="text-xs text-text-subtle mb-4 max-w-xs mx-auto">
                  {__( 'Select `.csv` containing student directory records', 'codeclove-school-management' )}
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-file-input"
                  disabled={!sessionId || !unitId}
                />
                <Button
                  variant={!sessionId || !unitId ? 'secondary' : 'default'}
                  disabled={!sessionId || !unitId}
                  onClick={() => document.getElementById('csv-file-input')?.click()}
                  size="sm"
                >
                  {__( 'Browse Files', 'codeclove-school-management' )}
                </Button>
                {(!sessionId || !unitId) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {sprintf( __( 'Please select Academic Session and %s above to upload.', 'codeclove-school-management' ), unitLabelSingular )}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Format Guide Card */}
          <Card>
            <CardHeader>
              <div>
                <h3 className="font-semibold text-sm text-text">{__( 'CSV Format Guide', 'codeclove-school-management' )}</h3>
                <p className="text-xs text-text-subtle mt-0.5">{__( 'International Presets (US, UK, INDIA)', 'codeclove-school-management' )}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-text-subtle pt-4">
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <UserCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-text block">{__( 'Student Identity:', 'codeclove-school-management' )}</span>
                    <p className="text-text-subtle mb-1">{__( 'Required names:', 'codeclove-school-management' )}</p>
                    <div className="flex flex-wrap gap-1">
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">first_name</code>
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">last_name</code>
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">student_name</code>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-text block">{__( 'Parent / Guardian:', 'codeclove-school-management' )}</span>
                    <p className="text-text-subtle mb-1">{__( 'At least one required:', 'codeclove-school-management' )}</p>
                    <div className="flex flex-wrap gap-1">
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">father_name</code>
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">mother_name</code>
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">guardian_name</code>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-text block">{__( 'Postal Code Presets:', 'codeclove-school-management' )}</span>
                    <p className="text-text-subtle mb-1">{__( 'Flexible header aliases:', 'codeclove-school-management' )}</p>
                    <div className="flex flex-wrap gap-1">
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">zip_code</code>
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">postcode</code>
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">pincode</code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <Button
                  variant="secondary"
                  className="w-full flex items-center justify-center gap-2 text-xs"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  size="sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingTemplate ? __( 'Downloading...', 'codeclove-school-management' ) : __( 'Download Sample CSV', 'codeclove-school-management' )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2: PRE-IMPORT VERIFICATION PREVIEW */}
      {step === 'preview' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-dim text-brand rounded-md">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-text text-sm">
                    {fileName}
                  </h3>
                  <p className="text-xs text-text-subtle">
                    {sprintf( __( 'Target: Session #%1$s | Class #%2$s %3$s', 'codeclove-school-management' ), sessionId, unitId, groupId ? sprintf( __( '| Section #%s', 'codeclove-school-management' ), groupId ) : '' )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Badge variant="info">{sprintf( __( 'Total: %d', 'codeclove-school-management' ), parsedRows.length )}</Badge>
                  <Badge variant="success">{sprintf( __( 'Ready: %d', 'codeclove-school-management' ), validRowsCount )}</Badge>
                  {errorRowsCount > 0 && <Badge variant="danger">{sprintf( __( 'Errors: %d', 'codeclove-school-management' ), errorRowsCount )}</Badge>}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>
                    {__( 'Re-upload', 'codeclove-school-management' )}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleExecuteImport}
                    disabled={validRowsCount === 0 || importMutation.isPending}
                  >
                    {importMutation.isPending ? (
                      <>
                        <Spinner className="w-3.5 h-3.5 mr-1.5" /> {__( 'Processing...', 'codeclove-school-management' )}
                      </>
                    ) : (
                      sprintf( __( 'Confirm & Import %d Records', 'codeclove-school-management' ), validRowsCount )
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {errorRowsCount > 0 && (
            <Alert variant="warning" title={__( 'Validation Errors Detected', 'codeclove-school-management' )}>
              {sprintf( __( '%d rows contain validation errors and will be skipped during execution. You can inspect exact line errors below.', 'codeclove-school-management' ), errorRowsCount )}
            </Alert>
          )}

          {/* Toolbar & Filtering */}
          <div className="flex items-center justify-between gap-4 py-1">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-text-subtle" />
              <span className="text-xs text-text-subtle font-medium">{__( 'Filter View:', 'codeclove-school-management' )}</span>
              <div className="flex gap-1">
                <Button
                  variant={filterMode === 'all' ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setFilterMode('all')}
                >
                  {sprintf( __( 'All (%d)', 'codeclove-school-management' ), parsedRows.length )}
                </Button>
                <Button
                  variant={filterMode === 'valid' ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setFilterMode('valid')}
                >
                  {sprintf( __( 'Ready (%d)', 'codeclove-school-management' ), validRowsCount )}
                </Button>
                <Button
                  variant={filterMode === 'errors' ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setFilterMode('errors')}
                >
                  {sprintf( __( 'Errors (%d)', 'codeclove-school-management' ), errorRowsCount )}
                </Button>
              </div>
            </div>
          </div>

          {/* Pre-import Verification Table */}
          <TableRoot>
            <Thead>
              <Tr>
                <Th>{__( 'Row #', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Status', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Student Name', 'codeclove-school-management' )}</Th>
                <Th>{__( 'DOB / Gender', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Parents / Guardians', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Validation Details', 'codeclove-school-management' )}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredRows.map((row) => (
                <Tr key={row.rowIndex} className={!row.isValid ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''}>
                  <Td className="font-mono text-xs text-text-subtle">{row.rowIndex}</Td>
                  <Td>
                    {row.isValid ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {__( 'Ready', 'codeclove-school-management' )}
                      </Badge>
                    ) : (
                      <Badge variant="danger" className="gap-1">
                        <AlertTriangle className="w-3 h-3" /> {__( 'Error', 'codeclove-school-management' )}
                      </Badge>
                    )}
                  </Td>
                  <Td className="font-medium text-text">{row.studentName}</Td>
                  <Td className="text-xs">{row.dob} / <span>{formatGender(row.gender)}</span></Td>
                  <Td className="text-xs max-w-xs truncate text-text-subtle">{row.guardianSummary}</Td>
                  <Td className="text-xs text-rose-600 dark:text-rose-400">
                    {row.errors.length > 0 ? row.errors.join('; ') : <span className="text-emerald-600 dark:text-emerald-400 font-normal">{__( 'Passed', 'codeclove-school-management' )}</span>}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </TableRoot>
        </div>
      )}

      {/* STEP 3: IMPORT EXECUTION REPORT SUMMARY */}
      {step === 'completed' && importResult && (
        <Card className="space-y-6 p-6">
          <div className="text-center space-y-2 max-w-md mx-auto">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-xl font-bold text-text">{__( 'Batch Enrollment Complete', 'codeclove-school-management' )}</h3>
            <p className="text-sm text-text-subtle">
              {__( 'Bulk directory processing has successfully finished.', 'codeclove-school-management' )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-center">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{importResult.imported_count}</div>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 mt-1">{__( 'Enrolled', 'codeclove-school-management' )}</div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/30 p-4 rounded-lg border border-rose-200 dark:border-rose-800">
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">{importResult.failed_count}</div>
              <div className="text-xs font-semibold text-rose-600 dark:text-rose-300 mt-1">{__( 'Failed Records', 'codeclove-school-management' )}</div>
            </div>
          </div>

          <TableRoot>
            <Thead>
              <Tr>
                <Th>{__( 'Row #', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Student ID', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Full Name', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Status', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Details', 'codeclove-school-management' )}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {importResult.details.map((item, idx) => (
                <Tr key={idx}>
                  <Td className="font-mono text-xs text-text-subtle">{item.row}</Td>
                  <Td className="font-mono text-xs font-medium text-text">{item.student_number || '-'}</Td>
                  <Td className="font-medium text-text">{item.name}</Td>
                  <Td>
                    {item.status === 'success' ? (
                      <Badge variant="success">{__( 'Success', 'codeclove-school-management' )}</Badge>
                    ) : (
                      <Badge variant="danger">{__( 'Failed', 'codeclove-school-management' )}</Badge>
                    )}
                  </Td>
                  <Td className="text-xs text-text-subtle">{item.message || __( 'Admitted & Enrolled', 'codeclove-school-management' )}</Td>
                </Tr>
              ))}
            </Tbody>
          </TableRoot>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setStep('upload')}>
              {__( 'Import Another File', 'codeclove-school-management' )}
            </Button>
            <Button variant="default" size="sm" onClick={() => navigate('/students')}>
              {__( 'Return to Directory', 'codeclove-school-management' )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
