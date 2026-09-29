import { z } from 'zod'

export const sessionSchema = z.object({
  name:       z.string().min(2, 'Name must be at least 2 characters'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date:   z.string().min(1, 'End date is required'),
  status:     z.enum(['draft', 'active', 'archived']),
}).refine((d) => d.end_date > d.start_date, {
  message: 'End date must be after start date',
  path: ['end_date'],
})

export type SessionFormData = z.infer<typeof sessionSchema>
export type SessionFormValues = SessionFormData

export const unitSchema = z.object({
  name:   z.string().min(2, 'Name must be at least 2 characters'),
  code:   z.string().optional(),
  order:  z.coerce.number().min(0, 'Order must be a positive number'),
  status: z.enum(['active', 'inactive', 'archived']),
})

export type UnitFormData = z.infer<typeof unitSchema>
export type UnitFormValues = UnitFormData

export const groupSchema = z.object({
  unit_id:  z.coerce.number().min(1, 'Please select a class level'),
  name:     z.string().min(2, 'Name must be at least 2 characters'),
  code:     z.string().optional(),
  capacity: z.coerce.number().min(1, 'Capacity must be at least 1').optional(),
  status:   z.enum(['active', 'inactive', 'archived']).optional(),
})

export type GroupFormData = z.infer<typeof groupSchema>
export type GroupFormValues = GroupFormData

export const subjectSchema = z.object({
  name:   z.string().min(2, 'Name must be at least 2 characters'),
  code:   z.string().optional(),
  type:   z.enum(['core', 'elective', 'activity', 'other']),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
})

export type SubjectFormData = z.infer<typeof subjectSchema>
export type SubjectFormValues = SubjectFormData
