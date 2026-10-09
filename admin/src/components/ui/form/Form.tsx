import * as React from 'react'
import {
  FormProvider,
  type UseFormReturn,
  type FieldValues,
  type SubmitHandler,
  type SubmitErrorHandler,
} from 'react-hook-form'
import { onFormError } from '@/lib/form-errors'
import { cn } from '@/lib/utils'

export interface FormProps<T extends FieldValues>
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'onError'> {
  /** The react-hook-form instance from useForm() */
  form: UseFormReturn<T>
  /** Form submission handler */
  onSubmit: SubmitHandler<T>
  /** Optional invalid submission handler; defaults to onFormError */
  onError?: SubmitErrorHandler<T>
  children: React.ReactNode
  /** Additional CSS class names for the form tag */
  className?: string
}

/**
 * Tier 2 Form wrapper — integrates react-hook-form with CodeClove design system.
 * Wraps children in FormProvider and renders a form element with noValidate.
 */
export function Form<T extends FieldValues>({
  form,
  onSubmit,
  onError = onFormError,
  children,
  className,
  ...props
}: FormProps<T>) {
  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onError)}
        noValidate
        className={cn(className)}
        {...props}
      >
        {children}
      </form>
    </FormProvider>
  )
}
