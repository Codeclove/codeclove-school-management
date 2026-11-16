/** Tab: Education — settings section for curriculum presets, academic cycle, and terminology */

import { useMemo } from 'react'
import type { UseFormRegister, UseFormWatch, Control, Path } from 'react-hook-form'
import type { CodeCloveSettings } from '@/api/settings'
import { FormGroup, FormInput, FormSelect, StringListEditor } from '../components/SettingsFormPrimitives'
import { Badge, Button } from '@/components/ui'
import {
  BookOpen,
  Globe,
  Languages,
  Check,
  CheckCircle2,
  Sparkles,
  Scale,
  GraduationCap,
  School,
  Landmark,
  type LucideIcon,
} from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import { __, sprintf } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Register = UseFormRegister<CodeCloveSettings>

interface EducationTabProps {
  register: Register
  presets: Array<{ code: string; name: string }>
  selectedPreset: string
  setSelectedPreset: (code: string) => void
  onApplyPresetClick: () => void
  watch: UseFormWatch<CodeCloveSettings>
  control: Control<CodeCloveSettings>
}

export function EducationTab({
  register,
  presets,
  selectedPreset,
  setSelectedPreset,
  onApplyPresetClick,
  watch,
  control,
}: EducationTabProps) {
  const activePresetName = watch('education_system.preset_name')
  const activePresetCode = watch('education_system.preset')
  const isCustomized = watch('education_system.customized')

  const months = useMemo(() => [
    { value: '1',  label: __( 'January', 'codeclove-school-management' )   },
    { value: '2',  label: __( 'February', 'codeclove-school-management' )  },
    { value: '3',  label: __( 'March', 'codeclove-school-management' )     },
    { value: '4',  label: __( 'April', 'codeclove-school-management' )     },
    { value: '5',  label: __( 'May', 'codeclove-school-management' )       },
    { value: '6',  label: __( 'June', 'codeclove-school-management' )      },
    { value: '7',  label: __( 'July', 'codeclove-school-management' )      },
    { value: '8',  label: __( 'August', 'codeclove-school-management' )    },
    { value: '9',  label: __( 'September', 'codeclove-school-management' ) },
    { value: '10', label: __( 'October', 'codeclove-school-management' )   },
    { value: '11', label: __( 'November', 'codeclove-school-management' )  },
    { value: '12', label: __( 'December', 'codeclove-school-management' )  },
  ], [])

  const gradingSchemes = useMemo(() => [
    { value: 'marks_percentage', label: __( 'Marks + Percentage (e.g. 85/100 = 85%)', 'codeclove-school-management' ) },
    { value: 'letter_gpa',       label: __( 'Letter Grade + GPA  (e.g. A, 3.8/4.0)', 'codeclove-school-management' )  },
    { value: 'levels_marks',     label: __( 'Assessment Levels + Marks', 'codeclove-school-management' )               },
  ], [])

  const termKeys = useMemo<Array<{ key: string; label: string }>>(() => [
    { key: 'academic_session',   label: __( 'Academic Session', 'codeclove-school-management' )   },
    { key: 'academic_term',      label: __( 'Academic Term', 'codeclove-school-management' )      },
    { key: 'academic_unit',      label: __( 'Academic Unit', 'codeclove-school-management' )      },
    { key: 'academic_group',     label: __( 'Academic Group', 'codeclove-school-management' )     },
    { key: 'subject',            label: __( 'Subject', 'codeclove-school-management' )            },
    { key: 'assessment',         label: __( 'Assessment', 'codeclove-school-management' )         },
    { key: 'student',            label: __( 'Student', 'codeclove-school-management' )            },
    { key: 'staff_member',       label: __( 'Staff Member', 'codeclove-school-management' )       },
    { key: 'guardian',              label: __( 'Guardian', 'codeclove-school-management' )              },
    { key: 'admission_application', label: __( 'Admission Application', 'codeclove-school-management' ) },
    { key: 'staff_application',     label: __( 'Staff Application', 'codeclove-school-management' )     },
    { key: 'fee_type',              label: __( 'Fee Type', 'codeclove-school-management' )              },
    { key: 'invoice',               label: __( 'Invoice', 'codeclove-school-management' )               },
    { key: 'payment',               label: __( 'Payment', 'codeclove-school-management' )               },
    { key: 'attendance_record',     label: __( 'Attendance Record', 'codeclove-school-management' )     },
  ], [])

  const displayActiveName = useMemo(() => {
    if (!activePresetName && !activePresetCode) return __( 'None Selected', 'codeclove-school-management' )
    if (activePresetName === 'India' || activePresetName === 'IN' || activePresetCode === 'IN') return __( 'Class & Section (Standard)', 'codeclove-school-management' )
    if (activePresetName === 'United States' || activePresetName === 'US' || activePresetCode === 'US') return __( 'Grade & Section (K-12)', 'codeclove-school-management' )
    if (activePresetName === 'United Kingdom' || activePresetName === 'GB' || activePresetCode === 'GB') return __( 'Year & Form (British / Commonwealth)', 'codeclove-school-management' )
    return activePresetName || __( 'None Selected', 'codeclove-school-management' )
  }, [activePresetName, activePresetCode])

  const presetMetadata = useMemo<
    Record<
      string,
      {
        icon: LucideIcon
        iconBg: string
        iconColor: string
        title: string
        subtitle: string
        cycle: string
        units: string
      }
    >
  >(() => ({
    US: {
      icon: GraduationCap,
      iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      title: __( 'Grade & Section (K-12)', 'codeclove-school-management' ),
      subtitle: __( 'Grade & Section structure with GPA / Letter Grade system', 'codeclove-school-management' ),
      cycle: __( 'Aug – Jun', 'codeclove-school-management' ),
      units: __( 'Grades 1–12 • Homerooms', 'codeclove-school-management' ),
    },
    IN: {
      icon: School,
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: __( 'Class & Section (Standard)', 'codeclove-school-management' ),
      subtitle: __( 'Class & Section structure with Marks & Percentage grading', 'codeclove-school-management' ),
      cycle: __( 'Apr – Mar', 'codeclove-school-management' ),
      units: __( 'Classes 1–12 • Sections A–D', 'codeclove-school-management' ),
    },
    GB: {
      icon: Landmark,
      iconBg: 'bg-purple-500/10 dark:bg-purple-500/20',
      iconColor: 'text-purple-600 dark:text-purple-400',
      title: __( 'Year & Form (British / Commonwealth)', 'codeclove-school-management' ),
      subtitle: __( 'Year Group & Form structure with Key Stage assessment levels', 'codeclove-school-management' ),
      cycle: __( 'Sep – Jul', 'codeclove-school-management' ),
      units: __( 'Years 1–13 • Forms A–C', 'codeclove-school-management' ),
    },
  }), [])

  return (
    <div className="space-y-6">
      {/* Cohort & Academic Structure */}
      <FormGroup
        title={__( 'Cohort & Academic Structure', 'codeclove-school-management' )}
        description={__( 'Choose how your institution names student levels and groups. Selecting a structure automatically configures localized terms, grading defaults, and session cycles.', 'codeclove-school-management' )}
        icon={Globe}
        cols={1}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-bg-surface p-3.5 rounded-xl border border-border">
            <div className="flex items-center gap-2.5">
              <Sparkles size={16} className="text-brand" />
              <div>
                <span className="text-xs font-semibold text-text">{__( 'Current Active Structure', 'codeclove-school-management' )}</span>
                <p className="text-2xs text-text-subtle">{__( 'The active academic model driving your platform terminology.', 'codeclove-school-management' )}</p>
              </div>
            </div>
            <Badge variant={isCustomized ? 'warning' : 'default'} className="shrink-0 font-semibold px-3 py-1 text-xs">
              {isCustomized
                ? sprintf( __( '%s (Customized)', 'codeclove-school-management' ), displayActiveName )
                : displayActiveName}
            </Badge>
          </div>

          {/* Visual Preset Cards Grid */}
          <div role="radiogroup" aria-label={__( 'Cohort & Academic Structure', 'codeclove-school-management' )} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {presets.map((p) => {
              const meta = presetMetadata[p.code.toUpperCase()] || {
                icon: Globe,
                iconBg: 'bg-brand/10',
                iconColor: 'text-brand',
                title: p.name,
                subtitle: __( 'Custom regional preset configuration template', 'codeclove-school-management' ),
                cycle: __( 'Annual', 'codeclove-school-management' ),
                units: __( 'Units • Groups', 'codeclove-school-management' ),
              }
              const Icon = meta.icon
              const isSelected = selectedPreset === p.code
              const isActive =
                activePresetCode?.toUpperCase() === p.code ||
                activePresetName === p.name ||
                (p.code === 'IN' && (activePresetName === 'India' || activePresetName === 'Class & Section (Standard)')) ||
                (p.code === 'US' && (activePresetName === 'United States' || activePresetName === 'Grade & Section (K-12)')) ||
                (p.code === 'GB' && (activePresetName === 'United Kingdom' || activePresetName === 'Year & Form (British / Commonwealth)'))

              const handleKeyDown = (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedPreset(p.code)
                }
              }

              return (
                <div
                  key={p.code}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => setSelectedPreset(p.code)}
                  onKeyDown={handleKeyDown}
                  className={cn(
                    "group relative flex flex-col justify-between p-4 rounded-xl border-2 cursor-pointer select-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
                    isSelected
                      ? "border-brand bg-brand-dim/15 shadow-sm"
                      : isActive
                      ? "border-emerald-500/50 bg-emerald-500/5 shadow-2xs"
                      : "border-border bg-bg-surface hover:border-border-strong hover:bg-hover-bg"
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105", meta.iconBg, meta.iconColor)}>
                        <Icon size={18} strokeWidth={2} />
                      </div>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 size={11} className="shrink-0" />
                          {__( 'Active', 'codeclove-school-management' )}
                        </span>
                      ) : isSelected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-brand text-white dark:text-text-inverted shadow-xs">
                          <Check size={11} className="shrink-0" />
                          {__( 'Selected', 'codeclove-school-management' )}
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text tracking-tight group-hover:text-brand transition-colors duration-150">
                        {meta.title}
                      </h4>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">
                        {meta.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/70 flex items-center justify-between text-2xs text-text-subtle font-medium">
                    <span>{meta.units}</span>
                    <span className="text-text-muted font-medium">{meta.cycle}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Action Footer */}
          {selectedPreset && (
            <div className="flex items-center justify-between gap-3 p-3.5 bg-brand-dim rounded-xl border border-brand/20 animate-slide-down">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-brand" />
                <span className="text-xs font-semibold text-brand">
                  {sprintf(
                    __( 'Structure "%s" ready to preview & apply.', 'codeclove-school-management' ),
                    presetMetadata[selectedPreset.toUpperCase()]?.title || presets.find((p) => p.code === selectedPreset)?.name || ''
                  )}
                </span>
              </div>
              <Button type="button" variant="default" size="sm" onClick={onApplyPresetClick} className="gap-1.5 font-semibold text-xs">
                <Globe size={14} />
                {__( 'Preview & Apply Structure', 'codeclove-school-management' )}
              </Button>
            </div>
          )}
        </div>
      </FormGroup>

      {/* Academic Cycle Defaults */}
      <FormGroup
        title={__( 'Academic Cycle Defaults', 'codeclove-school-management' )}
        description={__( 'Defaults used when creating new academic sessions and terms.', 'codeclove-school-management' )}
        icon={BookOpen}
      >
        <FormSelect
          label={__( 'Session Start Month', 'codeclove-school-management' )}
          name="education_system.academic_year_start_month"
          register={register}
          options={months}
        />
        <FormSelect
          label={__( 'Session End Month', 'codeclove-school-management' )}
          name="education_system.academic_year_end_month"
          register={register}
          options={months}
        />
        <FormSelect
          label={__( 'Default Grading Scheme', 'codeclove-school-management' )}
          name="education_system.grading_default"
          register={register}
          options={gradingSchemes}
        />
        <FormSelect
          label={__( 'Default Terms Per Session', 'codeclove-school-management' )}
          name="education_system.default_number_terms"
          register={register}
          options={[
            { value: '1', label: __( '1 Term (Annual)', 'codeclove-school-management' ) },
            { value: '2', label: __( '2 Terms (Semesters)', 'codeclove-school-management' ) },
            { value: '3', label: __( '3 Terms (Trimesters)', 'codeclove-school-management' ) },
            { value: '4', label: __( '4 Terms (Quarters)', 'codeclove-school-management' ) },
            { value: '5', label: __( '5 Terms', 'codeclove-school-management' ) },
            { value: '6', label: __( '6 Terms (Bimesters)', 'codeclove-school-management' ) },
          ]}
        />
        <FormSelect
          label={__( 'Class Seeding Strategy', 'codeclove-school-management' )}
          name="education_system.new_session_classes_creation"
          register={register}
          options={[
            { value: 'clone', label: __( 'Clone from previous session', 'codeclove-school-management' ) },
            { value: 'defaults', label: __( 'Create from settings defaults', 'codeclove-school-management' ) },
          ]}
        />
        <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StringListEditor
            title={__( 'Default Academic Units', 'codeclove-school-management' )}
            name="education_system.default_academic_units"
            control={control}
            placeholder={__( 'e.g. Grade 1', 'codeclove-school-management' )}
            emptyText={__( 'No units defined.', 'codeclove-school-management' )}
          />
          <StringListEditor
            title={__( 'Default Groups Per Unit', 'codeclove-school-management' )}
            name="education_system.default_groups_per_unit"
            control={control}
            placeholder={__( 'e.g. Section A', 'codeclove-school-management' )}
            emptyText={__( 'No groups defined.', 'codeclove-school-management' )}
          />
        </div>
      </FormGroup>

      {/* Evaluation & Grading Scales */}
      <FormGroup
        title={__( 'Evaluation & Grading Scales', 'codeclove-school-management' )}
        description={__( 'Configure institutional attainment intervals, letter grades, and GPA scales applied to examination cycles.', 'codeclove-school-management' )}
        icon={Scale}
      >
        <div className="col-span-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-bg-surface border border-border">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-text">
              {__( 'Institutional Grading Scales', 'codeclove-school-management' )}
            </h4>
            <p className="text-xs text-text-muted">
              {__( 'Manage standard scale intervals (CBSE 8-Point, US 10-Point GPA, UK GCSE 9-1) or create custom institutional grading tiers.', 'codeclove-school-management' )}
            </p>
          </div>
          <a href={`#${ROUTES.EXAM_GRADING}`}>
            <Button type="button" variant="secondary" size="sm" className="gap-1.5 shrink-0">
              <Scale size={14} />
              <span>{__( 'Manage Grading Scales', 'codeclove-school-management' )}</span>
            </Button>
          </a>
        </div>
      </FormGroup>
      {/* Dynamic Terminology Term Map */}
      <FormGroup
        title={__( 'Custom Terminology Overrides', 'codeclove-school-management' )}
        description={__( 'Fine-tune individual singular and plural labels if your school uses specialized custom naming.', 'codeclove-school-management' )}
        icon={Languages}
        cols={1}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
          {termKeys.map(({ key, label }) => (
            <div
              key={key}
              className="border border-border rounded-xl p-3.5 space-y-2 bg-bg-surface shadow-xs hover:border-border-strong transition-colors"
            >
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                {label}
              </p>
              <FormInput
                label={__( 'Singular', 'codeclove-school-management' )}
                name={`labels.${key}.singular` as unknown as Path<CodeCloveSettings>}
                register={register}
                placeholder={label}
              />
              <FormInput
                label={__( 'Plural', 'codeclove-school-management' )}
                name={`labels.${key}.plural` as unknown as Path<CodeCloveSettings>}
                register={register}
                placeholder={`${label}s`}
              />
            </div>
          ))}
        </div>
      </FormGroup>
    </div>
  )
}
