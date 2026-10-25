import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Checkbox } from '../components/ui/Checkbox'

describe('Checkbox Component (Atom)', () => {
  it('renders standalone accessible checkbox without label wrapper', () => {
    const html = renderToString(
      <Checkbox
        checked={true}
        onChange={vi.fn()}
        aria-label="Toggle setting"
      />
    )

    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked=""')
    expect(html).toContain('aria-label="Toggle setting"')
    expect(html).toContain('bg-brand border-brand')
    expect(html).toContain('d="M1 4l3 3 5-5"') // Checkmark SVG path
  })

  it('renders with label and description when provided', () => {
    const html = renderToString(
      <Checkbox
        id="test-custom-id"
        checked={false}
        onChange={vi.fn()}
        label="Auto-generate Admission ID"
        description="Previews format automatically"
      />
    )

    expect(html).toContain('for="test-custom-id"')
    expect(html).toContain('id="test-custom-id"')
    expect(html).toContain('Auto-generate Admission ID')
    expect(html).toContain('Previews format automatically')
    expect(html).toContain('id="test-custom-id-desc"')
    expect(html).toContain('aria-describedby="test-custom-id-desc"')
  })

  it('renders required asterisk when required={true}', () => {
    const html = renderToString(
      <Checkbox
        id="terms-check"
        checked={false}
        onChange={vi.fn()}
        label="I accept the agreement"
        required
      />
    )

    expect(html).toContain('*')
    expect(html).toContain('aria-required="true"')
  })

  it('renders error state and accessible role alert', () => {
    const html = renderToString(
      <Checkbox
        id="error-check"
        checked={false}
        onChange={vi.fn()}
        label="Subscribe"
        error="This field is required"
      />
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('This field is required')
    expect(html).toContain('border-danger')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="error-check-error"')
  })

  it('renders indeterminate state with horizontal bar', () => {
    const html = renderToString(
      <Checkbox
        checked={false}
        indeterminate={true}
        onChange={vi.fn()}
        aria-label="Select all"
      />
    )

    expect(html).toContain('d="M1 1h8"') // Indeterminate dash SVG path
    expect(html).toContain('bg-brand border-brand')
  })

  it('applies disabled styling and attributes when disabled', () => {
    const html = renderToString(
      <Checkbox
        checked={true}
        disabled={true}
        onChange={vi.fn()}
        label="Disabled option"
      />
    )

    expect(html).toContain('disabled=""')
    expect(html).toContain('cursor-not-allowed')
  })
})
