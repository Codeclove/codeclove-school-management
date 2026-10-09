import { toast } from 'sonner'
import { __ } from '@/lib/i18n'

/**
 * Recursively locates the first error message in a React Hook Form error tree.
 * // ponytail: drop path string tracking, caller only consumes the message
 */
export function getFirstFormError(errors: unknown): string | null {
  if (!errors || typeof errors !== 'object') return null

  if ('message' in errors && typeof errors.message === 'string' && errors.message.trim()) {
    return errors.message
  }

  for (const [key, value] of Object.entries(errors)) {
    if (key === 'ref') continue
    const found = getFirstFormError(value)
    if (found) return found
  }

  return null
}

/**
 * Standard onInvalid callback for React Hook Form handleSubmit.
 * Usage: handleSubmit(onSubmit, onFormError)
 */
export function onFormError(errors: unknown): void {
  toast.error(getFirstFormError(errors) || __( 'Please check the form for errors.', 'codeclove-school-management' ))
}
