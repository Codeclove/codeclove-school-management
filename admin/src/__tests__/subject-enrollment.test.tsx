import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import SubjectEnrollmentSection from '../modules/students/components/SubjectEnrollmentSection'
import type { AcademicUnitSubject } from '../api/academics'

describe('SubjectEnrollmentSection Component', () => {
  const mockCoreSubjects: AcademicUnitSubject[] = [
    { id: 1, unit_id: 10, subject_id: 101, subject_name: 'Mathematics', subject_code: 'MATH', subject_type: 'core', is_required: true, sort_order: 1, created_at: '' },
    { id: 2, unit_id: 10, subject_id: 102, subject_name: 'English Language', subject_code: 'ENGL', subject_type: 'core', is_required: true, sort_order: 2, created_at: '' },
    { id: 3, unit_id: 10, subject_id: 103, subject_name: 'General Science', subject_code: 'SCI', subject_type: 'core', is_required: true, sort_order: 3, created_at: '' },
    { id: 4, unit_id: 10, subject_id: 104, subject_name: 'Social Studies', subject_code: 'SOC', subject_type: 'core', is_required: true, sort_order: 4, created_at: '' },
    { id: 5, unit_id: 10, subject_id: 105, subject_name: 'Physics', subject_code: 'PHYS', subject_type: 'core', is_required: true, sort_order: 5, created_at: '' },
    { id: 6, unit_id: 10, subject_id: 106, subject_name: 'Chemistry', subject_code: 'CHEM', subject_type: 'core', is_required: true, sort_order: 6, created_at: '' },
    { id: 7, unit_id: 10, subject_id: 107, subject_name: 'Biology', subject_code: 'BIOL', subject_type: 'core', is_required: true, sort_order: 7, created_at: '' },
    { id: 8, unit_id: 10, subject_id: 108, subject_name: 'Physical Education', subject_code: 'PE', subject_type: 'core', is_required: true, sort_order: 8, created_at: '' },
  ]

  const mockElectiveSubjects: AcademicUnitSubject[] = [
    { id: 9, unit_id: 10, subject_id: 109, subject_name: 'Computer Science', subject_code: 'CS', subject_type: 'elective', is_required: false, sort_order: 9, created_at: '' },
    { id: 10, unit_id: 10, subject_id: 110, subject_name: 'Music', subject_code: 'MUS', subject_type: 'elective', is_required: false, sort_order: 10, created_at: '' },
    { id: 11, unit_id: 10, subject_id: 111, subject_name: 'Art & Craft', subject_code: 'ART', subject_type: 'elective', is_required: false, sort_order: 11, created_at: '' },
  ]

  const allSubjects = [...mockCoreSubjects, ...mockElectiveSubjects]

  it('renders prompt state when activeUnit is not yet assigned', () => {
    const html = renderToString(
      <SubjectEnrollmentSection
        unitSubjects={[]}
        selectedSubjectIds={[]}
        onChange={vi.fn()}
        activeUnit=""
        unitLabelSingular="Class"
        subjectLabelPlural="Subjects"
      />
    )

    expect(html).toContain('Please assign a class in Academic Placement')
    expect(html).not.toContain('Core Curriculum')
  })

  it('renders empty curriculum state when assigned unit has 0 mapped subjects', () => {
    const html = renderToString(
      <SubjectEnrollmentSection
        unitSubjects={[]}
        selectedSubjectIds={[]}
        onChange={vi.fn()}
        activeUnit="10"
        unitLabelSingular="Class"
        subjectLabelPlural="Subjects"
      />
    )

    expect(html).toContain('No active core or elective subjects mapped to this class')
  })

  it('renders core curriculum tier and highlights missing core subjects when under-enrolled', () => {
    const html = renderToString(
      <SubjectEnrollmentSection
        unitSubjects={mockCoreSubjects}
        selectedSubjectIds={[101, 102, 105]}
        onChange={vi.fn()}
        activeUnit="10"
        unitLabelSingular="Class"
        subjectLabelPlural="Subjects"
      />
    )

    expect(html).toContain('Core Curriculum')
    expect(html).toContain('3 of 8 enrolled')
    // Missing core warning banner
    expect(html).toContain('5 mandatory core subject(s) are currently unselected')
    expect(html).toContain('Enroll all core')
  })

  it('renders two-tier layout when both Core and Electives exist', () => {
    const html = renderToString(
      <SubjectEnrollmentSection
        unitSubjects={allSubjects}
        selectedSubjectIds={[101, 102, 103, 104, 105, 106, 107, 108, 109]} // All 8 core + 1 elective (CS)
        onChange={vi.fn()}
        activeUnit="10"
        unitLabelSingular="Class"
        subjectLabelPlural="Subjects"
      />
    )

    // Tier 1: Core
    expect(html).toContain('Core Curriculum')
    expect(html).toContain('8 of 8 enrolled')

    // Tier 2: Electives & Co-Curricular
    expect(html).toContain('Academic Electives &amp; Co-Curricular')
    expect(html).toContain('1 of 3 selected')
    expect(html).toContain('Clear')

    // Action button exists
    expect(html).toContain('Reset to Core')
  })

  it('renders without clutter: no search bar or segmented tabs', () => {
    const html = renderToString(
      <SubjectEnrollmentSection
        unitSubjects={allSubjects}
        selectedSubjectIds={[]}
        onChange={vi.fn()}
        activeUnit="10"
        unitLabelSingular="Class"
        subjectLabelPlural="Subjects"
      />
    )

    expect(html).not.toContain('placeholder="Search')
    expect(html).not.toContain('All (11)')
  })

  it('renders checked states correctly for selected subjects using refined design tokens', () => {
    const html = renderToString(
      <SubjectEnrollmentSection
        unitSubjects={mockCoreSubjects}
        selectedSubjectIds={[101]} // Only Math
        onChange={vi.fn()}
        activeUnit="10"
        unitLabelSingular="Class"
        subjectLabelPlural="Subjects"
      />
    )

    // Option A: Selected card should have refined brand border and elevated surface
    expect(html).toContain('border-brand-border bg-bg-elevated')
    expect(html).toContain('Mathematics')
    expect(html).toContain('MATH')
    expect(html).toContain('Core')
    // Checkbox has active brand styling
    expect(html).toContain('bg-brand border-brand')
  })

  it('does not render duplicate checkmark icon on selected core cards and uses custom SVG', () => {
    const html = renderToString(
      <SubjectEnrollmentSection
        unitSubjects={mockCoreSubjects}
        selectedSubjectIds={[101, 102]}
        onChange={vi.fn()}
        activeUnit="10"
        unitLabelSingular="Class"
        subjectLabelPlural="Subjects"
      />
    )

    // Checkbox input is checked
    expect(html).toContain('checked=""')
    // Custom SVG checkmark path
    expect(html).toContain('d="M1 4l3 3 5-5"')
    // No redundant lucide check icon inside cards
    expect(html).not.toContain('lucide-check')
  })
})
