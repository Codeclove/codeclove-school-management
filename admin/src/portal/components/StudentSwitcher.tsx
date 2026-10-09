/**
 * Student Switcher Component.
 *
 * Allows guardians with multiple enrolled students to switch between children.
 * Displays the active student's avatar/initials, name, grade/class, and section badge.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { __ } from '@/lib/i18n'
import { usePortal } from '../lib/portal-context'
import { getInitials } from '../lib/formatter'

// Only render switcher when user has multiple enrolled students to switch between
export const shouldShowStudentSwitcher = (count: number): boolean => count > 1

export const StudentSwitcher: React.FC = () => {
  const { currentStudent, students, switchStudent } = usePortal()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  if (!shouldShowStudentSwitcher(students.length)) return null
  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 sm:gap-2.5 pl-2 pr-2.5 h-10 rounded-xl border border-border hover:border-border-strong text-left transition-all bg-bg-surface hover:bg-hover-bg shadow-2xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {/* Student Avatar */}
        <div className="relative flex-shrink-0">
          {currentStudent?.photo_url ? (
            <img
              src={currentStudent.photo_url}
              alt={currentStudent.full_name}
              className="w-7 h-7 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-brand-dim text-brand flex items-center justify-center font-semibold text-2xs border border-brand/20">
              {getInitials(currentStudent?.full_name)}
            </div>
          )}
        </div>

        {/* Student Info */}
        <div className="flex flex-col min-w-0 pr-0.5 justify-center">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className="text-xs font-semibold text-text truncate max-w-28 sm:max-w-36">
              {currentStudent?.full_name ?? __( 'Select Student', 'codeclove-school-management' )}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-3xs text-text-muted leading-tight mt-0.5">
            <span className="truncate max-w-24">{currentStudent?.unit_name || __( 'Student', 'codeclove-school-management' )}</span>
            {currentStudent?.group_name && (
              <>
                <span className="opacity-50">·</span>
                <span className="truncate max-w-20">{currentStudent.group_name}</span>
              </>
            )}
          </div>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-text-subtle transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180 text-brand' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 mt-1.5 w-72 rounded-xl bg-bg-overlay shadow-modal border border-border py-1 z-50 animate-in fade-in-50 slide-in-from-top-1 duration-150">
          <div className="px-3 py-2 flex items-center justify-between text-3xs font-semibold uppercase tracking-wider text-text-subtle border-b border-border">
            <span>{__( 'Active Student', 'codeclove-school-management' )}</span>
            <span className="text-brand font-medium">({students.length})</span>
          </div>

          <div className="max-h-64 overflow-y-auto p-1 space-y-0.5">
            {students.map((student) => {
              const isSelected = student.id === currentStudent?.id
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => {
                    switchStudent(student.id)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-sm transition-colors ${
                    isSelected ? 'bg-brand-dim text-text font-medium border border-brand/20' : 'hover:bg-hover-bg text-text-muted hover:text-text border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {student.photo_url ? (
                      <img
                        src={student.photo_url}
                        alt={student.full_name}
                        className="w-7 h-7 rounded-full object-cover border border-border flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-bg-surface text-text-muted flex items-center justify-center font-medium text-3xs border border-border flex-shrink-0">
                        {getInitials(student.full_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-text">{student.full_name}</p>
                      <p className="text-3xs text-text-subtle truncate">
                        {[student.unit_name, student.group_name].filter(Boolean).join(' • ') || __( 'Enrolled', 'codeclove-school-management' )}
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-brand flex-shrink-0 ml-2" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
