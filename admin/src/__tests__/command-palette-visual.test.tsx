import { describe, expect, it } from 'vitest'
// @ts-expect-error node built-in without @types/node
import fs from 'node:fs'

describe('CommandPalette Visual Styling & Design System Integrity', () => {
  const commandPaletteSource = fs.readFileSync(
    new URL('../components/CommandPalette.tsx', import.meta.url),
    'utf-8'
  ) as string

  it('uses solid Layer 3 bg-bg-overlay on the dialog content without broken opacity modifiers', () => {
    // bg-bg-overlay/95 was silently dropped by Tailwind because opacity modifiers failed on CSS vars.
    // It must use solid bg-bg-overlay conforming to codeclove-ui-ux Layer 3 elevation standards.
    expect(commandPaletteSource).not.toMatch(/bg-bg-overlay\/95/)
    expect(commandPaletteSource).toMatch(/codeclove-command-palette-content/)
    expect(commandPaletteSource).toMatch(/bg-bg-overlay/)
  })

  it('uses consistent elevated bg-bg-overlay and border-border on search header', () => {
    // Ensures search header uses design tokens rather than arbitrary black/white opacities
    expect(commandPaletteSource).toMatch(/bg-bg-overlay border-b border-border/)
  })

  it('unifies the dialog footer background with bg-bg-overlay', () => {
    // Footer previously used bright white bg-bg-surface creating a jarring split across dialog body
    expect(commandPaletteSource).toMatch(/bg-bg-overlay border-t border-border/)
  })

  it('styles keycaps consistently with elevated background and border', () => {
    expect(commandPaletteSource).toMatch(/bg-bg-elevated.*border.*border-border.*text-text/)
  })

  it('styles selected item with high-contrast text and prominent brand icon indicator', () => {
    expect(commandPaletteSource).toMatch(/isSelected\s*\?\s*'bg-brand text-text-inverted/)
    expect(commandPaletteSource).toMatch(/bg-brand\/10 dark:bg-brand\/20/)
  })
})
