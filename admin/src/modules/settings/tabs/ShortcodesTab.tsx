/** Tab: Shortcodes — settings section for copy-ready WordPress shortcode reference blocks */

import { useState } from 'react'
import { Check, Copy, FileText, Briefcase, LayoutDashboard } from 'lucide-react'
import type { CodeCloveSettings } from '@/api/settings'
import { Button, Card } from '@/components/ui'
import { FormGroupHeader } from '../components/SettingsFormPrimitives'
import { __ } from '@/lib/i18n'

interface ShortcodeBlockProps {
  label: string
  code: string
  description?: string
}

function ShortcodeBlock({ label, code, description }: ShortcodeBlockProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-bg-surface/50 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-text">{label}</p>
          {description && (
            <p className="text-xs text-text-muted">{description}</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          aria-label={copied ? __( 'Copied', 'codeclove-school-management' ) : __( 'Copy shortcode', 'codeclove-school-management' )}
          className="shrink-0"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      <div className="flex items-center gap-2 bg-bg-muted rounded px-3 py-1.5 font-mono text-xs text-text-muted overflow-x-auto">
        <code>{code}</code>
      </div>
    </div>
  )
}

export function ShortcodesTab(_: { settings: CodeCloveSettings }) {
  return (
    <div className="space-y-6">
      {/* Student & Parent Portal */}
      <Card className="p-5 space-y-4">
        <FormGroupHeader
          title={__( 'Student & Parent Portal', 'codeclove-school-management' )}
          description={__( 'Public shortcode for the dedicated student and parent self-service portal.', 'codeclove-school-management' )}
          icon={LayoutDashboard}
        />

        <div className="space-y-3">
          <ShortcodeBlock
            label={__( 'Student & Parent Portal Application', 'codeclove-school-management' )}
            code="[codeclove_portal]"
            description={__( 'Embeds the complete portal application. Guests see an authentication login form; authenticated students and parents access their dashboard, attendance, timetable, academic curriculum, fee statements, and notices.', 'codeclove-school-management' )}
          />
        </div>
      </Card>

      {/* Admissions & Student Inquiries */}
      <Card className="p-5 space-y-4">
        <FormGroupHeader
          title={__( 'Student Admissions & Inquiries', 'codeclove-school-management' )}
          description={__( 'Public shortcodes for student admissions, general inquiries, and applicant status tracking.', 'codeclove-school-management' )}
          icon={FileText}
        />

        <div className="space-y-3">
          <ShortcodeBlock
            label={__( 'Unified Admission Application Form', 'codeclove-school-management' )}
            code="[codeclove_admission_form]"
            description={__( 'Comprehensive application form with student demographics, academic placement, parent/guardian details, and address.', 'codeclove-school-management' )}
          />
          <ShortcodeBlock
            label={__( 'Admission Inquiry Form', 'codeclove-school-management' )}
            code="[codeclove_inquiry_form]"
            description={__( 'Compact inquiry form for prospective families to ask questions regarding curriculum, fees, tours, or enrollment.', 'codeclove-school-management' )}
          />
          <ShortcodeBlock
            label={__( 'Student Application Status Tracker', 'codeclove-school-management' )}
            code="[codeclove_application_status]"
            description={__( 'Allows applicants and parents to check their admission pipeline status with reference number and date of birth.', 'codeclove-school-management' )}
          />
        </div>
      </Card>

      {/* Careers & Staff Recruitment */}
      <Card className="p-5 space-y-4">
        <FormGroupHeader
          title={__( 'Careers & Staff Recruitment', 'codeclove-school-management' )}
          description={__( 'Public shortcodes for educator and administrative employment applications and candidate status tracking.', 'codeclove-school-management' )}
          icon={Briefcase}
        />

        <div className="space-y-3">
          <ShortcodeBlock
            label={__( 'Staff & Faculty Employment Application', 'codeclove-school-management' )}
            code="[codeclove_staff_application_form]"
            description={__( 'Online employment application capturing desired position, department, teaching experience, qualifications, and cover letter.', 'codeclove-school-management' )}
          />
          <ShortcodeBlock
            label={__( 'Staff Application Status Lookup', 'codeclove-school-management' )}
            code="[codeclove_staff_application_status]"
            description={__( 'Allows job candidates to track their application review status and interview progress using reference number and email.', 'codeclove-school-management' )}
          />
        </div>
      </Card>
    </div>
  )
}
