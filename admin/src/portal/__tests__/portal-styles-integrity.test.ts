import { describe, it, expect } from 'vitest'
// @ts-expect-error node built-in without @types/node
import fs from 'node:fs'

const portalCss = fs.readFileSync(new URL('../styles/portal.css', import.meta.url), 'utf-8') as string

describe('Portal CSS Isolation & Token Integrity', () => {
  describe('Theme Specificity & Isolation (Prevent Theme Leakage)', () => {
    it('must not use zero-specificity :where() for element resets so WordPress themes cannot override them', () => {
      // Themes like Astra define .entry-content p { margin-bottom: 1.6em; } and table, td, th { border: 1px solid ... }
      // If portal uses :where(#codeclove-portal-root), the specificity is 0, so theme styles completely break the portal layout.
      expect(portalCss).not.toContain(':where(#codeclove-portal-root)')
    })

    it('must explicitly reset table borders and border-collapse with high specificity to block theme table styles', () => {
      // Astra forces table { border-collapse: separate; margin: 0 0 1.5em; } and table, td, th { border: 1px solid var(--ast-border-color) }
      expect(portalCss).toMatch(/#codeclove-portal-root\s+table[\s\S]*?border-collapse:\s*collapse/i)
      expect(portalCss).toMatch(/#codeclove-portal-root\s+(td|th|table,[\s\S]*?td)[\s\S]*?border-style:\s*solid/i)
    })

    it('must reset paragraph margins with real specificity', () => {
      expect(portalCss).toMatch(/#codeclove-portal-root\s+p[\s\S]*?margin:\s*0/i)
    })
    it('must apply universal border-width: 0 reset and never use [class*="border"] which causes phantom 3px borders', () => {
      // [class*="border"] matched text-border-strong, bg-border, etc. and triggered browser default 3px border-width!
      expect(portalCss).not.toContain('[class*="border"]')
      expect(portalCss).toMatch(/#codeclove-portal-root\s*\*,[\s\S]*?border-width:\s*0/i)
    })
  })

  describe('Design Token Completeness', () => {
    it('must declare all status badge foreground tokens used by @/components/ui/Badge', () => {
      const requiredTokens = [
        '--status-active',
        '--status-paid',
        '--status-partially_paid',
        '--status-overdue',
        '--status-present',
        '--status-absent',
        '--status-late',
        '--hover-bg',
        '--active-bg',
      ]

      for (const token of requiredTokens) {
        expect(portalCss, `portal.css must define ${token}`).toContain(token)
      }
    })

    it('must declare all core border and shadow tokens', () => {
      expect(portalCss).toMatch(/--border:\s*#cbd5e1/i)
      expect(portalCss).toMatch(/--border-subtle:\s*rgba\(0,\s*0,\s*0,\s*0\.04\)/i)
      expect(portalCss).toMatch(/--border-strong:\s*#7c8ba1/i)
      expect(portalCss).toContain('--shadow-card:')
      expect(portalCss).toContain('--shadow-card-md:')
    })

    it('must declare dark mode surface, border, and text tokens for #codeclove-portal-root.dark', () => {
      expect(portalCss).toMatch(/#codeclove-portal-root\.dark/i)
      expect(portalCss).toMatch(/--bg-base:\s*#09090b/i)
      expect(portalCss).toMatch(/--bg-elevated:\s*#1c1c26/i)
      expect(portalCss).toMatch(/--border:\s*rgba\(255,\s*255,\s*255,\s*0\.16\)/i)
      expect(portalCss).toMatch(/--text:\s*#f8fafc/i)
    })
  })
})
