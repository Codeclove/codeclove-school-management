import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { FormActionFooter } from '../components/ui/FormActionFooter'
import { Award } from 'lucide-react'

describe('FormActionFooter Component', () => {
  it('renders title, description, and action buttons', () => {
    const html = renderToString(
      <FormActionFooter
        title="Confirm Student Admission"
        description="Review placement and details before confirming student admission."
        submitText="Confirm Admission"
        cancelText="Cancel"
        onCancel={vi.fn()}
      />
    )

    expect(html).toContain('Confirm Student Admission')
    expect(html).toContain('Review placement and details before confirming student admission.')
    expect(html).toContain('Confirm Admission')
    expect(html).toContain('Cancel')
    expect(html).toContain('rounded-xl')
    expect(html).toContain('border-border')
  })

  it('renders without cancel button when onCancel is omitted', () => {
    const html = renderToString(
      <FormActionFooter
        title="Save Changes"
        submitText="Save"
      />
    )

    expect(html).toContain('Save Changes')
    expect(html).toContain('Save')
    expect(html).not.toContain('Cancel')
  })

  it('renders submitting state with spinner and pending text', () => {
    const html = renderToString(
      <FormActionFooter
        title="Confirm Student Admission"
        submitText="Confirm Admission"
        submittingText="Admitting..."
        isPending={true}
        onCancel={vi.fn()}
      />
    )

    expect(html).toContain('Admitting...')
    expect(html).toContain('animate-spin')
    expect(html).toContain('disabled')
  })

  it('passes formId to submit button when detached form submission is needed', () => {
    const html = renderToString(
      <FormActionFooter
        title="Save Changes"
        submitText="Save"
        formId="custom-form-id"
      />
    )

    expect(html).toContain('form="custom-form-id"')
  })

  it('supports custom icons and custom classes', () => {
    const html = renderToString(
      <FormActionFooter
        icon={Award}
        title="Custom Header"
        submitText="Submit"
        className="custom-footer-class"
      />
    )

    expect(html).toContain('custom-footer-class')
    expect(html).toContain('Custom Header')
  })
})
