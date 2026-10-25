import * as React from 'react'
import {
  FileText,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  Pencil,
  Check,
  X,
  ExternalLink,
} from 'lucide-react'
import { Button, Input, Spinner } from '@/components/ui'
import { api } from '@/lib/api-client'
import { useToast } from '@/lib/toast'
import { __, sprintf } from '@/lib/i18n'
import { formatBytes } from '@/lib/formatter'
import { cn } from '@/lib/utils'

export interface ManagedDocument {
  id: string
  name: string
  title?: string
  attachment_id?: number
  url?: string
  file_size?: number | null
  mime_type?: string
  uploaded_at?: string
  /** Local un-uploaded pending File object waiting for form submission */
  file?: File
}

export interface DocumentManagerProps {
  /** Array of documents (saved or pending) */
  documents: ManagedDocument[]
  /** State updater callback */
  onChange: (docs: ManagedDocument[]) => void
  /** Read-only or form submitting state */
  disabled?: boolean
  /** Controlled uploading indicator when submitting */
  isUploading?: boolean
  /** Custom heading title */
  title?: React.ReactNode
  /** Custom helper description */
  description?: React.ReactNode
  /** Maximum single file size in megabytes (default: 15) */
  maxFileMb?: number
  /** Additional container styling */
  className?: string
}

/**
 * Uploads all pending files concurrently to the WordPress media vault
 * and returns the fully resolved document list ready for saving in database.
 *
 * @param documents Current document list containing potential local pending File objects.
 * @param type Upload restriction type ('pdf' or 'document').
 * @return Resolved document array with valid attachment IDs and secure URLs.
 */
export async function uploadPendingDocuments(
  documents: ManagedDocument[],
  type: 'pdf' | 'document' = 'document'
): Promise<ManagedDocument[]> {
  const pending = documents.filter((d) => d.file instanceof File)
  if (pending.length === 0) {
    return documents
  }

  return Promise.all(
    documents.map(async (doc) => {
      if (!doc.file || !(doc.file instanceof File)) {
        return doc
      }

      const formData = new FormData()
      formData.append('file', doc.file)
      formData.append('type', type)

      const res = await api.post<{
        id: number
        url: string
        file_name?: string
        file_size?: number
        mime_type?: string
      }>('media/upload', formData)

      if (!res.success || !res.data?.id) {
        const resObj = typeof res === 'object' && res !== null ? res : null
        const msg = resObj && 'message' in resObj && typeof resObj.message === 'string'
          ? resObj.message
          : sprintf( __( 'Failed to upload document: %s', 'codeclove-school-management' ), doc.name )
        throw new Error(msg)
      }

      const ext = doc.file.name.split('.').pop()?.toLowerCase() || ''
      const rawName = doc.name.trim()
      const title = doc.title || (rawName ? rawName.replace(/\.[^/.]+$/, '') : doc.file.name.replace(/\.[^/.]+$/, ''))
      const cleanName = res.data.file_name || (rawName ? (rawName.includes('.') ? rawName : `${rawName}.${ext || 'pdf'}`) : doc.file.name)

      return {
        id: 'doc_' + Math.random().toString(36).substring(2, 9),
        name: cleanName,
        title,
        attachment_id: res.data.id,
        url: res.data.url,
        file_size: res.data.file_size || doc.file.size,
        mime_type: res.data.mime_type || doc.file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        uploaded_at: new Date().toISOString(),
      }
    })
  )
}

/**
 * DocumentManager — Reusable multi-document upload and management component.
 *
 * Implements:
 * - Deferred upload pattern (commit-on-save: no orphaned files on cancel/abort).
 * - Multi-file selection & drag-and-drop dropzone.
 * - Inline document renaming / editing.
 * - Safe document removal (auto-reclaims server storage on save).
 * - Visual status badges (Pending save vs Saved).
 */
