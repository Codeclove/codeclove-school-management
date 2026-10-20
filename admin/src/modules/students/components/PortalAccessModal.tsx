import { useState, useEffect } from 'react'
import {
  UserPlus,
  Link2,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  Users,
} from 'lucide-react'
import {
  Modal,
  ModalFooter,
  Button,
  Input,
  FormField,
  Badge,
  Spinner,
  Skeleton,
} from '@/components/ui'
import {
  useCreatePortalAccount,
  useLinkPortalAccount,
  useSearchPortalUsers,
  type PortalUserSearchResult,
  type PortalAccount,
} from '@/api/students'
import { useToast } from '@/lib/toast'
import { __, sprintf } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface PortalMemberTarget {
  id: string
  name: string
  role: string
  isStudent: boolean
  type: 'student' | 'guardian'
  entityId: number
  guardianId?: number
  email?: string
  defaultUsername: string
  avatarText?: string
  identifier?: string
  portalAccount?: PortalAccount | null
}

interface PortalAccessModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: number
  member: PortalMemberTarget
  initialTab?: 'create' | 'link'
  onSuccess: (credentials?: { name: string; username: string; password?: string }) => void
}

function generateRandomPassword(length = 16): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*+='
  const array = new Uint8Array(length)
  window.crypto.getRandomValues(array)
  return Array.from(array, (byte) => chars[byte % chars.length]).join('')
}

