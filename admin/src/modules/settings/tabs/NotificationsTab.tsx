/** Tab: Notifications — settings section for email delivery, SMTP, and templates */

import { useState, useCallback, useMemo } from 'react'
import { Bell, Mail, Server, Eye, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Check } from 'lucide-react'
import type { UseFormRegister, Control, UseFormWatch, Path } from 'react-hook-form'
import type { CodeCloveSettings } from '@/api/settings'
import { useSendTestEmail } from '@/api/settings'
import { FormGroup, FormInput, FormSelect, FormCheckbox, FormTextarea } from '../components/SettingsFormPrimitives'
import { Button, Card, Spinner } from '@/components/ui'
import { cn } from '@/lib/utils'
import { __ } from '@/lib/i18n'

type Register = UseFormRegister<CodeCloveSettings>

interface NotificationsTabProps {
  register: Register
  control: Control<CodeCloveSettings>
  watch: UseFormWatch<CodeCloveSettings>
}
export function NotificationsTab({ register, control, watch }: NotificationsTabProps) {
  const mailDriver = watch('notifications.mail_driver') as 'wp_mail' | 'smtp' | undefined
  const [openTemplate, setOpenTemplate] = useState<string | null>(null)
  const [copiedPh, setCopiedPh] = useState<string | null>(null)

  const driverOptions = useMemo(() => [
    { value: 'wp_mail', label: __( 'WordPress Native Mail (wp_mail)', 'codeclove-school-management' ) },
    { value: 'smtp',    label: __( 'Custom SMTP Server', 'codeclove-school-management' ) },
  ], [])

  const secureOptions = useMemo(() => [
    { value: 'none', label: __( 'None (Plain)', 'codeclove-school-management' ) },
    { value: 'ssl',  label: __( 'SSL', 'codeclove-school-management' ) },
    { value: 'tls',  label: __( 'TLS', 'codeclove-school-management' ) },
  ], [])

  const templateInfo = useMemo(() => [
    {
      key: 'admission_received',
      title: __( 'New Admission Application Received', 'codeclove-school-management' ),
      desc: __( 'Sent to school administrators when a new application is submitted online.', 'codeclove-school-management' ),
      placeholders: ['{school_name}', '{school_email}', '{student_name}', '{reference_number}', '{guardian_name}', '{guardian_email}'],
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
      placeholders: ['{school_name}', '{school_email}', '{invoice_number}', '{amount}', '{payment_date}', '{payment_method}', '{payment_reference}', '{balance}', '{guardian_name}'],
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
      desc: __( 'Sent to the guardian immediately when a new fee bill/invoice is generated for the student.', 'codeclove-school-management' ),
      placeholders: ['{school_name}', '{school_email}', '{invoice_number}', '{amount}', '{due_date}', '{guardian_name}'],
    },
    {
      key: 'invoice_overdue',
      title: __( 'Overdue Fee Notice', 'codeclove-school-management' ),
      desc: __( 'Sent to the guardian when a bill passes its due date with an outstanding balance.', 'codeclove-school-management' ),
      placeholders: ['{school_name}', '{school_email}', '{invoice_number}', '{balance}', '{due_date}', '{guardian_name}'],
    },
    {
      key: 'payment_reversed',
      title: __( 'Payment Cancelled / Reversed', 'codeclove-school-management' ),
      desc: __( 'Sent to the guardian when a payment transaction is cancelled, reversed, or refunded.', 'codeclove-school-management' ),
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

  // Test email state
  const [testEmail, setTestEmail] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null)
  const sendTestEmail = useSendTestEmail()

  async function handleSendTest() {
    const email = testEmail.trim()
    if (!email) {
      setTestResult({ success: false, msg: __( 'Please enter a valid email address.', 'codeclove-school-management' ) })
      return
    }

    setTestResult(null)
    try {
      const success = await sendTestEmail.mutateAsync({ email })
      if (success) {
        setTestResult({ success: true, msg: __( 'Test email successfully sent!', 'codeclove-school-management' ) })
      } else {
        setTestResult({ success: false, msg: __( 'Mailer accepted the payload but returned failure status.', 'codeclove-school-management' ) })
      }
    } catch (err: unknown) {
      const responseMsg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined
      const fallbackMsg = err instanceof Error ? err.message : __( 'Error executing test request.', 'codeclove-school-management' )
      setTestResult({
        success: false,
        msg: responseMsg || fallbackMsg,
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Delivery Configuration */}
      <FormGroup
        title={__( 'Delivery Configuration', 'codeclove-school-management' )}
        description={__( 'Choose how CodeClove routes outgoing school communications.', 'codeclove-school-management' )}
        icon={Mail}
        cols={2}
      >
        <FormSelect
          label={__( 'Mail Driver', 'codeclove-school-management' )}
          name="notifications.mail_driver"
          register={register}
          options={driverOptions}
          fullWidth
        />
        <FormInput
          label={__( 'Sender Name', 'codeclove-school-management' )}
          name="notifications.sender_name"
          register={register}
          placeholder={__( 'e.g. Oakridge Academy', 'codeclove-school-management' )}
        />
        <FormInput
          label={__( 'Sender Email Address', 'codeclove-school-management' )}
          name="notifications.sender_email"
          register={register}
          placeholder={__( 'e.g. notifications@oakridge.edu', 'codeclove-school-management' )}
        />
      </FormGroup>

      {/* SMTP Configuration (Conditional) */}
      {mailDriver === 'smtp' && (
        <FormGroup
          title={__( 'SMTP Settings', 'codeclove-school-management' )}
          description={__( 'Configure your custom SMTP relay server credentials.', 'codeclove-school-management' )}
          icon={Server}
          cols={2}
        >
          <FormInput
            label={__( 'SMTP Host', 'codeclove-school-management' )}
            name="notifications.smtp_host"
            register={register}
            placeholder={__( 'e.g. smtp.mailgun.org', 'codeclove-school-management' )}
          />
          <FormInput
            label={__( 'SMTP Port', 'codeclove-school-management' )}
            name="notifications.smtp_port"
            register={register}
            type="number"
            placeholder={__( 'e.g. 587', 'codeclove-school-management' )}
          />
          <FormSelect
            label={__( 'Encryption Protocol', 'codeclove-school-management' )}
            name="notifications.smtp_secure"
            register={register}
            options={secureOptions}
          />
          <div className="flex items-center pt-5">
            <FormCheckbox
              label={__( 'Enable Authentication', 'codeclove-school-management' )}
              name="notifications.smtp_auth"
              control={control}
              description={__( 'Require username and password to authenticate.', 'codeclove-school-management' )}
            />
          </div>
          <FormInput
            label={__( 'SMTP Username', 'codeclove-school-management' )}
            name="notifications.smtp_username"
            register={register}
            placeholder={__( 'username or email', 'codeclove-school-management' )}
          />
          <FormInput
            label={__( 'SMTP Password', 'codeclove-school-management' )}
            name="notifications.smtp_password"
            register={register}
            type="password"
            placeholder={__( 'SMTP account password', 'codeclove-school-management' )}
          />
        </FormGroup>
      )}

      {/* Connection Test Diagnostics */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3 border-b border-border pb-4">
          <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center text-brand flex-shrink-0">
            <Eye size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text leading-tight">{__( 'Connection Test', 'codeclove-school-management' )}</h3>
            <p className="text-2xs text-text-muted mt-1 leading-normal">
              {__( 'Send a real-time diagnostic test email to verify your delivery settings. Save settings before running.', 'codeclove-school-management' )}
            </p>
          </div>
        </div>
        
        <div className="space-y-4 pt-1">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder={__( 'e.g. recipient@gmail.com', 'codeclove-school-management' )}
              className={cn(
                'flex-1 h-8 px-3 rounded border border-border bg-bg-surface text-sm text-text transition-colors duration-100',
                'placeholder:text-text-subtle hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-brand-ring focus:border-brand'
              )}
            />
            <Button
              type="button"
              onClick={handleSendTest}
              disabled={sendTestEmail.isPending}
              className="h-8 px-4"
            >
              {sendTestEmail.isPending ? (
                <>
                  <Spinner size="sm" className="me-2" /> {__( 'Sending...', 'codeclove-school-management' )}
                </>
              ) : (
                __( 'Send Test Email', 'codeclove-school-management' )
              )}
            </Button>
          </div>

          {testResult && (
            <div
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg text-xs leading-normal',
                testResult.success
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-danger-dim border border-danger/20 text-danger'
              )}
            >
              {testResult.success ? (
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              )}
              <div className="space-y-1">
                <span className="font-semibold">
                  {testResult.success ? __( 'Diagnostic Success', 'codeclove-school-management' ) : __( 'Diagnostic Failure', 'codeclove-school-management' )}
                </span>
                <p className="opacity-90">{testResult.msg}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Email Templates Accordion */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3 border-b border-border pb-4">
          <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center text-brand flex-shrink-0">
            <Bell size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text leading-tight">{__( 'Notification Templates', 'codeclove-school-management' )}</h3>
            <p className="text-2xs text-text-muted mt-1 leading-normal">
              {__( 'Customize subject lines and body text sent automatically per event. Supports template variables.', 'codeclove-school-management' )}
            </p>
          </div>
        </div>

        <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-bg-surface">
          {templateInfo.map((tpl) => {
            const isOpen = openTemplate === tpl.key
            const isEnabled = watch(`notifications.templates.${tpl.key}.enabled` as Path<CodeCloveSettings>)
            const isStudentEnabled = watch(`notifications.templates.${tpl.key}.send_to_student` as Path<CodeCloveSettings>)
            const isGuardianEnabled = watch(`notifications.templates.${tpl.key}.send_to_guardian` as Path<CodeCloveSettings>)

            return (
              <div key={tpl.key} className="flex flex-col">
                {/* Header */}
                <button
                  type="button"
                  onClick={() => setOpenTemplate(isOpen ? null : tpl.key)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3.5 text-start transition-colors duration-100 font-sans',
                    isOpen
                      ? 'bg-brand-dim/40 hover:bg-brand-dim/50'
                      : 'bg-bg-surface hover:bg-hover-bg'
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
                      <h4 className="text-sm font-semibold text-text">{tpl.title}</h4>
                      <p className="text-xs text-text-muted mt-0.5 leading-normal">{tpl.desc}</p>
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
                          <span className="text-2xs font-semibold bg-bg-surface text-text-muted border border-border px-2 py-0.5 rounded-full italic">
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
                  <div className="p-5 border-t border-border bg-bg-surface/50 grid grid-cols-1 gap-4">
                    <div className="flex flex-col sm:flex-row gap-6 border-b border-border pb-4">
                      <FormCheckbox
                        label={__( 'Enable Template', 'codeclove-school-management' )}
                        name={`notifications.templates.${tpl.key}.enabled` as Path<CodeCloveSettings>}
                        control={control}
                        description={__( 'Route email notifications for this event.', 'codeclove-school-management' )}
                      />
                      <FormCheckbox
                        label={__( 'Send to Student', 'codeclove-school-management' )}
                        name={`notifications.templates.${tpl.key}.send_to_student` as Path<CodeCloveSettings>}
                        control={control}
                        description={__( 'Send email copy to student.', 'codeclove-school-management' )}
                      />
                      <FormCheckbox
                        label={__( 'Send to Guardian', 'codeclove-school-management' )}
                        name={`notifications.templates.${tpl.key}.send_to_guardian` as Path<CodeCloveSettings>}
                        control={control}
                        description={__( 'Send email copy to parent/guardian.', 'codeclove-school-management' )}
                      />
                    </div>
                    
                    <FormInput
                      label={__( 'Email Subject', 'codeclove-school-management' )}
                      name={`notifications.templates.${tpl.key}.subject` as Path<CodeCloveSettings>}
                      register={register}
                      placeholder={__( 'Enter email subject line', 'codeclove-school-management' )}
                      fullWidth
                    />

                    <FormTextarea
                      label={__( 'Plain Text Email Body', 'codeclove-school-management' )}
                      name={`notifications.templates.${tpl.key}.body` as Path<CodeCloveSettings>}
                      register={register}
                      placeholder={__( 'Write message template...', 'codeclove-school-management' )}
                    />

                    {/* Placeholder Cheat Sheet */}
                    <div className="col-span-full border border-border p-3.5 rounded-lg bg-bg-surface space-y-2">
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
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-md border font-mono text-2xs select-all cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-brand-ring',
                                copied
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'border-border bg-bg-surface text-text hover:border-brand hover:text-brand hover:bg-brand-dim/30'
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
    </div>
  )
}
