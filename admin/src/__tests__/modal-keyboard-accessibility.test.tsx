import { describe, expect, it } from 'vitest'
// @ts-expect-error node built-in without @types/node
import fs from 'node:fs'

describe('Modal & Confirm Dialog Keyboard & Focus Accessibility Standards', () => {
  const modalSource = fs.readFileSync(
    new URL('../components/ui/Modal.tsx', import.meta.url),
    'utf-8'
  ) as string
  const confirmDialogSource = fs.readFileSync(
    new URL('../components/ui/ConfirmDialog.tsx', import.meta.url),
    'utf-8'
  ) as string
  const confirmHookSource = fs.readFileSync(
    new URL('../lib/confirm.tsx', import.meta.url),
    'utf-8'
  ) as string

  describe('Modal Primitive Architecture (Modal.tsx)', () => {
    it('implements smart initial focus via onOpenAutoFocus prioritizing safe cancel and inputs over X button', () => {
      expect(modalSource).toMatch(/onOpenAutoFocus=/)
      expect(modalSource).toMatch(/data-autofocus/)
      expect(modalSource).toMatch(/data-dialog-cancel/)
      expect(modalSource).toMatch(/input:not\(\[type="hidden"\]\)/)
    })

    it('implements global chorded confirm shortcut via Cmd+Enter and Ctrl+Enter', () => {
      expect(modalSource).toMatch(/onKeyDown=/)
      expect(modalSource).toMatch(/\(e\.metaKey\s*\|\|\s*e\.ctrlKey\)\s*&&\s*e\.key\s*===\s*'Enter'/)
      expect(modalSource).toMatch(/data-dialog-confirm/)
    })

    it('blocks Escape key dismissal and outside clicks during in-flight loading state', () => {
      expect(modalSource).toMatch(/onEscapeKeyDown=/)
      expect(modalSource).toMatch(/if\s*\(isLoading\)\s*\{\s*e\.preventDefault\(\)/)
      expect(modalSource).toMatch(/onPointerDownOutside=[\s\S]*?if\s*\(isLoading\)\s*\{\s*e\.preventDefault\(\)/)
    })

    it('marks modal body and footer with data attributes for scoped selector discovery', () => {
      expect(modalSource).toMatch(/data-modal-body/)
      expect(modalSource).toMatch(/data-modal-footer/)
    })

    it('maintains fixed viewport centering and overlay elevation above backdrop', () => {
      expect(modalSource).toMatch(/fixed\s+z-\[100001\]\s+left-1\/2\s+top-1\/2\s+-translate-x-1\/2\s+-translate-y-1\/2/)
    })
  })

  describe('ConfirmDialog Component (ConfirmDialog.tsx)', () => {
    it('tags Cancel button with data-dialog-cancel for default focus on open', () => {
      expect(confirmDialogSource).toMatch(/<Button[\s\S]*?variant="secondary"[\s\S]*?data-dialog-cancel/)
    })

    it('tags Confirm/Delete button with data-dialog-confirm for chorded shortcut trigger', () => {
      expect(confirmDialogSource).toMatch(/<Button[\s\S]*?data-dialog-confirm/)
    })

    it('passes in-flight mutation loading state to Modal primitive', () => {
      expect(confirmDialogSource).toMatch(/<Modal[\s\S]*?isLoading=\{isPending\}/)
    })
  })

  describe('Imperative useConfirm Hook (confirm.tsx)', () => {
    it('tags Cancel button with data-dialog-cancel for safe default focus on open', () => {
      expect(confirmHookSource).toMatch(/<button[\s\S]*?data-dialog-cancel/)
    })

    it('tags Confirm button with data-dialog-confirm for chorded shortcut trigger', () => {
      expect(confirmHookSource).toMatch(/<Button[\s\S]*?data-dialog-confirm/)
    })
  })
})
