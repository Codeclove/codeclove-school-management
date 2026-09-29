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
