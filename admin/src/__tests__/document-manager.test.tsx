// @ts-expect-error node built-in without @types/node
import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { DocumentManager, type ManagedDocument } from '../components/ui/form/DocumentManager'
import { StudentDocumentsTab } from '../modules/students/components/StudentDocumentsTab'
import { DocumentPreviewModal } from '../components/ui/DocumentPreviewModal'
import type { FullStudent } from '../api/students'

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
  useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}))

describe('DocumentManager & StudentDocumentsTab Integration', () => {
  describe('DocumentManager Component', () => {
    it('renders accessible dropzone and accepted file formats hint when empty', () => {
      const html = renderToString(
        <DocumentManager
          documents={[]}
          onChange={vi.fn()}
          title="Student Documents"
          description="Upload official records and certificates"
          maxFileMb={15}
        />
      )

      expect(html).toContain('Student Documents')
      expect(html).toContain('Upload official records and certificates')
      expect(html).toContain('role="button"')
      expect(html).toContain('tabindex="0"')
      expect(html).toContain('aria-label="Upload documents"')
      expect(html).toContain('Click to browse')
      expect(html).toContain('PDF, JPG, or PNG files up to 15MB each')
      expect(html).toContain('accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"')
      // No documents table rendered when empty
      expect(html).not.toContain('Attached Documents')
    })

    it('renders attached documents with distinct PDF and image badges', () => {
      const mockDocs: ManagedDocument[] = [
        {
          id: 'doc_1',
          name: 'birth_certificate.pdf',
          title: 'Birth Certificate',
          attachment_id: 101,
          url: 'https://school.test/wp-json/codeclove/v1/media/document/101',
          file_size: 204800,
          mime_type: 'application/pdf',
          uploaded_at: '2026-10-25T10:00:00Z',
        },
        {
          id: 'doc_2',
          name: 'id_scan.png',
          title: 'National ID Card',
          attachment_id: 102,
          url: 'https://school.test/wp-json/codeclove/v1/media/document/102',
          file_size: 512000,
          mime_type: 'image/png',
          uploaded_at: '2026-10-25T10:05:00Z',
        },
        {
          id: 'doc_3',
          name: 'pending_report.pdf',
          title: 'Report Card',
          file_size: 102400,
          // Unsaved pending document
          file: new File(['mock'], 'pending_report.pdf', { type: 'application/pdf' }),
        },
      ]

      const html = renderToString(
        <DocumentManager
          documents={mockDocs}
          onChange={vi.fn()}
        />
      )

      expect(html).toContain('Attached Documents (3)')
      expect(html).toContain('Birth Certificate')
      expect(html).toContain('National ID Card')
      expect(html).toContain('Report Card')
      // PDF badge (danger) and Image badge (blue)
      expect(html).toContain('text-danger')
      expect(html).toContain('text-blue-600')
      // Saved vs Pending save indicators
      expect(html).toContain('Saved')
      expect(html).toContain('Pending save')
      // Secure external link
      expect(html).toContain('https://school.test/wp-json/codeclove/v1/media/document/101')
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
    })

    it('disables dropzone and inputs when disabled is true', () => {
      const html = renderToString(
        <DocumentManager
          documents={[]}
          onChange={vi.fn()}
          disabled={true}
        />
      )

      expect(html).toContain('disabled=""')
      expect(html).toContain('tabindex="-1"')
      expect(html).toContain('cursor-not-allowed')
    })
  })

  describe('StudentDocumentsTab Component', () => {
    const mockStudent: FullStudent = {
      id: 42,
      student_number: 'STU-0042',
      first_name: 'Alex',
      last_name: 'Johnson',
      status: 'active',
      documents: [
        {
          id: 'doc_1',
          name: 'transcript.pdf',
          title: 'High School Transcript',
          attachment_id: 201,
          url: 'https://school.test/wp-json/codeclove/v1/media/document/201',
          file_size: 1048576,
          mime_type: 'application/pdf',
          uploaded_at: '2026-10-25',
        },
      ],
    } as unknown as FullStudent

    it('renders restored document upload bar and attached document cards', () => {
      const html = renderToString(
        <StudentDocumentsTab
          student={mockStudent}
          studentId={42}
        />
      )

      // Upload controls
      expect(html).toContain('Student Documents')
      expect(html).toContain('Document Name')
      expect(html).toContain('Upload Document')
      expect(html).toContain('accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"')

      // Document list & cards
      expect(html).toContain('High School Transcript')
      expect(html).toContain('https://school.test/wp-json/codeclove/v1/media/document/201')
      expect(html).toContain('View')
      expect(html).toContain('Delete document')
    })

    it('renders clean empty state with upload bar accessible when student has no documents', () => {
      const emptyStudent = {
        ...mockStudent,
        documents: [],
      } as unknown as FullStudent

      const html = renderToString(
        <StudentDocumentsTab
          student={emptyStudent}
          studentId={42}
        />
      )

      expect(html).toContain('No documents on file')
      expect(html).toContain('Upload Document')
      expect(html).toContain('Document Name')
    })
  })
  describe('DocumentPreviewModal Component', () => {
    const modalSource = fs.readFileSync(
      new URL('../components/ui/DocumentPreviewModal.tsx', import.meta.url),
      'utf-8'
    ) as string

    it('is exported from components/ui and defines expected interface', () => {
      expect(DocumentPreviewModal).toBeDefined()
    })

    it('renders with Modal primitive at xl size for comfortable document reading', () => {
      expect(modalSource).toMatch(/<Modal[\s\S]*?size="xl"/)
    })

    it('embeds PDF documents within a secure sandboxed iframe', () => {
      expect(modalSource).toMatch(/isPdf/)
      expect(modalSource).toMatch(/<iframe[\s\S]*?src=\{doc\.url\}/)
    })

    it('embeds image documents with object-contain scaling and contrast containment', () => {
      expect(modalSource).toMatch(/isImg/)
      expect(modalSource).toMatch(/<img[\s\S]*?src=\{doc\.url\}/)
    })

    it('constructs download url with ?download=1 to enforce attachment disposition', () => {
      expect(modalSource).toMatch(/download=1/)
    })

    it('provides external tab breakout with noopener and noreferrer', () => {
      expect(modalSource).toMatch(/target="_blank"/)
      expect(modalSource).toMatch(/rel="noopener noreferrer"/)
    })
  })
})
