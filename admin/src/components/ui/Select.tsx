/**
 * Select — Radix UI Select primitive wrapped in CodeClove design tokens.
 *
 * Usage:
 *   <Select
 *     value={value}
 *     onValueChange={setValue}
 *     options={[{ value: 'a', label: 'Option A' }]}
 *     placeholder="Choose..."
 *   />
 */
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn, getPortalContainer } from '@/lib/utils'
import { __ } from '@/lib/i18n'
// ─── Types ────────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectGroup {
  label: string
  options: SelectOption[]
}

interface SelectProps {
  id?: string
  value?: string
  onValueChange?: (value: string) => void
  options?: SelectOption[]
  groups?: SelectGroup[]
  placeholder?: string
  disabled?: boolean
  error?: boolean
  className?: string
  name?: string
  container?: HTMLElement | null
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
  'aria-label'?: string
}

// ─── Select ───────────────────────────────────────────────────────────────────

export function Select({
  id,
  name,
  value,
  onValueChange,
  options = [],
  groups = [],
  placeholder = __( 'Select...', 'codeclove-school-management' ),
  disabled = false,
  error = false,
  className,
  container,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
}: SelectProps) {
  const portalContainer = getPortalContainer(container)
  const allGroups: SelectGroup[] =
    groups.length > 0 ? groups : [{ label: '', options }]
  const selectedLabel = allGroups
    .flatMap((g) => g.options)
    .find((opt) => opt.value === value)?.label
  const isError = Boolean(error || ariaInvalid === true || ariaInvalid === 'true')

  return (
    <SelectPrimitive.Root
      key={`${value ?? ''}-${options.length}`}
      name={name}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-invalid={isError ? true : undefined}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        title={selectedLabel}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded px-3 text-sm min-w-0 [&>span]:truncate [&>span]:block [&>span]:text-start whitespace-nowrap',
          'bg-bg-surface border transition-colors duration-100 text-text',
          isError
            ? 'border-danger focus:ring-danger'
            : 'border-border hover:border-border-strong focus:border-brand focus:ring-1 focus:ring-brand-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'data-[placeholder]:text-text-subtle',
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown size={13} className="text-text-subtle flex-shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={portalContainer}>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-[100050] overflow-hidden rounded-lg outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
            'bg-bg-overlay border border-border shadow-modal',
            'animate-slide-down',
            'min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] w-auto',
            'max-h-[min(360px,var(--radix-select-content-available-height))]'
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1 text-text-subtle">
            <ChevronUp size={13} />
          </SelectPrimitive.ScrollUpButton>

          <SelectPrimitive.Viewport className="p-1">
            {allGroups.map((group, i) => (
              <SelectPrimitive.Group key={i}>
                {group.label && (
                  <SelectPrimitive.Label className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wider text-text-subtle">
                    {group.label}
                  </SelectPrimitive.Label>
                )}
                {group.options.map((opt) => (
                  <SelectPrimitive.Item
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className={cn(
                      'relative flex items-center gap-2 px-3 py-1.5 rounded text-sm cursor-default select-none',
                      'outline-none transition-colors duration-100',
                      'text-text-muted data-[highlighted]:bg-hover-bg data-[highlighted]:text-text',
                      'data-[state=checked]:text-text data-[state=checked]:font-semibold data-[state=checked]:bg-brand-dim',
                      'data-[disabled]:opacity-50 data-[disabled]:pointer-events-none'
                    )}
                  >
                    <SelectPrimitive.ItemText className="truncate max-w-[280px]">{opt.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="ms-auto">
                      <Check size={12} className="text-brand" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Group>
            ))}
          </SelectPrimitive.Viewport>

          <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1 text-text-subtle">
            <ChevronDown size={13} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
