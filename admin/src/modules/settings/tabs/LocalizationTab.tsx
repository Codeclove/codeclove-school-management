/** Tab: Localization — settings section for language, calendar, datetime formatting, and currency */

import { useMemo } from 'react'
import { Globe, Calendar, DollarSign, ExternalLink, Clock, Languages, CheckCircle2 } from 'lucide-react'
import type { UseFormRegister, Control } from 'react-hook-form'
import type { CodeCloveSettings } from '@/api/settings'
import {
  FormGroup,
  FormSelect,
  FormCheckbox,
} from '../components/SettingsFormPrimitives'
import { __ } from '@/lib/i18n'

type Register = UseFormRegister<CodeCloveSettings>

interface LocalizationTabProps {
  register: Register
  control: Control<CodeCloveSettings>
}

// ponytail: static options declared once at module scope — no hooks needed
const CURRENCIES = [
  { value: 'USD', label: 'USD — United States Dollar ($)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'GBP', label: 'GBP — British Pound (£)' },
  { value: 'INR', label: 'INR — Indian Rupee (₹)' },
  { value: 'CAD', label: 'CAD — Canadian Dollar ($)' },
  { value: 'AUD', label: 'AUD — Australian Dollar ($)' },
  { value: 'NGN', label: 'NGN — Nigerian Naira (₦)' },
  { value: 'KES', label: 'KES — Kenyan Shilling (KSh)' },
  { value: 'GHS', label: 'GHS — Ghanaian Cedi (GH₵)' },
  { value: 'ZAR', label: 'ZAR — South African Rand (R)' },
  { value: 'PKR', label: 'PKR — Pakistani Rupee (₨)' },
  { value: 'BDT', label: 'BDT — Bangladeshi Taka (৳)' },
  { value: 'AED', label: 'AED — UAE Dirham (د.إ)' },
  { value: 'SAR', label: 'SAR — Saudi Riyal (﷼)' },
]

const CURRENCY_POSITIONS = [
  { value: 'left', label: 'Left ($100)' },
  { value: 'right', label: 'Right (100$)' },
  { value: 'left_space', label: 'Left with space ($ 100)' },
  { value: 'right_space', label: 'Right with space (100 $)' },
]

const DECIMAL_PRECISIONS = [
  { value: '0', label: '0 decimals ($100)' },
  { value: '2', label: '2 decimals ($100.00)' },
]

const NUMBER_FORMATS = [
  { value: 'standard', label: 'Standard (1,234.56)' },
  { value: 'european', label: 'European (1.234,56)' },
  { value: 'indian', label: 'Indian / Lakhs (1,23,456.78)' },
]

export function LocalizationTab({ register, control }: LocalizationTabProps) {
  const wpSettings = window.CodeCloveConfig?.wpSettings
  const wpTimezone = wpSettings?.timezone || 'UTC'
  const wpCurrentTime = wpSettings?.currentTime || ''
  const wpLocale = wpSettings?.locale || 'en_US'
  const wpLocaleName = wpSettings?.localeName || ('en_US' === wpLocale ? 'English (United States)' : wpLocale)
  const wpStartOfWeek = wpSettings?.startOfWeek ?? 1
  const wpDateFormat = wpSettings?.dateFormat || 'd/m/Y'
  const wpTimeFormat = wpSettings?.timeFormat || 'H:i'
  const wpGeneralUrl = wpSettings?.generalSettingsUrl || '/wp-admin/options-general.php'

  const weekDays = useMemo(() => [
    { value: '0', label: `${__( 'Sunday', 'codeclove-school-management' )}${wpStartOfWeek === 0 ? ' (WP Default)' : ''}` },
    { value: '1', label: `${__( 'Monday', 'codeclove-school-management' )}${wpStartOfWeek === 1 ? ' (WP Default)' : ''}` },
    { value: '2', label: `${__( 'Tuesday', 'codeclove-school-management' )}${wpStartOfWeek === 2 ? ' (WP Default)' : ''}` },
    { value: '3', label: `${__( 'Wednesday', 'codeclove-school-management' )}${wpStartOfWeek === 3 ? ' (WP Default)' : ''}` },
    { value: '4', label: `${__( 'Thursday', 'codeclove-school-management' )}${wpStartOfWeek === 4 ? ' (WP Default)' : ''}` },
    { value: '5', label: `${__( 'Friday', 'codeclove-school-management' )}${wpStartOfWeek === 5 ? ' (WP Default)' : ''}` },
    { value: '6', label: `${__( 'Saturday', 'codeclove-school-management' )}${wpStartOfWeek === 6 ? ' (WP Default)' : ''}` },
  ], [wpStartOfWeek])

  const dateFormats = useMemo(() => [
    { value: 'd/m/Y', label: `DD/MM/YYYY (19/06/2026)${wpDateFormat === 'd/m/Y' ? ' (WP Default)' : ''}` },
    { value: 'm/d/Y', label: `MM/DD/YYYY (06/19/2026)${wpDateFormat === 'm/d/Y' ? ' (WP Default)' : ''}` },
    { value: 'Y-m-d', label: `YYYY-MM-DD (2026-06-19)${wpDateFormat === 'Y-m-d' ? ' (WP Default)' : ''}` },
    { value: 'F j, Y', label: `Month DD, YYYY (June 19, 2026)${wpDateFormat === 'F j, Y' ? ' (WP Default)' : ''}` },
    { value: 'j F Y', label: `DD Month YYYY (19 June 2026)${wpDateFormat === 'j F Y' ? ' (WP Default)' : ''}` },
    { value: 'D, M j, Y', label: `Day, Month DD, YYYY (Fri, Jun 19, 2026)${wpDateFormat === 'D, M j, Y' ? ' (WP Default)' : ''}` },
  ], [wpDateFormat])

  const timeFormats = useMemo(() => [
    { value: 'H:i', label: `24-hour (14:30)${wpTimeFormat === 'H:i' ? ' (WP Default)' : ''}` },
    { value: 'h:i A', label: `12-hour uppercase (02:30 PM)${wpTimeFormat === 'h:i A' || wpTimeFormat === 'g:i a' ? ' (WP Default)' : ''}` },
    { value: 'h:i a', label: '12-hour lowercase (02:30 pm)' },
  ], [wpTimeFormat])

  const wpStatusCards = [
    {
      icon: Languages,
      title: __( 'Site Language', 'codeclove-school-management' ),
      value: wpLocaleName,
      badge: __( 'Active', 'codeclove-school-management' ),
      detail: <span>{__( 'Locale Code:', 'codeclove-school-management' )} <code className="font-mono text-text text-[11px] bg-bg-elevated px-1 py-0.5 rounded">{wpLocale}</code></span>,
    },
    {
      icon: Clock,
      title: __( 'Timezone', 'codeclove-school-management' ),
      value: wpTimezone,
      badge: __( 'Synced', 'codeclove-school-management' ),
      detail: <span>{wpCurrentTime ? `${__( 'Local Time:', 'codeclove-school-management' )} ${wpCurrentTime}` : __( 'WordPress Timezone', 'codeclove-school-management' )}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Hidden inputs to preserve API compatibility */}
      <input type="hidden" {...register('localization.language')} value="site_default" />
      <input type="hidden" {...register('localization.timezone')} value={wpTimezone} />

      {/* Language & Timezone (Inherited from WordPress) */}
      <FormGroup
        title={__( 'Language & Timezone', 'codeclove-school-management' )}
        description={__( 'Inherited automatically from your WordPress core settings.', 'codeclove-school-management' )}
        icon={Globe}
      >
        <div className="col-span-full space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {wpStatusCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.title} className="p-3.5 rounded-lg bg-bg-surface border border-border/80 flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-brand/10 text-brand flex items-center justify-center shrink-0">
                        <Icon size={16} />
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider block">
                          {card.title}
                        </span>
                        <span className="text-sm font-semibold text-text">
                          {card.value}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success border border-success/20">
                      <CheckCircle2 size={10} />
                      {card.badge}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted flex items-center justify-between pt-1 border-t border-border/50">
                    {card.detail}
                    <span className="text-[11px] text-text-subtle">{__( 'From WordPress', 'codeclove-school-management' )}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-bg-elevated/60 border border-border/70 text-xs text-text-muted">
            <p className="leading-relaxed">
              {__( 'To change your school language or timezone, update your WordPress General Settings.', 'codeclove-school-management' )}
            </p>
            <a
              href={wpGeneralUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-strong hover:underline shrink-0"
            >
              <span>{__( 'WordPress General Settings', 'codeclove-school-management' )}</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="pt-2">
            <FormCheckbox
              label={__( 'Right-to-Left (RTL) Layout', 'codeclove-school-management' )}
              name="localization.rtl"
              control={control}
              description={__( 'Enable right-to-left UI direction for Arabic, Hebrew, Urdu, or Persian scripts.', 'codeclove-school-management' )}
            />
          </div>
        </div>
      </FormGroup>

      {/* Datetime & Calendar */}
      <FormGroup
        title={__( 'Datetime & Calendar', 'codeclove-school-management' )}
        description={__( 'Choose how dates, times, and school calendar weeks are displayed across the dashboard.', 'codeclove-school-management' )}
        icon={Calendar}
      >
        <FormSelect
          label={__( 'Week Start Day', 'codeclove-school-management' )}
          name="localization.week_start_day"
          register={register}
          options={weekDays}
        />
        <FormSelect
          label={__( 'Date Format', 'codeclove-school-management' )}
          name="localization.date_format"
          register={register}
          options={dateFormats}
        />
        <FormSelect
          label={__( 'Time Format', 'codeclove-school-management' )}
          name="localization.time_format"
          register={register}
          options={timeFormats}
        />
      </FormGroup>

      {/* Currency & Numbers */}
      <FormGroup
        title={__( 'Currency & Numbers', 'codeclove-school-management' )}
        description={__( 'Formatting rules for fee structures, invoices, payment receipts, and reports.', 'codeclove-school-management' )}
        icon={DollarSign}
      >
        <FormSelect
          label={__( 'Default Currency', 'codeclove-school-management' )}
          name="localization.currency"
          register={register}
          options={CURRENCIES}
        />
        <FormSelect
          label={__( 'Currency Position', 'codeclove-school-management' )}
          name="localization.currency_position"
          register={register}
          options={CURRENCY_POSITIONS}
        />
        <FormSelect
          label={__( 'Decimal Precision', 'codeclove-school-management' )}
          name="localization.decimal_precision"
          register={register}
          options={DECIMAL_PRECISIONS}
        />
        <FormSelect
          label={__( 'Number Format', 'codeclove-school-management' )}
          name="localization.number_format"
          register={register}
          options={NUMBER_FORMATS}
        />
      </FormGroup>
    </div>
  )
}
