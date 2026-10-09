import { useState } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { NotebookPen, Check, X, MessageSquareText } from 'lucide-react'
import { __ } from '@/lib/i18n'

export interface AttendanceNotePopoverProps {
  note: string
  onChange: (note: string) => void
  disabled?: boolean
  studentName?: string
}

export function AttendanceNotePopover({
  note,
  onChange,
  disabled = false,
  studentName,
}: AttendanceNotePopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempNote, setTempNote] = useState(note)

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setTempNote(note)
    }
    setIsOpen(open)
  }

  const handleSave = () => {
    onChange(tempNote)
    setIsOpen(false)
  }

  const handleClear = () => {
    setTempNote('')
    onChange('')
    setIsOpen(false)
  }

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      {note ? (
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="inline-flex items-center gap-1.5 max-w-[180px] sm:max-w-[260px] lg:max-w-[380px] px-2.5 py-1 text-xs font-medium rounded-lg bg-brand-dim/60 text-brand border border-brand/20 hover:bg-brand-dim transition-all truncate group shrink-0 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            title={note}
            aria-label={studentName ? `${__('Edit note for', 'codeclove-school-management')} ${studentName}` : __('Edit note', 'codeclove-school-management')}
          >
            <MessageSquareText size={13} className="flex-shrink-0 text-brand" />
            <span className="truncate">{note}</span>
          </button>
        </PopoverPrimitive.Trigger>
      ) : (
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs font-medium text-text-muted hover:text-text bg-bg-surface hover:bg-hover-bg rounded-md border border-dashed border-border/80 hover:border-border transition-all shrink-0 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            title={__('Add Note', 'codeclove-school-management')}
            aria-label={studentName ? `${__('Add note for', 'codeclove-school-management')} ${studentName}` : __('Add note', 'codeclove-school-management')}
          >
            <NotebookPen size={12} className="text-text-subtle shrink-0" />
            <span>{__('Add note', 'codeclove-school-management')}</span>
          </button>
        </PopoverPrimitive.Trigger>
      )}

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          className="z-[100050] w-72 p-3.5 bg-bg-overlay border border-border/80 rounded-2xl shadow-2xl space-y-3 animate-slide-down outline-none"
        >
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <span className="text-xs font-bold text-text flex items-center gap-1.5">
              <NotebookPen size={13} className="text-brand" />
              {__('Attendance Note', 'codeclove-school-management')}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-text-muted hover:text-text hover:bg-hover-bg p-1 rounded-md transition-colors"
              aria-label={__('Close note popover', 'codeclove-school-management')}
            >
              <X size={14} />
            </button>
          </div>

          <textarea
            value={tempNote}
            onChange={(e) => setTempNote(e.target.value)}
            placeholder={__('Type reason or observation...', 'codeclove-school-management')}
            rows={3}
            className="w-full p-2.5 text-xs bg-bg-surface border border-border/60 rounded-xl text-text placeholder:text-text-subtle focus:outline-none focus:ring-1 focus:ring-brand/40 resize-none"
            autoFocus
          />

          <div className="flex items-center justify-between pt-1">
            {note ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-2xs font-medium text-danger hover:underline transition-colors"
              >
                {__('Clear Note', 'codeclove-school-management')}
              </button>
            ) : <span />}

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 text-2xs font-medium text-text-muted hover:text-text bg-bg-surface hover:bg-hover-bg rounded-lg border border-border transition-colors"
              >
                {__('Cancel', 'codeclove-school-management')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1 px-3 py-1 text-2xs font-bold text-text-inverted bg-brand hover:bg-brand-strong rounded-lg shadow-sm transition-colors"
              >
                <Check size={12} />
                {__('Save', 'codeclove-school-management')}
              </button>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
