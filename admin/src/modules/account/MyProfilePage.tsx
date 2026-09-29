import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Sun, Moon, Monitor, Eye, EyeOff } from 'lucide-react'
import { useMe, useUpdateMe, type UpdateMePayload } from '@/api/me'
import { useTheme } from '@/lib/theme'
import { useToast } from '@/lib/toast'
import { __ } from '@/lib/i18n'
import {
  Button, Card, FormField, Input, Spinner, PageHeader, Skeleton
} from '@/components/ui'
import { api } from '@/lib/api-client'

export default function MyProfilePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { theme, setTheme } = useTheme()
  const { data: me, isLoading } = useMe()
  const updateMeMutation = useUpdateMe()

  const config = window.CodeCloveConfig
  const isAdmin = config?.currentUser?.isAdmin

  const [activeTab, setActiveTab] = useState<'profile' | 'preferences'>('profile')
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)

  // Local preferences state (Option C / localStorage-only)
  const [layout, setLayout] = useState(() => localStorage.getItem('codeclove:layout') || 'boxed')
  const [sidebarDensity, setSidebarDensity] = useState(() => localStorage.getItem('codeclove:sidebar-density') || 'comfortable')
  const [tableDensity, setTableDensity] = useState(() => localStorage.getItem('codeclove:table-density') || 'comfortable')

  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({
    notify_admission_received: true,
    notify_admission_status: true,
    notify_invoice_issued: true,
    notify_payment_recorded: true,
    notify_invoice_overdue: true,
    notify_attendance_taken: true,
  })

  // Form state
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    preferred_name: '',
    phone: '',
    photo_id: null as number | null,
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [photoUrl, setPhotoUrl] = useState('')
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      navigate('/settings')
    }
  }, [isAdmin, navigate])

  useEffect(() => {
    if (me) {
      setForm(prev => ({
        ...prev,
        first_name: me.first_name || '',
        last_name: me.last_name || '',
        preferred_name: me.preferred_name || '',
        phone: me.phone || '',
        photo_id: me.photo_id || null,
      }))
      setPhotoUrl(me.photo_url || '')
      if (me.notification_preferences) {
        setNotificationPrefs(prev => ({
          ...prev,
          ...me.notification_preferences,
        }))
      }
    }
  }, [me])

  if (isAdmin) {
    return null
  }

  if (isLoading) {
    return (
      <div className="space-y-6 w-full">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post<{ id: number; url: string }>('media/upload', formData)
      if (res.success) {
        setForm(prev => ({ ...prev, photo_id: res.data.id }))
        setPhotoUrl(res.data.url)
        toast.success(__('Profile photo uploaded successfully!', 'codeclove-school-management'))
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __('Failed to upload image', 'codeclove-school-management')
      toast.error(message)
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handlePreferenceChange = (key: 'layout' | 'sidebar-density' | 'table-density', value: string) => {
    localStorage.setItem(`codeclove:${key}`, value)
    const attrName = key === 'layout' ? 'layout-density' : key
    document.documentElement.setAttribute(`data-${attrName}`, value)
    if (key === 'layout') setLayout(value)
    if (key === 'sidebar-density') setSidebarDensity(value)
    if (key === 'table-density') setTableDensity(value)
    toast.success(__('Preference updated successfully!', 'codeclove-school-management'))
  }

  const handleNotificationPrefChange = (key: string, checked: boolean) => {
    const updatedPrefs = { ...notificationPrefs, [key]: checked }
    setNotificationPrefs(updatedPrefs)

    const payload: UpdateMePayload = {
      first_name: form.first_name,
      last_name: form.last_name,
      preferred_name: form.preferred_name || null,
      phone: form.phone || null,
      photo_id: form.photo_id,
      notification_preferences: updatedPrefs,
    }

    updateMeMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(__('Notification preference updated!', 'codeclove-school-management'))
      },
      onError: (err: Error) => {
        toast.error(err.message || __('Failed to update preference.', 'codeclove-school-management'))
        // revert local state
        setNotificationPrefs(prev => ({ ...prev, [key]: !checked }))
      }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error(__('First and last name are required.', 'codeclove-school-management'))
      return
    }

    if (form.new_password || form.current_password || form.confirm_password) {
      if (!form.current_password) {
        toast.error(__('Current password is required to change password.', 'codeclove-school-management'))
        return
      }
      if (!form.new_password || form.new_password.length < 6) {
        toast.error(__('New password must be at least 6 characters.', 'codeclove-school-management'))
        return
      }
      if (form.new_password !== form.confirm_password) {
        toast.error(__('New passwords do not match.', 'codeclove-school-management'))
        return
      }
    }

    const payload: UpdateMePayload = {
      first_name: form.first_name,
      last_name: form.last_name,
      preferred_name: form.preferred_name || null,
      phone: form.phone || null,
      photo_id: form.photo_id,
    }

    if (form.new_password) {
      payload.current_password = form.current_password
      payload.new_password = form.new_password
    }

    updateMeMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(__('Account profile updated successfully!', 'codeclove-school-management'))
        // Clear password fields
        setForm(prev => ({
          ...prev,
          current_password: '',
          new_password: '',
          confirm_password: '',
        }))
      },
      onError: (err: Error) => {
        toast.error(err.message || __('Failed to update profile.', 'codeclove-school-management'))
      },
    })
  }

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title={__('My Account', 'codeclove-school-management')}
        description={__('View and update your personal staff details, reset your password, and customize your app interface.', 'codeclove-school-management')}
      />

      <div className="flex border-b border-border/60 gap-4 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          {__('Profile Details', 'codeclove-school-management')}
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'preferences'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          {__('Preferences', 'codeclove-school-management')}
        </button>
      </div>

      {activeTab === 'profile' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-bold text-text tracking-tight uppercase pb-2.5 border-b border-border/60">
              {__('Personal Information', 'codeclove-school-management')}
            </h3>

            {/* Photo Uploader */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-bg-light/30 rounded-lg p-3 border border-border/40">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <input
                  type="file"
                  id="me-photo-input"
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={isUploadingPhoto || updateMeMutation.isPending}
                />
                {isUploadingPhoto ? (
                  <div className="w-12 h-12 rounded-full border border-border bg-bg-surface flex items-center justify-center flex-shrink-0">
                    <Spinner size="sm" />
                  </div>
                ) : photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={__('Profile', 'codeclove-school-management')}
                    className="w-12 h-12 rounded-full object-cover border border-border flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">
                    <User size={20} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{__('Profile Picture', 'codeclove-school-management')}</p>
                  <p className="text-xs text-text-muted">{__('Upload a profile photo (PNG, JPG, max 2MB)', 'codeclove-school-management')}</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => document.getElementById('me-photo-input')?.click()}
                disabled={isUploadingPhoto || updateMeMutation.isPending}
              >
                {__('Change Photo', 'codeclove-school-management')}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label={__('First Name', 'codeclove-school-management')} required>
                <Input
                  value={form.first_name}
                  onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                  disabled={updateMeMutation.isPending}
                />
              </FormField>

              <FormField label={__('Last Name', 'codeclove-school-management')} required>
                <Input
                  value={form.last_name}
                  onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
                  disabled={updateMeMutation.isPending}
                />
              </FormField>

              <FormField label={__('Preferred Name', 'codeclove-school-management')}>
                <Input
                  value={form.preferred_name}
                  onChange={e => setForm(p => ({ ...p, preferred_name: e.target.value }))}
                  disabled={updateMeMutation.isPending}
                />
              </FormField>

              <FormField label={__('Phone Number', 'codeclove-school-management')}>
                <Input
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  disabled={updateMeMutation.isPending}
                />
              </FormField>

              <FormField label={__('Email Address', 'codeclove-school-management')}>
                <Input
                  value={me?.email || ''}
                  disabled
                  title={__('Email cannot be modified directly from self profile page. Please contact administration.', 'codeclove-school-management')}
                />
                <p className="text-2xs text-text-muted mt-1">{__('To change your email address, please contact administration.', 'codeclove-school-management')}</p>
              </FormField>

              <FormField label={__('Staff ID / Number', 'codeclove-school-management')}>
                <Input value={me?.staff_number || ''} disabled />
              </FormField>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-bold text-text tracking-tight uppercase pb-2.5 border-b border-border/60">
              {__('Security & Password', 'codeclove-school-management')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label={__('Current Password', 'codeclove-school-management')}>
                <div className="relative">
                  <Input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={form.current_password}
                    onChange={e => setForm(p => ({ ...p, current_password: e.target.value }))}
                    disabled={updateMeMutation.isPending}
                    placeholder={__('Enter current password', 'codeclove-school-management')}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-2.5 text-text-muted hover:text-text"
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>

              <FormField label={__('New Password', 'codeclove-school-management')}>
                <div className="relative">
                  <Input
                    type={showNewPass ? 'text' : 'password'}
                    value={form.new_password}
                    onChange={e => setForm(p => ({ ...p, new_password: e.target.value }))}
                    disabled={updateMeMutation.isPending}
                    placeholder={__('Min 6 characters', 'codeclove-school-management')}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-2.5 text-text-muted hover:text-text"
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>

              <FormField label={__('Confirm New Password', 'codeclove-school-management')}>
                <div className="relative">
                  <Input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={form.confirm_password}
                    onChange={e => setForm(p => ({ ...p, confirm_password: e.target.value }))}
                    disabled={updateMeMutation.isPending}
                    placeholder={__('Repeat new password', 'codeclove-school-management')}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-2.5 text-text-muted hover:text-text"
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="submit"
              disabled={updateMeMutation.isPending}
            >
              {updateMeMutation.isPending ? __('Saving...', 'codeclove-school-management') : __('Save Profile Changes', 'codeclove-school-management')}
            </Button>
          </div>
        </form>
      )}

      {activeTab === 'preferences' && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-bold text-text tracking-tight uppercase pb-2.5 border-b border-border/60">
              {__('Appearance Preferences', 'codeclove-school-management')}
            </h3>

            <div className="space-y-5">
              {/* Theme Mode Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{__('Theme Mode', 'codeclove-school-management')}</p>
                  <p className="text-xs text-text-muted">{__('Choose your preferred application color theme.', 'codeclove-school-management')}</p>
                </div>
                <div className="flex bg-bg-light p-1 rounded-lg border border-border/60 self-start sm:self-auto">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      theme === 'light'
                        ? 'bg-bg-surface text-text shadow-xs border border-border/40'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    <Sun size={14} /> {__('Light', 'codeclove-school-management')}
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      theme === 'dark'
                        ? 'bg-bg-surface text-text shadow-xs border border-border/40'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    <Moon size={14} /> {__('Dark', 'codeclove-school-management')}
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      theme === 'system'
                        ? 'bg-bg-surface text-text shadow-xs border border-border/40'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    <Monitor size={14} /> {__('System', 'codeclove-school-management')}
                  </button>
                </div>
              </div>

              {/* Layout Mode */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{__('Page Layout', 'codeclove-school-management')}</p>
                  <p className="text-xs text-text-muted">{__('Configure the width of the main content layout.', 'codeclove-school-management')}</p>
                </div>
                <div className="flex bg-bg-light p-1 rounded-lg border border-border/60 self-start sm:self-auto">
                  <button
                    onClick={() => handlePreferenceChange('layout', 'boxed')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      layout === 'boxed'
                        ? 'bg-bg-surface text-text shadow-xs border border-border/40'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {__('Boxed Width', 'codeclove-school-management')}
                  </button>
                  <button
                    onClick={() => handlePreferenceChange('layout', 'fluid')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      layout === 'fluid'
                        ? 'bg-bg-surface text-text shadow-xs border border-border/40'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {__('Full Width', 'codeclove-school-management')}
                  </button>
                </div>
              </div>

              {/* Sidebar Density */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{__('Sidebar Layout Density', 'codeclove-school-management')}</p>
                  <p className="text-xs text-text-muted">{__('Switch navigation links density.', 'codeclove-school-management')}</p>
                </div>
                <div className="flex bg-bg-light p-1 rounded-lg border border-border/60 self-start sm:self-auto">
                  <button
                    onClick={() => handlePreferenceChange('sidebar-density', 'comfortable')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      sidebarDensity === 'comfortable'
                        ? 'bg-bg-surface text-text shadow-xs border border-border/40'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {__('Comfortable', 'codeclove-school-management')}
                  </button>
                  <button
                    onClick={() => handlePreferenceChange('sidebar-density', 'compact')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      sidebarDensity === 'compact'
                        ? 'bg-bg-surface text-text shadow-xs border border-border/40'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {__('Compact', 'codeclove-school-management')}
                  </button>
                </div>
              </div>

              {/* Table Density */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{__('Data Table Spacing', 'codeclove-school-management')}</p>
                  <p className="text-xs text-text-muted">{__('Configure vertical padding for database tables.', 'codeclove-school-management')}</p>
                </div>
                <div className="flex bg-bg-light p-1 rounded-lg border border-border/60 self-start sm:self-auto">
                  <button
                    onClick={() => handlePreferenceChange('table-density', 'comfortable')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      tableDensity === 'comfortable'
                        ? 'bg-bg-surface text-text shadow-xs border border-border/40'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {__('Comfortable', 'codeclove-school-management')}
                  </button>
                  <button
                    onClick={() => handlePreferenceChange('table-density', 'compact')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      tableDensity === 'compact'
                        ? 'bg-bg-surface text-text shadow-xs border border-border/40'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {__('Compact', 'codeclove-school-management')}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Notification Preferences */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-bold text-text tracking-tight uppercase pb-2.5 border-b border-border/60 flex items-center gap-1.5">
              <User size={13} className="text-text-subtle" /> {__('In-App Notification Preferences', 'codeclove-school-management')}
            </h3>

            <div className="space-y-4">
              <p className="text-xs text-text-subtle">
                {__('Choose which types of system events you want to be notified about in your in-app feed. Changes are saved automatically.', 'codeclove-school-management')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {[
                  { key: 'notify_admission_received', label: __('Admission Submitted', 'codeclove-school-management'), desc: __('New admission application is received', 'codeclove-school-management') },
                  { key: 'notify_admission_status', label: __('Admission Status Updated', 'codeclove-school-management'), desc: __('An application pipeline status changes', 'codeclove-school-management') },
                  { key: 'notify_invoice_issued', label: __('Invoice Issued', 'codeclove-school-management'), desc: __('A new fee invoice is generated', 'codeclove-school-management') },
                  { key: 'notify_payment_recorded', label: __('Payment Received', 'codeclove-school-management'), desc: __('A fee payment receipt is recorded', 'codeclove-school-management') },
                  { key: 'notify_invoice_overdue', label: __('Invoice Overdue', 'codeclove-school-management'), desc: __('Bills pass their due date', 'codeclove-school-management') },
                  { key: 'notify_attendance_taken', label: __('Attendance Taken', 'codeclove-school-management'), desc: __('Daily attendance register is saved', 'codeclove-school-management') },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-bg-light/10 hover:bg-bg-light/30 transition-colors select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!notificationPrefs[key]}
                      disabled={updateMeMutation.isPending}
                      onChange={(e) => handleNotificationPrefChange(key, e.target.checked)}
                      className="mt-0.5 rounded border-border text-brand focus:ring-brand-ring"
                    />
                    <div className="text-start min-w-0 flex-1">
                      <p className="text-xs font-medium text-text">{label}</p>
                      <p className="text-2xs text-text-subtle mt-0.5">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
