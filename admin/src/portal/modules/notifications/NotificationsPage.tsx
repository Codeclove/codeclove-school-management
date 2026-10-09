/**
 * Portal Notifications Page.
 *
 * Displays full list of announcements, notices, and alerts with unread filters,
 * individual and bulk mark-as-read actions using shared CodeClove design system primitives.
 */

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
} from 'lucide-react'
import { useMarkNotificationRead, useNotifications } from '../../api/portal'
import { formatDate } from '../../lib/formatter'
import { usePortal } from '../../lib/portal-context'
import { SegmentedTabs, type SegmentedTab } from '../../components/SegmentedTabs'
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from '@/components/ui'
import { __ } from '@/lib/i18n'

export const NotificationsPage: React.FC = () => {
  const { currentStudent } = usePortal()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const page = 1

  const { data: notifData, isLoading } = useNotifications(currentStudent?.id, page, 30)
  const markReadMutation = useMarkNotificationRead(currentStudent?.id)
  const notifications = notifData?.notifications ?? []
  const unreadCount = notifData?.unread_count ?? 0

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((n) => !n.is_read)
    }
    return notifications
  }, [notifications, filter])

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
                className="h-8 text-xs font-semibold"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1 text-brand" />
                {__( 'Mark All as Read', 'codeclove-school-management' )}
              </Button>
            )}

            {/* Filter Tabs (Segmented Capsule Track) */}
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

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          {filteredNotifications.length === 0 ? (
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
          ) : (
            <div className="divide-y divide-border">
              {filteredNotifications.map((notif) => {
                const isUnread = !notif.is_read
                const linkUrl = notif.url

                return (
                  <div
                    key={notif.id}
                    className={`flex items-start justify-between gap-4 p-4 transition-colors ${
                      isUnread
                        ? 'bg-brand-dim/30 border-s-2 border-s-brand'
                        : 'bg-bg-elevated hover:bg-hover-bg'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Unread indicator dot */}
                      <div className="mt-1.5 flex-shrink-0">
                        {isUnread ? (
                          <span className="flex h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-brand-dim" />
                        ) : (
                          <span className="flex h-2.5 w-2.5 rounded-full bg-border-strong" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-text">{notif.title}</h4>
                          <span className="text-2xs text-text-subtle flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(notif.created_at)}
                          </span>
                        </div>

                        <p className="text-xs text-text-muted leading-relaxed whitespace-pre-wrap">
                          {notif.content}
                        </p>

                        {linkUrl && (
                          <div className="pt-1.5">
                            {linkUrl.startsWith('/') ? (
                              <Link
                                to={linkUrl}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                              >
                                <span>{__( 'View Related Details', 'codeclove-school-management' )}</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            ) : (
                              <a
                                href={linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                              >
                                <span>{__( 'View Related Details', 'codeclove-school-management' )}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Single Mark-as-read action */}
                    {isUnread && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkSingleRead(notif.id)}
                        className="h-7 px-2 text-2xs text-text-muted hover:text-brand flex-shrink-0"
                        title={__( 'Mark as read', 'codeclove-school-management' )}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        {__( 'Read', 'codeclove-school-management' )}
                      </Button>
                    )}
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
