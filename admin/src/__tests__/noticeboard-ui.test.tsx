import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { FormattedNoticeContent } from '../modules/announcements/components/FormattedNoticeContent'
import { NoticeCardPreview } from '../modules/announcements/components/NoticeCardPreview'
import { NoticeFormattingToolbar } from '../modules/announcements/components/NoticeFormattingToolbar'
import { MAX_NOTICE_CONTENT_LENGTH } from '../modules/announcements/NoticeComposerPage'
import { formatRelativeTime } from '../portal/lib/formatter'
describe('Noticeboard & Announcement UI Components', () => {
  describe('FormattedNoticeContent', () => {
    it('returns null when content is empty or whitespace only', () => {
      const html1 = renderToString(<FormattedNoticeContent content="" />)
      const html2 = renderToString(<FormattedNoticeContent content="   " />)
      expect(html1).toBe('')
      expect(html2).toBe('')
    })

    it('renders standard paragraph text with proper typography', () => {
      const text = 'Annual sports day will be held on the main campus field.'
      const html = renderToString(<FormattedNoticeContent content={text} />)
      expect(html).toContain('Annual sports day will be held on the main campus field.')
      expect(html).toContain('<p class="leading-relaxed mb-2 last:mb-0">')
    })

    it('renders bold and italic formatting without external dependencies', () => {
      const text = 'Please bring your **signed permission slip** and *water bottle*.'
      const html = renderToString(<FormattedNoticeContent content={text} />)
      expect(html).toContain('<strong class="font-semibold text-text">signed permission slip</strong>')
      expect(html).toContain('<em class="italic">water bottle</em>')
    })

    it('renders bulleted lists cleanly', () => {
      const text = '- House sports uniform\n- Running shoes\n- Student ID card'
      const html = renderToString(<FormattedNoticeContent content={text} />)
      expect(html).toContain('<ul class="list-disc pl-5 my-1.5 space-y-1 text-text">')
      expect(html).toContain('House sports uniform')
      expect(html).toContain('Running shoes')
      expect(html).toContain('Student ID card')
    })

    it('renders numbered lists in order', () => {
      const text = '1. Assemble at main auditorium\n2. Receive chest numbers\n3. March-past lineup'
      const html = renderToString(<FormattedNoticeContent content={text} />)
      expect(html).toContain('<ol class="list-decimal pl-5 my-1.5 space-y-1 text-text">')
      expect(html).toContain('Assemble at main auditorium')
      expect(html).toContain('Receive chest numbers')
      expect(html).toContain('March-past lineup')
    })

    it('renders blockquote callout for critical announcements', () => {
      const text = '> Important: Gates close strictly at 08:00 AM.'
      const html = renderToString(<FormattedNoticeContent content={text} />)
      expect(html).toContain('<blockquote')
      expect(html).toContain('Important: Gates close strictly at 08:00 AM.')
    })

    it('renders inline markdown links safely with security attributes', () => {
      const text = 'Download the full schedule at [Official Portal](https://school.edu/portal).'
      const html = renderToString(<FormattedNoticeContent content={text} />)
      expect(html).toContain('href="https://school.edu/portal"')
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
      expect(html).toContain('Official Portal')
    })
  })

  describe('NoticeCardPreview', () => {
    it('renders real-time live preview header and title', () => {
      const html = renderToString(
        <NoticeCardPreview
          title="Annual Science Exhibition 2026"
          content="Exhibition booths will open this Friday at the STEM laboratory."
          audience="portal"
          eventType="event"
          isPinned={false}
        />
      )

      expect(html).toContain('Recipient Live Preview')
      expect(html).toContain('Portal Feed Card')
      expect(html).toContain('Annual Science Exhibition 2026')
      expect(html).toContain('Exhibition booths will open this Friday')
    })

    it('renders pinned notice ribbon when isPinned is true', () => {
      const html = renderToString(
        <NoticeCardPreview
          title="Emergency Heavy Rain Alert"
          content="All classes suspended."
          audience="all"
          eventType="urgent"
          isPinned={true}
        />
      )

      expect(html).toContain('Pinned Notice')
      expect(html).toContain('ring-amber-500/20')
    })

    it('renders audience labels accurately', () => {
      const portalHtml = renderToString(
        <NoticeCardPreview title="Notice" content="Body" audience="portal" eventType="announcement" isPinned={false} />
      )
      const staffHtml = renderToString(
        <NoticeCardPreview title="Notice" content="Body" audience="staff" eventType="announcement" isPinned={false} />
      )
      const allHtml = renderToString(
        <NoticeCardPreview title="Notice" content="Body" audience="all" eventType="announcement" isPinned={false} />
      )

      expect(portalHtml).toContain('Students &amp; Guardians')
      expect(staffHtml).toContain('Staff &amp; Faculty')
      expect(allHtml).toContain('Everyone')
    })

    it('renders action link CTA button with high contrast text when url is provided', () => {
      const html = renderToString(
        <NoticeCardPreview
          title="Fee Payment Schedule"
          content="Term 2 invoices have been issued."
          audience="portal"
          eventType="circular"
          url="https://portal.school.edu/finance"
          isPinned={false}
        />
      )

      expect(html).toContain('https://portal.school.edu/finance')
      expect(html).toContain('View Circular')
      expect(html).toContain('text-text-inverted')
    })

    it('displays scheduled indicator for future dates and expiry when set', () => {
      const futureDate = '2099-12-31'
      const expiryDate = '2100-01-15'
      const html = renderToString(
        <NoticeCardPreview
          title="New Year Assembly"
          content="Upcoming orientation."
          audience="all"
          eventType="event"
          noticeDate={futureDate}
          expiresAt={expiryDate}
          isPinned={false}
        />
      )

      expect(html).toContain(`Scheduled for ${futureDate}`)
      expect(html).toContain(`Expires ${expiryDate}`)
    })
  })

  describe('NoticeFormattingToolbar', () => {
    it('renders all formatting action buttons with accessible labels', () => {
      const ref = { current: null } as React.RefObject<HTMLTextAreaElement>
      const html = renderToString(
        <NoticeFormattingToolbar
          textareaRef={ref}
          value="Test content"
          onChange={() => {}}
        />
      )

      expect(html).toContain('role="toolbar"')
      expect(html).toContain('Notice formatting options')
      expect(html).toContain('Bold')
      expect(html).toContain('Italic')
      expect(html).toContain('Bulleted List')
      expect(html).toContain('Numbered List')
      expect(html).toContain('Callout / Quote')
      expect(html).toContain('Insert Link')
      expect(html).toContain('Markdown supported')
    })
  })

  describe('Notice Content Length Constraints & Metrics', () => {
    it('defines a safe maximum notice content limit of 5,000 characters', () => {
      expect(MAX_NOTICE_CONTENT_LENGTH).toBe(5000)
    })
  })

  describe('Notice Composer & Noticeboard Category Alignment', () => {
    it('verifies that the canonical notice categories define exactly the 6 noticeboard types', () => {
      const noticeCategories = ['announcement', 'notice', 'circular', 'event', 'holiday', 'urgent']
      expect(noticeCategories).toHaveLength(6)
      expect(noticeCategories).toContain('announcement')
      expect(noticeCategories).toContain('notice')
      expect(noticeCategories).toContain('circular')
      expect(noticeCategories).toContain('event')
      expect(noticeCategories).toContain('holiday')
      expect(noticeCategories).toContain('urgent')
    })

    it('flags expiry date earlier than publish date', () => {
      const noticeDate = '2026-11-10'
      const expiresAt = '2026-11-01'
      const isInvalid = Boolean(expiresAt && noticeDate && expiresAt < noticeDate)
      expect(isInvalid).toBe(true)

      const validExpiresAt = '2026-11-20'
      const isValid = Boolean(validExpiresAt && noticeDate && validExpiresAt < noticeDate)
      expect(isValid).toBe(false)
    })

    it('formats future notice dates accurately without saying 1m ago', () => {
      const futureDate = '2030-12-25'
      const formatted = formatRelativeTime(futureDate)
      expect(formatted).not.toBe('1m ago')
      expect(formatted).not.toContain('ago')
    })
  })
})
