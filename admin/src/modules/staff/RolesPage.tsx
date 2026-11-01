import { useState, useEffect, useMemo } from 'react'
import {
  Shield, Plus, Trash2, Lock, Save, Loader2, ChevronDown, ChevronUp, Check, Search, X,
  GraduationCap, Users, UserPlus, Briefcase, Wallet, Settings, Image, Mail, Calendar,
  ArrowUpRight, ShieldCheck, CalendarCheck, BookOpen, Layers, CheckSquare, Square,
  Copy, RotateCcw
} from 'lucide-react'
import {
  useRoles,
  useRole,
  useSystemPermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole
} from '@/api/roles'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import {
  Button, Badge, Card, PageHeader, Skeleton, Input
} from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'

// Friendly human names for CodeClove school resources
const RESOURCE_LABELS: Record<string, { label: string }> = {
  academic_sessions: { label: 'Academic Sessions' },
  academic_terms: { label: 'Terms & Semesters' },
  academic_units: { label: 'Classes & Grades' },
  academic_groups: { label: 'Sections & Groups' },
  subjects: { label: 'Subjects & Courses' },
  timetable: { label: 'Timetable & Schedules' },
  students: { label: 'Student Directory' },
  guardians: { label: 'Guardians & Contacts' },
  admissions: { label: 'Admission Applications' },
  admission_documents: { label: 'Admission Documents' },
  attendance: { label: 'Student Attendance' },
  staff: { label: 'Staff Directory' },
  staff_attendance: { label: 'Staff Attendance' },
  staff_onboarding: { label: 'Staff Onboarding' },
  staff_applications: { label: 'Staff Job Applications' },
  leave_requests: { label: 'Leave Requests' },
  finance: { label: 'Finance Dashboard' },
  fee_types: { label: 'Fee Structures' },
  invoices: { label: 'Student Invoices' },
  payments: { label: 'Fee Payments' },
  dashboard: { label: 'Executive Dashboard' },
  settings: { label: 'General Settings' },
  roles_permissions: { label: 'Roles & RBAC' },
  notifications: { label: 'Notifications & Alerts' },
  imports: { label: 'Data Imports' },
  exports: { label: 'Data Exports' },
  system: { label: 'System Administration' },
  activity: { label: 'Audit Logs' }
}

// Special action human-readable labels
const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  add: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  manage: 'Manage',
  view_archived: 'View Archived',
  plan_future: 'Plan Future',
  substitute: 'Assign Substitutes',
  promote: 'Promote Students',
  approve: 'Approve',
  convert: 'Convert to Student'
}

// Helper to resolve role domain icons
function getRoleIcon(slug: string, name: string) {
  const s = (slug || name).toLowerCase()
  if (s.includes('admin')) return ShieldCheck
  if (s.includes('academic')) return GraduationCap
  if (s.includes('account') || s.includes('finance')) return Wallet
  if (s.includes('admiss')) return UserPlus
  if (s.includes('teach')) return BookOpen
  if (s.includes('hr') || s.includes('staff')) return Briefcase
  if (s.includes('recept')) return Users
  return Shield
}

// Helper to resolve category module icons
function getCategoryIcon(category: string) {
  const cat = category.toLowerCase()
  if (cat.includes('academic')) return GraduationCap
  if (cat.includes('admission')) return UserPlus
  if (cat.includes('student')) return Users
  if (cat.includes('staff') || cat.includes('hr')) return Briefcase
  if (cat.includes('finance') || cat.includes('invoice') || cat.includes('payment')) return Wallet
  if (cat.includes('setting') || cat.includes('system')) return Settings
  if (cat.includes('media')) return Image
  if (cat.includes('notification')) return Mail
  if (cat.includes('timetable')) return Calendar
  if (cat.includes('attendance')) return CalendarCheck
  if (cat.includes('promotion')) return ArrowUpRight
  if (cat.includes('role')) return ShieldCheck
  return Layers
}

interface ResourceGroup {
  resourceKey: string
  label: string
  view?: { key: string; label: string }
  add?: { key: string; label: string }
  edit?: { key: string; label: string }
  delete?: { key: string; label: string }
  special: Array<{ key: string; action: string; label: string }>
  allKeys: string[]
}

