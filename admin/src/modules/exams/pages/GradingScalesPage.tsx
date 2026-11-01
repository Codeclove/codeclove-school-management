/**
 * GradingScalesPage — Institutional grading scale definitions & visual tier tables.
 *
 * Designed with Ponytail principles:
 * - Single unified surface: Zero modals, zero nested cards inside cards.
 * - Live inline editing: The preview IS the editor. Modifying tiers instantly updates
 *   the visual spectrum bar and the live score simulator in real time.
 * - Accurate spectrum bar: Sorted ascending (0% on left, 100% on right), flex-proportional,
 *   zero blank gaps, high contrast visible text, distinct semantic danger styling for failing bands.
 * - Single coordinated action bar: Guarded unsaved changes protection across sidebar navigation.
 * - Full CRUD: Create, Duplicate, View, Inline Edit, Set as Default, and Delete with confirmation.
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Scale,
  Plus,
  Edit2,
  Trash2,
  Star,
  Search,
  Check,
  X,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Copy,
} from 'lucide-react'
import { useGradingScales, useSaveGradingScale, useDeleteGradingScale } from '@/api/exams'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { __, sprintf } from '@/lib/i18n'
import { ROUTES } from '@/lib/constants'
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  Input,
  FormField,
  Checkbox,
  EmptyState,
  Alert,
  Badge,
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableSkeleton,
} from '@/components/ui'
import type { GradingScale, GradingTier, SaveGradingScalePayload } from '../types'

/**
 * Calculates the true minimum passing percentage for a set of tiers.
 * Looks for the lowest boundary tier where is_pass is true.
 */
function getScaleMinPassScore(tiers?: GradingTier[]): number | null {
  if (!tiers || tiers.length === 0) return null
  const passTiers = tiers.filter((t) => t.is_pass)
  const first = passTiers[0]
  if (!first) return null
  return passTiers.reduce((min, t) => (t.min < min ? t.min : min), first.min)
}


