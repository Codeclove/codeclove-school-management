/**
 * NoticeComposerPage — Dedicated full-page composer for creating & editing school announcements.
 *
 * Implements a clean, high-confidence authoring workflow:
 *  - Main Canvas (Left 65%): Title with live char counter, rich-text formatting toolbar,
 *    generous markdown-capable content area, and action link configuration.
 *  - Publishing & Preview Sidebar (Right 35%):
 *    1. Real-time Live Recipient Preview card reflecting live changes.
 *    2. Unified Publishing Settings with first-class dropdowns (Audience, Category with
 *       semantic presets, Accent Color dropdown, Category Icon dropdown, scheduled publishing,
 *       expiration, and pin toggle).
 *  - Top Bar Actions: Primary CTA ("Publish Announcement" / "Schedule Announcement" / "Save Changes"),
 *    Cancel, and a prominent Delete button in edit mode.
 *  - Zero visual clutter: Clean whitespace hierarchy without arbitrary divider lines.
 *
 * Adheres strictly to codeclove-ui-ux and ponytail design standards.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  ExternalLink,
  Megaphone,
  Pin,
  Save,
  Send,
  Trash2,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  DatePicker,
  EmptyState,
  FormField,
  Input,
  Select,
  type SelectOption,
  Spinner,
} from '@/components/ui'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'
import { ROUTES } from '@/lib/constants'
import {
  CANONICAL_NOTICE_CATEGORIES,
  getCanonicalCategory,
  NOTICE_ACCENT_COLORS,
  NOTICE_ICONS,
  type NoticeAccentColor,
  type NoticeIconOption,
} from '@/portal/lib/notifications'
import {
  useAnnouncement,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
  type AnnouncementStatus,
} from '@/api/notifications'
import { NoticeCardPreview } from './components/NoticeCardPreview'
import { NoticeFormattingToolbar } from './components/NoticeFormattingToolbar'

const STATUS_CONFIG: Record<AnnouncementStatus, { variant: 'success' | 'info' | 'default'; label: string }> = {
  active: { variant: 'success', label: __( 'Active', 'codeclove-school-management' ) },
  scheduled: { variant: 'info', label: __( 'Scheduled', 'codeclove-school-management' ) },
  expired: { variant: 'default', label: __( 'Expired', 'codeclove-school-management' ) },
}

const ACCENT_COLOR_OPTIONS: SelectOption[] = NOTICE_ACCENT_COLORS.map( ( c: NoticeAccentColor ) => ( {
  value: c.id,
  label: c.label,
  prefix: <span className={cn( 'w-2.5 h-2.5 rounded-full shrink-0', c.swatchClass )} />,
} ) )

const ICON_OPTIONS: SelectOption[] = NOTICE_ICONS.map( ( opt: NoticeIconOption ) => {
  const IconComp = opt.icon
  return {
    value: opt.id,
    label: opt.label,
    prefix: <IconComp className="w-3.5 h-3.5 text-text-subtle shrink-0" />,
  }
} )
export const MAX_NOTICE_CONTENT_LENGTH = 5000

interface FormState {
  title: string
  content: string
  audience: 'portal' | 'staff' | 'all'
  eventType: string
  noticeDate: string
  expiresAt: string
  isPinned: boolean
  accentColor: string
  icon: string
  url: string
}

const initialForm: FormState = {
  title: '',
  content: '',
  audience: 'portal',
  eventType: 'announcement',
  noticeDate: new Date().toISOString().slice( 0, 10 ),
  expiresAt: '',
  isPinned: false,
  accentColor: 'purple',
  icon: 'megaphone',
  url: '',
}

export default function NoticeComposerPage() {
  const { id } = useParams<{ id?: string }>()
  const isEditing = Boolean( id )
  const announcementId = id ? Number( id ) : 0

  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const textareaRef = useRef<HTMLTextAreaElement>( null )

  // Queries & Mutations
  const { data: existingNotice, isLoading: isLoadingNotice, isError } = useAnnouncement( isEditing ? announcementId : null )
  const createMutation = useCreateAnnouncement()
  const updateMutation = useUpdateAnnouncement()
  const deleteMutation = useDeleteAnnouncement()

  // Form state
  const [form, setForm] = useState<FormState>( initialForm )
  const [formErrors, setFormErrors] = useState<Record<string, string>>( {} )

  const charCount = form.content.length

  useEffect( () => {
    if ( existingNotice ) {
      const cat = getCanonicalCategory( existingNotice.event_type )
      setForm( {
        title: existingNotice.title,
        content: existingNotice.content,
        audience: ( existingNotice.audience === 'portal' || existingNotice.audience === 'staff' || existingNotice.audience === 'all' )
          ? existingNotice.audience
          : 'portal',
        eventType: existingNotice.event_type || 'announcement',
        noticeDate: existingNotice.notice_date ? existingNotice.notice_date.slice( 0, 10 ) : existingNotice.created_at ? existingNotice.created_at.slice( 0, 10 ) : new Date().toISOString().slice( 0, 10 ),
        expiresAt: existingNotice.expires_at ? existingNotice.expires_at.slice( 0, 10 ) : '',
        isPinned: Boolean( existingNotice.is_pinned ),
        accentColor: existingNotice.accent_color || cat?.defaultAccentColor || 'purple',
        icon: existingNotice.icon || cat?.defaultIcon || 'megaphone',
        url: existingNotice.url || '',
      } )
    }
  }, [existingNotice] )

  // Check if scheduled for a future date
  const isScheduled = useMemo( () => {
    if ( ! form.noticeDate ) return false
    const today = new Date().toISOString().slice( 0, 10 )
    return form.noticeDate > today
  }, [form.noticeDate] )

  // Static options
  const audienceOptions: SelectOption[] = useMemo( () => [
    { value: 'portal', label: __( 'Students & Guardians (Portal)', 'codeclove-school-management' ) },
    { value: 'staff',  label: __( 'Staff & Faculty Only', 'codeclove-school-management' ) },
    { value: 'all',    label: __( 'Everyone (Students, Guardians & Staff)', 'codeclove-school-management' ) },
  ], [] )

  const eventTypeOptions: SelectOption[] = useMemo( () =>
    CANONICAL_NOTICE_CATEGORIES.slice( 0, 6 ).map( ( c ) => {
      const Icon = c.icon
      return {
        value: c.id,
        label: c.label,
        prefix: <Icon className={cn( 'w-4 h-4 shrink-0', c.textColor )} />,
      }
    } ),
  [] )


  // Form Validation & Submit
  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault()
    const errors: Record<string, string> = {}

    if ( ! form.title.trim() ) {
      errors.title = __( 'Title is required.', 'codeclove-school-management' )
    } else if ( form.title.trim().length > 160 ) {
      errors.title = __( 'Title must be 160 characters or less.', 'codeclove-school-management' )
    }

    if ( ! form.content.trim() ) {
      errors.content = __( 'Content is required.', 'codeclove-school-management' )
    } else if ( form.content.length > MAX_NOTICE_CONTENT_LENGTH ) {
      errors.content = sprintf(
        __( 'Content must be %s characters or less.', 'codeclove-school-management' ),
        MAX_NOTICE_CONTENT_LENGTH.toLocaleString()
      )
    }

    if ( form.expiresAt && form.noticeDate && form.expiresAt < form.noticeDate ) {
      errors.expiresAt = __( 'Expiry date cannot be earlier than publish date.', 'codeclove-school-management' )
    }

    if ( Object.keys( errors ).length > 0 ) {
      setFormErrors( errors )
      return
    }
    setFormErrors( {} )

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      audience: form.audience,
      event_type: form.eventType,
      notice_date: form.noticeDate || null,
      expires_at: form.expiresAt || null,
      is_pinned: form.isPinned,
      accent_color: form.accentColor,
      icon: form.icon,
      url: form.url.trim() || null,
    }

    if ( isEditing ) {
      updateMutation.mutate(
        { id: announcementId, data: payload },
        {
          onSuccess: () => {
            toast.success( __( 'Announcement updated.', 'codeclove-school-management' ) )
            navigate( ROUTES.ANNOUNCEMENTS )
          },
          onError: ( err: unknown ) => {
            toast.error( err instanceof Error ? err.message : __( 'Failed to update announcement.', 'codeclove-school-management' ) )
          },
        }
      )
    } else {
      createMutation.mutate( payload, {
        onSuccess: () => {
          toast.success(
            isScheduled
              ? __( 'Announcement scheduled successfully.', 'codeclove-school-management' )
              : __( 'Announcement published successfully.', 'codeclove-school-management' )
          )
          navigate( ROUTES.ANNOUNCEMENTS )
        },
        onError: ( err: unknown ) => {
          toast.error( err instanceof Error ? err.message : __( 'Failed to publish announcement.', 'codeclove-school-management' ) )
        },
      } )
    }
  }

  // Handle Delete (Edit mode only)
  const handleDelete = async () => {
    const isConfirmed = await confirm( {
      title: __( 'Delete Announcement', 'codeclove-school-management' ),
      message: __( 'Are you sure you want to delete this announcement? This action cannot be undone.', 'codeclove-school-management' ),
      confirmText: __( 'Delete', 'codeclove-school-management' ),
      variant: 'danger',
    } )

    if ( ! isConfirmed ) return

    deleteMutation.mutate( announcementId, {
      onSuccess: () => {
        toast.success( __( 'Announcement deleted.', 'codeclove-school-management' ) )
        navigate( ROUTES.ANNOUNCEMENTS )
      },
      onError: ( err: unknown ) => {
        toast.error( err instanceof Error ? err.message : __( 'Failed to delete announcement.', 'codeclove-school-management' ) )
      },
    } )
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const isDeleting = deleteMutation.isPending

  // Async loading & error states
  if ( isEditing && isLoadingNotice ) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if ( isEditing && isError ) {
    return (
      <EmptyState
        icon={AlertCircle}
        title={__( 'Announcement Not Found', 'codeclove-school-management' )}
        description={__( 'The requested announcement record does not exist or may have been deleted.', 'codeclove-school-management' )}
        action={
          <Button variant="secondary" onClick={() => navigate( ROUTES.ANNOUNCEMENTS )}>
            {__( 'Back to Noticeboard', 'codeclove-school-management' )}
          </Button>
        }
        className="py-24"
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ─── Breadcrumb & Top Action Header (No line) ─────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="space-y-1">
          <Link
            to={ROUTES.ANNOUNCEMENTS}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-brand transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{__( 'Back to Noticeboard', 'codeclove-school-management' )}</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              {isEditing ? __( 'Edit Announcement', 'codeclove-school-management' ) : __( 'Compose Announcement', 'codeclove-school-management' )}
            </h1>
            {isEditing && existingNotice && (
              <Badge variant={STATUS_CONFIG[existingNotice.status]?.variant ?? 'default'} size="sm">
                {STATUS_CONFIG[existingNotice.status]?.label ?? existingNotice.status}
              </Badge>
            )}
            {! isEditing && isScheduled && (
              <Badge variant="info" size="sm">
                {__( 'Will be scheduled', 'codeclove-school-management' )}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isEditing && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
              className="gap-1.5 border-danger/30 text-danger hover:bg-danger/10 hover:border-danger/50 shadow-xs"
            >
              {isDeleting ? <Spinner size="sm" /> : <Trash2 className="w-3.5 h-3.5 text-danger" />}
              <span>{__( 'Delete', 'codeclove-school-management' )}</span>
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate( ROUTES.ANNOUNCEMENTS )}
            disabled={isSaving || isDeleting}
          >
            {__( 'Cancel', 'codeclove-school-management' )}
          </Button>

          <Button type="submit" disabled={isSaving || isDeleting} className="gap-2 shadow-sm">
            {isSaving ? (
              <Spinner size="sm" />
            ) : isEditing ? (
              <Save className="w-4 h-4" />
            ) : isScheduled ? (
              <Calendar className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>
              {isEditing
                ? __( 'Save Changes', 'codeclove-school-management' )
                : isScheduled
                  ? __( 'Schedule Announcement', 'codeclove-school-management' )
                  : __( 'Publish Announcement', 'codeclove-school-management' )}
            </span>
          </Button>
        </div>
      </div>

      {/* ─── Two-Column Document Canvas & Sidebar Layout ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Main Document Canvas): 7 of 12 cols */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border border-border shadow-card bg-bg-elevated p-6 space-y-5">
            {/* Title Field */}
            <FormField
              label={__( 'Title', 'codeclove-school-management' )}
              required
              error={formErrors.title}
            >
              <div className="relative">
                <Input
                  id="composerTitle"
                  placeholder={__( 'e.g. Annual Sports Meet 2026 Schedule & Guidelines', 'codeclove-school-management' )}
                  value={form.title}
                  onChange={( e ) => setForm( ( f ) => ( { ...f, title: e.target.value } ) )}
                  maxLength={160}
                  aria-invalid={Boolean( formErrors.title )}
                  className="pr-16 text-sm font-semibold"
                />
                <span
                  className={cn(
                    'absolute right-3 top-1/2 -translate-y-1/2 text-2xs font-mono select-none transition-colors',
                    form.title.length >= 150
                      ? 'text-danger font-bold'
                      : form.title.length >= 130
                        ? 'text-amber-500 font-medium'
                        : 'text-text-subtle'
                  )}
                >
                  {form.title.length}/160
                </span>
              </div>
            </FormField>

            {/* Content Field with Formatting Toolbar */}
            <FormField
              label={__( 'Content', 'codeclove-school-management' )}
              required
              error={formErrors.content}
            >
              <div className="rounded-lg border border-border overflow-hidden bg-bg-surface focus-within:ring-2 focus-within:ring-brand focus-within:border-brand transition-all">
                <NoticeFormattingToolbar
                  textareaRef={textareaRef}
                  value={form.content}
                  onChange={( val ) => setForm( ( f ) => ( { ...f, content: val } ) )}
                />
                <textarea
                  ref={textareaRef}
                  id="composerContent"
                  rows={15}
                  value={form.content}
                  onChange={( e ) => setForm( ( f ) => ( { ...f, content: e.target.value } ) )}
                  placeholder={__( 'Write announcement details, timetable, or guidelines here...', 'codeclove-school-management' )}
                  aria-invalid={Boolean( formErrors.content )}
                  className="w-full p-3.5 text-sm leading-relaxed bg-transparent border-0 focus:outline-none focus:ring-0 resize-y text-text placeholder:text-text-subtle/70 min-h-[340px]"
                />
                {/* Editor Bottom Status Bar: Markdown hint & live char count */}
                <div className="flex items-center justify-between px-3.5 py-2 border-t border-border/70 bg-bg-surface/60 text-2xs select-none">
                  <span className="text-text-subtle">
                    {__( 'Supports Markdown (bold, lists, quotes, links)', 'codeclove-school-management' )}
                  </span>

                  <span
                    className={cn(
                      'font-mono font-medium',
                      charCount > MAX_NOTICE_CONTENT_LENGTH
                        ? 'text-danger font-bold'
                        : charCount >= MAX_NOTICE_CONTENT_LENGTH * 0.9
                          ? 'text-amber-500 font-semibold'
                          : 'text-text-subtle'
                    )}
                  >
                    {sprintf(
                      __( '%s / %s chars', 'codeclove-school-management' ),
                      charCount.toLocaleString(),
                      MAX_NOTICE_CONTENT_LENGTH.toLocaleString()
                    )}
                  </span>
                </div>
              </div>
            </FormField>

            {/* Action Link / Destination URL */}
            <FormField label={__( 'Action Link & Resource (Optional)', 'codeclove-school-management' )}>
              <div className="relative">
                <ExternalLink className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
                <Input
                  type="text"
                  placeholder={__( 'https://... or /portal/... (e.g. https://school.edu/sports-circular.pdf)', 'codeclove-school-management' )}
                  value={form.url}
                  onChange={( e ) => setForm( ( f ) => ( { ...f, url: e.target.value } ) )}
                  className="pl-9 text-xs"
                />
              </div>
            </FormField>
          </Card>
        </div>

        {/* Right Column: Live Recipient Preview & Publishing Sidebar: 5 of 12 cols */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Real-time Live Recipient Preview */}
          <NoticeCardPreview
            title={form.title}
            content={form.content}
            audience={form.audience}
            eventType={form.eventType}
            noticeDate={form.noticeDate}
            expiresAt={form.expiresAt}
            isPinned={form.isPinned}
            accentColor={form.accentColor}
            icon={form.icon}
            url={form.url}
          />

          {/* 2. Publishing Settings Card (Clean, line-free hierarchy) */}
          <Card className="border border-border shadow-card bg-bg-elevated p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-brand" />
              <h3 className="text-sm font-bold text-text tracking-tight">
                {__( 'Publishing Settings', 'codeclove-school-management' )}
              </h3>
            </div>

            {/* Target Audience */}
            <FormField label={__( 'Audience', 'codeclove-school-management' )} required>
              <Select
                value={form.audience}
                onValueChange={( val ) => setForm( ( f ) => ( { ...f, audience: val as 'portal' | 'staff' | 'all' } ) )}
                options={audienceOptions}
              />
            </FormField>

            {/* Notice Category */}
            <FormField label={__( 'Category', 'codeclove-school-management' )} required>
              <Select
                value={form.eventType}
                onValueChange={( val ) => {
                  const cat = getCanonicalCategory( val )
                  setForm( ( f ) => ( {
                    ...f,
                    eventType: val,
                    accentColor: cat?.defaultAccentColor || 'purple',
                    icon: cat?.defaultIcon || 'megaphone',
                  } ) )
                }}
                options={eventTypeOptions}
              />
            </FormField>

            {/* 2-Column Grid: Accent Color & Category Icon Dropdowns */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label={__( 'Accent Color', 'codeclove-school-management' )}>
                <Select
                  value={form.accentColor}
                  onValueChange={( val ) => setForm( ( f ) => ( { ...f, accentColor: val } ) )}
                  options={ACCENT_COLOR_OPTIONS}
                />
              </FormField>

              <FormField label={__( 'Category Icon', 'codeclove-school-management' )}>
                <Select
                  value={form.icon}
                  onValueChange={( val ) => setForm( ( f ) => ( { ...f, icon: val } ) )}
                  options={ICON_OPTIONS}
                />
              </FormField>
            </div>

            {/* Publish Date */}
            <FormField
              label={__( 'Publish Date', 'codeclove-school-management' )}
              hint={
                isScheduled
                  ? __( 'Notice is scheduled and will appear automatically on this date.', 'codeclove-school-management' )
                  : undefined
              }
            >
              <DatePicker
                value={form.noticeDate}
                onChange={( val ) => setForm( ( f ) => ( { ...f, noticeDate: val || '' } ) )}
                placeholder={__( 'Select date', 'codeclove-school-management' )}
              />
            </FormField>

            {/* Expiry Date */}
            <FormField
              label={__( 'Expiry Date (Optional)', 'codeclove-school-management' )}
              hint={__( 'Notice will be archived from feeds after this date.', 'codeclove-school-management' )}
              error={formErrors.expiresAt}
            >
              <DatePicker
                value={form.expiresAt}
                onChange={( val ) => setForm( ( f ) => ( { ...f, expiresAt: val || '' } ) )}
                placeholder={__( 'No expiration', 'codeclove-school-management' )}
                clearable
              />
            </FormField>

            {/* Pinned Notice (No divider line) */}
            <div className="pt-1">
              <label
                htmlFor="composerIsPinned"
                className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  id="composerIsPinned"
                  checked={form.isPinned}
                  onChange={( e ) => setForm( ( f ) => ( { ...f, isPinned: e.target.checked } ) )}
                  className="h-4 w-4 rounded border-border text-brand focus:ring-brand/30 cursor-pointer"
                />
                <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                <span>{__( 'Pin to top of noticeboard', 'codeclove-school-management' )}</span>
              </label>
            </div>
          </Card>
        </div>
      </div>
    </form>
  )
}
