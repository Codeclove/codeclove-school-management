/**
 * Portal Terminology Labels Helper.
 *
 * Provides dynamic country-aware labels for entity names (Class vs Grade vs Year,
 * Section vs Homeroom, etc.) configured in the CodeClove backend.
 */

import { usePortal } from './portal-context'

export function usePortalLabels() {
  const { labels } = usePortal()

  const getLabel = (key: string, plural = false, fallback?: string): string => {
    const val = plural ? labels?.[key]?.plural : labels?.[key]?.singular
    if (val) return val
    if (fallback) return fallback
    const readable = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    return plural ? `${readable}s` : readable
  }

  return { getLabel, labels }
}
