import { useState, useEffect } from 'react'
import type { Control, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { UserPlus, Link2, Unlink, RefreshCw, KeyRound, Shield, Search, CheckCircle2 } from 'lucide-react'
import type { StaffFormValues } from '@/schemas/staff'
import { useSearchStaffWpUsers, useResetStaffWpPassword, type Staff, type StaffWpUserSearchResult } from '@/api/staff'
import { FormField, Input, Button, Badge, Checkbox } from '@/components/ui'
import { useToast } from '@/lib/toast'
import { __ } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface StaffAccountSectionProps {
  control?: Control<StaffFormValues>
  setValue: UseFormSetValue<StaffFormValues>
  watch: UseFormWatch<StaffFormValues>
  errors: FieldErrors<StaffFormValues>
  initialData?: Staff | null
  mode: 'add' | 'edit'
  disabled?: boolean
}

function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$'
  return Array.from(crypto.getRandomValues(new Uint8Array(14)), (b) => chars[b % chars.length]).join('')
}

function slugify(first?: string, last?: string, email?: string): string {
  const base = `${first || ''}.${last || ''}`.toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/^\.+|\.+$/g, '')
  return base || email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'staff'
}

export default function StaffAccountSection({
  setValue,
  watch,
  errors,
  initialData,
  mode,
  disabled = false,
}: StaffAccountSectionProps) {
  const toast = useToast()
  const resetPasswordMutation = useResetStaffWpPassword()

  const watchedUserId = watch('user_id')
  const watchedUsername = watch('username')
  const watchedPassword = watch('password')
  const watchedSendEmail = watch('send_email')
  const watchedFirstName = watch('first_name')
  const watchedLastName = watch('last_name')
  const watchedEmail = watch('email')

  const [tab, setTab] = useState<'create' | 'link' | 'none'>(() => {
    if (initialData?.user_id) return 'link'
    return mode === 'add' ? 'create' : 'none'
  })
  const [search, setSearch] = useState('')
  const [isTouched, setIsTouched] = useState(false)

  // Synchronize form values whenever active tab or initial data changes
  useEffect(() => {
    if (tab === 'create') {
      setValue('create_user', true, { shouldValidate: true })
      setValue('user_id', null)
      setValue('send_email', true)
      if (!watchedPassword) {
        setValue('password', generatePassword(), { shouldValidate: true })
      }
      if (!watchedUsername) {
        setValue('username', slugify(watchedFirstName, watchedLastName, watchedEmail), { shouldValidate: true })
      }
    } else if (tab === 'link') {
      setValue('create_user', false)
      if (initialData?.user_id) {
        setValue('user_id', initialData.user_id)
      }
    } else if (tab === 'none') {
      setValue('create_user', false)
      setValue('user_id', null)
    }
  }, [tab, initialData?.id, initialData?.user_id, setValue])

  // Auto-slugify username if untouched
  useEffect(() => {
    if (tab === 'create' && !isTouched && (watchedFirstName || watchedLastName)) {
      setValue('username', slugify(watchedFirstName, watchedLastName, watchedEmail))
    }
  }, [watchedFirstName, watchedLastName, watchedEmail, tab, isTouched, setValue])

  const { data: users = [], isLoading: isSearching } = useSearchStaffWpUsers(search, watchedEmail || '', tab === 'link')

  const handleTabChange = (next: 'create' | 'link' | 'none') => {
    setTab(next)
    if (next === 'create') {
      setValue('create_user', true)
      setValue('user_id', null)
      if (!watchedPassword) setValue('password', generatePassword())
      if (!watchedUsername) setValue('username', slugify(watchedFirstName, watchedLastName, watchedEmail))
    } else if (next === 'link') {
      setValue('create_user', false)
    } else {
      setValue('create_user', false)
      setValue('user_id', null)
    }
  }

  const isLinked = Boolean(watchedUserId)

  return (
    <div className="border-t border-border pt-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
            <Shield size={14} className="text-brand" />
            {__( 'WordPress User Account', 'codeclove-school-management' )}
          </h4>
          <p className="text-2xs text-text-muted mt-0.5">
            {__( 'Manage dashboard access credentials and authentication for this staff member.', 'codeclove-school-management' )}
          </p>
        </div>

        <div className="inline-flex items-center rounded-lg bg-bg-surface border border-border p-1 self-start sm:self-auto">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleTabChange('create')}
            className={cn('px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
              tab === 'create' ? 'bg-brand text-white shadow-2xs' : 'text-text-muted hover:text-text'
            )}
          >
            <UserPlus size={13} />
            {__( 'Create New', 'codeclove-school-management' )}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleTabChange('link')}
            className={cn('px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
              tab === 'link' ? 'bg-brand text-white shadow-2xs' : 'text-text-muted hover:text-text'
            )}
          >
            <Link2 size={13} />
            {__( 'Link Existing', 'codeclove-school-management' )}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleTabChange('none')}
            className={cn('px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              tab === 'none' ? 'bg-bg-elevated text-text font-semibold shadow-2xs' : 'text-text-muted hover:text-text'
            )}
          >
            {__( 'No Account', 'codeclove-school-management' )}
          </button>
        </div>
      </div>

      {tab === 'create' && (
        <div className="p-4 rounded-xl border border-brand/20 bg-brand/5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={__( 'WordPress Username', 'codeclove-school-management' )} required error={errors.username?.message}>
              <Input
                value={watchedUsername || ''}
                onChange={(e) => {
                  setIsTouched(true)
                  setValue('username', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''), { shouldValidate: true })
                }}
                placeholder="username"
                disabled={disabled}
                className="font-mono text-sm"
              />
            </FormField>

            <FormField label={__( 'Initial Password', 'codeclove-school-management' )} required error={errors.password?.message}>
              <div className="flex gap-2">
                <Input
                  value={watchedPassword || ''}
                  onChange={(e) => setValue('password', e.target.value, { shouldValidate: true })}
                  placeholder={__( 'Password', 'codeclove-school-management' )}
                  disabled={disabled}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setValue('password', generatePassword(), { shouldValidate: true })
                    toast.success(__( 'Generated new password.', 'codeclove-school-management' ))
                  }}
                  disabled={disabled}
                  className="shrink-0 text-xs"
                >
                  <RefreshCw size={13} className="mr-1" />
                  {__( 'Generate', 'codeclove-school-management' )}
                </Button>
              </div>
            </FormField>
          </div>

          <div className="pt-2 border-t border-brand/10">
            <Checkbox
              id="staff_send_welcome_email"
              checked={watchedSendEmail ?? true}
              onChange={(e) => setValue('send_email', e.target.checked)}
              disabled={disabled}
              label={__( 'Email login instructions & credentials to staff member', 'codeclove-school-management' )}
              labelClassName="text-xs text-text cursor-pointer select-none"
            />
          </div>
        </div>
      )}

      {tab === 'link' && (
        <div className="p-4 rounded-xl border border-border bg-bg-surface space-y-4">
          {isLinked && (
            <div className="p-3 rounded-lg border border-brand/30 bg-brand/5 flex items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-text text-xs">
                  {initialData?.username ? `@${initialData.username}` : `User #${watchedUserId}`}
                </span>
                <Badge variant="success" className="text-3xs py-0 px-1.5 ms-2">
                  {__( 'Linked', 'codeclove-school-management' )}
                </Badge>
              </div>
              <div className="flex gap-1.5">
                {mode === 'edit' && initialData?.id && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="text-xs h-7"
                    disabled={resetPasswordMutation.isPending || disabled}
                    onClick={async () => {
                      try {
                        const res = await resetPasswordMutation.mutateAsync(initialData.id)
                        toast.success(res.message || __( 'Password reset sent.', 'codeclove-school-management' ))
                      } catch {
                        toast.error(__( 'Failed to send reset.', 'codeclove-school-management' ))
                      }
                    }}
                  >
                    <KeyRound size={12} className="mr-1" />
                    {__( 'Reset Password', 'codeclove-school-management' )}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs text-danger hover:text-danger hover:bg-danger/10 h-7"
                  disabled={disabled}
                  onClick={() => {
                    setValue('user_id', null, { shouldValidate: true, shouldDirty: true })
                    setValue('create_user', false)
                    setTab('none')
                  }}
                >
                  <Unlink size={12} className="mr-1" />
                  {__( 'Disconnect', 'codeclove-school-management' )}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="relative">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={__( 'Search users by name, username, or email...', 'codeclove-school-management' )}
                disabled={disabled}
                className="ps-8 text-xs"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-text-muted" />
            </div>

            {isSearching ? (
              <p className="text-2xs text-text-muted py-1">{__( 'Searching...', 'codeclove-school-management' )}</p>
            ) : users.length > 0 ? (
              <div className="max-h-40 overflow-y-auto space-y-1 overscroll-contain">
                {users.map((u: StaffWpUserSearchResult) => {
                  const isCurrent = u.id === watchedUserId
                  const isLinkedOther = u.linked_staff && u.linked_staff.id !== initialData?.id
                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        if (!isLinkedOther) {
                          setValue('user_id', u.id, { shouldValidate: true, shouldDirty: true })
                          setValue('create_user', false)
                        }
                      }}
                      className={cn(
                        'p-2 rounded-lg border text-xs flex items-center justify-between transition-colors',
                        isCurrent ? 'border-brand bg-brand/10' : isLinkedOther ? 'opacity-50 cursor-not-allowed border-border' : 'border-border hover:border-brand/40 cursor-pointer'
                      )}
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-text">{u.display_name}</span>{' '}
                        <span className="text-brand font-mono text-3xs">@{u.username}</span>
                        <p className="text-3xs text-text-muted">{u.email}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={isCurrent ? 'default' : 'secondary'}
                        disabled={Boolean(isLinkedOther) || disabled}
                        className="text-3xs h-6 px-2 shrink-0"
                      >
                        {isCurrent ? <CheckCircle2 size={12} className="mr-1" /> : null}
                        {isCurrent ? __( 'Selected', 'codeclove-school-management' ) : __( 'Select', 'codeclove-school-management' )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'none' && (
        <div className="p-3 rounded-lg border border-border bg-bg-surface text-xs text-text-muted">
          {__( 'This staff member is not linked to any WordPress user account.', 'codeclove-school-management' )}
        </div>
      )}
    </div>
  )
}
