import React from 'react'
import { FileCheck, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { CertificateTemplate } from '@/api/certificates'
import type { FullStudent } from '@/api/students'
import { CertificateCanvas } from './CertificateCanvas'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'

export interface CertificateLivePreviewProps {
  mode: 'single' | 'batch'
  canvasStudent: FullStudent | null
  selectedTemplate?: CertificateTemplate
  livePreviewDocData: Record<string, string>
}

export const CertificateLivePreview: React.FC<CertificateLivePreviewProps> = ({
  mode,
  canvasStudent,
  selectedTemplate,
  livePreviewDocData,
}) => {
  const isPortrait = selectedTemplate?.orientation === 'portrait'

  return (
    <div className="bg-bg-elevated border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
      {/* Studio Header Bar */}
      <div className="px-4 py-2.5 border-b border-border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 text-xs bg-bg-elevated min-h-[44px]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileCheck size={14} className="text-brand shrink-0" />
          <span className="font-semibold text-text truncate">
            {mode === 'single'
              ? canvasStudent
                ? `${canvasStudent.first_name} ${canvasStudent.last_name}`
                : __('Live Certificate Preview', 'codeclove-school-management')
              : canvasStudent
              ? sprintf(__('Preview: %s %s', 'codeclove-school-management'), canvasStudent.first_name, canvasStudent.last_name)
              : __('Cohort Preview', 'codeclove-school-management')}
          </span>
          {canvasStudent && (canvasStudent.admission_number || canvasStudent.student_number) && (
            <span className="text-2xs font-mono text-text-muted shrink-0 hidden sm:inline">
              ({canvasStudent.admission_number || canvasStudent.student_number})
            </span>
          )}
        </div>

        {selectedTemplate && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-text-muted font-medium hidden lg:inline">
              {selectedTemplate.title}
            </span>
            <Badge variant="outline" className="text-3xs uppercase font-mono tracking-wider">
              {selectedTemplate.orientation} • A4
            </Badge>
          </div>
        )}
      </div>

      {/* Studio Stage */}
      <div className="p-4 sm:p-6 bg-bg-surface/40 flex items-start justify-center overflow-auto min-h-[580px] max-h-[760px]">
        {selectedTemplate ? (
          <div
            className={cn(
              'shadow-lg border border-border/80 rounded-xs bg-white transition-all duration-150',
              isPortrait ? 'w-full max-w-[490px]' : 'w-full max-w-[700px]'
            )}
          >
            <CertificateCanvas
              orientation={selectedTemplate.orientation}
              backgroundUrl={selectedTemplate.background_url}
              elements={selectedTemplate.layout_data}
              isEditing={false}
              sampleOrRealData={livePreviewDocData}
            />
          </div>
        ) : (
          <div className="py-20 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-2">
            <Sparkles size={20} className="text-text-subtle" />
            <span>{__('Select a certificate template to preview', 'codeclove-school-management')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
