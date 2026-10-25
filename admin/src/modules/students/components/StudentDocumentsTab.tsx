import { useState } from 'react'
import { FileText, Image as ImageIcon, Trash2, ExternalLink } from 'lucide-react'
import {
  Button,
  EmptyState,
  FormGroupHeader,
  ConfirmDialog,
} from '@/components/ui'
import {
  useDeleteStudentDocument,
  type FullStudent,
  type StudentDocument,
} from '@/api/students'
import { useToast } from '@/lib/toast'
import { useFormatter } from '@/lib/formatter'
import { __, sprintf } from '@/lib/i18n'

interface StudentDocumentsTabProps {
  student: FullStudent
  studentId: number
}

export function StudentDocumentsTab({ student, studentId }: StudentDocumentsTabProps) {
  const [deletingDoc, setDeletingDoc] = useState<StudentDocument | null>(null)

  const toast = useToast()
  const { formatDate, formatBytes } = useFormatter()
  const deleteDocumentMutation = useDeleteStudentDocument(studentId)

  const documents = student.documents || []

  const handleDeleteConfirm = async () => {
    if (!deletingDoc) return
    try {
      await deleteDocumentMutation.mutateAsync(deletingDoc.id)
      toast.success(__( 'Document removed successfully.', 'codeclove-school-management' ))
      setDeletingDoc(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : __( 'Failed to delete document.', 'codeclove-school-management' ))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <FormGroupHeader
          title={__( 'Student Documents', 'codeclove-school-management' )}
          icon={FileText}
          description={__( 'Official PDF records, JPG/PNG scans, and certificates for this student.', 'codeclove-school-management' )}
        />
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={__( 'No documents on file', 'codeclove-school-management' )}
          description={__( 'No official records or certificates have been attached for this student.', 'codeclove-school-management' )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map((doc) => {
            const displayName = doc.name || (doc.title ? `${doc.title}.pdf` : 'Document.pdf')
            const fileSizeText = formatBytes(doc.file_size)
            const dateText = doc.uploaded_at ? formatDate(doc.uploaded_at) : ''
            const isImg = Boolean(doc.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(doc.name))

            return (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-bg-surface hover:border-brand/40 hover:bg-hover-bg transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border font-bold text-xs ${
                    isImg ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' : 'bg-danger/10 text-danger border-danger/20'
                  }`}>
                    {isImg ? <ImageIcon size={20} /> : <FileText size={20} />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-text truncate" title={displayName}>
                      {displayName}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
                      {fileSizeText && <span>{fileSizeText}</span>}
                      {fileSizeText && dateText && <span>•</span>}
                      {dateText && <span>{dateText}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {doc.url && (/^https?:\/\//i.test(doc.url) || doc.url.startsWith('/')) && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-brand hover:bg-brand/10 transition-colors"
                      title={__( 'View in new tab', 'codeclove-school-management' )}
                    >
                      <ExternalLink size={13} />
                      <span>{__( 'View', 'codeclove-school-management' )}</span>
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingDoc(doc)}
                    className="text-text-muted hover:text-danger hover:bg-danger/10 p-1.5 h-8 w-8"
                    title={__( 'Delete document', 'codeclove-school-management' )}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingDoc)}
        onOpenChange={(open) => !open && setDeletingDoc(null)}
        onConfirm={handleDeleteConfirm}
        title={__( 'Delete Document', 'codeclove-school-management' )}
        description={sprintf(
          __( 'Are you sure you want to remove "%s"? This action cannot be undone.', 'codeclove-school-management' ),
          deletingDoc?.name || ''
        )}
        confirmText={__( 'Delete', 'codeclove-school-management' )}
        variant="danger"
        isLoading={deleteDocumentMutation.isPending}
      />
    </div>
  )
}
