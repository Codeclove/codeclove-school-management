/**
 * Theme context — manages light / dark / system preference.
 *
 * On mount: reads from localStorage, falls back to 'light'.
 * On change: toggles the `dark` class on <html> and persists to localStorage.
 * System mode: follows `prefers-color-scheme` and re-evaluates on OS change.
 *
 * Usage:
 *   const { theme, setTheme, resolvedTheme } = useTheme()
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThemeMode    = 'light' | 'dark' | 'system'
export type ResolvedMode = 'light' | 'dark'

interface ThemeContextValue {
  /** The stored preference (may be 'system') */
  theme: ThemeMode
  /** The actual rendered mode after resolving 'system' */
  resolvedTheme: ResolvedMode
  setTheme: (mode: ThemeMode) => void

}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  theme:         'light',
  resolvedTheme: 'light',
  setTheme:      () => {},
})
const STORAGE_KEY = 'codeclove:theme'

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored
      }
    } catch { /* SSR / storage blocked */ }
    return 'light'
  })

  // Resolve 'system' to the actual OS preference.
  const resolvedTheme = useMemo<ResolvedMode>(() => {
    if (theme !== 'system') return theme
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    } catch {
      return 'light'
    }
  }, [theme])

  // Apply dark/light class to <html> whenever the resolved mode changes.
  const applyTheme = useCallback((resolved: ResolvedMode) => {
    const html = document.documentElement
    if (resolved === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }, [])

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme, applyTheme])

  // Re-evaluate when OS preference changes (only active in 'system' mode).
  useEffect(() => {
    if (theme !== 'system') return

    const mql     = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light')

    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [theme, applyTheme])

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* storage blocked */ }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme() {
  return useContext(ThemeContext)
}
