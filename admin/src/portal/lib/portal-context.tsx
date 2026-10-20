/**
 * Portal Context Provider.
 *
 * Manages active student selection, students list, authentication info,
 * user role, and unread notification state.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNotifications, usePortalMe } from '../api/portal'
import type {
  PortalFinanceSettings,
  PortalLabels,
  PortalLocalization,
  PortalMeResponse,
  PortalSchool,
  PortalSettings,
  PortalStudent,
  PortalUser,
  UserRole,
} from '../types'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'codeclove_portal_active_student_id'
export const THEME_STORAGE_KEY = 'codeclove:portal-theme'

export interface PortalContextValue {
  currentStudent: PortalStudent | null
  students: PortalStudent[]
  switchStudent: (studentId: number) => void
  userRole: UserRole
  user: PortalUser | null
  unreadCount: number
  isLoading: boolean
  siteName: string
  logoUrl?: string
  logoutUrl: string
  settings?: PortalSettings
  school?: PortalSchool
  localization?: PortalLocalization
  labels?: PortalLabels
  finance?: PortalFinanceSettings
  theme: ThemeMode
  resolvedTheme: ResolvedTheme
  setTheme: (mode: ThemeMode) => void
}

const PortalContext = createContext<PortalContextValue | undefined>(undefined)
export function PortalProvider({ children }: { children: React.ReactNode }) {
  const initialContext = (window.CodeClovePortalConfig?.context ?? undefined) as PortalMeResponse | undefined
  const { data: meData, isLoading: isMeLoading } = usePortalMe(initialContext)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = saved ? parseInt(saved, 10) : null
      if (parsed) return parsed
    } catch {
      // Ignore localStorage access errors
    }
    return initialContext?.default_student_id ?? initialContext?.students?.[0]?.id ?? null
  })
  const students = useMemo<PortalStudent[]>(() => meData?.students ?? initialContext?.students ?? [], [meData?.students, initialContext?.students])
  const userRole: UserRole = meData?.role ?? initialContext?.role ?? 'student'
  const user = meData?.user ?? initialContext?.user ?? null

  const currentStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? students[0] ?? null,
    [selectedStudentId, students]
  )

  const { data: notifData } = useNotifications(currentStudent?.id, 1, 5)
  // Initialize or validate selected student ID
  useEffect(() => {
    if (students.length === 0) {
      if (selectedStudentId !== null) setSelectedStudentId(null)
      return
    }

    // Keep existing selected ID if it belongs to available students
    if (selectedStudentId && students.some((s) => s.id === selectedStudentId)) {
      return
    }

    const fallbackId = meData?.default_student_id && students.some((s) => s.id === meData.default_student_id)
      ? meData.default_student_id
      : students[0]?.id ?? null
    setSelectedStudentId(fallbackId)
  }, [students, meData?.default_student_id, selectedStudentId])

  const switchStudent = (studentId: number) => {
    setSelectedStudentId(studentId)
    localStorage.setItem(STORAGE_KEY, String(studentId))
  }

  const unreadCount = notifData?.unread_count ?? 0

  const configSettings = window.CodeClovePortalConfig?.settings
  const settings = meData?.settings ?? configSettings
  const school = settings?.school
  const localization = settings?.localization
  const labels = settings?.labels
  const finance = settings?.finance
  const siteName = school?.name || window.CodeClovePortalConfig?.siteName || 'School Portal'
  const logoUrl = school?.logo || window.CodeClovePortalConfig?.logoUrl
  const logoutUrl = window.CodeClovePortalConfig?.logoutUrl ?? '/wp-login.php?action=logout'

  // Theme mode preference state
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system'
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('codeclove:theme')
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored as ThemeMode
      }
    } catch {
      // Storage access failure fallback
    }
    const defaultMode = (configSettings?.appearance?.theme_mode || configSettings?.appearance?.mode) as ThemeMode | undefined
    return defaultMode === 'light' || defaultMode === 'dark' || defaultMode === 'system'
      ? defaultMode
      : 'system'
  })

  // System dark preference listener
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches)
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
      if (!mql) return
      const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    } catch {
      // Media query unsupported
    }
  }, [])

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'dark') return 'dark'
    if (theme === 'light') return 'light'
    return systemDark ? 'dark' : 'light'
  }, [theme, systemDark])

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode)
      localStorage.setItem('codeclove:theme', mode)
    } catch {
      // Storage unavailable fallback
    }
  }, [])

  // Apply appearance theme color, UI display scale, and dark mode to portal root element
  useEffect(() => {
    const root = document.getElementById('codeclove-portal-root')
    if (!root) return

    const themeColor = settings?.appearance?.theme_color || 'classic_indigo'
    const uiScale = settings?.appearance?.ui_scale || '100%'

    root.setAttribute('data-theme-color', themeColor)
    root.style.setProperty('--codeclove-view-scale', uiScale)
    root.classList.toggle('dark', resolvedTheme === 'dark')
  }, [
    settings?.appearance?.theme_color,
    settings?.appearance?.ui_scale,
    resolvedTheme,
  ])
  const value: PortalContextValue = {
    currentStudent,
    students,
    switchStudent,
    userRole,
    user,
    unreadCount,
    isLoading: isMeLoading,
    siteName,
    logoUrl,
    logoutUrl,
    settings,
    school,
    localization,
    labels,
    finance,
    theme,
    resolvedTheme,
    setTheme,
  }
  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePortal(): PortalContextValue {
  const context = useContext(PortalContext)
  if (!context) {
    throw new Error('usePortal must be used within a PortalProvider')
  }
  return context
}
