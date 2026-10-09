/**
 * Application header.
 *
 * Contains:
 *   - Academic session selector (wired to SessionContext)
 *   - Global search button (Cmd+K)
 *   - Notifications
 *   - Quick create menu
 *   - Theme toggle (light / dark / system)
 *   - User avatar dropdown
 *
 * All dropdowns use the Radix-backed <Dropdown> component for proper
 * a11y and keyboard navigation. Icon-only buttons use <Tooltip>.
 */
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, LogOut, User, Bell,
  Sun, Moon, Monitor, CalendarDays, Menu, ChevronDown, Check,
  Settings, UserPlus, Receipt, Briefcase, Megaphone,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROUTES, PERMISSIONS } from '@/lib/constants'
import { usePermissions, type PermissionKey } from '@/lib/permissions'
import { useTheme, type ThemeMode } from '@/lib/theme'
import { useSettings, useUpdateSettings } from '@/api/settings'
import { useSession } from '@/lib/session-context'
import { useSessions } from '@/api/academics'
import { useToast } from '@/lib/toast'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/api/notifications'
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  Badge,
  Skeleton,
  Avatar,
} from '@/components/ui'
import { __ } from '@/lib/i18n'
// ─── Header Component ─────────────────────────────────────────────────────────

interface HeaderProps {
  onSearchClick?: () => void
  onMobileMenuToggle?: () => void
  isMobileMenuOpen?: boolean
}

