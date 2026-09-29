import { describe, it, expect } from 'vitest'
import { staffSchema } from '../../schemas/staff'
import { studentSchema, editAdmissionSchema } from '../../schemas/students'
import { groupSchema, sessionSchema, subjectSchema, unitSchema } from '../../schemas/academics'
import { invoiceHeaderSchema, feeTypeSchema, paymentSchema } from '../../schemas/finance'

describe('Zod Schema Validations', () => {
  describe('staffSchema', () => {
    it('passes validation with valid staff payload', () => {
      const valid = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        status: 'active',
      }
      const parsed = staffSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('fails validation when email is invalid or first_name is short', () => {
      const invalid = {
        first_name: 'J',
        last_name: 'Doe',
        email: 'not-an-email',
        status: 'active',
      }
      const parsed = staffSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        const issues = parsed.error.format()
        expect(issues.first_name?._errors[0]).toContain('must be at least 2 characters')
        expect(issues.email?._errors[0]).toContain('valid email address')
      }
    })
  })

  describe('studentSchema', () => {
    it('passes validation with valid student payload', () => {
      const valid = {
        first_name: 'Alice',
        last_name: 'Smith',
        date_of_birth: '2018-05-15',
        gender: 'female',
        academic_session_id: '1',
        academic_unit_id: '2',
        admission_date: '2026-06-01',
        father_first_name: 'Bob',
        father_last_name: 'Jones',
        status: 'active',
      }
      const parsed = studentSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('accepts inclusive gender options and normalizes them', () => {
      const baseStudent = {
        first_name: 'Alex',
        last_name: 'Taylor',
        date_of_birth: '2017-03-10',
        academic_session_id: '1',
        academic_unit_id: '2',
        admission_date: '2026-06-01',
        father_first_name: 'David',
        father_last_name: 'Taylor',
        status: 'active' as const,
      }
      const cases = [
        ['non_binary', 'non_binary'],
        ['Non-Binary', 'non_binary'],
        ['prefer_not_to_say', 'prefer_not_to_say'],
        ['other', 'other'],
      ] as const

      for (const [gender, expected] of cases) {
        const res = studentSchema.safeParse({ ...baseStudent, gender })
        expect(res.success).toBe(true)
        if (res.success) expect(res.data.gender).toBe(expected)
      }
    })

    it('fails validation when required fields are missing', () => {
      const invalid = {
        first_name: 'A',
        last_name: '',
        gender: 'invalid-gender',
      }
      const parsed = studentSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
    })
  })

  describe('editAdmissionSchema', () => {
    it('passes validation with valid edit admission payload', () => {
      const valid = {
        student_first_name: 'Alice',
        student_last_name: 'Smith',
        academic_session_id: '1',
        academic_unit_id: '2',
      }
      const parsed = editAdmissionSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('fails validation when student_first_name is too short or session is missing', () => {
      const invalid = {
        student_first_name: 'A',
        student_last_name: 'Smith',
        academic_session_id: '',
        academic_unit_id: '',
      }
      const parsed = editAdmissionSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
    })
  })

  describe('groupSchema', () => {
    it('passes validation with valid group payload', () => {
      const valid = {
        unit_id: 1,
        name: 'Section A',
        capacity: 30,
        status: 'active',
      }
      const parsed = groupSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('fails validation with invalid group capacity or unit_id', () => {
      const invalid = {
        unit_id: 0,
        name: 'S',
        capacity: 0,
      }
      const parsed = groupSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
    })
  })

  describe('sessionSchema', () => {
    it('passes validation with valid session payload', () => {
      const valid = {
        name: 'Academic Year 2026-27',
        start_date: '2026-06-01',
        end_date: '2027-05-31',
        status: 'active',
      }
      const parsed = sessionSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('fails when end date is before start date', () => {
      const invalid = {
        name: 'Academic Year 2026-27',
        start_date: '2027-06-01',
        end_date: '2026-05-31',
        status: 'active',
      }
      const parsed = sessionSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
    })
  })

  describe('subjectSchema', () => {
    it('passes validation with valid subject payload', () => {
      const valid = {
        name: 'Mathematics',
        code: 'MATH',
        type: 'core',
        status: 'active',
      }
      const parsed = subjectSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('fails with invalid type', () => {
      const invalid = {
        name: 'Mathematics',
        type: 'unsupported_type',
      }
      const parsed = subjectSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
    })
  })

  describe('unitSchema', () => {
    it('passes validation with valid unit payload', () => {
      const valid = {
        name: 'Grade 1',
        code: 'G1',
        order: 1,
        status: 'active',
      }
      const parsed = unitSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('fails with negative order', () => {
      const invalid = {
        name: 'Grade 1',
        order: -1,
        status: 'active',
      }
      const parsed = unitSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
    })
  })

  describe('invoiceHeaderSchema', () => {
    it('passes validation with valid invoice header', () => {
      const valid = {
        termId: '1',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
        invoiceDiscount: '10.50',
        discountNote: 'Early payment discount',
      }
      const parsed = invoiceHeaderSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('fails when issueDate is missing or discount is negative', () => {
      const invalid = {
        issueDate: '',
        invoiceDiscount: '-5.00',
      }
      const parsed = invoiceHeaderSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
    })
  })

  describe('feeTypeSchema', () => {
    it('passes validation with valid fee type and transforms code to uppercase', () => {
      const valid = {
        name: 'Tuition Fee',
        code: 'tut-01',
        default_amount: '500.00',
        frequency: 'term_wise',
        scope: 'global',
        status: 'active',
      }
      const parsed = feeTypeSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.code).toBe('TUT-01')
      }
    })

    it('fails when name is missing or amount is negative', () => {
      const invalid = {
        name: '',
        default_amount: '-20.00',
      }
      const parsed = feeTypeSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
    })
  })

  describe('paymentSchema', () => {
    it('passes validation with valid payment payload', () => {
      const valid = {
        amount: '150.00',
        paidOn: '2026-09-08',
        method: 'bank_transfer',
        reference: 'TXN-98765',
        note: 'September installment',
      }
      const parsed = paymentSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('fails when amount is zero or negative or not a number', () => {
      expect(paymentSchema.safeParse({ amount: '0', paidOn: '2026-09-08' }).success).toBe(false)
      expect(paymentSchema.safeParse({ amount: '-10', paidOn: '2026-09-08' }).success).toBe(false)
      expect(paymentSchema.safeParse({ amount: 'abc', paidOn: '2026-09-08' }).success).toBe(false)
      expect(paymentSchema.safeParse({ amount: '10', paidOn: '' }).success).toBe(false)
    })
  })
})