export default function RolesPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const { data: roles = [], isLoading: isRolesLoading, refetch: refetchRoles } = useRoles()
  const { data: systemPermissions = {}, isLoading: isPermsLoading } = useSystemPermissions()

  const [selectedRoleId, setSelectedRoleId] = useState<number>(0)
  const [isCreating, setIsCreating] = useState<boolean>(false)

  // Search & Filter state
  const [roleSearch, setRoleSearch] = useState('')
  const [permSearch, setPermSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  // Form states — Role description is eliminated to keep UI simple, clean, and intuitive
  const [roleName, setRoleName] = useState('')
  const [checkedKeys, setCheckedKeys] = useState<string[]>([])

  const { data: selectedRole, isLoading: isRoleLoading } = useRole(selectedRoleId)

  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole(selectedRoleId)
  const deleteMutation = useDeleteRole()

  // Calculate total system permissions count across all categories
  const totalSystemPermissionsCount = useMemo(() => {
    return Object.values(systemPermissions).reduce((sum, group) => sum + Object.keys(group).length, 0)
  }, [systemPermissions])

  // Select default role once loaded
  useEffect(() => {
    if (roles && roles.length > 0 && !selectedRoleId && !isCreating) {
      setSelectedRoleId(roles[0]?.id || 0)
    }
  }, [roles, selectedRoleId, isCreating])

  // Sync edit form states when selectedRole loads
  useEffect(() => {
    if (selectedRole && !isCreating) {
      setRoleName(selectedRole.name)
      setCheckedKeys(selectedRole.permissions || [])
    }
  }, [selectedRole, isCreating])

  // Sync create form states
  useEffect(() => {
    if (isCreating) {
      setRoleName('')
      setCheckedKeys([])
    }
  }, [isCreating])

  // Filtered roles list for the left rail
  const filteredRoles = useMemo(() => {
    if (!roleSearch.trim()) return roles
    const q = roleSearch.toLowerCase()
    return roles.filter((r) => r.name.toLowerCase().includes(q))
  }, [roles, roleSearch])

  // Transform raw permissions into a clean, structured Resource-based matrix
  const categorizedResources = useMemo(() => {
    const q = permSearch.trim().toLowerCase()

    return Object.entries(systemPermissions).map(([category, perms]) => {
      const resourceMap = new Map<string, ResourceGroup>()

      Object.entries(perms).forEach(([key, label]) => {
        const parts = key.split('.')
        const resKey = parts[0]
        const action = parts[1]
        if (!resKey || !action) return

        if (!resourceMap.has(resKey)) {
          const meta = RESOURCE_LABELS[resKey] || { label: resKey.replace(/_/g, ' ') }
          resourceMap.set(resKey, {
            resourceKey: resKey,
            label: meta.label,
            special: [],
            allKeys: []
          })
        }

        const group = resourceMap.get(resKey)!
        group.allKeys.push(key)

        if (action === 'view') group.view = { key, label }
        else if (action === 'add') group.add = { key, label }
        else if (action === 'edit') group.edit = { key, label }
        else if (action === 'delete') group.delete = { key, label }
        else {
          group.special.push({ key, action, label })
        }
      })

      const allResources = Array.from(resourceMap.values())

      // Filter resources based on search & active filter
      const filteredResources = allResources
        .map((rg) => {
          const matchingKeys = rg.allKeys.filter((k) => {
            const isChecked = checkedKeys.includes(k)
            if (statusFilter === 'active' && !isChecked) return false
            if (statusFilter === 'inactive' && isChecked) return false
            if (!q) return true
            const lbl = perms[k] || ''
            return k.toLowerCase().includes(q) || lbl.toLowerCase().includes(q) || rg.label.toLowerCase().includes(q)
          })

          return {
            ...rg,
            filteredKeys: matchingKeys,
            hasMatches: matchingKeys.length > 0
          }
        })
        .filter((rg) => !q || rg.hasMatches)

      const categoryAllKeys = allResources.flatMap((r) => r.allKeys)
      const checkedCount = categoryAllKeys.filter((k) => checkedKeys.includes(k)).length

      return {
        category,
        resources: filteredResources,
        allKeys: categoryAllKeys,
        checkedCount,
        hasMatches: filteredResources.some((r) => r.hasMatches)
      }
    })
  }, [systemPermissions, checkedKeys, permSearch, statusFilter])

  // Auto-expand categories when user is actively searching
  useEffect(() => {
    if (permSearch.trim()) {
      const autoExpanded: Record<string, boolean> = {}
      categorizedResources.forEach(({ category, hasMatches }) => {
        if (hasMatches) {
          autoExpanded[category] = true
        }
      })
      setExpandedCategories(autoExpanded)
    }
  }, [permSearch, categorizedResources])

  // Initialize all categories as expanded by default on first load
  useEffect(() => {
    if (Object.keys(systemPermissions).length > 0 && Object.keys(expandedCategories).length === 0) {
      const initial: Record<string, boolean> = {}
      Object.keys(systemPermissions).forEach((cat) => {
        initial[cat] = true
      })
      setExpandedCategories(initial)
    }
  }, [systemPermissions, expandedCategories])

  const toggleCategoryExpand = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  const handleExpandAll = (expand: boolean) => {
    const next: Record<string, boolean> = {}
    Object.keys(systemPermissions).forEach((cat) => {
      next[cat] = expand
    })
    setExpandedCategories(next)
  }

  const handleSelectRole = (id: number) => {
    setIsCreating(false)
    setSelectedRoleId(id)
  }

  const handleStartCreate = () => {
    setIsCreating(true)
    setSelectedRoleId(0)
  }

  const handleCloneRole = () => {
    if (!selectedRole) return
    setIsCreating(true)
    setSelectedRoleId(0)
    setRoleName(sprintf(__('%s (Copy)', 'codeclove-school-management'), selectedRole.name))
    setCheckedKeys([...(selectedRole.permissions || [])])
    toast.info(__('Role copied into new draft. Modify permissions and save.', 'codeclove-school-management'))
  }

  const handleDiscardChanges = () => {
    if (isCreating) {
      setIsCreating(false)
      if (roles.length > 0 && roles[0]) {
        setSelectedRoleId(roles[0].id)
      }
    } else if (selectedRole) {
      setRoleName(selectedRole.name)
      setCheckedKeys(selectedRole.permissions || [])
      toast.info(__('Reverted unsaved changes to role.', 'codeclove-school-management'))
    }
  }

  const isLocked = Boolean(selectedRole?.is_locked)
  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  // Track if changes are unsaved
  const hasUnsavedChanges = useMemo(() => {
    if (isCreating) {
      return roleName.trim() !== '' || checkedKeys.length > 0
    }
    if (!selectedRole) return false
    const nameChanged = !selectedRole.is_system && roleName.trim() !== selectedRole.name
    const originalKeys = selectedRole.permissions || []
    const permsChanged =
      checkedKeys.length !== originalKeys.length ||
      checkedKeys.some((k) => !originalKeys.includes(k))
    return nameChanged || permsChanged
  }, [isCreating, selectedRole, roleName, checkedKeys])

  // Granular diff counter for executive feedback
  const changesDiff = useMemo(() => {
    if (isCreating) {
      return { added: checkedKeys.length, removed: 0 }
    }
    if (!selectedRole) return { added: 0, removed: 0 }
    const originalKeys = selectedRole.permissions || []
    const added = checkedKeys.filter((k) => !originalKeys.includes(k)).length
    const removed = originalKeys.filter((k) => !checkedKeys.includes(k)).length
    return { added, removed }
  }, [isCreating, selectedRole, checkedKeys])

  // Smart Dependency Handling:
  // - If granting downstream actions (add, edit, delete, special), automatically grant 'view' for that resource.
  // - If revoking 'view', automatically clear all downstream actions for that resource.
  const handleTogglePermission = (key: string) => {
    if (isLocked && !isCreating) return

    const parts = key.split('.')
    const resKey = parts[0]
    const action = parts[1]
    const isCurrentlyChecked = checkedKeys.includes(key)

    if (isCurrentlyChecked) {
      if (action === 'view') {
        const relatedPrefix = `${resKey}.`
        setCheckedKeys((prev) => prev.filter((k) => k !== key && !k.startsWith(relatedPrefix)))
      } else {
        setCheckedKeys((prev) => prev.filter((k) => k !== key))
      }
    } else {
      const viewKey = `${resKey}.view`
      setCheckedKeys((prev) => {
        const next = [...prev, key]
        if (action !== 'view' && !next.includes(viewKey)) {
          const allSystemKeys = Object.values(systemPermissions).flatMap((g) => Object.keys(g))
          if (allSystemKeys.includes(viewKey)) {
            next.push(viewKey)
          }
        }
        return next
      })
    }
  }

  const handleToggleResourceKeys = (keys: string[]) => {
    if (isLocked && !isCreating) return

    const allChecked = keys.every((k) => checkedKeys.includes(k))
    setCheckedKeys((prev) => {
      const filtered = prev.filter((k) => !keys.includes(k))
      return allChecked ? filtered : [...filtered, ...keys]
    })
  }

  // Preset: View Only for an entire Category
  const handleSetCategoryReadOnly = (allKeys: string[]) => {
    if (isLocked && !isCreating) return

    const viewKeys = allKeys.filter((k) => k.endsWith('.view'))
    setCheckedKeys((prev) => {
      const outside = prev.filter((k) => !allKeys.includes(k))
      return [...outside, ...viewKeys]
    })
    toast.info(__('Applied view-only permissions for this category.', 'codeclove-school-management'))
  }

  const handleToggleCategory = (keys: string[], selectAll: boolean) => {
    if (isLocked && !isCreating) return

    setCheckedKeys((prev) => {
      const filtered = prev.filter((k) => !keys.includes(k))
      return selectAll ? [...filtered, ...keys] : filtered
    })
  }

  const handleToggleAllPermissions = (selectAll: boolean) => {
    if (isLocked && !isCreating) return

    if (selectAll) {
      const allKeys = Object.values(systemPermissions).flatMap((group) => Object.keys(group))
      setCheckedKeys(allKeys)
    } else {
      setCheckedKeys([])
    }
  }

  const handleSave = () => {
    if (!roleName.trim()) {
      toast.error(__('Role name is required.', 'codeclove-school-management'))
      return
    }

    if (isCreating) {
      createMutation.mutate(
        {
          name: roleName.trim(),
          description: '',
          permissions: checkedKeys
        },
        {
          onSuccess: (newRole) => {
            toast.success(sprintf(__('Successfully created role: %s', 'codeclove-school-management'), newRole.name))
            setIsCreating(false)
            setSelectedRoleId(newRole.id)
            refetchRoles()
          },
          onError: (err) => {
            toast.error(err.message || __('Failed to create role.', 'codeclove-school-management'))
          }
        }
      )
    } else {
      updateMutation.mutate(
        {
          name: roleName.trim(),
          description: selectedRole?.description || '',
          permissions: checkedKeys
        },
        {
          onSuccess: () => {
            toast.success(__('Successfully saved role permissions!', 'codeclove-school-management'))
            refetchRoles()
          },
          onError: (err) => {
            toast.error(err.message || __('Failed to save role.', 'codeclove-school-management'))
          }
        }
      )
    }
  }

  const handleDelete = async () => {
    if (!selectedRoleId) return
    const currentName = selectedRole?.name || __('this role', 'codeclove-school-management')

    const isConfirmed = await confirm({
      title: __('Delete Role', 'codeclove-school-management'),
      message: sprintf(
        __('Are you sure you want to delete "%s"? Any staff assigned to this role will need to be reassigned. This action cannot be undone.', 'codeclove-school-management'),
        currentName
      )
    })
    if (!isConfirmed) return

    deleteMutation.mutate(selectedRoleId, {
      onSuccess: () => {
        toast.success(sprintf(__('Role "%s" deleted successfully.', 'codeclove-school-management'), currentName))
        setSelectedRoleId(0)
        refetchRoles()
      },
      onError: (err) => {
        toast.error(err.message || __('Failed to delete role.', 'codeclove-school-management'))
      }
    })
  }

  if (isRolesLoading || isPermsLoading) {
    return (
      <div className="space-y-4 w-full">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-4 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  const totalFilteredPerms = categorizedResources.reduce(
    (sum, cat) => sum + cat.resources.reduce((rSum, r) => rSum + (r.filteredKeys?.length || 0), 0),
    0
  )
  const activePercentage = totalSystemPermissionsCount > 0
    ? Math.min(100, Math.round((checkedKeys.length / totalSystemPermissionsCount) * 100))
    : 0

  return (
    <div className="space-y-4 w-full pb-16">
      <PageHeader
        title={__('Roles & Permissions', 'codeclove-school-management')}
        badge={
          roles.length > 0 ? (
            <Badge variant="neutral" className="tabular-nums font-mono text-xs font-normal">
              {sprintf(__('%d roles', 'codeclove-school-management'), roles.length)}
            </Badge>
          ) : undefined
        }
        breadcrumbs={[
          { label: __('Staff & HR', 'codeclove-school-management') },
          { label: __('Roles & Permissions', 'codeclove-school-management') }
        ]}
        description={__(
          'Configure role capability matrices, manage staff dashboard authorization, and assign granular feature permissions.',
          'codeclove-school-management'
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ─── Left Rail: Roles Inventory ───────────────────────────────── */}
        <div className="lg:col-span-4 space-y-3">
          <Card className="p-3.5 space-y-3 border-border shadow-2xs">
            {/* Header: Sentence-case with badge */}
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text">
                  {__('Roles', 'codeclove-school-management')}
                </span>
                <span className="text-3xs font-medium px-2 py-0.5 rounded-full bg-bg-surface border border-border text-text-muted">
                  {roles.length}
                </span>
              </div>
              <Button
                size="sm"
                variant="default"
                onClick={handleStartCreate}
                className="h-7 px-2.5 text-xs gap-1.5 font-medium shadow-2xs"
              >
                <Plus size={13} />
                {__('Add Role', 'codeclove-school-management')}
              </Button>
            </div>

            {/* Quick Filter Search for Roles */}
            {roles.length > 5 && (
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-text-subtle" />
                <input
                  type="text"
                  placeholder={__('Filter roles...', 'codeclove-school-management')}
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-border bg-bg-surface text-xs text-text placeholder:text-text-subtle focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand-ring transition-colors"
                />
              </div>
            )}

            {/* Roles List — Padded container + ring-inset to eliminate outline clipping */}
            <div className="space-y-1.5 max-h-[74vh] overflow-y-auto p-1 -m-1">
              {filteredRoles.map((role) => {
                const isActive = !isCreating && selectedRoleId === role.id
                const RoleIcon = getRoleIcon(role.slug, role.name)
                const count = role.permission_count || (role.permissions ? role.permissions.length : 0)
                const pct = totalSystemPermissionsCount > 0
                  ? Math.min(100, Math.round((count / totalSystemPermissionsCount) * 100))
                  : 0
                const staffCount = role.staff_count ?? 0

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleSelectRole(role.id)}
                    className={`w-full p-2.5 rounded-lg border text-left transition-colors select-none ${
                      isActive
                        ? 'bg-brand-dim/35 border-border text-text shadow-xs'
                        : 'bg-bg-surface hover:bg-hover-bg border-border/80 text-text'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                          isActive
                            ? 'bg-brand text-text-inverted border-brand shadow-2xs'
                            : 'bg-bg-elevated border-border text-text-muted'
                        }`}
                      >
                        <RoleIcon size={14} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className={`text-xs font-semibold truncate ${
                              isActive ? 'text-brand' : 'text-text'
                            }`}
                          >
                            {role.name}
                          </span>
                          <span
                            className={`text-3xs font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                              role.is_system
                                ? 'bg-bg-elevated border-border text-text-subtle'
                                : 'bg-brand-dim border-brand/30 text-brand'
                            }`}
                          >
                            {role.is_system
                              ? __('System', 'codeclove-school-management')
                              : __('Custom', 'codeclove-school-management')}
                          </span>
                        </div>

                        {/* Quiet, Scannable Meta Info */}
                        <div className="flex items-center gap-2 mt-1 text-3xs text-text-muted">
                          <span className="tabular-nums font-medium text-text">
                            {count} {__('permissions', 'codeclove-school-management')}
                          </span>
                          <span>•</span>
                          <span className="tabular-nums">{pct}%</span>
                          {staffCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1 text-text-muted tabular-nums">
                                <Users size={10} className="text-text-subtle" />
                                {staffCount}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}

              {filteredRoles.length === 0 && (
                <div className="p-6 text-center text-xs text-text-muted">
                  {__('No roles match your search.', 'codeclove-school-management')}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ─── Right Pane: Role Profile & Enterprise Matrix Studio ────── */}
        <div className="lg:col-span-8 space-y-4">
          {isRoleLoading && !isCreating ? (
            <Card className="p-6 border-border">
              <Skeleton className="h-96 w-full rounded-xl" />
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Role Profile Header Card — Ultra-Clean, Zero Redundant Descriptions */}
              <Card className="p-4 border-border shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-brand-dim border border-brand/20 flex items-center justify-center text-brand shrink-0">
                      {isCreating ? <Plus size={16} /> : <ShieldCheck size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isCreating ? (
                          <span className="text-sm font-bold text-text">
                            {__('New Custom Role', 'codeclove-school-management')}
                          </span>
                        ) : (
                          <h2 className="text-sm font-bold text-text truncate">
                            {roleName || selectedRole?.name}
                          </h2>
                        )}

                        {!isCreating && (
                          <Badge
                            variant={selectedRole?.is_system ? 'default' : 'brand'}
                            size="sm"
                            className="text-3xs"
                          >
                            {selectedRole?.is_system
                              ? __('System Template', 'codeclove-school-management')
                              : __('Custom Role', 'codeclove-school-management')}
                          </Badge>
                        )}

                        {isLocked && (
                          <span
                            className="inline-flex items-center gap-1 text-3xs font-medium text-text-subtle bg-bg-surface px-1.5 py-0.5 rounded border border-border"
                            title={__('Role permissions locked', 'codeclove-school-management')}
                          >
                            <Lock size={10} /> {__('Locked', 'codeclove-school-management')}
                          </span>
                        )}

                        {/* Blast Radius: Staff Quick Link */}
                        {!isCreating && selectedRole && (selectedRole.staff_count ?? 0) > 0 && (
                          <a
                            href={`#/staff?role_id=${selectedRole.id}`}
                            className="inline-flex items-center gap-1 text-3xs font-medium px-2 py-0.5 rounded-full bg-bg-surface border border-border text-text-muted hover:text-brand hover:border-brand/40 transition-colors"
                            title={__('View staff assigned to this role', 'codeclove-school-management')}
                          >
                            <Users size={10} className="text-brand" />
                            <span>
                              {selectedRole.staff_count}{' '}
                              {selectedRole.staff_count === 1
                                ? __('assigned staff', 'codeclove-school-management')
                                : __('assigned staff', 'codeclove-school-management')}
                            </span>
                            <ArrowUpRight size={10} className="text-text-subtle" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Coverage Stat Pill */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {!isCreating && selectedRole && !selectedRole.is_system && !selectedRole.is_locked && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={handleDelete}
                        disabled={isPending}
                        className="h-7 px-2.5 text-2xs gap-1.5 font-medium shadow-2xs"
                        title={__('Delete this custom role', 'codeclove-school-management')}
                      >
                        <Trash2 size={12} />
                        {__('Delete Role', 'codeclove-school-management')}
                      </Button>
                    )}

                    {!isCreating && selectedRole && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleCloneRole}
                        className="h-7 px-2.5 text-2xs gap-1.5 font-medium border-border hover:bg-hover-bg shadow-2xs"
                        title={__('Create a new custom role based on this role', 'codeclove-school-management')}
                      >
                        <Copy size={12} />
                        {__('Clone Role', 'codeclove-school-management')}
                      </Button>
                    )}

                    <div className="flex items-center gap-1.5 bg-bg-surface px-2.5 py-1 rounded-md border border-border text-xs">
                      <span className="font-semibold text-text tabular-nums">
                        {checkedKeys.length}/{totalSystemPermissionsCount}
                      </span>
                      <span className="text-text-muted text-3xs">{__('active', 'codeclove-school-management')}</span>
                      <span className="text-3xs font-semibold px-1 rounded bg-brand-dim text-brand">
                        {activePercentage}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Editable Role Name Input only when Creating or Editing a Custom Role */}
                {(isCreating || (selectedRole && !selectedRole.is_system && !isLocked)) && (
                  <div className="pt-2.5 border-t border-border max-w-sm space-y-1">
                    <label className="text-xs font-semibold text-text">
                      {__('Role Name', 'codeclove-school-management')} <span className="text-danger">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder={__('e.g. Exam Coordinator', 'codeclove-school-management')}
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      className="h-8 text-xs bg-bg-surface"
                      autoFocus={isCreating}
                    />
                  </div>
                )}
              </Card>

              {/* ─── Capabilities Matrix Hub ─────────────────────────────── */}
              <Card className="p-3.5 border-border shadow-2xs space-y-3">
                {/* Unified Single-Row Search & Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-border">
                  <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                    {/* Compact Search Bar */}
                    <div className="relative w-52 sm:w-64">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-text-subtle" />
                      <input
                        type="text"
                        placeholder={__('Search capabilities...', 'codeclove-school-management')}
                        value={permSearch}
                        onChange={(e) => setPermSearch(e.target.value)}
                        className="w-full h-7.5 pl-8 pr-7 rounded-md border border-border bg-bg-surface text-xs text-text placeholder:text-text-subtle focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand-ring transition-colors"
                      />
                      {permSearch && (
                        <button
                          type="button"
                          onClick={() => setPermSearch('')}
                          className="absolute right-2 top-2 text-text-subtle hover:text-text"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Segmented Filter Pills */}
                    <div className="flex items-center rounded-md border border-border p-0.5 bg-bg-surface">
                      <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className={`px-2 py-0.5 text-3xs font-semibold rounded transition-colors ${
                          statusFilter === 'all'
                            ? 'bg-brand text-text-inverted shadow-2xs'
                            : 'text-text-muted hover:text-text'
                        }`}
                      >
                        {__('All', 'codeclove-school-management')} ({totalFilteredPerms})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('active')}
                        className={`px-2 py-0.5 text-3xs font-semibold rounded transition-colors ${
                          statusFilter === 'active'
                            ? 'bg-brand text-text-inverted shadow-2xs'
                            : 'text-text-muted hover:text-text'
                        }`}
                      >
                        {__('Active', 'codeclove-school-management')} ({checkedKeys.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('inactive')}
                        className={`px-2 py-0.5 text-3xs font-semibold rounded transition-colors ${
                          statusFilter === 'inactive'
                            ? 'bg-brand text-text-inverted shadow-2xs'
                            : 'text-text-muted hover:text-text'
                        }`}
                      >
                        {__('Inactive', 'codeclove-school-management')} ({totalSystemPermissionsCount - checkedKeys.length})
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleExpandAll(!Object.values(expandedCategories).some(Boolean))}
                      className="h-7 px-2 text-3xs font-medium text-text-muted bg-bg-surface border border-border rounded-md hover:bg-hover-bg transition-colors flex items-center gap-1"
                    >
                      {Object.values(expandedCategories).some(Boolean) ? (
                        <>
                          <ChevronUp size={11} />
                          {__('Collapse All', 'codeclove-school-management')}
                        </>
                      ) : (
                        <>
                          <ChevronDown size={11} />
                          {__('Expand All', 'codeclove-school-management')}
                        </>
                      )}
                    </button>

                    {!(isLocked && !isCreating) && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleAllPermissions(true)}
                          className="h-7 px-2 text-3xs font-semibold text-brand bg-brand-dim border border-brand/20 rounded-md hover:bg-brand-dim/80 transition-colors flex items-center gap-1"
                        >
                          <CheckSquare size={11} />
                          {__('Select All', 'codeclove-school-management')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAllPermissions(false)}
                          className="h-7 px-2 text-3xs font-medium text-text-muted bg-bg-surface border border-border rounded-md hover:bg-hover-bg transition-colors flex items-center gap-1"
                        >
                          <Square size={11} />
                          {__('Clear All', 'codeclove-school-management')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Permission Categories Accordions */}
                <div className="space-y-3">
                  {categorizedResources.map(({ category, resources, allKeys, checkedCount }) => {
                    const isExpanded = expandedCategories[category] ?? true
                    const isAllChecked = checkedCount === allKeys.length
                    const CatIcon = getCategoryIcon(category)

                    if (resources.length === 0 && permSearch.trim()) {
                      return null
                    }

                    return (
                      <div
                        key={category}
                        className="border border-border rounded-lg bg-bg-elevated overflow-hidden transition-colors shadow-2xs"
                      >
                        {/* Category Header — Clean, No Floating Progress Bars */}
                        <div
                          onClick={() => toggleCategoryExpand(category)}
                          className="flex items-center justify-between px-3.5 py-2.5 bg-bg-surface hover:bg-hover-bg cursor-pointer select-none border-b border-border transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded bg-bg-elevated border border-border flex items-center justify-center text-brand">
                              <CatIcon size={13} />
                            </div>
                            <span className="text-xs font-semibold text-text">{category}</span>

                            {/* Crisp Count Badge */}
                            <span className="text-3xs font-mono font-medium px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-text-muted">
                              {checkedCount} / {allKeys.length}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Category Presets */}
                            {!(isLocked && !isCreating) && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSetCategoryReadOnly(allKeys)
                                  }}
                                  className="text-3xs font-medium px-1.5 py-0.5 rounded border border-border bg-bg-elevated hover:bg-hover-bg text-text-muted hover:text-brand transition-colors"
                                  title={__('Grant view-only access to all resources in this category', 'codeclove-school-management')}
                                >
                                  {__('View Only', 'codeclove-school-management')}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleCategory(allKeys, !isAllChecked)
                                  }}
                                  className="text-3xs font-medium px-1.5 py-0.5 rounded border border-border bg-bg-elevated hover:bg-hover-bg text-text-muted hover:text-brand transition-colors"
                                >
                                  {isAllChecked
                                    ? __('Deselect All', 'codeclove-school-management')
                                    : __('Select All', 'codeclove-school-management')}
                                </button>
                              </>
                            )}

                            <ChevronDown
                              size={14}
                              className={`transition-transform duration-200 text-text-subtle ${
                                isExpanded ? 'rotate-180 text-brand' : ''
                              }`}
                            />
                          </div>
                        </div>

                        {/* Category Content: Enterprise Permission Matrix Table */}
                        {isExpanded && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-border bg-bg-surface/50 text-3xs font-semibold text-text-muted uppercase tracking-wider">
                                  <th className="py-2 px-3 font-semibold w-1/3 min-w-[190px]">
                                    {__('School Resource', 'codeclove-school-management')}
                                  </th>
                                  <th className="py-2 px-2 text-center w-12 font-semibold">
                                    {__('View', 'codeclove-school-management')}
                                  </th>
                                  <th className="py-2 px-2 text-center w-12 font-semibold">
                                    {__('Create', 'codeclove-school-management')}
                                  </th>
                                  <th className="py-2 px-2 text-center w-12 font-semibold">
                                    {__('Edit', 'codeclove-school-management')}
                                  </th>
                                  <th className="py-2 px-2 text-center w-12 font-semibold">
                                    {__('Delete', 'codeclove-school-management')}
                                  </th>
                                  <th className="py-2 px-3 font-semibold">
                                    {__('Special Privileges', 'codeclove-school-management')}
                                  </th>
                                  {!(isLocked && !isCreating) && (
                                    <th className="py-2 px-3 text-right font-semibold w-16">
                                      {__('Row', 'codeclove-school-management')}
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60 bg-bg-elevated">
                                {resources.map((rg) => {
                                  const rowAllChecked = rg.allKeys.every((k) => checkedKeys.includes(k))
                                  const rowSomeChecked = rg.allKeys.some((k) => checkedKeys.includes(k))

                                  const renderActionCell = (actionObj?: { key: string; label: string }) => {
                                    if (!actionObj) {
                                      return <span className="text-text-subtle/30 select-none font-mono text-3xs">—</span>
                                    }

                                    const isChecked = checkedKeys.includes(actionObj.key)
                                    const isDisabled = isLocked && !isCreating
                                    const isDelete = actionObj.key.endsWith('.delete')

                                    return (
                                      <button
                                        type="button"
                                        role="checkbox"
                                        aria-checked={isChecked}
                                        tabIndex={isDisabled ? -1 : 0}
                                        disabled={isDisabled}
                                        onClick={() => handleTogglePermission(actionObj.key)}
                                        onKeyDown={(e) => {
                                          if (e.key === ' ' || e.key === 'Enter') {
                                            e.preventDefault()
                                            handleTogglePermission(actionObj.key)
                                          }
                                        }}
                                        title={
                                          isDelete && isChecked
                                            ? sprintf(__('%s (Destructive permission granted)', 'codeclove-school-management'), actionObj.label)
                                            : actionObj.label
                                        }
                                        className={`inline-flex items-center justify-center w-5 h-5 rounded-[4px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring ${
                                          isDisabled
                                            ? 'opacity-35 cursor-not-allowed bg-bg-surface border-border'
                                            : isChecked
                                            ? isDelete
                                              ? 'bg-danger border-danger text-text-inverted shadow-2xs'
                                              : 'bg-brand border-brand text-text-inverted shadow-2xs'
                                            : 'bg-bg-surface border-border hover:border-brand/60'
                                        }`}
                                      >
                                        {isChecked && <Check size={11} strokeWidth={3} />}
                                      </button>
                                    )
                                  }

                                  return (
                                    <tr
                                      key={rg.resourceKey}
                                      className={`hover:bg-hover-bg/50 transition-colors ${
                                        rowSomeChecked ? 'bg-brand-dim/5' : ''
                                      }`}
                                    >
                                      {/* Resource Info — Clean human title only, no technical underscore slugs */}
                                      <td className="py-2.5 px-3" title={rg.resourceKey}>
                                        <div className="font-semibold text-xs text-text leading-tight">
                                          {rg.label}
                                        </div>
                                      </td>

                                      {/* CRUD Action Checkboxes */}
                                      <td className="py-2.5 px-2 text-center">{renderActionCell(rg.view)}</td>
                                      <td className="py-2.5 px-2 text-center">{renderActionCell(rg.add)}</td>
                                      <td className="py-2.5 px-2 text-center">{renderActionCell(rg.edit)}</td>
                                      <td className="py-2.5 px-2 text-center">{renderActionCell(rg.delete)}</td>

                                      {/* Special Extended Actions — Clean, Non-Clipping Chips */}
                                      <td className="py-2.5 px-3">
                                        {rg.special.length > 0 ? (
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            {rg.special.map((sp) => {
                                              const isChecked = checkedKeys.includes(sp.key)
                                              const isDisabled = isLocked && !isCreating
                                              const actionText = ACTION_LABELS[sp.action] || sp.action.replace(/_/g, ' ')

                                              return (
                                                <button
                                                  key={sp.key}
                                                  type="button"
                                                  role="checkbox"
                                                  aria-checked={isChecked}
                                                  tabIndex={isDisabled ? -1 : 0}
                                                  disabled={isDisabled}
                                                  onClick={() => handleTogglePermission(sp.key)}
                                                  onKeyDown={(e) => {
                                                    if (e.key === ' ' || e.key === 'Enter') {
                                                      e.preventDefault()
                                                      handleTogglePermission(sp.key)
                                                    }
                                                  }}
                                                  title={sp.label}
                                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-3xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                                                    isDisabled
                                                      ? 'opacity-35 cursor-not-allowed bg-bg-surface border-border'
                                                      : isChecked
                                                      ? 'bg-brand-dim border-brand/40 text-brand font-medium'
                                                      : 'bg-bg-surface border-border hover:border-brand/50 text-text-muted hover:text-text'
                                                  }`}
                                                >
                                                  <div
                                                    className={`w-3 h-3 rounded-[2px] border flex items-center justify-center shrink-0 ${
                                                      isChecked
                                                        ? 'bg-brand border-brand text-text-inverted'
                                                        : 'border-border bg-bg-surface'
                                                    }`}
                                                  >
                                                    {isChecked && <Check size={8} strokeWidth={3} />}
                                                  </div>
                                                  <span className="whitespace-nowrap">{actionText}</span>
                                                </button>
                                              )
                                            })}
                                          </div>
                                        ) : (
                                          <span className="text-text-subtle/30 select-none font-mono text-3xs">—</span>
                                        )}
                                      </td>

                                      {/* Row Quick Toggle All */}
                                      {!(isLocked && !isCreating) && (
                                        <td className="py-2.5 px-3 text-right">
                                          <button
                                            type="button"
                                            onClick={() => handleToggleResourceKeys(rg.allKeys)}
                                            className="text-3xs font-medium px-2 py-0.5 rounded border border-border bg-bg-surface hover:bg-hover-bg text-text-muted hover:text-brand transition-colors whitespace-nowrap shadow-2xs"
                                          >
                                            {rowAllChecked ? __('None', 'codeclove-school-management') : __('All', 'codeclove-school-management')}
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* ─── Sticky Action Bar — Only Visible When Unsaved or Creating ─── */}
              {(hasUnsavedChanges || isCreating) && (
                <div className="sticky bottom-4 z-20 bg-bg-elevated/95 backdrop-blur-md p-3 rounded-lg border border-border shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1.5 text-2xs font-semibold text-warning bg-warning-dim px-2.5 py-1 rounded-full border border-warning/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                      <span>{__('Unsaved changes', 'codeclove-school-management')}</span>
                      {(changesDiff.added > 0 || changesDiff.removed > 0) && (
                        <span className="font-mono text-3xs text-text-muted ml-0.5">
                          ({changesDiff.added > 0 ? `+${changesDiff.added}` : ''}
                          {changesDiff.added > 0 && changesDiff.removed > 0 ? ' / ' : ''}
                          {changesDiff.removed > 0 ? `-${changesDiff.removed}` : ''})
                        </span>
                      )}
                    </span>

                    <span className="text-2xs text-text-muted hidden sm:inline">
                      {checkedKeys.length} {__('capabilities active', 'codeclove-school-management')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasUnsavedChanges && !isCreating && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleDiscardChanges}
                        disabled={isPending}
                        className="h-7.5 text-xs font-medium px-2.5 gap-1"
                      >
                        <RotateCcw size={11} />
                        {__('Discard', 'codeclove-school-management')}
                      </Button>
                    )}

                    {isCreating && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsCreating(false)}
                        disabled={isPending}
                        className="h-7.5 text-xs font-medium px-2.5"
                      >
                        {__('Cancel', 'codeclove-school-management')}
                      </Button>
                    )}

                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSave}
                      disabled={isPending}
                      className="gap-1.5 h-7.5 text-xs font-semibold px-3.5 shadow-2xs"
                    >
                      {isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                      {isCreating
                        ? __('Create Role', 'codeclove-school-management')
                        : __('Save Changes', 'codeclove-school-management')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
