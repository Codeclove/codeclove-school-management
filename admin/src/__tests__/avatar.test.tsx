import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import {
  Avatar,
  PersonAvatar,
  getAvatarInitials,
  getAvatarColor,
} from '../components/ui'

describe('Avatar & PersonAvatar Primitives', () => {
  describe('getAvatarInitials helper', () => {
    it('extracts first and last initials for two-word names', () => {
      expect(getAvatarInitials('John Doe')).toBe('JD')
      expect(getAvatarInitials('Jane Smith')).toBe('JS')
    })

    it('extracts first and last initials for multi-word names', () => {
      expect(getAvatarInitials('Alice Bob Charlie')).toBe('AC')
    })

    it('extracts first two characters for single-word names', () => {
      expect(getAvatarInitials('John')).toBe('JO')
      expect(getAvatarInitials('A')).toBe('A')
    })

    it('handles empty or whitespace strings with fallback', () => {
      expect(getAvatarInitials('')).toBe('US')
      expect(getAvatarInitials('   ')).toBe('US')
    })
  })

  describe('getAvatarColor helper', () => {
    it('returns a deterministic color class for identical names', () => {
      const color1 = getAvatarColor('John Doe')
      const color2 = getAvatarColor('John Doe')
      expect(color1).toBe(color2)
      expect(typeof color1).toBe('string')
      expect(color1.length).toBeGreaterThan(0)
    })

    it('returns valid color string for empty names', () => {
      const color = getAvatarColor('')
      expect(typeof color).toBe('string')
    })
  })

  describe('Avatar component', () => {
    it('renders accessible initials fallback when no photoUrl is provided', () => {
      const html = renderToString(<Avatar name="John Doe" />)
      expect(html).toContain('JD')
      expect(html).toContain('role="img"')
      expect(html).toContain('aria-label="John Doe"')
      expect(html).toContain('rounded-full') // default circle shape
      expect(html).toContain('w-9 h-9') // default md size
    })

    it('renders image when valid photoUrl is provided', () => {
      const html = renderToString(
        <Avatar name="Jane Smith" photoUrl="https://example.com/photo.jpg" />
      )
      expect(html).toContain('<img')
      expect(html).toContain('src="https://example.com/photo.jpg"')
      expect(html).toContain('alt="Jane Smith"')
    })

    it('falls back to initials when photoUrl is placeholder or avatar.svg', () => {
      const htmlSvg = renderToString(
        <Avatar name="Jane Smith" photoUrl="https://example.com/avatar.svg" />
      )
      expect(htmlSvg).not.toContain('<img')
      expect(htmlSvg).toContain('JS')

      const htmlPlaceholder = renderToString(
        <Avatar name="Jane Smith" photoUrl="https://example.com/placeholder-1.png" />
      )
      expect(htmlPlaceholder).not.toContain('<img')
      expect(htmlPlaceholder).toContain('JS')
    })

    it('applies sizes correctly', () => {
      expect(renderToString(<Avatar name="Test" size="xs" />)).toContain('w-6 h-6')
      expect(renderToString(<Avatar name="Test" size="sm" />)).toContain('w-7 h-7')
      expect(renderToString(<Avatar name="Test" size="md" />)).toContain('w-9 h-9')
      expect(renderToString(<Avatar name="Test" size="lg" />)).toContain('w-11 h-11')
      expect(renderToString(<Avatar name="Test" size="xl" />)).toContain('w-16 h-16')
      expect(renderToString(<Avatar name="Test" size="2xl" />)).toContain('w-20 h-20')
    })

    it('applies shape classes correctly', () => {
      const circleHtml = renderToString(<Avatar name="Test" shape="circle" />)
      expect(circleHtml).toContain('rounded-full')

      const roundedHtml = renderToString(<Avatar name="Test" size="md" shape="rounded" />)
      expect(roundedHtml).toContain('rounded-xl')
      expect(roundedHtml).not.toContain('rounded-full')
    })

    it('allows custom className extension', () => {
      const html = renderToString(<Avatar name="Test" className="custom-avatar-class" />)
      expect(html).toContain('custom-avatar-class')
    })

    it('uses custom alt when provided', () => {
      const html = renderToString(
        <Avatar name="Jane Smith" photoUrl="https://example.com/photo.jpg" alt="Custom Alt Text" />
      )
      expect(html).toContain('alt="Custom Alt Text"')
    })
  })

  describe('PersonAvatar composition & backwards compatibility', () => {
    it('renders composed Avatar alongside name, idNumber, and subtitle', () => {
      const html = renderToString(
        <PersonAvatar
          name="Alice Cooper"
          idNumber="STU-001"
          subtitle="Grade 10"
          size="md"
        />
      )
      expect(html).toContain('AC')
      expect(html).toContain('Alice Cooper')
      expect(html).toContain('STU-001')
      expect(html).toContain('Grade 10')
      expect(html).toContain('rounded-xl') // PersonAvatar uses rounded shape
    })

    it('renders photo when photoUrl is supplied to PersonAvatar', () => {
      const html = renderToString(
        <PersonAvatar
          name="Bob Builder"
          photoUrl="https://example.com/bob.jpg"
          size="lg"
        />
      )
      expect(html).toContain('<img')
      expect(html).toContain('src="https://example.com/bob.jpg"')
      expect(html).toContain('Bob Builder')
      expect(html).toContain('w-11 h-11')
    })
  })
})
