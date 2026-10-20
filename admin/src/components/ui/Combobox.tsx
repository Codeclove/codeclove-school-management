/**
 * Combobox — Accessible, searchable dropdown select primitive powered by Radix UI Popover.
 *
 * Conforms to W3C WAI-ARIA 1.2 Combobox with Listbox Popup specification:
 * - Trigger button linked to FormField label via id/htmlFor with aria-haspopup="listbox" & aria-expanded.
 * - Search input with role="combobox", aria-autocomplete="list", aria-controls, and aria-activedescendant.
 * - Dynamic scroll container tracking without window jumping for keyboard navigation (arrows, Enter, Esc, Home, End, PageUp/Down).
 * - Multi-word token filtering against labels and optional keyword arrays.
 * - Visually hidden live region (aria-live="polite") announcing matching result counts for screen readers.
 * - CodeClove design system token alignment, dark/light surface elevation, and focus ring standards.
 *
 * Usage:
 *   <Combobox
 *     value={selectedId}
 *     onValueChange={setSelectedId}
 *     options={students.map(s => ({ value: String(s.id), label: s.name }))}
 *     placeholder="Select Student..."
 *     searchPlaceholder="Search student name or ID..."
 *   />
 */

import * as React from 'react'
import { useState, useRef, useEffect, useMemo, useCallback, useId } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn, getPortalContainer } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'
import type { SelectOption } from './Select'

export interface ComboboxOption extends SelectOption {
  keywords?: string[]
}

export interface ComboboxGroup {
  label: string
  options: ComboboxOption[]
}

