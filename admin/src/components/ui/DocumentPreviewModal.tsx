import {
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
} from 'lucide-react'
import { Modal } from './Modal'
import { useFormatter } from '@/lib/formatter'
import { __ } from '@/lib/i18n'

export interface PreviewableDocument {
  id?: string
  name?: string
  title?: string
  url?: string
  file_size?: number | null
  mime_type?: string
  uploaded_at?: string
}

export interface DocumentPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: PreviewableDocument | null
}

export function DocumentPreviewModal({
  open,
  onOpenChange,
  document: doc,
}: DocumentPreviewModalProps) {
  const { formatDate, formatBytes } = useFormatter()

  if (!doc) return null

  const displayName = doc.title || doc.name || __( 'Document', 'codeclove-school-management' )
  const fileName = doc.name || displayName

  const isPdf = Boolean(
    doc.mime_type === 'application/pdf' ||
    (doc.name && /\.pdf$/i.test(doc.name)) ||
    (doc.url && /\.pdf(\?.*)?$/i.test(doc.url))
  )

  const isImg = Boolean(
    doc.mime_type?.startsWith('image/') ||
    (doc.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.name)) ||
    (doc.url && /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(doc.url))
  )

  const isSafeUrl = Boolean(doc.url && (/^https?:\/\//i.test(doc.url) || doc.url.startsWith('/')))
  const downloadUrl = isSafeUrl && doc.url ? `${doc.url}${doc.url.includes('?') ? '&' : '?'}download=1` : ''

  const metaParts: string[] = []
  if (fileName && fileName !== displayName) metaParts.push(fileName)
  if (doc.file_size) metaParts.push(formatBytes(doc.file_size))
  if (doc.uploaded_at) metaParts.push(formatDate(doc.uploaded_at))
  const metaText = metaParts.join(' • ')

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={
        <div className="flex items-center gap-2.5 min-w-0">
          {isPdf ? (
            <div className="p-1.5 rounded bg-danger/10 text-danger shrink-0">
              <FileText size={18} />
            </div>
          ) : (
            <div className="p-1.5 rounded bg-brand/10 text-brand shrink-0">
              <ImageIcon size={18} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-text truncate" title={displayName}>
              {displayName}
            </span>
            {metaText && (
              <p className="text-2xs text-text-muted truncate mt-0.5">
                {metaText}
              </p>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-end gap-2 -mt-1 pb-1 border-b border-border/60">
          {downloadUrl && (
            <a
              href={downloadUrl}
              download={fileName}
              className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded text-xs font-medium bg-bg-surface border border-border hover:bg-hover-bg text-text transition-colors"
              title={__( 'Download file', 'codeclove-school-management' )}
            >
              <Download size={13} className="text-text-muted" />
              <span>{__( 'Download', 'codeclove-school-management' )}</span>
            </a>
          )}

          {isSafeUrl && doc.url && (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded text-xs font-medium text-brand hover:bg-brand/10 transition-colors"
              title={__( 'Open in new tab', 'codeclove-school-management' )}
            >
              <ExternalLink size={13} />
              <span>{__( 'Open in Tab', 'codeclove-school-management' )}</span>
            </a>
          )}
        </div>

        {/* Document Frame / Canvas */}
        {isPdf && isSafeUrl && doc.url ? (
          <div className="w-full h-[58vh] max-h-[520px] rounded-lg overflow-hidden border border-border bg-bg-surface">
            <iframe
              src={doc.url}
              title={displayName}
              className="w-full h-full border-0"
            />
          </div>
        ) : isImg && isSafeUrl && doc.url ? (
          <div className="w-full min-h-[40vh] max-h-[58vh] flex items-center justify-center p-3 rounded-lg bg-black/90 border border-border overflow-auto">
            <img
              src={doc.url}
              alt={displayName}
              className="max-h-[54vh] max-w-full object-contain rounded shadow-sm select-none"
            />
          </div>
        ) : (
          <div className="py-12 px-4 text-center space-y-3 rounded-lg border border-dashed border-border bg-bg-surface/50">
            <FileText className="mx-auto h-10 w-10 text-text-muted" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-text">{displayName}</p>
              <p className="text-xs text-text-muted">
                {__( 'Direct in-browser preview is not available for this file type.', 'codeclove-school-management' )}
              </p>
            </div>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={fileName}
                className="inline-flex items-center gap-2 h-8 px-4 rounded text-xs font-medium bg-brand text-white hover:bg-brand/90 transition-colors"
              >
                <Download size={14} />
                <span>{__( 'Download Document', 'codeclove-school-management' )}</span>
              </a>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