export function DocumentManager({
  documents,
  onChange,
  disabled = false,
  isUploading = false,
  title,
  description,
  maxFileMb = 15,
  className,
}: DocumentManagerProps) {
  const toast = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  // Inline rename state
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null)
  const [editName, setEditName] = React.useState('')

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    const incoming = Array.from(fileList)
    const validDocs: File[] = []
    let skippedCount = 0

    for (const file of incoming) {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const isAllowed = ['pdf', 'jpg', 'jpeg', 'png'].includes(ext) || file.type === 'application/pdf' || file.type.startsWith('image/')
      if (!isAllowed) {
        skippedCount++
        continue
      }
      if (file.size > maxFileMb * 1024 * 1024) {
        toast.error(
          sprintf(
            __( '%s exceeds maximum allowed size of %dMB.', 'codeclove-school-management' ),
            file.name,
            maxFileMb
          )
        )
        continue
      }
      validDocs.push(file)
    }

    if (skippedCount > 0) {
      toast.error(
        sprintf(
          __( 'Skipped %d unsupported file(s). Only PDF, JPG, and PNG documents are allowed.', 'codeclove-school-management' ),
          skippedCount
        )
      )
    }

    if (validDocs.length === 0) return

    const newDocs: ManagedDocument[] = validDocs.map((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const title = file.name.replace(/\.[^/.]+$/, '')
      return {
        id: 'pending_' + Math.random().toString(36).substring(2, 9),
        name: file.name,
        title,
        attachment_id: 0,
        url: '',
        file_size: file.size,
        mime_type: file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        uploaded_at: new Date().toISOString(),
        file,
      }
    })

    onChange([...documents, ...newDocs])

    if (validDocs.length === 1) {
      toast.success(__( 'Document attached. It will be uploaded when saving.', 'codeclove-school-management' ))
    } else {
      toast.success(
        sprintf(
          __( 'Attached %d documents. They will be uploaded when saving.', 'codeclove-school-management' ),
          validDocs.length
        )
      )
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled || isUploading) return
    handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isUploading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const startRename = (index: number, doc: ManagedDocument) => {
    setEditingIndex(index)
    setEditName(doc.title || doc.name.replace(/\.[^/.]+$/, ''))
  }

  const saveRename = (index: number) => {
    const trimmed = editName.trim()
    if (!trimmed) {
      setEditingIndex(null)
      return
    }

    onChange(
      documents.map((d, idx) => {
        if (idx === index) {
          const ext = d.name.split('.').pop()?.toLowerCase() || 'pdf'
          const cleanTitle = trimmed.replace(/\.[^/.]+$/, '')
          return {
            ...d,
            title: cleanTitle,
            name: `${cleanTitle}.${ext}`,
          }
        }
        return d
      })
    )
    setEditingIndex(null)
    toast.success(__( 'Document label updated.', 'codeclove-school-management' ))
  }

  const cancelRename = () => {
    setEditingIndex(null)
    setEditName('')
  }

  const removeDocument = (index: number) => {
    onChange(documents.filter((_, idx) => idx !== index))
  }


  return (
    <div className={cn('space-y-4', className)}>
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h4 className="text-sm font-semibold text-text tracking-tight flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand" />
              <span>{title}</span>
            </h4>
          )}
          {description && (
            <p className="text-xs text-text-muted leading-relaxed">{description}</p>
          )}
        </div>
      )}

      {/* ─── Dropzone & Browse ─────────────────────────────────────────────── */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => {
          if (!disabled && !isUploading) {
            fileInputRef.current?.click()
          }
        }}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2',
          isDragging
            ? 'border-brand bg-brand/5 scale-[0.995]'
            : 'border-border/80 bg-bg-surface/50 hover:border-brand/50 hover:bg-hover-bg/40',
          (disabled || isUploading) && 'opacity-60 cursor-not-allowed pointer-events-none'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          disabled={disabled || isUploading}
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center shadow-2xs">
          {isUploading ? (
            <Spinner size="sm" className="text-brand" />
          ) : (
            <UploadCloud className="w-5 h-5" />
          )}
        </div>

        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-text">
            <span className="text-brand underline decoration-brand/30 hover:decoration-brand">
              {__( 'Click to browse', 'codeclove-school-management' )}
            </span>{' '}
            <span className="text-text-muted">{__( 'or drag and drop multiple PDF, JPG, or PNG documents', 'codeclove-school-management' )}</span>
          </p>
          <p className="text-[11px] text-text-muted/80">
            {sprintf( __( 'PDF, JPG, or PNG files up to %dMB each. Attached files are uploaded upon saving.', 'codeclove-school-management' ), maxFileMb )}
          </p>
        </div>
      </div>

      {/* ─── Documents List ────────────────────────────────────────────────── */}
      {documents.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-text-muted px-1 font-semibold">
            <span>{sprintf( __( 'Attached Documents (%d)', 'codeclove-school-management' ), documents.length )}</span>
            <span>{__( 'Actions', 'codeclove-school-management' )}</span>
          </div>

          <div className="divide-y divide-border/60 border border-border/70 rounded-xl overflow-hidden bg-bg-surface shadow-2xs">
            {documents.map((doc, idx) => {
              const displayName = doc.name || (doc.title ? `${doc.title}.pdf` : 'Document.pdf')
              const sizeText = formatBytes(doc.file_size)
              const isPendingDoc = Boolean(doc.file instanceof File || !doc.attachment_id)
              const isEditing = editingIndex === idx

              return (
                <div
                  key={doc.id || `doc_${idx}`}
                  className="flex items-center justify-between px-3.5 py-2.5 gap-3 hover:bg-hover-bg/50 transition-colors text-xs group"
                >
                  {/* Left: Icon + Title / Rename Input */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {(() => {
                      const isImg = Boolean(doc.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(doc.name))
                      if (isImg) {
                        return (
                          <div className="w-7 h-7 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </div>
                        )
                      }
                      return (
                        <div className="w-7 h-7 rounded-md bg-danger/10 text-danger flex items-center justify-center shrink-0 border border-danger/20">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                      )
                    })()}

                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 max-w-sm">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              e.stopPropagation()
                              saveRename(idx)
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              e.stopPropagation()
                              cancelRename()
                            }
                          }}
                          autoFocus
                          className="h-8 text-xs px-2.5 bg-bg-surface border-border"
                          placeholder={__( 'Document label', 'codeclove-school-management' )}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => saveRename(idx)}
                          title={__( 'Save label', 'codeclove-school-management' )}
                          className="h-8 px-2.5 text-xs text-brand hover:bg-brand/10 shrink-0 font-medium"
                        >
                          <Check size={13} className="mr-1" />
                          <span>{__( 'Save', 'codeclove-school-management' )}</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={cancelRename}
                          title={__( 'Cancel', 'codeclove-school-management' )}
                          className="h-8 w-8 p-0 text-text-muted hover:text-text shrink-0"
                        >
                          <X size={13} />
                        </Button>
                      </div>
                    ) : (
                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-text truncate max-w-xs sm:max-w-md" title={displayName}>
                            {doc.title || displayName}
                          </p>
                          <button
                            type="button"
                            onClick={() => startRename(idx, doc)}
                            disabled={disabled || isUploading}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-text-muted hover:text-brand hover:bg-brand/10 rounded transition-all cursor-pointer"
                            title={__( 'Rename document label', 'codeclove-school-management' )}
                          >
                            <Pencil size={11} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
                          {doc.title && doc.name && doc.title !== doc.name && (
                            <span className="text-text-muted/70 truncate max-w-[180px]">{doc.name}</span>
                          )}
                          {sizeText && <span>{sizeText}</span>}
                          {isPendingDoc ? (
                            <span className="inline-flex items-center text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded font-medium">
                              {__( 'Pending save', 'codeclove-school-management' )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded font-medium">
                              {__( 'Saved', 'codeclove-school-management' )}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* View Button */}
                    {doc.url && (/^https?:\/\//i.test(doc.url) || doc.url.startsWith('/')) ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-brand hover:bg-brand/10 transition-colors"
                        title={__( 'View secured document', 'codeclove-school-management' )}
                      >
                        <ExternalLink size={12} />
                        <span>{__( 'View', 'codeclove-school-management' )}</span>
                      </a>
                    ) : null}
                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => removeDocument(idx)}
                      disabled={disabled || isUploading}
                      className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                      title={__( 'Remove document', 'codeclove-school-management' )}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
