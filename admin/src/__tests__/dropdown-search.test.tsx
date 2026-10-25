import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { useForm } from 'react-hook-form'
import { Select, AUTO_SEARCH_THRESHOLD } from '../components/ui/Select'
import { Combobox } from '../components/ui/Combobox'
import { Form, FormSelect } from '../components/ui/form'

describe('Dropdown Search & Combobox Integration', () => {
  const shortOptions = [
    { value: '1', label: 'Class 1' },
    { value: '2', label: 'Class 2' },
    { value: '3', label: 'Class 3' },
  ]

  const longOptions = [
    { value: '1', label: 'Class 1' },
    { value: '2', label: 'Class 2' },
    { value: '3', label: 'Class 3' },
    { value: '4', label: 'Class 4' },
    { value: '5', label: 'Class 5' },
    { value: '6', label: 'Class 6' },
    { value: '7', label: 'Class 7' },
    { value: '8', label: 'Class 8' },
    { value: '9', label: 'Class 9' },
    { value: '10', label: 'Class 10' },
    { value: '11', label: 'Class 11' },
    { value: '12', label: 'Class 12' },
  ]

  describe('Auto-Search Threshold Behavior', () => {
    it('defaults AUTO_SEARCH_THRESHOLD to 8', () => {
      expect(AUTO_SEARCH_THRESHOLD).toBe(8)
    })

    it('renders standard select when options count is below threshold', () => {
      const html = renderToString(
        <Select
          id="class-select"
          value="2"
          options={shortOptions}
          placeholder="Select Class..."
        />
      )

      // Standard Radix select trigger has aria-autocomplete="none" and does not have the custom combobox listbox linkage
      expect(html).toContain('aria-autocomplete="none"')
      expect(html).not.toContain('aria-controls="class-select-listbox"')
      expect(html).toContain('Class 2')
    })

    it('automatically switches to searchable Combobox when options count meets or exceeds threshold', () => {
      const html = renderToString(
        <Select
          id="class-select"
          value="2"
          options={longOptions}
          placeholder="Select Class..."
        />
      )

      // Combobox trigger links to listbox ID via aria-controls
      expect(html).toContain('aria-controls="class-select-listbox"')
      expect(html).not.toContain('aria-autocomplete="none"')
      expect(html).toContain('Class 2')
    })

    it('suppresses search when searchable={false} even if options count exceeds threshold', () => {
      const html = renderToString(
        <Select
          id="class-select"
          value="2"
          searchable={false}
          options={longOptions}
          placeholder="Select Class..."
        />
      )

      expect(html).toContain('aria-autocomplete="none"')
      expect(html).not.toContain('aria-controls="class-select-listbox"')
      expect(html).toContain('Class 2')
    })

    it('enforces search when searchable={true} even if options count is below threshold', () => {
      const html = renderToString(
        <Select
          id="class-select"
          value="2"
          searchable={true}
          options={shortOptions}
          placeholder="Select Class..."
        />
      )

      expect(html).toContain('aria-controls="class-select-listbox"')
      expect(html).toContain('Class 2')
    })

    it('respects custom autoSearchThreshold', () => {
      const htmlBelow = renderToString(
        <Select
          id="custom-thresh-select"
          value="2"
          autoSearchThreshold={15}
          options={longOptions} // 12 options < 15
        />
      )
      expect(htmlBelow).toContain('aria-autocomplete="none"')
      expect(htmlBelow).not.toContain('aria-controls="custom-thresh-select-listbox"')

      const htmlAbove = renderToString(
        <Select
          id="custom-thresh-select"
          value="2"
          autoSearchThreshold={4}
          options={longOptions} // 12 options >= 4
        />
      )
      expect(htmlAbove).toContain('aria-controls="custom-thresh-select-listbox"')
    })

    it('counts options across groups for autoSearchThreshold calculation', () => {
      const groups = [
        {
          label: 'Primary',
          options: [
            { value: '1', label: 'Class 1' },
            { value: '2', label: 'Class 2' },
            { value: '3', label: 'Class 3' },
            { value: '4', label: 'Class 4' },
          ],
        },
        {
          label: 'Middle',
          options: [
            { value: '5', label: 'Class 5' },
            { value: '6', label: 'Class 6' },
            { value: '7', label: 'Class 7' },
            { value: '8', label: 'Class 8' },
          ],
        },
      ]

      const html = renderToString(
        <Select
          id="grouped-select"
          value="2"
          groups={groups}
        />
      )

      // 4 + 4 = 8 options -> automatically becomes Combobox
      expect(html).toContain('aria-controls="grouped-select-listbox"')
    })
  })

  describe('FormSelect Integration', () => {
    function TestFormSelectWrapper(props: {
      searchable?: boolean
      autoSearchThreshold?: number
      options: typeof shortOptions
    }) {
      const form = useForm({
        defaultValues: { academic_unit_id: '2' },
      })

      return (
        <Form form={form} onSubmit={vi.fn()}>
          <FormSelect
            name="academic_unit_id"
            label="Class Level"
            required
            placeholder="Select class..."
            searchPlaceholder="Search class..."
            emptyText="No classes found."
            {...props}
          />
        </Form>
      )
    }

    it('renders FormSelect with searchable Combobox when explicitly requested', () => {
      const html = renderToString(
        <TestFormSelectWrapper searchable options={shortOptions} />
      )

      expect(html).toContain('for="form-select-academic_unit_id"')
      expect(html).toContain('Class Level')
      expect(html).toContain('aria-controls="form-select-academic_unit_id-listbox"')
      expect(html).toContain('Class 2')
    })

    it('automatically enables search on FormSelect when options exceed threshold', () => {
      const html = renderToString(
        <TestFormSelectWrapper options={longOptions} />
      )

      expect(html).toContain('aria-controls="form-select-academic_unit_id-listbox"')
      expect(html).toContain('Class 2')
    })
  })

  describe('Combobox Features & Prefix Rendering', () => {
    it('renders prefix node inside Combobox trigger when present on selected option', () => {
      const prefixOptions = [
        {
          value: 'in',
          label: 'India Standard (CBSE/ICSE)',
          prefix: <span data-testid="flag-in">🇮🇳</span>,
        },
        {
          value: 'us',
          label: 'United States K-12',
          prefix: <span data-testid="flag-us">🇺🇸</span>,
        },
      ]

      const html = renderToString(
        <Combobox
          id="country-picker"
          value="in"
          options={prefixOptions}
        />
      )

      expect(html).toContain('data-testid="flag-in"')
      expect(html).toContain('India Standard (CBSE/ICSE)')
    })

    it('renders clear button when clearable is true and option is selected', () => {
      const html = renderToString(
        <Combobox
          id="clearable-select"
          value="2"
          clearable={true}
          options={shortOptions}
        />
      )

      expect(html).toContain('aria-label="Clear selection"')
    })

    it('renders error ring and aria-invalid on Combobox trigger when error is true', () => {
      const html = renderToString(
        <Combobox
          id="error-select"
          value=""
          error={true}
          options={shortOptions}
          placeholder="Choose class..."
        />
      )

      expect(html).toContain('border-danger')
      expect(html).toContain('focus:ring-danger')
      expect(html).toContain('aria-invalid="true"')
    })
  })
})
