/**
 * Portal Notifications Page.
 *
 * Displays full list of announcements, notices, and alerts with unread filters,
 * instant search, category dropdown filter, and responsive noticeboard feed.
 */

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  ExternalLink,
  Pin,
  Search,
  Tag,
  X,
} from 'lucide-react'
import { useMarkNotificationRead, useNotifications } from '../../api/portal'
import { formatRelativeTime } from '../../lib/formatter'
import {
  CANONICAL_NOTICE_CATEGORIES,
  getNotificationActionLabel,
  getNotificationCategory,
} from '../../lib/notifications'
import { usePortal } from '../../lib/portal-context'
import { SegmentedTabs, type SegmentedTab } from '../../components/SegmentedTabs'
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  type SelectOption,
  Spinner,
} from '@/components/ui'
import { __ } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { FormattedNoticeContent } from '@/modules/announcements/components/FormattedNoticeContent'

export const NotificationsPage: React.FC = () => {
  const { currentStudent } = usePortal()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({})
  const page = 1

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const { data: notifData, isLoading } = useNotifications(currentStudent?.id, page, 30)
  const markReadMutation = useMarkNotificationRead(currentStudent?.id)
  const unreadCount = notifData?.unread_count ?? 0

  const categoryOptions: SelectOption[] = useMemo(
    () => [
      {
        value: 'all',
        label: __( 'All Categories', 'codeclove-school-management' ),
        prefix: <Tag className="w-4 h-4 text-brand shrink-0" />,
      },
      ...CANONICAL_NOTICE_CATEGORIES.map( ( c ) => {
        const Icon = c.icon
        return {
          value: c.id,
          label: c.label,
          prefix: <Icon className={cn( 'w-4 h-4 shrink-0', c.textColor )} />,
        }
      } ),
    ],
    []
  )

  const filteredNotifications = useMemo(() => {
    let list = notifData?.notifications ?? []

    if (filter === 'unread') {
      list = list.filter((n) => !n.is_read)
    }

    if (selectedCategory !== 'all') {
      list = list.filter((n) => getNotificationCategory(n.event_type, n.title, n.accent_color, n.icon).id === selectedCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((n) => {
        const titleMatch = n.title.toLowerCase().includes(q)
        const contentMatch = (n.content || '').toLowerCase().includes(q)
        return titleMatch || contentMatch
      })
    }

    return list
  }, [notifData?.notifications, filter, selectedCategory, searchQuery])

  const tabs = useMemo<Array<SegmentedTab<'all' | 'unread'>>>(
    () => [
      { id: 'all', label: __( 'All', 'codeclove-school-management' ) },
      {
        id: 'unread',
        label: __( 'Unread', 'codeclove-school-management' ),
        count: unreadCount > 0 ? unreadCount : undefined,
      },
    ],
    [unreadCount]
  )

  const handleMarkSingleRead = (id: number) => {
    markReadMutation.mutate(id)
  }

  const handleMarkAllRead = () => {
    markReadMutation.mutate(undefined)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={__( 'Notifications & Notices', 'codeclove-school-management' )}
        description={__( 'School-wide announcements, attendance alerts, and payment updates', 'codeclove-school-management' )}
        actions={
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={markReadMutation.isPending}
                className="h-8 text-xs font-semibold cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1 text-brand" />
                {__( 'Mark All as Read', 'codeclove-school-management' )}
              </Button>
            )}

            <SegmentedTabs<'all' | 'unread'>
              tabs={tabs}
              activeTab={filter}
              onChange={setFilter}
              ariaLabel={__( 'Notification filters', 'codeclove-school-management' )}
              size="sm"
            />
          </div>
        }
      />

      {/* Filter and Search Bar with Category Dropdown */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Instant Search Bar */}
        <div className="relative flex-1 max-w-full sm:max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={__( 'Search notices, circulars...', 'codeclove-school-management' )}
            className="h-8 pl-8 pr-7 text-xs shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text p-0.5 rounded cursor-pointer"
              title={__( 'Clear search', 'codeclove-school-management' )}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Dropdown with Colored Icon */}
        <div className="w-full sm:w-64 shrink-0">
          <Select
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            options={categoryOptions}
            className="h-8 text-xs shadow-2xs"
            placeholder={__( 'Filter by Category...', 'codeclove-school-management' )}
            aria-label={__( 'Filter by category', 'codeclove-school-management' )}
          />
        </div>
      </div>

      {/* Notifications List Container: Unified Outer Card with Divided Rows */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card className="overflow-hidden border border-border shadow-card bg-bg-elevated">
          {filteredNotifications.length === 0 ? (
            searchQuery || selectedCategory !== 'all' ? (
              <EmptyState
                icon={Search}
                title={__( 'No matching notices found', 'codeclove-school-management' )}
                description={__( 'No announcements match your search or filter criteria.', 'codeclove-school-management' )}
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedCategory('all')
                      setFilter('all')
                    }}
                  >
                    {__( 'Clear Filters', 'codeclove-school-management' )}
                  </Button>
                }
                className="py-16"
              />
            ) : (
              <EmptyState
                icon={Bell}
                title={__( 'No announcements found', 'codeclove-school-management' )}
                description={
                  filter === 'unread'
                    ? __( 'You are completely caught up with all school announcements!', 'codeclove-school-management' )
                    : __( 'No notices have been posted to your student record yet.', 'codeclove-school-management' )
                }
                className="py-16"
              />
            )
          ) : (
            <div className="divide-y divide-border">
              {filteredNotifications.map((notif) => {
                const isUnread = !notif.is_read
                const category = getNotificationCategory(notif.event_type, notif.title, notif.accent_color, notif.icon)
                const CategoryIcon = category.icon
                const linkUrl = notif.url
                const actionLabel = getNotificationActionLabel(notif.title, notif.event_type, linkUrl)
                const isExpanded = Boolean(expandedIds[notif.id])
                const isLongContent = (notif.content?.length ?? 0) > 280 || (notif.content?.split('\n').length ?? 0) > 3

                return (
                  <div
                    key={notif.id}
                    className={cn(
                      'group relative p-4 sm:p-5 transition-colors',
                      notif.is_pinned
                        ? 'bg-amber-500/[0.03] dark:bg-amber-500/[0.06] hover:bg-amber-500/[0.06]'
                        : isUnread
                          ? 'bg-brand/[0.03] dark:bg-brand/[0.06] hover:bg-hover-bg/80'
                          : 'bg-bg-elevated hover:bg-hover-bg/50'
                    )}
                  >
                    <div className="flex items-start gap-3.5 sm:gap-4 min-w-0">
                      {/* Category Icon Avatar Badge with Unread Ping Dot */}
                      <div className="relative shrink-0 mt-0.5">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center border shadow-2xs transition-transform group-hover:scale-105',
                            category.badgeColor
                          )}
                        >
                          <CategoryIcon className="w-5 h-5" />
                        </div>
                        {isUnread && (
                          <span
                            className={cn(
                              'absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full ring-2 ring-bg-elevated shadow-xs animate-in zoom-in-75',
                              category.dotColor
                            )}
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      {/* Content Area: Headline-First Architecture */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* Line 1: Title & Category on Left, Timestamp & Mark Read on Right */}
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-3">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <h4
                              onClick={isLongContent ? () => toggleExpand(notif.id) : undefined}
                              className={cn(
                                'text-sm sm:text-base tracking-tight leading-snug',
                                isLongContent && 'cursor-pointer hover:text-brand transition-colors',
                                isUnread ? 'font-bold text-text' : 'font-semibold text-text'
                              )}
                            >
                              {notif.title}
                            </h4>

                            {notif.is_pinned && (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-2xs shadow-3xs shrink-0">
                                <Pin className="w-3 h-3 fill-current" />
                                {__( 'Pinned', 'codeclove-school-management' )}
                              </span>
                            )}

                            <span
                              className={cn(
                                'font-semibold px-2 py-0.5 rounded-full border text-2xs shadow-3xs shrink-0',
                                category.badgeColor
                              )}
                            >
                              {category.label}
                            </span>
                          </div>

                          {/* Relative Time and Mark Read */}
                          <div className="shrink-0 flex items-center gap-2.5 self-start sm:self-baseline">
                            <span className="text-2xs text-text-subtle font-medium tabular-nums flex items-center gap-1 whitespace-nowrap">
                              <Clock className="w-3 h-3 text-text-subtle/70" />
                              {formatRelativeTime(notif.notice_date || notif.created_at)}
                            </span>

                            {isUnread && (
                              <button
                                type="button"
                                onClick={() => handleMarkSingleRead(notif.id)}
                                disabled={markReadMutation.isPending}
                                className={cn(
                                  'inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-medium cursor-pointer transition-all duration-150 select-none whitespace-nowrap',
                                  // Base Surface & Borders (Light & Dark)
                                  'bg-bg-surface text-text-muted border border-border shadow-3xs',
                                  'hover:text-brand hover:border-brand/40 hover:bg-brand/[0.05] hover:shadow-2xs',
                                  'dark:bg-bg-surface/90 dark:text-text-muted dark:border-white/10 dark:hover:bg-brand/10 dark:hover:border-brand/40 dark:hover:text-brand',
                                  // Visibility affordance
                                  'opacity-85 sm:opacity-75 group-hover:opacity-100 hover:!opacity-100 focus-visible:opacity-100',
                                  // Focus & Active tactile feedback
                                  'focus-visible:outline-none focus-visible:ring-1.5 focus-visible:ring-brand focus-visible:ring-offset-1',
                                  'active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none'
                                )}
                                title={__( 'Mark as read', 'codeclove-school-management' )}
                                aria-label={__( 'Mark as read', 'codeclove-school-management' )}
                              >
                                {markReadMutation.isPending && markReadMutation.variables === notif.id ? (
                                  <Spinner size="xs" className="w-3 h-3 text-brand" />
                                ) : (
                                  <Check className="w-3 h-3 text-brand shrink-0 stroke-[2.5]" />
                                )}
                                <span>{__( 'Mark read', 'codeclove-school-management' )}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Line 2: Notice Content Excerpt */}
                        {notif.content && (
                          <div className="pt-0.5">
                            <div
                              onClick={!isExpanded && isLongContent ? () => toggleExpand(notif.id) : undefined}
                              className={cn(!isExpanded && isLongContent && 'cursor-pointer')}
                            >
                              <FormattedNoticeContent
                                content={notif.content}
                                className={cn(
                                  'text-xs sm:text-sm text-text-muted leading-relaxed max-w-3xl',
                                  ! isExpanded && isLongContent && 'line-clamp-3'
                                )}
                              />
                            </div>
                            {isLongContent && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(notif.id)}
                                className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-2xs font-medium text-text-muted hover:text-text bg-bg-surface hover:bg-hover-bg border border-border shadow-3xs transition-all select-none cursor-pointer"
                              >
                                <span>{isExpanded ? __( 'Show less', 'codeclove-school-management' ) : __( 'Read more', 'codeclove-school-management' )}</span>
                                <ChevronDown className={cn( 'w-3 h-3 text-text-subtle transition-transform duration-200', isExpanded && 'rotate-180' )} />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Line 3: Direct Action CTA */}
                        {linkUrl && (
                          <div className="pt-2">
                            {linkUrl.startsWith('/') ? (
                              <Link
                                to={linkUrl}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-strong transition-colors group/link"
                              >
                                <span>{actionLabel}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-text-subtle group-hover/link:translate-x-0.5 group-hover/link:text-brand transition-all" />
                              </Link>
                            ) : (
                              <a
                                href={linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-strong transition-colors group/link"
                              >
                                <span>{actionLabel}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-text-subtle group-hover/link:text-brand transition-colors" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
