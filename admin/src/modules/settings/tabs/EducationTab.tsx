/** Tab: Education — settings section for curriculum presets, academic cycle, and terminology */

import { useMemo } from 'react'
import type { UseFormRegister, UseFormWatch, Control, Path } from 'react-hook-form'
import type { CodeCloveSettings } from '@/api/settings'
import { FormGroup, FormInput, FormSelect, StringListEditor } from '../components/SettingsFormPrimitives'
import { Badge, Button } from '@/components/ui'
import { BookOpen, Globe, Languages, Check, Sparkles } from 'lucide-react'
import { __, sprintf } from '@/lib/i18n'

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

  const presetMetadata = useMemo<Record<string, { flag: string; country: string; subtitle: string; features: string }>>(() => ({
    IN: {
      flag: '🇮🇳',
      country: __( 'India (CBSE / ICSE / State)', 'codeclove-school-management' ),
      subtitle: __( 'Class & Section structure with Marks & Percentage grading', 'codeclove-school-management' ),
      features: __( 'Cycle: Apr – Mar • Units: Class 1-12 • Groups: Section A-D', 'codeclove-school-management' ),
    },
    US: {
      flag: '🇺🇸',
      country: __( 'United States (K-12)', 'codeclove-school-management' ),
      subtitle: __( 'Grade & Section structure with Letter Grade & GPA system', 'codeclove-school-management' ),
      features: __( 'Cycle: Aug – Jun • Units: Grade 1-12 • Groups: Period / Section', 'codeclove-school-management' ),
    },
    GB: {
      flag: '🇬🇧',
      country: __( 'United Kingdom (UK National Curriculum)', 'codeclove-school-management' ),
      subtitle: __( 'Year Group & Form structure with Key Stage assessment levels', 'codeclove-school-management' ),
      features: __( 'Cycle: Sep – Jul • Units: Year 1-13 • Groups: Form A-C', 'codeclove-school-management' ),
    },
  }), [])

  return (
    <div className="space-y-6">
      {/* Country / Curriculum Preset */}
      <FormGroup
        title={__( 'Country & Curriculum Presets', 'codeclove-school-management' )}
        description={__( 'Select a regional curriculum preset to automatically configure localized academic terms, grading systems, and session cycles.', 'codeclove-school-management' )}
        icon={Globe}
        cols={1}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-bg-surface p-3.5 rounded-xl border border-border">
            <div className="flex items-center gap-2.5">
              <Sparkles size={16} className="text-brand" />
              <div>
                <span className="text-xs font-semibold text-text">{__( 'Current Active System', 'codeclove-school-management' )}</span>
                <p className="text-2xs text-text-subtle">{__( 'The active localized configuration driving your platform.', 'codeclove-school-management' )}</p>
              </div>
            </div>
            <Badge variant={isCustomized ? 'warning' : 'default'} className="shrink-0 font-semibold px-3 py-1 text-xs">
              {activePresetName
                ? isCustomized
                  ? sprintf( __( '%s (Customized)', 'codeclove-school-management' ), activePresetName )
                  : activePresetName
                : __( 'None Selected', 'codeclove-school-management' )}
            </Badge>
          </div>

          {/* Visual Preset Cards Grid */}
          <div role="radiogroup" aria-label={__( 'Country & Curriculum Presets', 'codeclove-school-management' )} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {presets.map((p) => {
              const meta = presetMetadata[p.code.toUpperCase()] || {
                flag: '🌐',
                country: p.name,
                subtitle: __( 'Custom regional preset configuration template', 'codeclove-school-management' ),
                features: __( 'Standard academic cycle & term structure', 'codeclove-school-management' ),
              }
              const isSelected = selectedPreset === p.code
              const isActive = activePresetName?.toLowerCase().includes(p.code.toLowerCase()) || activePresetName === p.name

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
                  className={`relative flex flex-col justify-between p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand ${
                    isSelected
                      ? 'border-brand bg-brand-dim/15 shadow-md shadow-brand/10'
                      : isActive
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-border bg-bg-surface hover:border-border-strong hover:bg-hover-bg'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xl leading-none">{meta.flag}</span>
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          {__( 'Active', 'codeclove-school-management' )}
                        </span>
                      ) : isSelected ? (
                        <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-brand text-white dark:text-text-inverted shadow-xs">
                          {__( 'Selected', 'codeclove-school-management' )}
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text leading-tight">{meta.country}</h4>
                      <p className="text-3xs text-text-subtle mt-1 leading-relaxed">{meta.subtitle}</p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border-subtle flex items-center justify-between text-3xs text-text-muted">
                    <span className="font-mono">{meta.features}</span>
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
                    __( 'Preset "%s" ready for preview & apply.', 'codeclove-school-management' ),
                    presets.find((p) => p.code === selectedPreset)?.name ?? ''
                  )}
                </span>
              </div>
              <Button type="button" variant="default" size="sm" onClick={onApplyPresetClick} className="gap-1.5 font-semibold text-xs animate-glow">
                <Globe size={14} />
                {__( 'Preview & Apply Preset', 'codeclove-school-management' )}
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

      {/* Dynamic Terminology Term Map */}
      <FormGroup
        title={__( 'Dynamic Terminology', 'codeclove-school-management' )}
        description={__( 'Customise the singular and plural labels used throughout the platform.', 'codeclove-school-management' )}
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
