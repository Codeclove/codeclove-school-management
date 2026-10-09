/**
 * Portal Context Provider.
 *
 * Manages active student selection, students list, authentication info,
 * user role, and unread notification state.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
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
const STORAGE_KEY = 'codeclove_portal_active_student_id'

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

  // Apply appearance theme color, UI display scale, and dark mode to portal root element
  useEffect(() => {
    const root = document.getElementById('codeclove-portal-root')
    if (!root) return

    const themeColor = settings?.appearance?.theme_color || 'classic_indigo'
    const uiScale = settings?.appearance?.ui_scale || '100%'
    const rawMode = settings?.appearance?.theme_mode || settings?.appearance?.mode

    root.setAttribute('data-theme-color', themeColor)
    root.style.setProperty('--codeclove-view-scale', uiScale)

    const applyThemeMode = () => {
      const isDark = rawMode === 'dark' || (rawMode !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches)
      root.classList.toggle('dark', Boolean(isDark))
    }

    applyThemeMode()

    if (!rawMode || rawMode === 'system') {
      const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
      if (mql) {
        mql.addEventListener('change', applyThemeMode)
        return () => mql.removeEventListener('change', applyThemeMode)
      }
    }
  }, [
    settings?.appearance?.theme_color,
    settings?.appearance?.ui_scale,
    settings?.appearance?.theme_mode,
    settings?.appearance?.mode,
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
  }
  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
}

export function usePortal(): PortalContextValue {
  const context = useContext(PortalContext)
  if (!context) {
    throw new Error('usePortal must be used within a PortalProvider')
  }
  return context
}
