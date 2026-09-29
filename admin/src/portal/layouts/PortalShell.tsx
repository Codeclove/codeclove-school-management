/**
 * Portal Shell Layout.
 *
 * Provides responsive grid frame containing Header, Sidebar, and Main Page Outlet.
 * Supports maximize/minimize mode for fullscreen portal experience.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { __ } from '@/lib/i18n'
import { PortalHeader } from './PortalHeader'
import { PortalSidebar } from './PortalSidebar'
import { usePortal } from '../lib/portal-context'
import { Spinner, Card } from '@/components/ui'

export const PortalShell: React.FC = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const { isLoading, currentStudent, students } = usePortal()
  const originalParentRef = useRef<HTMLElement | null>(null)
  const originalNextRef = useRef<Node | null>(null)

  // Escape key exits browser maximize mode
  useEffect(() => {
    if (!isMaximized) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMaximized(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isMaximized])

  // Maximize: reparent portal root to <body> so position:fixed works across all themes
  // (Kadence, Hello Elementor, GeneratePress, Extra) regardless of ancestor transforms/containment.
  // Lock html/body scrolling and hide WP admin bar while keeping browser chrome visible.
  useEffect(() => {
    const root = document.getElementById('codeclove-portal-root')
    if (!root) return

    const adminBar = document.getElementById('wpadminbar')

    // Capture initial DOM position before any reparenting
    if (!originalParentRef.current && root.parentElement && root.parentElement !== document.body) {
      originalParentRef.current = root.parentElement
      originalNextRef.current = root.nextSibling
    }

    const restore = () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      if (adminBar) adminBar.style.display = ''
      root.classList.remove('codeclove-portal--maximized', 'portal-maximized')
      const parent = originalParentRef.current
      if (parent && root.parentElement === document.body) {
        const next = originalNextRef.current
        parent.insertBefore(root, next && parent.contains(next) ? next : null)
      }
    }

    if (isMaximized) {
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
      if (adminBar) adminBar.style.display = 'none'
      if (root.parentElement !== document.body) {
        document.body.appendChild(root)
      }
      root.classList.add('codeclove-portal--maximized', 'portal-maximized')
    } else {
      restore()
    }

    return restore
  }, [isMaximized])


  if (isLoading) {
    return (
      <div
        className={`flex w-full items-center justify-center bg-bg-base rounded-2xl border border-border/80 ${
          isMaximized ? 'h-screen' : 'min-h-[500px] h-[calc(100vh-6rem)]'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-xs font-medium text-text-muted">{__( 'Loading student portal...', 'codeclove-school-management' )}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`font-sans text-text antialiased selection:bg-brand selection:text-white flex flex-col ${
        isMaximized
          ? 'w-full h-full min-h-screen overflow-hidden bg-bg-base'
          : 'w-full rounded-2xl border border-border/80 bg-bg-surface shadow-card-md overflow-hidden min-h-[640px]'
      }`}
    >
      {/* Header */}
      <PortalHeader
        isMobileOpen={isMobileOpen}
        onToggleMobileMenu={() => setIsMobileOpen((prev) => !prev)}
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized((prev) => !prev)}
      />

      {/* Main Body */}
      <div className={`flex flex-1 ${isMaximized ? 'overflow-hidden' : ''}`}>
        <PortalSidebar
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
          isMaximized={isMaximized}
        />

        <main
          className={`flex-1 bg-bg-base px-4 py-6 sm:px-6 lg:px-8 ${
            isMaximized ? 'overflow-y-auto' : ''
          }`}
        >
          <div className="mx-auto max-w-7xl w-full">
            {students.length === 0 ? (
              <Card className="p-8 text-center shadow-card">
                <h3 className="text-base font-semibold text-text">{__( 'No Student Records Found', 'codeclove-school-management' )}</h3>
                <p className="mt-1 text-xs text-text-muted max-w-md mx-auto">
                  {__( 'Your account is not currently linked to any enrolled student records. Please contact the school administration to link your profile.', 'codeclove-school-management' )}
                </p>
              </Card>
            ) : !currentStudent ? (
              <Card className="p-8 text-center shadow-card">
                <p className="text-xs text-text-muted">{__( 'Please select a student to view their records.', 'codeclove-school-management' )}</p>
              </Card>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
