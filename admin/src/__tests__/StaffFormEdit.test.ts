import { describe, it, expect } from 'vitest'
import { staffSchema, type StaffFormValues } from '../schemas/staff'

describe('Staff edit schema validation regression', () => {
  it('validates an existing staff member in edit mode without password', () => {
    const editValues: StaffFormValues = {
      staff_number: 'STF-001',
      title: 'Mr.',
      first_name: 'John',
      middle_name: '',
      last_name: 'Doe',
      preferred_name: '',
      date_of_birth: '1985-05-15',
      gender: 'male',
      email: 'john.doe@example.com',
      phone: '',
      department: 'Science',
      designation: 'Teacher',
      staff_category: 'teaching',
      employment_type: 'full_time',
      joined_on: '2020-01-01',
      status: 'active',
      photo_id: null,
      role_id: '1',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      emergency_contact_name: '',
      emergency_contact_relationship: '',
      emergency_contact_phone: '',
      highest_qualification: '',
      specialization: '',
      metadata: {},
      user_id: 12,
      create_user: false,
      username: 'johndoe',
      password: '',
    }

    const result = staffSchema.safeParse(editValues)
    expect(result.success).toBe(true)
  })

  it('tolerates metadata arriving as array [] from PHP backend', () => {
    const rawValues = {
      staff_number: 'STF-003',
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'alice@example.com',
      status: 'suspended',
      gender: 'Female', // Uppercase should normalize cleanly
      metadata: [], // Array from PHP format_staff_member
      role_id: 2, // Numeric role_id
      photo_id: 15,
    }

    const result = staffSchema.safeParse(rawValues)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.metadata).toEqual({})
      expect(result.data.gender).toBe('female')
      expect(result.data.status).toBe('suspended')
    }
  })

  it('validates a staff member without a linked WP user', () => {
    const editValues: StaffFormValues = {
      staff_number: 'STF-002',
      title: 'Ms.',
      first_name: 'Jane',
      middle_name: '',
      last_name: 'Smith',
      preferred_name: '',
      date_of_birth: '',
      gender: 'female',
      email: 'jane.smith@example.com',
      phone: '',
      department: '',
      designation: 'Accountant',
      staff_category: 'administrative',
      employment_type: 'full_time',
      joined_on: '2021-06-01',
      status: 'active',
      photo_id: null,
      role_id: '2',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      emergency_contact_name: '',
      emergency_contact_relationship: '',
      emergency_contact_phone: '',
      highest_qualification: '',
      specialization: '',
      metadata: {},
      user_id: null,
      create_user: false,
      username: '',
      password: '',
    }

    const result = staffSchema.safeParse(editValues)
    expect(result.success).toBe(true)
  })

  it('rejects update password if less than 6 characters when provided', () => {
    const editValues: StaffFormValues = {
      staff_number: 'STF-001',
      title: 'Mr.',
      first_name: 'John',
      middle_name: '',
      last_name: 'Doe',
      preferred_name: '',
      date_of_birth: '',
      gender: 'male',
      email: 'john.doe@example.com',
      phone: '',
      department: '',
      designation: 'Teacher',
      staff_category: '',
      employment_type: '',
      joined_on: '',
      status: 'active',
      photo_id: null,
      role_id: '1',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      emergency_contact_name: '',
      emergency_contact_relationship: '',
      emergency_contact_phone: '',
      highest_qualification: '',
      specialization: '',
      metadata: {},
      user_id: 12,
      create_user: false,
      username: 'johndoe',
      password: '123', // Too short
    }

    const result = staffSchema.safeParse(editValues)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('at least 6 characters')
    }
  })
})
