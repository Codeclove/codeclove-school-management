/** Tab: Identifiers — settings section for auto-generated ID formats and reset rules per entity type */

import { useMemo } from 'react'
import { Hash } from 'lucide-react'
import type { UseFormRegister, Control, Path } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import type { CodeCloveSettings } from '@/api/settings'
import { FormGroupHeader, FormInput, FormSelect } from '../components/SettingsFormPrimitives'
import { Card } from '@/components/ui'
import { __ } from '@/lib/i18n'

type Register = UseFormRegister<CodeCloveSettings>

interface IdentifiersTabProps {
  register: Register
  control: Control<CodeCloveSettings>
}

export function IdentifiersTab({ register, control }: IdentifiersTabProps) {
  const reloadOptions = useMemo(() => [
    { value: 'none',   label: __( 'Never Reset (Continuous)', 'codeclove-school-management' ) },
    { value: 'yearly', label: __( 'Reset Yearly', 'codeclove-school-management' ) },
  ], [])

  const separatorOptions = useMemo(() => [
    { value: '',    label: __( 'None (Concatenated)', 'codeclove-school-management' ) },
    { value: '-',   label: __( 'Hyphen (-)', 'codeclove-school-management' ) },
    { value: '/',   label: __( 'Slash (/)', 'codeclove-school-management' ) },
    { value: '_',   label: __( 'Underscore (_)', 'codeclove-school-management' ) },
    { value: '.',   label: __( 'Dot (.)', 'codeclove-school-management' ) },
  ], [])

  // Keys must match the IdentifierSettings interface in api/settings.ts
  const idTypes = useMemo<Array<{ key: string; label: string }>>(() => [
    { key: 'student_number',        label: __( 'Student Number', 'codeclove-school-management' ) },
    { key: 'staff_member',          label: __( 'Staff Member ID', 'codeclove-school-management' ) },
    { key: 'admission_number',      label: __( 'Admission Number', 'codeclove-school-management' ) },
    { key: 'admission_application', label: __( 'Admission Application', 'codeclove-school-management' ) },
    { key: 'staff_application',     label: __( 'Staff Application', 'codeclove-school-management' ) },
    { key: 'roll_number',           label: __( 'Roll Number', 'codeclove-school-management' ) },
    { key: 'invoice_number',        label: __( 'Invoice Number', 'codeclove-school-management' ) },
    { key: 'payment_number',        label: __( 'Payment Number', 'codeclove-school-management' ) },
  ], [])

  // Watch active values of all identifiers configurations
  const formValues = useWatch({
    control,
    name: 'identifiers',
  })

  const year = new Date().getFullYear()

  // Dynamic preview generator based on active form state
  const getPreview = (key: string) => {
    const config = (formValues as unknown as Record<string, { prefix?: string; separator?: string; year_token?: string; sequence_padding?: number; next_number?: number } | undefined>)?.[key]
    if (!config) return '—'

    const prefix = config.prefix ?? ''
    const separator = config.separator ?? ''
    const yearToken = config.year_token ?? ''
    const padding = config.sequence_padding ?? 4
    const nextNum = config.next_number ?? 1

    const numStr = String(nextNum).padStart(Number(padding), '0')
    const yearStr = yearToken
      ? yearToken.replace('{YYYY}', String(year)).replace('{YY}', String(year).slice(-2))
      : ''

    // Match the backend IdentifierService filter logic
    const parts = [prefix, yearStr, numStr].filter(Boolean)
    return parts.join(separator)
  }

  return (
    <div className="space-y-6 w-full">
      <Card className="p-5 space-y-5">
        <FormGroupHeader
          title={__( 'ID Format Configuration', 'codeclove-school-management' )}
          description={__( 'Define prefix, separator, year token, starting number, padding, and reset rule for each auto-generated identifier.', 'codeclove-school-management' )}
          icon={Hash}
        />

        <div className="space-y-3">
          {idTypes.map(({ key, label }) => (
            <div
              key={key}
              className="border border-border rounded-lg p-4 bg-bg-surface/50"
            >
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
                {label}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <FormInput
                  label={__( 'Prefix', 'codeclove-school-management' )}
                  name={`identifiers.${key}.prefix` as Path<CodeCloveSettings>}
                  register={register}
                  placeholder={__( 'e.g. ADM', 'codeclove-school-management' )}
                />
                <FormSelect
                  label={__( 'Separator', 'codeclove-school-management' )}
                  name={`identifiers.${key}.separator` as Path<CodeCloveSettings>}
                  register={register}
                  options={separatorOptions}
                />
                <FormInput
                  label={__( 'Year Token', 'codeclove-school-management' )}
                  name={`identifiers.${key}.year_token` as Path<CodeCloveSettings>}
                  register={register}
                  placeholder={__( 'e.g. {YYYY}', 'codeclove-school-management' )}
                />
                <FormInput
                  label={__( 'Start Number', 'codeclove-school-management' )}
                  name={`identifiers.${key}.next_number` as Path<CodeCloveSettings>}
                  register={register}
                  type="number"
                  placeholder="1"
                />
                <FormInput
                  label={__( 'Seq. Padding', 'codeclove-school-management' )}
                  name={`identifiers.${key}.sequence_padding` as Path<CodeCloveSettings>}
                  register={register}
                  type="number"
                  placeholder="4"
                />
                <FormSelect
                  label={__( 'Reset Rule', 'codeclove-school-management' )}
                  name={`identifiers.${key}.reset_rule` as Path<CodeCloveSettings>}
                  register={register}
                  options={reloadOptions}
                />
              </div>

              {/* Reactive Live Preview Badge */}
              <div className="mt-3 flex items-center justify-between bg-bg-surface border border-border/60 rounded px-3 py-1.5 text-xs text-text-muted">
                <span className="font-medium text-text-subtle">{__( 'Generated ID Preview:', 'codeclove-school-management' )}</span>
                <span className="font-mono font-bold text-brand bg-brand-dim/30 px-2.5 py-0.5 rounded border border-brand/10 tracking-wider">
                  {getPreview(key)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