function UserCard({
  user,
  isSelected,
  onSelect,
}: {
  user: PortalUserSearchResult
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3',
        isSelected
          ? 'border-brand bg-brand/5 shadow-2xs'
          : 'border-border bg-bg-surface hover:bg-hover-bg'
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand font-bold text-xs flex items-center justify-center shrink-0">
          {user.username.substring(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-text text-xs truncate">
              {user.display_name}
            </span>
            <span className="font-mono text-3xs text-brand font-medium">
              @{user.username}
            </span>
          </div>
          <p className="text-3xs text-text-muted truncate mt-0.5">
            {user.email || __( 'No email on file', 'codeclove-school-management' )}
          </p>
          {user.linked_students?.length > 0 && (
            <p className="text-3xs text-brand font-medium mt-0.5 truncate flex items-center gap-1">
              <Users size={10} />
              {sprintf(
                __( 'Already linked to: %s', 'codeclove-school-management' ),
                user.linked_students.map((s) => s.name).join(', ')
              )}
            </p>
          )}
        </div>
      </div>

      <Button
        type="button"
        variant={isSelected ? 'default' : 'secondary'}
        size="sm"
        className="shrink-0 text-3xs h-7 px-2"
      >
        {isSelected ? (
          <>
            <CheckCircle2 size={12} className="mr-1" />
            {__( 'Selected', 'codeclove-school-management' )}
          </>
        ) : (
          __( 'Select', 'codeclove-school-management' )
        )}
      </Button>
    </div>
  )
}
export default function PortalAccessModal({
  open,
  onOpenChange,
  studentId,
  member,
  initialTab = 'create',
  onSuccess,
}: PortalAccessModalProps) {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'create' | 'link'>(initialTab)

  // ── Create Account Form State ──────────────────────────────────────────────
  const [username, setUsername] = useState(member.defaultUsername)
  const [email, setEmail] = useState(member.email || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(Boolean(member.email))

  // ── Link Account State ─────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<PortalUserSearchResult | null>(null)

  // Initialize/reset fields when modal opens or member changes
  useEffect(() => {
    if (open) {
      setUsername(member.defaultUsername)
      setEmail(member.email || '')
      setPassword(generateRandomPassword(16))
      setShowPassword(false)
      setSendWelcomeEmail(Boolean(member.email))
      setSearchQuery('')
      setSelectedUser(null)
      setActiveTab(initialTab)
    }
  }, [open, member, initialTab])

  // Queries & Mutations
  const createAccountMutation = useCreatePortalAccount()
  const linkAccountMutation = useLinkPortalAccount()

  // Always look up by member email for intelligent suggestions
  const { data: emailMatchUsers = [] } = useSearchPortalUsers('', member.email || '', open && Boolean(member.email))

  // Active search query users
  const {
    data: searchResults = [],
    isLoading: isSearching,
  } = useSearchPortalUsers(searchQuery, '', open && searchQuery.trim().length >= 1)

  const emailMatchedUser = member.email ? emailMatchUsers[0] ?? null : null

  // Handle Create Account Submission
  const handleCreateAccount = async () => {
    if (!username.trim()) {
      toast.error(__( 'Please enter a username.', 'codeclove-school-management' ))
      return
    }

    try {
      const res = await createAccountMutation.mutateAsync({
        studentId,
        data: {
          type: member.type,
          guardian_id: member.guardianId,
          username: username.trim(),
          email: email.trim() || undefined,
          password: password.trim() || undefined,
          send_email: sendWelcomeEmail && Boolean(email.trim()),
        },
      })

      toast.success(
        email.trim() && sendWelcomeEmail
          ? sprintf(
              __( 'Portal access created for %1$s (@%2$s). Login instructions sent.', 'codeclove-school-management' ),
              member.name,
              res.username
            )
          : sprintf(
              __( 'Portal access created for %1$s (@%2$s).', 'codeclove-school-management' ),
              member.name,
              res.username
            )
      )

      onOpenChange(false)
      onSuccess({
        name: member.name,
        username: res.username,
        password: password.trim() || res.password,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : __( 'Failed to create portal account.', 'codeclove-school-management' )
      toast.error(msg)
    }
  }

  // Handle Link Account Submission
  const handleLinkAccount = async (targetUser?: PortalUserSearchResult) => {
    const userToLink = targetUser || selectedUser
    if (!userToLink) {
      toast.error(__( 'Please select an existing WordPress user to link.', 'codeclove-school-management' ))
      return
    }

    try {
      const res = await linkAccountMutation.mutateAsync({
        studentId,
        data: {
          type: member.type,
          guardian_id: member.guardianId,
          user_id: userToLink.id,
        },
      })

      toast.success(
        sprintf(
          __( 'Connected WordPress account @%1$s to %2$s.', 'codeclove-school-management' ),
          res.username,
          member.name
        )
      )

      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : __( 'Failed to link WordPress user account.', 'codeclove-school-management' )
      toast.error(msg)
    }
  }

  const isSubmitting = createAccountMutation.isPending || linkAccountMutation.isPending

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={sprintf( __( 'Set Up Portal Access — %s', 'codeclove-school-management' ), member.name )}
      description={sprintf(
        __( 'Configure online portal login access for this %s.', 'codeclove-school-management' ),
        member.role.toLowerCase()
      )}
      size="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Top Segmented Navigation Tabs */}
        <div
          role="tablist"
          aria-label={__( 'Portal access method', 'codeclove-school-management' )}
          className="grid grid-cols-2 p-1 bg-bg-base dark:bg-bg-surface border border-border rounded-xl text-xs font-semibold gap-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'create'}
            onClick={() => setActiveTab('create')}
            className={cn(
              'flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all cursor-pointer select-none text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
              activeTab === 'create'
                ? 'bg-bg-surface dark:bg-bg-overlay text-text shadow-xs border border-border'
                : 'text-text-muted hover:text-text hover:bg-hover-bg border border-transparent'
            )}
          >
            <UserPlus size={14} className={activeTab === 'create' ? 'text-brand' : 'text-text-subtle'} />
            <span>{__( 'Create New Account', 'codeclove-school-management' )}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'link'}
            onClick={() => setActiveTab('link')}
            className={cn(
              'flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all cursor-pointer select-none text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
              activeTab === 'link'
                ? 'bg-bg-surface dark:bg-bg-overlay text-text shadow-xs border border-border'
                : 'text-text-muted hover:text-text hover:bg-hover-bg border border-transparent'
            )}
          >
            <Link2 size={14} className={activeTab === 'link' ? 'text-brand' : 'text-text-subtle'} />
            <span>{__( 'Link Existing Account', 'codeclove-school-management' )}</span>
          </button>
        </div>

        {/* ─── TAB 1: CREATE NEW ACCOUNT ────────────────────────────────────── */}
        {activeTab === 'create' && (
          <div className="space-y-4">
            {/* Smart Detection Banner: Account with this email already exists */}
            {emailMatchedUser && (
              <div className="p-3.5 rounded-xl border border-brand/30 bg-brand/5 flex items-start gap-3 text-xs">
                <CheckCircle2 size={18} className="text-brand shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-text block">
                    {__( 'Existing WordPress Account Found', 'codeclove-school-management' )}
                  </span>
                  <p className="text-text-muted mt-0.5">
                    {sprintf(
                      __( 'A WordPress user with email %1$s is already registered as @%2$s (%3$s).', 'codeclove-school-management' ),
                      emailMatchedUser.email,
                      emailMatchedUser.username,
                      emailMatchedUser.display_name
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedUser(emailMatchedUser)
                      setActiveTab('link')
                    }}
                    className="mt-2 text-xs h-7 gap-1.5"
                  >
                    <Link2 size={12} />
                    {__( 'Switch to Link This Account', 'codeclove-school-management' )}
                  </Button>
                </div>
              </div>
            )}

            <FormField
              label={__( 'Username', 'codeclove-school-management' )}
              required
              hint={__( 'Unique username used to sign in to the portal.', 'codeclove-school-management' )}
            >
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                placeholder="e.g. first.last or admission-no"
                className="font-mono text-sm"
              />
            </FormField>

            <FormField
              label={__( 'Email Address', 'codeclove-school-management' )}
              hint={__( 'Login credentials and password reset notifications are sent here.', 'codeclove-school-management' )}
            >
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. parent@example.com"
                className="text-sm"
              />
            </FormField>

            <FormField
              label={__( 'Password', 'codeclove-school-management' )}
              hint={__( 'Auto-generated strong password. You can customize it or copy it now.', 'codeclove-school-management' )}
            >
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={__( 'Password', 'codeclove-school-management' )}
                    className="font-mono text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-1"
                    title={showPassword ? __( 'Hide password', 'codeclove-school-management' ) : __( 'Show password', 'codeclove-school-management' )}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPassword(generateRandomPassword(16))}
                  title={__( 'Generate new random password', 'codeclove-school-management' )}
                  className="h-8 px-2.5 shrink-0"
                >
                  <RefreshCw size={13} className="mr-1" />
                  {__( 'Generate', 'codeclove-school-management' )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (!password) return
                    void navigator.clipboard?.writeText(password).then(() => {
                      toast.success(__( 'Password copied to clipboard.', 'codeclove-school-management' ))
                    })
                  }}
                  title={__( 'Copy password to clipboard', 'codeclove-school-management' )}
                  className="h-8 px-2.5 shrink-0"
                >
                  <Copy size={13} />
                </Button>
              </div>
            </FormField>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-bg-surface border border-border cursor-pointer select-none text-xs">
              <input
                type="checkbox"
                checked={sendWelcomeEmail}
                onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                disabled={!email.trim()}
                className="mt-0.5 rounded border-border text-brand focus:ring-brand"
              />
              <div>
                <span className="font-semibold text-text block">
                  {__( 'Send welcome notification email with login instructions', 'codeclove-school-management' )}
                </span>
                <span className="text-text-muted text-xs block mt-0.5">
                  {email.trim()
                    ? __( 'Sends an email with password setup instructions so they can log in right away.', 'codeclove-school-management' )
                    : __( 'Provide an email address above to enable email delivery.', 'codeclove-school-management' )}
                </span>
              </div>
            </label>
          </div>
        )}

        {/* ─── TAB 2: LINK EXISTING ACCOUNT ─────────────────────────────────── */}
        {activeTab === 'link' && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted leading-relaxed">
              {__(
                'Connect an existing WordPress account so they can log in with their current credentials. Their existing roles and password will be preserved.',
                'codeclove-school-management'
              )}
            </p>

            {/* Suggested Match based on Email */}
            {emailMatchedUser && (
              <div className="space-y-2">
                <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted block">
                  {__( 'Suggested Match (Matches email on file)', 'codeclove-school-management' )}
                </span>
                <UserCard
                  user={emailMatchedUser}
                  isSelected={selectedUser?.id === emailMatchedUser.id}
                  onSelect={() => setSelectedUser(emailMatchedUser)}
                />
              </div>
            )}

            {/* Search Input */}
            <FormField
              label={__( 'Search Other WordPress Users', 'codeclove-school-management' )}
              hint={__( 'Search by name, username, or email to find another account.', 'codeclove-school-management' )}
            >
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={__( 'Search by username, full name, or email…', 'codeclove-school-management' )}
                  className="pl-9 text-sm"
                />
              </div>
            </FormField>

            {/* Search Results List */}
            {isSearching ? (
              <div className="space-y-2 py-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : searchQuery.trim().length >= 1 ? (
              searchResults.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-bg-surface border border-border text-xs text-text-muted">
                  {sprintf( __( 'No WordPress users found matching "%s".', 'codeclove-school-management' ), searchQuery )}
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {searchResults.map((user) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      isSelected={selectedUser?.id === user.id}
                      onSelect={() => setSelectedUser(user)}
                    />
                  ))}
                </div>
              )
            ) : null}

            {/* Selected User Summary Banner */}
            {selectedUser && (
              <div className="p-3.5 rounded-xl border border-border bg-bg-surface space-y-2">
                <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted block">
                  {__( 'Account to Connect', 'codeclove-school-management' )}
                </span>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-text block">
                      {selectedUser.display_name}
                    </span>
                    <span className="font-mono text-xs text-brand block mt-0.5">
                      @{selectedUser.username} {selectedUser.email ? `• ${selectedUser.email}` : ''}
                    </span>
                  </div>
                  <Badge variant="active" className="text-xs">
                    {__( 'Ready to link', 'codeclove-school-management' )}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
          {__( 'Cancel', 'codeclove-school-management' )}
        </Button>
        {activeTab === 'create' ? (
          <Button
            onClick={handleCreateAccount}
            disabled={isSubmitting || !username.trim()}
            className="gap-1.5"
          >
            {isSubmitting ? <Spinner size="xs" /> : <UserPlus size={14} />}
            {isSubmitting
              ? __( 'Creating Account…', 'codeclove-school-management' )
              : __( 'Create & Enable Access', 'codeclove-school-management' )}
          </Button>
        ) : (
          <Button
            onClick={() => handleLinkAccount()}
            disabled={isSubmitting || !selectedUser}
            className="gap-1.5"
          >
            {isSubmitting ? <Spinner size="xs" /> : <Link2 size={14} />}
            {isSubmitting
              ? __( 'Connecting…', 'codeclove-school-management' )
              : __( 'Connect Account', 'codeclove-school-management' )}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  )
}
