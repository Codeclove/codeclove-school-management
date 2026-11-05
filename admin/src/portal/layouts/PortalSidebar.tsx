/**
 * Portal Sidebar Component.
 *
 * Provides desktop navigation and mobile off-canvas drawer.
 */

import React, { useEffect, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  Receipt,
  ScrollText,
  User,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { __ } from '@/lib/i18n'
import { usePortal } from '../lib/portal-context'
import { usePortalExams } from '../api/portal'

interface PortalSidebarProps {
  isMobileOpen: boolean
  onCloseMobile: () => void
}

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: string
  showUnread?: boolean
  pro?: boolean
}

export const PortalSidebar: React.FC<PortalSidebarProps> = ({
  isMobileOpen,
  onCloseMobile,
}) => {
  const { currentStudent, unreadCount } = usePortal()
  const isPro = window.CodeClovePortalConfig?.isPro ?? false
  const { data: examsData } = usePortalExams(currentStudent?.id)

  const hasAnyExamData = useMemo(() => {
    const hasAdmit = Boolean(
      (examsData?.admit_cards && examsData.admit_cards.length > 0) ||
      examsData?.upcoming_exams?.some((e) => e.can_download_admit_card && e.admit_card)
    )
    const hasReport = Boolean(examsData?.published_exams && examsData.published_exams.length > 0)
    const hasUpcoming = Boolean(examsData?.upcoming_exams && examsData.upcoming_exams.length > 0)
    return hasAdmit || hasReport || hasUpcoming
  }, [examsData])

  const navItems: NavItem[] = [
    { to: '/', label: __( 'Dashboard', 'codeclove-school-management' ), icon: LayoutDashboard },
    { to: '/attendance', label: __( 'Attendance', 'codeclove-school-management' ), icon: CalendarCheck },
    { to: '/finance', label: __( 'Finance', 'codeclove-school-management' ), icon: Receipt },
    { to: '/timetable', label: __( 'Timetable', 'codeclove-school-management' ), icon: CalendarClock, pro: true },
    { to: '/academics', label: __( 'Academics', 'codeclove-school-management' ), icon: GraduationCap },
    ...(hasAnyExamData
      ? [
          {
            to: '/examinations',
            label: __( 'Examinations', 'codeclove-school-management' ),
            icon: FileCheck2,
            pro: true,
          },
        ]
      : []),
    { to: '/certificates', label: __( 'Certificates', 'codeclove-school-management' ), icon: ScrollText, pro: true },
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
                cn(
                  'group flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-all',
                  isActive
                    ? 'bg-brand-dim text-brand font-semibold shadow-2xs'
                    : 'text-text-muted hover:bg-hover-bg hover:text-text font-medium'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      size={16}
                      strokeWidth={1.75}
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-brand' : 'text-text-subtle group-hover:text-text'
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={cn(
                        'text-3xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ml-auto shrink-0',
                        isActive
                          ? 'bg-brand/15 text-brand'
                          : 'border border-border bg-bg-surface text-text-subtle'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}

                  {item.showUnread && unreadCount > 0 && (
                    <span
                      className={cn(
                        'text-3xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center shrink-0 ml-auto',
                        isActive
                          ? 'bg-brand text-text-inverted'
                          : 'bg-brand-dim text-brand border border-brand/20'
                      )}
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
        aria-label={__( 'Sidebar Navigation', 'codeclove-school-management' )}
        className="hidden lg:flex flex-col flex-shrink-0 w-60 border-r border-border bg-bg-surface select-none z-20 overflow-y-auto"
      >
        {navContent}
      </aside>

      {/* Mobile Off-canvas Drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label={__( 'Mobile Navigation Drawer', 'codeclove-school-management' )}
        >
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-text/40 dark:bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-bg-surface border-r border-border shadow-xl z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer top close button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                {__( 'Menu', 'codeclove-school-management' )}
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-hover-bg transition-colors"
                aria-label={__( 'Close navigation menu', 'codeclove-school-management' )}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {navContent}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
