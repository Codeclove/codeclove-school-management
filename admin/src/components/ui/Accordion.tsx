/** Minimal Accordion — Root + Item + Trigger + Content */

import { createContext, useContext, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Context ──────────────────────────────────────────────────────────────────

interface AccordionCtx {
  open: string | null
  toggle: (key: string) => void
}

const Ctx = createContext<AccordionCtx>({ open: null, toggle: () => {} })

// ── Root ─────────────────────────────────────────────────────────────────────

interface AccordionProps {
  className?: string
  children: React.ReactNode
  defaultOpen?: string | null
}

export function Accordion({ className, children, defaultOpen = null }: AccordionProps) {
  const [open, setOpen] = useState<string | null>(defaultOpen)
  const toggle = (key: string) => setOpen((prev) => (prev === key ? null : key))

  return (
    <Ctx.Provider value={{ open, toggle }}>
      <div className={cn('divide-y divide-border border border-border rounded-xl overflow-hidden bg-bg-surface', className)}>
        {children}
      </div>
    </Ctx.Provider>
  )
}

// ── Item ─────────────────────────────────────────────────────────────────────

interface AccordionItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

const ItemCtx = createContext<{ value: string; isOpen: boolean }>({ value: '', isOpen: false })

export function AccordionItem({ value, children, className }: AccordionItemProps) {
  const { open } = useContext(Ctx)
  const isOpen = open === value
  return (
    <ItemCtx.Provider value={{ value, isOpen }}>
      <div className={cn('flex flex-col', className)}>{children}</div>
    </ItemCtx.Provider>
  )
}

// ── Trigger ───────────────────────────────────────────────────────────────────

interface AccordionTriggerProps {
  children: React.ReactNode
  className?: string
}

export function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  const { toggle } = useContext(Ctx)
  const { value, isOpen } = useContext(ItemCtx)

  return (
    <button
      type="button"
      onClick={() => toggle(value)}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3.5 text-start transition-colors duration-100 font-sans',
        isOpen ? 'bg-brand-dim/30 hover:bg-brand-dim/40' : 'bg-bg-surface hover:bg-bg-base/60',
        className
      )}
    >
      {children}
      <span className={cn('transition-colors duration-100 flex-shrink-0 ms-3', isOpen ? 'text-brand' : 'text-text-muted')}>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </span>
    </button>
  )
}

// ── Content ───────────────────────────────────────────────────────────────────

interface AccordionContentProps {
  children: React.ReactNode
  className?: string
}

export function AccordionContent({ children, className }: AccordionContentProps) {
  const { isOpen } = useContext(ItemCtx)
  if (!isOpen) return null
  return (
    <div className={cn('p-5 border-t border-border bg-bg-base grid grid-cols-1 gap-4', className)}>
      {children}
    </div>
  )
}
