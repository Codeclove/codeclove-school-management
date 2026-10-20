import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
// @ts-expect-error node built-in without @types/node
import fs from 'node:fs'
import { CertificateInspector } from '../modules/academics/certificates/components/CertificateInspector'
import { TooltipProvider } from '../components/ui/Tooltip'
import type { CertificateElement } from '../api/certificates'

const globalsCss = fs.readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf-8') as string

describe('Focus Ring & Form Control Integrity', () => {
  describe('Global CSS Focus Ring Rule', () => {
    it('does NOT apply the global button-style offset focus ring to text/number inputs or textareas', () => {
      const hasUnscopedTextInputRing =
        globalsCss.includes(':focus-visible:not([role="menuitem"]):not([role="option"]) {') ||
        globalsCss.includes(':focus-visible:not([role="menuitem"]):not([role="option"]) {\n    @apply ring-2')

      expect(
        hasUnscopedTextInputRing,
        'globals.css must not apply blanket ring-2 ring-offset-1 to all inputs without excluding text/number inputs'
      ).toBe(false)
    })

    it('contains protection against inner input rings inside focus-within containers', () => {
      const hasFocusWithinProtection =
        globalsCss.includes('focus-within') &&
        (globalsCss.includes('box-shadow: none') || globalsCss.includes('--tw-ring-shadow: 0 0 #0000'))

      expect(
        hasFocusWithinProtection,
        'globals.css must prevent inner input rings inside focus-within containers'
      ).toBe(true)
    })
  })

  describe('CertificateInspector Control Sizing & Swatch Integrity', () => {
    it('ensures position X and Y coordinate inputs suppress inner focus rings and spin buttons with standard h-8 height', () => {
      const element: CertificateElement = {
        id: 'token_coord_test',
        type: 'token',
        token: 'student_name',
        label: 'Student Name',
        x: 50,
        y: 8.5,
        color: '#1e3a8a',
        isVisible: true,
      }

      const html = renderToString(
        <TooltipProvider>
          <CertificateInspector
            selectedElement={element}
            elements={[element]}
            onSelectElement={() => {}}
            onUpdateElement={() => {}}
            onDeleteElement={() => {}}
            onBackgroundUrlChange={() => {}}
          />
        </TooltipProvider>
      )

      // Both X and Y input wrappers exist
      expect(html).toContain('Position on Page')
      expect(html).toContain('value="50"')
      expect(html).toContain('value="8.5"')

      // The inputs must suppress spinner buttons (no-spinner) so numbers fit cleanly
      expect(html).toContain('no-spinner')

      // Sizing must be consistent with standard h-8 height
      expect(html).toContain('h-8')

      // Swatches must be rendered with visible dimensions (w-5 h-5), not collapsed dots
      expect(html).toContain('w-5 h-5')
    })
  })
})
