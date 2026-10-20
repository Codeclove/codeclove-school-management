/**
 * CodeClove Portal — Application Entry Point.
 *
 * Mounts the Portal SPA into #codeclove-portal-root (rendered by [codeclove_portal] shortcode).
 */

import './init-i18n'
import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles/portal.css'
import App from './App'

function mount() {
  const config = window.CodeClovePortalConfig

  const rootElement = document.getElementById('codeclove-portal-root')
  if (!rootElement) {
    console.warn('[CodeClove Portal] Mount point #codeclove-portal-root not found in the DOM.')
    return
  }

  const isRtl = Boolean(config?.rtl)
  rootElement.dir = isRtl ? 'rtl' : 'ltr'

  // Pre-apply theme class before React renders to prevent flash of wrong theme
  try {
    const stored = localStorage.getItem('codeclove:portal-theme') || localStorage.getItem('codeclove:theme')
    const configMode = config?.settings?.appearance?.theme_mode || config?.settings?.appearance?.mode
    const effectiveMode = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : (configMode || 'system')
    const isDark = effectiveMode === 'dark' || (effectiveMode === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches)
    if (isDark) {
      rootElement.classList.add('dark')
    } else {
      rootElement.classList.remove('dark')
    }
  } catch {
    // Storage access fallback
  }
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
