import { useState, useEffect, useMemo } from 'react'
import {
  Shield, Plus, Trash2, Lock, Save, Loader2, ChevronDown, Check,
  GraduationCap, Users, UserPlus, Briefcase, Wallet, Settings, Image, Mail, Calendar, ArrowUpRight, ShieldAlert, ShieldCheck
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
  Button, Badge, Card, PageHeader, Skeleton
} from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'

// Helper to get category icons for premium visuals
function getCategoryIcon(category: string) {
  const cat = category.toLowerCase()
  if (cat.includes('academic')) return GraduationCap
  if (cat.includes('admission')) return UserPlus
  if (cat.includes('student')) return Users
  if (cat.includes('staff') || cat.includes('hr')) return Briefcase
  if (cat.includes('finance') || cat.includes('invoice') || cat.includes('payment')) return Wallet
  if (cat.includes('setting')) return Settings
  if (cat.includes('media')) return Image
  if (cat.includes('notification') || cat.includes('email') || cat.includes('sms')) return Mail
  if (cat.includes('timetable') || cat.includes('period')) return Calendar
  if (cat.includes('promotion')) return ArrowUpRight
  if (cat.includes('role')) return ShieldCheck
  return Shield
}

export default function RolesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  
  const { data: roles = [], isLoading: isRolesLoading, refetch: refetchRoles } = useRoles()
  const { data: systemPermissions = {} } = useSystemPermissions()
  
  const [selectedRoleId, setSelectedRoleId] = useState<number>(0)
  const [isCreating, setIsCreating] = useState<boolean>(false)
  
  // Form states
  const [roleName, setRoleName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [checkedKeys, setCheckedKeys] = useState<string[]>([])
  
  const { data: selectedRole, isLoading: isRoleLoading } = useRole(selectedRoleId)
  
  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole(selectedRoleId)
  const deleteMutation = useDeleteRole()

  // Stable sorting of categories based on active permissions at load-time to avoid layout shifts on click
  const sortedCategories = useMemo(() => {
    const categoriesWithCounts = Object.entries(systemPermissions).map(([category, perms]) => {
      const keys = Object.keys(perms)
      const initialChecked = selectedRole?.permissions || []
      const checkedCount = keys.filter(k => initialChecked.includes(k)).length
      return { category, perms, keys, checkedCount }
    })

    return categoriesWithCounts.sort((a, b) => {
      if (b.checkedCount !== a.checkedCount) {
        return b.checkedCount - a.checkedCount
      }
      return b.keys.length - a.keys.length
    })
  }, [systemPermissions, selectedRole])

  useEffect(() => {
    if (roles && roles.length > 0 && !selectedRoleId && !isCreating) {
      setSelectedRoleId(roles[0]?.id || 0)
    }
  }, [roles, selectedRoleId, isCreating])

  // Sync edit form states when selectedRole loads
  useEffect(() => {
    if (selectedRole && !isCreating) {
      setRoleName(selectedRole.name)
      setRoleDescription(selectedRole.description || '')
      setCheckedKeys(selectedRole.permissions || [])
    }
  }, [selectedRole, isCreating])

  // Sync create form states
  useEffect(() => {
    if (isCreating) {
      setRoleName('')
      setRoleDescription('')
      setCheckedKeys([])
    }
  }, [isCreating])

  const handleSelectRole = (id: number) => {
    setIsCreating(false)
    setSelectedRoleId(id)
  }

  const handleStartCreate = () => {
    setIsCreating(true)
    setSelectedRoleId(0)
  }

  const handleTogglePermission = (key: string) => {
    if (isLocked && !isCreating) return
    
    setCheckedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleToggleCategory = (keys: string[], selectAll: boolean) => {
    if (isLocked && !isCreating) return
    
    setCheckedKeys(prev => {
      const filtered = prev.filter(k => !keys.includes(k))
      return selectAll ? [...filtered, ...keys] : filtered
    })
  }

  const handleToggleAllPermissions = (selectAll: boolean) => {
    if (isLocked && !isCreating) return
    
    if (selectAll) {
      const allKeys = Object.values(systemPermissions).flatMap(group => Object.keys(group))
      setCheckedKeys(allKeys)
    } else {
      setCheckedKeys([])
    }
  }

  const handleSave = () => {
    if (!roleName.trim()) {
      toast.error(__( 'Role name is required.', 'codeclove-school-management' ))
      return
    }

    if (isCreating) {
      createMutation.mutate(
        {
          name: roleName,
          description: roleDescription,
          permissions: checkedKeys
        },
        {
          onSuccess: (newRole) => {
            toast.success(sprintf( __( 'Successfully created role: %s', 'codeclove-school-management' ), newRole.name ))
            setIsCreating(false)
            setSelectedRoleId(newRole.id)
            refetchRoles()
          },
          onError: (err) => {
            toast.error(err.message || __( 'Failed to create role.', 'codeclove-school-management' ))
          }
        }
      )
    } else {
      updateMutation.mutate(
        {
          name: roleName,
          description: roleDescription,
          permissions: checkedKeys
        },
        {
          onSuccess: () => {
            toast.success(__( 'Successfully saved role permissions!', 'codeclove-school-management' ))
            refetchRoles()
          },
          onError: (err) => {
            toast.error(err.message || __( 'Failed to save role.', 'codeclove-school-management' ))
          }
        }
      )
    }
  }

  const handleDelete = async () => {
    if (!selectedRoleId) return
    const currentName = selectedRole?.name || __( 'this role', 'codeclove-school-management' )
    
    const isConfirmed = await confirm({
      title: __( 'Delete Role', 'codeclove-school-management' ),
      message: sprintf( __( 'Are you sure you want to delete %s? This action cannot be undone.', 'codeclove-school-management' ), currentName ),
    })
    if (!isConfirmed) return

    deleteMutation.mutate(selectedRoleId, {
      onSuccess: () => {
        toast.success(sprintf( __( 'Role "%s" deleted successfully.', 'codeclove-school-management' ), currentName ))
        setSelectedRoleId(0)
        refetchRoles()
      },
      onError: (err) => {
        toast.error(err.message || __( 'Failed to delete role.', 'codeclove-school-management' ))
      }
    })
  }

  if (isRolesLoading) {
    return (
      <div className="space-y-4 w-full">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-3 space-y-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-9">
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  const isOwner = selectedRole?.slug === 'owner'
  const isLocked = selectedRole?.is_locked || isOwner
  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  return (
    <div className="space-y-4 w-full">
      <PageHeader
        title={__( 'Roles & Permissions', 'codeclove-school-management' )}
        breadcrumbs={[{ label: __( 'Staff & HR', 'codeclove-school-management' ) }, { label: __( 'Roles & Permissions', 'codeclove-school-management' ) }]}
        description={__( 'Configure feature capability grids, manage dynamic system roles, and assign school dashboard access privileges.', 'codeclove-school-management' )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column - Compact Roles List */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="p-3 space-y-3 border-border/60 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/55 pb-2">
              <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">{__( 'System Roles', 'codeclove-school-management' )}</span>
              <Button size="sm" variant="default" onClick={handleStartCreate} className="h-6 px-2 text-2xs gap-1 font-semibold">
                <Plus size={11} />
                {__( 'Add Role', 'codeclove-school-management' )}
              </Button>
            </div>

            <div className="space-y-1.5 max-h-[58vh] overflow-y-auto pr-1">
              {roles.map((role) => {
                const isActive = !isCreating && selectedRoleId === role.id
                return (
                  <button
                    key={role.id}
                    onClick={() => handleSelectRole(role.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs transition-all relative font-semibold select-none text-left ${
                      isActive
                        ? 'border-transparent bg-brand text-white shadow-md shadow-brand/10'
                        : 'border-transparent hover:bg-bg-subtle/50 text-text bg-transparent'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className={`font-bold transition-colors ${isActive ? 'text-white' : 'text-text'}`}>
                        {role.name}
                      </span>
                      {role.description && (
                        <span className={`text-2xs font-normal transition-colors mt-0.5 truncate max-w-[140px] ${isActive ? 'text-white/80' : 'text-text-muted'}`}>
                          {role.description}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {role.is_locked && <Lock size={10} className={isActive ? 'text-white/85' : 'text-text-subtle'} />}
                      <span className={`text-3xs font-mono font-bold px-1.5 py-0.5 rounded-md border transition-colors ${
                        isActive 
                          ? 'bg-white text-brand border-white shadow-2xs' 
                          : 'bg-bg-surface text-text-muted border-border'
                      }`}>
                        {role.slug === 'owner' ? '★' : role.permission_count || 0}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Right Column - Edit / Create Form & Matrix */}
        <div className="lg:col-span-9">
          {isRoleLoading && !isCreating ? (
            <Card className="p-6 border-border/60">
              <Skeleton className="h-96 w-full rounded-xl" />
            </Card>
          ) : (
            <Card className="p-5 space-y-5 border-border/60 shadow-sm">
              {/* Form Metadata Section - Horizontal & Compact */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-text flex items-center gap-2">
                    <Shield size={14} className="text-brand" />
                    {isCreating ? __( 'Create Custom Role', 'codeclove-school-management' ) : sprintf( __( '%s Capabilities', 'codeclove-school-management' ), roleName )}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {isCreating ? __( 'Define a new role and choose its permissions matrix.', 'codeclove-school-management' ) : __( 'Configure administrative permission scopes.', 'codeclove-school-management' )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold text-text-muted uppercase tracking-wider shrink-0">{__( 'Role:', 'codeclove-school-management' )}</span>
                    <input
                      type="text"
                      placeholder={__( 'Role Name', 'codeclove-school-management' )}
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      disabled={isLocked && !isCreating}
                      className="h-8 px-2.5 border border-border rounded-lg text-xs bg-bg-surface text-text placeholder:text-text-subtle focus:outline-none focus:ring-1 focus:ring-brand-ring w-40"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold text-text-muted uppercase tracking-wider shrink-0">{__( 'Desc:', 'codeclove-school-management' )}</span>
                    <input
                      type="text"
                      placeholder={__( 'Role Description', 'codeclove-school-management' )}
                      value={roleDescription}
                      onChange={(e) => setRoleDescription(e.target.value)}
                      disabled={isOwner}
                      className="h-8 px-2.5 border border-border rounded-lg text-xs bg-bg-surface text-text placeholder:text-text-subtle focus:outline-none focus:ring-1 focus:ring-brand-ring w-56"
                    />
                  </div>
                </div>
              </div>

              {/* Owner Warning / Info Banner */}
              {isOwner && (
                <div className="bg-brand-dim/20 border border-brand/20 p-3 rounded-lg flex items-start gap-2.5 text-2xs text-brand leading-relaxed">
                  <ShieldAlert size={14} className="mt-0.5 flex-shrink-0 text-brand" />
                  <div>
                    <strong className="font-bold">{__( 'System Wildcard Role:', 'codeclove-school-management' )}</strong>{' '}
                    {__( 'The Owner role possesses full access across all endpoints and database operations (`*`). Its permission mapping is hardcoded and cannot be modified.', 'codeclove-school-management' )}
                  </div>
                </div>
              )}

              {/* Permission Matrix */}
              {!isOwner && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-base/30 p-2.5 rounded-lg border border-border/50">
                    <div>
                      <h4 className="text-xs font-bold text-text uppercase tracking-wider">{__( 'Capability Map', 'codeclove-school-management' )}</h4>
                    </div>
                    {!(isLocked && !isCreating) && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleToggleAllPermissions(true)} className="px-2 py-1 text-2xs font-bold text-brand bg-bg-surface border border-border rounded-md hover:bg-bg-subtle/50 transition-colors">
                          {__( 'Select All', 'codeclove-school-management' )}
                        </button>
                        <button onClick={() => handleToggleAllPermissions(false)} className="px-2 py-1 text-2xs font-bold text-text-muted bg-bg-surface border border-border rounded-md hover:bg-bg-subtle/50 transition-colors">
                          {__( 'Deselect All', 'codeclove-school-management' )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {sortedCategories.map(({ category, perms, keys }) => {
                      const checkedInCat = keys.filter(k => checkedKeys.includes(k))
                      const isAllChecked = checkedInCat.length === keys.length
                      const CatIcon = getCategoryIcon(category)

                      return (
                        <details
                          key={category}
                          className="border border-border/60 rounded-lg bg-bg-surface overflow-hidden group transition-all duration-150 open:border-brand/35 open:shadow-xs"
                        >
                          <summary className="flex items-center justify-between px-3.5 py-2.5 bg-bg-base/20 hover:bg-bg-base/40 border-b border-transparent group-open:border-border/45 group-open:bg-bg-base/40 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden transition-colors">
                            <div className="flex items-center gap-2">
                              <div className="w-5.5 h-5.5 rounded bg-bg-surface border border-border flex items-center justify-center text-text-muted group-open:text-brand group-open:bg-brand-dim/20 group-open:border-brand/10 transition-colors">
                                <CatIcon size={12} />
                              </div>
                              <span className="text-xs font-bold text-text group-open:text-brand transition-colors">{category}</span>
                              <Badge variant={checkedInCat.length > 0 ? 'brand' : 'default'} size="sm" className="px-1.5 text-3xs font-bold">
                                {checkedInCat.length}/{keys.length}
                              </Badge>
                            </div>
                            <ChevronDown size={12} className="transition-transform duration-200 group-open:rotate-180 text-text-subtle group-open:text-brand" />
                          </summary>

                          <div className="p-3 space-y-3 bg-bg-base border-t border-border/50">
                            {!(isLocked && !isCreating) && (
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCategory(keys, !isAllChecked)}
                                  className="text-3xs font-bold text-brand hover:underline"
                                >
                                  {isAllChecked ? __( 'Deselect Category', 'codeclove-school-management' ) : __( 'Select Category', 'codeclove-school-management' )}
                                </button>
                              </div>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {Object.entries(perms).map(([key, label]) => {
                                const isChecked = checkedKeys.includes(key)
                                return (
                                  <div
                                    key={key}
                                    onClick={() => handleTogglePermission(key)}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all select-none text-xs font-semibold ${
                                      isLocked && !isCreating 
                                        ? 'cursor-not-allowed opacity-60 bg-bg-base/30 border-border/40' 
                                        : isChecked
                                        ? 'border-brand/35 bg-brand-dim/15 cursor-pointer shadow-2xs text-brand font-bold'
                                        : 'border-border/50 hover:border-border hover:bg-bg-surface cursor-pointer bg-bg-surface text-text-muted hover:text-text'
                                    }`}
                                  >
                                    <div className={`flex-shrink-0 h-3.5 w-3.5 rounded-[3px] border flex items-center justify-center transition-all ${
                                      isChecked ? 'bg-brand border-brand text-white' : 'border-border-strong bg-bg-base'
                                    }`}>
                                      {isChecked && <Check size={10} strokeWidth={3} />}
                                    </div>
                                    <span className="truncate leading-tight" title={label}>{label}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </details>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t border-border/60 pt-4">
                {!isCreating && selectedRole && !selectedRole.is_system && !selectedRole.is_locked ? (
                  <Button variant="danger" size="sm" onClick={handleDelete} disabled={isPending} className="gap-1.5 h-8 text-xs font-semibold px-3">
                    <Trash2 size={12} />
                    {__( 'Delete Role', 'codeclove-school-management' )}
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-3">
                  {isCreating && (
                    <Button variant="secondary" size="sm" onClick={() => setIsCreating(false)} disabled={isPending} className="h-8 text-xs font-semibold px-3">
                      {__( 'Cancel', 'codeclove-school-management' )}
                    </Button>
                  )}
                  
                  {!isOwner && (
                    <Button variant="default" size="sm" onClick={handleSave} disabled={isPending} className="gap-1.5 h-8 text-xs font-semibold px-4 shadow-sm animate-glow">
                      {isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                      {isCreating ? __( 'Save Role', 'codeclove-school-management' ) : __( 'Save Changes', 'codeclove-school-management' )}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
