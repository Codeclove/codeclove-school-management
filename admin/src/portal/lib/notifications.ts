/**
 * Portal Notifications Helper Utilities.
 *
 * Provides shared category resolution, accent color tokens,
 * Lucide icon mappings, and dynamic action label generation.
 */

import React from 'react'
import {
  AlertCircle,
  Bell,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  GraduationCap,
  Info,
  Megaphone,
  Trophy,
} from 'lucide-react'
import { __ } from '@/lib/i18n'

export interface NoticeAccentColor {
  id: string
  label: string
  swatchClass: string
  badgeColor: string
  dotColor: string
}

export const NOTICE_ACCENT_COLORS: NoticeAccentColor[] = [
  {
    id: 'purple',
    label: __( 'Brand Purple', 'codeclove-school-management' ),
    swatchClass: 'bg-brand',
    badgeColor: 'bg-brand/10 text-brand border-brand/20',
    dotColor: 'bg-brand',
  },
  {
    id: 'indigo',
    label: __( 'Indigo', 'codeclove-school-management' ),
    swatchClass: 'bg-indigo-500',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    dotColor: 'bg-indigo-500',
  },
  {
    id: 'teal',
    label: __( 'Teal', 'codeclove-school-management' ),
    swatchClass: 'bg-teal-500',
    badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    dotColor: 'bg-teal-500',
  },
  {
    id: 'rose',
    label: __( 'Rose', 'codeclove-school-management' ),
    swatchClass: 'bg-rose-500',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    dotColor: 'bg-rose-500',
  },
  {
    id: 'amber',
    label: __( 'Amber', 'codeclove-school-management' ),
    swatchClass: 'bg-amber-500',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dotColor: 'bg-amber-500',
  },
  {
    id: 'emerald',
    label: __( 'Emerald', 'codeclove-school-management' ),
    swatchClass: 'bg-emerald-500',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'slate',
    label: __( 'Slate', 'codeclove-school-management' ),
    swatchClass: 'bg-slate-500',
    badgeColor: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    dotColor: 'bg-slate-500',
  },
]

