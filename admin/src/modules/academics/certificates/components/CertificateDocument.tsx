import { forwardRef } from 'react'
import type { CertificateElement, CertificateTemplate } from '@/api/certificates'
import { CertificateCanvas } from './CertificateCanvas'
import { cn } from '@/lib/utils'

export interface CertificateDocumentData {
  student_name?: string
  first_name?: string
  last_name?: string
  admission_no?: string
  student_no?: string
  dob?: string
  gender?: string
  father_name?: string
  mother_name?: string
  guardian_name?: string
  class_name?: string
  section_name?: string
  roll_no?: string
  session_name?: string
  certificate_no?: string
  issue_date?: string
  reason?: string
  conduct?: string
  dues_status?: string
  school_name?: string
  school_code?: string
  principal_signature?: string
  principal_signature_image?: string
  school_logo?: string
  [key: string]: string | undefined
}

export interface CertificateDocumentProps {
  template: Pick<CertificateTemplate, 'orientation' | 'background_url' | 'layout_data'>
  data: CertificateDocumentData
  verificationUrl?: string
  className?: string
}

export const CertificateDocument = forwardRef<HTMLDivElement, CertificateDocumentProps>(
  function CertificateDocument({ template, data, verificationUrl, className }, ref) {
    const isPortrait = template.orientation === 'portrait'
    const pageRule = isPortrait
      ? '@page { size: A4 portrait; margin: 0; }'
      : '@page { size: A4 landscape; margin: 0; }'

    const elements: CertificateElement[] = Array.isArray(template.layout_data) ? template.layout_data : []
    const normalizedData: Record<string, string> = {}
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && v !== null) {
        normalizedData[k] = String(v)
      }
    }

    return (
      <div
        ref={ref}
        data-certificate-document="true"
        data-orientation={template.orientation}
        className={cn(
          'relative bg-white text-gray-900 overflow-hidden box-border print:m-0 print:border-none print:shadow-none shadow-none print:break-inside-avoid break-inside-avoid',
          isPortrait ? 'w-[210mm] h-[296.5mm] max-h-[296.5mm] aspect-[1/1.414]' : 'w-[297mm] h-[209.5mm] max-h-[209.5mm] aspect-[1.414/1]',
          className
        )}
        style={{
          boxSizing: 'border-box',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: pageRule }} />
        <CertificateCanvas
          orientation={template.orientation}
          backgroundUrl={template.background_url}
          elements={elements}
          isEditing={false}
          sampleOrRealData={normalizedData}
          verificationUrl={verificationUrl}
          className="shadow-none print:shadow-none w-full h-full max-h-full"
        />
      </div>
    )
  }
)
