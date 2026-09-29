/**
 * Portal Header Component.
 *
 * Displays school logo/title, student switcher, notifications bell,
 * user account info, maximize toggle, and logout action.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  ChevronDown,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react'
import { __, sprintf } from '@/lib/i18n'
import { usePortal } from '../lib/portal-context'
import { StudentSwitcher } from '../components/StudentSwitcher'
import { NotificationBell } from '../components/NotificationBell'
import { getInitials } from '../lib/formatter'
import { Badge } from '@/components/ui'

interface PortalHeaderProps {
  isMobileOpen: boolean
  onToggleMobileMenu: () => void
  isMaximized: boolean
  onToggleMaximize: () => void
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({
  isMobileOpen,
  onToggleMobileMenu,
  isMaximized,
  onToggleMaximize,
}) => {
  const { user, userRole, logoutUrl, students } = usePortal()
  const isPro = window.CodeClovePortalConfig?.isPro ?? false
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false)
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isUserMenuOpen])

  return (
    <header
      className={`shrink-0 flex h-14 sm:h-16 w-full items-center justify-between border-b border-border/70 bg-bg-surface px-4 sm:px-6 lg:px-8 relative z-20 ${
        isMaximized ? '' : 'rounded-t-2xl'
      }`}
    >
      {/* Left: Mobile hamburger & Logo */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-expanded={isMobileOpen}
          aria-controls="codeclove-portal-mobile-drawer"
          aria-label={isMobileOpen ? __( 'Close navigation menu', 'codeclove-school-management' ) : __( 'Open navigation menu', 'codeclove-school-management' )}
          className="rounded-lg p-2 text-text-subtle hover:text-text hover:bg-bg-base transition-colors border border-transparent hover:border-border/50 lg:hidden cursor-pointer"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <Link
          to="/"
          className="flex items-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg group"
        >
          <span className="text-base sm:text-lg font-bold tracking-tight text-text group-hover:text-brand transition-colors">
            {userRole === 'guardian' ? __( 'Parent Portal', 'codeclove-school-management' ) : __( 'Student Portal', 'codeclove-school-management' )}
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
          <StudentSwitcher />

          {students.length > 1 && (
            <div className="h-5 w-px bg-border/70 hidden sm:block mx-0.5" />
          )}
          {/* Notifications (Pro only) */}
          {isPro && <NotificationBell />}

          {/* Maximize / Minimize Toggle */}
          <button
            type="button"
            onClick={onToggleMaximize}
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-border/70 hover:border-border bg-bg-surface hover:bg-bg-base text-text-muted hover:text-text transition-all shadow-2xs cursor-pointer"
            title={isMaximized ? __( 'Minimize Portal (Esc)', 'codeclove-school-management' ) : __( 'Maximize Portal (Esc)', 'codeclove-school-management' )}
            aria-label={isMaximized ? __( 'Minimize Portal', 'codeclove-school-management' ) : __( 'Maximize Portal', 'codeclove-school-management' )}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* User Account Dropdown Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex h-10 items-center gap-2 pl-1.5 pr-2.5 rounded-xl border border-border/70 hover:border-border bg-bg-surface hover:bg-bg-base transition-all shadow-2xs text-left cursor-pointer"
              aria-expanded={isUserMenuOpen}
              aria-haspopup="true"
            >
              {/* Avatar */}
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-dim text-brand text-xs font-bold border border-brand/20 shrink-0">
                {user?.name ? getInitials(user.name) : <UserIcon className="w-3.5 h-3.5" />}
              </div>

              {/* Single clean name */}
              <span className="hidden md:inline text-xs font-semibold text-text leading-tight truncate max-w-28">
                {user?.name ?? __( 'Account', 'codeclove-school-management' )}
              </span>
              {userRole === 'admin' && (
                <span className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-brand-dim text-brand border border-brand/20">
                  {__( 'Admin', 'codeclove-school-management' )}
                </span>
              )}

              <ChevronDown
                className={`w-3.5 h-3.5 text-text-subtle transition-transform duration-150 hidden sm:block ${
                  isUserMenuOpen ? 'rotate-180 text-brand' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-bg-elevated shadow-modal border border-border/80 py-1 z-50 divide-y divide-border/50 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                {/* Identity Header */}
                <div className="px-3.5 py-2.5">
                  <p className="text-xs font-bold text-text truncate">
                    {user?.name ?? __( 'Account', 'codeclove-school-management' )}
                  </p>
                  {user?.email && (
                    <p className="text-3xs text-text-muted truncate mt-0.5">
                      {user.email}
                    </p>
                  )}
                  <div className="mt-1.5">
                    <Badge variant="brand" size="sm" className="capitalize text-3xs font-medium">
                      {userRole === 'guardian'
                        ? __( 'Parent Account', 'codeclove-school-management' )
                        : userRole === 'student'
                        ? __( 'Student Account', 'codeclove-school-management' )
                        : sprintf( __( '%s Account', 'codeclove-school-management' ), userRole )}
                    </Badge>
                  </div>
                </div>

                {/* Navigation Actions */}
                <div className="py-1">
                  <Link
                    to="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-text hover:bg-bg-base hover:text-brand transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-text-subtle" />
                    <span>{__( 'My Profile', 'codeclove-school-management' )}</span>
                  </Link>
                </div>

                {/* Admin Console Link (if admin user) */}
                {userRole === 'admin' && (
                  <div className="py-1">
                    <a
                      href="/wp-admin/admin.php?page=codeclove-school-management"
                      className="flex items-center justify-between px-3.5 py-2 text-xs font-medium text-brand hover:bg-brand-dim transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
                        <span>{__( 'Admin Console', 'codeclove-school-management' )}</span>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </div>
                )}
                {/* Sign Out / Logout */}
                <div className="pt-1">
                  <a
                    href={logoutUrl}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-danger hover:bg-danger-dim transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-danger" />
                    <span>{__( 'Sign Out', 'codeclove-school-management' )}</span>
                  </a>
                </div>
              </div>
            )}
          </div>
      </div>
    </header>
  )
}
