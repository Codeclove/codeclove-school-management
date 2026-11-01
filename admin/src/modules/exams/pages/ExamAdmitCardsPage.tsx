/**
 * ExamAdmitCardsPage — Examination Admit Cards / Hall Tickets Management.
 *
 * Provides:
 *   - Class and Section selection for candidate batch generation.
 *   - Real-time search filter by student name, roll number, or admission number.
 *   - Dual layout mode: 2-Per-Page (Eco Landscape with cut-lines) vs 1-Per-Page (Standard Full A4).
 *   - Live preview canvas and high-fidelity bulk printing via iframe print engine.
 *   - Config drawer to customize candidate instructions, signatory titles, and student portal access.
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  Printer,
  SlidersHorizontal,
  Search,
  Calendar,
  X,
  FileCheck2,
} from 'lucide-react'
import {
  useExam,
  useExamAdmitCards,
  useUpdateAdmitCardConfig,
  type AdmitCardConfig,
  type AdmitCardStudent,
} from '@/api/exams'
import { useUnits, useGroups } from '@/api/academics'
import { printElement } from '@/lib/print'
import { useToast } from '@/lib/toast'
import { __, sprintf } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Button,
  Card,
  CardContent,
  Select,
  type SelectOption,
  Input,
  Checkbox,
  EmptyState,
  Alert,
  Skeleton,
  Badge,
  Spinner,
  Modal,
  ModalFooter,
} from '@/components/ui'
import AdmitCardDocument from '../components/AdmitCardDocument'

export interface ExamAdmitCardsPageProps {
  examId?: number
  embedded?: boolean
}

export default function ExamAdmitCardsPage({ examId: propExamId, embedded = false }: ExamAdmitCardsPageProps) {
  const { id: routeExamId } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const examId = propExamId || Number(routeExamId) || 0
  const toast = useToast()

  const printContainerRef = useRef<HTMLDivElement>(null)

  // ─── Query Context & Selection ──────────────────────────────────────────────
  const { data: exam, isLoading: isExamLoading } = useExam(examId)
  const sessionId = exam?.academic_session_id

  const { data: unitsResponse, isLoading: isUnitsLoading } = useUnits(
    sessionId ? { session_id: sessionId, per_page: 100 } : { per_page: 100 }
  )
  const units = unitsResponse?.data ?? []

  const selectedUnitId = Number(searchParams.get('unit_id')) || (units[0]?.id ? Number(units[0].id) : 0)
  const selectedGroupId = searchParams.get('group_id') ? Number(searchParams.get('group_id')) : undefined

  const { data: groupsResponse } = useGroups(selectedUnitId ? { academic_unit_id: Number(selectedUnitId) } : undefined)
  const groups = groupsResponse?.data ?? []
  // ─── Query Admit Cards Dataset ──────────────────────────────────────────────
  const {
    data: dataset,
    isLoading: isCardsLoading,
    refetch,
  } = useExamAdmitCards(examId, selectedUnitId, selectedGroupId, undefined, Boolean(selectedUnitId))

  const updateConfigMutation = useUpdateAdmitCardConfig()

  // ─── Local UI Controls State ────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [showPhoto, setShowPhoto] = useState(
    exam?.admit_card_config?.show_photo !== false
  )
  const [showInstructions, setShowInstructions] = useState(
    exam?.admit_card_config?.show_instructions !== false
  )
  const [showInvigilatorSign, setShowInvigilatorSign] = useState(
    Boolean(exam?.admit_card_config?.show_invigilator_sign)
  )
  // Settings Slideover / Drawer state
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [allowPortalDownload, setAllowPortalDownload] = useState(
    Boolean(exam?.admit_card_config?.allow_portal_download)
  )
  const [signatoryTitle, setSignatoryTitle] = useState(
    exam?.admit_card_config?.signatory_title || 'Controller of Examinations'
  )
  const [instructionsText, setInstructionsText] = useState(
    (exam?.admit_card_config?.instructions || dataset?.instructions || []).join('\n')
  )

  // Synchronize local settings when exam configuration loads (from exam detail or admit cards dataset)
  useEffect(() => {
    const cfg = exam?.admit_card_config || dataset?.exam?.config || dataset?.exam?.admit_card_config
    if (cfg) {
      if (cfg.show_photo !== undefined) setShowPhoto(cfg.show_photo)
      if (cfg.show_instructions !== undefined) setShowInstructions(cfg.show_instructions)
      if (cfg.show_invigilator_sign !== undefined) setShowInvigilatorSign(Boolean(cfg.show_invigilator_sign))
      if (cfg.allow_portal_download !== undefined) setAllowPortalDownload(Boolean(cfg.allow_portal_download))
      if (cfg.signatory_title) setSignatoryTitle(cfg.signatory_title)
    }
  }, [exam?.admit_card_config, dataset?.exam?.config, dataset?.exam?.admit_card_config])


  // Open drawer and ensure latest instructions/settings are populated
  const handleOpenConfig = () => {
    const activeConfig = exam?.admit_card_config || dataset?.exam?.config || dataset?.exam?.admit_card_config
    const saved = activeConfig?.instructions
    const fallback = dataset?.instructions || []
    const rulesToDisplay = (saved && saved.length > 0 ? saved : fallback).join('\n')
    setInstructionsText(rulesToDisplay)
    setSignatoryTitle(activeConfig?.signatory_title || 'Controller of Examinations')
    setAllowPortalDownload(Boolean(activeConfig?.allow_portal_download))
    setShowInvigilatorSign(Boolean(activeConfig?.show_invigilator_sign ?? showInvigilatorSign))
    setIsConfigOpen(true)
  }
  // ─── Filtered Students List ───
  const filteredStudents = useMemo(() => {
    if (!dataset?.students) return []
    if (!searchQuery.trim()) return dataset.students
    const q = searchQuery.toLowerCase().trim()
    return dataset.students.filter(
      (s: AdmitCardStudent) =>
        s.name.toLowerCase().includes(q) ||
        s.roll_number?.toLowerCase().includes(q) ||
        s.student_number?.toLowerCase().includes(q) ||
        s.admission_number?.toLowerCase().includes(q)
    )
  }, [dataset?.students, searchQuery])

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleUnitChange = (val: string) => {
    const next = new URLSearchParams(searchParams)
    if (val) next.set('unit_id', val)
    else next.delete('unit_id')
    next.delete('group_id')
    setSearchParams(next)
  }

  const handleGroupChange = (val: string) => {
    const next = new URLSearchParams(searchParams)
    if (val) next.set('group_id', val)
    else next.delete('group_id')
    setSearchParams(next)
  }

  const handlePrintBatch = () => {
    if (!printContainerRef.current) return
    printElement(printContainerRef.current)
  }

  const handleSaveConfig = async () => {
    const lines = instructionsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    const newConfig: AdmitCardConfig = {
      allow_portal_download: allowPortalDownload,
      signatory_title: signatoryTitle.trim() || 'Controller of Examinations',
      show_photo: showPhoto,
      show_instructions: showInstructions,
      show_invigilator_sign: showInvigilatorSign,
      instructions: lines,
    }

    try {
      await updateConfigMutation.mutateAsync({
        examId,
        admit_card_config: newConfig,
      })
      toast.success(__('Admit card settings updated successfully.', 'codeclove-school-management'))
      setIsConfigOpen(false)
      refetch()
    } catch {
      toast.error(__('Failed to save admit card configuration.', 'codeclove-school-management'))
    }
  }

  // ─── Select Options ─────────────────────────────────────────────────────────
  const unitOptions: SelectOption[] = units.map((u) => ({
    value: String(u.id),
    label: u.name,
  }))

  const groupOptions: SelectOption[] = [
    { value: '', label: __('All Sections', 'codeclove-school-management') },
    ...groups.map((g) => ({
      value: String(g.id),
      label: g.name,
    })),
  ]

  const toolbarContent = (
    <div className="no-print bg-bg-surface/50 dark:bg-bg-surface/60 border-b border-border p-3.5 sm:px-6 sm:py-3.5 space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        {/* Left: Class, Section, Search */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="w-48 sm:w-56">
            <Select
              value={String(selectedUnitId || '')}
              onValueChange={handleUnitChange}
              options={unitOptions}
              placeholder={__('Select Class...', 'codeclove-school-management')}
              disabled={isUnitsLoading}
            />
          </div>

          {groups.length > 0 && (
            <div className="w-40 sm:w-48">
              <Select
                value={String(selectedGroupId || '')}
                onValueChange={handleGroupChange}
                options={groupOptions}
                placeholder={__('All Sections', 'codeclove-school-management')}
              />
            </div>
          )}

          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={__('Search student or roll no...', 'codeclove-school-management')}
              className={cn('pl-9', searchQuery && 'pr-8')}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-text-subtle hover:text-text transition-colors cursor-pointer"
                aria-label={__('Clear search', 'codeclove-school-management')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Settings & Print Action */}
        <div className="flex items-center gap-2.5 self-start lg:self-auto shrink-0">
          {/* Settings Drawer Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenConfig}
            className="h-8 gap-1.5 px-3 text-xs font-medium"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-text-subtle" />
            <span className="hidden sm:inline">{__('Settings', 'codeclove-school-management')}</span>
          </Button>

          {/* Primary Print Button */}
          <Button
            variant="default"
            size="sm"
            onClick={handlePrintBatch}
            disabled={filteredStudents.length === 0}
            className="h-8 gap-1.5 px-3.5 text-xs font-semibold shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{sprintf(__('Print (%d)', 'codeclove-school-management'), filteredStudents.length)}</span>
          </Button>
        </div>
      </div>

      {/* Secondary Information & Document Toggles Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-border-subtle text-xs text-text-muted">
        <div className="flex items-center gap-2.5">
          <span className="font-medium text-text">
            {searchQuery.trim()
              ? sprintf(
                  __('%1$d matching candidate(s) (of %2$d in %3$s)', 'codeclove-school-management'),
                  filteredStudents.length,
                  dataset?.students?.length ?? filteredStudents.length,
                  filteredStudents[0]?.unit_name || __('selected class', 'codeclove-school-management')
                )
              : sprintf(
                  __('%1$d candidate(s) enrolled in %2$s', 'codeclove-school-management'),
                  filteredStudents.length,
                  filteredStudents[0]?.unit_name || __('selected class', 'codeclove-school-management')
                )}
          </span>
          {allowPortalDownload && (
            <Badge variant="success" size="sm" dot>
              {__('Portal download active', 'codeclove-school-management')}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-5">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-text-muted hover:text-text transition-colors">
            <Checkbox
              checked={showPhoto}
              onChange={(e) => setShowPhoto(e.target.checked)}
            />
            <span>{__('Student photo', 'codeclove-school-management')}</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-text-muted hover:text-text transition-colors">
            <Checkbox
              checked={showInstructions}
              onChange={(e) => setShowInstructions(e.target.checked)}
            />
            <span>{__('Rules & instructions', 'codeclove-school-management')}</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-text-muted hover:text-text transition-colors">
            <Checkbox
              checked={showInvigilatorSign}
              onChange={(e) => setShowInvigilatorSign(e.target.checked)}
            />
            <span>{__('Invigilator sign column', 'codeclove-school-management')}</span>
          </label>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col">
      {embedded ? toolbarContent : (
        <Card className="shadow-xs border-border bg-bg-elevated mb-6">
          <CardContent className="p-0">
            {toolbarContent}
          </CardContent>
        </Card>
      )}

      <div className={cn(embedded ? 'p-4 sm:p-6 bg-bg-base/30' : '')}>
      {/* ─── Main Content Canvas: Cards Live Preview ─── */}
      {isCardsLoading || isExamLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : !dataset || !dataset.exam ? (
        <Alert variant="warning">
          {__('Unable to load admit cards for the selected examination.', 'codeclove-school-management')}
        </Alert>
      ) : filteredStudents.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-12">
            <EmptyState
              icon={FileCheck2}
              title={__('No Candidates Found', 'codeclove-school-management')}
              description={
                searchQuery
                  ? __('No students match your search filter.', 'codeclove-school-management')
                  : __('No students are currently enrolled in this class, or no examination papers have been scheduled yet.', 'codeclove-school-management')
              }
              action={
                !searchQuery ? (
                  <Button asChild variant="secondary" size="sm" className="mt-3">
                    <Link to={`/exams/${examId}/timetable?unit_id=${selectedUnitId}`}>
                      <Calendar className="w-3.5 h-3.5 mr-1.5" />
                      {__('Schedule Exam Papers', 'codeclove-school-management')}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div>
          {/* Document Examination Desk Preview Canvas */}
          <div className="bg-bg-base/60 dark:bg-black/30 p-4 sm:p-8 rounded-xl border border-border shadow-inner">
            <div
              ref={printContainerRef}
              data-orientation="portrait"
              className="space-y-6 print:space-y-0"
            >
              {filteredStudents.map((st: AdmitCardStudent, idx: number) => (
                <div
                  key={st.student_id}
                  data-admit-card-sheet="1-up"
                  className={cn(
                    'w-full max-w-[194mm] mx-auto flex flex-col',
                    idx < filteredStudents.length - 1 ? 'print:break-after-page' : ''
                  )}
                >
                  <AdmitCardDocument
                    exam={dataset.exam}
                    school={dataset.school}
                    student={st}
                    instructions={dataset.instructions}
                    showPhoto={showPhoto}
                    showInstructions={showInstructions}
                    showInvigilatorSign={showInvigilatorSign}
                    signatoryTitle={signatoryTitle}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
      {/* ─── Admit Card Configuration Modal ─── */}
      <Modal
        open={isConfigOpen}
        onOpenChange={setIsConfigOpen}
        size="xl"
        title={__('Admit Card Settings', 'codeclove-school-management')}
        description={__('Configure candidate instructions, issuing authority, and portal release specifications.', 'codeclove-school-management')}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start py-1">
          {/* Left Column: Authority, Display Options & Portal Release (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            {/* Section 1: Issuing Authority */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-text">
                {__('Authorized Signatory Title', 'codeclove-school-management')}
              </label>
              <Input
                value={signatoryTitle}
                onChange={(e) => setSignatoryTitle(e.target.value)}
                placeholder={__('Controller of Examinations', 'codeclove-school-management')}
              />
              <p className="text-[11px] text-text-subtle">
                {__('Appears under the signature endorsement line on the card.', 'codeclove-school-management')}
              </p>
            </div>

            {/* Section 2: Print Display Elements */}
            <div className="p-3 bg-bg-surface rounded-lg border border-border space-y-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                {__('Print Elements', 'codeclove-school-management')}
              </span>
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-medium text-xs text-text cursor-pointer">
                  <Checkbox
                    checked={showPhoto}
                    onChange={(e) => setShowPhoto(e.target.checked)}
                  />
                  <span>{__('Student photo & candidate signature box', 'codeclove-school-management')}</span>
                </label>
                <label className="flex items-center gap-2 font-medium text-xs text-text cursor-pointer">
                  <Checkbox
                    checked={showInvigilatorSign}
                    onChange={(e) => setShowInvigilatorSign(e.target.checked)}
                  />
                  <span>{__('Invigilator signature column on schedule', 'codeclove-school-management')}</span>
                </label>
              </div>
            </div>

            {/* Section 3: Portal Release Toggle */}
            <div className="p-3 bg-bg-surface rounded-lg border border-border space-y-1">
              <label className="flex items-center gap-2 font-medium text-xs text-text cursor-pointer">
                <Checkbox
                  checked={allowPortalDownload}
                  onChange={(e) => setAllowPortalDownload(e.target.checked)}
                />
                <span className="font-semibold">{__('Allow Student Portal Download', 'codeclove-school-management')}</span>
              </label>
              <p className="text-[11px] text-text-muted pl-6 leading-relaxed">
                {__('Enrolled students and guardians can download their official admit card directly from their portal account.', 'codeclove-school-management')}
              </p>
            </div>
          </div>

          {/* Right Column: Candidate Examination Rules / Instructions (7 cols) */}
          <div className="md:col-span-7 flex flex-col h-full space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-text">
                {__('Candidate Instructions (One per line)', 'codeclove-school-management')}
              </label>
              <button
                type="button"
                onClick={() => setInstructionsText((dataset?.instructions || []).join('\n'))}
                className="text-[11px] text-brand hover:underline font-medium cursor-pointer"
              >
                {__('Reset to Standard Rules', 'codeclove-school-management')}
              </button>
            </div>
            <textarea
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              className="w-full text-xs font-sans p-3 rounded border border-border bg-bg-surface text-text shadow-xs placeholder:text-text-subtle hover:border-border-strong focus:outline-hidden focus:ring-2 focus:ring-brand-dim focus:border-brand resize-y transition-colors leading-relaxed min-h-[265px]"
              placeholder={__('Enter instructions (one rule per line)...', 'codeclove-school-management')}
            />
            <p className="text-[11px] text-text-subtle leading-tight">
              {__('Rules are automatically numbered and printed in a balanced two-column section at the bottom of the card.', 'codeclove-school-management')}
            </p>
          </div>
        </div>

        <ModalFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsConfigOpen(false)}
            className="h-8 px-3 text-xs"
          >
            {__('Cancel', 'codeclove-school-management')}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveConfig}
            disabled={updateConfigMutation.isPending}
            className="h-8 px-3.5 text-xs font-semibold gap-1.5"
          >
            {updateConfigMutation.isPending && <Spinner size="sm" />}
            <span>{updateConfigMutation.isPending ? __('Saving...', 'codeclove-school-management') : __('Save Settings', 'codeclove-school-management')}</span>
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
