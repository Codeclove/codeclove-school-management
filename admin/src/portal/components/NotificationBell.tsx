/**
 * Notification Bell Component.
 *
 * Displays an icon with unread count badge and a dropdown preview of recent notices.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, Clock, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { __, sprintf } from '@/lib/i18n'
import { useMarkNotificationRead, useNotifications } from '../api/portal'
import { formatDate } from '../lib/formatter'
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
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
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
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 hover:border-border bg-bg-surface hover:bg-bg-base text-text-muted hover:text-text transition-all shadow-2xs cursor-pointer"
        aria-label={unreadCount > 0 ? sprintf( __( 'Notifications (%d unread)', 'codeclove-school-management' ), unreadCount ) : __( 'Notifications', 'codeclove-school-management' )}
        aria-expanded={isOpen}
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-bg-surface shadow-xs tabular-nums select-none leading-none animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-[calc(100vw-2rem)] max-w-80 sm:max-w-none sm:w-96 rounded-xl bg-bg-elevated shadow-modal border border-border/80 z-50 overflow-hidden divide-y divide-border/50 animate-in fade-in-50 slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text">{__( 'Notifications', 'codeclove-school-management' )}</span>
              {unreadCount > 0 && (
                <span className="bg-brand-dim text-brand text-3xs font-semibold px-2 py-0.5 rounded-full">
                  {sprintf( __( '%d new', 'codeclove-school-management' ), unreadCount )}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markReadMutation.isPending}
                className="flex items-center gap-1 text-3xs font-medium text-brand hover:underline cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {__( 'Mark all read', 'codeclove-school-management' )}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border/50 border-t-0">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-text-subtle text-xs">{__( 'No notifications yet', 'codeclove-school-management' )}</div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.is_read
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif.id, notif.is_read, notif.url)}
                    className={`p-3.5 hover:bg-bg-base/70 transition-colors cursor-pointer flex items-start gap-3 ${
                      isUnread ? 'bg-bg-base/40' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isUnread ? 'bg-brand ring-4 ring-brand-dim' : 'bg-transparent'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${isUnread ? 'font-semibold text-text' : 'text-text-muted'}`}>
                        {notif.title}
                      </p>
                      {notif.content && (
                        <p className="text-3xs text-text-muted mt-0.5 line-clamp-2">{notif.content}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1 text-3xs text-text-subtle">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(notif.created_at)}</span>
                      </div>
                    </div>
                    {notif.url && <ExternalLink className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />}
                  </div>
                )
              })
            )}
          </div>

          <div className="border-t border-border/60 px-4 py-2.5 text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                navigate('/notifications')
              }}
              className="text-xs font-semibold text-brand hover:underline cursor-pointer py-1"
            >
              {__( 'View all notifications', 'codeclove-school-management' )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
