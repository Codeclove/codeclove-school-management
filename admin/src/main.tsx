/**
 * CodeClove School Management Admin — Application entry point.
 *
 * Mounts the React SPA into #codeclove-root (injected by PHP Assets::render_html).
 * All application setup (routing, queries, theming) is handled in <App />.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { initI18n } from './init-i18n'
import './styles/globals.css'
import App from './App'

function mount() {
  const rootElement = document.getElementById('codeclove-root')

  if (!rootElement) {
    throw new Error('[CodeClove] Mount point #codeclove-root not found in the DOM.')
  }

  const isRtl = Boolean(window.CodeCloveConfig?.rtl)
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
  rootElement.dir = isRtl ? 'rtl' : 'ltr'

  // Load translations before first render, then mount.
  // English users (i18nUrl = null) resolve immediately — no fetch, no delay.
  initI18n().then(() => {
    createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
