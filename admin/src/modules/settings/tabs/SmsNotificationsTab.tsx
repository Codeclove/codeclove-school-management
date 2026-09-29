/** Tab: SMS Notifications — settings section for SMS delivery, gateways, and templates */

import { useState, useCallback, useMemo } from 'react'
import { Eye, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Smartphone, MessageSquare, Check } from 'lucide-react'
import type { UseFormRegister, Control, UseFormWatch, Path } from 'react-hook-form'
import type { CodeCloveSettings } from '@/api/settings'
import { useSendTestSms } from '@/api/settings'
import { FormGroup, FormInput, FormSelect, FormCheckbox } from '../components/SettingsFormPrimitives'
import { Button, Card, Spinner } from '@/components/ui'
import { cn } from '@/lib/utils'
import { __, _n, sprintf } from '@/lib/i18n'

type Register = UseFormRegister<CodeCloveSettings>

interface SmsNotificationsTabProps {
  register: Register
  control: Control<CodeCloveSettings>
  watch: UseFormWatch<CodeCloveSettings>
}

interface FormTextareaProps {
  label: string
  name: Path<CodeCloveSettings>
  register: Register
  placeholder?: string
  className?: string
  rows?: number
}

function FormTextarea({
  label,
  name,
  register,
  placeholder,
  className,
  rows = 3,
}: FormTextareaProps) {
  return (
    <div className="space-y-1 col-span-full">
      <label className="text-xs font-semibold text-text-muted">{label}</label>
      <textarea
        placeholder={placeholder}
        rows={rows}
        {...register(name)}
        className={cn(
          'w-full p-3 rounded border border-border bg-bg-surface text-sm text-text transition-colors duration-100',
          'placeholder:text-text-subtle',
          'hover:border-border-strong',
          'focus:outline-none focus:ring-1 focus:ring-brand-ring focus:border-brand',
          className
        )}
      />
    </div>
  )
}

