/**
 * FormattedNoticeContent — Safe, dependency-free formatter for announcement text.
 *
 * Supports:
 *  - Paragraph breaks and line breaks
 *  - **bold** and *italic* inline text
 *  - Bulleted lists (- item or * item)
 *  - Numbered lists (1. item)
 *  - Blockquote callouts (> callout text)
 *  - Inline links ([title](url))
 *
 * Emits native React elements — 100% immune to XSS, zero external dependencies.
 */

import React, { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormattedNoticeContentProps {
  content?: string | null
  className?: string
}

/**
 * Parses inline tokens (bold, italic, markdown links) into React elements.
 */
function parseInlineFormatting( text: string ): React.ReactNode[] {
  // Regex to match:
  // 1. [link text](url)
  // 2. **bold**
  // 3. *italic*
  const pattern = /(\[[^\]]+\]\([^\)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g
  const parts = text.split( pattern )

  return parts.map( ( part, idx ) => {
    if ( ! part ) return null

    // Markdown link: [text](url)
    const linkMatch = part.match( /^\[([^\]]+)\]\((https?:\/\/[^\s\)]+|\/[^\s\)]+)\)$/ )
    if ( linkMatch ) {
      const [, label, url] = linkMatch
      return (
        <a
          key={idx}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={( e ) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 text-brand hover:underline font-medium underline-offset-2"
        >
          <span>{label}</span>
          <ExternalLink className="w-3 h-3 inline shrink-0" />
        </a>
      )
    }

    // Bold: **text**
    if ( part.startsWith( '**' ) && part.endsWith( '**' ) && part.length >= 4 ) {
      return (
        <strong key={idx} className="font-semibold text-text">
          {part.slice( 2, -2 )}
        </strong>
      )
    }

    // Italic: *text*
    if ( part.startsWith( '*' ) && part.endsWith( '*' ) && part.length >= 2 ) {
      return (
        <em key={idx} className="italic">
          {part.slice( 1, -1 )}
        </em>
      )
    }

    return part
  } )
}

export function FormattedNoticeContent( {
  content,
  className,
}: FormattedNoticeContentProps ) {
  const blocks = useMemo( () => {
    if ( ! content || ! content.trim() ) return []

    const rawBlocks = content.trim().split( /\n{2,}/ )
    return rawBlocks.map( ( rawBlock, bIdx ) => {
      const lines = rawBlock.split( '\n' )

      // 1. Check if block is a bulleted list
      const isBulletList = lines.every( ( l ) => /^[-*]\s+/.test( l.trim() ) )
      if ( isBulletList ) {
        return (
          <ul key={bIdx} className="list-disc pl-5 my-1.5 space-y-1 text-text">
            {lines.map( ( line, lIdx ) => (
              <li key={lIdx} className="leading-relaxed">
                {parseInlineFormatting( line.trim().replace( /^[-*]\s+/, '' ) )}
              </li>
            ) )}
          </ul>
        )
      }

      // 2. Check if block is a numbered list
      const isNumberedList = lines.every( ( l ) => /^\d+\.\s+/.test( l.trim() ) )
      if ( isNumberedList ) {
        return (
          <ol key={bIdx} className="list-decimal pl-5 my-1.5 space-y-1 text-text">
            {lines.map( ( line, lIdx ) => (
              <li key={lIdx} className="leading-relaxed">
                {parseInlineFormatting( line.trim().replace( /^\d+\.\s+/, '' ) )}
              </li>
            ) )}
          </ol>
        )
      }

      // 3. Check if block is a blockquote / callout
      const isCallout = lines.every( ( l ) => /^>\s*/.test( l.trim() ) )
      if ( isCallout ) {
        return (
          <blockquote
            key={bIdx}
            className="border-l-3 border-brand/60 bg-brand/[0.04] dark:bg-brand/[0.08] px-3.5 py-2 my-2 rounded-r-lg text-text italic text-xs leading-relaxed"
          >
            {lines.map( ( line, lIdx ) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {parseInlineFormatting( line.trim().replace( /^>\s*/, '' ) )}
              </React.Fragment>
            ) )}
          </blockquote>
        )
      }

      // 4. Standard Paragraph
      return (
        <p key={bIdx} className="leading-relaxed mb-2 last:mb-0">
          {lines.map( ( line, lIdx ) => (
            <React.Fragment key={lIdx}>
              {lIdx > 0 && <br />}
              {parseInlineFormatting( line )}
            </React.Fragment>
          ) )}
        </p>
      )
    } )
  }, [content] )

  if ( ! content || ! content.trim() ) {
    return null
  }

  return (
    <div
      className={cn(
        'text-sm text-text-muted space-y-2',
        className
      )}
    >
      {blocks}
    </div>
  )
}
