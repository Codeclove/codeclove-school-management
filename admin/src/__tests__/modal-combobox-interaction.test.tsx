import { describe, it, expect } from 'vitest'
// @ts-expect-error node built-in without @types/node
import fs from 'node:fs'
import { renderToString } from 'react-dom/server'
import { FormField } from '../components/ui/FormField'

describe('Modal + Combobox Interaction & Pointer Events Cleanup', () => {
  const comboboxSource = fs.readFileSync(new URL('../components/ui/Combobox.tsx', import.meta.url), 'utf-8') as string
  const modalSource = fs.readFileSync(new URL('../components/ui/Modal.tsx', import.meta.url), 'utf-8') as string
  const selectSource = fs.readFileSync(new URL('../components/ui/Select.tsx', import.meta.url), 'utf-8') as string
  const datePickerSource = fs.readFileSync(new URL('../components/ui/DatePicker.tsx', import.meta.url), 'utf-8') as string
  const formFieldSource = fs.readFileSync(new URL('../components/ui/FormField.tsx', import.meta.url), 'utf-8') as string
  const globalsCssSource = fs.readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf-8') as string
  const viteConfigSource = fs.readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf-8') as string

  describe('Combobox Search Clickability & Focus Coordination', () => {
    it('Combobox PopoverPrimitive.Content must include pointer-events-auto to bypass body pointer-events lock', () => {
      // When inside a modal, body has pointer-events: none. PopoverContent must explicitly enable pointer events.
      expect(comboboxSource).toMatch(/<PopoverPrimitive\.Content[\s\S]*?pointer-events-auto/i)
    })

    it('Combobox PopoverPrimitive.Content must handle onOpenAutoFocus to prevent focus retention on trigger and aria-hidden blocking', () => {
      // Prevents "Blocked aria-hidden on an element because its descendant retained focus" on the trigger button
      expect(comboboxSource).toMatch(/onOpenAutoFocus=\{\(e\)\s*=>/i)
      expect(comboboxSource).toMatch(/searchInputRef\.current\?\.focus\(\)/)
    })

    it('Combobox search input container row has cursor-text and click handler delegating to search input', () => {
      expect(comboboxSource).toMatch(/cursor-text/i)
      expect(comboboxSource).toMatch(/searchInputRef\.current\?\.focus\(\)/)
    })

    it('Combobox PopoverPrimitive.Content handles onCloseAutoFocus returning focus to trigger', () => {
      expect(comboboxSource).toMatch(/onCloseAutoFocus=\{\(e\)\s*=>/i)
      expect(comboboxSource).toMatch(/triggerRef\.current\?\.focus\(\)/)
    })

    it('Combobox search input isolates pointerdown and keydown events from bubbling to modal', () => {
      expect(comboboxSource).toMatch(/onPointerDown=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/)
      expect(comboboxSource).toMatch(/onKeyDown=\{\(e\)\s*=>\s*\{\s*e\.stopPropagation\(\)/)
    })
  })

  describe('Modal Pointer-Events & Focus-Trap Coordination', () => {
    it('Modal includes cleanup effect resetting document.body.style.pointerEvents when closed', () => {
      // Radix DismissableLayer leaves pointer-events: none on body when closing modals with nested popovers.
      // Modal must ensure document.body.style.pointerEvents is restored.
      expect(modalSource).toMatch(/document\.body\.style\.pointerEvents\s*=\s*['"]['"]/i)
      expect(modalSource).toMatch(/data-state=["']open["']/)
    })

    it('Modal intercepts focus capture on portalled poppers to prevent Dialog FocusScope theft', () => {
      expect(modalSource).toMatch(/handleFocusCapture/)
      expect(modalSource).toMatch(/e\.stopImmediatePropagation\(\)/)
      expect(modalSource).toMatch(/addEventListener\(['"]focusin['"],\s*handleFocusCapture,\s*true\)/)
    })
  })

  describe('CSS & Bundler Deduplication Defenses', () => {
    it('globals.css forces pointer-events: auto on radix popper content wrappers', () => {
      expect(globalsCssSource).toMatch(/\[data-radix-popper-content-wrapper\]\s*\{\s*pointer-events:\s*auto\s*!important/i)
    })

    it('vite.config.ts dedupes radix focus scope to avoid multiple conflicting focus stacks in dev server', () => {
      expect(viteConfigSource).toMatch(/dedupe:\s*\[[\s\S]*?'@radix-ui\/react-focus-scope'/)
    })
  })

  describe('FormField Native DOM Element Error Attribute Hygiene', () => {
    it('FormField does not pass error prop to native DOM elements like textarea', () => {
      // Prevents React warning: "Received false for a non-boolean attribute error."
      expect(formFieldSource).toMatch(/isDomElement|typeof\s+children\.type\s*===\s*['"]string['"]/)
      const html = renderToString(
        <FormField label="Notes">
          <textarea placeholder="e.g. Bring lab coats" defaultValue="" />
        </FormField>
      )
      // Must not render error="false" or error="true" on native HTML textarea
      expect(html).not.toMatch(/<textarea[^>]*\serror=/)
    })
  })

  describe('Select & DatePicker Pointer-Events Defense', () => {
    it('SelectPrimitive.Content includes pointer-events-auto', () => {
      expect(selectSource).toMatch(/<SelectPrimitive\.Content[\s\S]*?pointer-events-auto/i)
    })

    it('DatePicker PopoverPrimitive.Content includes pointer-events-auto', () => {
      expect(datePickerSource).toMatch(/<PopoverPrimitive\.Content[\s\S]*?pointer-events-auto/i)
    })
  })
})
