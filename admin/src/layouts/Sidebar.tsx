/**
 * Application sidebar navigation.
 *
 * Fully theme-aware — all hover/active states use CSS variables
 * defined in globals.css under :root and .dark, so no dark: prefixes needed.
 *
 * Changes from Phase 1:
 *   - Added missing nav items: Timetable, Student Import, Staff Import, Leave Requests
 *   - Groups match NAVIGATION.md exactly
 *   - Active-group indicator is visually consistent
 *   - Sidebar collapse/expand toggle anchored professionally in footer with compact split row
 */
import { useState, useCallback, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LifeBuoy,
  LayoutDashboard,
  GraduationCap,
  CalendarDays,
  BookOpen,
  BookMarked,
  Layers,
  Users,
  ClipboardList,
  CalendarCheck,
  UserCog,
  Briefcase,
  ShieldCheck,
  Wallet,
  BadgeDollarSign,
  FileText,
  CreditCard,
  Settings,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  Megaphone,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROUTES, PERMISSIONS } from '@/lib/constants'
import { useLabels } from '@/lib/labels'
import { usePermissions, type PermissionKey } from '@/lib/permissions'
import { Tooltip, Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui'
import { __ } from '@/lib/i18n'
import { isRtl } from '@/lib/rtl'
import { IS_MAC } from './Header'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem  { label: string; to: string; icon: LucideIcon; permission?: PermissionKey; end?: boolean; pro?: boolean }
interface NavGroup { id: string; label: string; icon: LucideIcon; items: NavItem[] }

import { useFeedbackModal } from '@/lib/feedback-context'
import { proNavItems } from '@/pro'
interface SidebarProps {
  isMobileOpen?: boolean
  onCloseMobile?: () => void
}

// ─── Sidebar Component ────────────────────────────────────────────────────────

export default function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const { openFeedback } = useFeedbackModal()
  const { getLabel } = useLabels()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('codeclove:nav-collapsed')
      return stored ? (JSON.parse(stored) as Record<string, boolean>) : {}
    } catch { return {} }
  })

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('codeclove:sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('codeclove:sidebar-collapsed', String(next))
      return next
    })
  }, [])

  // Keyboard shortcut: Cmd+B / Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return
        }
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  const toggleGroup = useCallback((id: string, defaultOpen: boolean) => {
    setCollapsed((prev) => {
      const isCurrentlyCollapsed = prev[id] !== undefined ? prev[id] : !defaultOpen
      const next = { ...prev, [id]: !isCurrentlyCollapsed }
      localStorage.setItem('codeclove:nav-collapsed', JSON.stringify(next))
      return next
    })
  }, [])

  const { can } = usePermissions()

  const isPro = window.CodeCloveConfig?.isPro ?? false
  const helpLabel = isPro ? __( 'Help & Feedback', 'codeclove-school-management' ) : __( 'Help & Support', 'codeclove-school-management' )

  // Navigation groups and items matching docs/NAVIGATION.md
  const rawNavGroups: NavGroup[] = [
    {
      id: 'academics', label: __( 'Academics', 'codeclove-school-management' ), icon: GraduationCap,
      items: [
        { label: getLabel('academic_session', true, __( 'Sessions', 'codeclove-school-management' )),             to: ROUTES.SESSIONS,  icon: CalendarDays, permission: PERMISSIONS.SESSIONS_VIEW },
        { label: getLabel('academic_unit',  true, __( 'Classes', 'codeclove-school-management' )),                to: ROUTES.UNITS,     icon: BookOpen,     permission: PERMISSIONS.UNITS_VIEW },
        { label: getLabel('academic_group', true, __( 'Sections', 'codeclove-school-management' )),               to: ROUTES.GROUPS,    icon: Layers,        permission: PERMISSIONS.GROUPS_VIEW },
        { label: getLabel('subject',        true, __( 'Subjects', 'codeclove-school-management' )),               to: ROUTES.SUBJECTS,  icon: BookMarked,    permission: PERMISSIONS.SUBJECTS_VIEW },
      ],
    },
    {
      id: 'students', label: getLabel('student', true, __( 'Students', 'codeclove-school-management' )), icon: Users,
      items: [
        { label: `${getLabel('student', false, __( 'Student', 'codeclove-school-management' ))} ${__( 'Directory', 'codeclove-school-management' )}`,          to: ROUTES.STUDENT_DIRECTORY, icon: Users, permission: PERMISSIONS.STUDENTS_VIEW, end: true },
        { label: __( 'Admissions', 'codeclove-school-management' ),                                                   to: ROUTES.ADMISSIONS,        icon: ClipboardList,  permission: PERMISSIONS.ADMISSIONS_VIEW },
        { label: __( 'Student Attendance', 'codeclove-school-management' ),                                          to: ROUTES.ATTENDANCE,        icon: CalendarCheck,  permission: PERMISSIONS.ATTENDANCE_VIEW },
        { label: __( 'Promotion & Rollover', 'codeclove-school-management' ),                                        to: ROUTES.PROMOTION_ROLLOVER, icon: RefreshCw,     permission: PERMISSIONS.STUDENTS_PROMOTE, pro: true },
      ],
    },
    {
      id: 'staff', label: getLabel('staff_member', true, __( 'Staff & HR', 'codeclove-school-management' )), icon: UserCog,
      items: [
        { label: `${getLabel('staff_member', false, __( 'Staff', 'codeclove-school-management' ))} ${__( 'Directory', 'codeclove-school-management' )}`,      to: ROUTES.STAFF_DIRECTORY,    icon: Briefcase,   permission: PERMISSIONS.STAFF_VIEW, end: true },
        { label: __( 'Staff Attendance', 'codeclove-school-management' ),                                           to: '/staff/attendance',       icon: CalendarCheck, permission: PERMISSIONS.STAFF_ATTENDANCE_VIEW },
        { label: __( 'Roles & Permissions', 'codeclove-school-management' ),  to: ROUTES.ROLES_PERMISSIONS,  icon: ShieldCheck,         permission: PERMISSIONS.ROLES_MANAGE },
      ],
    },
    {
      id: 'finance', label: __( 'Finance', 'codeclove-school-management' ), icon: Wallet,
      items: [
        { label: __( 'Overview', 'codeclove-school-management' ),                                      to: ROUTES.FINANCE_DASHBOARD, icon: Wallet,          permission: PERMISSIONS.FINANCE_VIEW, end: true, pro: true },
        { label: getLabel('fee_type', true, __( 'Fee Types', 'codeclove-school-management' )),         to: ROUTES.FEE_TYPES,         icon: BadgeDollarSign, permission: PERMISSIONS.FEE_TYPES_VIEW },
        { label: getLabel('invoice',  true, __( 'Invoices', 'codeclove-school-management' )),          to: ROUTES.INVOICES,          icon: FileText,        permission: PERMISSIONS.INVOICES_VIEW },
        { label: getLabel('payment',  true, __( 'Payments', 'codeclove-school-management' )),          to: ROUTES.PAYMENTS,          icon: CreditCard,      permission: PERMISSIONS.PAYMENTS_VIEW },
        { label: __( 'Defaulters Report', 'codeclove-school-management' ),                             to: ROUTES.DEFAULTERS_REPORT, icon: AlertTriangle,   permission: PERMISSIONS.FINANCE_VIEW, pro: true },
      ],
    },
  ]
  const mergedNavGroups = rawNavGroups.map((group) => {
    const extraProItems = proNavItems.filter((item) => item.groupId === group.id)
    if (!extraProItems.length) return group
    return {
      ...group,
      items: [...group.items, ...extraProItems],
    }
  })
  const resolvedNavGroups = mergedNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (!item.pro || isPro) && (!item.permission || can(item.permission))),
    }))
    .filter((group) => group.items.length > 0)

  const wpAdminUrl = window.CodeCloveConfig?.wpAdminUrl ?? '/wp-admin/'
  const shortcutLabel = IS_MAC ? '⌘B' : 'Ctrl+B'

  return (
    <>
      {/* ponytail: backdrop overlay on mobile drawer open */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={cn(
          "flex flex-col flex-shrink-0 h-full bg-bg-surface border-e border-border transition-all duration-300 relative z-50",
          "fixed inset-y-0 start-0 md:relative md:translate-x-0 md:z-auto",
          isMobileOpen ? "translate-x-0 shadow-xl" : "max-md:-translate-x-full max-md:rtl:translate-x-full md:translate-x-0",
          sidebarCollapsed ? "w-[64px]" : "w-[240px]"
        )}
        style={{ boxShadow: 'var(--shadow-sidebar)' }}
      >
        <SidebarBrand
          collapsed={sidebarCollapsed}
          onCloseMobile={onCloseMobile}
        />

        <nav id="sidebar-nav" className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <SidebarLink
            to={ROUTES.DASHBOARD}
            icon={LayoutDashboard}
            label={__( 'Dashboard', 'codeclove-school-management' )}
            sidebarCollapsed={sidebarCollapsed}
          />

          {resolvedNavGroups.map((group) => {
            const isAnyChildActive = group.items.some((item) =>
              location.hash.includes(item.to) || location.pathname.includes(item.to)
            )
            const isGroupCollapsed = collapsed[group.id] !== undefined ? !!collapsed[group.id] : !isAnyChildActive

            return (
              <SidebarGroup
                key={group.id}
                group={group}
                isCollapsed={isGroupCollapsed}
                onToggle={() => toggleGroup(group.id, isAnyChildActive)}
                sidebarCollapsed={sidebarCollapsed}
              />
            )
          })}

          {isPro && can(PERMISSIONS.NOTIFICATIONS_MANAGE) && (
            <SidebarLink
              to={ROUTES.ANNOUNCEMENTS}
              icon={Megaphone}
              label={__( 'Noticeboard', 'codeclove-school-management' )}
              sidebarCollapsed={sidebarCollapsed}
            />
          )}
        </nav>

        <div className="px-2 pb-2.5 border-t border-border pt-1.5 space-y-1">
          {!isPro && (
            sidebarCollapsed ? (
              <Tooltip content={__( 'Upgrade to Pro', 'codeclove-school-management' )} side={isRtl() ? 'left' : 'right'}>
                <div className="w-full flex justify-center py-0.5">
                  <NavLink
                    to="/pro-upgrade"
                    className={({ isActive }) =>
                      cn(
                        'w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150',
                        'bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/60',
                        isActive && 'ring-2 ring-amber-500 bg-amber-500/20'
                      )
                    }
                  >
                    <Sparkles size={16} className="text-amber-500" />
                  </NavLink>
                </div>
              </Tooltip>
            ) : (
              <NavLink
                to="/pro-upgrade"
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                    'bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 hover:from-amber-500/25 hover:via-amber-500/20 hover:to-amber-500/10',
                    'border border-amber-500/30 hover:border-amber-500/60 text-amber-900 dark:text-amber-200 shadow-xs',
                    isActive && 'ring-2 ring-amber-500/50 from-amber-500/25 border-amber-500/70'
                  )
                }
              >
                <div className="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Sparkles size={14} className="text-amber-600 dark:text-amber-400 fill-amber-500/20" />
                </div>
                <span className="truncate leading-tight font-medium">
                  {__( 'Upgrade to Pro', 'codeclove-school-management' )}
                </span>
                <span className="ms-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs">
                  Pro
                </span>
              </NavLink>
            )
          )}
          {/* Help & Feedback Button */}
          {sidebarCollapsed ? (
            <Tooltip content={helpLabel} side={isRtl() ? 'left' : 'right'}>
              <div className="w-full flex justify-center py-0.5">
                <button
                  type="button"
                  onClick={() => openFeedback()}
                  className="w-9 h-9 mx-auto flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-hover-bg transition-colors duration-150 cursor-pointer"
                  aria-label={helpLabel}
                >
                  <LifeBuoy size={16} className="text-text-subtle hover:text-text" />
                </button>
              </div>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={() => openFeedback()}
              className="w-full flex items-center rounded-md px-2.5 py-1.5 gap-2.5 text-sm text-text-muted hover:text-text hover:bg-hover-bg transition-colors duration-150 group cursor-pointer"
            >
              <LifeBuoy size={16} className="flex-shrink-0 text-text-subtle group-hover:text-text transition-colors" />
              <span className="text-sm leading-snug sidebar-link-text truncate min-w-0">
                {helpLabel}
              </span>
            </button>
          )}

          {can(PERMISSIONS.SETTINGS_MANAGE) && (
            <SidebarLink
              to={ROUTES.SETTINGS}
              icon={Settings}
              label={__( 'Settings', 'codeclove-school-management' )}
              sidebarCollapsed={sidebarCollapsed}
            />
          )}

          {/* Collapsed icon-rail: 3 uniform icons (Settings, WP Admin, Expand) */}
          {sidebarCollapsed ? (
            <>
              <Tooltip content={__( 'WordPress Admin', 'codeclove-school-management' )} side={isRtl() ? 'left' : 'right'}>
                <a
                  href={wpAdminUrl}
                  className="w-9 h-9 mx-auto flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-hover-bg transition-colors duration-150"
                  aria-label={__( 'WordPress Admin', 'codeclove-school-management' )}
                >
                  <ExternalLink size={16} className="text-text-subtle hover:text-text" />
                </a>
              </Tooltip>

              <Tooltip
                content={`${__( 'Expand Sidebar', 'codeclove-school-management' )} (${shortcutLabel})`}
                side={isRtl() ? 'left' : 'right'}
              >
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="hidden md:flex w-9 h-9 mx-auto items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-hover-bg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                  aria-label={`${__( 'Expand Sidebar', 'codeclove-school-management' )} (${shortcutLabel})`}
                >
                  <PanelLeftOpen size={16} className="rtl:-scale-x-100 flex-shrink-0 text-text-subtle hover:text-text" />
                </button>
              </Tooltip>
            </>
          ) : (
            /* Expanded state: Compact side-by-side bottom split row */
            <div className="flex items-center justify-between gap-1 pt-1 mt-0.5 border-t border-border/50">
              <a
                href={wpAdminUrl}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-text-muted hover:text-text hover:bg-hover-bg transition-colors duration-150 min-w-0 flex-1 group"
                title={__( 'WordPress Admin', 'codeclove-school-management' )}
              >
                <ExternalLink size={14} className="flex-shrink-0 text-text-subtle group-hover:text-text transition-colors" />
                <span className="truncate sidebar-link-text">{__( 'WP Admin', 'codeclove-school-management' )}</span>
              </a>

              <Tooltip
                content={`${__( 'Collapse Sidebar', 'codeclove-school-management' )} (${shortcutLabel})`}
                side="top"
              >
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="hidden md:flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-hover-bg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring flex-shrink-0 group"
                  aria-label={`${__( 'Collapse Sidebar', 'codeclove-school-management' )} (${shortcutLabel})`}
                >
                  <PanelLeftClose
                    size={14}
                    className="flex-shrink-0 text-text-subtle group-hover:text-text transition-colors rtl:-scale-x-100"
                  />
                  <span className="text-xs sidebar-link-text">{__( 'Collapse', 'codeclove-school-management' )}</span>
                  <kbd className="sidebar-link-text text-[10px] font-mono text-text-subtle border border-border/80 rounded px-1 py-0.5 bg-bg-surface-hover/50">
                    {shortcutLabel}
                  </kbd>
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface SidebarBrandProps {
  collapsed: boolean
  onCloseMobile?: () => void
}

function SidebarBrand({ collapsed, onCloseMobile }: SidebarBrandProps) {
  return (
    <div className={cn(
      "flex items-center h-[52px] border-b border-border flex-shrink-0 sidebar-brand transition-all duration-200",
      collapsed ? "justify-center px-2" : "px-3 justify-between"
    )}>
      <NavLink
        to={ROUTES.DASHBOARD}
        className={cn(
          "flex items-center gap-2.5 min-w-0 rounded-md py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring group",
          collapsed ? "justify-center" : "flex-1"
        )}
        title={collapsed ? `${__( 'CodeClove', 'codeclove-school-management' )} — ${__( 'Dashboard', 'codeclove-school-management' )}` : undefined}
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-brand-strong flex items-center justify-center flex-shrink-0 shadow-xs transition-transform duration-150 group-hover:scale-105">
          <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
            <path d="M3 4h14M3 10h10M3 16h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 sidebar-brand-text animate-fade-in whitespace-nowrap">
            <p className="text-sm font-bold text-text leading-tight group-hover:text-brand transition-colors">CodeClove</p>
            <p className="text-xs text-text-muted leading-tight mt-0.5">{__( 'School Management', 'codeclove-school-management' )}</p>
          </div>
        )}
      </NavLink>

      {/* Close button for mobile slide-in drawer */}
      {!collapsed && onCloseMobile && (
        <button
          type="button"
          onClick={onCloseMobile}
          className="flex md:hidden items-center justify-center w-7 h-7 rounded-md text-text-subtle hover:text-text hover:bg-hover-bg transition-colors"
          aria-label={__( 'Close menu', 'codeclove-school-management' )}
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}

interface SidebarGroupProps {
  group: NavGroup
  isCollapsed: boolean
  onToggle: () => void
  sidebarCollapsed?: boolean
}

function SidebarGroup({ group, isCollapsed, onToggle, sidebarCollapsed = false }: SidebarGroupProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const isAnyChildActive = group.items.some((item) =>
    location.hash.includes(item.to) || location.pathname.includes(item.to)
  )

  if (sidebarCollapsed) {
    return (
      <Dropdown
        align="start"
        sideOffset={10}
        trigger={
          <button
            className={cn(
              'w-9 h-9 mx-auto flex items-center justify-center rounded-md transition-colors duration-150',
              isAnyChildActive ? 'bg-brand-dim text-brand font-medium' : 'text-text-subtle hover:text-text hover:bg-hover-bg'
            )}
            title={group.label}
          >
            <group.icon
              size={16}
              className={isAnyChildActive ? 'text-brand' : 'text-text-subtle'}
            />
          </button>
        }
      >
        <DropdownLabel>{group.label}</DropdownLabel>
        <DropdownSeparator />
        {group.items.map((item) => (
          <DropdownItem
            key={item.to}
            icon={item.icon}
            label={item.label}
            onClick={() => navigate(item.to)}
          />
        ))}
      </Dropdown>
    )
  }

  const open = !isCollapsed

  return (
    <div className="pt-0.5">
      <button
        id={`sidebar-group-btn-${group.id}`}
        aria-expanded={open}
        aria-controls={`sidebar-group-${group.id}`}
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm',
          'transition-colors duration-150',
          isAnyChildActive
            ? 'text-text font-semibold'
            : 'text-text-muted hover:text-text hover:bg-hover-bg'
        )}
      >
        <group.icon
          size={16}
          className={cn('flex-shrink-0 transition-colors', isAnyChildActive ? 'text-brand' : 'text-text-subtle')}
        />
        <span className="flex-1 text-start sidebar-group-title truncate min-w-0 font-medium">
          {group.label}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            'text-text-subtle transition-transform duration-200 sidebar-group-chevron flex-shrink-0',
            !open && '-rotate-90 rtl:rotate-90'
          )}
        />
      </button>

      <div
        id={`sidebar-group-${group.id}`}
        role="region"
        aria-labelledby={`sidebar-group-btn-${group.id}`}
        className={cn(
          'overflow-hidden transition-all duration-200',
          !open ? 'max-h-0 opacity-0 invisible pointer-events-none' : 'max-h-[600px] opacity-100 visible'
        )}
      >
        <div className="mt-0.5 ms-4 ps-2.5 border-s border-border/60 space-y-0.5">
          {group.items.map((item) => (
            <SidebarLink key={item.to} {...item} isChild />
          ))}
        </div>
      </div>
    </div>
  )
}

interface SidebarLinkProps {
  to: string
  icon: LucideIcon
  label: string
  isChild?: boolean
  end?: boolean
  sidebarCollapsed?: boolean
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  isChild = false,
  end,
  sidebarCollapsed = false,
}: SidebarLinkProps) {
  const link = (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-md w-full transition-colors duration-150',
          sidebarCollapsed
            ? 'justify-center w-9 h-9 mx-auto'
            : isChild ? 'px-2.5 py-1.5 gap-2 text-sm' : 'px-2.5 py-1.5 gap-2.5 text-sm',
          isActive
            ? 'bg-brand-dim text-brand font-medium'
            : 'text-text-muted hover:text-text hover:bg-hover-bg'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={16}
            className={cn('flex-shrink-0 transition-colors', isActive ? 'text-brand' : 'text-text-subtle')}
          />
          {!sidebarCollapsed && (
            <span className="text-sm leading-snug sidebar-link-text truncate min-w-0">
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  )

  if (sidebarCollapsed) {
    return (
      <Tooltip content={label} side={isRtl() ? 'left' : 'right'}>
        <div className="w-full flex justify-center py-0.5">
          {link}
        </div>
      </Tooltip>
    )
  }

  return link
}
