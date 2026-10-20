/**
 * Notification Bell Component.
 *
 * Displays an icon with unread count badge and a rich dropdown preview of recent notices
 * with semantic category iconography, relative timestamps, and accessible navigation.
 */

import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Bell,
  CheckCheck,
  Clock,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { __, sprintf } from '@/lib/i18n'
import { useMarkNotificationRead, useNotifications } from '../api/portal'
import { formatRelativeTime } from '../lib/formatter'
import { getNotificationCategory } from '../lib/notifications'
import { usePortal } from '../lib/portal-context'

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { currentStudent } = usePortal()

  const { data: notifData } = useNotifications(currentStudent?.id, 1, 5)
  const markReadMutation = useMarkNotificationRead(currentStudent?.id)
  const notifications = notifData?.notifications ?? []
  const unreadCount = notifData?.unread_count ?? 0

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    markReadMutation.mutate(undefined)
  }

  const handleNotificationClick = (id: number, isRead: boolean | number, url?: string) => {
    if (!isRead) {
      markReadMutation.mutate(id)
    }
    setIsOpen(false)
    if (!url) {
      navigate('/notifications')
    } else if (url.startsWith('/')) {
      navigate(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:border-border-strong bg-bg-surface hover:bg-hover-bg text-text-muted hover:text-text transition-all shadow-2xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={
          unreadCount > 0
            ? sprintf( __( 'Notifications (%d unread)', 'codeclove-school-management' ), unreadCount )
            : __( 'Notifications', 'codeclove-school-management' )
        }
        aria-expanded={isOpen}
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center pointer-events-none">
            {!isOpen && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-danger opacity-60 animate-ping" />
            )}
            <span className="relative inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-bg-surface shadow-xs tabular-nums select-none leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-80 sm:max-w-none sm:w-[380px] rounded-2xl bg-bg-overlay shadow-modal border border-border z-50 overflow-hidden divide-y divide-border/60 animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-bg-overlay border-b border-border/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text uppercase tracking-wider">
                {__( 'Notifications', 'codeclove-school-management' )}
              </span>
              {unreadCount > 0 && (
                <span className="bg-brand/10 text-brand text-3xs font-semibold px-1.5 py-0.5 rounded-full tabular-nums">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markReadMutation.isPending}
                className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-3xs font-medium text-text-subtle hover:text-text bg-bg-surface hover:bg-hover-bg border border-border shadow-3xs transition-all cursor-pointer disabled:opacity-40"
                title={__( 'Mark all as read', 'codeclove-school-management' )}
              >
                <CheckCheck className="w-3 h-3 text-text-subtle" />
                <span>{__( 'Mark all read', 'codeclove-school-management' )}</span>
              </button>
            )}
          </div>

          {/* Notification Items List */}
          <div className="max-h-[440px] overflow-y-auto divide-y divide-border/60 border-t-0 portal-scrollbar overscroll-contain pb-0.5">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-bg-surface border border-border text-text-subtle flex items-center justify-center mx-auto mb-2.5">
                  <Bell className="w-5 h-5 opacity-60" />
                </div>
                <p className="text-xs font-semibold text-text">
                  {__( 'All caught up', 'codeclove-school-management' )}
                </p>
                <p className="text-2xs text-text-muted mt-0.5">
                  {__( 'No new notifications to review.', 'codeclove-school-management' )}
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.is_read
                const category = getNotificationCategory(notif.event_type, notif.title, notif.accent_color, notif.icon)
                const CategoryIcon = category.icon

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif.id, notif.is_read, notif.url)}
                    className={`group relative px-3.5 py-3 hover:bg-hover-bg transition-colors cursor-pointer flex items-start gap-3 select-none ${
                      isUnread ? 'bg-brand/[0.04] dark:bg-brand/[0.08]' : ''
                    }`}
                  >
                    {/* Category Icon Badge with Unread Ping */}
                    <div className="relative shrink-0 mt-0.5">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-2xs transition-transform group-hover:scale-105 ${category.badgeColor}`}
                      >
                        <CategoryIcon className="w-4 h-4" />
                      </div>
                      {isUnread && (
                        <span
                          className={`absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full ${category.dotColor} ring-2 ring-bg-overlay shadow-xs animate-in zoom-in-75`}
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs leading-snug line-clamp-1 ${
                          isUnread ? 'font-semibold text-text' : 'font-medium text-text-muted'
                        }`}
                      >
                        {notif.title}
                      </p>

                      {notif.content && (
                        <p className="text-xs text-text-muted mt-1 line-clamp-2 leading-relaxed">
                          {notif.content}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 mt-1.5 text-2xs text-text-subtle">
                        <Clock className="w-3 h-3 text-text-subtle/70" />
                        <span>{formatRelativeTime(notif.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Sleek Integrated Footer */}
          <div className="p-1.5 bg-bg-surface/50 border-t border-border/70">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                navigate('/notifications')
              }}
              className="w-full h-7 text-xs font-medium text-text-muted hover:text-text hover:bg-hover-bg rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{__( 'View all notifications', 'codeclove-school-management' )}</span>
              <ArrowRight className="w-3 h-3 text-text-subtle" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
