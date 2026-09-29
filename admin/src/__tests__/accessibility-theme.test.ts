import { describe, it, expect } from 'vitest'
// @ts-expect-error node built-in without @types/node
import fs from 'node:fs'
import tailwindConfig from '../../tailwind.config'

const globalsCss = fs.readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf-8') as string
// Standard WCAG 2.1 / 2.2 Relative Luminance and Contrast Calculation
function srgbToLinear(c: number): number {
  const norm = c / 255
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4)
}

function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1)
  const l2 = getRelativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function extractCssVar(block: string, varName: string): string {
  const match = block.match(new RegExp(`${varName}:\\s*([^;]+);`))
  return match && match[1] ? match[1].trim() : ''
}

const rootBlockMatch = globalsCss.match(/:root\s*\{([\s\S]*?)\}/)
const rootBlock = rootBlockMatch && rootBlockMatch[1] ? rootBlockMatch[1] : ''

const darkBlockMatch = globalsCss.match(/\.dark\s*\{([\s\S]*?)\}/)
const darkBlock = darkBlockMatch && darkBlockMatch[1] ? darkBlockMatch[1] : ''
describe('Typography & View Scale System', () => {
  it('html element must not assign 0.875rem font size to avoid compounding shrink bug', () => {
    const htmlBlock = globalsCss.match(/html\s*\{([\s\S]*?)\}/)
    expect(htmlBlock).toBeTruthy()
    const content = htmlBlock ? htmlBlock[1] : ''
    expect(content).not.toContain("theme('fontSize.base[0]')")
    expect(content).not.toContain('0.875rem')
  })

  it('html element must declare --codeclove-view-scale or root scale support', () => {
    expect(globalsCss).toContain('--codeclove-view-scale')
  })

  it('tailwind font scale must enforce a strict 12px (0.75rem) floor', () => {
    const fontSize = tailwindConfig.theme?.extend?.fontSize as Record<string, [string, unknown]>
    expect(fontSize).toBeDefined()
    for (const [name, [size]] of Object.entries(fontSize)) {
      const remValue = parseFloat(size)
      expect(remValue, `Font size token "${name}" (${size}) must be >= 0.75rem (12px)`).toBeGreaterThanOrEqual(0.75)
    }
  })
})

describe('Color Contrast WCAG 2.2 AA Compliance', () => {
  it('light mode text and semantic tokens must achieve >= 4.5:1 contrast against surface', () => {
    const surface = extractCssVar(rootBlock, '--bg-surface') || '#ffffff'
    const textSubtle = extractCssVar(rootBlock, '--text-subtle')
    const success = extractCssVar(rootBlock, '--success')
    const warning = extractCssVar(rootBlock, '--warning')
    const info = extractCssVar(rootBlock, '--info')

    expect(getContrastRatio(textSubtle, surface), `text-subtle ${textSubtle} vs ${surface}`).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(success, surface), `success ${success} vs ${surface}`).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(warning, surface), `warning ${warning} vs ${surface}`).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(info, surface), `info ${info} vs ${surface}`).toBeGreaterThanOrEqual(4.5)
  })

  it('dark mode text-subtle must achieve >= 4.5:1 contrast against dark elevated card', () => {
    const elevated = extractCssVar(darkBlock, '--bg-elevated') || '#1c1c26'
    const textSubtle = extractCssVar(darkBlock, '--text-subtle')
    expect(getContrastRatio(textSubtle, elevated), `dark text-subtle ${textSubtle} vs ${elevated}`).toBeGreaterThanOrEqual(4.5)
  })
})