export default function Header({ onSearchClick, onMobileMenuToggle, isMobileMenuOpen = false }: HeaderProps) {
  const isPro = window.CodeCloveConfig?.isPro ?? false

  return (
    <header
      role="banner"
      className="flex items-center justify-between flex-shrink-0 h-[52px] px-3 md:px-4 gap-2 md:gap-3 bg-bg-surface border-b border-border z-30"
      style={{ boxShadow: 'var(--shadow-header)' }}
    >
      {/* ── Left ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMobileMenuToggle}
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileMenuOpen}
          aria-controls="sidebar-nav"
          className="flex md:hidden items-center justify-center w-8 h-8 rounded text-text-subtle hover-bg transition-colors duration-100"
        >
          <Menu size={18} />
        </button>
        <SessionSelector />
      </div>

      {/* ── Right ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <SearchButton onClick={onSearchClick} />
        <QuickCreateButton />
        {isPro && <NotificationsButton />}
        <div className="hidden sm:inline-flex"><ThemeToggle /></div>
        <Separator className="hidden sm:inline-flex" />
        <UserMenu />
      </div>
    </header>
  )
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function Separator({ className }: { className?: string }) {
  return <span className={cn('h-4 w-px mx-0.5 bg-border flex-shrink-0', className)} />
}

// ─── Session Selector ─────────────────────────────────────────────────────────

const SESSION_BADGE_VARIANT: Record<string, 'success' | 'info' | 'default'> = {
  active:   'success',
  future:   'info',
  archived: 'default',
}

const SESSION_BADGE_LABEL: Record<string, string> = {
  active:   'Current',
  future:   'Future',
  archived: 'Archived',
}

function SessionSelector() {
  const navigate = useNavigate()
  const { session, setSession } = useSession()
  const { data, isLoading } = useSessions({ per_page: 100 })
  const toast = useToast()

  const dbSessions = useMemo(() => data?.data ?? [], [data])

  // Auto-select the active session on first load or when session is stale after re-seeding
  useEffect(() => {
    if (dbSessions.length > 0) {
      const currentDb = dbSessions.find((s) => s.is_current) ?? dbSessions[0]!
      const isSessionValid = session && dbSessions.some((s) => s.id === session.id)

      if (!session || !isSessionValid) {
        setSession({
          id:     currentDb.id,
          label:  currentDb.name.replace(/\s*academic\s*year/gi, ''),
          status: currentDb.status === 'draft' ? 'future' : currentDb.status,
        })
      }
    }
  }, [dbSessions, session, setSession])

  if (isLoading || (dbSessions.length > 0 && !session)) {
    return <Skeleton className="h-8 w-44 rounded" />
  }

  const current = session ?? { id: 0, label: 'No Session', status: 'future' as const }

  return (
    <Dropdown
      align="start"
      className="w-60"
      trigger={
        <button
          aria-label={`Academic session: ${current.label}`}
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded text-sm font-medium min-w-0',
            'text-text-muted hover-bg border border-border transition-colors duration-100'
          )}
        >
          <CalendarDays size={14} className="text-text-subtle flex-shrink-0" />
          <span className="min-w-0 flex items-center">
            <span className="hidden sm:inline text-text-subtle me-1.5">{__( 'Session', 'codeclove-school-management' )}</span>
            <span className="text-text font-semibold truncate max-w-[110px] sm:max-w-[180px] md:max-w-none">{current.label}</span>
          </span>
          <Badge
            variant={SESSION_BADGE_VARIANT[current.status]}
            size="sm"
            className="flex-shrink-0 hidden sm:inline-flex"
          >
            {__( SESSION_BADGE_LABEL[current.status] ?? 'Current', 'codeclove-school-management' )}
          </Badge>
          <ChevronDown size={13} className="text-text-subtle opacity-70 flex-shrink-0 ms-0.5" />
        </button>
      }
    >
      <DropdownLabel>{__( 'Academic Sessions', 'codeclove-school-management' )}</DropdownLabel>
      {dbSessions.length === 0 ? (
        <div className="px-3 py-3 text-center">
          <p className="text-xs text-text-subtle">{__( 'No academic sessions found.', 'codeclove-school-management' )}</p>
        </div>
      ) : (
        dbSessions.map((s) => {
          const mappedStatus = s.status === 'draft' ? 'future' : s.status
          const label = s.name.replace(/\s*academic\s*year/gi, '')
          return (
            <DropdownItem
              key={s.id}
              onClick={() => {
                setSession({
                  id:     s.id,
                  label:  label,
                  status: mappedStatus,
                })
                toast.success(`Switched active session to ${label}`)
              }}
              className={cn(
                'w-full flex items-center justify-between py-2 rounded-md',
                current.id === s.id && 'text-text font-medium bg-brand-dim'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {current.id === s.id ? (
                  <Check size={14} className="text-brand flex-shrink-0" aria-hidden="true" />
                ) : (
                  <span className="w-3.5 flex-shrink-0" aria-hidden="true" />
                )}
                <span className="font-medium truncate">{label}</span>
                {current.id === s.id && <span className="sr-only">(current)</span>}
              </div>
              <Badge variant={SESSION_BADGE_VARIANT[mappedStatus]} size="sm">
                {__( SESSION_BADGE_LABEL[mappedStatus] ?? 'Current', 'codeclove-school-management' )}
              </Badge>
            </DropdownItem>
          )
        })
      )}
      <DropdownSeparator />
      <DropdownItem
        icon={Settings}
        label={__( 'Manage Sessions', 'codeclove-school-management' )}
        onClick={() => navigate(ROUTES.SESSIONS)}
      />
    </Dropdown>
  )
}

// ─── Search Button ────────────────────────────────────────────────────────────

export function getSearchShortcut(platformStr: string): string {
  return /mac|iphone|ipad|ipod/i.test(platformStr) ? '⌘K' : 'Ctrl+K'
}

export const IS_MAC = typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(
  (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || navigator.userAgent || ''
)

function SearchButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-center md:justify-start gap-2 h-8 px-2 md:px-2.5 py-1.5 rounded text-sm',
        'text-text-subtle border border-border',
        'transition-colors duration-100 w-8 md:w-36 lg:w-44',
        'hover-bg'
      )}
      aria-label={`Search (${IS_MAC ? 'Cmd+K' : 'Ctrl+K'})`}
    >
      <Search size={14} className="flex-shrink-0" />
      <span className="hidden md:inline flex-1 text-start">{__( 'Search...', 'codeclove-school-management' )}</span>
      <kbd className="hidden md:inline-block text-xs font-mono bg-bg-elevated px-1.5 py-0.5 rounded border border-border">
        {IS_MAC ? '⌘K' : 'Ctrl+K'}
      </kbd>
    </button>
  )
}

// ─── Relative Time Helper ─────────────────────────────────────────────────────

export function formatRelativeTime(dateString: string, now: Date = new Date()): string {
  const date = new Date(dateString)
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (Number.isNaN(diffSec) || diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

export function getNotificationButtonAriaLabel(unreadCount: number): string {
  return unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'
}

function NotificationsButton() {
  const navigate = useNavigate()
  const { data, isLoading } = useNotifications(1, 20)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const notifications = data?.items ?? []
  const unreadCount = data?.unread_count ?? 0

  return (
    <Dropdown
      align="end"
      className="w-80 p-0"
      trigger={
        <button
          className="relative w-8 h-8 flex items-center justify-center rounded text-text-subtle transition-colors duration-100 hover-bg"
          aria-label={getNotificationButtonAriaLabel(unreadCount)}
        >
          <Bell size={16} />
          {/* aria-live: announced when unread count changes */}
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : ''}
          </span>
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -end-1 min-w-4 h-4 px-1 rounded-full bg-brand text-[10px] font-bold text-text-inverted flex items-center justify-center leading-none ring-2 ring-bg-surface shadow-xs tabular-nums select-none animate-in zoom-in-50"
              aria-hidden="true"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-bg-surface">
        <span className="text-xs font-bold text-text">{__( 'Notifications', 'codeclove-school-management' )}</span>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-2xs text-brand hover:text-brand-strong font-medium hover:underline transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
        {isLoading ? (
          <div className="p-3 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-3/4 rounded" />
                <Skeleton className="h-2.5 w-full rounded" />
                <Skeleton className="h-2 w-1/3 rounded" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-subtle">No new notifications.</div>
        ) : (
          notifications.map((item) => (
            <DropdownItem
              key={item.id}
              onClick={() => {
                if (!item.is_read) {
                  markRead.mutate(item.id)
                }
                if (item.url) {
                  navigate(item.url)
                }
              }}
              className={cn(
                'w-full text-start px-3.5 py-2.5 flex items-start gap-2.5 transition-colors duration-100 cursor-pointer rounded-none',
                !item.is_read && 'bg-brand-dim/15'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className={cn('text-xs text-text leading-snug', !item.is_read ? 'font-bold' : 'font-semibold')}>
                    {item.title}
                  </p>
                  {!item.is_read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5 leading-normal">{item.content}</p>
                <p className="text-2xs text-text-subtle mt-1">
                  {formatRelativeTime(item.created_at)}
                </p>
              </div>
            </DropdownItem>
          ))
        )}
      </div>

      <div className="p-1 border-t border-border bg-bg-surface">
        <DropdownItem
          label={__( 'View all announcements', 'codeclove-school-management' )}
          onClick={() => navigate(ROUTES.ANNOUNCEMENTS)}
          className="justify-center text-xs font-medium text-brand hover:text-brand-strong py-2 cursor-pointer text-center"
        />
      </div>
    </Dropdown>
  )
}

// ─── Quick Create ─────────────────────────────────────────────────────────────

export const QUICK_CREATE_ACTIONS: Array<{
  label: string
  to: string
  icon: LucideIcon
  permission: PermissionKey | PermissionKey[]
}> = [
  { label: __( 'Create Invoice', 'codeclove-school-management' ),   to: ROUTES.INVOICE_NEW,       icon: Receipt,       permission: PERMISSIONS.INVOICES_ADD },
  { label: __( 'Admit Student', 'codeclove-school-management' ),    to: ROUTES.STUDENT_NEW,       icon: UserPlus,      permission: [PERMISSIONS.STUDENTS_ADD, PERMISSIONS.ADMISSIONS_ADD] },
  { label: __( 'New Staff Record', 'codeclove-school-management' ), to: ROUTES.STAFF_NEW,         icon: Briefcase,     permission: PERMISSIONS.STAFF_ADD },
  { label: __( 'New Announcement', 'codeclove-school-management' ), to: `${ROUTES.ANNOUNCEMENTS}?create=true`, icon: Megaphone, permission: PERMISSIONS.NOTIFICATIONS_MANAGE },
]

function QuickCreateButton() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const isPro = window.CodeCloveConfig?.isPro ?? false

  const permittedActions = QUICK_CREATE_ACTIONS.filter((action) => {
    if (!isPro && action.to.includes(ROUTES.ANNOUNCEMENTS)) {
      return false
    }
    if (Array.isArray(action.permission)) {
      return action.permission.some((p) => can(p))
    }
    return can(action.permission)
  })

  return (
    <Dropdown
      trigger={
        <button
          aria-label={__( 'Quick create menu', 'codeclove-school-management' )}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded bg-brand text-text-inverted font-medium text-sm hover:bg-brand-strong transition-colors duration-100"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">{__( 'New', 'codeclove-school-management' )}</span>
          <ChevronDown size={12} className="opacity-80 hidden sm:inline" />
        </button>
      }
    >
      <DropdownLabel>{__( 'Quick Create', 'codeclove-school-management' )}</DropdownLabel>
      {permittedActions.map((action) => (
        <DropdownItem
          key={action.label}
          label={action.label}
          icon={action.icon}
          onClick={() => navigate(action.to)}
        />
      ))}
    </Dropdown>
  )
}

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

const THEME_CONFIG: Array<{ mode: ThemeMode; label: string; icon: LucideIcon }> = [
  { mode: 'light',  label: 'Light',  icon: Sun     },
  { mode: 'dark',   label: 'Dark',   icon: Moon    },
  { mode: 'system', label: 'System', icon: Monitor },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { data: settings } = useSettings()
  const updateSettingsMutation = useUpdateSettings()

  const current = THEME_CONFIG.find((t) => t.mode === theme) ?? THEME_CONFIG[2]!
  const Icon = current.icon

  return (
    <Dropdown
      trigger={
        <button
          aria-label={`Theme: ${current.label}`}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded',
            'text-text-muted transition-colors duration-100 hover-bg'
          )}
        >
          <Icon size={15} />
        </button>
      }
      className="w-36"
    >
      {THEME_CONFIG.map(({ mode, label, icon: ModeIcon }) => (
        <DropdownItem
          key={mode}
          label={label}
          icon={ModeIcon}
          onClick={() => {
            setTheme(mode)
            if (settings) {
              updateSettingsMutation.mutate({
                appearance: { ...settings.appearance, mode },
              })
            }
          }}
          className={theme === mode ? 'text-brand font-medium bg-brand-dim/30' : undefined}
        />
      ))}
    </Dropdown>
  )
}

