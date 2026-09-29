import { z } from 'zod'

export const studentSchema = z.object({
  first_name:          z.string().min(2, 'First name must be at least 2 characters'),
  middle_name:         z.string().optional(),
  last_name:           z.string().min(2, 'Last name must be at least 2 characters'),
  date_of_birth:       z.string().min(1, 'Date of birth is required'),
  gender:              z.preprocess((val) => typeof val === 'string' ? val.toLowerCase().trim().replace(/[-\s]+/g, '_') : val, z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say', 'other'])),
  academic_session_id: z.string().min(1, 'Session is required'),
  academic_unit_id:    z.string().min(1, 'Class level is required'),
  academic_group_id:   z.string().optional(),
  
  // Student academic fields
  admission_date:      z.string().min(1, 'Admission date is required'),
  graduation_year:     z.string().optional(),
  subject_ids:         z.array(z.number()).default([]),

  // Editable Admission ID
  admission_number:    z.string().optional(),
  auto_generate_admission: z.boolean().default(true),

  // Address Information
  address:             z.string().optional(),
  city:                z.string().optional(),
  state:               z.string().optional(),
  postal_code:         z.string().optional(),
  country:             z.string().optional(),

  // Father details
  father_first_name:   z.string().optional(),
  father_last_name:    z.string().optional(),
  father_email:        z.string().optional(),
  father_phone:        z.string().optional(),
  father_occupation:   z.string().optional(),

  // Mother details
  mother_first_name:   z.string().optional(),
  mother_last_name:    z.string().optional(),
  mother_email:        z.string().optional(),
  mother_phone:        z.string().optional(),
  mother_occupation:   z.string().optional(),

  // Legal Guardian / Secondary Contact details
  link_existing_guardian: z.boolean().default(false),
  guardian_id:         z.string().optional(),
  guardian_first_name: z.string().optional(),
  guardian_last_name:  z.string().optional(),
  guardian_email:      z.string().optional(),
  guardian_phone:      z.string().optional(),
  relationship:        z.string().default('guardian'),

  photo_id:            z.number().nullable().optional(),
  status:              z.enum(['active', 'inactive', 'graduated', 'withdrawn']).default('active'),
}).superRefine((data, ctx) => {
  const hasFather = !!data.father_first_name
  const hasMother = !!data.mother_first_name
  const hasGuardian = data.link_existing_guardian 
    ? !!data.guardian_id 
    : (!!data.guardian_first_name && !!data.guardian_last_name)

  if (!hasFather && !hasMother && !hasGuardian) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['father_first_name'],
      message: 'At least Father, Mother, or Legal Guardian details must be provided',
    })
  }

  if (data.father_first_name) {
    if (!data.father_last_name || data.father_last_name.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['father_last_name'],
        message: 'Last name must be at least 2 characters',
      })
    }
    if (data.father_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.father_email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['father_email'],
        message: 'Invalid email address',
      })
    }
  }

  if (data.mother_first_name) {
    if (!data.mother_last_name || data.mother_last_name.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mother_last_name'],
        message: 'Last name must be at least 2 characters',
      })
    }
    if (data.mother_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.mother_email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mother_email'],
        message: 'Invalid email address',
      })
    }
  }

  if (data.link_existing_guardian) {
    if (!data.guardian_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guardian_id'],
        message: 'Please select an existing guardian',
      })
    }
  } else {
    if (data.guardian_first_name || data.guardian_last_name || data.guardian_email || data.guardian_phone) {
      if (!data.guardian_first_name || data.guardian_first_name.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardian_first_name'],
          message: 'First name must be at least 2 characters',
        })
      }
      if (!data.guardian_last_name || data.guardian_last_name.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardian_last_name'],
          message: 'Last name must be at least 2 characters',
        })
      }
      if (data.guardian_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.guardian_email)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardian_email'],
          message: 'Invalid email address',
        })
      }
      if (data.guardian_phone && data.guardian_phone.length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardian_phone'],
          message: 'Phone must be at least 6 characters',
        })
      }
    }
  }

  if (!data.auto_generate_admission && (!data.admission_number || data.admission_number.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['admission_number'],
      message: 'Admission ID is required when manual override is active',
    })
  }
})

export type StudentFormData = z.infer<typeof studentSchema>
export type StudentFormValues = StudentFormData

export const editAdmissionSchema = z.object({
  student_first_name:       z.string().min(2, 'First name must be at least 2 characters'),
  student_middle_name:      z.string().optional(),
  student_last_name:        z.string().min(2, 'Last name must be at least 2 characters'),
  student_date_of_birth:    z.string().optional(),
  student_gender:           z.string().optional(),
  blood_group:              z.string().optional(),
  nationality:              z.string().optional(),

  academic_session_id:      z.string().min(1, 'Session is required'),
  academic_unit_id:         z.string().min(1, 'Class level is required'),
  previous_school_name:    z.string().optional(),
  previous_grade_completed: z.string().optional(),

  father_name:              z.string().optional(),
  father_phone:             z.string().optional(),
  father_email:             z.string().optional(),
  father_occupation:        z.string().optional(),

  mother_name:              z.string().optional(),
  mother_phone:             z.string().optional(),
  mother_email:             z.string().optional(),
  mother_occupation:        z.string().optional(),

  guardian_other_name:         z.string().optional(),
  guardian_other_relationship: z.string().optional(),
  guardian_other_phone:        z.string().optional(),
  guardian_other_email:        z.string().optional(),

  primary_communication:    z.string().optional(),

  street_address:           z.string().optional(),
  city:                     z.string().optional(),
  state:                    z.string().optional(),
  zip:                      z.string().optional(),
  country:                  z.string().optional(),
  remarks:                  z.string().optional(),

  student_photo_id:         z.number().nullable().optional(),
})

export type EditAdmissionFormData = z.infer<typeof editAdmissionSchema>
export type EditAdmissionFormValues = EditAdmissionFormData
