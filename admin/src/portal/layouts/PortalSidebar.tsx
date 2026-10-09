/**
 * Portal Sidebar Component.
 *
 * Provides desktop navigation and mobile off-canvas drawer.
 */

import React, { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bell,
  CalendarCheck,
  Clock,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  User,
  X,
} from 'lucide-react'
import { __ } from '@/lib/i18n'
import { usePortal } from '../lib/portal-context'

interface PortalSidebarProps {
  isMobileOpen: boolean
  onCloseMobile: () => void
  isMaximized?: boolean
}

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  showUnread?: boolean
  pro?: boolean
}

export const PortalSidebar: React.FC<PortalSidebarProps> = ({
  isMobileOpen,
  onCloseMobile,
  isMaximized,
}) => {
  const { unreadCount } = usePortal()
  const isPro = window.CodeClovePortalConfig?.isPro ?? false

  const navItems: NavItem[] = [
    { to: '/', label: __( 'Dashboard', 'codeclove-school-management' ), icon: LayoutDashboard },
    { to: '/attendance', label: __( 'Attendance', 'codeclove-school-management' ), icon: CalendarCheck },
    { to: '/finance', label: __( 'Finance', 'codeclove-school-management' ), icon: CreditCard },
    { to: '/timetable', label: __( 'Timetable', 'codeclove-school-management' ), icon: Clock, pro: true },
    { to: '/academics', label: __( 'Academics', 'codeclove-school-management' ), icon: GraduationCap },
    { to: '/notifications', label: __( 'Notifications', 'codeclove-school-management' ), icon: Bell, showUnread: true, pro: true },
    { to: '/profile', label: __( 'Profile', 'codeclove-school-management' ), icon: User },
  ].filter((item) => !item.pro || isPro)

  // Lock body scroll and listen for Escape key when mobile drawer is open
  useEffect(() => {
    if (!isMobileOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileOpen, onCloseMobile])

  const navContent = (
    <div className="flex h-full flex-col justify-between py-4">
      <nav className="space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `group flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand text-text-inverted shadow-xs'
                    : 'text-text-muted hover:bg-hover-bg hover:text-text'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-text-inverted' : 'text-text-subtle group-hover:text-text'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-3xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ml-auto shrink-0 ${
                        isActive
                          ? 'bg-black/15 text-text-inverted'
                          : 'border border-border bg-bg-surface text-text-subtle'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {item.showUnread && unreadCount > 0 && (
                    <span
                      className={`text-3xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center ${
                        isActive
                          ? 'bg-text-inverted text-brand'
                          : 'bg-danger text-white'
                      }`}
                    >
                      {unreadCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>


    </div>
  )

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:flex lg:w-56 xl:w-60 lg:flex-col lg:border-r lg:border-border lg:bg-bg-surface shrink-0 ${
          isMaximized ? 'h-full overflow-y-auto' : ''
        }`}
      >
        {navContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="codeclove-portal-backdrop fixed inset-0 bg-black/60 backdrop-blur-xs lg:hidden animate-in fade-in-50"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer Content */}
      <div
        id="codeclove-portal-mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={__( 'Navigation menu', 'codeclove-school-management' )}
        className={`codeclove-portal-drawer fixed inset-y-0 left-0 w-64 bg-bg-surface shadow-2xl transition-transform duration-200 ease-in-out lg:hidden flex flex-col overflow-y-auto border-r border-border ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        <div className="flex h-14 sm:h-16 items-center justify-between border-b border-border px-4 shrink-0 bg-bg-surface">
          <span className="text-sm font-bold text-text">{__( 'Navigation', 'codeclove-school-management' )}</span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label={__( 'Close navigation menu', 'codeclove-school-management' )}
            className="rounded-lg p-1.5 text-text-subtle hover:text-text hover:bg-hover-bg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {navContent}
      </div>
    </>
  )
}