export interface NoticeIconOption {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export const NOTICE_ICONS: NoticeIconOption[] = [
  { id: 'megaphone',      label: __( 'Megaphone', 'codeclove-school-management' ), icon: Megaphone },
  { id: 'calendar',       label: __( 'Calendar', 'codeclove-school-management' ), icon: Calendar },
  { id: 'book-open',      label: __( 'Book', 'codeclove-school-management' ), icon: BookOpen },
  { id: 'alert-circle',   label: __( 'Alert Circle', 'codeclove-school-management' ), icon: AlertCircle },
  { id: 'file-text',      label: __( 'Notice / Document', 'codeclove-school-management' ), icon: FileText },
  { id: 'credit-card',    label: __( 'Finance / Card', 'codeclove-school-management' ), icon: CreditCard },
  { id: 'trophy',         label: __( 'Trophy', 'codeclove-school-management' ), icon: Trophy },
  { id: 'bell',           label: __( 'Bell', 'codeclove-school-management' ), icon: Bell },
  { id: 'graduation-cap', label: __( 'Graduation Cap', 'codeclove-school-management' ), icon: GraduationCap },
  { id: 'info',           label: __( 'Information', 'codeclove-school-management' ), icon: Info },
]

export interface NotificationCategoryConfig {
  id: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  badgeColor: string
  dotColor: string
}

export interface CategoryFilterOption {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  dotColor: string
  badgeColor: string
  textColor: string
  defaultAccentColor?: string
  defaultIcon?: string
}

export const CANONICAL_NOTICE_CATEGORIES: CategoryFilterOption[] = [
  {
    id: 'announcement',
    label: __( 'Announcement', 'codeclove-school-management' ),
    icon: Megaphone,
    dotColor: 'bg-brand',
    badgeColor: 'bg-brand/10 text-brand border-brand/20',
    textColor: 'text-brand',
    defaultAccentColor: 'purple',
    defaultIcon: 'megaphone',
  },
  {
    id: 'notice',
    label: __( 'Official Notice', 'codeclove-school-management' ),
    icon: FileText,
    dotColor: 'bg-slate-500',
    badgeColor: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    textColor: 'text-slate-600 dark:text-slate-400',
    defaultAccentColor: 'slate',
    defaultIcon: 'file-text',
  },
  {
    id: 'circular',
    label: __( 'Circular', 'codeclove-school-management' ),
    icon: BookOpen,
    dotColor: 'bg-teal-500',
    badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    textColor: 'text-teal-600 dark:text-teal-400',
    defaultAccentColor: 'teal',
    defaultIcon: 'book-open',
  },
  {
    id: 'event',
    label: __( 'School Event', 'codeclove-school-management' ),
    icon: Calendar,
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    defaultAccentColor: 'indigo',
    defaultIcon: 'calendar',
  },
  {
    id: 'holiday',
    label: __( 'Holiday Notice', 'codeclove-school-management' ),
    icon: CalendarCheck,
    dotColor: 'bg-emerald-500',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    defaultAccentColor: 'emerald',
    defaultIcon: 'calendar',
  },
  {
    id: 'urgent',
    label: __( 'Urgent Alert', 'codeclove-school-management' ),
    icon: AlertCircle,
    dotColor: 'bg-rose-500',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    textColor: 'text-rose-600 dark:text-rose-400',
    defaultAccentColor: 'rose',
    defaultIcon: 'alert-circle',
  },
  {
    id: 'finance',
    label: __( 'Fees & Finance', 'codeclove-school-management' ),
    icon: CreditCard,
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    textColor: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'attendance',
    label: __( 'Attendance', 'codeclove-school-management' ),
    icon: Clock,
    dotColor: 'bg-amber-500',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'academics',
    label: __( 'Academics', 'codeclove-school-management' ),
    icon: GraduationCap,
    dotColor: 'bg-purple-500',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    textColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    id: 'admissions',
    label: __( 'Admissions', 'codeclove-school-management' ),
    icon: CheckCircle2,
    dotColor: 'bg-emerald-500',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
]

export function getCanonicalCategory(id: string): CategoryFilterOption | undefined {
  return CANONICAL_NOTICE_CATEGORIES.find((c) => c.id === id)
}

/**
 * Resolves semantic category icon, label, and colors.
 * Directly honors user-selected accentColor and iconId when provided,
 * falling back to the explicit eventType mapping.
 */
export function getNotificationCategory(
  eventType?: string,
  _title?: string,
  accentColor?: string | null,
  iconId?: string | null
): NotificationCategoryConfig {
  const explicitColor = accentColor ? NOTICE_ACCENT_COLORS.find( ( c ) => c.id === accentColor ) : null
  const explicitIcon = iconId ? NOTICE_ICONS.find( ( i ) => i.id === iconId ) : null
  const type = ( eventType || '' ).toLowerCase().replace( /\./g, '_' ).trim()

  let canonicalId = 'announcement'
  if ( /^(urgent|emergency)/.test( type ) ) canonicalId = 'urgent'
  else if ( /^(event|sports)/.test( type ) ) canonicalId = 'event'
  else if ( /^(holiday|vacation)/.test( type ) ) canonicalId = 'holiday'
  else if ( /^(circular|syllabus)/.test( type ) ) canonicalId = 'circular'
  else if ( /^(notice|general_notice)/.test( type ) ) canonicalId = 'notice'
  else if ( type.startsWith( 'attendance' ) ) canonicalId = 'attendance'
  else if ( /^(invoice|payment|fee|finance)/.test( type ) ) canonicalId = 'finance'
  else if ( type.startsWith( 'admission' ) ) canonicalId = 'admissions'
  else if ( /^(academic|exam)/.test( type ) ) canonicalId = 'academics'
  else if ( type.includes( 'profile' ) ) canonicalId = 'profile'

  const canonical = CANONICAL_NOTICE_CATEGORIES.find( ( c ) => c.id === canonicalId ) ?? {
    id: 'announcement',
    label: canonicalId === 'finance' ? __( 'Finance', 'codeclove-school-management' ) : canonicalId === 'profile' ? __( 'Profile', 'codeclove-school-management' ) : __( 'Announcement', 'codeclove-school-management' ),
    icon: canonicalId === 'profile' ? Info : Megaphone,
    badgeColor: 'bg-brand/10 text-brand border-brand/20',
    dotColor: 'bg-brand',
  }
  const isOverdue = type === 'invoice_overdue'
  const label = canonicalId === 'finance' ? __( 'Finance', 'codeclove-school-management' ) : canonical.label

  return {
    id: canonicalId,
    icon: explicitIcon ? explicitIcon.icon : isOverdue ? AlertCircle : canonical.icon,
    label,
    badgeColor: explicitColor ? explicitColor.badgeColor : isOverdue ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' : canonical.badgeColor,
    dotColor: explicitColor ? explicitColor.dotColor : isOverdue ? 'bg-rose-500' : canonical.dotColor,
  }
}

const ACTION_RULES: Array<[RegExp, string]> = [
  [/\.pdf|circular/, __( 'View Circular', 'codeclove-school-management' )],
  [/invoice|fee|balance|finance/, __( 'View Invoice', 'codeclove-school-management' )],
  [/payment|receipt/, __( 'View Receipt', 'codeclove-school-management' )],
  [/attendance/, __( 'View Attendance', 'codeclove-school-management' )],
  [/timetable|schedule|exam|sports/, __( 'View Schedule', 'codeclove-school-management' )],
  [/profile/, __( 'View Profile', 'codeclove-school-management' )],
]

/**
 * Generates an intuitive human-readable CTA label for a notification's destination link.
 */
export function getNotificationActionLabel(
  title?: string,
  eventType?: string,
  url?: string
): string {
  const combined = `${title || ''} ${eventType || ''} ${url || ''}`.toLowerCase()
  for ( const [pattern, label] of ACTION_RULES ) {
    if ( pattern.test( combined ) ) return label
  }
  if ( url && ( /^https?:\/\//i.test( url ) || url.includes( '.' ) ) ) {
    return __( 'Open Link', 'codeclove-school-management' )
  }
  return __( 'View Details', 'codeclove-school-management' )
}