export interface ComboboxProps {
  id?: string
  name?: string
  value?: string
  onValueChange?: (value: string) => void
  options?: ComboboxOption[]
  groups?: ComboboxGroup[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  error?: boolean
  clearable?: boolean
  className?: string
  container?: HTMLElement | null
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
  'aria-label'?: string
}

export function Combobox({
  id: propId,
  name,
  value,
  onValueChange,
  options = [],
  groups = [],
  placeholder = __('Select...', 'codeclove-school-management'),
  searchPlaceholder = __('Search...', 'codeclove-school-management'),
  emptyText = __('No options found.', 'codeclove-school-management'),
  disabled = false,
  error = false,
  clearable = false,
  className,
  container,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
}: ComboboxProps) {
  const generatedId = useId()
  const comboboxId = propId || `cc-combobox-${generatedId}`
  const listboxId = `${comboboxId}-listbox`
  const searchInputId = `${comboboxId}-search-input`

  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const portalContainer = getPortalContainer(container)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const allGroups: ComboboxGroup[] =
    groups.length > 0 ? groups : [{ label: '', options }]

  // Flat list of all available options
  const allOptions = useMemo(
    () => allGroups.flatMap((g) => g.options),
    [allGroups]
  )

  const selectedOption = useMemo(
    () => allOptions.find((opt) => opt.value === value),
    [allOptions, value]
  )

  // Multi-token fuzzy/word matching across label and keywords
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allGroups

    const tokens = q.split(/\s+/).filter(Boolean)

    return allGroups
      .map((g) => ({
        ...g,
        options: g.options.filter((opt) => {
          const labelLower = opt.label.toLowerCase()
          const descLower = opt.description?.toLowerCase() || ''
          const keywordsLower = opt.keywords?.map((k) => k.toLowerCase()) || []
          return tokens.every(
            (token) =>
              labelLower.includes(token) ||
              descLower.includes(token) ||
              keywordsLower.some((k) => k.includes(token))
          )
        }),
      }))
      .filter((g) => g.options.length > 0)
  }, [allGroups, searchQuery])

  // Flat list of filtered options for keyboard navigation
  const flatFilteredOptions = useMemo(
    () => filteredGroups.flatMap((g) => g.options),
    [filteredGroups]
  )

  // Initialize selection/highlight state when popover opens
  useEffect(() => {
    if (open) {
      const selectedIdx = allOptions.findIndex((opt) => opt.value === value)
      setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0)
      const timer = requestAnimationFrame(() => {
        searchInputRef.current?.focus()
      })
      return () => cancelAnimationFrame(timer)
    } else {
      setSearchQuery('')
      setHighlightedIndex(-1)
    }
  }, [open]) // Note: intentionally depends ONLY on open state to prevent keystroke lag

  // Bounded container scrolling (prevents parent window jitter)
  useEffect(() => {
    if (open && highlightedIndex >= 0 && listRef.current) {
      const containerEl = listRef.current
      const activeEl = containerEl.querySelector(
        `[id="${listboxId}-opt-${highlightedIndex}"]`
      ) as HTMLElement | null

      if (activeEl) {
        const containerTop = containerEl.scrollTop
        const containerBottom = containerTop + containerEl.clientHeight
        const elementTop = activeEl.offsetTop
        const elementBottom = elementTop + activeEl.offsetHeight

        if (elementTop < containerTop) {
          containerEl.scrollTop = elementTop
        } else if (elementBottom > containerBottom) {
          containerEl.scrollTop = elementBottom - containerEl.clientHeight
        }
      }
    }
  }, [highlightedIndex, open, listboxId])

  const handleSelectOption = useCallback(
    (opt: ComboboxOption) => {
      if (opt.disabled) return
      onValueChange?.(opt.value)
      setOpen(false)
      triggerRef.current?.focus()
    },
    [onValueChange]
  )

  const handleClearSelection = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onValueChange?.('')
      setOpen(false)
      triggerRef.current?.focus()
    },
    [onValueChange]
  )

  // Keyboard navigation when search input is focused
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatFilteredOptions.length === 0) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev + 1 < flatFilteredOptions.length ? prev + 1 : 0
        )
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : flatFilteredOptions.length - 1
        )
        break
      }
      case 'PageDown': {
        e.preventDefault()
        setHighlightedIndex((prev) =>
          Math.min(prev + 5, flatFilteredOptions.length - 1)
        )
        break
      }
      case 'PageUp': {
        e.preventDefault()
        setHighlightedIndex((prev) => Math.max(prev - 5, 0))
        break
      }
      case 'Home': {
        e.preventDefault()
        setHighlightedIndex(0)
        break
      }
      case 'End': {
        e.preventDefault()
        setHighlightedIndex(flatFilteredOptions.length - 1)
        break
      }
      case 'Enter': {
        e.preventDefault()
        const target = flatFilteredOptions[highlightedIndex] ?? flatFilteredOptions[0]
        if (target && !target.disabled) {
          handleSelectOption(target)
        }
        break
      }
      case 'Escape': {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        break
      }
      case 'Tab': {
        setOpen(false)
        break
      }
    }
  }

  // Keyboard navigation on trigger button when closed
  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setOpen(true)
    }
  }

  const isError = Boolean(error || ariaInvalid === true || ariaInvalid === 'true')
  const activeOptionDomId =
    open && highlightedIndex >= 0 && flatFilteredOptions[highlightedIndex]
      ? `${listboxId}-opt-${highlightedIndex}`
      : undefined
  const triggerDisplay = selectedOption
    ? selectedOption.description
      ? `${selectedOption.label} (${selectedOption.description})`
      : selectedOption.label
    : placeholder
  let optionCounter = 0

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          ref={triggerRef}
          id={comboboxId}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-invalid={isError ? true : undefined}
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel || (!selectedOption?.label ? placeholder : undefined)}
          onKeyDown={handleTriggerKeyDown}
          title={triggerDisplay}
          className={cn(
            'flex h-8 w-full items-center justify-between gap-2 rounded px-3 text-sm min-w-0 [&>span]:truncate [&>span]:block [&>span]:text-start whitespace-nowrap',
            'bg-bg-surface border transition-all duration-100 text-text outline-none',
            open
              ? 'border-brand ring-1 ring-brand-ring'
              : isError
                ? 'border-danger focus-visible:ring-1 focus-visible:ring-danger'
                : 'border-border hover:border-border-strong focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
            !selectedOption?.label && 'text-text-subtle',
            className
          )}
        >
          <span className={cn('truncate block text-start flex-1 min-w-0', !selectedOption?.label && 'text-text-subtle')}>
            {triggerDisplay}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {clearable && selectedOption && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label={__('Clear selection', 'codeclove-school-management')}
                onClick={handleClearSelection}
                className="text-text-subtle hover:text-text p-0.5 rounded cursor-pointer transition-colors"
              >
                <X size={12} aria-hidden="true" />
              </span>
            )}
            <ChevronDown
              size={13}
              className={cn(
                'text-text-subtle transition-transform duration-150',
                open && 'rotate-180 text-brand'
              )}
              aria-hidden="true"
            />
          </div>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal container={portalContainer}>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-[100050] overflow-hidden rounded-lg outline-none',
            'bg-bg-overlay border border-border shadow-modal',
            'animate-slide-down',
            'w-[var(--radix-popover-trigger-width)] min-w-[220px] max-w-[calc(100vw-2rem)]',
            'max-h-[min(360px,var(--radix-popover-content-available-height))] flex flex-col'
          )}
        >
          {/* Integrated Accessible Search Input Header */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border shrink-0 bg-bg-surface">
            <Search size={14} className="text-text-subtle shrink-0" aria-hidden="true" />
            <input
              ref={searchInputRef}
              id={searchInputId}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionDomId}
              aria-label={searchPlaceholder}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setHighlightedIndex(0)
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={searchPlaceholder}
              style={{
                border: 'none',
                borderRadius: 0,
                outline: 'none',
                boxShadow: 'none',
                background: 'transparent',
              }}
              className="flex-1 bg-transparent !border-0 !border-none !rounded-none !outline-none !shadow-none !ring-0 text-sm text-text placeholder:text-text-subtle p-0 !m-0 !h-auto font-normal focus:!ring-0 focus-visible:!ring-0"
            />
            {searchQuery ? (
              <button
                type="button"
                tabIndex={-1}
                aria-label={__('Clear search query', 'codeclove-school-management')}
                onClick={(e) => {
                  e.stopPropagation()
                  setSearchQuery('')
                  setHighlightedIndex(0)
                  searchInputRef.current?.focus()
                }}
                className="text-text-subtle hover:text-text p-0.5 rounded cursor-pointer transition-colors"
              >
                <X size={13} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {/* Live Region for Screen Readers */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {open && (
              flatFilteredOptions.length === 0
                ? emptyText
                : searchQuery.trim()
                  ? sprintf(
                      __('%d options found. Use up and down arrow keys to navigate.', 'codeclove-school-management'),
                      flatFilteredOptions.length
                    )
                  : ''
            )}
          </div>

          {/* Scrollable Listbox Container */}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel || placeholder}
            className="overflow-y-auto p-1 flex-1 max-h-56 focus:outline-none divide-y-0"
          >
            {flatFilteredOptions.length === 0 ? (
              <li
                role="status"
                aria-live="polite"
                className="py-5 px-3 text-center select-none"
              >
                <Search size={18} className="mx-auto text-text-subtle opacity-40 mb-1.5" aria-hidden="true" />
                <p className="text-xs font-medium text-text-muted">{emptyText}</p>
                {searchQuery && (
                  <p className="text-2xs text-text-subtle mt-0.5">
                    {__('Try typing a different name or number', 'codeclove-school-management')}
                  </p>
                )}
              </li>
            ) : (
              filteredGroups.map((group, groupIdx) => (
                <li key={groupIdx} className="list-none" role="presentation">
                  {group.label && (
                    <div
                      role="presentation"
                      className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-text-subtle select-none"
                    >
                      {group.label}
                    </div>
                  )}
                  <ul role="group" aria-label={group.label || undefined} className="space-y-0.5">
                    {group.options.map((opt) => {
                      const currentIndex = optionCounter++
                      const isSelected = opt.value === value
                      const isHighlighted = currentIndex === highlightedIndex
                      const optionDomId = `${listboxId}-opt-${currentIndex}`

                      return (
                        <li
                          key={opt.value}
                          id={optionDomId}
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={opt.disabled}
                          data-highlighted={isHighlighted ? 'true' : undefined}
                          onMouseDown={(e) => {
                            // Prevent input blur before click finishes
                            e.preventDefault()
                          }}
                          onClick={() => handleSelectOption(opt)}
                          onPointerMove={() => {
                            if (highlightedIndex !== currentIndex) {
                              setHighlightedIndex(currentIndex)
                            }
                          }}
                          className={cn(
                            'relative flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-sm cursor-pointer select-none transition-colors duration-75',
                            isSelected
                              ? 'text-text font-semibold bg-brand-dim'
                              : isHighlighted
                                ? 'bg-hover-bg text-text'
                                : 'text-text-muted hover:text-text hover:bg-hover-bg',
                            opt.disabled && 'opacity-50 pointer-events-none cursor-not-allowed'
                          )}
                        >
                          {opt.description ? (
                            <div className="flex flex-col min-w-0 flex-1 py-0.5 text-start">
                              <span className="truncate text-sm font-medium text-text">
                                {opt.label}
                              </span>
                              <span className="truncate text-xs font-mono text-text-subtle mt-0.5">
                                {opt.description}
                              </span>
                            </div>
                          ) : (
                            <span className="truncate flex-1 min-w-0">{opt.label}</span>
                          )}
                          {isSelected && (
                            <Check size={12} className="text-brand shrink-0 ms-2" aria-hidden="true" />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
