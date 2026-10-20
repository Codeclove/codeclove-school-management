import React, { useState, useMemo, useEffect } from 'react'
import { Users, Search, X, ChevronDown } from 'lucide-react'
import {
  FormField,
  Input,
  Select,
  Badge,
  Spinner,
  Button,
  DatePicker,
  EmptyState,
} from '@/components/ui'
import type { CertificateTemplate } from '@/api/certificates'
import type { FullStudent } from '@/api/students'
import type { AcademicUnit, AcademicGroup } from '@/api/academics'
import { useLabels } from '@/lib/labels'
import { ClassMultiSelect } from './ClassMultiSelect'
import { IssuanceFields } from './IssuanceFields'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'

export interface BatchIssueFormProps {
  templates: CertificateTemplate[]
  selectedTemplateId: number
  onSelectTemplateId: (id: number) => void
  selectedTemplate?: CertificateTemplate
  units: AcademicUnit[]
  selectedUnitIds: number[]
  onSelectUnitIds: (ids: number[]) => void
  groups: AcademicGroup[]
  selectedGroupId?: number
  onSelectGroupId: (id: number | undefined) => void
  batchStudents: FullStudent[]
  loadingBatchStudents: boolean
  excludedStudentIds: Set<number>
  onToggleExcludeStudent: (id: number) => void
  onIncludeAll: () => void
  onExcludeAll: () => void
  previewStudentId: number | null
  onSelectPreviewStudent: (id: number) => void
  numberScheme: 'sequential' | 'admission_no' | 'roll_no'
  onNumberSchemeChange: (scheme: 'sequential' | 'admission_no' | 'roll_no') => void
  numberPrefix: string
  onNumberPrefixChange: (prefix: string) => void
  startNumber: number
  onStartNumberChange: (num: number) => void
  issueDate: string
  onIssueDateChange: (date: string) => void
  sampleBatchSerials: string[]
  reason: string
  onReasonChange: (reason: string) => void
  conduct: string
  onConductChange: (conduct: string) => void
  duesStatus: string
  onDuesStatusChange: (status: string) => void
}

