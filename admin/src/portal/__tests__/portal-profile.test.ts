import { describe, expect, it } from 'vitest'
import { formatAddress, formatDate, getInitials } from '../lib/formatter'
import type { PortalGuardian } from '../types'

describe('Portal Profile Data & Organization', () => {
  describe('Guardian Priority Resolution', () => {
    it('correctly resolves primary and emergency guardians', () => {
      const guardians: PortalGuardian[] = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          relationship: 'Father',
          phone: '+1 555-0199',
          email: 'john@example.com',
          is_primary: false,
          is_emergency_contact: true,
        },
        {
          id: 2,
          first_name: 'Jane',
          last_name: 'Doe',
          relationship: 'Mother',
          phone: '+1 555-0188',
          email: 'jane@example.com',
          is_primary: true,
          is_emergency_contact: false,
        },
      ]

      const primary = guardians.find((g) => g.is_primary) ?? guardians[0]
      const emergency = guardians.find((g) => g.is_emergency_contact) ?? primary

      expect(primary?.first_name).toBe('Jane')
      expect(primary?.is_primary).toBe(true)
      expect(emergency?.first_name).toBe('John')
      expect(emergency?.is_emergency_contact).toBe(true)
    })

    it('falls back to the first guardian if no primary is explicitly flagged', () => {
      const guardians: PortalGuardian[] = [
        {
          id: 3,
          first_name: 'Alice',
          last_name: 'Smith',
          relationship: 'Guardian',
          phone: '+1 555-0100',
        },
      ]

      const primary = guardians.find((g) => g.is_primary) ?? guardians[0]
      expect(primary?.first_name).toBe('Alice')
    })
  })

  describe('Profile Formatters & Display Fallbacks', () => {
    it('formats initials cleanly for single and multi-word names', () => {
      expect(getInitials('Vivaan Verma VII')).toBe('VV')
      expect(getInitials('Arjun Verma')).toBe('AV')
      expect(getInitials('A')).toBe('A')
      expect(getInitials('')).toBe('?')
    })

    it('formats address records with fallback message', () => {
      expect(formatAddress(null)).toBe('No residential address on file')
      expect(formatAddress('')).toBe('No residential address on file')
      expect(formatAddress('42 Palm Avenue, London')).toBe('42 Palm Avenue, London')
      expect(
        formatAddress({
          address_line1: '123 Maple St',
          city: 'Boston',
          country: 'US',
        })
      ).toContain('123 Maple St, Boston, US')
    })

    it('formats ISO dates into readable localized format', () => {
      const formatted = formatDate('2026-09-07')
      expect(formatted).toContain('2026')
      expect(formatted).toContain('Sep')
      expect(formatDate(null)).toBe('—')
    })
  })
})
