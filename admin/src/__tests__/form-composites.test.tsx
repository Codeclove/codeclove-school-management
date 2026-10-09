import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { useForm } from 'react-hook-form'
import {
  AvatarUpload,
  AddressFields,
  Form,
} from '../components/ui/form'

describe('Form Composites: AvatarUpload & AddressFields', () => {
  describe('AvatarUpload', () => {
    it('renders empty avatar placeholder and label when photoUrl is null or empty', () => {
      const html = renderToString(
        <AvatarUpload
          photoUrl={null}
          onPhotoChange={vi.fn()}
          label="Staff Photo"
        />
      )

      expect(html).toContain('Staff Photo')
      expect(html).toContain('Choose Photo')
      expect(html).toContain('type="file"')
      expect(html).toContain('accept="image/*"')
      // No remove button when empty
      expect(html).not.toContain('Remove')
    })

    it('renders photo preview and remove button when photoUrl is provided', () => {
      const html = renderToString(
        <AvatarUpload
          photoUrl="https://example.com/photo.jpg"
          onPhotoChange={vi.fn()}
          label="Student Photo"
        />
      )

      expect(html).toContain('Student Photo')
      expect(html).toContain('https://example.com/photo.jpg')
      expect(html).toContain('Change Photo')
      expect(html).toContain('Remove')
    })

    it('renders spinner when isUploading is true', () => {
      const html = renderToString(
        <AvatarUpload
          photoUrl="https://example.com/photo.jpg"
          onPhotoChange={vi.fn()}
          isUploading={true}
          label="Staff Photo"
        />
      )

      // Shows spinner
      expect(html).toContain('animate-spin')
      // Inputs and buttons disabled during upload
      expect(html).toContain('disabled=""')
    })

    it('disables interactions when disabled prop is true', () => {
      const html = renderToString(
        <AvatarUpload
          photoUrl="https://example.com/photo.jpg"
          onPhotoChange={vi.fn()}
          disabled={true}
          label="Staff Photo"
        />
      )

      expect(html).toContain('disabled=""')
    })
  })

  describe('AddressFields', () => {
    function StandaloneAddressTest() {
      const form = useForm({
        defaultValues: {
          address: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          postal_code: '62701',
          country: 'United States',
        },
      })

      return (
        <AddressFields
          register={form.register}
          errors={form.formState.errors}
        />
      )
    }

    it('renders default 5 address inputs with standard placeholders and labels', () => {
      const html = renderToString(<StandaloneAddressTest />)

      expect(html).toContain('Street Address')
      expect(html).toContain('City')
      expect(html).toContain('State / Province')
      expect(html).toContain('ZIP / Postal Code')
      expect(html).toContain('Country')
      expect(html).toContain('name="address"')
      expect(html).toContain('name="city"')
      expect(html).toContain('name="state"')
      expect(html).toContain('name="postal_code"')
      expect(html).toContain('name="country"')
    })

    it('renders with custom field names mapping', () => {
      function CustomNamesTest() {
        const form = useForm({
          defaultValues: {
            guardian_street: '',
            guardian_city: '',
            guardian_state: '',
            guardian_zip: '',
            guardian_nation: '',
          },
        })

        return (
          <AddressFields
            register={form.register}
            names={{
              address: 'guardian_street',
              city: 'guardian_city',
              state: 'guardian_state',
              postal_code: 'guardian_zip',
              country: 'guardian_nation',
            }}
          />
        )
      }

      const html = renderToString(<CustomNamesTest />)

      expect(html).toContain('name="guardian_street"')
      expect(html).toContain('name="guardian_city"')
      expect(html).toContain('name="guardian_state"')
      expect(html).toContain('name="guardian_zip"')
      expect(html).toContain('name="guardian_nation"')
    })

    it('renders error messages when errors are provided', () => {
      const errors = {
        address: { message: 'Street address is required', type: 'required' },
        city: { message: 'City is required', type: 'required' },
      }

      const html = renderToString(
        <AddressFields
          errors={errors}
          streetLabel="Residential Street Address"
        />
      )

      expect(html).toContain('Residential Street Address')
      expect(html).toContain('Street address is required')
      expect(html).toContain('City is required')
      expect(html).toContain('aria-invalid="true"')
    })

    it('renders inside FormProvider via Form component', () => {
      function FormContextTest() {
        const form = useForm({
          defaultValues: {
            address: '',
            city: '',
            state: '',
            postal_code: '',
            country: '',
          },
        })

        return (
          <Form form={form} onSubmit={vi.fn()}>
            <AddressFields columns={2} />
          </Form>
        )
      }

      const html = renderToString(<FormContextTest />)

      expect(html).toContain('sm:grid-cols-2')
      expect(html).toContain('name="address"')
      expect(html).toContain('name="city"')
    })
  })
})
