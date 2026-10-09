import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { useForm } from 'react-hook-form'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Form,
  FormInput,
  FormSelect,
  FormDatePicker,
  FormTextarea,
  FormCheckbox,
} from '../components/ui/form'

describe('Tier 2 Form Suite', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  describe('Form & FormInput', () => {
    function TestForm() {
      const form = useForm({
        defaultValues: {
          username: 'johndoe',
          email: '',
        },
      })

      return (
        <Form form={form} onSubmit={vi.fn()} className="test-form-class">
          <FormInput
            name="username"
            label="Username"
            required
            hint="Enter your unique handle"
          />
          <FormInput
            name="email"
            label="Email Address"
            type="email"
            error="Invalid email address"
          />
        </Form>
      )
    }

    it('renders form with noValidate and child FormInputs with accessibility attributes', () => {
      const html = renderToString(<TestForm />)

      // Form tag
      expect(html).toContain('novalidate=""')
      expect(html).toContain('test-form-class')

      // FormInput - username
      expect(html).toContain('for="form-input-username"')
      expect(html).toContain('id="form-input-username"')
      expect(html).toContain('Username')
      expect(html).toContain('*') // required indicator
      expect(html).toContain('id="form-input-username-hint"')
      expect(html).toContain('Enter your unique handle')
      expect(html).toContain('aria-describedby="form-input-username-hint"')

      // FormInput - email with error
      expect(html).toContain('id="form-input-email-error"')
      expect(html).toContain('role="alert"')
      expect(html).toContain('Invalid email address')
      expect(html).toContain('aria-invalid="true"')
      expect(html).toContain('aria-describedby="form-input-email-error"')
    })
  })

  describe('FormSelect', () => {
    function TestSelectForm() {
      const form = useForm({
        defaultValues: {
          role: 'teacher',
        },
      })

      return (
        <Form form={form} onSubmit={vi.fn()}>
          <FormSelect
            name="role"
            label="Role"
            required
            hint="Select your academic role"
            options={[
              { value: 'admin', label: 'Administrator' },
              { value: 'teacher', label: 'Teacher' },
            ]}
          />
        </Form>
      )
    }

    it('renders FormSelect with label, asterisk, and Radix trigger linkages', () => {
      const html = renderToString(<TestSelectForm />)

      expect(html).toContain('for="form-select-role"')
      expect(html).toContain('Role')
      expect(html).toContain('*')
      expect(html).toContain('id="form-select-role-hint"')
      expect(html).toContain('Select your academic role')
    })
  })

  describe('FormDatePicker', () => {
    function TestDatePickerForm() {
      const form = useForm({
        defaultValues: {
          admissionDate: '2026-10-07',
        },
      })

      return (
        <QueryClientProvider client={queryClient}>
          <Form form={form} onSubmit={vi.fn()}>
            <FormDatePicker
              name="admissionDate"
              label="Admission Date"
              required
              hint="Date the student joined"
            />
          </Form>
        </QueryClientProvider>
      )
    }

    it('renders FormDatePicker with label and correct date linkages', () => {
      const html = renderToString(<TestDatePickerForm />)

      expect(html).toContain('for="form-datepicker-admissionDate"')
      expect(html).toContain('Admission Date')
      expect(html).toContain('*')
      expect(html).toContain('id="form-datepicker-admissionDate-hint"')
      expect(html).toContain('Date the student joined')
    })
  })

  describe('FormTextarea', () => {
    function TestTextareaForm() {
      const form = useForm({
        defaultValues: {
          bio: 'Experienced educator with 10 years experience.',
        },
      })

      return (
        <Form form={form} onSubmit={vi.fn()}>
          <FormTextarea
            name="bio"
            label="Biography"
            maxLength={200}
            showCharCount
            hint="Keep it brief"
          />
        </Form>
      )
    }

    it('renders FormTextarea with character count and hint', () => {
      const html = renderToString(<TestTextareaForm />)

      expect(html).toContain('for="form-textarea-bio"')
      expect(html).toContain('Biography')
      expect(html).toContain('Keep it brief')
      expect(html).toContain('tabular-nums')
      expect(html).toContain('46')
      expect(html).toContain('200')
    })
  })

  describe('FormCheckbox', () => {
    function TestCheckboxForm() {
      const form = useForm({
        defaultValues: {
          agreeTerms: false,
        },
      })

      return (
        <Form form={form} onSubmit={vi.fn()}>
          <FormCheckbox
            name="agreeTerms"
            label="I accept the terms and conditions"
            description="By checking this, you accept our privacy policy."
            required
          />
        </Form>
      )
    }

    it('renders FormCheckbox with label, description, and accessible linkages', () => {
      const html = renderToString(<TestCheckboxForm />)

      expect(html).toContain('for="form-checkbox-agreeTerms"')
      expect(html).toContain('id="form-checkbox-agreeTerms"')
      expect(html).toContain('type="checkbox"')
      expect(html).toContain('I accept the terms and conditions')
      expect(html).toContain('*')
      expect(html).toContain('id="form-checkbox-agreeTerms-desc"')
      expect(html).toContain('By checking this, you accept our privacy policy.')
      expect(html).toContain('aria-describedby="form-checkbox-agreeTerms-desc"')
    })
  })
})
