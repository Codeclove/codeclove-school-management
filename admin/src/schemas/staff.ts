import { z } from 'zod'

export const staffSchema = z.object({
  staff_number: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  first_name: z.string().min(2, 'First name must be at least 2 characters'),
  middle_name: z.string().optional().nullable(),
  last_name: z.string().min(2, 'Last name must be at least 2 characters'),
  preferred_name: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  gender: z.preprocess((v) => (typeof v === 'string' ? v.toLowerCase().trim() || undefined : v ?? undefined), z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say', 'other']).optional().nullable()),
  email: z.string().trim().email('Please enter a valid email address'),
  phone: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  staff_category: z.string().optional().nullable(),
  employment_type: z.string().optional().nullable(),
  joined_on: z.string().optional().nullable(),
  status: z.preprocess((val) => (typeof val === 'string' ? val.toLowerCase().trim() : val), z.enum(['active', 'inactive', 'suspended'])),
  photo_id: z.union([z.number(), z.string()]).nullable().optional(),
  role_id: z.union([z.string(), z.number()]).optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_relationship: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  highest_qualification: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  metadata: z.preprocess((v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}), z.record(z.unknown()).optional().nullable()),
  user_id: z.number().nullable().optional(),
  create_user: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.user_id) {
    if (data.password && data.password.length > 0 && data.password.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password must be at least 6 characters',
        path: ['password'],
      })
    }
  } else if (data.create_user) {
    if (!data.username || data.username.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Username must be at least 3 characters',
        path: ['username'],
      })
    }
    if (!data.password || data.password.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password must be at least 6 characters',
        path: ['password'],
      })
    }
  }
})

export type StaffFormData = z.infer<typeof staffSchema>
export type StaffFormValues = StaffFormData
