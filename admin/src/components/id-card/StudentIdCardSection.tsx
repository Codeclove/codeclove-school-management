import { useRef, useState } from 'react'
import { IdCard, Printer } from 'lucide-react'
import { Button } from '@/components/ui'
import { StudentIdCard, type StudentIdCardProps } from '@/modules/students/components/StudentIdCard'
import { printElement } from '@/lib/print'
import type { SchoolSettings } from '@/components/ui/PrintLetterhead'
import { __ } from '@/lib/i18n'

export interface StudentIdCardSectionProps {
  student: StudentIdCardProps['student']
  school?: SchoolSettings
  unitName?: string
  groupName?: string
  unitLabel?: string
  groupLabel?: string
  rollNumber?: string
  sessionLabel?: string
  formatDate?: (dateStr: string) => string
  className?: string
}

/**
 * Shared Student Identity Card Section Component.
 *
 * 100% DRY single source of truth for the ID Card preview, Single/Dual toggle,
 * and print execution. Shared identically between Admin Dashboard and Student Portal.
 */
export function StudentIdCardSection({
  student,
  school,
  unitName,
  groupName,
  unitLabel,
  groupLabel,
  rollNumber,
  sessionLabel = 'Current Session',
  formatDate,
  className = '',
}: StudentIdCardSectionProps) {
  const [badgeDual, setBadgeDual] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    if (printRef.current) {
      printElement(printRef.current)
    }
  }

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Header with Title and Single/Dual & Print Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <IdCard size={16} className="text-brand" />
            <span>{__( 'Student Identity Card', 'codeclove-school-management' )}</span>
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {badgeDual
              ? __( 'CR80 dual-sided foldable badge preview.', 'codeclove-school-management' )
              : __( 'CR80 single-sided identity badge preview.', 'codeclove-school-management' )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Single Side / Dual Side Toggle */}
          <div className="flex items-center bg-bg-surface p-0.5 rounded-lg border border-border text-xs">
            <button
              type="button"
              onClick={() => setBadgeDual(false)}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                !badgeDual
                  ? 'bg-bg-elevated text-text font-semibold shadow-xs border border-border/50'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {__( 'Single Side', 'codeclove-school-management' )}
            </button>
            <button
              type="button"
              onClick={() => setBadgeDual(true)}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                badgeDual
                  ? 'bg-bg-elevated text-text font-semibold shadow-xs border border-border/50'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {__( 'Dual Side', 'codeclove-school-management' )}
            </button>
          </div>

          {/* Print Button */}
          <Button onClick={handlePrint} className="gap-1.5 text-xs h-8">
            <Printer size={13} />
            <span>{__( 'Print ID Card', 'codeclove-school-management' )}</span>
          </Button>
        </div>
      </div>

      {/* Card Preview Container */}
      <div className="bg-bg-surface border border-border rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center overflow-x-auto">
        <div ref={printRef} className="bg-white text-black font-sans">
          <StudentIdCard
            student={student}
            unitName={unitName}
            groupName={groupName}
            unitLabel={unitLabel}
            groupLabel={groupLabel}
            rollNumber={rollNumber}
            school={school}
            sessionLabel={sessionLabel}
            formatDate={formatDate}
            dual={badgeDual}
          />
        </div>
      </div>
    </div>
  )
}
