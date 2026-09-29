import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Upload, CheckCircle2, AlertTriangle, FileText, Filter, Globe, UserCheck, Briefcase } from 'lucide-react'
import { useRoles } from '@/api/roles'
import { useImportStaffBulk, getStaffImportTemplate, type BulkStaffImportResult } from '@/api/staff'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { parseCSVText } from '@/lib/csv'
import { __, sprintf } from '@/lib/i18n'
import {
  Button, Card, CardHeader, CardContent, FormField, Select, Alert, Badge,
  PageHeader, TableRoot, Thead, Tbody, Tr, Th, Td, Spinner
} from '@/components/ui'

interface ParsedStaffRow {
  rowIndex: number
  raw: Record<string, string>
  staffName: string
  email: string
  department: string
  designation: string
  isValid: boolean
  errors: string[]
}

export default function StaffImportPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { getLabel } = useLabels()
  const staffLabelPlural = getLabel('staff_member', true, __( 'Staff Members', 'codeclove-school-management' ))

  // Role selection state
  const [roleId, setRoleId] = useState<string>('')
  const { data: rolesData, isLoading: loadingRoles } = useRoles()

  const importMutation = useImportStaffBulk()

  // Wizard state: 'upload' | 'preview' | 'completed'
  const [step, setStep] = useState<'upload' | 'preview' | 'completed'>('upload')
  const [fileName, setFileName] = useState<string>('')
  const [parsedRows, setParsedRows] = useState<ParsedStaffRow[]>([])
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'errors'>('all')
  const [importResult, setImportResult] = useState<BulkStaffImportResult | null>(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)

  const roleOptions = useMemo(
    () => (rolesData || []).map((r) => ({ value: String(r.id), label: r.name })),
    [rolesData]
  )

  // Pre-import client validation
  const validateRow = (row: Record<string, string>, index: number): ParsedStaffRow => {
    const errors: string[] = []
    const firstName = row.first_name || row.given_name || ''
    const lastName = row.last_name || row.surname || ''
    const staffName = row.name || `${firstName} ${lastName}`.trim()
    const email = row.email || ''

    if (!firstName && !row.name) {
      errors.push(__( 'First name or Full name is required', 'codeclove-school-management' ))
    }
    if (!lastName && !row.name) {
      errors.push(__( 'Last name is required', 'codeclove-school-management' ))
    }
    if (!email) {
      errors.push(__( 'Email address is required', 'codeclove-school-management' ))
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(__( 'Invalid email address format', 'codeclove-school-management' ))
    }

    return {
      rowIndex: index + 1,
      raw: row,
      staffName: staffName || sprintf( __( 'Row #%d', 'codeclove-school-management' ), index + 1 ),
      email: email || __( 'Missing Email', 'codeclove-school-management' ),
      department: row.department || row.dept || __( 'Unassigned', 'codeclove-school-management' ),
      designation: row.designation || row.title || __( 'Staff', 'codeclove-school-management' ),
      isValid: errors.length === 0,
      errors,
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
      const data = await getStaffImportTemplate()
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [data.headers.join(','), ...data.samples.map((s) => s.map((v) => `"${v}"`).join(','))].join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', 'codeclove_staff_import_template.csv')
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
        role_id: roleId ? Number(roleId) : null,
        rows: rowsToImport,
      },
      {
        onSuccess: (res) => {
          setImportResult(res)
          setStep('completed')
          toast.success(sprintf( __( 'Successfully imported %1$d %2$s!', 'codeclove-school-management' ), res.imported_count, staffLabelPlural.toLowerCase() ))
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
        title={sprintf( __( 'Bulk Import %s', 'codeclove-school-management' ), staffLabelPlural )}
        description={__( 'Batch import faculty and administrative personnel directory records via CSV upload with pre-import verification.', 'codeclove-school-management' )}
        onBack={() => navigate('/staff')}
        breadcrumbs={[
          { label: staffLabelPlural },
          { label: __( 'Directory', 'codeclove-school-management' ), href: '/staff' },
          { label: __( 'Bulk Import', 'codeclove-school-management' ) },
        ]}
      />

      {/* Stepper Bar */}
      <div className="flex items-center gap-2 border-b border-border pb-4 overflow-x-auto scrollbar-none max-w-full">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${step === 'upload' ? 'bg-brand-dim text-brand font-semibold border border-brand/30' : step === 'preview' || step === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-subtle'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs ${step === 'upload' ? 'bg-brand text-white' : step === 'preview' || step === 'completed' ? 'bg-emerald-500 text-white' : 'bg-bg-elevated text-text-subtle border border-border'}`}>
            {step === 'preview' || step === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : '1'}
          </span>
          <span>{__( 'Role & CSV Upload', 'codeclove-school-management' )}</span>
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

      {/* STEP 1: UPLOAD & ROLE */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="md:col-span-2">
            <CardHeader>
              <div>
                <h3 className="font-semibold text-sm text-text">{__( 'Default Role & File Selection', 'codeclove-school-management' )}</h3>
                <p className="text-xs text-text-subtle mt-0.5">{__( 'Optionally select a default system role and upload directory `.csv` file.', 'codeclove-school-management' )}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              <div className="bg-bg-base p-3.5 rounded-lg border border-border">
                <FormField label={__( 'Default Staff System Role (Optional)', 'codeclove-school-management' )}>
                  <Select
                    value={roleId}
                    onValueChange={(val) => setRoleId(val)}
                    options={[{ value: '', label: __( 'Select System Role (Or use CSV column)...', 'codeclove-school-management' ) }, ...roleOptions]}
                    disabled={loadingRoles}
                  />
                </FormField>
              </div>

              <div className="border-2 border-dashed border-border hover:border-brand rounded-lg p-7 text-center bg-bg-surface hover:bg-bg-elevated transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-text-subtle mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-text mb-1">
                  {__( 'Upload Staff Directory CSV', 'codeclove-school-management' )}
                </h4>
                <p className="text-xs text-text-subtle mb-4 max-w-xs mx-auto">
                  {__( 'Select `.csv` containing staff directory records', 'codeclove-school-management' )}
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="staff-csv-file-input"
                />
                <Button
                  variant="default"
                  onClick={() => document.getElementById('staff-csv-file-input')?.click()}
                  size="sm"
                >
                  {__( 'Browse Files', 'codeclove-school-management' )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Format Guide Card */}
          <Card>
            <CardHeader>
              <div>
                <h3 className="font-semibold text-sm text-text">{__( 'Staff CSV Format Guide', 'codeclove-school-management' )}</h3>
                <p className="text-xs text-text-subtle mt-0.5">{__( 'Field Aliases & Structure', 'codeclove-school-management' )}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-text-subtle pt-4">
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <UserCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-text block">{__( 'Mandatory Identity:', 'codeclove-school-management' )}</span>
                    <p className="text-text-subtle mb-1">{__( 'Name and unique email:', 'codeclove-school-management' )}</p>
                    <div className="flex flex-wrap gap-1">
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">first_name</code>
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">last_name</code>
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">email</code>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-text block">{__( 'Employment Details:', 'codeclove-school-management' )}</span>
                    <p className="text-text-subtle mb-1">{__( 'Position & department:', 'codeclove-school-management' )}</p>
                    <div className="flex flex-wrap gap-1">
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">department</code>
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">designation</code>
                      <code className="px-1.5 py-0.5 rounded bg-bg-base border border-border text-text font-mono text-2xs">joined_on</code>
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
                  {downloadingTemplate ? __( 'Downloading...', 'codeclove-school-management' ) : __( 'Download Staff CSV Sample', 'codeclove-school-management' )}
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
                    {roleId ? sprintf( __( 'Default Role ID #%s', 'codeclove-school-management' ), roleId ) : __( 'No default role override selected', 'codeclove-school-management' )}
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
                <Th>{__( 'Staff Name', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Email Address', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Department / Designation', 'codeclove-school-management' )}</Th>
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
                  <Td className="font-medium text-text">{row.staffName}</Td>
                  <Td className="text-xs font-mono">{row.email}</Td>
                  <Td className="text-xs text-text-subtle">{row.department} / {row.designation}</Td>
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
            <h3 className="text-xl font-bold text-text">{__( 'Staff Batch Import Complete', 'codeclove-school-management' )}</h3>
            <p className="text-sm text-text-subtle">
              {__( 'Bulk staff directory processing has successfully finished.', 'codeclove-school-management' )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-center">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{importResult.imported_count}</div>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 mt-1">{__( 'Imported', 'codeclove-school-management' )}</div>
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
                <Th>{__( 'Staff Number', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Full Name', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Status', 'codeclove-school-management' )}</Th>
                <Th>{__( 'Details', 'codeclove-school-management' )}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {importResult.details.map((item, idx) => (
                <Tr key={idx}>
                  <Td className="font-mono text-xs text-text-subtle">{item.row}</Td>
                  <Td className="font-mono text-xs font-medium text-text">{item.staff_number || '-'}</Td>
                  <Td className="font-medium text-text">{item.name}</Td>
                  <Td>
                    {item.status === 'success' ? (
                      <Badge variant="success">{__( 'Success', 'codeclove-school-management' )}</Badge>
                    ) : (
                      <Badge variant="danger">{__( 'Failed', 'codeclove-school-management' )}</Badge>
                    )}
                  </Td>
                  <Td className="text-xs text-text-subtle">{item.message || __( 'Created & Enrolled', 'codeclove-school-management' )}</Td>
                </Tr>
              ))}
            </Tbody>
          </TableRoot>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setStep('upload')}>
              {__( 'Import Another File', 'codeclove-school-management' )}
            </Button>
            <Button variant="default" size="sm" onClick={() => navigate('/staff')}>
              {__( 'Return to Staff Directory', 'codeclove-school-management' )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
