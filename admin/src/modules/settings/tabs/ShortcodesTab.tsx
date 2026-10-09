/**
 * Tab: Shortcodes — settings section for copy-ready WordPress shortcode reference blocks.
 * Styled strictly with CodeClove design system tokens:
 * - FormGroupHeader with brand icon containers
 * - Clean Card wrappers matching other settings panels
 * - Compound code chips with attached 1-click Copy buttons
 * - Proper funnel order: Inquiry -> Application -> Status Tracker
 */

import { useState } from 'react'
import { Check, Copy, FileText, Briefcase, LayoutDashboard, type LucideIcon } from 'lucide-react'
import type { CodeCloveSettings } from '@/api/settings'
import { Button, Card } from '@/components/ui'
import { FormGroupHeader } from '../components/SettingsFormPrimitives'
import { __ } from '@/lib/i18n'

interface ShortcodeItem {
  label: string
  code: string
  description: string
}

interface ShortcodeSection {
  title: string
  description: string
  icon: LucideIcon
  items: ShortcodeItem[]
}

export function ShortcodesTab(_: { settings: CodeCloveSettings }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  function handleCopy(code: string) {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }

  const sections: ShortcodeSection[] = [
    {
      title: __( 'Student & Parent Portal', 'codeclove-school-management' ),
      description: __(
        'Public shortcode for the dedicated student and parent self-service portal.',
        'codeclove-school-management'
      ),
      icon: LayoutDashboard,
      items: [
        {
          label: __( 'Student & Parent Portal Application', 'codeclove-school-management' ),
          code: '[codeclove_portal]',
          description: __(
            'Embeds the complete self-service portal for student and parent dashboards, attendance, schedules, and fee receipts.',
            'codeclove-school-management'
          ),
        },
      ],
    },
    {
      title: __( 'Student Admissions & Inquiries', 'codeclove-school-management' ),
      description: __(
        'Public shortcodes for student admissions, general inquiries, and applicant status tracking.',
        'codeclove-school-management'
      ),
      icon: FileText,
      items: [
        {
          label: __( 'Admission Inquiry Form', 'codeclove-school-management' ),
          code: '[codeclove_inquiry_form]',
          description: __(
            'Compact inquiry form for prospective families to ask questions regarding curriculum, fees, and enrollment.',
            'codeclove-school-management'
          ),
        },
        {
          label: __( 'Unified Admission Application Form', 'codeclove-school-management' ),
          code: '[codeclove_admission_form]',
          description: __(
            'Comprehensive application form capturing student demographics, academic placement, parent/guardian details, and address.',
            'codeclove-school-management'
          ),
        },
        {
          label: __( 'Student Application Status Tracker', 'codeclove-school-management' ),
          code: '[codeclove_application_status]',
          description: __(
            'Public status lookup allowing candidates and parents to monitor review progress using reference number and date of birth.',
            'codeclove-school-management'
          ),
        },
      ],
    },
    {
      title: __( 'Careers & Staff Recruitment', 'codeclove-school-management' ),
      description: __(
        'Public shortcodes for educator and administrative employment applications and candidate status tracking.',
        'codeclove-school-management'
      ),
      icon: Briefcase,
      items: [
        {
          label: __( 'Staff & Faculty Employment Application', 'codeclove-school-management' ),
          code: '[codeclove_staff_application_form]',
          description: __(
            'Online job application capturing desired position, department, teaching credentials, qualifications, and cover letter.',
            'codeclove-school-management'
          ),
        },
        {
          label: __( 'Staff Application Status Lookup', 'codeclove-school-management' ),
          code: '[codeclove_staff_application_status]',
          description: __(
            'Allows job candidates to track their application review status and interview progress using reference number and email.',
            'codeclove-school-management'
          ),
        },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const Icon = section.icon
        return (
          <Card key={section.title} className="p-6 space-y-4">
            <FormGroupHeader
              title={section.title}
              description={section.description}
              icon={Icon}
            />

            <div className="divide-y divide-border pt-1">
              {section.items.map((item) => {
                const isCopied = copiedCode === item.code
                return (
                  <div
                    key={item.code}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-1"
                  >
                    <div className="min-w-0 pr-4 space-y-0.5">
                      <h4 className="text-sm font-semibold text-text leading-tight">
                        {item.label}
                      </h4>
                      <p className="text-xs text-text-muted leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* Compound Code Pill + Copy Button */}
                    <div className="flex items-center shrink-0 self-start md:self-auto">
                      <div className="flex items-center rounded border border-border bg-bg-surface overflow-hidden shadow-2xs hover:border-border-strong transition-colors focus-within:ring-1 focus-within:ring-brand-ring focus-within:border-brand">
                        <code className="px-3 py-1 font-mono text-xs font-semibold text-text bg-bg-surface select-all border-r border-border">
                          {item.code}
                        </code>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(item.code)}
                          aria-label={
                            isCopied
                              ? __( 'Copied shortcode', 'codeclove-school-management' )
                              : `${__( 'Copy shortcode', 'codeclove-school-management' )} ${item.code}`
                          }
                          className="h-7 px-2.5 rounded-none border-0 text-text hover:bg-bg-overlay gap-1.5 text-xs font-medium"
                        >
                          {isCopied ? (
                            <>
                              <Check size={13} className="text-success" />
                              <span className="text-success font-semibold text-[11px]">
                                {__( 'Copied', 'codeclove-school-management' )}
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} className="text-text-subtle" />
                              <span>{__( 'Copy', 'codeclove-school-management' )}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
