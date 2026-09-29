/** Tab: Appearance — settings section for theme mode and UI density options */

import { Palette, Maximize2, Sun, Moon, Monitor } from 'lucide-react'
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import type { CodeCloveSettings, AppearanceSettings } from '@/api/settings'
import { FormGroup, FormGroupHeader, FormSelect } from '../components/SettingsFormPrimitives'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { __ } from '@/lib/i18n'

type Register = UseFormRegister<CodeCloveSettings>

const LAYOUT_OPTIONS = [
  { value: 'fluid', label: __( 'Fluid — full available width', 'codeclove-school-management' ) },
  { value: 'boxed', label: __( 'Boxed — constrained max width', 'codeclove-school-management' ) },
]

const SIDEBAR_DENSITY_OPTIONS = [
  { value: 'comfortable', label: __( 'Comfortable', 'codeclove-school-management' ) },
  { value: 'compact',     label: __( 'Compact', 'codeclove-school-management' )     },
]

const TABLE_DENSITY_OPTIONS = [
  { value: 'comfortable', label: __( 'Comfortable', 'codeclove-school-management' ) },
  { value: 'compact',     label: __( 'Compact', 'codeclove-school-management' )     },
]

const UI_SCALE_OPTIONS = [
  { value: '80%',  label: __( '80% — Compact', 'codeclove-school-management' ) },
  { value: '90%',  label: __( '90% — Dense', 'codeclove-school-management' ) },
  { value: '100%', label: __( '100% — Standard (Recommended)', 'codeclove-school-management' ) },
  { value: '110%', label: __( '110% — Large text', 'codeclove-school-management' ) },
  { value: '125%', label: __( '125% — High readability', 'codeclove-school-management' ) },
  { value: '150%', label: __( '150% — Maximum magnification', 'codeclove-school-management' ) },
]

const MODES = [
  { value: 'light' as const,  label: __( 'Light', 'codeclove-school-management' ),  icon: Sun },
  { value: 'dark' as const,   label: __( 'Dark', 'codeclove-school-management' ),   icon: Moon },
  { value: 'system' as const, label: __( 'System', 'codeclove-school-management' ), icon: Monitor },
]

const THEME_COLORS = [
  { value: 'classic_indigo' as const, label: __( 'Classic', 'codeclove-school-management' ),  hex: '#5e5bf2' },
  { value: 'sky_blue' as const,       label: __( 'Sky Blue', 'codeclove-school-management' ), hex: '#2269e3' },
  { value: 'sunset_orange' as const,  label: __( 'Sunset', 'codeclove-school-management' ),   hex: '#d64f1a' },
  { value: 'sunny_gold' as const,     label: __( 'Gold', 'codeclove-school-management' ),     hex: '#d98a00' },
  { value: 'fresh_mint' as const,     label: __( 'Mint', 'codeclove-school-management' ),     hex: '#158f49' },
  { value: 'playful_violet' as const, label: __( 'Violet', 'codeclove-school-management' ),   hex: '#8a3ffc' },
  { value: 'fun_pink' as const,       label: __( 'Pink', 'codeclove-school-management' ),     hex: '#d12377' },
]

interface AppearanceTabProps {
  register: Register
  setValue: UseFormSetValue<CodeCloveSettings>
  watch: UseFormWatch<CodeCloveSettings>
  setTheme: (theme: string) => void
}

export function AppearanceTab({ register, setValue, watch, setTheme }: AppearanceTabProps) {
  const currentMode = watch('appearance.mode') as string | undefined
  const currentColor = (watch('appearance.theme_color') as string | undefined) || 'classic_indigo'

  function handleModeChange(mode: AppearanceSettings['mode']) {
    setValue('appearance.mode', mode, { shouldDirty: true })
    setTheme(mode)
  }

  function handleColorChange(color: AppearanceSettings['theme_color']) {
    setValue('appearance.theme_color', color, { shouldDirty: true })
    document.documentElement.setAttribute('data-theme-color', color)
  }

  function handleScaleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const scale = e.target.value as NonNullable<AppearanceSettings['ui_scale']>
    setValue('appearance.ui_scale', scale, { shouldDirty: true })
    document.documentElement.style.setProperty('--codeclove-view-scale', scale)
    try { localStorage.setItem('codeclove:ui-scale', scale) } catch { /* storage blocked */ }
  }

  return (
    <div className="space-y-6">
      {/* Theme Mode */}
      <Card className="p-5 space-y-4">
        <FormGroupHeader
          title={__( 'Theme Mode', 'codeclove-school-management' )}
          description={__( 'Choose the colour scheme for the admin interface.', 'codeclove-school-management' )}
          icon={Palette}
        />

        <div className="flex gap-2 flex-wrap">
          {MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleModeChange(value)}
              className={cn(
                'flex-1 min-w-[90px] h-9 px-4 rounded-lg border text-sm font-medium transition-all duration-150',
                'flex items-center justify-center gap-2',
                currentMode === value
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border bg-bg-surface text-text-muted hover:border-border-strong hover:text-text',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Hidden form field keeps the value in RHF state */}
        <input type="hidden" {...register('appearance.mode')} />
      </Card>

      {/* Theme Accent Color */}
      <Card className="p-5 space-y-4">
        <FormGroupHeader
          title={__( 'Accent Color', 'codeclove-school-management' )}
          description={__( 'Choose the primary brand accent color for the school dashboard.', 'codeclove-school-management' )}
          icon={Palette}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {THEME_COLORS.map(({ value, label, hex }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleColorChange(value)}
              className={cn(
                'flex flex-col items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all duration-150',
                currentColor === value
                  ? 'border-brand bg-brand/5 ring-1 ring-brand'
                  : 'border-border bg-bg-surface hover:border-border-strong text-text-muted hover:text-text',
              )}
            >
              <span
                className="h-6 w-6 rounded-full border border-black/10 shrink-0"
                style={{ backgroundColor: hex }}
              />
              <span className="text-xs truncate max-w-full">{label}</span>
            </button>
          ))}
        </div>

        {/* Hidden form field keeps the value in RHF state */}
        <input type="hidden" {...register('appearance.theme_color')} />
      </Card>

      {/* Density & Display Scale */}
      <FormGroup
        title={__( 'Density & Display Scale', 'codeclove-school-management' )}
        description={__( 'Control the spacing, density, and magnification of UI elements.', 'codeclove-school-management' )}
        icon={Maximize2}
      >
        <FormSelect
          label={__( 'Layout Density', 'codeclove-school-management' )}
          name="appearance.layout"
          register={register}
          options={LAYOUT_OPTIONS}
        />
        <FormSelect
          label={__( 'Sidebar Density', 'codeclove-school-management' )}
          name="appearance.sidebar_density"
          register={register}
          options={SIDEBAR_DENSITY_OPTIONS}
        />
        <FormSelect
          label={__( 'Table Density', 'codeclove-school-management' )}
          name="appearance.table_density"
          register={register}
          options={TABLE_DENSITY_OPTIONS}
        />
        <FormSelect
          label={__( 'Display Scale', 'codeclove-school-management' )}
          name="appearance.ui_scale"
          register={register}
          options={UI_SCALE_OPTIONS}
          onChange={handleScaleChange}
        />
      </FormGroup>
    </div>
  )
}
