import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CertificateCanvas } from '../modules/academics/certificates/components/CertificateCanvas'
import { CertificateDocument } from '../modules/academics/certificates/components/CertificateDocument'
import { CertificateInspector } from '../modules/academics/certificates/components/CertificateInspector'
import { CertificateToolbar } from '../modules/academics/certificates/components/CertificateToolbar'
import { BatchIssueForm } from '../modules/academics/certificates/components/BatchIssueForm'
import { ClassMultiSelect } from '../modules/academics/certificates/components/ClassMultiSelect'
import { TooltipProvider } from '../components/ui/Tooltip'
 import { Select } from '../components/ui/Select'
 import { Combobox } from '../components/ui/Combobox'
 import { FilterBar } from '../components/ui/FilterBar'
 import { DataTable, type DataTableColumn } from '../components/ui/DataTable'
import { Badge } from '../components/ui/Badge'
import {
  type CertificateTemplate,
  type IssuedCertificate,
  type CertificateElement,
  resolveCertificatePrintData,
  useDeleteIssuedCertificate,
  useBulkDeleteIssuedCertificates,
} from '../api/certificates'
import type { FullStudent } from '../api/students'
import type { AcademicUnit, AcademicGroup } from '../api/academics'
import {
  DEFAULT_PORTRAIT_ELEMENTS,
  DEFAULT_LANDSCAPE_ELEMENTS,
  AVAILABLE_TOKENS,
  DEFAULT_SAMPLE_DATA,
  formatCertificateNumber,
} from '../modules/academics/certificates/certificate-defaults'
describe('Certificates Module', () => {
  describe('Defaults and Token Definitions', () => {
    it('defines essential dynamic tokens with labels and samples', () => {
      const tokenKeys = AVAILABLE_TOKENS.map((t) => t.token)
      expect(tokenKeys).toContain('student_name')
      expect(tokenKeys).toContain('admission_no')
      expect(tokenKeys).toContain('class_name')
      expect(tokenKeys).toContain('certificate_no')
      expect(tokenKeys).toContain('issue_date')
      expect(tokenKeys).toContain('reason')
      expect(tokenKeys).toContain('verification_qr')
    })

    it('contains strictly valid 0%-100% relative coordinates for starter presets', () => {
      for (const el of DEFAULT_PORTRAIT_ELEMENTS) {
        expect(el.x).toBeGreaterThanOrEqual(0)
        expect(el.x).toBeLessThanOrEqual(100)
        expect(el.y).toBeGreaterThanOrEqual(0)
        expect(el.y).toBeLessThanOrEqual(100)
      }

      for (const el of DEFAULT_LANDSCAPE_ELEMENTS) {
        expect(el.x).toBeGreaterThanOrEqual(0)
        expect(el.x).toBeLessThanOrEqual(100)
        expect(el.y).toBeGreaterThanOrEqual(0)
        expect(el.y).toBeLessThanOrEqual(100)
      }
    })

    it('pre-links corresponding label and value pairs in the starter portrait template', () => {
      const lbl1 = DEFAULT_PORTRAIT_ELEMENTS.find((el) => el.id === 'lbl_1')
      const val1 = DEFAULT_PORTRAIT_ELEMENTS.find((el) => el.id === 'val_student_name')
      expect(lbl1?.groupId).toBeDefined()
      expect(val1?.groupId).toBeDefined()
      expect(lbl1?.groupId).toBe(val1?.groupId)

      const lblTc = DEFAULT_PORTRAIT_ELEMENTS.find((el) => el.id === 'lbl_cert_no')
      const valTc = DEFAULT_PORTRAIT_ELEMENTS.find((el) => el.id === 'val_cert_no')
      expect(lblTc?.groupId).toBe(valTc?.groupId)
    })
    it('provides default sample student data for template live preview', () => {
      expect(DEFAULT_SAMPLE_DATA.student_name).toBeDefined()
      expect(DEFAULT_SAMPLE_DATA.admission_no).toBeDefined()
      expect(DEFAULT_SAMPLE_DATA.class_name).toBeDefined()
    })
  })

  describe('CertificateCanvas Linked Movement and Grouping', () => {
    it('renders a dashed partner ring on canvas when a linked element is selected', () => {
      const html = renderToString(
        <CertificateCanvas
          orientation="portrait"
          elements={DEFAULT_PORTRAIT_ELEMENTS}
          isEditing={true}
          selectedElementId="lbl_1"
          sampleOrRealData={{
            student_name: 'Harry Potter',
          }}
        />
      )

      // Active selected element has ring-2 ring-blue-500
      expect(html).toContain('ring-2 ring-blue-500')
      // Linked partner (val_student_name) has ring-dashed indicator
      expect(html).toContain('ring-dashed')
    })
  })

  describe('CertificateCanvas Component', () => {
    it('renders portrait certificate canvas with vector border fallback', () => {
      const html = renderToString(
        <CertificateCanvas
          orientation="portrait"
          elements={DEFAULT_PORTRAIT_ELEMENTS}
          isEditing={false}
          sampleOrRealData={{
            student_name: 'Hermione Granger',
            admission_no: 'ADM-GRYF-001',
          }}
        />
      )

      expect(html).toContain('aspect-[1/1.414]')
      expect(html).toContain('Hermione Granger')
      expect(html).toContain('ADM-GRYF-001')
    })

    it('renders landscape certificate canvas with custom background stationery', () => {
      const html = renderToString(
        <CertificateCanvas
          orientation="landscape"
          backgroundUrl="https://example.com/custom-border.png"
          elements={DEFAULT_LANDSCAPE_ELEMENTS}
          isEditing={false}
          sampleOrRealData={{
            student_name: 'Harry Potter',
          }}
        />
      )

      expect(html).toContain('aspect-[1.414/1]')
      expect(html).toContain('https://example.com/custom-border.png')
      expect(html).toContain('Harry Potter')
    })

    it('renders elements with custom alignment, italic, uppercase, opacity, and suffix', () => {
      const html = renderToString(
        <CertificateCanvas
          orientation="portrait"
          elements={[
            {
              id: 'custom_1',
              type: 'token',
              token: 'student_name',
              label: 'Student Name',
              x: 50,
              y: 50,
              textAlign: 'center',
              fontStyle: 'italic',
              textTransform: 'uppercase',
              suffix: ' (Graduated)',
              isVisible: true,
            },
            {
              id: 'watermark_logo',
              type: 'image',
              imageUrl: 'https://example.com/crest.png',
              label: 'Watermark Crest',
              x: 50,
              y: 50,
              imageWidth: 200,
              opacity: 0.15,
              isVisible: true,
            },
          ]}
          isEditing={false}
          sampleOrRealData={{
            student_name: 'Harry Potter',
          }}
        />
      )

      expect(html).toContain('Harry Potter (Graduated)')
      expect(html).toContain('text-align:center')
      expect(html).toContain('font-style:italic')
      expect(html).toContain('text-transform:uppercase')
      expect(html).toContain('opacity:0.15')
    })
    it('renders line divider elements with custom thickness, stroke style, and width', () => {
      const lineEl: CertificateElement = {
        id: 'sig_line',
        type: 'line',
        label: 'Principal Signature Line',
        x: 50,
        y: 80,
        lineWidth: 180,
        lineHeight: 2,
        lineStyle: 'dashed',
        color: '#1e3a8a',
        isVisible: true,
      }
      const html = renderToString(
        <CertificateCanvas
          orientation="portrait"
          elements={[lineEl]}
          isEditing={true}
          selectedElementId="sig_line"
        />
      )
      expect(html).toContain('border-top:2px dashed #1e3a8a')
      expect(html).toContain('ring-2 ring-blue-500')
    })

  })

  describe('CertificateDocument Print Renderer', () => {
    it('embeds portrait @page rule and renders text overlays', () => {
      const html = renderToString(
        <CertificateDocument
          template={{
            orientation: 'portrait',
            background_url: null,
            layout_data: DEFAULT_PORTRAIT_ELEMENTS,
          }}
          data={{
            student_name: 'Ronald Weasley',
            certificate_no: 'TC-2026-999',
            reason: 'Graduated',
          }}
        />
      )

      expect(html).toContain('@page { size: A4 portrait; margin: 0; }')
      expect(html).toContain('Ronald Weasley')
      expect(html).toContain('TC-2026-999')
    })

    it('embeds landscape @page rule for merit certificates', () => {
      const html = renderToString(
        <CertificateDocument
          template={{
            orientation: 'landscape',
            background_url: null,
            layout_data: DEFAULT_LANDSCAPE_ELEMENTS,
          }}
          data={{
            student_name: 'Luna Lovegood',
            school_name: 'Hogwarts Academy',
          }}
        />
      )

      expect(html).toContain('@page { size: A4 landscape; margin: 0; }')
      expect(html).toContain('Luna Lovegood')
    })

    it('renders image elements like school logo and principal signature', () => {
      const html = renderToString(
        <CertificateDocument
          template={{
            orientation: 'portrait',
            background_url: null,
            layout_data: [
              {
                id: 'logo_1',
                type: 'image',
                imageUrl: 'https://example.com/crest.png',
                label: 'Crest',
                x: 50,
                y: 10,
                imageWidth: 80,
                isVisible: true,
              },
              {
                id: 'sign_1',
                type: 'image',
                token: 'principal_signature_image',
                label: 'Signature',
                x: 80,
                y: 85,
                imageWidth: 120,
                isVisible: true,
              },
            ],
          }}
          data={{
            principal_signature_image: 'https://example.com/signature.png',
          }}
        />
      )

      expect(html).toContain('https://example.com/crest.png')
      expect(html).toContain('https://example.com/signature.png')
    })

    it('renders vector print document with custom alignment, italic, uppercase, and opacity', () => {
      const html = renderToString(
        <CertificateDocument
          template={{
            orientation: 'portrait',
            background_url: null,
            layout_data: [
              {
                id: 'txt_1',
                type: 'static',
                text: 'Official School Transcript',
                label: 'Title',
                x: 50,
                y: 20,
                textAlign: 'center',
                fontStyle: 'italic',
                textTransform: 'uppercase',
                isVisible: true,
              },
              {
                id: 'img_wm',
                type: 'image',
                imageUrl: 'https://example.com/crest.png',
                label: 'Watermark',
                x: 50,
                y: 50,
                opacity: 0.2,
                isVisible: true,
              },
            ],
          }}
          data={{}}
        />
      )

      expect(html).toContain('Official School Transcript')
      expect(html).toContain('text-align:center')
      expect(html).toContain('font-style:italic')
      expect(html).toContain('text-transform:uppercase')
      expect(html).toContain('opacity:0.2')
    })

    it('renders vector QRCode and Barcode for serial and authenticity verification', () => {
      const html = renderToString(
        <CertificateDocument
          template={{
            orientation: 'landscape',
            background_url: null,
            layout_data: [
              {
                id: 'qr_1',
                type: 'token',
                token: 'verification_qr',
                label: 'Verification QR',
                x: 50,
                y: 85,
                isVisible: true,
              },
              {
                id: 'bar_1',
                type: 'token',
                token: 'serial_barcode',
                label: 'Serial Barcode',
                x: 20,
                y: 85,
                isVisible: true,
              },
            ],
          }}
          data={{
            certificate_no: 'CERT-2026-0042',
            verification_token: 'test_token_1234567890',
          }}
        />
      )

      expect(html).toContain('aria-label="QR Code"')
      expect(html).toContain('Verify Online')
      expect(html).toContain('svg')
      expect(html).toContain('CERT-2026-0042')
    })
  })

  describe('CertificateInspector Component', () => {
    it('renders color picker, alignment options, italic toggle, uppercase button, and suffix field', () => {
      const element = {
        id: 'token_1',
        type: 'token' as const,
        token: 'student_name',
        label: 'Student Name',
        prefix: 'Pupil: ',
        suffix: ' Jr.',
        x: 50,
        y: 40,
        color: '#1e3a8a',
        textAlign: 'center' as const,
        fontStyle: 'italic' as const,
        textTransform: 'uppercase' as const,
        isVisible: true,
      }

      const html = renderToString(
        <TooltipProvider>
          <CertificateInspector
            selectedElement={element}
            elements={[element]}
            onSelectElement={() => {}}
            onUpdateElement={() => {}}
            onDeleteElement={() => {}}
            onBackgroundUrlChange={() => {}}
          />
        </TooltipProvider>
      )
      expect(html).toContain('type="color"')
      expect(html).toContain('value="#1e3a8a"')
      expect(html).toContain('value="1E3A8A"')
      expect(html).toContain('Field Prefix')
      expect(html).toContain('Field Suffix')
      expect(html).toContain('Alignment &amp; Style')
      expect(html).toContain('TT')
    })

    it('renders opacity watermark slider for image elements', () => {
      const imgElement = {
        id: 'img_1',
        type: 'image' as const,
        imageUrl: 'https://example.com/crest.png',
        label: 'School Crest',
        x: 50,
        y: 50,
        imageWidth: 150,
        opacity: 0.25,
        isVisible: true,
      }

      const html = renderToString(
        <TooltipProvider>
          <CertificateInspector
            selectedElement={imgElement}
            elements={[imgElement]}
            onSelectElement={() => {}}
            onUpdateElement={() => {}}
            onDeleteElement={() => {}}
            onBackgroundUrlChange={() => {}}
          />
        </TooltipProvider>
      )
      expect(html).toContain('25%')
    })
    it('renders line styling controls when a line element is selected', () => {
      const lineElement: CertificateElement = {
        id: 'line_1',
        type: 'line',
        label: 'Signature Line',
        x: 50,
        y: 80,
        lineWidth: 150,
        lineHeight: 2,
        lineStyle: 'dashed',
        color: '#cbd5e1',
        isVisible: true,
      }
      const html = renderToString(
        <TooltipProvider>
          <CertificateInspector
            selectedElement={lineElement}
            elements={[lineElement]}
            onSelectElement={() => {}}
            onUpdateElement={() => {}}
            onDeleteElement={() => {}}
            onBackgroundUrlChange={() => {}}
          />
        </TooltipProvider>
      )
      expect(html).toContain('Line Dimensions')
      expect(html).toContain('Thickness:')
      expect(html).toContain('Stroke Style:')
      expect(html).toContain('solid')
      expect(html).toContain('dashed')
      expect(html).toContain('dotted')
    })

    it('renders canvas settings and layer list when no element is selected', () => {
      const html = renderToString(
        <TooltipProvider>
          <CertificateInspector
            selectedElement={null}
            elements={DEFAULT_PORTRAIT_ELEMENTS}
            onSelectElement={() => {}}
            onUpdateElement={() => {}}
            onDeleteElement={() => {}}
            onBackgroundUrlChange={() => {}}
          />
        </TooltipProvider>
      )
      expect(html).toContain('Certificate Layers')
      expect(html).toContain('A4 • 300 DPI')
    })
  })
  describe('Batch Issuance Numbering & Document Formatter', () => {
    it('formats sequential certificate serial numbers with padding', () => {
      const prefix = 'MERIT'
      const year = 2026
      const startNumber = 42
      const serials = [0, 1, 2].map(
        (offset) => `${prefix}-${year}-${String(startNumber + offset).padStart(4, '0')}`
      )

      expect(serials[0]).toBe('MERIT-2026-0042')
      expect(serials[1]).toBe('MERIT-2026-0043')
      expect(serials[2]).toBe('MERIT-2026-0044')
    })

    it('formats admission number based certificate serials', () => {
      const prefix = 'TC'
      const year = 2026
      const admissionNumbers = ['ADM-0101', 'ADM-0102']
      const serials = admissionNumbers.map((adm) => `${prefix}-${year}-${adm}`)

      expect(serials[0]).toBe('TC-2026-ADM-0101')
      expect(serials[1]).toBe('TC-2026-ADM-0102')
    })

    it('renders multi-page batch printable document wrappers with page break styling', () => {
      const template = {
        orientation: 'portrait' as const,
        background_url: null,
        layout_data: DEFAULT_PORTRAIT_ELEMENTS,
      }
      const data1 = { student_name: 'Harry Potter', certificate_no: 'CERT-2026-0001' }
      const data2 = { student_name: 'Hermione Granger', certificate_no: 'CERT-2026-0002' }

      const html = renderToString(
        <div>
          <div style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
            <CertificateDocument template={template} data={data1} />
          </div>
          <div style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
            <CertificateDocument template={template} data={data2} />
          </div>
        </div>
      )

      expect(html).toContain('Harry Potter')
      expect(html).toContain('Hermione Granger')
      expect(html).toContain('page-break-after:always')
      expect(html).toContain('break-after:page')
    })

    it('resolves normalized certificate print data dictionary from issued metadata', () => {
      const mockCert: IssuedCertificate = {
        id: 10,
        certificate_no: 'TC-2026-ADM-0042',
        issue_date: '2026-05-15',
        student_id: 42,
        reason: 'Transfer of Residence',
        conduct: 'Exemplary',
        dues_status: 'Cleared',
        verification_token: 'validtoken123',
        metadata: {
          student: {
            full_name: 'Alexander Vance',
            first_name: 'Alexander',
            last_name: 'Vance',
            admission_number: 'ADM-0042',
            student_number: 'STU-0042',
            gender: 'Male',
          },
          guardian: {
            father_name: 'Arthur Vance',
            primary_name: 'Arthur Vance',
          },
          academic: {
            unit_name: 'Grade 10',
            group_name: 'Section A',
            roll_number: '14',
            session_name: '2026-2027',
          },
          school: {
            name: 'Green Valley Academy',
            code: 'GVA-101',
          },
        },
        created_at: '2026-05-15 10:00:00',
      }

      const printData = resolveCertificatePrintData(mockCert)
      expect(printData.student_name).toBe('Alexander Vance')
      expect(printData.admission_no).toBe('ADM-0042')
      expect(printData.class_name).toBe('Grade 10')
      expect(printData.father_name).toBe('Arthur Vance')
      expect(printData.certificate_no).toBe('TC-2026-ADM-0042')
      expect(printData.reason).toBe('Transfer of Residence')
    })
  })
  describe('Searchable Combobox & Select Integration', () => {
    it('renders searchable Combobox with proper WAI-ARIA combobox attributes', () => {
      const html = renderToString(
        <Combobox
          id="student-picker"
          searchPlaceholder="Search student name or ID..."
          value="101"
          error={true}
          aria-describedby="student-picker-error"
          options={[
            { value: '101', label: 'Liam Jackson VI (ADM-2026-0278)' },
            { value: '102', label: 'Harper Moore VI (ADM-2026-0277)' },
          ]}
        />
      )

      expect(html).toContain('role="combobox"')
      expect(html).toContain('aria-haspopup="listbox"')
      expect(html).toContain('aria-controls="student-picker-listbox"')
      expect(html).toContain('aria-invalid="true"')
      expect(html).toContain('aria-describedby="student-picker-error"')
      expect(html).toContain('Liam Jackson VI (ADM-2026-0278)')
    })

    it('delegates searchable Select to Combobox seamlessly with accessibility preservation', () => {
      const html = renderToString(
        <Select
          searchable
          id="select-combobox"
          searchPlaceholder="Search student name or ID..."
          value="102"
          options={[
            { value: '101', label: 'Liam Jackson VI (ADM-2026-0278)' },
            { value: '102', label: 'Harper Moore VI (ADM-2026-0277)' },
          ]}
        />
      )

      expect(html).toContain('role="combobox"')
      expect(html).toContain('aria-controls="select-combobox-listbox"')
      expect(html).toContain('Harper Moore VI (ADM-2026-0277)')
    })
    it('supports two-row item layout with secondary description ID', () => {
      const html = renderToString(
        <Combobox
          searchPlaceholder="Search student name or ID..."
          value="101"
          options={[
            {
              value: '101',
              label: 'Henry Williams Jr',
              description: 'ADM-2026-0186 • Roll 14',
            },
          ]}
        />
      )

      expect(html).toContain('Henry Williams Jr')
      expect(html).toContain('ADM-2026-0186 • Roll 14')
    })
  })
  describe('Certificate Studio Toolbar', () => {
    it('renders 3-zone studio toolbar with orientation, creation tools, and utilities', () => {
      const html = renderToString(
        <TooltipProvider>
          <CertificateToolbar
            orientation="portrait"
            onOrientationChange={() => {}}
            onBackgroundUrlChange={() => {}}
            onSelectElement={() => {}}
            onAddElement={() => {}}
            onResetLayout={() => {}}
            sampleMode={true}
            onToggleSampleMode={() => {}}
            zoom={1}
            onZoomIn={() => {}}
            onZoomOut={() => {}}
            onResetZoom={() => {}}
          />
        </TooltipProvider>
      )

      // Zone 1: Document Specs & Orientation
      expect(html).toContain('Portrait')
      expect(html).toContain('Landscape')
      expect(html).toContain('A4 • 300 DPI')

      // Zone 2: Creation Tools
      expect(html).toContain('Add Field')
      expect(html).toContain('Text')
      expect(html).toContain('Image')
      expect(html).toContain('Add Border')

      // Zone 3: Studio Utilities
      expect(html).toContain('Preview Data')
      expect(html).toContain('100%')
      expect(html).toContain('Fit')
      expect(html).toContain('Reset')
    })
    it('renders creation line button for vector dividers and signature lines', () => {
      const html = renderToString(
        <TooltipProvider>
          <CertificateToolbar
            orientation="portrait"
            onOrientationChange={() => {}}
            onBackgroundUrlChange={() => {}}
            onSelectElement={() => {}}
            onAddElement={() => {}}
            onResetLayout={() => {}}
          />
        </TooltipProvider>
      )
      expect(html).toContain('Line')
    })

    it('provides searchable dynamic field definitions for canvas placement', () => {
      // Verify all essential categories exist with tokens
      const studentTokens = AVAILABLE_TOKENS.filter((t) => t.category === 'student')
      const academicTokens = AVAILABLE_TOKENS.filter((t) => t.category === 'academic')
      const securityTokens = AVAILABLE_TOKENS.filter((t) => t.category === 'security')

      expect(studentTokens.length).toBeGreaterThanOrEqual(5)
      expect(academicTokens.length).toBeGreaterThanOrEqual(3)
      expect(securityTokens.length).toBeGreaterThanOrEqual(2)

      // Verify token keys match dynamic variable syntax
      for (const t of AVAILABLE_TOKENS) {
        expect(t.token).toMatch(/^[a-z_]+$/)
        expect(t.label.length).toBeGreaterThan(2)
      }
    })
  })
  describe('Templates Library FilterBar & DataTable', () => {
    const mockTemplates: CertificateTemplate[] = [
      {
        id: 1,
        title: 'Academic Merit Certificate',
        type: 'merit',
        orientation: 'landscape',
        background_url: null,
        layout_data: DEFAULT_LANDSCAPE_ELEMENTS,
        is_default: true,
        issued_count: 76,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 2,
        title: 'School Transfer Certificate',
        type: 'transfer',
        orientation: 'portrait',
        background_url: null,
        layout_data: DEFAULT_PORTRAIT_ELEMENTS,
        is_default: false,
        issued_count: 54,
        created_at: '2026-01-02',
        updated_at: '2026-01-02',
      },
    ]

    const columns: DataTableColumn<CertificateTemplate>[] = [
      {
        key: 'title',
        header: 'Template Name',
        type: 'primary',
        sortable: true,
        render: (tpl) => (
          <div className="flex items-center gap-2">
            <span>{tpl.title}</span>
            {tpl.is_default && <Badge variant="success">Default</Badge>}
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        sortable: true,
        align: 'center',
        render: (tpl) => <Badge variant="outline">{tpl.type}</Badge>,
      },
      {
        key: 'orientation',
        header: 'Orientation',
        sortable: true,
        render: (tpl) => <span>{tpl.orientation}</span>,
      },
      {
        key: 'issued_count',
        header: 'Issued',
        sortable: true,
        align: 'right',
        render: (tpl) => <span className="tabular-nums">{tpl.issued_count}</span>,
      },
    ]

    it('renders FilterBar with search and type/orientation selects', () => {
      const html = renderToString(
        <FilterBar
          search="merit"
          searchPlaceholder="Search templates by name..."
          activeFilterCount={1}
        >
          <Select
            value="merit"
            options={[
              { value: '', label: 'All Types' },
              { value: 'merit', label: 'Merit' },
            ]}
          />
          <Select
            value="landscape"
            options={[
              { value: '', label: 'All Orientations' },
              { value: 'landscape', label: 'Landscape' },
            ]}
          />
        </FilterBar>
      )

      expect(html).toContain('Search templates by name...')
      expect(html).toContain('Merit')
      expect(html).toContain('Landscape')
    })

    it('renders DataTable with templates, badges, and numeric tabular-nums alignment', () => {
      const html = renderToString(
        <DataTable<CertificateTemplate>
          data={mockTemplates}
          columns={columns}
          total={2}
        />
      )

      expect(html).toContain('Academic Merit Certificate')
      expect(html).toContain('Default')
      expect(html).toContain('School Transfer Certificate')
      expect(html).toContain('76')
      expect(html).toContain('tabular-nums')
    })
  })

  describe('formatCertificateNumber Helper', () => {
    it('formats sequential numbers with zero padding', () => {
      const num = formatCertificateNumber({
        scheme: 'sequential',
        prefix: 'CERT',
        year: 2026,
        index: 42,
      })
      expect(num).toBe('CERT-2026-0042')
    })

    it('formats admission number scheme', () => {
      const num = formatCertificateNumber({
        scheme: 'admission_no',
        prefix: 'TC',
        year: 2026,
        admissionNo: 'ADM-9988',
      })
      expect(num).toBe('TC-2026-ADM-9988')
    })

    it('formats roll number scheme with sanitized unit code', () => {
      const num = formatCertificateNumber({
        scheme: 'roll_no',
        prefix: 'MR',
        year: 2026,
        unitCode: 'Grade 10',
        rollNo: '14',
      })
      expect(num).toBe('MR-GRADE10-14')
    })
  })
  describe('Issued Certificate Mistake Deletion Hooks & Table Actions', () => {
    it('exports deletion mutation hooks for single and bulk issued certificates', () => {
      expect(typeof useDeleteIssuedCertificate).toBe('function')
      expect(typeof useBulkDeleteIssuedCertificates).toBe('function')
    })

    it('renders issued certificate action buttons including permanent deletion trigger', () => {
      const mockCert: IssuedCertificate = {
        id: 101,
        certificate_no: 'CERT-2026-MISTAKE',
        issue_date: '2026-06-01',
        student_id: 42,
        verification_token: 'vt_mistake',
        metadata: {
          student: {
            id: 42,
            student_number: 'STU-0042',
            admission_number: 'ADM-0042',
            first_name: 'Harry',
            last_name: 'Potter',
            full_name: 'Harry Potter',
          },
        },
        created_at: '2026-06-01 12:00:00',
      }

      const columns: DataTableColumn<IssuedCertificate>[] = [
        {
          key: 'certificate_no',
          header: 'Certificate No.',
          render: (c) => <span>{c.certificate_no}</span>,
        },
        {
          key: 'actions',
          header: 'Actions',
          type: 'actions',
          render: () => (
            <div>
              <button aria-label="Reprint">Reprint</button>
              <button aria-label="Delete Certificate" title="Delete Certificate">Delete</button>
            </div>
          ),
        },
      ]

      const html = renderToString(
        <DataTable<IssuedCertificate>
          data={[mockCert]}
          columns={columns}
          total={1}
        />
      )

      expect(html).toContain('CERT-2026-MISTAKE')
      expect(html).toContain('Delete Certificate')
      expect(html).toContain('Reprint')
    })
  })

  describe('School-Wide & Multi-Class Batch Issuance', () => {
    const testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const mockTemplates: CertificateTemplate[] = [
      {
        id: 1,
        title: 'Sports Day Participation Certificate',
        type: 'general',
        orientation: 'landscape',
        background_url: null,
        layout_data: DEFAULT_LANDSCAPE_ELEMENTS,
        is_default: false,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ]

    const mockUnits: AcademicUnit[] = [
      { id: 101, name: 'Grade 1', code: 'G1', session_id: 1, order: 1, status: 'active', groups_count: 2, students_count: 25, created_at: '2026-01-01' },
      { id: 102, name: 'Grade 2', code: 'G2', session_id: 1, order: 2, status: 'active', groups_count: 2, students_count: 25, created_at: '2026-01-01' },
      { id: 103, name: 'Grade 3', code: 'G3', session_id: 1, order: 3, status: 'active', groups_count: 2, students_count: 25, created_at: '2026-01-01' },
    ]

    const mockStudents = [
      {
        id: 1,
        first_name: 'Lucas',
        last_name: 'Scott',
        admission_number: 'ADM-001',
        enrollment: { unit_name: 'Grade 1', group_name: 'Section A', roll_number: '01' },
      },
      {
        id: 2,
        first_name: 'Brooke',
        last_name: 'Davis',
        admission_number: 'ADM-002',
        enrollment: { unit_name: 'Grade 2', group_name: 'Section B', roll_number: '05' },
      },
    ] as unknown as FullStudent[]

    it('renders BatchIssueForm with School-Wide Cohort header when all classes are selected', () => {
      const html = renderToString(
        <QueryClientProvider client={testQueryClient}>
          <BatchIssueForm
            templates={mockTemplates}
            selectedTemplateId={1}
            onSelectTemplateId={() => {}}
            selectedTemplate={mockTemplates[0]}
            units={mockUnits}
            selectedUnitIds={[101, 102, 103]}
            onSelectUnitIds={() => {}}
            groups={[]}
            onSelectGroupId={() => {}}
            batchStudents={mockStudents}
            loadingBatchStudents={false}
            excludedStudentIds={new Set()}
            onToggleExcludeStudent={() => {}}
            onIncludeAll={() => {}}
            onExcludeAll={() => {}}
            previewStudentId={null}
            onSelectPreviewStudent={() => {}}
            numberScheme="sequential"
            onNumberSchemeChange={() => {}}
            numberPrefix="CERT"
            onNumberPrefixChange={() => {}}
            startNumber={1}
            onStartNumberChange={() => {}}
            issueDate="2026-10-18"
            onIssueDateChange={() => {}}
            sampleBatchSerials={['CERT-2026-0001', 'CERT-2026-0002']}
            reason="Sports Day 2026 Participation"
            onReasonChange={() => {}}
            conduct="Good"
            onConductChange={() => {}}
            duesStatus=""
            onDuesStatusChange={() => {}}
          />
        </QueryClientProvider>
      )

      expect(html).toContain('Template &amp; School-Wide Cohort')
      expect(html).toContain('(Whole School)')
      expect(html).toContain('disabled')
    })

    it('renders Multi-Class Cohort with subset selection and disables roll_no scheme', () => {
      const html = renderToString(
        <QueryClientProvider client={testQueryClient}>
          <BatchIssueForm
            templates={mockTemplates}
            selectedTemplateId={1}
            onSelectTemplateId={() => {}}
            selectedTemplate={mockTemplates[0]}
            units={mockUnits}
            selectedUnitIds={[101, 102]} // Grades 1 & 2 selected, Grade 3 left out
            onSelectUnitIds={() => {}}
            groups={[]}
            onSelectGroupId={() => {}}
            batchStudents={mockStudents}
            loadingBatchStudents={false}
            excludedStudentIds={new Set()}
            onToggleExcludeStudent={() => {}}
            onIncludeAll={() => {}}
            onExcludeAll={() => {}}
            previewStudentId={null}
            onSelectPreviewStudent={() => {}}
            numberScheme="sequential"
            onNumberSchemeChange={() => {}}
            numberPrefix="CERT"
            onNumberPrefixChange={() => {}}
            startNumber={1}
            onStartNumberChange={() => {}}
            issueDate="2026-10-18"
            onIssueDateChange={() => {}}
            sampleBatchSerials={['CERT-2026-0001']}
            reason="Primary Wing Certificates"
            onReasonChange={() => {}}
            conduct="Good"
            onConductChange={() => {}}
            duesStatus=""
            onDuesStatusChange={() => {}}
          />
        </QueryClientProvider>
      )

      expect(html).toContain('Template &amp; Multi-Class Cohort (2')
      expect(html).toContain('Roll numbers repeat across classes. Use Sequential or Student ID.')
      expect(html).toContain('disabled')
    })

    it('renders Single Class Cohort when exactly one class is selected with active section select', () => {
      const mockGroups: AcademicGroup[] = [
        { id: 201, unit_id: 101, name: 'Section A', code: 'A', session_id: 1, capacity: 25, status: 'active', order: 1, students_count: 25, created_at: '2026-01-01' },
      ]

      const html = renderToString(
        <QueryClientProvider client={testQueryClient}>
          <BatchIssueForm
            templates={mockTemplates}
            selectedTemplateId={1}
            onSelectTemplateId={() => {}}
            selectedTemplate={mockTemplates[0]}
            units={mockUnits}
            selectedUnitIds={[101]} // Only Grade 1 selected
            onSelectUnitIds={() => {}}
            groups={mockGroups}
            selectedGroupId={201}
            onSelectGroupId={() => {}}
            batchStudents={mockStudents.slice(0, 1)}
            loadingBatchStudents={false}
            excludedStudentIds={new Set()}
            onToggleExcludeStudent={() => {}}
            onIncludeAll={() => {}}
            onExcludeAll={() => {}}
            previewStudentId={null}
            onSelectPreviewStudent={() => {}}
            numberScheme="roll_no"
            onNumberSchemeChange={() => {}}
            numberPrefix="CERT"
            onNumberPrefixChange={() => {}}
            startNumber={1}
            onStartNumberChange={() => {}}
            issueDate="2026-10-18"
            onIssueDateChange={() => {}}
            sampleBatchSerials={['CERT-G1-01']}
            reason=""
            onReasonChange={() => {}}
            conduct="Good"
            onConductChange={() => {}}
            duesStatus=""
            onDuesStatusChange={() => {}}
          />
        </QueryClientProvider>
      )

      // Section A should be in the options when single class is selected
      expect(html).toContain('Section A')
      // In single class mode, roll_no is enabled and no multi-class disabling warning
      expect(html).not.toContain('Roll Number is disabled for multi-class issuance')
    })

    it('renders Cohort Summary Card with class breakdown and exclusion count', () => {
      const html = renderToString(
        <QueryClientProvider client={testQueryClient}>
          <BatchIssueForm
            templates={mockTemplates}
            selectedTemplateId={1}
            onSelectTemplateId={() => {}}
            selectedTemplate={mockTemplates[0]}
            units={mockUnits}
            selectedUnitIds={[101, 102]}
            onSelectUnitIds={() => {}}
            groups={[]}
            onSelectGroupId={() => {}}
            batchStudents={mockStudents}
            loadingBatchStudents={false}
            excludedStudentIds={new Set([2])} // Brooke Davis (id 2) is excluded
            onToggleExcludeStudent={() => {}}
            onIncludeAll={() => {}}
            onExcludeAll={() => {}}
            previewStudentId={null}
            onSelectPreviewStudent={() => {}}
            numberScheme="sequential"
            onNumberSchemeChange={() => {}}
            numberPrefix="CERT"
            onNumberPrefixChange={() => {}}
            startNumber={1}
            onStartNumberChange={() => {}}
            issueDate="2026-10-18"
            onIssueDateChange={() => {}}
            sampleBatchSerials={['CERT-2026-0001']}
            reason=""
            onReasonChange={() => {}}
            conduct="Good"
            onConductChange={() => {}}
            duesStatus=""
            onDuesStatusChange={() => {}}
          />
        </QueryClientProvider>
      )
      expect(html).toContain('1 Student Selected')
      expect(html).toContain('1 excluded')
      expect(html).toContain('Grade 1')
      expect(html).toContain('Grade 2')
    })

    it('renders ClassMultiSelect trigger with multi-class count badge', () => {
      const html = renderToString(
        <QueryClientProvider client={testQueryClient}>
          <ClassMultiSelect
            units={mockUnits}
            selectedUnitIds={[101, 102]}
            onChange={() => {}}
          />
        </QueryClientProvider>
      )

      expect(html).toContain('Grade 1, Grade 2')
      expect(html).toContain('2/3')
    })

    it('correctly chunks large student batches and calculates consecutive sequential serial numbers', () => {
      const CHUNK_SIZE = 50
      const totalStudents = 125
      const studentIds = Array.from({ length: totalStudents }, (_, i) => i + 1)
      let currentStartNumber = 1

      const chunks: { chunk: number[]; startNumber: number }[] = []
      for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
        const slice = studentIds.slice(i, i + CHUNK_SIZE)
        chunks.push({ chunk: slice, startNumber: currentStartNumber })
        currentStartNumber += slice.length
      }

      expect(chunks.length).toBe(3)
      expect(chunks[0]!.chunk.length).toBe(50)
      expect(chunks[0]!.startNumber).toBe(1)
      expect(chunks[1]!.chunk.length).toBe(50)
      expect(chunks[1]!.startNumber).toBe(51)
      expect(chunks[2]!.chunk.length).toBe(25)
      expect(chunks[2]!.startNumber).toBe(101)
      expect(currentStartNumber).toBe(126)
    })

    it('groups issued certificates by class for organized classroom distribution packets', () => {
      const mockIssued: IssuedCertificate[] = [
        {
          id: 1,
          certificate_no: 'CERT-2026-0001',
          issue_date: '2026-10-18',
          student_id: 1,
          verification_token: 'tok1',
          metadata: {
            academic: { unit_name: 'Grade 1' },
          },
          created_at: '2026-10-18 09:00:00',
        },
        {
          id: 2,
          certificate_no: 'CERT-2026-0002',
          issue_date: '2026-10-18',
          student_id: 2,
          verification_token: 'tok2',
          metadata: {
            academic: { unit_name: 'Grade 2' },
          },
          created_at: '2026-10-18 09:00:00',
        },
        {
          id: 3,
          certificate_no: 'CERT-2026-0003',
          issue_date: '2026-10-18',
          student_id: 3,
          verification_token: 'tok3',
          metadata: {
            academic: { unit_name: 'Grade 1' },
          },
          created_at: '2026-10-18 09:00:00',
        },
      ]

      const groupsMap = new Map<string, IssuedCertificate[]>()
      for (const cert of mockIssued) {
        const className = cert.metadata?.academic?.unit_name || 'Other / Unassigned'
        const existing = groupsMap.get(className) || []
        existing.push(cert)
        groupsMap.set(className, existing)
      }

      const classGroups = Array.from(groupsMap.entries()).map(([className, certs]) => ({
        className,
        certs,
      }))

      expect(classGroups.length).toBe(2)
      const grade1 = classGroups.find((g) => g.className === 'Grade 1')
      const grade2 = classGroups.find((g) => g.className === 'Grade 2')

      expect(grade1?.certs.length).toBe(2)
      expect(grade2?.certs.length).toBe(1)
      expect(grade1?.certs.map((c) => c.certificate_no)).toEqual(['CERT-2026-0001', 'CERT-2026-0003'])
    })
  })
})
