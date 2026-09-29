import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Trash2, X, GraduationCap, Phone } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { __, sprintf } from '@/lib/i18n'
import { invoiceHeaderSchema, type InvoiceHeaderFormValues } from '@/schemas/finance'
import {
  useCreateInvoice,
  useFeeTypes,
  useResolveFeeAmount,
  type Invoice,
} from '@/api/finance'
import { useStudents, useStudentDetails, type FullStudent } from '@/api/students'
import { useUnits, useGroups, useTerms } from '@/api/academics'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { useFormatter } from '@/lib/formatter'
import { useSession } from '@/lib/session-context'
import { useSettings } from '@/api/settings'
import {
  Button,
  PageHeader,
  Card,
  CardContent,
  FormField,
  Input,
  Select,
  DatePicker,
} from '@/components/ui'

type LineItem = {
  fee_type_id: number | null
  description: string
  fee_amount: string
  concession: string
}

export default function CreateInvoicePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const studentIdParam = searchParams.get('student_id')
  const unitIdParam = searchParams.get('unit_id')

  const toast = useToast()
  const { getLabel } = useLabels()
  const { formatCurrency } = useFormatter()
  const { session } = useSession()
  const { data: settingsData } = useSettings()
  const baseCurrency = settingsData?.localization?.currency || 'USD'
  const invoiceLabel = getLabel('invoice', false, __('Invoice', 'codeclove-school-management'))
  const studentLabel = getLabel('student', false, __('Student', 'codeclove-school-management'))
  const unitLabelSingular = getLabel('academic_unit', false, __('Class', 'codeclove-school-management'))
  const unitLabelPlural = getLabel('academic_unit', true, __('Classes', 'codeclove-school-management'))
  const groupLabelSingular = getLabel('academic_group', false, __('Section', 'codeclove-school-management'))
  const groupLabelPlural = getLabel('academic_group', true, __('Sections', 'codeclove-school-management'))
  const [unitId, setUnitId]                     = useState<string>('')
  const [groupId, setGroupId]                   = useState<string>('')
  const [studentSearch, setStudentSearch]       = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [selectedStudent, setSelectedStudent]   = useState<FullStudent | null>(null)
  const [showDropdown, setShowDropdown]         = useState(false)

  const { data: studentDetailsData } = useStudentDetails(selectedStudentId ?? 0)

  // Pre-fill query parameters if present
  useEffect(() => {
    if (studentIdParam) {
      setSelectedStudentId(Number(studentIdParam))
    }
    if (unitIdParam) {
      setUnitId(unitIdParam)
    }
  }, [studentIdParam, unitIdParam])

  // Resolve pre-filled student details
  useEffect(() => {
    if (studentDetailsData && selectedStudentId && !selectedStudent) {
      setSelectedStudent(studentDetailsData)
    }
  }, [studentDetailsData, selectedStudentId, selectedStudent])

  // ── Invoice fields (via react-hook-form) ────────────────────────────────────
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InvoiceHeaderFormValues>({
    resolver: zodResolver(invoiceHeaderSchema),
    defaultValues: {
      termId: '',
      issueDate: new Date().toISOString().split('T')[0] ?? '',
      dueDate: '',
      invoiceDiscount: '0',
      discountNote: '',
    },
  })

  const termId = watch('termId') || ''
  const issueDate = watch('issueDate') || ''
  const dueDate = watch('dueDate') || ''
  const invoiceDiscount = watch('invoiceDiscount') || '0'

  // ── Line items ──────────────────────────────────────────────────────────────
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { fee_type_id: null, description: '', fee_amount: '0', concession: '0' }
  ])

  // ── Data fetches ────────────────────────────────────────────────────────────
  const { data: unitsData }    = useUnits({ session_id: session?.id, per_page: 100 })
  const { data: groupsData }   = useGroups({ unit_id: unitId ? Number(unitId) : undefined, per_page: 100 })
  const { data: feeTypesData } = useFeeTypes({ status: 'active' })
  const { data: termsData }    = useTerms(session?.id ?? 0)
  const createInvoiceMutation  = useCreateInvoice()

  const units    = unitsData?.data || []
  const groups   = groupsData?.data || []
  const feeTypes = feeTypesData?.data || []
  const terms    = termsData || []

  // Show all students in selected class (per_page: 50) OR search across all (per_page: 10)
  const hasClassFilter = Boolean(unitId)
  const showAllInClass = hasClassFilter && studentSearch.length < 2

  const { data: studentsData } = useStudents({
    search:              showAllInClass ? undefined : (studentSearch.length >= 2 ? studentSearch : undefined),
    academic_session_id: session?.id,
    academic_unit_id:    unitId ? Number(unitId) : undefined,
    per_page:            showAllInClass ? 50 : 10,
  })
  const studentsList = (studentsData?.data || []) as FullStudent[]

  // Open dropdown when class is selected or search has text
  useEffect(() => {
    if (!selectedStudentId) {
      setShowDropdown(hasClassFilter || studentSearch.length >= 2)
    }
  }, [unitId, studentSearch, selectedStudentId, hasClassFilter])

  // Reset group filter when class changes
  useEffect(() => { setGroupId('') }, [unitId])

  // ── Fee amount auto-resolve (class rate lookup) ──────────────────────────────
  const [pendingResolve, setPendingResolve] = useState<{ feeTypeId: number; lineIdx: number } | null>(null)
  const { data: resolvedFeeData } = useResolveFeeAmount({
    fee_type_id: pendingResolve?.feeTypeId ?? 0,
    student_id: selectedStudentId ?? 0,
    session_id: session?.id ?? 0,
  })

  const applyResolvedAmount = useCallback(() => {
    if (!resolvedFeeData || !pendingResolve) return
    setLineItems(prev => {
      const next = [...prev]
      if (next[pendingResolve.lineIdx]) {
        next[pendingResolve.lineIdx] = {
          ...next[pendingResolve.lineIdx],
          fee_amount: (resolvedFeeData.amount_minor / 100).toString(),
        } as LineItem
      }
      return next
    })
    setPendingResolve(null)
  }, [resolvedFeeData, pendingResolve])

  if (resolvedFeeData && pendingResolve) applyResolvedAmount()

  // ── Totals ──────────────────────────────────────────────────────────────────
  const lineSubtotal = lineItems.reduce((sum, li) =>
    sum + parseFloat(li.fee_amount || '0') - parseFloat(li.concession || '0'), 0)
  const invoiceDiscountAmt = parseFloat(invoiceDiscount || '0')
  const netPayable = Math.max(0, lineSubtotal - invoiceDiscountAmt)

  // ── Line item handlers ──────────────────────────────────────────────────────
  const addLineItem = () =>
    setLineItems(prev => [...prev, { fee_type_id: null, description: '', fee_amount: '0', concession: '0' }])

  const removeLineItem = (i: number) =>
    setLineItems(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i))

  const updateLineItem = (i: number, field: keyof LineItem, value: string | number | null) => {
    setLineItems(prev => {
      const next = [...prev]
      const current = next[i]
      if (!current) return prev
      const item: LineItem = {
        fee_type_id: current.fee_type_id,
        description: current.description,
        fee_amount: current.fee_amount,
        concession: current.concession,
      }
      if (field === 'fee_type_id') {
        const ftId = value ? Number(value) : null
        item.fee_type_id = ftId
        if (ftId) {
          const ft = feeTypes.find(t => t.id === ftId)
          if (ft) {
            item.description = ft.name
            item.fee_amount  = (ft.default_amount_minor / 100).toString()
          }
          if (selectedStudentId && session?.id) {
            setPendingResolve({ feeTypeId: ftId, lineIdx: i })
          }
        }
      } else if (field === 'description') {
        item.description = String(value || '')
      } else if (field === 'fee_amount') {
        item.fee_amount = String(value || '')
      } else if (field === 'concession') {
        item.concession = String(value || '')
      }
      next[i] = item
      return next
    })
  }

  // ── Student selection helper ─────────────────────────────────────────────────
  const selectStudent = (s: FullStudent) => {
    setSelectedStudentId(s.id)
    setSelectedStudent(s)
    setStudentSearch('')
    setShowDropdown(false)
  }

  const clearStudent = () => {
    setSelectedStudentId(null)
    setSelectedStudent(null)
    setStudentSearch('')
    setShowDropdown(hasClassFilter)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const [duplicateWarning, setDuplicateWarning] = useState<{ existing_invoice_id: number; status: 'draft' | 'issued' } | null>(null)

  const handleFormSubmit = (status: 'draft' | 'issued', force = false) => {
    if (!selectedStudentId) {
      toast.error(sprintf(__('Please select a %s.', 'codeclove-school-management'), studentLabel.toLowerCase()))
      return
    }
    if (lineItems.some(li => !li.description.trim())) {
      toast.error(__('All fee rows must have a description.', 'codeclove-school-management'))
      return
    }

    handleSubmit(async (values) => {
      try {
        // Force flag is accepted by server to bypass duplicate invoice block
        const payload = {
          student_id:           selectedStudentId,
          academic_session_id:  session?.id,
          academic_term_id:     values.termId ? Number(values.termId) : undefined,
          issue_date:           values.issueDate,
          due_date:             values.dueDate || null,
          discount_minor:       Math.round(parseFloat(values.invoiceDiscount || '0') * 100),
          discount_note:        values.discountNote || null,
          line_items:           lineItems.map(li => ({
            fee_type_id:        li.fee_type_id,
            description:        li.description,
            quantity:           1,
            unit_amount_minor:  Math.round(parseFloat(li.fee_amount || '0') * 100),
            discount_minor:     Math.round(parseFloat(li.concession || '0') * 100),
          })),
          status,
          force,
        } as unknown as Partial<Invoice>

        const data = await createInvoiceMutation.mutateAsync(payload) as unknown as { warning?: string; existing_invoice_id: number; id?: number }

        if (data && 'warning' in data && data.warning === 'duplicate_invoice') {
          setDuplicateWarning({ existing_invoice_id: data.existing_invoice_id, status })
          toast.error(__('Duplicate invoice detected for this student, term, and fee type.', 'codeclove-school-management'))
          return
        }

        toast.success(
          sprintf(
            __('%1$s %2$s successfully!', 'codeclove-school-management'),
            invoiceLabel,
            status === 'draft' ? __('saved as draft', 'codeclove-school-management') : __('created', 'codeclove-school-management')
          )
        )
        navigate(`/finance/invoices/${data?.id ?? ''}`)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : ''
        toast.error(message || sprintf(__('Failed to create %s', 'codeclove-school-management'), invoiceLabel.toLowerCase()))
      }
    })()
  }

  const studentEnrollmentLabel = (s: FullStudent): string => {
    const parts: string[] = []
    if (s.enrollment) {
      const unitName  = units.find(u => u.id === s.enrollment!.academic_unit_id)?.name
      const groupName = groups.find(g => g.id === s.enrollment!.academic_group_id)?.name
      if (unitName)  parts.push(unitName)
      if (groupName) parts.push(groupName)
    }
    return parts.join(' · ')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={sprintf(__('Create %s', 'codeclove-school-management'), invoiceLabel)}
        description={__('Select a student, add fee line items, and issue the invoice.', 'codeclove-school-management')}
        onBack={() => navigate('/finance/invoices')}
        breadcrumbs={[
          { label: __('Finance', 'codeclove-school-management') },
          { label: __('Invoices', 'codeclove-school-management'), href: '/finance/invoices' },
          { label: sprintf(__('New %s', 'codeclove-school-management'), invoiceLabel) },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/finance/invoices')}
              disabled={createInvoiceMutation.isPending}
            >
              {__('Cancel', 'codeclove-school-management')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleFormSubmit('draft')}
              disabled={createInvoiceMutation.isPending}
            >
              {__('Save as Draft', 'codeclove-school-management')}
            </Button>
            <Button
              size="sm"
              onClick={() => handleFormSubmit('issued')}
              disabled={createInvoiceMutation.isPending}
            >
              {createInvoiceMutation.isPending ? __('Creating…', 'codeclove-school-management') : sprintf(__('Issue %s', 'codeclove-school-management'), invoiceLabel)}
            </Button>
          </div>
        }
      />

      {duplicateWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div>
            <p className="font-semibold">{__('Duplicate Invoice Warning', 'codeclove-school-management')}</p>
            <p>{__('An active invoice containing the same fee type(s) already exists for this student, term, and academic session. You can view the existing invoice or proceed to create another one.', 'codeclove-school-management')}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="border-amber-300 text-amber-900 hover:bg-amber-100"
              onClick={() => navigate(`/finance/invoices/${duplicateWarning.existing_invoice_id}`)}
            >
              {__('View Existing Invoice', 'codeclove-school-management')}
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                handleFormSubmit(duplicateWarning.status, true)
                setDuplicateWarning(null)
              }}
            >
              {__('Proceed Anyway', 'codeclove-school-management')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-800 hover:bg-amber-100"
              onClick={() => setDuplicateWarning(null)}
            >
              {__('Cancel', 'codeclove-school-management')}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main Form ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Student Picker ─────────────────────────────────────── */}
          <Card>
            <CardContent className="py-6 space-y-4">
              <p className="text-xs font-semibold text-text uppercase tracking-wider pb-2 border-b border-border">
                {__('Billing Details', 'codeclove-school-management')}
              </p>

              {/* Step 1 — Class / Section filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label={sprintf(__('Filter by %s', 'codeclove-school-management'), unitLabelSingular)} hint={__('Optional — narrows student list', 'codeclove-school-management')}>
                  <Select
                    value={unitId}
                    onValueChange={(val) => { setUnitId(val); setSelectedStudentId(null); setSelectedStudent(null) }}
                    options={[
                      { value: '', label: sprintf(__('— All %s —', 'codeclove-school-management'), unitLabelPlural.toLowerCase()) },
                      ...units.map(u => ({ value: String(u.id), label: u.name }))
                    ]}
                  />
                </FormField>

                <FormField label={sprintf(__('Filter by %s', 'codeclove-school-management'), groupLabelSingular)} hint={__('Optional', 'codeclove-school-management')}>
                  <Select
                    value={groupId}
                    onValueChange={(val) => { setGroupId(val); setSelectedStudentId(null); setSelectedStudent(null) }}
                    options={[
                      { value: '', label: sprintf(__('— All %s —', 'codeclove-school-management'), groupLabelPlural.toLowerCase()) },
                      ...groups.map(g => ({ value: String(g.id), label: g.name }))
                    ]}
                    disabled={!unitId || groups.length === 0}
                  />
                </FormField>
              </div>

              {/* Step 2 — Student search + list */}
              <FormField label={studentLabel} required>
                {selectedStudent ? (
                  /* ── Confirmed student card ── */
                  <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-brand/40 bg-brand/5">
                    <div className="space-y-1">
                      <div className="font-semibold text-text text-sm">
                        {selectedStudent.first_name} {selectedStudent.last_name}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
                        <span className="font-mono">{selectedStudent.student_number}</span>
                        {studentEnrollmentLabel(selectedStudent) && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {studentEnrollmentLabel(selectedStudent)}
                            </span>
                          </>
                        )}
                        {(() => {
                          const contact = selectedStudent.guardian || selectedStudent.father || selectedStudent.mother;
                          return contact?.phone ? (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {contact.phone}
                              </span>
                            </>
                          ) : null;
                        })()}
                      </div>
                      {(() => {
                        const contact = selectedStudent.guardian || selectedStudent.father || selectedStudent.mother;
                        const relationship = selectedStudent.relationship || __('Guardian', 'codeclove-school-management');
                        return contact ? (
                          <div className="text-xs text-text-muted">
                            {relationship}: <span className="text-text font-medium">
                              {contact.first_name} {contact.last_name}
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={clearStudent}
                      className="text-text-muted hover:text-danger transition-colors flex-shrink-0 mt-0.5"
                      title={__('Change student', 'codeclove-school-management')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  /* ── Search + dropdown ── */
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder={
                        hasClassFilter
                          ? __('Type to search, or pick from list below…', 'codeclove-school-management')
                          : __('Type student name or ID to search…', 'codeclove-school-management')
                      }
                      value={studentSearch}
                      onChange={(e) => {
                        setStudentSearch(e.target.value)
                        setShowDropdown(true)
                      }}
                      onFocus={() => setShowDropdown(hasClassFilter || studentSearch.length >= 2)}
                      autoFocus={!hasClassFilter}
                    />

                    {showDropdown && !selectedStudentId && (
                      <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto bg-bg-surface border border-border rounded-lg shadow-xl">
                        {studentsList.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-text-muted">
                            {studentSearch.length >= 2
                              ? sprintf(__('No students found for "%s"', 'codeclove-school-management'), studentSearch)
                              : __('No students found in this class.', 'codeclove-school-management')}
                          </div>
                        ) : (
                          studentsList.map(s => {
                            const enrollLabel = studentEnrollmentLabel(s)
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => selectStudent(s)}
                                className="w-full text-left cursor-pointer px-4 py-2.5 hover:bg-bg-base transition-colors border-b border-border/30 last:border-0"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-text text-xs">
                                    {s.first_name} {s.last_name}
                                  </span>
                                  <span className="text-text-muted font-mono text-2xs">{s.student_number}</span>
                                </div>
                                {enrollLabel && (
                                  <div className="text-2xs text-text-muted mt-0.5 flex items-center gap-1">
                                    <GraduationCap className="h-2.5 w-2.5" />
                                    {enrollLabel}
                                  </div>
                                )}
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </FormField>

              {/* Term + Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {terms.length > 0 && (
                  <FormField label={__('Academic Term', 'codeclove-school-management')} error={errors.termId?.message} hint={__('Optional', 'codeclove-school-management')}>
                    <Select
                      value={termId}
                      onValueChange={(val) => setValue('termId', val, { shouldDirty: true, shouldValidate: true })}
                      options={[
                        { value: '', label: __('— None —', 'codeclove-school-management') },
                        ...terms.map(t => ({ value: String(t.id), label: t.name }))
                      ]}
                    />
                  </FormField>
                )}
                <FormField label={__('Issue Date', 'codeclove-school-management')} required error={errors.issueDate?.message}>
                  <DatePicker
                    value={issueDate}
                    onChange={(val) => setValue('issueDate', val || '', { shouldDirty: true, shouldValidate: true })}
                  />
                </FormField>
                <FormField label={__('Due Date', 'codeclove-school-management')} error={errors.dueDate?.message} hint={__('Leave blank if no due date', 'codeclove-school-management')}>
                  <DatePicker
                    value={dueDate}
                    onChange={(val) => setValue('dueDate', val || '', { shouldDirty: true, shouldValidate: true })}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Fee Schedule ─────────────────────────────────────────── */}
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                <p className="text-xs font-semibold text-text uppercase tracking-wider">{__('Fee Schedule', 'codeclove-school-management')}</p>
                <Button type="button" variant="secondary" size="sm" onClick={addLineItem} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> {__('Add Fee', 'codeclove-school-management')}
                </Button>
              </div>

              <div className="space-y-3">
                {/* Header row */}
                <div className="hidden md:grid grid-cols-[2fr_3fr_2fr_2fr_auto] gap-2 px-1">
                  {[__('Fee Type', 'codeclove-school-management'), __('Description', 'codeclove-school-management'), sprintf(__('Amount (%s)', 'codeclove-school-management'), baseCurrency), __('Concession', 'codeclove-school-management'), ''].map((h, idx) => (
                    <span key={idx} className="text-2xs uppercase font-semibold text-text-muted">{h}</span>
                  ))}
                </div>

                {lineItems.map((li, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr_3fr_2fr_2fr_auto] gap-2 items-end border border-border/40 md:border-0 p-3 md:p-0 rounded-lg md:rounded-none bg-bg-base/20 md:bg-transparent">
                    {/* Fee Type */}
                    <div>
                      <label className="md:hidden text-2xs uppercase font-semibold text-text-muted block mb-1">{__('Fee Type', 'codeclove-school-management')}</label>
                      <Select
                        value={li.fee_type_id?.toString() || ''}
                        onValueChange={(val) => updateLineItem(index, 'fee_type_id', val)}
                        options={[
                          { value: '', label: __('— Custom —', 'codeclove-school-management') },
                          ...feeTypes.map(t => ({ value: t.id.toString(), label: t.name }))
                        ]}
                      />
                    </div>
                    {/* Description */}
                    <div>
                      <label className="md:hidden text-2xs uppercase font-semibold text-text-muted block mb-1">{__('Description', 'codeclove-school-management')}</label>
                      <Input
                        type="text"
                        placeholder={__('e.g. Term 2 Tuition', 'codeclove-school-management')}
                        value={li.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        required
                      />
                    </div>
                    {/* Amount */}
                    <div>
                      <label className="md:hidden text-2xs uppercase font-semibold text-text-muted block mb-1">{__('Amount', 'codeclove-school-management')}</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={li.fee_amount}
                        onChange={(e) => updateLineItem(index, 'fee_amount', e.target.value)}
                      />
                    </div>
                    {/* Concession */}
                    <div>
                      <label className="md:hidden text-2xs uppercase font-semibold text-text-muted block mb-1">{__('Concession', 'codeclove-school-management')}</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={li.concession}
                        onChange={(e) => updateLineItem(index, 'concession', e.target.value)}
                      />
                    </div>
                    {/* Remove */}
                    <Button
                      type="button"
                      variant="danger"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length === 1}
                      title={__('Remove row', 'codeclove-school-management')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Additional Concession ────────────────────────────────── */}
          <Card>
            <CardContent className="py-6 space-y-4">
              <p className="text-xs font-semibold text-text uppercase tracking-wider pb-2 border-b border-border">
                {__('Additional Concession', 'codeclove-school-management')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label={sprintf(__('Concession Amount (%s)', 'codeclove-school-management'), baseCurrency)} error={errors.invoiceDiscount?.message}>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register('invoiceDiscount')}
                  />
                </FormField>
                <FormField label={__('Reason', 'codeclove-school-management')} error={errors.discountNote?.message} hint={__('e.g. Sibling discount, Merit scholarship', 'codeclove-school-management')}>
                  <Input
                    type="text"
                    placeholder={__('Concession reason…', 'codeclove-school-management')}
                    {...register('discountNote')}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar — Invoice Summary ──────────────────────────── */}
        <div className="space-y-5">
          <Card className="sticky top-4">
            <CardContent className="py-6 space-y-4">
              <p className="text-xs font-semibold text-text uppercase tracking-wider pb-2 border-b border-border">
                {__('Invoice Summary', 'codeclove-school-management')}
              </p>

              <div className="space-y-2.5 text-sm">
                {lineItems.map((li, i) => {
                  const net = parseFloat(li.fee_amount || '0') - parseFloat(li.concession || '0')
                  if (!li.description && net === 0) return null
                  return (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-text-muted truncate max-w-[60%]">{li.description || sprintf(__('Item %d', 'codeclove-school-management'), i + 1)}</span>
                      <span className="text-text font-medium">{formatCurrency(Math.round(net * 100))}</span>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-border pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-text-muted">
                  <span>{__('Fee Subtotal', 'codeclove-school-management')}</span>
                  <span className="font-medium text-text">{formatCurrency(Math.round(lineSubtotal * 100))}</span>
                </div>
                {invoiceDiscountAmt > 0 && (
                  <div className="flex justify-between text-success">
                    <span>{__('Concession', 'codeclove-school-management')}</span>
                    <span className="font-medium">− {formatCurrency(Math.round(invoiceDiscountAmt * 100))}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-text border-t border-border pt-2">
                  <span>{__('Net Payable', 'codeclove-school-management')}</span>
                  <span className="text-brand">{formatCurrency(Math.round(netPayable * 100))}</span>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <Button
                  className="w-full"
                  onClick={() => handleFormSubmit('issued')}
                  disabled={createInvoiceMutation.isPending}
                >
                  {createInvoiceMutation.isPending ? __('Creating…', 'codeclove-school-management') : sprintf(__('Issue %s', 'codeclove-school-management'), invoiceLabel)}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleFormSubmit('draft')}
                  disabled={createInvoiceMutation.isPending}
                >
                  {__('Save as Draft', 'codeclove-school-management')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
