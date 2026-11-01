/**
 * ExamFormPage — Streamlined form for creating and editing an Examination.
 *
 * Implements:
 *   - Auto-scoped Academic Session from global header context.
 *   - Focused 8:4 column layout: Basic details in main column, Status & Grading in sidebar.
 *   - Clean full-width FormActionFooter for accessible submission.
 *   - Country-preset aware grading scale selector.
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Calendar,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import {
  useExam,
  useCreateExam,
  useUpdateExam,
  useGradingScales,
  type CreateExamPayload,
  type UpdateExamPayload,
  type ExamStatus,
} from '@/api/exams'
import { useSessions, useTerms } from '@/api/academics'
import { useSettings } from '@/api/settings'
import { useSession } from '@/lib/session-context'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { ROUTES } from '@/lib/constants'
import { __, sprintf } from '@/lib/i18n'
import {
  PageHeader,
  Card,
  Badge,
  FormField,
  Input,
  Select,
  DatePicker,
  Textarea,
  Button,
  Skeleton,
  Alert,
  Checkbox,
} from '@/components/ui'
export default function ExamFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const examId = isEdit ? Number(id) : 0
  const navigate = useNavigate()
  const toast = useToast()
  const { getLabel } = useLabels()
  const { session } = useSession()
  const { data: settings } = useSettings()

  const termLabel = getLabel('academic_term', false, __('Academic Term', 'codeclove-school-management'))
  const sessionLabel = getLabel('academic_session', false, __('Academic Year', 'codeclove-school-management'))

  // Active country preset: 'IN', 'US', 'GB'
  const activePreset = (settings?.education_system?.preset || 'IN').toUpperCase()

  // ─── Query Existing Data if Editing ─────────────────────────────────────────
  const { data: existingExam, isLoading: isLoadingExisting } = useExam(examId)

  // ─── Query Sessions for Name Resolution ─────────────────────────────────────
  const { data: sessionsResponse } = useSessions({ per_page: 50 })
  const sessions = useMemo(() => sessionsResponse?.data ?? [], [sessionsResponse])

  // Resolve active session context
  const resolvedSession = useMemo(() => {
    if (isEdit && existingExam) {
      return (
        sessions.find((s) => s.id === existingExam.academic_session_id) || {
          id: existingExam.academic_session_id,
          name: existingExam.academic_session_name || String(existingExam.academic_session_id),
        }
      )
    }
    if (session) {
      return (
        sessions.find((s) => s.id === session.id) || {
          id: session.id,
          name: session.label,
        }
      )
    }
    const active = sessions.find((s) => s.status === 'active') || sessions[0]
    return active || null
  }, [isEdit, existingExam, session, sessions])

  const targetSessionId = resolvedSession?.id ?? 0

  // Dynamic Terms based on resolved session
  const { data: terms = [] } = useTerms(targetSessionId)

  // ─── Queries for Grading Scales ─────────────────────────────────────────────
  const { data: gradingScales = [] } = useGradingScales()

  // Country Preset-Aware Grading Scales Filtering
  const presetFilteredScales = useMemo(() => {
    return gradingScales.filter((gs) => {
      const p = (gs.preset || '').toUpperCase()
      if (!p || p === 'UNIVERSAL' || p === activePreset) return true
      const code = (gs.code || '').toLowerCase()
      if (activePreset === 'IN' && (code.startsWith('cbse') || code.startsWith('icse'))) return true
      if (activePreset === 'US' && code.startsWith('us_')) return true
      if (activePreset === 'GB' && (code.startsWith('uk_') || code.startsWith('gcse'))) return true
      return code === 'pass_fail'
    })
  }, [gradingScales, activePreset])

  const finalScales = useMemo(() => {
    const list = [...presetFilteredScales]
    if (isEdit && existingExam?.grading_scale_id) {
      const existing = gradingScales.find((gs) => gs.id === existingExam.grading_scale_id)
      if (existing && !list.some((s) => s.id === existing.id)) {
        list.unshift(existing)
      }
    }
    return list
  }, [presetFilteredScales, isEdit, existingExam, gradingScales])

  // ─── Form State ─────────────────────────────────────────────────────────────
  const [examName, setExamName] = useState(() => existingExam?.name || '')
  const [examCode, setExamCode] = useState(() => existingExam?.code || '')
  const [termId, setTermId] = useState(() => (existingExam?.academic_term_id ? String(existingExam.academic_term_id) : ''))
  const [startsOn, setStartsOn] = useState(() => existingExam?.starts_on || '')
  const [endsOn, setEndsOn] = useState(() => existingExam?.ends_on || '')
  const [description, setDescription] = useState(() => existingExam?.description || '')
  const [gradingScaleId, setGradingScaleId] = useState(() => (existingExam?.grading_scale_id ? String(existingExam.grading_scale_id) : ''))
  const [status, setStatus] = useState<ExamStatus>(() => existingExam?.status || 'draft')
  const [signatoryTitle, setSignatoryTitle] = useState(() => existingExam?.admit_card_config?.signatory_title || existingExam?.report_card_config?.signatory_1_title || 'Controller of Examinations')
  const [allowPortalAdmitCards, setAllowPortalAdmitCards] = useState(() => Boolean(existingExam?.admit_card_config?.allow_portal_download))
  const [publishResults, setPublishResults] = useState(() => Boolean(existingExam?.report_card_config?.publish_results))

  // Report Card Defaults State
  const [rcConfig, setRcConfig] = useState(() => ({
    show_rank: existingExam?.report_card_config?.show_rank ?? true,
    show_percentage: existingExam?.report_card_config?.show_percentage ?? true,
    show_grade: existingExam?.report_card_config?.show_grade ?? true,
    show_gpa: existingExam?.report_card_config?.show_gpa ?? true,
    show_pass_marks: existingExam?.report_card_config?.show_pass_marks ?? true,
    show_grading_scale: existingExam?.report_card_config?.show_grading_scale ?? true,
    show_student_photo: existingExam?.report_card_config?.show_student_photo ?? true,
    show_attendance: existingExam?.report_card_config?.show_attendance ?? true,
    show_teacher_remarks: existingExam?.report_card_config?.show_teacher_remarks ?? existingExam?.report_card_config?.show_remarks ?? true,
    show_principal_remarks: existingExam?.report_card_config?.show_principal_remarks ?? existingExam?.report_card_config?.show_remarks ?? true,
    show_teacher_signature: existingExam?.report_card_config?.show_teacher_signature ?? existingExam?.report_card_config?.show_signatures ?? true,
    show_principal_signature: existingExam?.report_card_config?.show_principal_signature ?? existingExam?.report_card_config?.show_signatures ?? true,
    show_parent_signature: existingExam?.report_card_config?.show_parent_signature ?? existingExam?.report_card_config?.show_signatures ?? true,
  }))
  const toggleRc = (k: keyof typeof rcConfig) => setRcConfig((prev) => ({ ...prev, [k]: !prev[k] }))
  const selectedScale = useMemo(() => {
    return finalScales.find((gs) => String(gs.id) === gradingScaleId) || null
  }, [finalScales, gradingScaleId])

  const minPassTier = useMemo(() => {
    const passTiers = selectedScale?.tiers?.filter((t) => t.is_pass) ?? []
    return passTiers.reduce<typeof passTiers[0] | null>(
      (lowest, t) => (!lowest || t.min < lowest.min ? t : lowest),
      null
    )
  }, [selectedScale])

  const maxGp = useMemo(() => {
    if (!selectedScale?.tiers || selectedScale.tiers.length === 0) return 0
    return Math.max(...selectedScale.tiers.map((t) => t.gp || 0))
  }, [selectedScale])

  // Check if the user actively modified the grading scale from its initial value
  const isScaleChanged = useMemo(() => {
    if (!isEdit || !existingExam?.grading_scale_id) return false
    return String(existingExam.grading_scale_id) !== gradingScaleId
  }, [isEdit, existingExam, gradingScaleId])

  // Academic Session calendar boundary clamping
  const sessionMinDate = useMemo(() => {
    if (resolvedSession && 'start_date' in resolvedSession && resolvedSession.start_date) {
      return new Date(resolvedSession.start_date + 'T00:00:00')
    }
    return undefined
  }, [resolvedSession])

  const sessionMaxDate = useMemo(() => {
    if (resolvedSession && 'end_date' in resolvedSession && resolvedSession.end_date) {
      return new Date(resolvedSession.end_date + 'T23:59:59')
    }
    return undefined
  }, [resolvedSession])

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const clearError = (field: string) => {
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  // Clear academic_session_id error once an active session context is resolved
  useEffect(() => {
    if (resolvedSession && formErrors.academic_session_id) {
      clearError('academic_session_id')
    }
  }, [resolvedSession, formErrors.academic_session_id])

  // Default Grading Scale Auto-Selection
  useEffect(() => {
    if (!gradingScaleId && finalScales.length > 0 && !isEdit) {
      const defaultScale = finalScales.find((gs) => gs.is_default) || finalScales[0]
      if (defaultScale) {
        setGradingScaleId(String(defaultScale.id))
      }
    }
  }, [finalScales, gradingScaleId, isEdit])

  // Populate Existing Data if Editing
  useEffect(() => {
    if (isEdit && existingExam) {
      setExamName(existingExam.name || '')
      setExamCode(existingExam.code || '')
      setTermId(existingExam.academic_term_id ? String(existingExam.academic_term_id) : '')
      setStartsOn(existingExam.starts_on || '')
      setEndsOn(existingExam.ends_on || '')
      setDescription(existingExam.description || '')
      if (existingExam.grading_scale_id) {
        setGradingScaleId(String(existingExam.grading_scale_id))
      }
      setStatus(existingExam.status || 'draft')
      setSignatoryTitle(existingExam.admit_card_config?.signatory_title || existingExam.report_card_config?.signatory_1_title || 'Controller of Examinations')
      setAllowPortalAdmitCards(Boolean(existingExam.admit_card_config?.allow_portal_download))
      setPublishResults(Boolean(existingExam.report_card_config?.publish_results))
      if (existingExam.report_card_config) {
        const rc = existingExam.report_card_config
        setRcConfig({
          show_rank: rc.show_rank ?? true,
          show_percentage: rc.show_percentage ?? true,
          show_grade: rc.show_grade ?? true,
          show_gpa: rc.show_gpa ?? true,
          show_pass_marks: rc.show_pass_marks ?? true,
          show_grading_scale: rc.show_grading_scale ?? true,
          show_student_photo: rc.show_student_photo ?? true,
          show_attendance: rc.show_attendance ?? true,
          show_teacher_remarks: rc.show_teacher_remarks ?? rc.show_remarks ?? true,
          show_principal_remarks: rc.show_principal_remarks ?? rc.show_remarks ?? true,
          show_teacher_signature: rc.show_teacher_signature ?? rc.show_signatures ?? true,
          show_principal_signature: rc.show_principal_signature ?? rc.show_signatures ?? true,
          show_parent_signature: rc.show_parent_signature ?? rc.show_signatures ?? true,
        })
      }
    }
  }, [isEdit, existingExam])

  // ─── Dropdown Options ───────────────────────────────────────────────────────
  const termOptions = useMemo(
    () => [
      { value: '', label: __('Full Academic Year / No Specific Term', 'codeclove-school-management') },
      ...terms.map((t) => ({
        value: String(t.id),
        label: t.name,
      })),
    ],
    [terms]
  )

  const gradingScaleOptions = useMemo(
    () =>
      finalScales.map((gs) => ({
        value: String(gs.id),
        label: gs.is_default ? `${gs.name} (${__('Default', 'codeclove-school-management')})` : gs.name,
        description: gs.description || undefined,
      })),
    [finalScales]
  )

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createExamMutation = useCreateExam()
  const updateExamMutation = useUpdateExam()
  const isSaving = createExamMutation.isPending || updateExamMutation.isPending

  // ─── Submission Handler ────────────────────────────────────────────────────
  const handleSubmit = (actionTarget: 'timetable' | 'list' = 'timetable') => {
    const errors: Record<string, string> = {}

    if (!examName.trim()) {
      errors.name = __('Examination name is required.', 'codeclove-school-management')
    }

    if (!targetSessionId || targetSessionId <= 0) {
      errors.academic_session_id = __('No active academic session found. Please configure a session in the top header.', 'codeclove-school-management')
    }

    if (!startsOn) {
      errors.starts_on = __('Start date is required.', 'codeclove-school-management')
    }

    if (!endsOn) {
      errors.ends_on = __('End date is required.', 'codeclove-school-management')
    } else if (startsOn && endsOn < startsOn) {
      errors.ends_on = __('End date must be on or after start date.', 'codeclove-school-management')
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})

    if (isEdit) {
      const updatePayload: UpdateExamPayload = {
        name: examName.trim(),
        code: examCode.trim() || null,
        exam_type: 'standard',
        status,
        academic_term_id: termId ? Number(termId) : null,
        grading_scale_id: gradingScaleId ? Number(gradingScaleId) : null,
        starts_on: startsOn,
        ends_on: endsOn,
        weight_percentage: 100,
        report_card_config: {
          ...(existingExam?.report_card_config || {}),
          ...rcConfig,
          publish_results: publishResults,
          signatory_1_title: signatoryTitle.trim() || existingExam?.report_card_config?.signatory_1_title || 'Controller of Examinations',
        },
        admit_card_config: {
          ...(existingExam?.admit_card_config || {}),
          allow_portal_download: allowPortalAdmitCards,
          signatory_title: signatoryTitle.trim() || existingExam?.admit_card_config?.signatory_title || 'Controller of Examinations',
        },
        description: description.trim() || null,
      }

      updateExamMutation.mutate(
        { id: examId, data: updatePayload },
        {
          onSuccess: (updatedExam) => {
            toast.success(
              sprintf(
                __('Examination "%s" updated.', 'codeclove-school-management'),
                updatedExam.name
              )
            )
            navigate(`/exams/${updatedExam.id}`)
          },
          onError: (err) => {
            toast.error(err.message || __('Failed to update examination.', 'codeclove-school-management'))
          },
        }
      )
    } else {
      const createPayload: CreateExamPayload = {
        academic_session_id: targetSessionId,
        academic_term_id: termId ? Number(termId) : null,
        grading_scale_id: gradingScaleId ? Number(gradingScaleId) : null,
        name: examName.trim(),
        code: examCode.trim() || null,
        exam_type: 'standard',
        status,
        starts_on: startsOn,
        ends_on: endsOn,
        weight_percentage: 100,
        report_card_config: {
          ...rcConfig,
          publish_results: publishResults,
          signatory_1_title: signatoryTitle.trim() || 'Controller of Examinations',
        },
        admit_card_config: {
          allow_portal_download: allowPortalAdmitCards,
          signatory_title: signatoryTitle.trim() || 'Controller of Examinations',
        },
        description: description.trim() || null,
      }

      createExamMutation.mutate(createPayload, {
        onSuccess: (newExam) => {
          toast.success(
            sprintf(
              __('Examination "%s" created successfully.', 'codeclove-school-management'),
              newExam.name
            )
          )
          if (actionTarget === 'timetable') {
            navigate(`/exams/${newExam.id}/timetable`)
          } else {
            navigate(`/exams/${newExam.id}`)
          }
        },
        onError: (err) => {
          toast.error(err.message || __('Failed to create examination.', 'codeclove-school-management'))
        },
      })
    }
  }

  if (isEdit && isLoadingExisting) {
    return (
      <div className="space-y-6 w-full">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8">
            <Card className="p-6 space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </Card>
          </div>
          <div className="lg:col-span-4">
            <Card className="p-6 space-y-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        title={isEdit ? __('Edit Examination', 'codeclove-school-management') : __('Create Examination', 'codeclove-school-management')}
        description={
          isEdit
            ? sprintf(__('Updating examination details for %s.', 'codeclove-school-management'), existingExam?.name || '')
            : __('Set up examination title, schedule window, and grading scale.', 'codeclove-school-management')
        }
        onBack={() => navigate(isEdit ? `/exams/${examId}` : ROUTES.EXAMS)}
        breadcrumbs={
          isEdit
            ? [
                { label: __('Examinations', 'codeclove-school-management'), href: ROUTES.EXAMS },
                { label: existingExam?.name || __('Examination', 'codeclove-school-management'), href: `/exams/${examId}` },
                { label: __('Edit', 'codeclove-school-management') },
              ]
            : [
                { label: __('Examinations', 'codeclove-school-management'), href: ROUTES.EXAMS },
                { label: __('New Examination', 'codeclove-school-management') },
              ]
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate(isEdit ? `/exams/${examId}` : ROUTES.EXAMS)}
              disabled={isSaving}
              className="h-8 px-3.5 text-xs font-medium"
            >
              {__('Cancel', 'codeclove-school-management')}
            </Button>

            {!isEdit && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleSubmit('list')}
                disabled={isSaving}
                className="h-8 px-3.5 text-xs font-medium"
              >
                {__('Save as Draft', 'codeclove-school-management')}
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => handleSubmit('timetable')}
              disabled={isSaving}
              className="h-8 px-4 text-xs font-semibold gap-1.5 shadow-xs"
            >
              <span>
                {isEdit
                  ? __('Save Changes', 'codeclove-school-management')
                  : __('Save & Set Schedule', 'codeclove-school-management')}
              </span>
              {!isEdit && <ArrowRight size={14} />}
            </Button>
          </div>
        }
      />

      {/* ─── Session Warning if Missing ────────────────────────────────────── */}
      {(!resolvedSession || formErrors.academic_session_id) && (
        <Alert
          variant="warning"
          title={__('Active Academic Session Required', 'codeclove-school-management')}
        >
          {formErrors.academic_session_id ||
            __(
              'An active academic session is required before creating an examination. Please select or activate an academic session in the top header switcher.',
              'codeclove-school-management'
            )}
        </Alert>
      )}

      {/* ─── Main Form Container ───────────────────────────────────────────── */}
      <form
        id="exam-form"
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit('timetable')
        }}
        className="space-y-6 w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ─── Left Column (8 cols): Primary Details & Schedule ───────────── */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border border-border bg-bg-elevated shadow-xs rounded-xl p-6 space-y-5">
              {/* Session Indicator */}
              {resolvedSession && (
                <div className="flex items-center justify-between gap-2 text-xs pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-brand flex-shrink-0" />
                    <span className="font-semibold text-text">
                      {resolvedSession.name.toLowerCase().includes('academic') || resolvedSession.name.toLowerCase().includes('session')
                        ? resolvedSession.name
                        : `${sessionLabel}: ${resolvedSession.name}`}
                    </span>
                  </div>
                  {'is_current' in resolvedSession && Boolean(resolvedSession.is_current) && (
                    <Badge variant="success" size="sm" dot>
                      {__('Current Session', 'codeclove-school-management')}
                    </Badge>
                  )}
                </div>
              )}

              {/* Row 1: Examination Name & Short Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <FormField
                    label={__('Exam Name', 'codeclove-school-management')}
                    required
                    error={formErrors.name}
                  >
                    <Input
                      value={examName}
                      onChange={(e) => {
                        setExamName(e.target.value)
                        clearError('name')
                      }}
                      placeholder={__('e.g. Midterm Examination 2026', 'codeclove-school-management')}
                      disabled={isSaving}
                      autoFocus={!isEdit}
                    />
                  </FormField>
                </div>

                <div className="sm:col-span-1">
                  <FormField label={__('Exam Code (Optional)', 'codeclove-school-management')}>
                    <Input
                      value={examCode}
                      onChange={(e) => setExamCode(e.target.value)}
                      placeholder={__('e.g. MID-26', 'codeclove-school-management')}
                      disabled={isSaving}
                      className="font-mono uppercase"
                    />
                  </FormField>
                </div>
              </div>

              {/* Row 2: Term */}
              <div>
                <FormField label={termLabel} error={formErrors.academic_term_id}>
                  <Select
                    value={termId}
                    onValueChange={(val) => {
                      setTermId(val)
                      clearError('academic_term_id')
                    }}
                    options={termOptions}
                    disabled={isSaving}
                    placeholder={sprintf(
                      __('Select %s (e.g. Term 1, Midterm)...', 'codeclove-school-management'),
                      termLabel.toLowerCase()
                    )}
                  />
                </FormField>
              </div>

              {/* Row 3: Start Date & End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label={__('Start Date', 'codeclove-school-management')}
                  required
                  error={formErrors.starts_on}
                >
                  <DatePicker
                    value={startsOn}
                    onChange={(val) => {
                      setStartsOn(val)
                      clearError('starts_on')
                      if (val && (!endsOn || endsOn < val)) {
                        setEndsOn(val)
                        clearError('ends_on')
                      }
                    }}
                    minDate={sessionMinDate}
                    maxDate={sessionMaxDate}
                    placeholder={__('Pick exam start date...', 'codeclove-school-management')}
                    disabled={isSaving}
                    error={!!formErrors.starts_on}
                    clearable={false}
                  />
                </FormField>

                <FormField
                  label={__('End Date', 'codeclove-school-management')}
                  required
                  error={formErrors.ends_on}
                >
                  <DatePicker
                    value={endsOn}
                    onChange={(val) => {
                      setEndsOn(val)
                      clearError('ends_on')
                    }}
                    minDate={startsOn ? new Date(startsOn + 'T00:00:00') : sessionMinDate}
                    maxDate={sessionMaxDate}
                    placeholder={__('Pick exam end date...', 'codeclove-school-management')}
                    disabled={isSaving}
                    error={!!formErrors.ends_on}
                    clearable={false}
                  />
                </FormField>
              </div>

              {/* Row 4: Authorized Signatory & Internal Notes */}
              <div className="space-y-4 pt-1 border-t border-border">
                <FormField
                  label={__('Authorized Signatory Title (Optional)', 'codeclove-school-management')}
                  hint={__('Default official title printed on candidate admit cards and official report cards.', 'codeclove-school-management')}
                >
                  <Input
                    value={signatoryTitle}
                    onChange={(e) => setSignatoryTitle(e.target.value)}
                    placeholder={__('Controller of Examinations', 'codeclove-school-management')}
                    disabled={isSaving}
                  />
                </FormField>

                <FormField
                  label={__('Internal Notes (Staff Only)', 'codeclove-school-management')}
                  hint={__('Administrative guidelines or syllabus scope. These are strictly internal and hidden from students and guardians.', 'codeclove-school-management')}
                >
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={__('Optional internal notes, teacher guidelines, or syllabus scope...', 'codeclove-school-management')}
                    rows={3}
                    disabled={isSaving}
                  />
                </FormField>
              </div>
            </Card>

            {/* Card 2: Report Card Default Layout (Wide Balanced 2-Column Grid) */}
            <Card className="border border-border bg-bg-elevated shadow-xs rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="text-sm font-semibold text-text">
                  {__('Report Card Defaults', 'codeclove-school-management')}
                </h3>
                <span className="text-3xs text-text-subtle font-mono">
                  {__('Layout & Endorsements', 'codeclove-school-management')}
                </span>
              </div>

              <p className="text-2xs text-text-muted leading-relaxed">
                {__('Configure which columns, observations, and signature lines are included by default on report cards for this exam.', 'codeclove-school-management')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
                {/* Left Inner Column: Scores & Assessment */}
                <div className="space-y-3">
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block pb-1 border-b border-border/60">
                    {__('Scores & Assessment', 'codeclove-school-management')}
                  </span>
                  <div className="space-y-2.5">
                    <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                      <Checkbox checked={rcConfig.show_rank} onChange={() => toggleRc('show_rank')} disabled={isSaving} />
                      <span>{__('Class Rank', 'codeclove-school-management')}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                      <Checkbox checked={rcConfig.show_percentage} onChange={() => toggleRc('show_percentage')} disabled={isSaving} />
                      <span>{__('Percentage Column', 'codeclove-school-management')}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                      <Checkbox checked={rcConfig.show_grade} onChange={() => toggleRc('show_grade')} disabled={isSaving} />
                      <span>{__('Grade Column', 'codeclove-school-management')}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                      <Checkbox checked={rcConfig.show_gpa} onChange={() => toggleRc('show_gpa')} disabled={isSaving} />
                      <span>{__('Cumulative GPA', 'codeclove-school-management')}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                      <Checkbox checked={rcConfig.show_pass_marks} onChange={() => toggleRc('show_pass_marks')} disabled={isSaving} />
                      <span>{__('Pass Marks Column', 'codeclove-school-management')}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                      <Checkbox checked={rcConfig.show_grading_scale} onChange={() => toggleRc('show_grading_scale')} disabled={isSaving} />
                      <span>{__('Grading Scale Key', 'codeclove-school-management')}</span>
                    </label>
                  </div>
                </div>

                {/* Right Inner Column: Profile, Remarks, Signatures */}
                <div className="space-y-4">
                  {/* Student Profile */}
                  <div className="space-y-2">
                    <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block pb-1 border-b border-border/60">
                      {__('Student Profile', 'codeclove-school-management')}
                    </span>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                        <Checkbox checked={rcConfig.show_student_photo} onChange={() => toggleRc('show_student_photo')} disabled={isSaving} />
                        <span>{__('Student Passport Photo', 'codeclove-school-management')}</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                        <Checkbox checked={rcConfig.show_attendance} onChange={() => toggleRc('show_attendance')} disabled={isSaving} />
                        <span>{__('Attendance Record', 'codeclove-school-management')}</span>
                      </label>
                    </div>
                  </div>

                  {/* Remarks & Observations */}
                  <div className="space-y-2">
                    <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block pb-1 border-b border-border/60">
                      {__('Remarks & Observations', 'codeclove-school-management')}
                    </span>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                        <Checkbox checked={rcConfig.show_teacher_remarks} onChange={() => toggleRc('show_teacher_remarks')} disabled={isSaving} />
                        <span>{__('Class Teacher Observations', 'codeclove-school-management')}</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                        <Checkbox checked={rcConfig.show_principal_remarks} onChange={() => toggleRc('show_principal_remarks')} disabled={isSaving} />
                        <span>{__('Principal Remarks', 'codeclove-school-management')}</span>
                      </label>
                    </div>
                  </div>

                  {/* Official Signatures */}
                  <div className="space-y-2">
                    <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block pb-1 border-b border-border/60">
                      {__('Signatures & Acknowledgement', 'codeclove-school-management')}
                    </span>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                        <Checkbox checked={rcConfig.show_teacher_signature} onChange={() => toggleRc('show_teacher_signature')} disabled={isSaving} />
                        <span>{__('Class Teacher Signature', 'codeclove-school-management')}</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                        <Checkbox checked={rcConfig.show_principal_signature} onChange={() => toggleRc('show_principal_signature')} disabled={isSaving} />
                        <span>{__('Principal / Headmaster Signature', 'codeclove-school-management')}</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none">
                        <Checkbox checked={rcConfig.show_parent_signature} onChange={() => toggleRc('show_parent_signature')} disabled={isSaving} />
                        <span>{__('Parent / Guardian Acknowledgement', 'codeclove-school-management')}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* ─── Right Column (4 cols): Status & Grading Policy ────────────── */}
          <div className="lg:col-span-4 space-y-6">
            {/* Card 1: Status & Publication */}
            <Card className="border border-border bg-bg-elevated shadow-xs rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-text pb-2 border-b border-border">
                {__('Status & Publication', 'codeclove-school-management')}
              </h3>

              <div className="space-y-3">
                <FormField label={__('Status', 'codeclove-school-management')}>
                  <Select
                    value={status}
                    onValueChange={(val) => setStatus(val as ExamStatus)}
                    options={[
                      { value: 'draft', label: __('Draft (Staff only)', 'codeclove-school-management') },
                      { value: 'published', label: __('Published (Visible to all)', 'codeclove-school-management') },
                    ]}
                    disabled={isSaving}
                  />
                </FormField>

                {status === 'published' ? (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{__('Exam is Live on Student Portal', 'codeclove-school-management')}</span>
                    </div>
                    <p className="text-2xs text-text-muted leading-relaxed">
                      {__('Enrolled students and guardians can view their scheduled examination dates and rooms.', 'codeclove-school-management')}
                    </p>

                    <div className="space-y-3 pt-2 border-t border-border">
                      <span className="text-3xs font-bold uppercase tracking-wider text-text-subtle block">
                        {__('Portal Permissions', 'codeclove-school-management')}
                      </span>

                      <div className="space-y-2.5">
                        <label className="flex items-start gap-2.5 text-xs font-medium text-text cursor-pointer select-none">
                          <Checkbox
                            checked={allowPortalAdmitCards}
                            onChange={(e) => setAllowPortalAdmitCards(e.target.checked)}
                            disabled={isSaving}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="font-semibold block">{__('Allow Admit Card Download', 'codeclove-school-management')}</span>
                            <span className="text-3xs text-text-muted font-normal block leading-tight">
                              {__('Release official hall ticket to students.', 'codeclove-school-management')}
                            </span>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 text-xs font-medium text-text cursor-pointer select-none">
                          <Checkbox
                            checked={publishResults}
                            onChange={(e) => setPublishResults(e.target.checked)}
                            disabled={isSaving}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="font-semibold block">{__('Publish Results & Report Cards', 'codeclove-school-management')}</span>
                            <span className="text-3xs text-text-muted font-normal block leading-tight">
                              {__('Release final marks and report cards.', 'codeclove-school-management')}
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-2xs text-text-muted leading-relaxed pt-1 border-t border-border">
                    {__('Draft examinations are strictly internal. Timetable, admit cards, and report cards remain completely hidden from students and parents until published.', 'codeclove-school-management')}
                  </p>
                )}
              </div>
            </Card>

            {/* Card 2: Grading Scale & Policy */}
            <Card className="border border-border bg-bg-elevated shadow-xs rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="text-sm font-semibold text-text">
                  {__('Grading Policy', 'codeclove-school-management')}
                </h3>
                <Link
                  to={ROUTES.EXAM_GRADING}
                  target="_blank"
                  className="text-text-subtle hover:text-brand inline-flex items-center gap-1 font-medium transition-colors text-2xs"
                >
                  <ExternalLink size={11} />
                  <span>{__('Manage Scales', 'codeclove-school-management')}</span>
                </Link>
              </div>

              <div className="space-y-3">
                <FormField label={__('Grading Scale', 'codeclove-school-management')}>
                  <Select
                    value={gradingScaleId}
                    onValueChange={setGradingScaleId}
                    options={gradingScaleOptions}
                    disabled={isSaving}
                  />
                </FormField>

                {selectedScale ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>
                        {__('Pass:', 'codeclove-school-management')}{' '}
                        <strong className="text-text font-semibold">
                          ≥ {minPassTier?.min}% ({minPassTier?.label})
                        </strong>
                      </span>
                      <span className="text-text-subtle">·</span>
                      <span className="text-text-subtle">
                        {sprintf(__('%d Tiers', 'codeclove-school-management'), selectedScale.tiers.length)}
                      </span>
                      {maxGp > 0 && (
                        <>
                          <span className="text-text-subtle">·</span>
                          <span className="text-text-subtle">
                            {sprintf(__('GPA %s', 'codeclove-school-management'), maxGp.toFixed(1))}
                          </span>
                        </>
                      )}
                    </div>

                    {isScaleChanged && (existingExam?.subjects_count ?? 0) > 0 && (
                      <div className="rounded-lg bg-warning-dim border border-warning-border p-2.5 text-2xs text-warning leading-relaxed flex items-start gap-1.5">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5 text-warning" />
                        <span>
                          {sprintf(
                            __('%d subject papers are already scheduled. Changing the scale will recalculate letter grades and GPA across report cards upon save.', 'codeclove-school-management'),
                            existingExam?.subjects_count ?? 0
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border border-dashed p-3 text-center text-xs text-text-muted space-y-1">
                    <p>{__('No grading scale selected.', 'codeclove-school-management')}</p>
                    <Link
                      to={ROUTES.EXAM_GRADING}
                      target="_blank"
                      className="text-brand hover:underline inline-flex items-center gap-1 font-medium text-xs"
                    >
                      <ExternalLink size={12} />
                      <span>{__('Configure Institutional Scales', 'codeclove-school-management')}</span>
                    </Link>
                  </div>
                )}

                <p className="text-2xs text-text-muted leading-relaxed">
                  {__('Determines score percentage thresholds, letter grades, and GPA on broadsheets.', 'codeclove-school-management')}
                </p>
              </div>
            </Card>
          </div>
        </div>

      </form>
    </div>
  )
}
