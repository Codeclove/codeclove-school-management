/**
 * Application shell — sidebar + header + main content area.
 *
 * Provides:
 *   - TooltipProvider (Radix requirement — must wrap all tooltips)
 *   - SessionProvider (global academic session context)
 *   - The persistent nav chrome (Sidebar + Header)
 *   - <Outlet /> for the current route's page component
 */
import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { __ } from '@/lib/i18n'
import { TooltipProvider } from '@/components/ui'
import { SessionProvider } from '@/lib/session-context'
import Sidebar from './Sidebar'
import Header from './Header'
import CommandPalette from '@/components/CommandPalette'

export default function AppShell() {
  const location = useLocation()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // ponytail: auto-close mobile sidebar drawer when navigating to a new route
  useEffect(() => {
    setIsMobileOpen(false)
  }, [location.pathname])

  return (
    <TooltipProvider>
      <SessionProvider>
        <div className="flex h-screen w-full overflow-hidden bg-bg-base relative">
          {/* Skip link for keyboard navigation (WCAG 2.2 2.4.1) */}
          <a
            href="#main-content"
            onClick={() => document.getElementById('main-content')?.focus()}
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:start-3 focus:px-4 focus:py-2 focus:bg-brand text-white focus:text-text-inverted focus:rounded-md focus:shadow-lg focus:font-medium focus:text-sm focus:outline-none focus:ring-2 focus:ring-brand-ring"
          >
            {__( 'Skip to main content', 'codeclove-school-management' )}
          </a>

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <Sidebar
            isMobileOpen={isMobileOpen}
            onCloseMobile={() => setIsMobileOpen(false)}
          />

          {/* ── Main Area (header + page content) ───────────────────────── */}
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Header
              onSearchClick={() => setIsSearchOpen(true)}
              onMobileMenuToggle={() => setIsMobileOpen((prev) => !prev)}
              isMobileMenuOpen={isMobileOpen}
            />

            {/* Page content */}
            <main id="main-content" tabIndex={-1} className="flex-1 w-full min-w-0 overflow-auto p-4 md:p-6 focus:outline-none">
              <div key={location.pathname} className="app-content-container w-full min-w-0 animate-slide-up">
                <Outlet />
              </div>
            </main>
          </div>
        </div>

        {/* Global Spotlight Search & Settings Command Palette */}
        <CommandPalette open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      </SessionProvider>
    </TooltipProvider>
  )
}
