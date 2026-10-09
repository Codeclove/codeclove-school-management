import { describe, expect, it } from 'vitest'
// @ts-expect-error node built-in without @types/node
import fs from 'node:fs'
import {
  ConfirmDialog,
  Sheet,
  SheetHeader,
  SheetBody,
  SheetFooter,
} from '../components/ui'

describe('Tier 2 ConfirmDialog & Sheet Components', () => {
  const confirmDialogSource = fs.readFileSync(
    new URL('../components/ui/ConfirmDialog.tsx', import.meta.url),
    'utf-8'
  ) as string
  const sheetSource = fs.readFileSync(
    new URL('../components/ui/Sheet.tsx', import.meta.url),
    'utf-8'
  ) as string
  const uiIndexSource = fs.readFileSync(
    new URL('../components/ui/index.ts', import.meta.url),
    'utf-8'
  ) as string

  describe('ConfirmDialog Specifications & Contract', () => {
    it('is exported from components/ui index', () => {
      expect(ConfirmDialog).toBeDefined()
      expect(uiIndexSource).toMatch(/export\s*\{[^}]*ConfirmDialog/i)
      expect(uiIndexSource).toMatch(/type\s+ConfirmDialogProps/i)
      expect(uiIndexSource).toMatch(/type\s+ConfirmDialogVariant/i)
    })

    it('renders using Modal with size="sm" and noHeaderBorder', () => {
      expect(confirmDialogSource).toMatch(/<Modal[\s\S]*?size="sm"/i)
      expect(confirmDialogSource).toMatch(/noHeaderBorder/i)
    })

    it('supports danger, warning, info, and default variants via VARIANT_CONFIG', () => {
      expect(confirmDialogSource).toMatch(/danger:\s*\{/)
      expect(confirmDialogSource).toMatch(/warning:\s*\{/)
      expect(confirmDialogSource).toMatch(/info:\s*\{/)
      expect(confirmDialogSource).toMatch(/default:\s*\{/)
    })

    it('includes async pending state with <Spinner size="xs" />', () => {
      expect(confirmDialogSource).toMatch(/<Spinner[\s\S]*?size="xs"/i)
      expect(confirmDialogSource).toMatch(/isPending/)
    })

    it('guards against dismissal and outside clicks during pending async operations', () => {
      expect(confirmDialogSource).toMatch(/if\s*\(isPending\)\s*return/)
    })
  })

  describe('Sheet (Slide-Over Drawer) Specifications & Contract', () => {
    it('is exported from components/ui index along with subcomponents', () => {
      expect(Sheet).toBeDefined()
      expect(SheetHeader).toBeDefined()
      expect(SheetBody).toBeDefined()
      expect(SheetFooter).toBeDefined()
      expect(uiIndexSource).toMatch(/export\s*\{[^}]*Sheet/i)
    })

    it('uses Radix Dialog primitive configured as a slide-over panel', () => {
      expect(sheetSource).toMatch(/@radix-ui\/react-dialog/)
      expect(sheetSource).toMatch(/DialogPrimitive\.Root/)
      expect(sheetSource).toMatch(/DialogPrimitive\.Portal/)
      expect(sheetSource).toMatch(/DialogPrimitive\.Content/)
    })

    it('configures fixed full-height overlay with z-[100001] and bg-bg-overlay', () => {
      expect(sheetSource).toMatch(/z-\[100000\]/)
      expect(sheetSource).toMatch(/z-\[100001\]/)
      expect(sheetSource).toMatch(/bg-bg-overlay/)
    })

    it('supports animated slide-in from right and left via SIDE_STYLES', () => {
      expect(sheetSource).toMatch(/SIDE_STYLES/)
      expect(sheetSource).toMatch(/animate-slide-in-from-right/)
      expect(sheetSource).toMatch(/animate-slide-in-from-left/)
    })

    it('supports size options sm, md, lg, xl, and full', () => {
      expect(sheetSource).toMatch(/SHEET_SIZE_CLASSES/)
      expect(sheetSource).toMatch(/max-w-md/)
      expect(sheetSource).toMatch(/max-w-xl/)
    })
  })
})
