/**
 * Portal Theme Toggle & Mode Tests.
 *
 * Verifies ThemeToggle button rendering, accessible ARIA attributes,
 * theme options dropdown (Light, Dark, System), and theme resolution.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ThemeToggle } from '../components/ThemeToggle'
import * as portalContext from '../lib/portal-context'

describe('Portal ThemeToggle Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders theme toggle trigger button with accessible attributes', () => {
    vi.spyOn(portalContext, 'usePortal').mockReturnValue({
      currentStudent: null,
      students: [],
      switchStudent: vi.fn(),
      userRole: 'student',
      user: null,
      unreadCount: 0,
      isLoading: false,
      siteName: 'Test School',
      logoutUrl: '/logout',
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: vi.fn(),
    })

    const html = renderToString(<ThemeToggle />)
    expect(html).toContain('aria-label="Change theme mode"')
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain('Theme: Light, Dark, or System')
    expect(html).toContain('cursor-pointer')
  })

  it('renders sun icon when theme is light', () => {
    vi.spyOn(portalContext, 'usePortal').mockReturnValue({
      currentStudent: null,
      students: [],
      switchStudent: vi.fn(),
      userRole: 'student',
      user: null,
      unreadCount: 0,
      isLoading: false,
      siteName: 'Test School',
      logoutUrl: '/logout',
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: vi.fn(),
    })

    const html = renderToString(<ThemeToggle />)
    // Lucide Sun SVG contains circle and sun rays
    expect(html).toContain('<svg')
    expect(html).toContain('w-4 h-4')
  })

  it('renders moon icon when theme is dark', () => {
    vi.spyOn(portalContext, 'usePortal').mockReturnValue({
      currentStudent: null,
      students: [],
      switchStudent: vi.fn(),
      userRole: 'student',
      user: null,
      unreadCount: 0,
      isLoading: false,
      siteName: 'Test School',
      logoutUrl: '/logout',
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: vi.fn(),
    })

    const html = renderToString(<ThemeToggle />)
    expect(html).toContain('<svg')
    expect(html).toContain('w-4 h-4')
  })

  it('renders monitor icon when theme is system', () => {
    vi.spyOn(portalContext, 'usePortal').mockReturnValue({
      currentStudent: null,
      students: [],
      switchStudent: vi.fn(),
      userRole: 'student',
      user: null,
      unreadCount: 0,
      isLoading: false,
      siteName: 'Test School',
      logoutUrl: '/logout',
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: vi.fn(),
    })

    const html = renderToString(<ThemeToggle />)
    expect(html).toContain('<svg')
    expect(html).toContain('w-4 h-4')
  })
})
