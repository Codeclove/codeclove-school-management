/**
 * NoticeCardPreview — Real-time live recipient card preview for the Notice Composer.
 *
 * Renders the announcement card exactly as students, parents, and staff
 * will see it on their portal noticeboard and dashboard feeds.
 */

import {
  Calendar,
  Clock,
  ExternalLink,
  Pin,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'
import {
  getNotificationActionLabel,
  getNotificationCategory,
} from '@/portal/lib/notifications'
import { FormattedNoticeContent } from './FormattedNoticeContent'

export interface NoticeCardPreviewProps {
  title: string
  content: string
  audience: 'portal' | 'staff' | 'all'
  eventType: string
  noticeDate?: string
  expiresAt?: string
  isPinned: boolean
  accentColor?: string
  icon?: string
  url?: string
}

export function NoticeCardPreview( {
  title,
  content,
  audience,
  eventType,
  noticeDate,
  expiresAt,
  isPinned,
  accentColor,
  icon,
  url,
}: NoticeCardPreviewProps ) {
  // Resolve category configuration with color and icon
  const category = getNotificationCategory( eventType, title, accentColor, icon )
  const CategoryIcon = category.icon
  const audienceLabel = audience === 'staff'
    ? __( 'Staff & Faculty', 'codeclove-school-management' )
    : audience === 'all'
      ? __( 'Everyone', 'codeclove-school-management' )
      : __( 'Students & Guardians', 'codeclove-school-management' )
  const resolvedActionLabel = getNotificationActionLabel( title, eventType, url )
  const safeUrl = ! url
    ? ''
    : url.startsWith( '/' ) || /^https?:\/\//i.test( url )
      ? url
      : `https://${url}`
  const isScheduled = Boolean( noticeDate && noticeDate > new Date().toISOString().slice( 0, 10 ) )

  return (
    <div className="space-y-2">
      {/* Live Header Label */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-2xs font-semibold text-text-subtle uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          <span>{__( 'Recipient Live Preview', 'codeclove-school-management' )}</span>
        </div>
        <span className="text-2xs text-text-subtle font-medium">
          {__( 'Portal Feed Card', 'codeclove-school-management' )}
        </span>
      </div>

      {/* The Live Card */}
      <div
        className={cn(
          'relative rounded-xl border p-4 sm:p-5 bg-bg-elevated transition-all shadow-xs overflow-hidden',
          isPinned ? 'border-amber-500/30 ring-1 ring-amber-500/20' : 'border-border'
        )}
      >
        {/* Pinned Ribbon */}
        {isPinned && (
          <div className="absolute top-0 right-0 bg-amber-500/10 border-l border-b border-amber-500/20 px-2.5 py-0.5 rounded-bl-lg flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            <Pin className="w-3 h-3 fill-current" />
            <span>{__( 'Pinned Notice', 'codeclove-school-management' )}</span>
          </div>
        )}

        <div className="flex items-start gap-3.5">
          {/* Category Icon Badge */}
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center border shadow-3xs shrink-0 mt-0.5 transition-transform',
              category.badgeColor
            )}
          >
            <CategoryIcon className="w-5 h-5" />
          </div>

          {/* Body and Metadata: Headline-First Architecture */}
          <div className="min-w-0 flex-1 space-y-2">
            {/* Header Row: Title & Badges on Left, Timestamp on Right */}
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-3">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h4
                  className={cn(
                    'text-sm sm:text-base font-bold tracking-tight text-text leading-snug break-words',
                    ! title.trim() && 'text-text-subtle/60 italic font-normal'
                  )}
                >
                  {title.trim() || __( 'Announcement title preview...', 'codeclove-school-management' )}
                </h4>

                <span
                  className={cn(
                    'font-semibold px-2 py-0.5 rounded-full border shadow-3xs text-[11px] shrink-0',
                    category.badgeColor
                  )}
                >
                  {category.label}
                </span>

                <span className="text-text-subtle text-2xs font-medium shrink-0">({audienceLabel})</span>
              </div>

              <span className="text-text-subtle text-2xs flex items-center gap-1 shrink-0 self-start sm:self-baseline tabular-nums">
                <Clock className="w-3 h-3" />
                <span>
                  {noticeDate ? noticeDate : __( 'Today', 'codeclove-school-management' )}
                </span>
              </span>
            </div>
            {/* Content Preview */}
            <div className="text-xs text-text-muted leading-relaxed max-h-48 overflow-y-auto pr-1">
              {content.trim() ? (
                <FormattedNoticeContent content={content} />
              ) : (
                <p className="text-text-subtle/60 italic">
                  {__( 'Announcement details and formatted text will preview here in real time...', 'codeclove-school-management' )}
                </p>
              )}
            </div>

            {/* Action CTA Button */}
            {safeUrl && (
              <div className="pt-2">
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={( e ) => e.preventDefault()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-text-inverted hover:bg-brand-strong transition-colors shadow-2xs group cursor-pointer"
                >
                  <span className="text-text-inverted font-medium">{resolvedActionLabel}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-text-inverted/90 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer Status Pill */}
        <div className="mt-3.5 pt-2.5 border-t border-border/70 flex items-center justify-between text-2xs text-text-subtle">
          <div className="flex items-center gap-1.5">
            {isScheduled ? (
              <span className="inline-flex items-center gap-1 text-info font-medium">
                <Calendar className="w-3 h-3" />
                {sprintf( __( 'Scheduled for %s', 'codeclove-school-management' ), noticeDate ?? '' )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <Sparkles className="w-3 h-3" />
                {__( 'Active immediately upon publish', 'codeclove-school-management' )}
              </span>
            )}
          </div>

          {expiresAt && (
            <span className="text-text-subtle">
              {sprintf( __( 'Expires %s', 'codeclove-school-management' ), expiresAt )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