export default function GradingScalesPage() {
  const toast = useToast()
  const confirm = useConfirm()

  // ─── Queries & Mutations ────────────────────────────────────────────────────
  const {
    data: allGradingScales = [],
    isLoading,
    isError,
    refetch,
  } = useGradingScales()

  const saveScaleMutation = useSaveGradingScale()
  const deleteScaleMutation = useDeleteGradingScale()

  // ─── Active Selected Scale, Search & Preset Scoping ────────────────────────
  const [searchParams] = useSearchParams()
  const [selectedScaleId, setSelectedScaleId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAllPresets, setShowAllPresets] = useState(false)

  // Active education system preset from CodeClove global config or Settings
  const activePreset = useMemo(() => {
    return (window.CodeCloveConfig?.preset || 'IN').toUpperCase()
  }, [])

  const activePresetName = useMemo(() => {
    return window.CodeCloveConfig?.presetName || 'India'
  }, [])

  // Tenant-scoped grading scales: active preset + universal + custom scales without preset
  const gradingScales = useMemo(() => {
    if (showAllPresets) return allGradingScales
    return allGradingScales.filter((s) => {
      const p = (s.preset || '').toUpperCase()
      if (!p || p === 'UNIVERSAL') return true
      if (activePreset === 'GB' || activePreset === 'UK') {
        return p === 'GB' || p === 'UK'
      }
      return p === activePreset
    })
  }, [allGradingScales, showAllPresets, activePreset])

  // ─── Inline Edit Mode State ─────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsDefault, setEditIsDefault] = useState(false)
  const [editScaleType, setEditScaleType] = useState<'percentage' | 'points'>('percentage')
  const [editMaxPoints, setEditMaxPoints] = useState<number>(100)
  const [editTiers, setEditTiers] = useState<GradingTier[]>([])
  const [editError, setEditError] = useState<string | null>(null)

  // Filtered scales based on user search query
  const filteredScales = useMemo(() => {
    if (!searchQuery.trim()) return gradingScales
    const q = searchQuery.toLowerCase().trim()
    return gradingScales.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.preset && s.preset.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
    )
  }, [gradingScales, searchQuery])

  // Resolve active scale: explicit selection -> default scale -> first scale
  const activeScale = useMemo(() => {
    if (selectedScaleId) {
      const found = gradingScales.find((s) => s.id === selectedScaleId)
      if (found) return found
    }
    return gradingScales.find((s) => s.is_default) || gradingScales[0] || null
  }, [gradingScales, selectedScaleId])

  // Active scale evaluation mode and scale bound
  const activeScaleType = useMemo(() => {
    if (isEditing) return editScaleType
    return activeScale?.scale_type || 'percentage'
  }, [isEditing, editScaleType, activeScale])

  const isPointsMode = activeScaleType === 'points'

  const activeMaxPoints = useMemo(() => {
    if (isEditing) return editScaleType === 'points' ? editMaxPoints : 100
    if (activeScale?.scale_type === 'points') return activeScale.max_points || 100
    return 100
  }, [isEditing, editScaleType, editMaxPoints, activeScale])

  // Institutional primary default scale
  const defaultScale = useMemo(() => {
    return gradingScales.find((s) => s.is_default) || null
  }, [gradingScales])

  // Whether default scale matches the current search query
  const shouldShowDefaultPinned = useMemo(() => {
    if (!defaultScale) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      defaultScale.name.toLowerCase().includes(q) ||
      defaultScale.code.toLowerCase().includes(q) ||
      (defaultScale.preset && defaultScale.preset.toLowerCase().includes(q)) ||
      (defaultScale.description && defaultScale.description.toLowerCase().includes(q))
    )
  }, [defaultScale, searchQuery])

  // Additional secondary scales (non-default) within the filtered set
  const secondaryScales = useMemo(() => {
    return filteredScales.filter((s) => !s.is_default)
  }, [filteredScales])

  // Current live tiers: in edit mode, reflects editTiers; otherwise activeScale.tiers
  const currentTiers = useMemo(() => {
    if (isEditing) return editTiers
    return activeScale?.tiers || []
  }, [isEditing, editTiers, activeScale])


  // Executive KPI metrics for current live tiers
  const minPassScore = useMemo(() => {
    return getScaleMinPassScore(currentTiers)
  }, [currentTiers])

  const minPassTier = useMemo(() => {
    const passTiers = currentTiers.filter((t) => t.is_pass)
    const first = passTiers[0]
    if (!first) return null
    return passTiers.reduce<GradingTier>(
      (lowest, t) => (t.min < lowest.min ? t : lowest),
      first
    )
  }, [currentTiers])

  const maxGp = useMemo(() => {
    if (currentTiers.length === 0) return 0
    return Math.max(...currentTiers.map((t) => t.gp || 0))
  }, [currentTiers])

  const topTier = useMemo(() => {
    if (currentTiers.length === 0) return null
    return [...currentTiers].sort((a, b) => b.max - a.max)[0] || null
  }, [currentTiers])

  // ─── Guarded Scale Selection from Directory ──────────────────────────────────
  const handleSelectScale = async (scaleId: number) => {
    if (scaleId === activeScale?.id && !isCreatingNew) return

    if (isEditing) {
      const discard = await confirm({
        title: __('Discard Unsaved Changes?', 'codeclove-school-management'),
        message: __(
          'You have unsaved changes to this grading scale. Switching to another scale will discard your modifications.',
          'codeclove-school-management'
        ),
        confirmText: __('Discard and Switch', 'codeclove-school-management'),
        variant: 'danger',
      })
      if (!discard) return
    }

    setIsEditing(false)
    setIsCreatingNew(false)
    setEditError(null)
    setSelectedScaleId(scaleId)
  }

  // ─── Inline Mode Switchers ──────────────────────────────────────────────────
  const handleStartEdit = (scale: GradingScale) => {
    setIsCreatingNew(false)
    setEditName(scale.name)
    setEditCode(scale.code)
    setEditDescription(scale.description || '')
    setEditIsDefault(scale.is_default)
    setEditScaleType(scale.scale_type || 'percentage')
    setEditMaxPoints(scale.max_points || 100)
    setEditTiers(scale.tiers ? JSON.parse(JSON.stringify(scale.tiers)) : [])
    setEditError(null)
    setIsEditing(true)
  }

  // Auto-activate edit mode or scale selection from URL search params (e.g. ?edit=1 or ?scale_id=123)
  const hasInitializedFromUrl = useRef(false)
  useEffect(() => {
    if (hasInitializedFromUrl.current || isLoading || gradingScales.length === 0) return
    const editRequested = searchParams.get('edit') === '1' || searchParams.get('action') === 'edit'
    const targetScaleId = searchParams.get('id') || searchParams.get('scale_id')
    if (targetScaleId) {
      const found = gradingScales.find((s) => s.id === Number(targetScaleId))
      if (found) {
        setSelectedScaleId(found.id)
        if (editRequested) {
          handleStartEdit(found)
        }
      }
    } else if (editRequested && activeScale) {
      handleStartEdit(activeScale)
    }
    hasInitializedFromUrl.current = true
  }, [searchParams, isLoading, gradingScales, activeScale])

  const handleStartCreate = () => {
    setIsCreatingNew(true)
    setEditName(__('New Grading Scale', 'codeclove-school-management'))
    setEditCode('NEW_SCALE')
    setEditDescription('')
    setEditIsDefault(gradingScales.length === 0)
    setEditScaleType('percentage')
    setEditMaxPoints(100)
    const baseTiers = allGradingScales[0]?.tiers
    setEditTiers(baseTiers ? JSON.parse(JSON.stringify(baseTiers)) : [
      { label: 'A', min: 80, max: 100, gp: 4.0, desc: 'Outstanding', is_pass: true },
      { label: 'B', min: 60, max: 79.99, gp: 3.0, desc: 'Good', is_pass: true },
      { label: 'C', min: 40, max: 59.99, gp: 2.0, desc: 'Pass', is_pass: true },
      { label: 'F', min: 0, max: 39.99, gp: 0.0, desc: 'Fail', is_pass: false },
    ])
    setEditError(null)
    setIsEditing(true)
  }

  const handleStartCreateWithGuard = async () => {
    if (isEditing) {
      const discard = await confirm({
        title: __('Discard Unsaved Changes?', 'codeclove-school-management'),
        message: __(
          'You have unsaved changes in progress. Starting a new scale will discard your current edits.',
          'codeclove-school-management'
        ),
        confirmText: __('Discard and Create New', 'codeclove-school-management'),
        variant: 'danger',
      })
      if (!discard) return
    }
    handleStartCreate()
  }

  const handleDuplicateScale = (scale: GradingScale) => {
    setIsCreatingNew(true)
    setEditName(sprintf(__('%s (Copy)', 'codeclove-school-management'), scale.name))
    setEditCode(`${scale.code}_COPY`.slice(0, 32))
    setEditDescription(scale.description || '')
    setEditIsDefault(false)
    setEditScaleType(scale.scale_type || 'percentage')
    setEditMaxPoints(scale.max_points || 100)
    setEditTiers(scale.tiers ? JSON.parse(JSON.stringify(scale.tiers)) : [])
    setEditError(null)
    setIsEditing(true)
    toast.info(sprintf(__('Created copy of "%s". Customize and save when ready.', 'codeclove-school-management'), scale.name))
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setIsCreatingNew(false)
    setEditError(null)
  }

  const handleLoadScaleIntoEdit = async (scaleId: number) => {
    const tmpl = allGradingScales.find((s) => s.id === scaleId)
    if (!tmpl) return
    if (editTiers.length > 0) {
      const ok = await confirm({
        title: __('Apply Preset Scale?', 'codeclove-school-management'),
        message: sprintf(
          __('Applying "%s" will replace all current tier rows (%d tiers).', 'codeclove-school-management'),
          tmpl.name,
          editTiers.length
        ),
        confirmText: __('Apply Scale', 'codeclove-school-management'),
        variant: 'default',
      })
      if (!ok) return
    }
    setEditTiers(tmpl.tiers ? JSON.parse(JSON.stringify(tmpl.tiers)) : [])
    setEditScaleType(tmpl.scale_type || 'percentage')
    setEditMaxPoints(tmpl.max_points || 100)
    toast.info(sprintf(__('Loaded %s tiers into editor.', 'codeclove-school-management'), tmpl.name))
  }

  // ─── Tier Row Manipulation in Edit Mode ─────────────────────────────────────
  const handleAddTierRow = () => {
    setEditTiers((prev) => {
      const maxLimit = editScaleType === 'points' ? editMaxPoints : 100
      const lowestMin = prev.length > 0 ? Math.min(...prev.map((t) => t.min)) : 0
      const defaultMin = lowestMin > 0 ? 0 : 0
      const defaultMax = lowestMin > 0 ? Math.max(0, lowestMin - 1) : Math.round(maxLimit * 0.1)
      return [
        ...prev,
        {
          label: 'New',
          min: defaultMin,
          max: defaultMax,
          gp: 0.0,
          desc: '',
          is_pass: false,
        },
      ]
    })
  }

  const handleMoveTierRow = (index: number, direction: -1 | 1) => {
    setEditTiers((prev) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const next = [...prev]
      const temp = next[index]
      const target = next[targetIndex]
      if (!temp || !target) return prev
      next[index] = target
      next[targetIndex] = temp
      return next
    })
  }

  const handleUpdateTierRow = <K extends keyof GradingTier>(
    index: number,
    field: K,
    value: GradingTier[K]
  ) => {
    setEditTiers((prev) => {
      const current = prev[index]
      if (!current) return prev
      const next = [...prev]
      next[index] = {
        ...current,
        [field]: value,
      }
      return next
    })
  }

  const handleRemoveTierRow = (index: number) => {
    setEditTiers((prev) => prev.filter((_, idx) => idx !== index))
  }

  // ─── Save Changes (Mutation) ────────────────────────────────────────────────
  const handleSaveInline = async () => {
    setEditError(null)

    if (!editName.trim()) {
      setEditError(__('Scale Name is required.', 'codeclove-school-management'))
      return
    }
    if (!editCode.trim()) {
      setEditError(__('Scale Code is required.', 'codeclove-school-management'))
      return
    }
    if (editTiers.length === 0) {
      setEditError(__('At least one grading tier row is required.', 'codeclove-school-management'))
      return
    }

    // Validate unique grade labels and bounds
    const maxBound = editScaleType === 'points' ? editMaxPoints : 100

    const seenLabels = new Set<string>()
    for (let i = 0; i < editTiers.length; i++) {
      const tier = editTiers[i]
      if (!tier) continue
      const trimmedLabel = tier.label.trim().toUpperCase()
      if (!trimmedLabel) {
        setEditError(sprintf(__('Tier #%d is missing a grade label.', 'codeclove-school-management'), i + 1))
        return
      }
      if (seenLabels.has(trimmedLabel)) {
        setEditError(
          sprintf(
            __('Duplicate grade label "%s". Each grading tier must have a unique label.', 'codeclove-school-management'),
            tier.label.trim()
          )
        )
        return
      }
      seenLabels.add(trimmedLabel)

      if (tier.min < 0 || tier.max > maxBound || tier.min > tier.max) {
        setEditError(
          sprintf(
            editScaleType === 'points'
              ? __('Tier "%s" has invalid bounds (%s to %s pts). Must be 0 to %d with Min <= Max.', 'codeclove-school-management')
              : __('Tier "%s" has invalid bounds (%s%% to %s%%). Must be 0 to 100 with Min <= Max.', 'codeclove-school-management'),
            tier.label,
            tier.min,
            tier.max,
            maxBound
          )
        )
        return
      }
    }

    // Validate tier overlaps
    const sortedTiers = [...editTiers].sort((a, b) => a.min - b.min)
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      const curr = sortedTiers[i]
      const next = sortedTiers[i + 1]
      if (curr && next && curr.max > next.min) {
        setEditError(
          sprintf(
            __('Tiers "%s" (%s–%s) and "%s" (%s–%s) overlap. Interval ranges must not overlap.', 'codeclove-school-management'),
            curr.label,
            curr.min,
            curr.max,
            next.label,
            next.min,
            next.max
          )
        )
        return
      }
    }

    try {
      const payload: SaveGradingScalePayload = {
        id: isCreatingNew ? undefined : activeScale?.id,
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        description: editDescription.trim() || null,
        preset: isCreatingNew ? undefined : activeScale?.preset,
        scale_type: editScaleType,
        max_points: editScaleType === 'points' ? editMaxPoints : null,
        is_default: editIsDefault,
        tiers: editTiers,
      }

      const saved = await saveScaleMutation.mutateAsync(payload)
      if (saved?.id) {
        setSelectedScaleId(saved.id)
      }
      setIsEditing(false)
      setIsCreatingNew(false)
      toast.success(
        isCreatingNew
          ? __('Grading scale created successfully.', 'codeclove-school-management')
          : __('Grading scale updated successfully.', 'codeclove-school-management')
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __('Failed to save grading scale.', 'codeclove-school-management')
      setEditError(message)
      toast.error(message)
    }
  }

  const handleSetAsDefault = async (scale: GradingScale) => {
    try {
      await saveScaleMutation.mutateAsync({
        ...scale,
        is_default: true,
      })
      toast.success(sprintf(__('"%s" set as the primary institutional grading scale.', 'codeclove-school-management'), scale.name))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : __('Failed to update default grading scale.', 'codeclove-school-management'))
    }
  }

  const handleDeleteScale = async (scale: GradingScale) => {
    if (scale.is_default) {
      toast.error(__('Cannot delete the primary institutional default scale. Set another scale as default first.', 'codeclove-school-management'))
      return
    }

    const ok = await confirm({
      title: sprintf(__('Delete "%s"?', 'codeclove-school-management'), scale.name),
      message: __(
        'Are you sure you want to delete this grading scale? Existing examinations referencing this scale will fall back to the institutional default.',
        'codeclove-school-management'
      ),
      confirmText: __('Delete Scale', 'codeclove-school-management'),
      variant: 'danger',
    })

    if (!ok) return

    try {
      await deleteScaleMutation.mutateAsync(scale.id)
      toast.success(sprintf(__('Grading scale "%s" deleted.', 'codeclove-school-management'), scale.name))
      setSelectedScaleId(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : __('Failed to delete grading scale.', 'codeclove-school-management'))
    }
  }

  // ─── Scale Directory Item Renderer ──────────────────────────────────────────
  const renderScaleRow = (scale: GradingScale, isDefault = false) => {
    const isSelected = !isCreatingNew && activeScale?.id === scale.id
    const passScore = getScaleMinPassScore(scale.tiers)
    const tierCount = scale.tiers?.length ?? 0
    const presetLabel = scale.preset === 'UNIVERSAL' ? __('General', 'codeclove-school-management') : scale.preset

    return (
      <button
        key={scale.id}
        type="button"
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
        onClick={() => handleSelectScale(scale.id)}
        className={`w-full group relative flex items-start gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer transition-colors duration-150 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-ring ${
          isSelected
            ? 'bg-brand-dim/50 text-text font-medium'
            : 'text-text-muted hover:bg-hover-bg/70 hover:text-text'
        }`}
        title={scale.description || undefined}
      >
        {/* Refined Left Accent Indicator */}
        <span
          className={`absolute left-0.5 top-1.5 bottom-1.5 w-[3px] rounded-full transition-colors duration-150 ${
            isSelected ? 'bg-brand' : 'bg-transparent group-hover:bg-border-strong/40'
          }`}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1 pl-1">
          {/* Header Row: Scale Name & Status Badges */}
          <div className="flex items-center justify-between gap-1.5">
            <h3
              className={`text-xs font-semibold truncate transition-colors ${
                isSelected ? 'text-brand' : 'text-text'
              }`}
            >
              {scale.name}
            </h3>

            <div className="flex items-center gap-1 shrink-0">
              {isDefault && (
                <span className="inline-flex items-center gap-0.5 text-3xs font-semibold text-brand bg-brand-dim/90 px-1.5 py-0.5 rounded">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  {__('Default', 'codeclove-school-management')}
                </span>
              )}
              {presetLabel && !isDefault && (
                <span className="text-3xs font-mono font-medium text-text-subtle uppercase px-1 py-0.5 rounded bg-bg-surface border border-border/70">
                  {presetLabel}
                </span>
              )}
              {scale.scale_type === 'points' && (
                <span className="text-3xs font-medium text-text-subtle px-1 py-0.5 rounded bg-bg-surface border border-border/70">
                  {__('Points', 'codeclove-school-management')}
                </span>
              )}
            </div>
          </div>

          {/* Metadata Row: Tiers & Pass Threshold */}
          <div className="flex items-center gap-1.5 mt-0.5 text-3xs text-text-subtle">
            <span>{sprintf(__('%d tiers', 'codeclove-school-management'), tierCount)}</span>
            <span className="text-border-strong">•</span>
            <span className={passScore !== null ? 'font-mono text-text-muted' : 'italic text-text-subtle/70'}>
              {passScore !== null
                ? sprintf(
                    scale.scale_type === 'points'
                      ? __('Pass ≥ %d pts', 'codeclove-school-management')
                      : __('Pass ≥ %d%%', 'codeclove-school-management'),
                    passScore
                  )
                : __('No pass score', 'codeclove-school-management')}
            </span>
          </div>
        </div>
      </button>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page Header with Coordinated Action Set */}
      <PageHeader
        title={__('Grading Scales', 'codeclove-school-management')}
        description={__(
          'Set up letter grade ranges (A, B, C...) and passing thresholds for exams.',
          'codeclove-school-management'
        )}
        breadcrumbs={[
          { label: __('Examinations', 'codeclove-school-management'), href: ROUTES.EXAMS },
          { label: __('Grading Scales', 'codeclove-school-management') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-8 text-xs font-semibold"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  {__('Cancel', 'codeclove-school-management')}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveInline}
                  disabled={saveScaleMutation.isPending}
                  className="h-8 text-xs font-semibold"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  {saveScaleMutation.isPending
                    ? __('Saving...', 'codeclove-school-management')
                    : __('Save Changes', 'codeclove-school-management')}
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleStartCreateWithGuard}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                {__('Add Grading Scale', 'codeclove-school-management')}
              </Button>
            )}
          </div>
        }
      />

      {/* Main Content Area */}
      {isLoading ? (
        <Card className="bg-bg-elevated border-border">
          <CardContent className="p-6">
            <TableSkeleton rows={6} columns={6} />
          </CardContent>
        </Card>
      ) : isError ? (
        <Alert variant="danger">
          <div className="flex items-center justify-between w-full">
            <span>{__('Failed to load configured grading scales.', 'codeclove-school-management')}</span>
            <Button size="sm" variant="secondary" onClick={() => refetch()} className="h-7 text-xs">
              {__('Retry', 'codeclove-school-management')}
            </Button>
          </div>
        </Alert>
      ) : gradingScales.length === 0 && !isEditing ? (
        <Card className="bg-bg-elevated border-border">
          <CardContent className="py-12">
            <EmptyState
              icon={Scale}
              title={__('No grading scales configured', 'codeclove-school-management')}
              description={__(
                'Create custom grade tier intervals or apply one of the standard templates to start evaluating exams.',
                'codeclove-school-management'
              )}
              action={
                <Button size="sm" onClick={handleStartCreate}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {__('Create First Scale', 'codeclove-school-management')}
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        /* Calm Master-Detail 2-Column Grid (Zero Nested Cards) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ─── Left Column: Selected Scale Command Center (Col 1-8) ──────────── */}
          <div className="lg:col-span-8 xl:col-span-8">
            <Card className="bg-bg-elevated border-border shadow-xs overflow-hidden">
              {/* Validation Alert */}
              {editError && (
                <div className="p-4 border-b border-danger/20 bg-danger-dim/30">
                  <div className="flex items-center gap-2 text-xs text-danger font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{editError}</span>
                  </div>
                </div>
              )}

              {/* 1. Scale Identity & Metadata Header */}
              <div className="p-4 sm:p-5 border-b border-border">
                {isEditing ? (
                  /* ── Inline Edit Mode Identity Controls (Accessible FormField Grid) ── */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-5">
                        <FormField label={__('Scale Name', 'codeclove-school-management')} required>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder={__('e.g. CBSE 8-Point Scale', 'codeclove-school-management')}
                            className="h-8 text-sm font-semibold bg-bg-surface border-border"
                          />
                        </FormField>
                      </div>

                      <div className="sm:col-span-3">
                        <FormField label={__('Scale Code', 'codeclove-school-management')} required>
                          <Input
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                            placeholder="CODE"
                            className="h-8 text-xs font-mono uppercase bg-bg-surface border-border"
                          />
                        </FormField>
                      </div>

                      <div className="sm:col-span-4">
                        <FormField label={__('Copy from Existing Scale', 'codeclove-school-management')}>
                          <select
                            aria-label={__('Load existing scale tiers into editor', 'codeclove-school-management')}
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleLoadScaleIntoEdit(Number(e.target.value))
                              }
                            }}
                            className="h-8 w-full text-xs rounded-md border border-border bg-bg-surface text-text px-2"
                          >
                            <option value="" disabled>
                              {__('Choose scale...', 'codeclove-school-management')}
                            </option>
                            {allGradingScales.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.tiers?.length || 0} tiers)
                              </option>
                            ))}
                          </select>
                        </FormField>
                      </div>
                    </div>

                    {/* Evaluation Basis: Percentage vs Raw Points / Marks */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-semibold text-text">{__('Evaluation Basis:', 'codeclove-school-management')}</span>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-text select-none">
                            <input
                              type="radio"
                              name="scale_type"
                              value="percentage"
                              checked={editScaleType === 'percentage'}
                              onChange={() => setEditScaleType('percentage')}
                              className="text-brand focus:ring-brand h-3.5 w-3.5"
                            />
                            <span>{__('Percentage (0–100%)', 'codeclove-school-management')}</span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-text select-none">
                            <input
                              type="radio"
                              name="scale_type"
                              value="points"
                              checked={editScaleType === 'points'}
                              onChange={() => setEditScaleType('points')}
                              className="text-brand focus:ring-brand h-3.5 w-3.5"
                            />
                            <span>{__('Raw Points / Marks', 'codeclove-school-management')}</span>
                          </label>
                        </div>
                      </div>

                      {editScaleType === 'points' && (
                        <div className="flex items-center gap-2">
                          <label htmlFor="scale-max-points" className="text-xs font-medium text-text-subtle">
                            {__('Max Scale Points:', 'codeclove-school-management')}
                          </label>
                          <Input
                            id="scale-max-points"
                            type="number"
                            min={1}
                            max={1000}
                            value={editMaxPoints}
                            onChange={(e) => setEditMaxPoints(Math.max(1, Number(e.target.value) || 1))}
                            className="h-8 w-20 text-xs font-mono text-right tabular-nums bg-bg-surface border-border"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                      <div className="sm:col-span-8">
                        <FormField label={__('Description', 'codeclove-school-management')}>
                          <textarea
                            rows={2}
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder={__('Scale description or syllabus authority reference (optional)...', 'codeclove-school-management')}
                            className="w-full text-xs rounded-md border border-border bg-bg-surface text-text p-2 resize-none focus:ring-1 focus:ring-brand focus:border-brand"
                          />
                        </FormField>
                      </div>

                      <div className="sm:col-span-4 pt-6">
                        <Checkbox
                          checked={editIsDefault}
                          onChange={(e) => setEditIsDefault(e.target.checked)}
                          label={__('Set as primary default', 'codeclove-school-management')}
                        />
                      </div>
                    </div>
                  </div>
                ) : activeScale ? (
                  /* ── Read-only View Mode Identity Header ── */
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-lg font-bold text-text">{activeScale.name}</h2>
                        {activeScale.is_default ? (
                          <Badge variant="brand" className="text-xs font-semibold py-0.5 px-2 gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            {__('Primary Default Scale', 'codeclove-school-management')}
                          </Badge>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSetAsDefault(activeScale)}
                            disabled={saveScaleMutation.isPending}
                            className="h-6 px-2 text-3xs gap-1 text-text-muted hover:text-text hover:border-brand"
                          >
                            <Star className="h-3 w-3" />
                            {__('Set as Default', 'codeclove-school-management')}
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-text-subtle mt-1 flex-wrap">
                        {activeScale.preset && (
                          <>
                            <span className="font-sans text-brand font-medium">
                              {sprintf(__('Preset: %s', 'codeclove-school-management'), activeScale.preset)}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span className="font-sans text-text-muted">
                          {isPointsMode
                            ? sprintf(__('Basis: Raw Points (Max: %d pts)', 'codeclove-school-management'), activeMaxPoints)
                            : __('Basis: Percentage (0–100%)', 'codeclove-school-management')}
                        </span>
                        <span>•</span>
                        <span className="text-text-muted">
                          {sprintf(__('%d tiers', 'codeclove-school-management'), activeScale.tiers?.length ?? 0)}
                        </span>
                      </div>
                      {activeScale.description && (
                        <p className="text-xs text-text-muted mt-2 leading-relaxed">
                          {activeScale.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDuplicateScale(activeScale)}
                        className="h-8 gap-1.5 text-xs font-semibold"
                        title={__('Duplicate this grading scale to create a new custom variation', 'codeclove-school-management')}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {__('Duplicate', 'codeclove-school-management')}
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStartEdit(activeScale)}
                        className="h-8 gap-1.5 text-xs font-semibold"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        {__('Edit Scale', 'codeclove-school-management')}
                      </Button>

                      {!activeScale.is_default && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDeleteScale(activeScale)}
                          disabled={deleteScaleMutation.isPending}
                          className="h-8 px-2.5 text-xs text-text-muted hover:text-danger hover:border-danger/40"
                          title={__('Delete this grading scale', 'codeclove-school-management')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* 2. Executive KPI Metrics Strip (Clean typographic cells, NO nested cards!) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border bg-bg-surface/40 border-b border-border">
                <div className="p-3.5 sm:px-5 sm:py-3">
                  <div className="text-3xs uppercase font-semibold text-text-subtle tracking-wider">
                    {__('Grade Bands', 'codeclove-school-management')}
                  </div>
                  <div className="text-base font-bold text-text mt-0.5 font-mono">
                    {currentTiers.length} <span className="text-xs font-normal text-text-muted font-sans">{__('levels', 'codeclove-school-management')}</span>
                  </div>
                </div>

                <div className="p-3.5 sm:px-5 sm:py-3">
                  <div className="text-3xs uppercase font-semibold text-text-subtle tracking-wider">
                    {__('Passing Threshold', 'codeclove-school-management')}
                  </div>
                  <div className="text-base font-bold text-success mt-0.5 font-mono">
                    {minPassScore !== null ? `≥ ${minPassScore}${isPointsMode ? ' pts' : '%'}` : '—'}{' '}
                    {minPassTier && <span className="text-xs font-semibold text-text-muted">({minPassTier.label})</span>}
                  </div>
                </div>

                <div className="p-3.5 sm:px-5 sm:py-3">
                  <div className="text-3xs uppercase font-semibold text-text-subtle tracking-wider">
                    {__('Max GPA', 'codeclove-school-management')}
                  </div>
                  <div className="text-base font-bold text-brand mt-0.5 font-mono">
                    {maxGp.toFixed(1)} <span className="text-xs font-normal text-text-muted font-sans">{__('GP', 'codeclove-school-management')}</span>
                  </div>
                </div>

                <div className="p-3.5 sm:px-5 sm:py-3">
                  <div className="text-3xs uppercase font-semibold text-text-subtle tracking-wider">
                    {__('Highest Grade', 'codeclove-school-management')}
                  </div>
                  <div className="text-base font-bold text-text mt-0.5 font-mono truncate">
                    {topTier ? topTier.label : '—'}{' '}
                    {topTier && (
                      <span className="text-xs font-normal text-text-muted">
                        ({topTier.min}–{topTier.max}{isPointsMode ? ' pts' : '%'})
                      </span>
                    )}
                  </div>
                </div>
              </div>


              {/* 4. Tier Matrix Table (View Mode vs Inline Edit Mode — Zero Scrollbar Overflow) */}
              <div>
                {currentTiers.length === 0 && !isEditing ? (
                  <div className="p-8 text-center bg-bg-surface/30">
                    <Scale className="h-8 w-8 text-text-subtle mx-auto mb-2 opacity-50" />
                    <h4 className="text-sm font-semibold text-text">
                      {__('No grading tiers configured for this scale', 'codeclove-school-management')}
                    </h4>
                    <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-4">
                      {__('Add custom percentage intervals or load standard tiers to enable exam evaluation.', 'codeclove-school-management')}
                    </p>
                    <Button size="sm" onClick={() => activeScale && handleStartEdit(activeScale)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      {__('Configure Tiers', 'codeclove-school-management')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <TableRoot>
                      <Thead>
                        <Tr>
                          <Th align="left" className="px-2.5 py-2 text-xs w-20 whitespace-nowrap">{__('Grade', 'codeclove-school-management')}</Th>
                          <Th align="right" className="px-2 py-2 text-xs w-18 whitespace-nowrap">
                            {isPointsMode ? __('Min Score', 'codeclove-school-management') : __('Min %', 'codeclove-school-management')}
                          </Th>
                          <Th align="right" className="px-2 py-2 text-xs w-18 whitespace-nowrap">
                            {isPointsMode ? __('Max Score', 'codeclove-school-management') : __('Max %', 'codeclove-school-management')}
                          </Th>
                          <Th align="right" className="px-2 py-2 text-xs w-20 whitespace-normal leading-tight">{__('Grade Points (GPA)', 'codeclove-school-management')}</Th>
                          <Th align="left" className="px-2.5 py-2 text-xs min-w-[120px]">{__('Description', 'codeclove-school-management')}</Th>
                          <Th align="center" className="px-2 py-2 text-xs w-20 whitespace-normal leading-tight">{__('Result', 'codeclove-school-management')}</Th>
                          {isEditing && (
                            <Th align="right" className="px-2 py-2 text-xs w-20">
                              <span className="sr-only">{__('Actions', 'codeclove-school-management')}</span>
                            </Th>
                          )}
                        </Tr>
                      </Thead>
                      <Tbody>
                        {currentTiers.map((tier, idx) => {
                          if (isEditing) {
                            return (
                              <Tr key={idx} className="hover:bg-hover-bg/30">
                                {/* Grade Label Input */}
                                <Td align="left" className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    aria-label={sprintf(__('Tier %d grade label', 'codeclove-school-management'), idx + 1)}
                                    value={tier.label}
                                    onChange={(e) => handleUpdateTierRow(idx, 'label', e.target.value)}
                                    placeholder="A1"
                                    className="w-14 sm:w-16 h-8 px-2 text-xs font-bold rounded border border-border bg-bg-surface text-text focus:ring-1 focus:ring-brand focus:border-brand"
                                  />
                                </Td>

                                {/* Min % Input */}
                                <Td align="right" className="px-1.5 py-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    aria-label={sprintf(__('Tier %d minimum score', 'codeclove-school-management'), idx + 1)}
                                    min={0}
                                    max={activeMaxPoints}
                                    value={tier.min}
                                    onChange={(e) => handleUpdateTierRow(idx, 'min', Number(e.target.value))}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-16 h-8 px-1.5 text-xs font-mono text-right tabular-nums rounded border border-border bg-bg-surface text-text focus:ring-1 focus:ring-brand focus:border-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </Td>

                                {/* Max % / Max Score Input */}
                                <Td align="right" className="px-1.5 py-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    aria-label={sprintf(__('Tier %d maximum score', 'codeclove-school-management'), idx + 1)}
                                    min={0}
                                    max={activeMaxPoints}
                                    value={tier.max}
                                    onChange={(e) => handleUpdateTierRow(idx, 'max', Number(e.target.value))}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-16 h-8 px-1.5 text-xs font-mono text-right tabular-nums rounded border border-border bg-bg-surface text-text focus:ring-1 focus:ring-brand focus:border-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </Td>

                                {/* Grade Point Input */}
                                <Td align="right" className="px-1.5 py-1.5">
                                  <input
                                    type="number"
                                    step="0.1"
                                    aria-label={sprintf(__('Tier %d grade point', 'codeclove-school-management'), idx + 1)}
                                    min={0}
                                    max={100}
                                    value={tier.gp}
                                    onChange={(e) => handleUpdateTierRow(idx, 'gp', Number(e.target.value))}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-16 h-8 px-1.5 text-xs font-mono text-right tabular-nums rounded border border-border bg-bg-surface text-text focus:ring-1 focus:ring-brand focus:border-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </Td>

                                {/* Description Input */}
                                <Td align="left" className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    aria-label={sprintf(__('Tier %d description', 'codeclove-school-management'), idx + 1)}
                                    value={tier.desc}
                                    onChange={(e) => handleUpdateTierRow(idx, 'desc', e.target.value)}
                                    placeholder={__('e.g. Outstanding Mastery', 'codeclove-school-management')}
                                    className="w-full min-w-[100px] h-8 px-2 text-xs rounded border border-border bg-bg-surface text-text focus:ring-1 focus:ring-brand focus:border-brand"
                                  />
                                </Td>

                                {/* Pass Checkbox */}
                                <Td align="center" className="px-1.5 py-1.5">
                                  <input
                                    type="checkbox"
                                    aria-label={sprintf(__('Tier %d pass status', 'codeclove-school-management'), idx + 1)}
                                    checked={tier.is_pass}
                                    onChange={(e) => handleUpdateTierRow(idx, 'is_pass', e.target.checked)}
                                    className="h-4 w-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                                  />
                                </Td>

                                {/* Actions (Move Up / Down & Delete) */}
                                <Td align="right" className="px-1.5 py-1.5">
                                  <div className="flex items-center justify-end gap-0.5">
                                    <button
                                      type="button"
                                      aria-label={sprintf(__('Move tier %d up', 'codeclove-school-management'), idx + 1)}
                                      disabled={idx === 0}
                                      onClick={() => handleMoveTierRow(idx, -1)}
                                      title={__('Move Up', 'codeclove-school-management')}
                                      className="p-1 rounded text-text-subtle hover:text-text hover:bg-hover-bg disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                    >
                                      <ChevronUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={sprintf(__('Move tier %d down', 'codeclove-school-management'), idx + 1)}
                                      disabled={idx === editTiers.length - 1}
                                      onClick={() => handleMoveTierRow(idx, 1)}
                                      title={__('Move Down', 'codeclove-school-management')}
                                      className="p-1 rounded text-text-subtle hover:text-text hover:bg-hover-bg disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={sprintf(__('Remove tier %d', 'codeclove-school-management'), idx + 1)}
                                      onClick={() => handleRemoveTierRow(idx)}
                                      disabled={editTiers.length <= 1}
                                      title={editTiers.length <= 1 ? __('A scale must have at least one tier', 'codeclove-school-management') : __('Remove this tier', 'codeclove-school-management')}
                                      className="p-1 rounded text-text-subtle hover:text-danger hover:bg-danger-dim/30 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </Td>
                              </Tr>
                            )
                          }

                          return (
                            <Tr
                              key={idx}
                              className="hover:bg-hover-bg/50 transition-colors"
                            >
                              {/* Grade Label */}
                              <Td align="left" className="px-2.5 py-2 font-bold text-text text-sm">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border shadow-2xs ${
                                    tier.is_pass
                                      ? 'bg-bg-surface text-text border-border'
                                      : 'bg-danger-dim/40 text-danger border-danger-border/40'
                                  }`}
                                >
                                  {tier.label}
                                </span>
                              </Td>

                              {/* Min % */}
                              <Td align="right" className="px-2 py-2 font-mono text-xs tabular-nums font-semibold text-text">
                                {`${tier.min}${isPointsMode ? ' pts' : '%'}`}
                              </Td>

                              {/* Max Score */}
                              <Td align="right" className="px-2 py-2 font-mono text-xs tabular-nums font-semibold text-text">
                                {`${tier.max}${isPointsMode ? ' pts' : '%'}`}
                              </Td>
                              {/* Grade Point */}
                              <Td align="right" className="px-2 py-2 font-mono text-xs tabular-nums font-bold text-brand">
                                {tier.gp.toFixed(1)}
                              </Td>

                              {/* Description */}
                              <Td align="left" className="px-2.5 py-2 text-xs text-text-muted">
                                {tier.desc || '—'}
                              </Td>

                              {/* Passing Status */}
                              <Td align="center" className="px-2 py-2">
                                {tier.is_pass ? (
                                  <Badge variant="success" className="text-3xs uppercase font-bold tracking-wider">
                                    {__('Pass', 'codeclove-school-management')}
                                  </Badge>
                                ) : (
                                  <Badge variant="danger" className="text-3xs uppercase font-bold tracking-wider">
                                    {__('Fail', 'codeclove-school-management')}
                                  </Badge>
                                )}
                              </Td>
                            </Tr>
                          )
                        })}
                      </Tbody>
                    </TableRoot>

                    {/* Table Footer Controls in Edit Mode */}
                    {isEditing && (
                      <div className="p-3 border-t border-border bg-bg-surface/30 flex items-center justify-between flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleAddTierRow}
                          className="h-8 px-3 text-xs font-semibold gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {__('Add Row', 'codeclove-school-management')}
                        </Button>

                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-3xs text-text-subtle hidden sm:inline">
                            {isPointsMode
                              ? __('Point score ranges must not overlap.', 'codeclove-school-management')
                              : __('Percentage ranges must not overlap.', 'codeclove-school-management')}
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleCancelEdit}
                            className="h-8 px-3 text-xs font-semibold"
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            {__('Cancel', 'codeclove-school-management')}
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleSaveInline}
                            disabled={saveScaleMutation.isPending}
                            className="h-8 text-xs font-semibold"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            {saveScaleMutation.isPending
                              ? __('Saving...', 'codeclove-school-management')
                              : __('Save Changes', 'codeclove-school-management')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* ─── Right Column: Scale Directory (Col 9-12) ──────────────────────── */}
          <div className="lg:col-span-4 xl:col-span-4 lg:sticky lg:top-6 space-y-4">
            <Card className="bg-bg-elevated border-border shadow-xs overflow-hidden">
              {/* Card Header with Counter */}
              <div className="px-3.5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold text-text">
                    {__('Configured Grading Scales', 'codeclove-school-management')}
                  </h2>
                  <Badge variant="outline" className="text-3xs font-mono py-0 px-1 font-semibold text-text-subtle">
                    {`(${gradingScales.length})`}
                  </Badge>
                </div>
              </div>

              {/* Integrated Search Filter */}
              <div className="p-2 border-b border-border/60 bg-bg-surface/20">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-subtle pointer-events-none" />
                  <Input
                    type="text"
                    placeholder={__('Search by name or code...', 'codeclove-school-management')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 pr-7 text-xs bg-bg-surface border-border focus:bg-bg-elevated"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-text-subtle hover:text-text transition-colors"
                      title={__('Clear search', 'codeclove-school-management')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Directory List Container */}
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-1.5 space-y-1 scrollbar-thin">
                {/* Pinned Section: Institutional Primary Default Scale */}
                {defaultScale && shouldShowDefaultPinned && (
                  <div className="pb-1 mb-1 border-b border-border/60">
                    <div className="px-2.5 py-1 text-3xs font-medium uppercase tracking-wider text-text-subtle flex items-center gap-1">
                      <Star className="h-2.5 w-2.5 text-brand fill-current" />
                      <span>{__('Institutional Default', 'codeclove-school-management')}</span>
                    </div>

                    {renderScaleRow(defaultScale, true)}
                  </div>
                )}

                {/* Section: Additional Scales */}
                {defaultScale && shouldShowDefaultPinned && (
                  <div className="px-2.5 py-1 text-3xs font-medium uppercase tracking-wider text-text-subtle">
                    <span>{sprintf(__('Other Scales (%d)', 'codeclove-school-management'), secondaryScales.length)}</span>
                  </div>
                )}

                {secondaryScales.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-xs text-text-subtle">
                      {searchQuery
                        ? sprintf(__('No scales found matching "%s".', 'codeclove-school-management'), searchQuery)
                        : __('No other scales configured.', 'codeclove-school-management')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {secondaryScales.map((scale) => renderScaleRow(scale, false))}
                  </div>
                )}
              </div>

              {/* International Presets Quick Toggle */}
              {allGradingScales.length > gradingScales.length || showAllPresets ? (
                <div className="px-3.5 py-2.5 border-t border-border bg-bg-surface/20 flex items-center justify-between text-2xs text-text-subtle">
                  <span className="truncate pr-2">
                    {showAllPresets
                      ? __('All frameworks', 'codeclove-school-management')
                      : sprintf(__('Scoped to %s', 'codeclove-school-management'), activePresetName)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllPresets(!showAllPresets)}
                    className="font-medium text-brand hover:text-brand-hover hover:underline shrink-0 transition-colors"
                  >
                    {showAllPresets
                      ? sprintf(__('Show %s only', 'codeclove-school-management'), activePresetName)
                      : sprintf(__('View all (%d)', 'codeclove-school-management'), allGradingScales.length)}
                  </button>
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
