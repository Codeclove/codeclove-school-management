import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { useForm } from 'react-hook-form'
import { PrintLetterhead } from '../components/ui/PrintLetterhead'
import { EducationTab } from '../modules/settings/tabs/EducationTab'
import type { CodeCloveSettings } from '../api/settings'

describe('Settings & Letterhead UI Components', () => {
  describe('PrintLetterhead', () => {
    it('renders school name correctly without code badge when school.code is absent', () => {
      const html = renderToString(
        <PrintLetterhead
          school={{
            name: 'Oakridge International Academy',
            address: '100 Academic Way, Boston, MA',
          }}
          documentType="Official Transcript"
        />
      )

      expect(html).toContain('Oakridge International Academy')
      expect(html).toContain('Official Transcript')
      expect(html).not.toContain('text-3xs font-mono font-semibold')
    })

    it('renders school.code badge next to the school name when provided', () => {
      const html = renderToString(
        <PrintLetterhead
          school={{
            name: 'Oakridge International Academy',
            code: 'SCH-MA-8842',
            address: '100 Academic Way, Boston, MA',
          }}
          documentType="Official Transcript"
        />
      )

      expect(html).toContain('Oakridge International Academy')
      expect(html).toContain('SCH-MA-8842')
      expect(html).toContain('border-gray-200')
    })

    it('does not render code badge when school.code is empty string', () => {
      const html = renderToString(
        <PrintLetterhead
          school={{
            name: 'Oakridge International Academy',
            code: '',
            address: '100 Academic Way, Boston, MA',
          }}
          documentType="Official Transcript"
        />
      )

      expect(html).toContain('Oakridge International Academy')
      expect(html).not.toContain('text-3xs font-mono font-semibold')
    })
  })

  describe('EducationTab Form Elements', () => {
    function TestForm() {
      const { register, control, watch } = useForm<CodeCloveSettings>({
        defaultValues: {
          education_system: {
            preset: 'IN',
            preset_name: 'India (CBSE / ICSE / State)',
            preset_version: '1.0.0',
            customized: false,
            academic_year_start_month: 4,
            academic_year_end_month: 3,
            default_number_terms: 3,
            grading_default: 'marks_percentage',
            default_academic_units: ['Class 1', 'Class 2'],
            default_groups_per_unit: ['A', 'B'],
            new_session_classes_creation: 'clone',
          },
          labels: {
            fee_type: { singular: 'Fee Type', plural: 'Fee Types' },
            admission_application: { singular: 'Admission Application', plural: 'Admission Applications' },
            staff_application: { singular: 'Staff Application', plural: 'Staff Applications' },
          } as any,
        },
      })

      return (
        <EducationTab
          register={register}
          control={control}
          watch={watch}
          presets={[{ code: 'IN', name: 'India' }]}
          selectedPreset="IN"
          setSelectedPreset={vi.fn()}
          onApplyPresetClick={vi.fn()}
        />
      )
    }

    it('renders the default_number_terms dropdown selector with all term options', () => {
      const html = renderToString(<TestForm />)

      expect(html).toContain('Default Terms Per Session')
      expect(html).toContain('education_system.default_number_terms')
      expect(html).toContain('1 Term (Annual)')
      expect(html).toContain('2 Terms (Semesters)')
      expect(html).toContain('3 Terms (Trimesters)')
      expect(html).toContain('4 Terms (Quarters)')
      expect(html).toContain('6 Terms (Bimesters)')
    })

    it('renders terminology configuration fields for fee_type, admission_application, and staff_application', () => {
      const html = renderToString(<TestForm />)

      // Fee Type
      expect(html).toContain('labels.fee_type.singular')
      expect(html).toContain('labels.fee_type.plural')

      // Admission Application
      expect(html).toContain('labels.admission_application.singular')
      expect(html).toContain('labels.admission_application.plural')

      // Staff Application
      expect(html).toContain('labels.staff_application.singular')
      expect(html).toContain('labels.staff_application.plural')
    })
  })
})
