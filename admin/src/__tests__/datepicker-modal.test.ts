import { describe, it, expect } from 'vitest'
// @ts-expect-error node built-in without @types/node
import fs from 'node:fs'
import { parseFlexibleDate } from '../components/ui/DatePicker'
import { format } from 'date-fns'

describe('DatePicker & Modal Integration', () => {
  const datePickerSource = fs.readFileSync(new URL('../components/ui/DatePicker.tsx', import.meta.url), 'utf-8') as string
  const modalSource = fs.readFileSync(new URL('../components/ui/Modal.tsx', import.meta.url), 'utf-8') as string

  it('DatePicker must pass modal={true} (or modal prop defaulting to true) to PopoverPrimitive.Root', () => {
    // Current bug: PopoverPrimitive.Root had open={open} onOpenChange={setOpen} WITHOUT modal={modal} or modal={true}.
    // In Radix UI, a non-modal Popover inside a modal Dialog has its clicks intercepted,
    // causing the popover to immediately unmount before the day button click can fire.
    expect(datePickerSource).toMatch(/<PopoverPrimitive\.Root[^>]*modal=\{modal\}/i)
    expect(datePickerSource).toMatch(/modal\s*=\s*true/i)
  })

  it('DatePicker input must NOT have onFocus open handler that conflicts with keyboard typing and modal focus traps', () => {
    // onFocus={() => setOpen(true)} steals focus away from the input when modal={true}
    // and causes race conditions when non-modal.
    expect(datePickerSource).not.toMatch(/onFocus=\{\(\)\s*=>\s*setOpen\(true\)\}/)
  })

  it('DatePicker input supports ArrowDown keyboard shortcut to open calendar', () => {
    expect(datePickerSource).toMatch(/ArrowDown/i)
  })

  it('Modal onPointerDownOutside must not dismiss when interacting with portaled overlays (radix popper wrappers)', () => {
    // When portaled popovers or dropdowns overflow the modal boundaries,
    // pointer events outside the modal rect must not dismiss the modal if clicking a radix floating element.
    expect(modalSource).toMatch(/data-radix-popper-content-wrapper/i)
  })

  describe('parseFlexibleDate utility', () => {
    it('parses US format MM/dd/yyyy', () => {
      const parsed = parseFlexibleDate('10/01/2026', 'MM/dd/yyyy')
      expect(parsed).not.toBeNull()
      expect(format(parsed!, 'yyyy-MM-dd')).toBe('2026-10-01')
    })

    it('parses IN/GB format dd/MM/yyyy', () => {
      const parsed = parseFlexibleDate('01/10/2026', 'dd/MM/yyyy')
      expect(parsed).not.toBeNull()
      expect(format(parsed!, 'yyyy-MM-dd')).toBe('2026-10-01')
    })

    it('parses ISO format yyyy-MM-dd', () => {
      const parsed = parseFlexibleDate('2026-10-01', 'yyyy-MM-dd')
      expect(parsed).not.toBeNull()
      expect(format(parsed!, 'yyyy-MM-dd')).toBe('2026-10-01')
    })

    it('handles dash and dot delimiters flexibly', () => {
      const parsed = parseFlexibleDate('10-01-2026', 'MM/dd/yyyy')
      expect(parsed).not.toBeNull()
      expect(format(parsed!, 'yyyy-MM-dd')).toBe('2026-10-01')
    })

    it('returns null for empty or invalid strings', () => {
      expect(parseFlexibleDate('', 'MM/dd/yyyy')).toBeNull()
      expect(parseFlexibleDate('invalid', 'MM/dd/yyyy')).toBeNull()
    })
  })
})