export function SmsNotificationsTab({ register, control, watch }: SmsNotificationsTabProps) {
  const smsEnabled = watch('notifications.sms_enabled') as boolean | undefined
  const smsProvider = watch('notifications.sms_provider') as string | undefined
  const [openSmsTemplate, setOpenSmsTemplate] = useState<string | null>(null)
  const [copiedPh, setCopiedPh] = useState<string | null>(null)

  const smsProviderOptions = useMemo(() => [
    { value: 'none',     label: __( 'Disabled', 'codeclove-school-management' ) },
    { value: 'twilio',   label: __( 'Twilio (Global)', 'codeclove-school-management' ) },
    { value: 'msg91',    label: __( 'MSG91 (India)', 'codeclove-school-management' ) },
    { value: 'fast2sms', label: __( 'Fast2SMS (India Budget)', 'codeclove-school-management' ) },
    { value: 'vonage',   label: __( 'Vonage (Global)', 'codeclove-school-management' ) },
  ], [])

  const templateInfo = useMemo(() => [
    {
      key: 'admission_received',
      title: __( 'New Admission Application Received', 'codeclove-school-management' ),
      desc: __( 'Alert sent when a new application is submitted online.', 'codeclove-school-management' ),
      placeholders: ['{school_name}', '{school_email}', '{student_name}', '{reference_number}', '{guardian_name}'],
    },
    {
      key: 'admission_status_changed',
      title: __( 'Admission Application Status Changed', 'codeclove-school-management' ),
      desc: __( 'Sent to the applicant guardian when their admissions pipeline status is updated.', 'codeclove-school-management' ),
      placeholders: ['{school_name}', '{school_email}', '{student_name}', '{guardian_name}', '{reference_number}', '{status}'],
    },
    {
      key: 'payment_recorded',
      title: __( 'Payment Recorded Receipt', 'codeclove-school-management' ),
      desc: __( 'Sent to the guardian as an electronic receipt when a fee payment is recorded.', 'codeclove-school-management' ),
      placeholders: ['{school_name}', '{school_email}', '{invoice_number}', '{amount}', '{balance}', '{guardian_name}'],
    },
    {
      key: 'attendance_alert',
      title: __( 'Attendance Alert Notification', 'codeclove-school-management' ),
      desc: __( 'Sent to the guardian when a student is marked absent or other statuses.', 'codeclove-school-management' ),
      placeholders: ['{school_name}', '{school_email}', '{student_name}', '{guardian_name}', '{status}', '{date}'],
    },
    {
      key: 'fee_reminder',
      title: __( 'Fee Payment Reminder', 'codeclove-school-management' ),
      desc: __( 'Sent to the guardian when outstanding fee payment reminders are sent.', 'codeclove-school-management' ),
      placeholders: ['{school_name}', '{school_email}', '{invoice_number}', '{amount}', '{due_date}', '{balance}', '{guardian_name}'],
    },
    {
      key: 'invoice_issued',
      title: __( 'New Invoice Issued', 'codeclove-school-management' ),
      desc: __( 'New invoice notice sent immediately to the guardian.', 'codeclove-school-management' ),
      placeholders: ['{school_name}', '{school_email}', '{invoice_number}', '{amount}', '{due_date}', '{guardian_name}'],
    },
    {
      key: 'invoice_overdue',
      title: __( 'Overdue Fee Notice', 'codeclove-school-management' ),
      desc: __( 'Overdue notice sent to the guardian when a bill passes its due date.', 'codeclove-school-management' ),
      placeholders: ['{school_name}', '{school_email}', '{invoice_number}', '{balance}', '{due_date}', '{guardian_name}'],
    },
    {
      key: 'payment_reversed',
      title: __( 'Payment Cancelled / Reversed', 'codeclove-school-management' ),
      desc: __( 'Sent to the guardian when a payment receipt is cancelled or refunded.', 'codeclove-school-management' ),
      placeholders: ['{school_name}', '{school_email}', '{payment_number}', '{amount}', '{invoice_number}', '{guardian_name}'],
    },
  ], [])

  const copyPlaceholder = useCallback((ph: string) => {
    const done = () => { setCopiedPh(ph); setTimeout(() => setCopiedPh(null), 1500) }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(ph).then(done)
    } else {
      const el = document.createElement('textarea')
      el.value = ph
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      done()
    }
  }, [])

  // Test SMS state
  const [testPhone, setTestPhone] = useState('')
  const [testSmsResult, setTestSmsResult] = useState<{ success: boolean; msg: string } | null>(null)
  const sendTestSms = useSendTestSms()

  async function handleSendTestSms() {
    const phone = testPhone.trim()
    if (!phone) {
      setTestSmsResult({ success: false, msg: __( 'Please enter a valid phone number.', 'codeclove-school-management' ) })
      return
    }

    setTestSmsResult(null)
    try {
      const success = await sendTestSms.mutateAsync({ phone })
      if (success) {
        setTestSmsResult({ success: true, msg: __( 'Test SMS successfully sent!', 'codeclove-school-management' ) })
      } else {
        setTestSmsResult({ success: false, msg: __( 'SMS gateway accepted the payload but returned failure status.', 'codeclove-school-management' ) })
      }
    } catch (err: unknown) {
      const responseMsg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined
      const fallbackMsg = err instanceof Error ? err.message : __( 'Error executing SMS test request.', 'codeclove-school-management' )
      setTestSmsResult({
        success: false,
        msg: responseMsg || fallbackMsg,
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* SMS Notifications Section */}
      <FormGroup
        title={__( 'SMS Delivery Configuration', 'codeclove-school-management' )}
        description={__( 'Configure SMS delivery options and API credentials.', 'codeclove-school-management' )}
        icon={Smartphone}
        cols={2}
      >
        <div className="col-span-full">
          <FormCheckbox
            label={__( 'Enable SMS Notifications', 'codeclove-school-management' )}
            name="notifications.sms_enabled"
            control={control}
            description={__( 'Allows CodeClove to send real-time text message alerts to guardians.', 'codeclove-school-management' )}
          />
        </div>

        {smsEnabled && (
          <>
            <FormSelect
              label={__( 'SMS Provider', 'codeclove-school-management' )}
              name="notifications.sms_provider"
              register={register}
              options={smsProviderOptions}
              fullWidth
            />

            {smsProvider === 'twilio' && (
              <>
                <FormInput
                  label={__( 'Twilio Account SID', 'codeclove-school-management' )}
                  name="notifications.twilio_account_sid"
                  register={register}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
                <FormInput
                  label={__( 'Twilio Auth Token', 'codeclove-school-management' )}
                  name="notifications.twilio_auth_token"
                  register={register}
                  type="password"
                  placeholder={__( 'Twilio account auth token', 'codeclove-school-management' )}
                />
                <FormInput
                  label={__( 'Twilio From Number', 'codeclove-school-management' )}
                  name="notifications.twilio_from_number"
                  register={register}
                  placeholder={__( 'e.g. +15017122661', 'codeclove-school-management' )}
                />
              </>
            )}

            {smsProvider === 'msg91' && (
              <>
                <FormInput
                  label={__( 'MSG91 Auth Key', 'codeclove-school-management' )}
                  name="notifications.msg91_auth_key"
                  register={register}
                  type="password"
                  placeholder={__( 'MSG91 authentication key', 'codeclove-school-management' )}
                />
                <FormInput
                  label={__( 'MSG91 Sender ID', 'codeclove-school-management' )}
                  name="notifications.msg91_sender_id"
                  register={register}
                  placeholder={__( 'e.g. SCHSMS', 'codeclove-school-management' )}
                />
                <div className="col-span-full bg-blue-500/10 border border-blue-500/20 text-blue-500 p-3 rounded-lg text-xs leading-normal flex items-start gap-3">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <span className="font-semibold">{__( 'India TRAI DLT Mandate', 'codeclove-school-management' )}</span>
                    <p className="opacity-90">
                      {__( 'Indian law requires registering sender headers (Sender IDs) and templates on the TRAI DLT portal before sending commercial SMS. Ensure your MSG91 templates align precisely.', 'codeclove-school-management' )}
                    </p>
                  </div>
                </div>
              </>
            )}

            {smsProvider === 'fast2sms' && (
              <>
                <FormInput
                  label={__( 'Fast2SMS API Key', 'codeclove-school-management' )}
                  name="notifications.fast2sms_api_key"
                  register={register}
                  type="password"
                  placeholder={__( 'Fast2SMS API authorization key', 'codeclove-school-management' )}
                />
              </>
            )}

            {smsProvider === 'vonage' && (
              <>
                <FormInput
                  label={__( 'Vonage API Key', 'codeclove-school-management' )}
                  name="notifications.vonage_api_key"
                  register={register}
                  placeholder={__( 'Vonage key identifier', 'codeclove-school-management' )}
                />
                <FormInput
                  label={__( 'Vonage API Secret', 'codeclove-school-management' )}
                  name="notifications.vonage_api_secret"
                  register={register}
                  type="password"
                  placeholder={__( 'Vonage account API secret', 'codeclove-school-management' )}
                />
                <FormInput
                  label={__( 'Vonage From (Sender Name)', 'codeclove-school-management' )}
                  name="notifications.vonage_from"
                  register={register}
                  placeholder={__( 'e.g. SchoolName', 'codeclove-school-management' )}
                />
              </>
            )}
          </>
        )}
      </FormGroup>

      {/* SMS Connection Test Diagnostics */}
      {smsEnabled && smsProvider && smsProvider !== 'none' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-start gap-3 border-b border-border pb-4">
            <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center text-brand flex-shrink-0">
              <Eye size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text leading-tight">{__( 'SMS Connection Test', 'codeclove-school-management' )}</h3>
              <p className="text-2xs text-text-muted mt-1 leading-normal">
                {__( 'Send a real-time diagnostic test SMS to verify your delivery settings. Save settings before running.', 'codeclove-school-management' )}
              </p>
            </div>
          </div>
          
          <div className="space-y-4 pt-1">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder={__( 'e.g. +15017122661 or +919999999999', 'codeclove-school-management' )}
                className={cn(
                  'flex-1 h-8 px-3 rounded border border-border bg-bg-surface text-sm text-text transition-colors duration-100',
                  'placeholder:text-text-subtle hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-brand-ring focus:border-brand'
                )}
              />
              <Button
                type="button"
                onClick={handleSendTestSms}
                disabled={sendTestSms.isPending}
                className="h-8 px-4"
              >
                {sendTestSms.isPending ? (
                  <>
                    <Spinner size="sm" className="me-2" /> {__( 'Sending...', 'codeclove-school-management' )}
                  </>
                ) : (
                  __( 'Send Test SMS', 'codeclove-school-management' )
                )}
              </Button>
            </div>

            {testSmsResult && (
              <div
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg text-xs leading-normal',
                  testSmsResult.success
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                    : 'bg-danger-dim border border-danger/20 text-danger'
                )}
              >
                {testSmsResult.success ? (
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                )}
                <div className="space-y-1">
                  <span className="font-semibold">
                    {testSmsResult.success ? __( 'Diagnostic Success', 'codeclove-school-management' ) : __( 'Diagnostic Failure', 'codeclove-school-management' )}
                  </span>
                  <p className="opacity-90">{testSmsResult.msg}</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* SMS Templates Accordion */}
      {smsEnabled && (
        <Card className="p-6 space-y-4">
          <div className="flex items-start gap-3 border-b border-border pb-4">
            <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center text-brand flex-shrink-0">
              <MessageSquare size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text leading-tight">{__( 'SMS Templates', 'codeclove-school-management' )}</h3>
              <p className="text-2xs text-text-muted mt-1 leading-normal">
                {__( 'Customize text messages sent automatically per event. SMS messages should be brief.', 'codeclove-school-management' )}
              </p>
            </div>
          </div>

          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-bg-surface">
            {templateInfo.map((tpl) => {
              const isOpen = openSmsTemplate === tpl.key
              const isEnabled = watch(`notifications.sms_templates.${tpl.key}.enabled` as Path<CodeCloveSettings>)
              const isStudentEnabled = watch(`notifications.sms_templates.${tpl.key}.send_to_student` as Path<CodeCloveSettings>)
              const isGuardianEnabled = watch(`notifications.sms_templates.${tpl.key}.send_to_guardian` as Path<CodeCloveSettings>)
              const bodyVal = (watch(`notifications.sms_templates.${tpl.key}.body` as Path<CodeCloveSettings>) as string | undefined) || ''
              const charCount = bodyVal.length
              const segments = Math.ceil(charCount / 160) || 1

              return (
                <div key={tpl.key} className="flex flex-col">
                  {/* Header */}
                  <button
                    type="button"
                    onClick={() => setOpenSmsTemplate(isOpen ? null : tpl.key)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3.5 text-start transition-colors duration-100 font-sans',
                      isOpen
                        ? 'bg-brand-dim/40 hover:bg-brand-dim/50'
                        : 'bg-bg-surface hover:bg-bg-base/60'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full flex-shrink-0 ring-2',
                          isEnabled
                            ? 'bg-emerald-500 ring-emerald-500/20'
                            : 'bg-text-subtle ring-text-subtle/20'
                        )}
                      />
                      <div>
                        <h4 className={cn('text-xs font-semibold leading-snug', isOpen ? 'text-brand' : 'text-text')}>{tpl.title}</h4>
                        <p className="text-3xs text-text-muted mt-0.5 leading-normal">{tpl.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isOpen && isEnabled && (
                        <div className="flex items-center gap-1.5 me-2">
                          {isStudentEnabled && (
                            <span className="text-2xs font-semibold bg-brand-dim text-brand border border-brand/20 px-2 py-0.5 rounded-full">
                              {__( 'Student', 'codeclove-school-management' )}
                            </span>
                          )}
                          {isGuardianEnabled && (
                            <span className="text-2xs font-semibold bg-brand-dim text-brand border border-brand/20 px-2 py-0.5 rounded-full">
                              {__( 'Guardian', 'codeclove-school-management' )}
                            </span>
                          )}
                          {!isStudentEnabled && !isGuardianEnabled && (
                            <span className="text-2xs font-semibold bg-bg-base text-text-muted border border-border px-2 py-0.5 rounded-full italic">
                              {__( 'No Recipients', 'codeclove-school-management' )}
                            </span>
                          )}
                        </div>
                      )}
                      <div className={cn('transition-colors duration-100', isOpen ? 'text-brand' : 'text-text-muted')}>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </button>

                  {/* Collapsible Content */}
                  {isOpen && (
                    <div className="p-5 border-t border-brand/20 bg-bg-base grid grid-cols-1 gap-4">
                      <div className="flex flex-col sm:flex-row gap-6 border-b border-border pb-4">
                        <FormCheckbox
                          label={__( 'Enable SMS Template', 'codeclove-school-management' )}
                          name={`notifications.sms_templates.${tpl.key}.enabled` as Path<CodeCloveSettings>}
                          control={control}
                          description={__( 'Route text messages for this event.', 'codeclove-school-management' )}
                        />
                        <FormCheckbox
                          label={__( 'Send to Student', 'codeclove-school-management' )}
                          name={`notifications.sms_templates.${tpl.key}.send_to_student` as Path<CodeCloveSettings>}
                          control={control}
                          description={__( 'Send SMS copy to student.', 'codeclove-school-management' )}
                        />
                        <FormCheckbox
                          label={__( 'Send to Guardian', 'codeclove-school-management' )}
                          name={`notifications.sms_templates.${tpl.key}.send_to_guardian` as Path<CodeCloveSettings>}
                          control={control}
                          description={__( 'Send SMS copy to parent/guardian.', 'codeclove-school-management' )}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <FormTextarea
                          label={__( 'SMS Message Body', 'codeclove-school-management' )}
                          name={`notifications.sms_templates.${tpl.key}.body` as Path<CodeCloveSettings>}
                          register={register}
                          placeholder={__( 'Write short text message...', 'codeclove-school-management' )}
                          rows={3}
                        />
                        <div className="flex items-center justify-between text-3xs font-semibold text-text-muted px-1">
                          <span>{__( 'Max 320 characters', 'codeclove-school-management' )}</span>
                          <span className={cn(charCount > 160 ? 'text-brand' : 'text-text-subtle')}>
                            {sprintf(
                              __( '%1$d / 320 characters (%2$s)', 'codeclove-school-management' ),
                              charCount,
                              sprintf(
                                _n( '%d SMS segment', '%d SMS segments', segments, 'codeclove-school-management' ),
                                segments
                              )
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Placeholder Cheat Sheet */}
                      <div className="col-span-full border border-border p-3 rounded-lg bg-bg-surface space-y-1.5">
                        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">{__( 'Available Placeholders', 'codeclove-school-management' )}</span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {tpl.placeholders.map((ph) => {
                            const copied = copiedPh === ph
                            const handleKeyDown = (e: React.KeyboardEvent) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                copyPlaceholder(ph)
                              }
                            }
                            return (
                              <code
                                key={ph}
                                role="button"
                                tabIndex={0}
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono text-2xs select-all cursor-pointer transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-brand-ring focus:border-brand',
                                  copied
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                                    : 'border-border bg-bg-base text-brand hover:border-brand-ring hover:bg-brand-dim/30'
                                )}
                                title={__( 'Click to copy', 'codeclove-school-management' )}
                                onClick={() => copyPlaceholder(ph)}
                                onKeyDown={handleKeyDown}
                              >
                                {copied && <Check size={10} strokeWidth={2.5} />}
                                {copied ? __( 'Copied!', 'codeclove-school-management' ) : ph}
                              </code>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
