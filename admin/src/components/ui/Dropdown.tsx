/**
 * Dropdown — Radix UI DropdownMenu wrapped in CodeClove design tokens.
 *
 * Replaces the ad-hoc useState(false) + fixed-inset-0 overlay pattern.
 *
 * Usage:
 *   <Dropdown trigger={<Button>New</Button>}>
 *     <DropdownItem icon={Plus} label="New Student" onClick={...} />
 *     <DropdownSeparator />
 *     <DropdownItem icon={LogOut} label="Sign out" danger />
 *   </Dropdown>
 */
import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { type LucideIcon } from 'lucide-react'
import { cn, getPortalContainer } from '@/lib/utils'

// ─── Root re-exports ──────────────────────────────────────────────────────────

export const DropdownRoot    = DropdownMenuPrimitive.Root
export const DropdownTrigger = DropdownMenuPrimitive.Trigger

// ─── Dropdown wrapper ─────────────────────────────────────────────────────────

interface DropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  container?: HTMLElement | null
}

export const Dropdown = React.forwardRef<
  HTMLButtonElement,
  DropdownProps
>(({
  trigger,
  children,
  align = 'end',
  sideOffset = 6,
  className,
  open,
  onOpenChange,
  container,
}, ref) => {
  const portalContainer = getPortalContainer(container)

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.Trigger asChild ref={ref}>
        {trigger}
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal container={portalContainer}>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={sideOffset}
          className={cn(
            'z-[100050] min-w-[160px] overflow-hidden rounded-lg p-1',
            'bg-bg-overlay border border-border shadow-modal outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
            'animate-slide-down',
            className
          )}
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
})

Dropdown.displayName = 'Dropdown'

// ─── Dropdown Item ────────────────────────────────────────────────────────────

interface DropdownItemProps {
  label?: string
  icon?: LucideIcon
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  className?: string
  shortcut?: string
  children?: React.ReactNode
}

export function DropdownItem({
  label,
  icon: Icon,
  onClick,
  danger = false,
  disabled = false,
  className,
  shortcut,
  children,
}: DropdownItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      onSelect={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm cursor-default select-none',
        'transition-colors duration-100 outline-none',
        danger
          ? 'text-danger data-[highlighted]:bg-danger-dim'
          : 'text-text-muted data-[highlighted]:bg-hover-bg data-[highlighted]:text-text',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      {children ? children : (
        <>
          {Icon && <Icon size={14} className="flex-shrink-0" />}
          {label && <span className="flex-1 truncate min-w-0">{label}</span>}
          {shortcut && (
            <kbd className="text-xs font-mono text-text-subtle opacity-60">
              {shortcut}
            </kbd>
          )}
        </>
      )}
    </DropdownMenuPrimitive.Item>
  )
}

// ─── Dropdown Label ───────────────────────────────────────────────────────────

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenuPrimitive.Label className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-subtle">
      {children}
    </DropdownMenuPrimitive.Label>
  )
}

// ─── Dropdown Separator ───────────────────────────────────────────────────────

export function DropdownSeparator() {
  return (
    <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
  )
}
