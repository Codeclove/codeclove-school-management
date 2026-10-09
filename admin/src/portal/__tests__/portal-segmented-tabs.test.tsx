import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { FileText, Receipt, Calendar } from 'lucide-react'
import { SegmentedTabs, type SegmentedTab } from '../components/SegmentedTabs'

describe('SegmentedTabs Component', () => {
  type TabKey = 'invoices' | 'receipts' | 'schedule'

  const basicTabs: SegmentedTab<TabKey>[] = [
    { id: 'invoices', label: 'Invoices', icon: FileText, count: 12 },
    { id: 'receipts', label: 'Receipts', icon: Receipt, count: 5 },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
  ]

  describe('Accessibility & Semantics', () => {
    it('renders role="tablist" with accessible aria-label', () => {
      const html = renderToString(
        <SegmentedTabs
          tabs={basicTabs}
          activeTab="invoices"
          onChange={() => {}}
          ariaLabel="Financial views"
        />
      )

      expect(html).toContain('role="tablist"')
      expect(html).toContain('aria-label="Financial views"')
    })

    it('renders tabs with role="tab", type="button", and correct IDs', () => {
      const html = renderToString(
        <SegmentedTabs
          tabs={basicTabs}
          activeTab="invoices"
          onChange={() => {}}
        />
      )

      expect(html).toContain('id="tab-invoices"')
      expect(html).toContain('id="tab-receipts"')
      expect(html).toContain('id="tab-schedule"')
      expect(html).toMatch(/type="button"/g)
    })

    it('sets default aria-controls to panel-${id}', () => {
      const html = renderToString(
        <SegmentedTabs
          tabs={basicTabs}
          activeTab="invoices"
          onChange={() => {}}
        />
      )

      expect(html).toContain('aria-controls="panel-invoices"')
      expect(html).toContain('aria-controls="panel-receipts"')
      expect(html).toContain('aria-controls="panel-schedule"')
    })

    it('respects custom ariaControls override on a tab', () => {
      const customTabs: SegmentedTab<string>[] = [
        { id: 'custom', label: 'Custom', ariaControls: 'custom-section-id' },
      ]
      const html = renderToString(
        <SegmentedTabs
          tabs={customTabs}
          activeTab="custom"
          onChange={() => {}}
        />
      )

      expect(html).toContain('aria-controls="custom-section-id"')
    })

    it('sets aria-selected="true" strictly on active tab and "false" on others', () => {
      const html = renderToString(
        <SegmentedTabs
          tabs={basicTabs}
          activeTab="receipts"
          onChange={() => {}}
        />
      )

      // receipts active
      expect(html).toMatch(/id="tab-receipts"[^>]*aria-selected="true"/)
      // invoices inactive
      expect(html).toMatch(/id="tab-invoices"[^>]*aria-selected="false"/)
      // schedule inactive
      expect(html).toMatch(/id="tab-schedule"[^>]*aria-selected="false"/)
    })
  })

  describe('Design System Tokens & Sizing', () => {
    it('applies CodeClove track tokens to the tablist wrapper', () => {
      const html = renderToString(
        <SegmentedTabs
          tabs={basicTabs}
          activeTab="invoices"
          onChange={() => {}}
          className="extra-custom-class"
        />
      )

      expect(html).toContain('bg-bg-base/80')
      expect(html).toContain('border-border/80')
      expect(html).toContain('rounded-xl')
      expect(html).toContain('p-1')
      expect(html).toContain('gap-1')
      expect(html).toContain('extra-custom-class')
    })

    it('applies active tokens to the active button and inactive tokens to other buttons', () => {
      const html = renderToString(
        <SegmentedTabs
          tabs={basicTabs}
          activeTab="invoices"
          onChange={() => {}}
        />
      )

      // Active button tokens
      expect(html).toContain('bg-bg-surface')
      expect(html).toContain('text-brand')
      expect(html).toContain('font-bold')
      expect(html).toContain('shadow-xs')

      // Inactive button tokens
      expect(html).toContain('text-text-muted')
      expect(html).toContain('hover:text-text')
      expect(html).toContain('hover:bg-bg-surface/50')
    })

    it('applies medium size classes by default', () => {
      const html = renderToString(
        <SegmentedTabs
          tabs={basicTabs}
          activeTab="invoices"
          onChange={() => {}}
        />
      )

      expect(html).toContain('px-3.5')
      expect(html).toContain('py-2')
      expect(html).toContain('gap-2')
      // Icon md size
      expect(html).toContain('w-4 h-4')
    })

    it('applies small size classes when size="sm"', () => {
      const html = renderToString(
        <SegmentedTabs
          tabs={basicTabs}
          activeTab="invoices"
          onChange={() => {}}
          size="sm"
        />
      )

      expect(html).toContain('px-3 py-1.5')
      expect(html).toContain('gap-1.5')
      // Icon sm size
      expect(html).toContain('w-3.5 h-3.5')
    })
  })

  describe('Badge Counter & Indicators', () => {
    it('renders tabular-nums count badge with active and inactive colors', () => {
      const html = renderToString(
        <SegmentedTabs
          tabs={basicTabs}
          activeTab="invoices"
          onChange={() => {}}
        />
      )

      // Contains tabular-nums and font-mono
      expect(html).toContain('tabular-nums')
      expect(html).toContain('font-mono')
      expect(html).toContain('text-3xs')

      // Active count badge has bg-brand-dim text-brand
      expect(html).toContain('bg-brand-dim text-brand')
      expect(html).toContain('12')

      // Inactive count badge has bg-border/60 text-text-subtle
      expect(html).toContain('bg-border/60 text-text-subtle')
      expect(html).toContain('5')
    })

    it('renders zero count cleanly without hiding it', () => {
      const zeroTabs: SegmentedTab<string>[] = [
        { id: 'zero', label: 'Empty Queue', count: 0 },
      ]
      const html = renderToString(
        <SegmentedTabs
          tabs={zeroTabs}
          activeTab="zero"
          onChange={() => {}}
        />
      )

      expect(html).toContain('tabular-nums')
      expect(html).toContain('>0</span>')
    })

    it('does not render count badge when count is undefined', () => {
      const noCountTabs: SegmentedTab<string>[] = [
        { id: 'simple', label: 'Simple Tab' },
      ]
      const html = renderToString(
        <SegmentedTabs
          tabs={noCountTabs}
          activeTab="simple"
          onChange={() => {}}
        />
      )

      expect(html).not.toContain('tabular-nums')
      expect(html).toContain('Simple Tab')
    })

    it('renders dot indicator when dot is true', () => {
      const dotTabs: SegmentedTab<string>[] = [
        { id: 'today', label: 'Today', dot: true },
        { id: 'tomorrow', label: 'Tomorrow' },
      ]
      const html = renderToString(
        <SegmentedTabs
          tabs={dotTabs}
          activeTab="today"
          onChange={() => {}}
        />
      )

      expect(html).toContain('w-1.5 h-1.5 rounded-full')
      expect(html).toContain('bg-brand')
    })

    it('renders custom badge element when badge is provided', () => {
      const badgeTabs: SegmentedTab<string>[] = [
        {
          id: 'featured',
          label: 'Featured',
          badge: <span data-testid="custom-tag">NEW</span>,
        },
      ]
      const html = renderToString(
        <SegmentedTabs
          tabs={badgeTabs}
          activeTab="featured"
          onChange={() => {}}
        />
      )

      expect(html).toContain('data-testid="custom-tag"')
      expect(html).toContain('NEW')
    })
  })

  describe('Interactive & State Behavior', () => {
    it('invokes onChange handler when a tab button is clicked', () => {
      const onChange = vi.fn()
      const element = SegmentedTabs({
        tabs: basicTabs,
        activeTab: 'invoices',
        onChange,
      })

      // The element returns a tablist with child buttons
      const children = React.Children.toArray(element.props.children) as React.ReactElement[]
      expect(children).toHaveLength(3)

      // Simulate clicking second tab (receipts)
      const receiptsBtn = children[1]!
      receiptsBtn.props.onClick()
      expect(onChange).toHaveBeenCalledWith('receipts')

      // Simulate clicking third tab (schedule)
      const scheduleBtn = children[2]!
      scheduleBtn.props.onClick()
      expect(onChange).toHaveBeenCalledWith('schedule')
    })

    it('does not invoke onChange when a disabled tab is clicked', () => {
      const onChange = vi.fn()
      const disabledTabs: SegmentedTab<string>[] = [
        { id: 'open', label: 'Open' },
        { id: 'locked', label: 'Locked', disabled: true },
      ]

      const element = SegmentedTabs({
        tabs: disabledTabs,
        activeTab: 'open',
        onChange,
      })

      const children = React.Children.toArray(element.props.children) as React.ReactElement[]
      const lockedBtn = children[1]!

      expect(lockedBtn.props.disabled).toBe(true)
      lockedBtn.props.onClick()
      expect(onChange).not.toHaveBeenCalled()
    })
  })
})
