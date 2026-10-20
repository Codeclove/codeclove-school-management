/**
 * Portal Theme Toggle Component.
 *
 * Provides a dropdown beside the Maximize button allowing students/parents
 * to switch between Light, Dark, and System theme modes.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { __ } from '@/lib/i18n'
import { usePortal, type ThemeMode } from '../lib/portal-context'

interface ThemeOption {
  mode: ThemeMode
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const THEME_OPTIONS: ThemeOption[] = [
  { mode: 'light', label: __( 'Light', 'codeclove-school-management' ), icon: Sun },
  { mode: 'dark', label: __( 'Dark', 'codeclove-school-management' ), icon: Moon },
  { mode: 'system', label: __( 'System', 'codeclove-school-management' ), icon: Monitor },
]

export const ThemeToggle: React.FC = () => {
  const { theme, resolvedTheme, setTheme } = usePortal()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Current icon to display on the trigger button
  const ActiveIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border transition-all shadow-2xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          isOpen
            ? 'border-border-strong bg-hover-bg text-text'
            : 'border-border hover:border-border-strong bg-bg-surface hover:bg-hover-bg text-text-muted hover:text-text'
        }`}
        title={__( 'Theme: Light, Dark, or System', 'codeclove-school-management' )}
        aria-label={__( 'Change theme mode', 'codeclove-school-management' )}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <ActiveIcon className="w-4 h-4 transition-transform duration-200" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={__( 'Theme mode options', 'codeclove-school-management' )}
          className="absolute right-0 mt-1.5 w-36 rounded-xl bg-bg-overlay shadow-modal border border-border p-1 z-50 animate-in fade-in-50 slide-in-from-top-1 duration-150"
        >
          {THEME_OPTIONS.map((option) => {
            const OptionIcon = option.icon
            const isSelected = theme === option.mode
            return (
              <button
                key={option.mode}
                type="button"
                role="menuitem"
                onClick={() => {
                  setTheme(option.mode)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'bg-brand-dim text-brand font-semibold'
                    : 'text-text hover:bg-hover-bg hover:text-text'
                }`}
              >
                <div className="flex items-center gap-2">
                  <OptionIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-brand' : 'text-text-subtle'}`} />
                  <span>{option.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
