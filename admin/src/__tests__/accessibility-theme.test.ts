import { describe, it, expect } from 'vitest'
// @ts-expect-error node built-in without @types/node
import fs from 'node:fs'
import tailwindConfig from '../../tailwind.config'

const globalsCss = fs.readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf-8') as string
const portalCss = fs.readFileSync(new URL('../portal/styles/portal.css', import.meta.url), 'utf-8') as string
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

  it('light mode --border-strong must achieve >= 3:1 non-text contrast against white per WCAG 2.2 SC 1.4.11', () => {
    const surface = extractCssVar(rootBlock, '--bg-surface') || '#ffffff'
    const borderStrong = extractCssVar(rootBlock, '--border-strong')
    expect(getContrastRatio(borderStrong, surface), `border-strong ${borderStrong} vs ${surface}`).toBeGreaterThanOrEqual(3.0)
  })

  it('dark mode text-subtle and text-muted must achieve >= 4.5:1 contrast against dark elevated card', () => {
    const elevated = extractCssVar(darkBlock, '--bg-elevated') || '#1c1c26'
    const textSubtle = extractCssVar(darkBlock, '--text-subtle')
    const textMuted = extractCssVar(darkBlock, '--text-muted')
    expect(getContrastRatio(textSubtle, elevated), `dark text-subtle ${textSubtle} vs ${elevated}`).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(textMuted, elevated), `dark text-muted ${textMuted} vs ${elevated}`).toBeGreaterThanOrEqual(4.5)
  })

  it('dark mode core border, text, and shimmer tokens must meet WCAG 2.2 AA specifications', () => {
    expect(extractCssVar(darkBlock, '--border')).toBe('rgba(255, 255, 255, 0.16)')
    expect(extractCssVar(darkBlock, '--border-subtle')).toBe('rgba(255, 255, 255, 0.08)')
    expect(extractCssVar(darkBlock, '--border-strong')).toBe('rgba(255, 255, 255, 0.32)')
    expect(extractCssVar(darkBlock, '--text')).toBe('#f8fafc')
    expect(extractCssVar(darkBlock, '--text-muted')).toBe('#cbd5e1')
    expect(extractCssVar(darkBlock, '--hover-bg')).toBe('rgba(255, 255, 255, 0.08)')
    expect(extractCssVar(darkBlock, '--shimmer-from')).toBe('#242432')
    expect(extractCssVar(darkBlock, '--shimmer-mid')).toBe('#2e2e40')
  })

  it('dark theme presets must define solid hex brand-ring and lighter hover brand-strong', () => {
    const presets = [
      'classic_indigo',
      'sky_blue',
      'sunset_orange',
      'sunny_gold',
      'fresh_mint',
      'playful_violet',
      'fun_pink',
    ]

    for (const preset of presets) {
      const match = globalsCss.match(new RegExp(`html\\.dark\\[data-theme-color="${preset}"\\]\\s*\\{([\\s\\S]*?)\\}`))
      expect(match, `preset ${preset} must be defined in dark mode`).toBeTruthy()
      const block = (match && match[1]) ? match[1] : ''
      const brand = extractCssVar(block, '--brand')
      const brandStrong = extractCssVar(block, '--brand-strong')
      const brandRing = extractCssVar(block, '--brand-ring')
      expect(brandRing, `${preset} --brand-ring must be solid hex`).toMatch(/^#[0-9a-fA-F]{3,6}$/)
      expect(brandStrong, `${preset} --brand-strong must be solid hex`).toMatch(/^#[0-9a-fA-F]{3,6}$/)
      // Hover tint in dark mode must be strictly lighter (higher luminance)
      expect(
        getRelativeLuminance(brandStrong),
        `${preset} brand-strong (${brandStrong}) must be lighter than brand (${brand})`
      ).toBeGreaterThan(getRelativeLuminance(brand))
    }
  })

  it('light theme presets must achieve >= 4.5:1 text contrast and >= 3:1 focus ring contrast against white surface', () => {
    const presets = [
      'classic_indigo',
      'sky_blue',
      'sunset_orange',
      'sunny_gold',
      'fresh_mint',
      'playful_violet',
      'fun_pink',
    ]
    const surface = '#ffffff'

    for (const preset of presets) {
      const match = globalsCss.match(new RegExp(`html\\[data-theme-color="${preset}"\\]\\s*\\{([\\s\\S]*?)\\}`))
      expect(match, `preset ${preset} must be defined in light mode`).toBeTruthy()
      const block = (match && match[1]) ? match[1] : ''
      const brand = extractCssVar(block, '--brand')
      const brandRing = extractCssVar(block, '--brand-ring')

      expect(brandRing, `${preset} light --brand-ring must be solid hex`).toMatch(/^#[0-9a-fA-F]{3,6}$/)
      expect(
        getContrastRatio(brand, surface),
        `${preset} brand ${brand} vs ${surface} must pass WCAG AA >= 4.5:1`
      ).toBeGreaterThanOrEqual(4.5)
      expect(
        getContrastRatio(brandRing, surface),
        `${preset} brand-ring ${brandRing} vs ${surface} must pass WCAG AA focus boundary >= 3.0:1`
      ).toBeGreaterThanOrEqual(3.0)
    }
  })

  it('portal.css design tokens must match globals.css specifications', () => {
    const portalRootMatch = portalCss.match(/#codeclove-portal-root\s*\{([^{}]*--bg-base[^{}]*)\}/)
    const portalRoot = portalRootMatch && portalRootMatch[1] ? portalRootMatch[1] : ''
    const tokensToVerify = [
      '--border',
      '--border-subtle',
      '--border-strong',
      '--text',
      '--text-muted',
      '--text-subtle',
      '--text-inverted',
      '--brand',
      '--brand-strong',
      '--brand-dim',
      '--brand-ring',
      '--success',
      '--warning',
      '--danger',
      '--info',
      '--status-paid',
      '--status-overdue',
    ]

    for (const token of tokensToVerify) {
      const globalVal = extractCssVar(rootBlock, token)
      const portalVal = extractCssVar(portalRoot, token)
      expect(portalVal, `portal token ${token} must match globals.css`).toBe(globalVal)
    }
  })

  it('selection highlights and scrollbars must be standardized across globals.css and portal.css', () => {
    // globals.css selection and scrollbar
    expect(globalsCss).toContain('::selection')
    expect(globalsCss).toContain('background-color: var(--brand);')
    expect(globalsCss).toContain('color: var(--text-inverted);')
    expect(globalsCss).toContain('scrollbar-color: var(--border-strong) transparent;')

    // portal.css selection and scrollbar
    expect(portalCss).toContain('::selection')
    expect(portalCss).toContain('scrollbar-color: var(--border-strong) transparent;')
  })

  it('declares semantic border tokens in both light and dark mode for crisp UI boundaries', () => {
    const semanticTokens = ['--brand-border', '--success-border', '--warning-border', '--danger-border', '--info-border']
    for (const token of semanticTokens) {
      expect(extractCssVar(rootBlock, token), `light mode ${token}`).toBeTruthy()
      expect(extractCssVar(darkBlock, token), `dark mode ${token}`).toBeTruthy()
    }
  })

  it('core UI primitives must not use broken slash opacity on CSS custom properties', () => {
    const uiFiles = [
      'Button.tsx',
      'Badge.tsx',
      'Card.tsx',
      'Modal.tsx',
      'Sheet.tsx',
      'Table.tsx',
      'DataTable.tsx',
      'Dropdown.tsx',
      'Select.tsx',
      'Input.tsx',
      'Textarea.tsx',
      'DatePicker.tsx',
      'Tooltip.tsx',
      'Alert.tsx',
      'EmptyState.tsx',
      'StatCard.tsx',
      'PersonAvatar.tsx',
      'Avatar.tsx',
      'Accordion.tsx',
      'Skeleton.tsx',
      'FormField.tsx',
    ]

    const brokenSlashPattern = /(?:border|bg|text)-(?:brand|success|warning|danger|info|border|bg-[a-z]+|hover-bg|status-[a-z_]+)\/[0-9]+/

    for (const file of uiFiles) {
      const filePath = new URL(`../components/ui/${file}`, import.meta.url)
      const content = fs.readFileSync(filePath, 'utf-8')
      const match = content.match(brokenSlashPattern)
      expect(match, `${file} must not contain broken slash opacity on hex CSS variables: ${match?.[0]}`).toBeNull()
    }
  })
})
