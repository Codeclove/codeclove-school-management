import { useState, useRef, useMemo } from 'react'
import {
  FileText,
  Image as ImageIcon,
  Trash2,
  Upload,
  Download,
  Eye,
} from 'lucide-react'
import {
  Button,
  Input,
  Spinner,
  ConfirmDialog,
  DocumentPreviewModal,
} from '@/components/ui'
import {
  useAddStudentDocument,
  useDeleteStudentDocument,
  uploadStudentDocument,
  type FullStudent,
  type StudentDocument,
} from '@/api/students'
import { useToast } from '@/lib/toast'
import { useFormatter } from '@/lib/formatter'
import { __, sprintf } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface StudentDocumentsTabProps {
  student: FullStudent
  studentId: number
}

export function StudentDocumentsTab({ student, studentId }: StudentDocumentsTabProps) {
  const [docName, setDocName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [deletingDoc, setDeletingDoc] = useState<StudentDocument | null>(null)
  const [previewDoc, setPreviewDoc] = useState<StudentDocument | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toast = useToast()
  const { formatDate, formatBytes } = useFormatter()

  const addDocumentMutation = useAddStudentDocument(studentId)
  const deleteDocumentMutation = useDeleteStudentDocument(studentId)

  const documents = student.documents || []

  const totalSizeBytes = useMemo(() => {
    return documents.reduce((acc, doc) => acc + (Number(doc.file_size) || 0), 0)
  }, [documents])

  const handleFilesUpload = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList)
    if (incoming.length === 0) return

    const validFiles: File[] = []
    for (const file of incoming) {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const isAllowed =
        ['pdf', 'jpg', 'jpeg', 'png'].includes(ext) ||
        file.type === 'application/pdf' ||
        file.type === 'image/jpeg' ||
        file.type === 'image/png'

      if (!isAllowed) {
        toast.error(
          sprintf(
            __( 'File "%s" skipped: Only PDF, JPG, and PNG documents are allowed.', 'codeclove-school-management' ),
            file.name
          )
        )
        continue
      }

      if (file.size > 15 * 1024 * 1024) {
        toast.error(
          sprintf(
            __( 'File "%s" exceeds maximum allowed size of 15MB.', 'codeclove-school-management' ),
            file.name
          )
        )
        continue
      }

      validFiles.push(file)
    }

    if (validFiles.length === 0) return

    setIsUploading(true)
    try {
      for (const file of validFiles) {
        const customName = validFiles.length === 1 && docName.trim() ? docName.trim() : ''

        const newDoc = await uploadStudentDocument(file, customName)
        await addDocumentMutation.mutateAsync({
          attachment_id: newDoc.attachment_id,
          name: newDoc.name,
          title: newDoc.title,
          url: newDoc.url,
          file_size: newDoc.file_size,
        })
      }

      setDocName('')
      if (fileInputRef.current) fileInputRef.current.value = ''

      toast.success(
        validFiles.length === 1
          ? __( 'Document uploaded successfully.', 'codeclove-school-management' )
          : sprintf(
              __( '%d documents uploaded successfully.', 'codeclove-school-management' ),
              validFiles.length
            )
      )
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : __( 'Failed to upload document.', 'codeclove-school-management' )
      )
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await handleFilesUpload(e.target.files)
    }
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (isUploading || addDocumentMutation.isPending) return
    if (e.dataTransfer.files) {
      await handleFilesUpload(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isUploading && !addDocumentMutation.isPending) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingDoc) return
    try {
      await deleteDocumentMutation.mutateAsync(deletingDoc.id)
      toast.success(__( 'Document removed successfully.', 'codeclove-school-management' ))
      setDeletingDoc(null)
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : __( 'Failed to delete document.', 'codeclove-school-management' )
      )
    }
  }

  return (
    <div className="divide-y divide-border">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text tracking-tight">
            {__( 'Student Documents', 'codeclove-school-management' )}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            {__( 'Official PDF records, JPG/PNG scans, and certificates for this student.', 'codeclove-school-management' )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          {documents.length > 0 && (
            <span className="hidden sm:inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full bg-bg-surface border border-border text-text font-mono tabular-nums shadow-2xs">
              {sprintf(
                documents.length === 1
                  ? __( '%d file', 'codeclove-school-management' )
                  : __( '%d files', 'codeclove-school-management' ),
                documents.length
              )}
              {totalSizeBytes > 0 && ` • ${formatBytes(totalSizeBytes)}`}
            </span>
          )}

          <div className="w-full sm:w-60">
            <label htmlFor="student-doc-name-input" className="sr-only">
              {__( 'Document Name', 'codeclove-school-management' )}
            </label>
            <Input
              id="student-doc-name-input"
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder={__( 'Document Name (optional)', 'codeclove-school-management' )}
              disabled={isUploading || addDocumentMutation.isPending}
              className="h-7.5 text-xs"
            />
          </div>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || addDocumentMutation.isPending}
            className="gap-1.5 text-xs h-7.5 px-3 font-semibold shadow-xs shrink-0"
          >
            {isUploading || addDocumentMutation.isPending ? (
              <>
                <Spinner size="xs" />
                <span>{__( 'Uploading...', 'codeclove-school-management' )}</span>
              </>
            ) : (
              <>
                <Upload size={13} />
                <span>{__( 'Upload Document', 'codeclove-school-management' )}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Hidden File Input & Accessible Document Name Target */}
      <input
        ref={fileInputRef}
        id="student-doc-file-input"
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={handleFileUpload}
        disabled={isUploading || addDocumentMutation.isPending}
      />

      {/* ─── Documents List or Clean Empty State ────────────────────────────── */}
      {documents.length === 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'p-12 flex flex-col items-center justify-center text-center space-y-3 transition-colors',
            isDragging && 'bg-brand/5 ring-2 ring-brand ring-inset'
          )}
        >
          <div className="w-12 h-12 rounded-full bg-brand-dim flex items-center justify-center text-brand/80">
            <Upload size={22} />
          </div>
          <div>
            <p className="text-sm font-bold text-text">
              {__( 'No documents on file', 'codeclove-school-management' )}
            </p>
            <p className="text-xs text-text-muted max-w-sm leading-normal mt-0.5">
              {__( 'Upload birth certificates, transfer certificates, or official records in PDF, JPG, or PNG format up to 15MB each.', 'codeclove-school-management' )}
            </p>
          </div>
          <div className="pt-1">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || addDocumentMutation.isPending}
              className="gap-1.5 text-xs h-8 px-4 font-semibold shadow-xs"
            >
              {isUploading || addDocumentMutation.isPending ? (
                <>
                  <Spinner size="xs" />
                  <span>{__( 'Uploading...', 'codeclove-school-management' )}</span>
                </>
              ) : (
                <>
                  <Upload size={13} />
                  <span>{__( 'Upload Document', 'codeclove-school-management' )}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'divide-y divide-border transition-colors',
            isDragging && 'bg-brand/5 ring-2 ring-brand ring-inset'
          )}
        >
          {documents.map((doc) => {
            const displayName = doc.title || doc.name || 'Document.pdf'
            const fileSizeText = formatBytes(doc.file_size)
            const dateText = doc.uploaded_at ? formatDate(doc.uploaded_at) : ''
            const isImg = Boolean(
              doc.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(doc.name)
            )
            const hasValidUrl = Boolean(doc.url && (/^https?:\/\//i.test(doc.url) || doc.url.startsWith('/')))

            return (
              <div
                key={doc.id}
                className="px-6 py-3.5 flex items-center justify-between text-xs hover:bg-hover-bg/40 transition-colors"
              >
                {/* Left: Icon + Title + Meta */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-4">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg border flex items-center justify-center shrink-0',
                      isImg
                        ? 'bg-sky-500/10 text-sky-500 border-sky-500/20'
                        : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    )}
                  >
                    {isImg ? (
                      <ImageIcon className="w-4.5 h-4.5" />
                    ) : (
                      <FileText className="w-4.5 h-4.5" />
                    )}
                  </div>

                  <div
                    className={cn(
                      'min-w-0 flex-1',
                      hasValidUrl && 'cursor-pointer group'
                    )}
                    onClick={() => {
                      if (hasValidUrl) setPreviewDoc(doc)
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <h4
                        className="text-xs font-semibold text-text truncate group-hover:text-brand transition-colors"
                        title={displayName}
                      >
                        {displayName}
                      </h4>
                      <span className="px-1.5 py-0.2 rounded text-3xs font-mono font-medium uppercase bg-bg-surface border border-border text-text-muted">
                        {isImg ? 'IMG' : 'PDF'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-2xs text-text-muted font-mono mt-0.5">
                      {doc.name && doc.name !== displayName && (
                        <span className="text-text-subtle truncate max-w-[220px]" title={doc.name}>
                          {doc.name}
                        </span>
                      )}
                      {doc.name && doc.name !== displayName && fileSizeText && <span>•</span>}
                      {fileSizeText && <span className="tabular-nums">{fileSizeText}</span>}
                      {dateText && <span>•</span>}
                      {dateText && <span>{dateText}</span>}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasValidUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="inline-flex items-center gap-1 h-7.5 px-2.5 rounded-md text-xs font-medium text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                      title={__( 'View document', 'codeclove-school-management' )}
                    >
                      <Eye size={13} />
                      <span>{__( 'View', 'codeclove-school-management' )}</span>
                    </button>
                  )}

                  {hasValidUrl && (
                    <a
                      href={`${doc.url}${doc.url?.includes('?') ? '&' : '?'}download=1`}
                      download={doc.name || displayName}
                      className="inline-flex items-center justify-center h-7.5 w-7.5 rounded-md text-text-muted hover:text-text hover:bg-hover-bg transition-colors"
                      title={__( 'Download document', 'codeclove-school-management' )}
                    >
                      <Download size={13} />
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingDoc(doc)}
                    className="text-text-muted hover:text-danger hover:bg-danger/10 p-1 h-7.5 w-7.5"
                    title={__( 'Delete document', 'codeclove-school-management' )}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            )
          })}

          {/* Slim Drag and Drop Footer */}
          <div className="px-6 py-3.5 bg-bg-surface/20">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border border-dashed rounded-lg p-3 text-center transition-colors flex items-center justify-center gap-2 text-xs text-text-muted cursor-pointer hover:bg-bg-surface/50',
                isDragging ? 'border-brand bg-brand/5 text-brand' : 'border-border hover:border-brand/50'
              )}
            >
              <Upload size={14} className={isDragging ? 'text-brand' : 'text-text-subtle'} />
              <span>
                {__( 'Drag and drop additional PDF, JPG, or PNG files here, or click to upload.', 'codeclove-school-management' )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Dialog ─────────────────────────────────────── */}
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

      {/* ─── In-App Document Preview Modal ───────────────────────────────────── */}
      <DocumentPreviewModal
        open={Boolean(previewDoc)}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        document={previewDoc}
      />
    </div>
  )
}
