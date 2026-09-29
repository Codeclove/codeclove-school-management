/** Tab: Localization — settings section for language, calendar, datetime formatting, and currency */

import { useMemo } from 'react'
import { Globe, Calendar, DollarSign } from 'lucide-react'
import type { UseFormRegister, Control } from 'react-hook-form'
import type { CodeCloveSettings } from '@/api/settings'
import {
  FormGroup,
  FormInput,
  FormSelect,
  FormCheckbox,
} from '../components/SettingsFormPrimitives'
import { __ } from '@/lib/i18n'

type Register = UseFormRegister<CodeCloveSettings>

interface LocalizationTabProps {
  register: Register
  control: Control<CodeCloveSettings>
}

export function LocalizationTab({ register, control }: LocalizationTabProps) {
  const languages = useMemo(() => [
    { value: 'en',    label: __( 'English', 'codeclove-school-management' ) },
    { value: 'ar',    label: __( 'Arabic', 'codeclove-school-management' ) },
    { value: 'fr',    label: __( 'French', 'codeclove-school-management' ) },
    { value: 'es',    label: __( 'Spanish', 'codeclove-school-management' ) },
    { value: 'pt',    label: __( 'Portuguese', 'codeclove-school-management' ) },
    { value: 'sw',    label: __( 'Swahili', 'codeclove-school-management' ) },
    { value: 'hi',    label: __( 'Hindi', 'codeclove-school-management' ) },
    { value: 'bn',    label: __( 'Bengali', 'codeclove-school-management' ) },
    { value: 'ur',    label: __( 'Urdu', 'codeclove-school-management' ) },
    { value: 'zh_CN', label: __( 'Chinese (Simplified)', 'codeclove-school-management' ) },
  ], [])

  const dates = useMemo(() => [
    { value: 'd/m/Y', label: __( 'DD/MM/YYYY  (e.g. 19/06/2026)', 'codeclove-school-management' ) },
    { value: 'm/d/Y', label: __( 'MM/DD/YYYY  (e.g. 06/19/2026)', 'codeclove-school-management' ) },
    { value: 'Y-m-d', label: __( 'YYYY-MM-DD  (e.g. 2026-06-19)', 'codeclove-school-management' ) },
    { value: 'd-m-Y', label: __( 'DD-MM-YYYY  (e.g. 19-06-2026)', 'codeclove-school-management' ) },
    { value: 'm-d-Y', label: __( 'MM-DD-YYYY  (e.g. 06-19-2026)', 'codeclove-school-management' ) },
    { value: 'F j, Y', label: __( 'Month DD, YYYY  (e.g. June 19, 2026)', 'codeclove-school-management' ) },
    { value: 'j F Y', label: __( 'DD Month YYYY  (e.g. 19 June 2026)', 'codeclove-school-management' ) },
    { value: 'D, M j, Y', label: __( 'Day, Month DD, YYYY  (e.g. Fri, Jun 19, 2026)', 'codeclove-school-management' ) },
  ], [])

  const times = useMemo(() => [
    { value: 'H:i',     label: __( '24-hour  (e.g. 14:30)', 'codeclove-school-management' ) },
    { value: 'H:i:s',   label: __( '24-hour with seconds  (e.g. 14:30:15)', 'codeclove-school-management' ) },
    { value: 'h:i A',   label: __( '12-hour uppercase  (e.g. 02:30 PM)', 'codeclove-school-management' ) },
    { value: 'h:i a',   label: __( '12-hour lowercase  (e.g. 02:30 pm)', 'codeclove-school-management' ) },
    { value: 'h:i:s A', label: __( '12-hour with seconds uppercase  (e.g. 02:30:15 PM)', 'codeclove-school-management' ) },
    { value: 'g:i A',   label: __( '12-hour without leading zero  (e.g. 2:30 PM)', 'codeclove-school-management' ) },
  ], [])

  const weekDays = useMemo(() => [
    { value: '0', label: __( 'Sunday', 'codeclove-school-management' ) },
    { value: '1', label: __( 'Monday', 'codeclove-school-management' ) },
    { value: '6', label: __( 'Saturday', 'codeclove-school-management' ) },
  ], [])

  const currencies = useMemo(() => [
    { value: 'USD', label: __( 'USD — US Dollar', 'codeclove-school-management' ) },
    { value: 'EUR', label: __( 'EUR — Euro', 'codeclove-school-management' ) },
    { value: 'GBP', label: __( 'GBP — British Pound', 'codeclove-school-management' ) },
    { value: 'INR', label: __( 'INR — Indian Rupee', 'codeclove-school-management' ) },
    { value: 'NGN', label: __( 'NGN — Nigerian Naira', 'codeclove-school-management' ) },
    { value: 'KES', label: __( 'KES — Kenyan Shilling', 'codeclove-school-management' ) },
    { value: 'GHS', label: __( 'GHS — Ghanaian Cedi', 'codeclove-school-management' ) },
    { value: 'ZAR', label: __( 'ZAR — South African Rand', 'codeclove-school-management' ) },
    { value: 'PKR', label: __( 'PKR — Pakistani Rupee', 'codeclove-school-management' ) },
    { value: 'BDT', label: __( 'BDT — Bangladeshi Taka', 'codeclove-school-management' ) },
    { value: 'AED', label: __( 'AED — UAE Dirham', 'codeclove-school-management' ) },
    { value: 'SAR', label: __( 'SAR — Saudi Riyal', 'codeclove-school-management' ) },
  ], [])

  const currencyPositions = useMemo(() => [
    { value: 'left',        label: __( 'Left — $1,000', 'codeclove-school-management' ) },
    { value: 'right',       label: __( 'Right — 1,000$', 'codeclove-school-management' ) },
    { value: 'left_space',  label: __( 'Left with space — $ 1,000', 'codeclove-school-management' ) },
    { value: 'right_space', label: __( 'Right with space — 1,000 $', 'codeclove-school-management' ) },
  ], [])

  const numberFormats = useMemo(() => [
    { value: 'standard', label: __( '1,000.00  (standard — comma thousands, dot decimal)', 'codeclove-school-management' ) },
    { value: 'indian',   label: __( '1,00,000.00  (Indian grouping system)', 'codeclove-school-management' ) },
  ], [])

  return (
    <div className="space-y-6">
      {/* Language & Calendar */}
      <FormGroup
        title={__( 'Language & Calendar', 'codeclove-school-management' )}
        description={__( 'Regional language, timezone, and calendar week configuration.', 'codeclove-school-management' )}
        icon={Globe}
      >
        <FormSelect
          label={__( 'Interface Language', 'codeclove-school-management' )}
          name="localization.language"
          register={register}
          options={languages}
        />
        <FormInput
          label={__( 'Timezone', 'codeclove-school-management' )}
          name="localization.timezone"
          register={register}
          placeholder={__( 'e.g. Africa/Lagos', 'codeclove-school-management' )}
        />
        <FormSelect
          label={__( 'Week Start Day', 'codeclove-school-management' )}
          name="localization.week_start_day"
          register={register}
          options={weekDays}
        />
        <div className="col-span-full">
          <FormCheckbox
            label={__( 'Right-to-Left (RTL) Layout', 'codeclove-school-management' )}
            name="localization.rtl"
            control={control}
            description={__( 'Enable RTL text direction for Arabic, Urdu, and similar languages.', 'codeclove-school-management' )}
          />
        </div>
      </FormGroup>

      {/* Datetime Formatting */}
      <FormGroup
        title={__( 'Datetime Formatting', 'codeclove-school-management' )}
        description={__( 'Choose how dates and times are displayed across the platform.', 'codeclove-school-management' )}
        icon={Calendar}
      >
        <FormSelect
          label={__( 'Date Format', 'codeclove-school-management' )}
          name="localization.date_format"
          register={register}
          options={dates}
        />
        <FormSelect
          label={__( 'Time Format', 'codeclove-school-management' )}
          name="localization.time_format"
          register={register}
          options={times}
        />
      </FormGroup>

      {/* Currency & Numbers */}
      <FormGroup
        title={__( 'Currency & Numbers', 'codeclove-school-management' )}
        description={__( 'Configure monetary display and numeric formatting.', 'codeclove-school-management' )}
        icon={DollarSign}
      >
        <FormSelect
          label={__( 'Currency', 'codeclove-school-management' )}
          name="localization.currency"
          register={register}
          options={currencies}
        />
        <FormSelect
          label={__( 'Currency Symbol Position', 'codeclove-school-management' )}
          name="localization.currency_position"
          register={register}
          options={currencyPositions}
        />
        <FormInput
          label={__( 'Decimal Precision', 'codeclove-school-management' )}
          name="localization.decimal_precision"
          register={register}
          type="number"
          placeholder={__( '2', 'codeclove-school-management' )}
        />
        <FormSelect
          label={__( 'Number Format', 'codeclove-school-management' )}
          name="localization.number_format"
          register={register}
          options={numberFormats}
        />
      </FormGroup>
    </div>
  )
}
