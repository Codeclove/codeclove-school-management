import { useMemo } from 'react'
import {
  BookOpen,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import type { AcademicUnitSubject } from '@/api/academics'
import { Card, Checkbox } from '@/components/ui'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'

export interface SubjectEnrollmentSectionProps {
  unitSubjects: AcademicUnitSubject[]
  selectedSubjectIds: number[]
  onChange: (subjectIds: number[]) => void
  activeUnit: string
  unitLabelSingular: string
  subjectLabelPlural: string
  isPending?: boolean
}

export default function SubjectEnrollmentSection({
  unitSubjects,
  selectedSubjectIds,
  onChange,
  activeUnit,
  unitLabelSingular,
  subjectLabelPlural,
  isPending = false,
}: SubjectEnrollmentSectionProps) {
  // ─── Classification of subjects ──────────────────────────────────────────
  // Core: subjects defined as core that are not explicitly marked optional for this unit
  const coreSubjects = useMemo(() => {
    return unitSubjects.filter((s) => s.subject_type === 'core' && s.is_required !== false)
  }, [unitSubjects])

  // Elective & Co-Curricular: electives, activities, or core subjects marked optional
  const electiveAndOtherSubjects = useMemo(() => {
    return unitSubjects.filter(
      (s) => s.subject_type !== 'core' || s.is_required === false
    )
  }, [unitSubjects])

  const totalCurriculumCount = coreSubjects.length + electiveAndOtherSubjects.length

  // Metrics
  const selectedCoreCount = selectedSubjectIds.filter((id) => coreSubjects.some((s) => s.subject_id === id)).length
  const selectedElectiveCount = selectedSubjectIds.filter((id) => electiveAndOtherSubjects.some((s) => s.subject_id === id)).length
  const isAllCoreEnrolled = coreSubjects.length > 0 && selectedCoreCount === coreSubjects.length
  const missingCoreCount = coreSubjects.length - selectedCoreCount
  // ─── Actions ─────────────────────────────────────────────────────────────
  const handleToggle = (subjectId: number) => {
    if (selectedSubjectIds.includes(subjectId)) {
      onChange(selectedSubjectIds.filter((id) => id !== subjectId))
    } else {
      onChange([...selectedSubjectIds, subjectId])
    }
  }

  const handleSelectAllCore = () => {
    const coreIds = coreSubjects.map((s) => s.subject_id)
    const nonCoreSelected = selectedSubjectIds.filter((id) => !coreIds.includes(id))
    onChange([...coreIds, ...nonCoreSelected])
  }

  const handleClearElectives = () => {
    const electiveIds = electiveAndOtherSubjects.map((s) => s.subject_id)
    onChange(selectedSubjectIds.filter((id) => !electiveIds.includes(id)))
  }

  // Helper to render an individual subject item (Option A: Refined Modern Cards)
  const renderSubjectRow = (sub: AcademicUnitSubject) => {
    const isChecked = selectedSubjectIds.includes(sub.subject_id)
    const isCore = sub.subject_type === 'core' && sub.is_required !== false

    return (
      <label
        key={sub.subject_id}
        className={cn(
          'group relative flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer select-none',
          'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-ring has-[:focus-visible]:border-brand',
          isChecked
            ? 'border-brand-border bg-bg-elevated shadow-2xs hover:border-brand/40'
            : 'border-border bg-bg-surface hover:border-border-strong hover:bg-hover-bg/50',
          isPending && 'pointer-events-none opacity-60'
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Custom Accessible Checkbox */}
          <Checkbox
            checked={isChecked}
            onChange={() => handleToggle(sub.subject_id)}
            disabled={isPending}
            aria-label={sub.subject_name}
          />

          {/* Monospace Subject Code (Clean borderless pill, auxiliary muted metadata) */}
          {sub.subject_code && (
            <span className="font-mono text-[11px] font-medium px-1.5 py-0.5 rounded bg-hover-bg text-text-muted shrink-0 uppercase tracking-wide group-hover:text-text transition-colors">
              {sub.subject_code}
            </span>
          )}

          {/* Subject Name: Proper 14px Scale */}
          <span className="text-sm font-medium text-text truncate">
            {sub.subject_name}
          </span>
        </div>

        {/* Semantic Category / Type Tag */}
        <span className="text-3xs font-medium uppercase tracking-wider text-text-subtle shrink-0">
          {isCore
            ? __( 'Core', 'codeclove-school-management' )
            : __( 'Elective', 'codeclove-school-management' )}
        </span>
      </label>
    )
  }

  return (
    <Card id="section-subjects" className="overflow-hidden border border-border bg-bg-elevated shadow-xs rounded-xl p-5 space-y-4">
      {/* ─── Card Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl border border-border bg-bg-surface flex items-center justify-center text-text shrink-0 shadow-2xs">
            <BookOpen className="w-4 h-4 text-text" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text tracking-tight uppercase">
              {__( 'Enrolled Subjects & Electives', 'codeclove-school-management' )}
            </h3>
            <p className="text-2xs text-text-muted mt-0.5">
              {__( 'Mandatory curriculum and chosen electives for this class.', 'codeclove-school-management' )}
            </p>
          </div>
        </div>

        {/* Global Action: Reset to Core / Defaults */}
        {electiveAndOtherSubjects.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(coreSubjects.map((s) => s.subject_id))}
            disabled={isPending}
            title={__( 'Enroll all core and clear electives', 'codeclove-school-management' )}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-border bg-bg-surface text-text hover:bg-hover-bg font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-text-muted" />
            <span>{__( 'Reset to Core', 'codeclove-school-management' )}</span>
          </button>
        )}
      </div>

      {/* ─── State 1: No Unit Selected ──────────────────────────────────────── */}
      {!activeUnit ? (
        <div className="p-6 text-center rounded-lg border border-dashed border-border bg-bg-surface">
          <p className="text-xs text-text-muted">
            {sprintf(
              __( 'Please assign a %1$s in Academic Placement to load available %2$s.', 'codeclove-school-management' ),
              unitLabelSingular.toLowerCase(),
              subjectLabelPlural.toLowerCase()
            )}
          </p>
        </div>
      ) : totalCurriculumCount === 0 ? (
        /* ─── State 2: Unit has no subjects mapped ─────────────────────────── */
        <div className="p-6 text-center rounded-lg border border-dashed border-border bg-bg-surface">
          <p className="text-xs text-text-muted">
            {sprintf(
              __( 'No active core or elective %1$s mapped to this %2$s.', 'codeclove-school-management' ),
              subjectLabelPlural.toLowerCase(),
              unitLabelSingular.toLowerCase()
            )}
          </p>
        </div>
      ) : (
        /* ─── State 3: Clean Two-Tier Curriculum ───────────────────────────── */
        <div className="space-y-4">
          {/* Missing Core Warning Banner (Error Prevention) */}
          {coreSubjects.length > 0 && missingCoreCount > 0 && (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-warning-dim border border-warning-border text-xs text-warning">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {sprintf(
                    __( '%d mandatory core subject(s) are currently unselected.', 'codeclove-school-management' ),
                    missingCoreCount
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSelectAllCore}
                disabled={isPending}
                className="font-semibold underline hover:no-underline cursor-pointer text-xs shrink-0 ms-2"
              >
                {__( 'Enroll all core', 'codeclove-school-management' )}
              </button>
            </div>
          )}

          {/* ─── Tier 1: Core Curriculum (Compulsory) ────────────────────────── */}
          {coreSubjects.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xs font-bold uppercase tracking-wider text-text">
                    {__( 'Core Curriculum', 'codeclove-school-management' )}
                  </span>
                  <span className="text-3xs font-medium px-1.5 py-0.5 rounded bg-brand-dim text-brand border border-brand-border">
                    {__( 'Compulsory', 'codeclove-school-management' )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-2xs">
                  <span className="text-text-muted font-medium">
                    {sprintf( __( '%1$d of %2$d enrolled', 'codeclove-school-management' ), selectedCoreCount, coreSubjects.length )}
                  </span>
                  {!isAllCoreEnrolled && (
                    <button
                      type="button"
                      onClick={handleSelectAllCore}
                      disabled={isPending}
                      className="font-semibold text-brand hover:underline cursor-pointer"
                    >
                      {__( 'Enroll all core', 'codeclove-school-management' )}
                    </button>
                  )}
                </div>
              </div>

              {/* High-density 2-column balanced grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {coreSubjects.map(renderSubjectRow)}
              </div>
            </div>
          )}

          {/* ─── Tier 2: Academic Electives & Co-Curricular ──────────────────── */}
          {electiveAndOtherSubjects.length > 0 && (
            <div className="space-y-2 pt-2.5 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xs font-bold uppercase tracking-wider text-text">
                    {__( 'Academic Electives & Co-Curricular', 'codeclove-school-management' )}
                  </span>
                  <span className="text-3xs font-medium px-1.5 py-0.5 rounded bg-hover-bg text-text-subtle border border-border">
                    {__( 'Optional', 'codeclove-school-management' )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-2xs">
                  <span className="text-text-muted font-medium">
                    {sprintf(
                      __( '%1$d of %2$d selected', 'codeclove-school-management' ),
                      selectedElectiveCount,
                      electiveAndOtherSubjects.length
                    )}
                  </span>
                  {selectedElectiveCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearElectives}
                      disabled={isPending}
                      className="font-medium text-text-muted hover:text-danger cursor-pointer"
                    >
                      {__( 'Clear', 'codeclove-school-management' )}
                    </button>
                  )}
                </div>
              </div>

              {/* High-density 2-column balanced grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {electiveAndOtherSubjects.map(renderSubjectRow)}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
