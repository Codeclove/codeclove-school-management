import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLabels } from '@/lib/labels'
import { ROUTES, PERMISSIONS } from '@/lib/constants'
import { usePermissions, type PermissionKey } from '@/lib/permissions'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'
import {
  Search,
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  BookMarked,
  Layers,
  Users,
  UserPlus,
  ClipboardList,
  Clock,
  CalendarCheck,
  Briefcase,
  ShieldCheck,
  Wallet,
  BadgeDollarSign,
  FileText,
  CreditCard,
  Settings,
  ArrowLeft,
  ArrowRight,
  Sun,
  Moon,
  UserCheck,
  Sparkles,
  Megaphone,
  type LucideIcon,
} from 'lucide-react'

interface SearchItem {
  id: string
  title: string
  subtitle?: string
  category: 'Navigation' | 'Settings' | 'Actions'
  to?: string
  externalUrl?: string
  action?: () => void
  icon: LucideIcon
  keywords?: string
  pro?: boolean
  permission?: PermissionKey
}
const CATEGORY_LABELS: Record<string, string> = {
  Navigation: __('Navigation', 'codeclove-school-management'),
  Settings: __('Settings', 'codeclove-school-management'),
  Actions: __('Quick Actions', 'codeclove-school-management'),
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { getLabel } = useLabels()
  const { theme, setTheme } = useTheme()
  const isPro = window.CodeCloveConfig?.isPro ?? false
  const { can } = usePermissions()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const activeRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastMousePos = useRef({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    if (e.clientX === lastMousePos.current.x && e.clientY === lastMousePos.current.y) {
      return
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY }
    setSelectedIndex(index)
  }

  // Reset search and selection on open/close, and handle manual autofocus
  useEffect(() => {
    if (open) {
      setSearchQuery('')
      setSelectedIndex(0)
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true })
      }, 100)
      return () => clearTimeout(timer)
    } else {
      setSearchQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  // Global keyboard listener to open/close command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  // Build searchable items using dynamic terminology
  const items = useMemo<SearchItem[]>(() => {
    const classLabel = getLabel('academic_unit', true, 'Classes')
    const sectionLabel = getLabel('academic_group', true, 'Sections')
    const subjectLabel = getLabel('subject', true, 'Subjects')
    const admissionLabel = getLabel('admission_application', true, 'Admissions')
    const attendanceLabel = getLabel('attendance_record', true, 'Attendance')
    const feeLabel = getLabel('fee_type', true, 'Fee Types')
    const invoiceLabel = getLabel('invoice', true, 'Invoices')
    const paymentLabel = getLabel('payment', true, 'Payments')
    const studentLabelSingular = getLabel('student', false, 'Student')
    const studentLabelPlural = getLabel('student', true, 'Students')
    const staffLabelSingular = getLabel('staff_member', false, 'Staff')
    const staffLabelPlural = getLabel('staff_member', true, 'Staff')

    const wpAdminUrl = window.CodeCloveConfig?.wpAdminUrl ?? window.CodeCloveConfig?.adminUrl?.replace(/admin\.php\?page=[^&]+/, '') ?? '/wp-admin/'

    const rawItems: SearchItem[] = [
      ...(!isPro ? [{
        id: 'pro-upgrade',
        title: __('Upgrade to CodeClove Pro', 'codeclove-school-management'),
        subtitle: __('Unlock Timetable Matrix, SMS Alerts, Defaulters Report, and Student Promotion', 'codeclove-school-management'),
        category: 'Navigation' as const,
        to: '/pro-upgrade',
        icon: Sparkles,
        keywords: 'upgrade pro premium license buy purchase pricing features timetable sms defaulters unlock',
      }] : []),
      // Navigation Category
      {
        id: 'dashboard',
        title: 'Dashboard',
        subtitle: 'Overview of school metrics, statistics, and shortcuts',
        category: 'Navigation',
        to: ROUTES.DASHBOARD,
        icon: LayoutDashboard,
        keywords: 'dashboard overview home main stats metrics index',
      },
      {
        id: 'sessions',
        title: 'Academic Sessions',
        subtitle: 'Configure academic years, terms, and active session status',
        category: 'Navigation',
        to: ROUTES.SESSIONS,
        icon: CalendarDays,
        keywords: 'sessions academic year calendar term schedule draft active archived',
      },
      {
        id: 'units',
        title: classLabel,
        subtitle: `Manage grades, classrooms, and ${classLabel.toLowerCase()}`,
        category: 'Navigation',
        to: ROUTES.UNITS,
        icon: BookOpen,
        keywords: 'classes academic units grades rooms courses levels ' + classLabel.toLowerCase(),
      },
      {
        id: 'groups',
        title: sectionLabel,
        subtitle: `Organize student batches, sections, and ${sectionLabel.toLowerCase()}`,
        category: 'Navigation',
        to: ROUTES.GROUPS,
        icon: Layers,
        keywords: 'sections groups batches divisions streams ' + sectionLabel.toLowerCase(),
      },
      {
        id: 'subjects',
        title: subjectLabel,
        subtitle: `Manage course curriculum, syllabi, and ${subjectLabel.toLowerCase()}`,
        category: 'Navigation',
        to: ROUTES.SUBJECTS,
        icon: BookMarked,
        keywords: 'subjects syllabus curriculum courses topics ' + subjectLabel.toLowerCase(),
      },
      {
        id: 'timetable',
        title: 'Timetable',
        subtitle: 'Schedule classes, periods, and weekly timetables',
        category: 'Navigation',
        to: ROUTES.TIMETABLE,
        icon: Clock,
        keywords: 'timetable schedules periods calendar classes hours schedule',
        pro: true,
        permission: PERMISSIONS.TIMETABLE_VIEW,
      },
      {
        id: 'daily-substitutes',
        title: 'Daily Substitutes',
        subtitle: 'Manage teacher coverage schedules and daily replacements',
        category: 'Navigation',
        to: '/academics/timetable/substitutes',
        icon: UserCheck,
        keywords: 'timetable substitutes cover teacher absent replacement coverage daily',
        pro: true,
        permission: PERMISSIONS.TIMETABLE_VIEW,
      },
      {
        id: 'students-directory',
        title: `${studentLabelSingular} Directory`,
        subtitle: `Search and manage ${studentLabelSingular.toLowerCase()} profiles, details, and directory`,
        category: 'Navigation',
        to: ROUTES.STUDENT_DIRECTORY,
        icon: Users,
        permission: PERMISSIONS.STUDENTS_VIEW,
        keywords: `${studentLabelSingular.toLowerCase()} directory list profile search manage ${studentLabelPlural.toLowerCase()}`,
      },
      {
        id: 'admissions',
        title: admissionLabel,
        subtitle: `Review student admission applications and ${admissionLabel.toLowerCase()}`,
        category: 'Navigation',
        to: ROUTES.ADMISSIONS,
        icon: ClipboardList,
        permission: PERMISSIONS.ADMISSIONS_VIEW,
        keywords: 'admissions applications registration inquiries intake ' + admissionLabel.toLowerCase(),
      },
      {
        id: 'attendance',
        title: attendanceLabel,
        subtitle: `Record and track student daily ${attendanceLabel.toLowerCase()}`,
        category: 'Navigation',
        to: ROUTES.ATTENDANCE,
        icon: CalendarCheck,
        permission: PERMISSIONS.ATTENDANCE_VIEW,
        keywords: 'attendance track register roll call present absent ' + attendanceLabel.toLowerCase(),
      },
      {
        id: 'staff-directory',
        title: `${staffLabelSingular} Directory`,
        subtitle: `Manage ${staffLabelPlural.toLowerCase()}, administrators, and employees`,
        category: 'Navigation',
        to: ROUTES.STAFF_DIRECTORY,
        icon: Briefcase,
        permission: PERMISSIONS.STAFF_VIEW,
        keywords: `${staffLabelSingular.toLowerCase()} directory teachers employees profiles human resources faculty`,
      },
      {
        id: 'roles-permissions',
        title: 'Roles & Permissions',
        subtitle: 'Configure school user roles and granular capability levels',
        category: 'Navigation',
        to: ROUTES.ROLES_PERMISSIONS,
        icon: ShieldCheck,
        permission: PERMISSIONS.ROLES_MANAGE,
        keywords: 'roles permissions security access ACL rules admin authorization capabilities',
      },
      {
        id: 'finance-dashboard',
        title: 'Finance Overview',
        subtitle: 'View school fee collections, revenue status, and dashboard charts',
        category: 'Navigation',
        to: ROUTES.FINANCE_DASHBOARD,
        icon: Wallet,
        keywords: 'finance overview dashboard collection revenue stats chart income expense audit',
        pro: true,
        permission: PERMISSIONS.FINANCE_VIEW,
      },
      {
        id: 'fee-types',
        title: feeLabel,
        subtitle: `Set up fee categories, structure, and ${feeLabel.toLowerCase()}`,
        category: 'Navigation',
        to: ROUTES.FEE_TYPES,
        icon: BadgeDollarSign,
        permission: PERMISSIONS.FEE_TYPES_VIEW,
        keywords: 'fee types structure categories configure tuition structure ' + feeLabel.toLowerCase(),
      },
      {
        id: 'invoices',
        title: invoiceLabel,
        subtitle: `Generate, issue, and manage student ${invoiceLabel.toLowerCase()}`,
        category: 'Navigation',
        to: ROUTES.INVOICES,
        icon: FileText,
        permission: PERMISSIONS.INVOICES_VIEW,
        keywords: 'invoices billing charges fees students invoice bill statement ' + invoiceLabel.toLowerCase(),
      },
      {
        id: 'payments',
        title: paymentLabel,
        subtitle: `Record and search cash, card, and online ${paymentLabel.toLowerCase()}`,
        category: 'Navigation',
        to: ROUTES.PAYMENTS,
        icon: CreditCard,
        permission: PERMISSIONS.PAYMENTS_VIEW,
        keywords: 'payments record transaction collections receipts cash online bank ' + paymentLabel.toLowerCase(),
      },
      {
        id: 'wp-admin',
        title: 'WordPress Dashboard',
        subtitle: 'Exit to the main WordPress administrator backoffice',
        category: 'Navigation',
        externalUrl: wpAdminUrl,
        icon: ArrowLeft,
        keywords: 'wp admin wordpress dashboard backoffice exit leave codeclove',
      },

      // Settings Category
      {
        id: 'settings-general',
        title: 'Settings: General',
        subtitle: 'Configure school metadata, contact details, and basic settings',
        category: 'Settings',
        to: `${ROUTES.SETTINGS}?tab=general`,
        icon: Settings,
        keywords: 'general settings configurations metadata contact school profile info',
      },
      {
        id: 'settings-education',
        title: 'Settings: Education System',
        subtitle: 'Select education board presets, grading systems, and school model settings',
        category: 'Settings',
        to: `${ROUTES.SETTINGS}?tab=education`,
        icon: Settings,
        keywords: 'education system settings presets cbse ib curriculum grading boards K-12',
      },
      {
        id: 'settings-admissions',
        title: 'Settings: Admissions',
        subtitle: 'Set up application codes, auto-conversion rules, and fees settings',
        category: 'Settings',
        to: `${ROUTES.SETTINGS}?tab=admissions`,
        icon: Settings,
        keywords: 'admissions settings application conversion auto fee code status configuration',
      },
      {
        id: 'settings-staff',
        title: 'Settings: Staff Onboarding',
        subtitle: 'Set up staff onboarding requirements and ID format generation structures',
        category: 'Settings',
        to: `${ROUTES.SETTINGS}?tab=staff`,
        icon: Settings,
        keywords: 'staff settings onboarding id generation formats requirements employee fields',
      },
      {
        id: 'settings-identifiers',
        title: 'Settings: Identifiers',
        subtitle: 'Set student ID prefix codes, formats, and auto-generation bounds',
        category: 'Settings',
        to: `${ROUTES.SETTINGS}?tab=identifiers`,
        icon: Settings,
        keywords: 'identifiers settings student admission numbers format prefix roll generation digits',
      },
      {
        id: 'settings-localization',
        title: 'Settings: Localization',
        subtitle: 'Set regional currency symbols, timezone preferences, and date formats',
        category: 'Settings',
        to: `${ROUTES.SETTINGS}?tab=localization`,
        icon: Settings,
        keywords: 'localization settings currency timezone date time format language region',
      },
      {
        id: 'settings-appearance',
        title: 'Settings: Appearance',
        subtitle: 'Toggle light / dark mode, sidebar density, and table row heights',
        category: 'Settings',
        to: `${ROUTES.SETTINGS}?tab=appearance`,
        icon: Settings,
        keywords: 'appearance settings themes light dark mode density colors brand layout boxed fullwidth',
      },
      {
        id: 'settings-shortcodes',
        title: 'Settings: Shortcodes',
        subtitle: 'Review public WordPress shortcodes for online forms and embedding pages',
        category: 'Settings',
        to: `${ROUTES.SETTINGS}?tab=shortcodes`,
        icon: Settings,
        keywords: 'shortcodes settings wordpress frontend pages public embed form keys php',
      },
      {
        id: 'settings-system',
        title: 'Settings: System Tools',
        subtitle: 'Run database seeds, flush system cache, and verify status logs',
        category: 'Settings',
        to: `${ROUTES.SETTINGS}?tab=system`,
        icon: Settings,
        keywords: 'system server settings database tools cache debug info status memory logs',
      },

      {
        id: 'noticeboard',
        title: __('Noticeboard & Announcements', 'codeclove-school-management'),
        subtitle: __('Publish and manage school-wide announcements and notices', 'codeclove-school-management'),
        category: 'Navigation',
        to: ROUTES.ANNOUNCEMENTS,
        icon: Megaphone,
        keywords: 'noticeboard announcements notices circulars bulletin messages publish alerts broadcast',
        pro: true,
        permission: PERMISSIONS.NOTIFICATIONS_MANAGE,
      },
      {
        id: 'settings-notifications',
        title: __('Settings: In-App Notifications', 'codeclove-school-management'),
        subtitle: __('Configure student and parent portal notification channels', 'codeclove-school-management'),
        category: 'Settings',
        to: `${ROUTES.SETTINGS}?tab=notifications`,
        icon: Settings,
        keywords: 'notifications alerts inapp portal messages email channels',
        pro: true,
      },
      {
        id: 'settings-sms',
        title: __('Settings: SMS Notifications', 'codeclove-school-management'),
        subtitle: __('Configure Twilio, Vonage, MSG91, and Fast2SMS credentials', 'codeclove-school-management'),
        category: 'Settings',
        to: `${ROUTES.SETTINGS}?tab=sms_notifications`,
        icon: Settings,
        keywords: 'sms twilio fast2sms msg91 vonage text alerts phone gateway',
        pro: true,
      },
      {
        id: 'settings-whatsapp',
        title: __('Settings: WhatsApp Notifications', 'codeclove-school-management'),
        subtitle: __('Configure WhatsApp Business API credentials and event templates', 'codeclove-school-management'),
        category: 'Settings',
        to: `${ROUTES.SETTINGS}?tab=whatsapp_notifications`,
        icon: Settings,
        keywords: 'whatsapp twilio fast2sms msg91 vonage meta cloud alerts messages phone gateway',
        pro: true,
      },

      // Quick Actions Category
      {
        id: 'action-admit',
        title: `Quick Action: Admit ${studentLabelSingular}`,
        subtitle: `Directly open the ${studentLabelSingular.toLowerCase()} admission application form`,
        category: 'Actions',
        to: '/students/new',
        icon: UserPlus,
        permission: PERMISSIONS.STUDENTS_ADD,
        keywords: `quick action admissions application create admit ${studentLabelSingular.toLowerCase()} register entry application`,
      },
      {
        id: 'action-hire',
        title: `Quick Action: Onboard ${staffLabelSingular}`,
        subtitle: `Directly open the ${staffLabelSingular.toLowerCase()} onboarding form`,
        category: 'Actions',
        to: '/staff/onboarding',
        icon: Briefcase,
        permission: PERMISSIONS.STAFF_ADD,
        keywords: `quick action ${staffLabelSingular.toLowerCase()} add onboarding teacher hire employee details new`,
      },
      {
        id: 'action-toggle-theme',
        title: 'Quick Action: Toggle Theme Mode',
        subtitle: `Switch current theme to ${theme === 'dark' ? 'Light' : 'Dark'} mode`,
        category: 'Actions',
        action: () => {
          setTheme(theme === 'dark' ? 'light' : 'dark')
        },
        icon: theme === 'dark' ? Sun : Moon,
        keywords: 'quick action toggle theme dark light mode contrast appearance switch',
      },
    ]

    return rawItems.filter((item) => {
      const perm = item.permission ?? (item.category === 'Settings' ? PERMISSIONS.SETTINGS_MANAGE : undefined)
      return (isPro || !item.pro) && (!perm || can(perm))
    })
  }, [getLabel, theme, setTheme, isPro, can])

  // Filter items based on search query (multi-word support)
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items
    const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    return items.filter((item) => {
      const targetStr = `${item.title} ${item.subtitle || ''} ${item.category} ${item.keywords || ''}`.toLowerCase()
      return queryWords.every((word) => targetStr.includes(word))
    })
  }, [items, searchQuery])

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  const handleSelect = useCallback((item: SearchItem) => {
    onOpenChange(false)
    if (item.action) {
      item.action()
    } else if (item.externalUrl) {
      window.location.href = item.externalUrl
    } else if (item.to) {
      navigate(item.to)
    }
  }, [onOpenChange, navigate])

  // Keyboard navigation within the results list
  useEffect(() => {
    if (!open || filteredItems.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selectedItem = filteredItems[selectedIndex]
        if (selectedItem) {
          handleSelect(selectedItem)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, filteredItems, selectedIndex, handleSelect])

  // Scroll active element into view inside container using local coordinate offsets
  useEffect(() => {
    const activeEl = activeRef.current
    if (!activeEl) return

    const container = activeEl.closest('.scrollbar-thin') as HTMLElement
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const activeRect = activeEl.getBoundingClientRect()

    if (activeRect.top < containerRect.top) {
      container.scrollTop -= (containerRect.top - activeRect.top) + 8
    } else if (activeRect.bottom > containerRect.bottom) {
      container.scrollTop += (activeRect.bottom - containerRect.bottom) + 8
    }
  }, [selectedIndex])


  // Group items by category to display clean subheaders
  const groupedItems = useMemo(() => {
    const groups: Record<SearchItem['category'], { item: SearchItem; index: number }[]> = {
      Navigation: [],
      Settings: [],
      Actions: [],
    }

    filteredItems.forEach((item, index) => {
      groups[item.category].push({ item, index })
    })

    return groups
  }, [filteredItems])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[100000] bg-black/60 dark:bg-black/75 backdrop-blur-sm',
            'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out'
          )}
        />

        <DialogPrimitive.Content
          ref={contentRef}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'codeclove-command-palette-content',
            'fixed z-[100001] left-1/2 top-[12vh] -translate-x-1/2',
            'w-[calc(100vw-2rem)] max-w-xl flex flex-col',
            'bg-bg-overlay/95 backdrop-blur-xl border border-border dark:border-white/15 rounded-xl shadow-modal overflow-hidden outline-none',
            'data-[state=open]:animate-command-palette-in data-[state=closed]:animate-command-palette-out',
            'shadow-[0_24px_50px_-12px_rgba(0,0,0,0.3)] dark:shadow-[#000000]/80'
          )}
        >
          {/* Header search bar */}
          <div className="flex items-center gap-3.5 px-5 py-4 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
            <Search className="w-5 h-5 text-brand" />
            <input
              ref={inputRef}
              type="text"
              placeholder={__('Search pages, actions, settings...', 'codeclove-school-management')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent !border-none !outline-none !shadow-none !ring-0 text-base text-text placeholder-text-text-subtle p-0 !m-0 !h-auto tracking-wide font-normal"
            />
            <kbd className="text-2xs font-mono font-semibold text-text-muted bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 px-2 py-0.5 rounded-md shadow-3xs uppercase tracking-wider select-none">
              esc
            </kbd>
          </div>

          {/* Search results list */}
          <div className="max-h-[340px] overflow-y-auto p-2 scrollbar-thin">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center select-none">
                <Search className="w-8 h-8 text-text-subtle mx-auto opacity-40 mb-2" />
                <p className="text-sm font-semibold text-text-muted">{sprintf(__('No results found for "%s"', 'codeclove-school-management'), searchQuery)}</p>
                <p className="text-xs text-text-subtle mt-1">{__('Try searching for Classes, Admissions, Invoices, or Settings', 'codeclove-school-management')}</p>
              </div>
            ) : (
              (Object.keys(groupedItems) as SearchItem['category'][]).map((category) => {
                const group = groupedItems[category]
                if (group.length === 0) return null

                return (
                  <div key={category} className="space-y-1 mb-3 last:mb-1">
                    {/* Category Title */}
                    <div className="text-2xs tracking-wider uppercase font-semibold text-text-subtle px-3 py-1.5 select-none">
                      {CATEGORY_LABELS[category] ?? category}
                    </div>

                    {/* Group Items */}
                    {group.map(({ item, index }) => {
                      const Icon = item.icon
                      const isSelected = index === selectedIndex
                      return (
                        <button
                          key={item.id}
                          ref={isSelected ? activeRef : null}
                          onClick={() => handleSelect(item)}
                          onMouseMove={(e) => handleMouseMove(e, index)}
                          data-active={isSelected}
                          className={cn(
                            'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-start transition-colors duration-100',
                            isSelected
                              ? 'bg-brand-dim text-brand dark:bg-brand/10 dark:text-brand shadow-2xs font-medium'
                              : 'text-text hover:bg-hover-bg'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                'p-1.5 rounded-md flex-shrink-0 transition-colors',
                                isSelected ? 'bg-brand/10 text-brand' : 'bg-bg-surface border border-border text-text-subtle'
                              )}
                            >
                              <Icon size={14} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-none">{item.title}</p>
                              {item.subtitle && (
                                <p className="text-xs text-text-muted leading-none mt-1 truncate">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                          <div
                            className={cn(
                              'flex items-center gap-1.5 text-xs text-brand font-medium transition-all duration-150 me-1',
                              isSelected
                                ? 'opacity-100 translate-x-0'
                                : 'opacity-0 translate-x-2 rtl:-translate-x-2 pointer-events-none'
                            )}
                          >
                            <span className="text-2xs font-mono opacity-80">↵</span>
                            <ArrowRight size={12} className="rtl:rotate-180" />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer help commands */}
          <div className="flex items-center justify-between px-4 py-2 bg-bg-surface border-t border-border text-2xs text-text-muted font-medium select-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="bg-bg-elevated px-1 py-0.5 rounded border border-border shadow-3xs">↑</kbd>
                <kbd className="bg-bg-elevated px-1 py-0.5 rounded border border-border shadow-3xs">↓</kbd>
                {__('to navigate', 'codeclove-school-management')}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-bg-elevated px-1 py-0.5 rounded border border-border shadow-3xs">↵</kbd>
                {__('to select', 'codeclove-school-management')}
              </span>
            </div>
            <span className="flex items-center gap-1 text-text-subtle">
              <kbd className="bg-bg-elevated px-1 py-0.5 rounded border border-border shadow-3xs">ESC</kbd>
              {__('to close', 'codeclove-school-management')}
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
