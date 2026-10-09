import { describe, it, expect, vi } from 'vitest'
import { getFirstFormError, onFormError } from '../lib/form-errors'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

describe('getFirstFormError', () => {
  it('returns null for empty or null inputs', () => {
    expect(getFirstFormError(null)).toBeNull()
    expect(getFirstFormError(undefined)).toBeNull()
    expect(getFirstFormError({})).toBeNull()
  })

  it('extracts flat single-field error message', () => {
    const errors = {
      email: {
        type: 'invalid_string',
        message: 'Please enter a valid email address',
      },
    }
    expect(getFirstFormError(errors)).toBe('Please enter a valid email address')
  })

  it('extracts nested object error message (e.g. metadata or address)', () => {
    const errors = {
      metadata: {
        state_educator_id: {
          type: 'custom',
          message: 'State Educator ID is required',
        },
      },
    }
    expect(getFirstFormError(errors)).toBe('State Educator ID is required')
  })

  it('extracts array index error message (e.g. line items)', () => {
    const errors = {
      items: [
        undefined,
        {
          quantity: {
            type: 'min',
            message: 'Quantity must be at least 1',
          },
        },
      ],
    }
    expect(getFirstFormError(errors)).toBe('Quantity must be at least 1')
  })
})

describe('onFormError', () => {
  it('triggers sonner toast with the extracted leaf message', () => {
    const errors = {
      first_name: {
        message: 'First name must be at least 2 characters',
      },
    }
    onFormError(errors)
    expect(toast.error).toHaveBeenCalledWith('First name must be at least 2 characters')
  })

  it('triggers sonner toast with fallback text if error has no message', () => {
    onFormError({})
    expect(toast.error).toHaveBeenCalledWith('Please check the form for errors.')
  })
})
