/**
 * NoticeFormattingToolbar — Minimalist inline formatting toolbar for notice content.
 *
 * Provides quick formatting buttons:
 *  - Bold (**text**)
 *  - Italic (*text*)
 *  - Bulleted List (- item)
 *  - Numbered List (1. item)
 *  - Callout (> item)
 *  - Link ([text](url))
 *
 * Directly calculates textarea selection ranges and triggers onChange.
 */

import React from 'react'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { __ } from '@/lib/i18n'

interface NoticeFormattingToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>
  value: string
  onChange: ( nextValue: string ) => void
  className?: string
}

type FormatAction = 'bold' | 'italic' | 'bullet' | 'number' | 'quote' | 'link'

function prefixLines(
  text: string,
  fallback: string,
  strip: RegExp,
  format: ( line: string, i: number ) => string,
  start: number,
  prefixLen = 2
): { text: string; offset: number; len: number } {
  const target = text || fallback
  return {
    text: target.split( '\n' ).map( ( l, i ) => format( l.replace( strip, '' ), i ) ).join( '\n' ),
    offset: start + prefixLen,
    len: target.length,
  }
}

export function NoticeFormattingToolbar( {
  textareaRef,
  value,
  onChange,
  className,
}: NoticeFormattingToolbarProps ) {
  const applyFormat = ( action: FormatAction ) => {
    const el = textareaRef.current
    if ( ! el ) return

    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const selectedText = value.slice( start, end )

    const wrap = ( prefix: string, suffix: string, fallback: string ) => {
      const text = selectedText || fallback
      return {
        text: `${prefix}${text}${suffix}`,
        offset: start + prefix.length,
        len: text.length,
      }
    }

    const link = selectedText
      ? { text: `[${selectedText}](https://)`, offset: start + selectedText.length + 3, len: 8 }
      : { text: '[Link title](https://example.com)', offset: start + 1, len: 10 }

    const res =
      action === 'bold'   ? wrap( '**', '**', 'bold text' ) :
      action === 'italic' ? wrap( '*', '*', 'italic text' ) :
      action === 'bullet' ? prefixLines( selectedText, 'List item', /^[-*]\s*/, ( l ) => `- ${l}`, start, 2 ) :
      action === 'number' ? prefixLines( selectedText, 'List item', /^\d+\.\s*/, ( l, i ) => `${i + 1}. ${l}`, start, 3 ) :
      action === 'quote'  ? prefixLines( selectedText, 'Important notice', /^>\s*/, ( l ) => `> ${l}`, start, 2 ) :
      link

    onChange( value.slice( 0, start ) + res.text + value.slice( end ) )
    requestAnimationFrame( () => {
      el.focus()
      el.setSelectionRange( res.offset, res.offset + res.len )
    } )
  }

  const buttons: Array<{ action: FormatAction; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { action: 'bold', label: __( 'Bold (Cmd+B)', 'codeclove-school-management' ), icon: Bold },
    { action: 'italic', label: __( 'Italic (Cmd+I)', 'codeclove-school-management' ), icon: Italic },
    { action: 'bullet', label: __( 'Bulleted List', 'codeclove-school-management' ), icon: List },
    { action: 'number', label: __( 'Numbered List', 'codeclove-school-management' ), icon: ListOrdered },
    { action: 'quote', label: __( 'Callout / Quote', 'codeclove-school-management' ), icon: Quote },
    { action: 'link', label: __( 'Insert Link', 'codeclove-school-management' ), icon: LinkIcon },
  ]

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 p-1 bg-bg-surface/80 rounded-t-lg border-b border-border text-text-subtle',
        className
      )}
      role="toolbar"
      aria-label={__( 'Notice formatting options', 'codeclove-school-management' )}
    >
      {buttons.map( ( btn ) => {
        const Icon = btn.icon
        return (
          <button
            key={btn.action}
            type="button"
            onClick={() => applyFormat( btn.action )}
            className="h-7 w-7 rounded-md flex items-center justify-center hover:text-text hover:bg-hover-bg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
            title={btn.label}
            aria-label={btn.label}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        )
      } )}
      <span className="ml-auto text-[11px] text-text-subtle/70 px-2 font-mono select-none">
        {__( 'Markdown supported', 'codeclove-school-management' )}
      </span>
    </div>
  )
}