export const BatchIssueForm: React.FC<BatchIssueFormProps> = ({
  templates,
  selectedTemplateId,
  onSelectTemplateId,
  selectedTemplate,
  units,
  selectedUnitIds,
  onSelectUnitIds,
  groups,
  selectedGroupId,
  onSelectGroupId,
  batchStudents,
  loadingBatchStudents,
  excludedStudentIds,
  onToggleExcludeStudent,
  onIncludeAll,
  onExcludeAll,
  previewStudentId,
  onSelectPreviewStudent,
  numberScheme,
  onNumberSchemeChange,
  numberPrefix,
  onNumberPrefixChange,
  startNumber,
  onStartNumberChange,
  issueDate,
  onIssueDateChange,
  sampleBatchSerials,
  reason,
  onReasonChange,
  conduct,
  onConductChange,
  duesStatus,
  onDuesStatusChange,
}) => {
  const { getLabel } = useLabels()
  const classLabel = getLabel('academic_unit', false, 'Class')
  const classPluralLabel = getLabel('academic_unit', true, 'Classes')
  const sectionLabel = getLabel('academic_group', false, 'Section')
  const sectionPluralLabel = getLabel('academic_group', true, 'Sections')
  const studentLabel = getLabel('student', false, 'Student')
  const studentPluralLabel = getLabel('student', true, 'Students')

  const isMultiClass = selectedUnitIds.length > 1
  const isAllClasses = selectedUnitIds.length === units.length && units.length > 0
  const isSingleClass = selectedUnitIds.length === 1
  const isNoneSelected = selectedUnitIds.length === 0
  // Search filter inside cohort student checklist
  const [studentSearch, setStudentSearch] = useState('')
  const [isExclusionOpen, setIsExclusionOpen] = useState(false)

  // Safety Guard: Roll Number scheme is not globally unique across multiple classes
  useEffect(() => {
    if (isMultiClass && numberScheme === 'roll_no') {
      onNumberSchemeChange('sequential')
    }
  }, [isMultiClass, numberScheme, onNumberSchemeChange])

  const includedCount = Math.max(0, batchStudents.length - excludedStudentIds.size)
  const excludedCount = excludedStudentIds.size

  // Group students by unit name to show cohort breakdown
  // Group students by unit name to show cohort breakdown (only needed for <= 3 classes)
  const cohortBreakdown = useMemo(() => {
    if (batchStudents.length === 0 || isAllClasses || selectedUnitIds.length > 3) return []
    const counts = new Map<string, { total: number; excluded: number }>()
    for (const st of batchStudents) {
      const uName = st.enrollment?.unit_name || classLabel
      const item = counts.get(uName) || { total: 0, excluded: 0 }
      item.total += 1
      if (excludedStudentIds.has(st.id)) item.excluded += 1
      counts.set(uName, item)
    }
    return Array.from(counts, ([name, { total, excluded }]) => ({
      name,
      total,
      included: total - excluded,
      excluded,
    }))
  }, [batchStudents, excludedStudentIds, classLabel, isAllClasses, selectedUnitIds.length])

  // Filter students by name, ID, roll number, class, or section
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    if (!q) return batchStudents

    return batchStudents.filter((st) => {
      const fullName = `${st.first_name} ${st.last_name} ${st.middle_name || ''}`.toLowerCase()
      const adm = (st.admission_number || '').toLowerCase()
      const stuNo = (st.student_number || '').toLowerCase()
      const roll = (st.enrollment?.roll_number || '').toLowerCase()
      const unit = (st.enrollment?.unit_name || '').toLowerCase()
      const grp = (st.enrollment?.group_name || '').toLowerCase()
      return (
        fullName.includes(q) ||
        adm.includes(q) ||
        stuNo.includes(q) ||
        roll.includes(q) ||
        unit.includes(q) ||
        grp.includes(q)
      )
    })
  }, [batchStudents, studentSearch])
  return (
    <div className="bg-bg-elevated border border-border rounded-xl shadow-xs divide-y divide-border/60">
      {/* ─── SECTION 1: Template & Dynamic Cohort ──────────────────── */}
      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text uppercase tracking-wider">
            {isAllClasses
              ? __('Template & School-Wide Cohort', 'codeclove-school-management')
              : isMultiClass
              ? sprintf(__('Template & Multi-Class Cohort (%d %s)', 'codeclove-school-management'), selectedUnitIds.length, classPluralLabel)
              : isSingleClass
              ? sprintf(__('Template & %s Cohort', 'codeclove-school-management'), classLabel)
              : sprintf(__('Template & %s Cohort', 'codeclove-school-management'), classPluralLabel)}
          </span>
          {selectedTemplate && (
            <Badge variant="outline" className="text-3xs uppercase font-mono tracking-wider">
              {selectedTemplate.orientation} • {selectedTemplate.type}
            </Badge>
          )}
        </div>

        <FormField label={__('Certificate Template', 'codeclove-school-management')} required>
          <Select
            value={String(selectedTemplateId)}
            onValueChange={(val) => onSelectTemplateId(Number(val))}
            options={templates.map((tpl) => ({
              value: String(tpl.id),
              label: `${tpl.title} (${tpl.orientation})`,
            }))}
          />
        </FormField>

        {/* Dynamic Class Multi-Selector & Adaptive Section Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
          <FormField label={classLabel} required>
            <ClassMultiSelect
              units={units}
              selectedUnitIds={selectedUnitIds}
              onChange={onSelectUnitIds}
              placeholder={sprintf(__('Select %s...', 'codeclove-school-management'), classPluralLabel)}
            />
          </FormField>

          <FormField label={sectionLabel}>
            {(() => {
              const sectionPlaceholder = isAllClasses
                ? sprintf(__('All %s (Whole School)', 'codeclove-school-management'), sectionPluralLabel)
                : isMultiClass
                ? sprintf(
                    __('All %s (%d %s Selected)', 'codeclove-school-management'),
                    sectionPluralLabel,
                    selectedUnitIds.length,
                    classPluralLabel
                  )
                : isSingleClass
                ? sprintf(__('All %s', 'codeclove-school-management'), sectionPluralLabel)
                : sprintf(__('Select %s first...', 'codeclove-school-management'), classLabel)

              return (
                <Select
                  value={isSingleClass && selectedGroupId ? String(selectedGroupId) : ''}
                  onValueChange={(val) => onSelectGroupId(val ? Number(val) : undefined)}
                  options={
                    isSingleClass
                      ? [
                          { value: '', label: sprintf(__('All %s', 'codeclove-school-management'), sectionPluralLabel) },
                          ...groups.map((g) => ({ value: String(g.id), label: g.name })),
                        ]
                      : [{ value: '', label: sectionPlaceholder }]
                  }
                  placeholder={sectionPlaceholder}
                  disabled={!isSingleClass}
                />
              )
            })()}
          </FormField>
        </div>
      </div>

      {/* ─── SECTION 2: Cohort Overview & Exclusion Drawer ────────────────────── */}
      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text uppercase tracking-wider">
            {__('Target Cohort & Recipients', 'codeclove-school-management')}
          </span>
          <Badge variant="outline" className="text-3xs font-mono uppercase tracking-wider">
            {isAllClasses
              ? __('Whole School', 'codeclove-school-management')
              : isMultiClass
              ? sprintf(__('%d %s', 'codeclove-school-management'), selectedUnitIds.length, classPluralLabel)
              : isSingleClass
              ? units.find((u) => u.id === selectedUnitIds[0])?.name || classLabel
              : __('No Cohort', 'codeclove-school-management')}
          </Badge>
        </div>

        {loadingBatchStudents ? (
          <div className="p-4 text-center text-xs text-text-muted flex items-center justify-center gap-2 bg-bg-surface border border-border rounded-lg">
            <Spinner size="sm" />
            <span>{sprintf(__('Calculating target cohort across selected %s...', 'codeclove-school-management'), classPluralLabel.toLowerCase())}</span>
          </div>
        ) : batchStudents.length === 0 ? (
          <div className="py-5 px-4 bg-bg-surface border border-border rounded-lg">
            <EmptyState
              icon={Users}
              title={sprintf(
                __('No active %s found', 'codeclove-school-management'),
                studentPluralLabel.toLowerCase()
              )}
              description={
                isNoneSelected
                  ? sprintf(
                      __('Please select at least one %s to calculate the target cohort.', 'codeclove-school-management'),
                      classLabel.toLowerCase()
                    )
                  : sprintf(
                      __('There are no active %s enrolled in the selected %s.', 'codeclove-school-management'),
                      studentPluralLabel.toLowerCase(),
                      isSingleClass ? classLabel.toLowerCase() : classPluralLabel.toLowerCase()
                    )
              }
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Reassuring Cohort Summary Card */}
            <div
              className={cn(
                'p-3 rounded-lg border transition-all duration-150 space-y-1.5',
                excludedCount > 0
                  ? 'bg-warning/5 border-warning/30'
                  : 'bg-bg-surface border-border shadow-2xs'
              )}
            >
              {/* Row 1: Cohort title, enrollment badge, and compact action toggle */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'p-1.5 rounded-md shrink-0',
                      excludedCount > 0 ? 'bg-warning/15 text-warning-text' : 'bg-brand/10 text-brand'
                    )}
                  >
                    <Users size={15} />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-text truncate">
                    {sprintf(
                      __('%d %s Selected', 'codeclove-school-management'),
                      includedCount,
                      includedCount === 1 ? studentLabel : studentPluralLabel
                    )}
                  </span>
                  {excludedCount > 0 ? (
                    <Badge variant="warning" className="text-3xs font-mono font-medium shrink-0">
                      {sprintf(__('%d excluded', 'codeclove-school-management'), excludedCount)}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-3xs font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 shrink-0"
                    >
                      {__('100% Enrolled', 'codeclove-school-management')}
                    </Badge>
                  )}
                </div>

                {/* Compact Action Toggle */}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsExclusionOpen(!isExclusionOpen)}
                  className={cn(
                    'h-6 text-2xs font-medium px-2 flex items-center gap-1 shrink-0 transition-colors',
                    excludedCount > 0
                      ? 'border-warning/40 text-warning-text bg-warning/10 hover:bg-warning/20'
                      : 'border-border text-text-muted hover:text-text hover:bg-hover-bg'
                  )}
                >
                  <span>
                    {isExclusionOpen
                      ? __('Hide List', 'codeclove-school-management')
                      : excludedCount > 0
                      ? sprintf(__('Review (%d)', 'codeclove-school-management'), excludedCount)
                      : __('Exclude', 'codeclove-school-management')}
                  </span>
                  <ChevronDown
                    size={11}
                    className={cn('transition-transform duration-150', isExclusionOpen && 'rotate-180')}
                  />
                </Button>
              </div>

              {/* Row 2: Full-width single-line cohort breakdown */}
              <div className="text-2xs text-text-muted flex items-center gap-1.5 flex-wrap pl-7">
                {isAllClasses ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-medium text-text">
                      {sprintf(__('All %d %s Enrolled', 'codeclove-school-management'), units.length, classPluralLabel)}
                    </span>
                    <span className="text-border-strong">•</span>
                    <span className="font-mono">{includedCount} {studentPluralLabel.toLowerCase()}</span>
                  </span>
                ) : selectedUnitIds.length > 3 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-medium text-text">
                      {sprintf(__('%d %s Selected', 'codeclove-school-management'), selectedUnitIds.length, classPluralLabel)}
                    </span>
                    <span className="text-border-strong">•</span>
                    <span className="font-mono">{includedCount} {studentPluralLabel.toLowerCase()}</span>
                  </span>
                ) : (
                  cohortBreakdown.map((b, idx) => (
                    <span key={b.name} className="inline-flex items-center">
                      {idx > 0 && <span className="mx-1 text-border-strong">•</span>}
                      <span className="font-medium text-text">{b.name}:</span>
                      <span className="ml-1 font-mono">{b.included}{b.excluded > 0 ? `/${b.total}` : ''}</span>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Collapsible Exclusion Drawer */}
            {isExclusionOpen && (
              <div className="p-3 bg-bg-surface/70 dark:bg-bg-surface/40 border border-border rounded-lg space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-2xs font-medium text-text-muted">
                    {__('Uncheck students to exclude:', 'codeclove-school-management')}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={onIncludeAll}
                      disabled={excludedCount === 0}
                      className="h-5 text-3xs font-semibold px-1.5 rounded text-brand hover:bg-brand/10 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      {__('Include All', 'codeclove-school-management')}
                    </button>
                    <span className="text-border-strong text-3xs">•</span>
                    <button
                      type="button"
                      onClick={onExcludeAll}
                      disabled={includedCount === 0}
                      className="h-5 text-3xs font-medium px-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      {__('Exclude All', 'codeclove-school-management')}
                    </button>
                  </div>
                </div>

                {/* Filter input */}
                {batchStudents.length > 5 && (
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder={
                        isMultiClass
                          ? sprintf(__('Filter by name, ID, or %s...', 'codeclove-school-management'), classLabel.toLowerCase())
                          : __('Filter students by name or ID...', 'codeclove-school-management')
                      }
                      className="w-full h-7 pl-7 pr-7 text-xs bg-bg-surface border border-border rounded-md text-text placeholder:text-text-muted focus:outline-hidden focus:ring-1 focus:ring-brand focus:border-brand"
                    />
                    {studentSearch && (
                      <button
                        type="button"
                        onClick={() => setStudentSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0.5 rounded"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                )}

                {/* Student list */}
                {filteredStudents.length === 0 ? (
                  <div className="py-4 text-center text-xs text-text-muted">
                    <p>{sprintf(__('No %s matching "%s"', 'codeclove-school-management'), studentPluralLabel.toLowerCase(), studentSearch)}</p>
                  </div>
                ) : (
                  <div className="max-h-40 sm:max-h-44 overflow-y-auto divide-y divide-border/30 border border-border rounded-md bg-bg-surface">
                    {filteredStudents.map((st) => {
                      const isExcluded = excludedStudentIds.has(st.id)
                      const isPreviewing = previewStudentId === st.id
                      return (
                        <div
                          key={st.id}
                          onClick={() => onSelectPreviewStudent(st.id)}
                          className={cn(
                            'px-3 py-1.5 flex items-center justify-between gap-2.5 text-xs transition-colors cursor-pointer select-none',
                            isExcluded
                              ? 'opacity-55 bg-danger/5 hover:opacity-75'
                              : isPreviewing
                              ? 'bg-brand/10 dark:bg-brand/15 font-medium border-l-2 border-brand'
                              : 'hover:bg-hover-bg'
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={(e) => {
                                e.stopPropagation()
                                onToggleExcludeStudent(st.id)
                              }}
                              className="w-3.5 h-3.5 rounded text-brand focus:ring-brand cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <span className={cn('text-text truncate block text-xs', isExcluded && 'line-through text-text-muted')}>
                                {st.first_name} {st.last_name}
                              </span>
                              <span className="text-3xs text-text-muted font-mono truncate block">
                                {st.admission_number || st.student_number}
                                {isMultiClass && st.enrollment?.unit_name && ` • ${st.enrollment.unit_name}`}
                                {st.enrollment?.roll_number && ` • Roll #${st.enrollment.roll_number}`}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isExcluded && (
                              <Badge variant="outline" className="text-3xs font-mono text-danger border-danger/30 bg-danger/5 px-1 py-0">
                                {__('Excluded', 'codeclove-school-management')}
                              </Badge>
                            )}
                            {isPreviewing && !isExcluded && (
                              <Badge variant="brand" className="text-3xs px-1.5 py-0">
                                {__('Previewing', 'codeclove-school-management')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── SECTION 3: Serial Numbering & Details (Zero Truncation) ─ */}
      <div className="p-4 sm:p-5 space-y-3.5">
        <span className="text-xs font-bold text-text uppercase tracking-wider block">
          {__('Numbering & Details', 'codeclove-school-management')}
        </span>

        {/* 2-Column Responsive Layout - No 3-column squeeze, never truncates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label={__('Numbering Scheme', 'codeclove-school-management')}
            hint={
              isMultiClass
                ? __('Roll numbers repeat across classes. Use Sequential or Student ID.', 'codeclove-school-management')
                : undefined
            }
          >
            <Select
              value={numberScheme}
              onValueChange={(val) => {
                if (val === 'sequential' || val === 'admission_no' || val === 'roll_no') {
                  onNumberSchemeChange(val)
                }
              }}
              options={[
                { value: 'sequential', label: __('Sequential (Auto)', 'codeclove-school-management') },
                { value: 'admission_no', label: sprintf(__('%s ID', 'codeclove-school-management'), studentLabel) },
                {
                  value: 'roll_no',
                  label: isMultiClass
                    ? sprintf(__('Roll Number (%s only)', 'codeclove-school-management'), classLabel)
                    : __('Roll Number', 'codeclove-school-management'),
                  disabled: isMultiClass,
                },
              ]}
            />
          </FormField>

          <FormField label={__('Prefix', 'codeclove-school-management')}>
            <Input
              value={numberPrefix}
              onChange={(e) => onNumberPrefixChange(e.target.value.toUpperCase())}
              className="text-xs font-mono h-8 uppercase"
              placeholder="TC"
            />
          </FormField>
          <FormField label={__('Issue Date', 'codeclove-school-management')} required>
            <DatePicker
              value={issueDate}
              onChange={(val) => onIssueDateChange(val)}
              clearable={false}
              className="text-xs h-8"
              placeholder={__('Select issue date...', 'codeclove-school-management')}
            />
          </FormField>

          {numberScheme === 'sequential' ? (
            <FormField label={__('Start Number', 'codeclove-school-management')}>
              <Input
                type="number"
                min={1}
                value={startNumber}
                onChange={(e) => onStartNumberChange(Math.max(1, Number(e.target.value)))}
                className="text-xs font-mono h-8"
              />
            </FormField>
          ) : (
            <div className="flex items-end pb-1">
              <span className="text-2xs text-text-muted font-mono">
                {numberScheme === 'admission_no'
                  ? sprintf(__('Appends %s ID to prefix', 'codeclove-school-management'), studentLabel.toLowerCase())
                  : sprintf(__('Appends %s roll number', 'codeclove-school-management'), studentLabel.toLowerCase())}
              </span>
            </div>
          )}
        </div>

        {/* Full-Width Serial Range Preview Pill — Never truncated */}
        {sampleBatchSerials.length > 0 && (
          <div className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-xs font-mono flex flex-wrap items-center justify-between gap-1 shadow-2xs">
            <span className="text-2xs font-sans text-text-muted font-medium">
              {__('Serial Range:', 'codeclove-school-management')}
            </span>
            <span className="text-xs font-bold text-brand tabular-nums tracking-wide">
              {sampleBatchSerials[0]} → {sampleBatchSerials[sampleBatchSerials.length - 1]}
              <span className="text-2xs font-normal text-text-muted ml-2">
                ({includedCount} {__('certificates', 'codeclove-school-management')})
              </span>
            </span>
          </div>
        )}

        <IssuanceFields
          templateType={selectedTemplate?.type}
          reason={reason}
          onReasonChange={onReasonChange}
          conduct={conduct}
          onConductChange={onConductChange}
          duesStatus={duesStatus}
          onDuesStatusChange={onDuesStatusChange}
        />
      </div>
    </div>
  )
}