// ─── User Menu ────────────────────────────────────────────────────────────────

export function getSignOutUrl(config?: { adminUrl?: string; logoutUrl?: string }): string {
  return config?.logoutUrl || (config?.adminUrl
    ? `${config.adminUrl.replace(/wp-admin\/.*$/, '')}wp-login.php?action=logout`
    : '/wp-login.php?action=logout')
}

function UserMenu() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const user = window.CodeCloveConfig?.currentUser

  const handleSignOut = () => {
    window.location.href = getSignOutUrl(window.CodeCloveConfig)
  }

  return (
    <Dropdown
      trigger={
        <button
          aria-label={__( 'User menu', 'codeclove-school-management' )}
          className="flex items-center gap-2 ps-1 pe-2 py-1 rounded hover-bg transition-colors duration-100"
        >
          <UserAvatar name={user?.name ?? 'Admin'} avatar={user?.avatar} size={28} />
          <div className="text-start hidden sm:block min-w-0">
            <p className="text-sm font-medium text-text leading-none max-w-[90px] md:max-w-[130px] truncate">
              {user?.name ?? 'Admin'}
            </p>
            {user?.isAdmin && (
              <p className="text-xs text-text-muted leading-none mt-1">
                {__( 'Administrator', 'codeclove-school-management' )}
              </p>
            )}
          </div>
        </button>
      }
      className="w-52"
    >
      {/* User info header */}
      <div className="px-3 py-2.5 border-b border-border mb-1">
        <p className="text-sm font-semibold text-text">{user?.name ?? 'Admin'}</p>
        {user?.email && (
          <p className="text-xs text-text-muted truncate">{user.email}</p>
        )}
      </div>

      <DropdownItem icon={User} label={__( 'My Profile', 'codeclove-school-management' )} onClick={() => navigate(ROUTES.MY_ACCOUNT)} />
      {(user?.isAdmin || can(PERMISSIONS.SETTINGS_MANAGE)) && (
        <DropdownItem icon={Settings} label={__( 'Settings', 'codeclove-school-management' )} onClick={() => navigate(ROUTES.SETTINGS)} />
      )}
      <DropdownSeparator />
      <DropdownItem
        icon={LogOut}
        label={__( 'Sign Out', 'codeclove-school-management' )}
        danger
        onClick={handleSignOut}
      />
    </Dropdown>
  )
}

// ─── User Avatar ─────────────────────────────────────────────────────────────

function UserAvatar({
  name,
  avatar,
}: {
  name: string
  avatar?: string
  size?: number
}) {
  return (
    <Avatar
      name={name}
      photoUrl={avatar}
      size="sm"
      shape="circle"
    />
  )
}
