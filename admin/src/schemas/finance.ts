import { z } from 'zod'

export const invoiceHeaderSchema = z.object({
  termId: z.string().optional().nullable(),
  issueDate: z.string().min(1, 'Issue date is required.'),
  dueDate: z.string().optional().nullable(),
  invoiceDiscount: z.string()
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
      message: 'Discount must be a non-negative number.',
    })
    .default('0'),
  discountNote: z.string().optional().nullable(),
})

export type InvoiceHeaderFormData = z.infer<typeof invoiceHeaderSchema>
export type InvoiceHeaderFormValues = InvoiceHeaderFormData

export const feeTypeSchema = z.object({
  name: z.string().min(1, 'Fee name is required.'),
  code: z.string().optional().nullable().transform(val => val ? val.toUpperCase().trim() : null),
  description: z.string().optional().nullable(),
  default_amount: z.string()
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
      message: 'Amount must be a non-negative number.',
    })
    .default('0.00'),
  frequency: z.enum(['one_time', 'monthly', 'quarterly', 'term_wise', 'annual', 'custom']).default('one_time'),
  scope: z.enum(['global', 'unit_specific']).default('global'),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
})

export type FeeTypeFormData = z.infer<typeof feeTypeSchema>
export type FeeTypeFormValues = FeeTypeFormData

export const paymentSchema = z.object({
  amount: z.string()
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Amount must be greater than zero.',
    }),
  paidOn: z.string().min(1, 'Payment date is required.'),
  method: z.enum(['cash', 'bank_transfer', 'cheque', 'upi', 'card', 'other']).default('cash'),
  reference: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})
export type PaymentFormData = z.infer<typeof paymentSchema>
export type PaymentFormValues = PaymentFormData
