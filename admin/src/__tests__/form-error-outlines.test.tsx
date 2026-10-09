import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FormField } from '../components/ui/FormField'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'

describe('Form Error Outlines & Accessibility Consistency', () => {
  it('renders Input with red border-danger when wrapped in FormField with error', () => {
    const html = renderToStaticMarkup(
      <FormField label="Announcement Title" error="Title is required.">
        <Input placeholder="Enter title" />
      </FormField>
    )

    expect(html).toContain('border-danger')
    expect(html).toContain('focus:ring-danger')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('Title is required.')
  })

  it('renders Textarea with red border-danger when wrapped in FormField with error', () => {
    const html = renderToStaticMarkup(
      <FormField label="Notice Content" error="Content description is required.">
        <Textarea placeholder="Enter content" />
      </FormField>
    )

    expect(html).toContain('border-danger')
    expect(html).toContain('focus:ring-danger')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('Content description is required.')
  })

  it('renders Select trigger with red border-danger when wrapped in FormField with error', () => {
    const html = renderToStaticMarkup(
      <FormField label="Category" error="Category is required.">
        <Select options={[{ value: 'news', label: 'News' }]} />
      </FormField>
    )

    expect(html).toContain('border-danger')
    expect(html).toContain('focus:ring-danger')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('Category is required.')
  })

  it('renders standalone Input with border-danger when aria-invalid is true', () => {
    const html = renderToStaticMarkup(
      <Input placeholder="Standalone" aria-invalid={true} />
    )

    expect(html).toContain('border-danger')
    expect(html).toContain('focus:ring-danger')
  })

  it('renders standalone Textarea with border-danger when aria-invalid is true', () => {
    const html = renderToStaticMarkup(
      <Textarea placeholder="Standalone" aria-invalid={true} />
    )

    expect(html).toContain('border-danger')
    expect(html).toContain('focus:ring-danger')
  })

  it('renders normal border-border and no danger classes when no error is present', () => {
    const html = renderToStaticMarkup(
      <FormField label="Announcement Title">
        <Input placeholder="Enter title" />
      </FormField>
    )

    expect(html).toContain('border-border')
    expect(html).not.toContain('border-danger')
    expect(html).not.toContain('focus:ring-danger')
    expect(html).not.toContain('aria-invalid="true"')
  })
})
