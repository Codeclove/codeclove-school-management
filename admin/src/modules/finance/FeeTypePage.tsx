import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Coins, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { __, sprintf } from '@/lib/i18n'
import { feeTypeSchema, type FeeTypeFormValues } from '@/schemas/finance'
import {
  useFeeType,
  useCreateFeeType,
  useUpdateFeeType,
  useClassRates,
  useUpsertClassRate,
  useDeleteClassRate,
} from '@/api/finance'
import { useUnits } from '@/api/academics'
import { useSettings } from '@/api/settings'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import {
  Button,
  PageHeader,
  Card,
  CardContent,
  FormField,
  Input,
  Select,
  Textarea,
  Badge,
  EmptyState,
  Skeleton,
} from '@/components/ui'

export default function FeeTypePage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const feeTypeId = isEdit ? Number(id) : 0
  const navigate = useNavigate()
  const toast = useToast()
  const { getLabel } = useLabels()
  const { data: settings } = useSettings()

  const feeTypeLabel = getLabel('fee_type', false, __('Fee Type', 'codeclove-school-management'))
  const baseCurrency = settings?.localization?.currency || 'USD'

  const frequencyOptions = useMemo(() => [
    { value: 'one_time',  label: __('One Time  — Registration, Exam, Activity', 'codeclove-school-management') },
    { value: 'term_wise', label: __('Per Term  — Tuition, Lab, Library', 'codeclove-school-management') },
    { value: 'monthly',   label: __('Monthly   — Transport, Hostel, Meals', 'codeclove-school-management') },
    { value: 'quarterly', label: __('Quarterly', 'codeclove-school-management') },
    { value: 'annual',    label: __('Annual    — Yearly fees', 'codeclove-school-management') },
    { value: 'custom',    label: __('Custom', 'codeclove-school-management') },
  ], [])

  const scopeOptions = useMemo(() => [
    { value: 'global',        label: __('Global — applies to all students', 'codeclove-school-management') },
    { value: 'unit_specific', label: __('Class-specific — use class-rate overrides below', 'codeclove-school-management') },
  ], [])

  // Single fetch — replaces useFeeTypes({ per_page: 999 })
  const { data: existing, isLoading: feeTypeLoading } = useFeeType(feeTypeId)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FeeTypeFormValues>({
    resolver: zodResolver(feeTypeSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      default_amount: '',
      frequency: 'one_time',
      scope: 'global',
      status: 'active',
    },
  })

  const frequencyValue = watch('frequency')
  const scopeValue = watch('scope')
  const statusValue = watch('status')

  // Pre-fill form once existing data loads.
  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        code: existing.code || '',
        description: existing.description || '',
        default_amount: (existing.default_amount_minor / 100).toString(),
        frequency: existing.frequency,
        scope: (existing as unknown as { scope?: FeeTypeFormValues['scope'] }).scope || 'global',
        status: existing.status,
      })
    }
  }, [existing, reset])

  const createMutation = useCreateFeeType()
  const updateMutation = useUpdateFeeType()
  const isPending = createMutation.isPending || updateMutation.isPending

  // Class rates (edit mode only)
  const { data: classRates = [] } = useClassRates(feeTypeId)
  const upsertRateMutation = useUpsertClassRate(feeTypeId)
  const deleteRateMutation = useDeleteClassRate(feeTypeId)
  const { data: unitsData } = useUnits({ per_page: 100 })
  const allUnits = unitsData?.data || []
  const [newRateUnit, setNewRateUnit] = useState('')
  const [newRateAmount, setNewRateAmount] = useState('')

  const handleAddRate = () => {
    const unitId = Number(newRateUnit)
    const amount = parseFloat(newRateAmount || '0')
    if (!unitId) { toast.error(__('Select a class/unit.', 'codeclove-school-management')); return }
    if (amount < 0) { toast.error(__('Amount cannot be negative.', 'codeclove-school-management')); return }
    upsertRateMutation.mutate({ academic_unit_id: unitId, amount }, {
      onSuccess: () => { setNewRateUnit(''); setNewRateAmount('') },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : ''
        toast.error(message || __('Failed to save rate.', 'codeclove-school-management'))
      },
    })
  }

  const onSubmit = (values: FeeTypeFormValues) => {
    const payload = {
      name: values.name.trim(),
      code: values.code ? values.code.trim().toUpperCase() : null,
      description: values.description ? values.description.trim() : null,
      default_amount_minor: Math.round(parseFloat(values.default_amount || '0') * 100),
      currency: baseCurrency,
      frequency: values.frequency,
      scope: values.scope,
      status: values.status,
    }

    if (isEdit && existing) {
      updateMutation.mutate(
        { id: existing.id, payload: payload as unknown as Parameters<typeof updateMutation.mutate>[0]['payload'] },
        {
          onSuccess: () => {
            toast.success(sprintf(__('%s updated.', 'codeclove-school-management'), feeTypeLabel))
            navigate('/finance/fee-types')
          },
          onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : ''
            toast.error(message || __('Update failed.', 'codeclove-school-management'))
          },
        }
      )
    } else {
      createMutation.mutate(payload as unknown as Parameters<typeof createMutation.mutate>[0], {
        onSuccess: () => {
          toast.success(sprintf(__('%s created.', 'codeclove-school-management'), feeTypeLabel))
          navigate('/finance/fee-types')
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : ''
          toast.error(message || __('Create failed.', 'codeclove-school-management'))
        },
      })
    }
  }

  if (isEdit && feeTypeLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (isEdit && !feeTypeLoading && !existing) {
    return (
      <EmptyState
        title={sprintf(__('%s not found', 'codeclove-school-management'), feeTypeLabel)}
        description={__('The fee type record you are trying to edit does not exist or has been deleted.', 'codeclove-school-management')}
        icon={Coins}
        action={
          <Button size="sm" onClick={() => navigate('/finance/fee-types')}>
            {__('Back to Fee Types', 'codeclove-school-management')}
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? sprintf(__('Edit %s', 'codeclove-school-management'), feeTypeLabel) : sprintf(__('New %s', 'codeclove-school-management'), feeTypeLabel)}
        description={
          isEdit
            ? sprintf(__('Update the template settings for "%s".', 'codeclove-school-management'), existing?.name)
            : __('Create a reusable fee template that can be applied to any invoice.', 'codeclove-school-management')
        }
        onBack={() => navigate('/finance/fee-types')}
        breadcrumbs={[
          { label: __('Finance', 'codeclove-school-management') },
          { label: __('Fee Types', 'codeclove-school-management'), href: '/finance/fee-types' },
          { label: isEdit ? (existing?.name ?? __('Edit', 'codeclove-school-management')) : sprintf(__('New %s', 'codeclove-school-management'), feeTypeLabel) },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/finance/fee-types')}
              disabled={isPending}
            >
              {__('Cancel', 'codeclove-school-management')}
            </Button>
            <Button size="sm" onClick={handleSubmit(onSubmit)} disabled={isPending}>
              {isPending ? __('Saving…', 'codeclove-school-management') : isEdit ? __('Save Changes', 'codeclove-school-management') : sprintf(__('Create %s', 'codeclove-school-management'), feeTypeLabel)}
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main Column ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Basic Details */}
          <Card>
            <CardContent className="py-6 space-y-5">
              <div className="space-y-4">
                <p className="text-xs font-semibold text-text uppercase tracking-wider pb-2 border-b border-border">{__('Basic Details', 'codeclove-school-management')}</p>
                <FormField label={__('Fee Name', 'codeclove-school-management')} error={errors.name?.message} required>
                  <Input
                    type="text"
                    placeholder={__('e.g. Tuition Fee, Transport Fee, Exam Fee', 'codeclove-school-management')}
                    {...register('name')}
                    autoFocus
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label={__('Unique Code', 'codeclove-school-management')}
                    error={errors.code?.message}
                    hint={__('Used in reports and bulk fee generation', 'codeclove-school-management')}
                  >
                    <Input
                      type="text"
                      placeholder={__('e.g. TUITION, TRANSPORT', 'codeclove-school-management')}
                      {...register('code')}
                    />
                  </FormField>

                  <FormField label={sprintf(__('Default Amount (%s)', 'codeclove-school-management'), baseCurrency)} error={errors.default_amount?.message}>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...register('default_amount')}
                    />
                  </FormField>
                </div>

                <FormField label={__('Description', 'codeclove-school-management')} error={errors.description?.message}>
                  <Textarea
                    rows={3}
                    placeholder={__('What charges are covered under this fee? (optional)', 'codeclove-school-management')}
                    {...register('description')}
                  />
                </FormField>
              </div>

              {/* Billing Settings */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-text uppercase tracking-wider pb-2 border-b border-border">{__('Billing Settings', 'codeclove-school-management')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label={__('Billing Frequency', 'codeclove-school-management')}
                    error={errors.frequency?.message}
                    hint={__('How often this fee recurs in a school year', 'codeclove-school-management')}
                  >
                    <Select
                      value={frequencyValue}
                      onValueChange={(val) => setValue('frequency', val as FeeTypeFormValues['frequency'], { shouldDirty: true })}
                      options={frequencyOptions}
                    />
                  </FormField>

                  <FormField label={__('Scope', 'codeclove-school-management')} error={errors.scope?.message} hint={__('Who this fee applies to', 'codeclove-school-management')}>
                    <Select
                      value={scopeValue}
                      onValueChange={(val) => setValue('scope', val as FeeTypeFormValues['scope'], { shouldDirty: true })}
                      options={scopeOptions}
                    />
                  </FormField>
                </div>

                <FormField label={__('Status', 'codeclove-school-management')} error={errors.status?.message}>
                  <Select
                    value={statusValue}
                    onValueChange={(val) => setValue('status', val as FeeTypeFormValues['status'], { shouldDirty: true })}
                    options={[
                      { value: 'active',   label: __('Active — available when building invoices', 'codeclove-school-management') },
                      { value: 'inactive', label: __('Inactive — hidden from invoice builder', 'codeclove-school-management') },
                    ]}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Class / Unit Rate Overrides — edit mode only */}
          {isEdit && existing && (
            <Card>
              <CardContent className="py-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-text uppercase tracking-wider">{__('Class / Unit Rate Overrides', 'codeclove-school-management')}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {__('Set a different amount per class or grade. Students are matched by their enrolled unit. If no override is set, the default amount above is used.', 'codeclove-school-management')}
                  </p>
                </div>

                {classRates.length === 0 ? (
                  <p className="text-xs text-text-muted italic">{__('No class overrides set — using default amount for all students.', 'codeclove-school-management')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {classRates.map(r => (
                      <div key={r.academic_unit_id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/30 last:border-0">
                        <Badge variant="default" className="truncate max-w-[140px]">{r.unit_name}</Badge>
                        <span className="font-semibold text-text flex-1 text-right mr-2">
                          {baseCurrency} {(r.amount_minor / 100).toFixed(2)}
                        </span>
                        <Button
                          type="button"
                          variant="danger" size="icon"
                          onClick={() => deleteRateMutation.mutate(r.academic_unit_id)}
                          disabled={deleteRateMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-border pt-4">
                  <p className="text-2xs text-text-muted font-semibold uppercase mb-2">{__('Add Override', 'codeclove-school-management')}</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Select
                        value={newRateUnit}
                        onValueChange={setNewRateUnit}
                        options={[
                          { value: '', label: __('— Select class —', 'codeclove-school-management') },
                          ...allUnits
                             .filter(u => !classRates.find(r => r.academic_unit_id === u.id))
                             .map(u => ({ value: String(u.id), label: u.name }))
                        ]}
                      />
                    </div>
                    <div className="w-36">
                      <Input
                        type="number" step="0.01" min="0"
                        placeholder={sprintf(__('Amount (%s)', 'codeclove-school-management'), baseCurrency)}
                        value={newRateAmount}
                        onChange={e => setNewRateAmount(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm" variant="secondary"
                      onClick={handleAddRate}
                      disabled={upsertRateMutation.isPending}
                    >
                      {upsertRateMutation.isPending ? __('Saving…', 'codeclove-school-management') : __('Add', 'codeclove-school-management')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Info card — same in both create and edit */}
          <Card>
            <CardContent className="py-5 space-y-3 text-xs text-text-muted">
              <p className="text-xs font-semibold text-text uppercase tracking-wider">{__('About Fee Types', 'codeclove-school-management')}</p>
              <p className="leading-relaxed">
                {__('Fee types are reusable templates. When you add a fee to an invoice, you pick a type and the default amount is auto-filled — you can adjust per invoice.', 'codeclove-school-management')}
              </p>
              <ul className="space-y-1.5 mt-2">
                <li className="flex items-start gap-1.5">
                  <span className="text-brand font-bold mt-0.5">·</span>
                  <span>{__('Set a ', 'codeclove-school-management')}<strong className="text-text">{__('Default Amount', 'codeclove-school-management')}</strong>{__(' for most students', 'codeclove-school-management')}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-brand font-bold mt-0.5">·</span>
                  <span>{__('Use ', 'codeclove-school-management')}<strong className="text-text">{__('Class Overrides', 'codeclove-school-management')}</strong>{__(' when fees differ by grade', 'codeclove-school-management')}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-brand font-bold mt-0.5">·</span>
                  <span>{__('Set ', 'codeclove-school-management')}<strong className="text-text">{__('Inactive', 'codeclove-school-management')}</strong>{__(' to hide from invoice builder without deleting', 'codeclove-school-management')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Metadata — edit only */}
          {isEdit && existing && (
            <Card>
              <CardContent className="py-5 space-y-2 text-xs text-text-muted">
                <p className="text-xs font-semibold text-text uppercase tracking-wider">{__('Fee Type Info', 'codeclove-school-management')}</p>
                <div className="flex justify-between pt-1">
                  <span>{__('ID', 'codeclove-school-management')}</span>
                  <span className="font-mono text-text">{existing.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>{__('Code', 'codeclove-school-management')}</span>
                  <span className="font-mono text-text">{existing.code || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>{__('Default Amount', 'codeclove-school-management')}</span>
                  <span className="font-semibold text-text">
                    {baseCurrency} {(existing.default_amount_minor / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{__('Overrides set', 'codeclove-school-management')}</span>
                  <span className="text-text">{classRates.length}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </form>
    </div>
  )
}
