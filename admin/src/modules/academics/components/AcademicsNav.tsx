import { NavLink } from 'react-router-dom'
import { CalendarDays, GraduationCap, Layers, BookOpen } from 'lucide-react'
import { __ } from '@/lib/i18n'
import { useLabels } from '@/lib/labels'
import { ROUTES } from '@/lib/constants'

export function AcademicsNav() {
  const { getLabel } = useLabels()
  const sessionLabel = getLabel('academic_session', true, __( 'Sessions', 'codeclove-school-management' ))
  const unitLabel = getLabel('academic_unit', true, __( 'Classes', 'codeclove-school-management' ))
  const groupLabel = getLabel('academic_group', true, __( 'Sections', 'codeclove-school-management' ))
  const subjectLabel = getLabel('subject', true, __( 'Subjects', 'codeclove-school-management' ))

  const NAV_ITEMS = [
    { to: ROUTES.SESSIONS, label: sessionLabel, icon: CalendarDays },
    { to: ROUTES.UNITS, label: unitLabel, icon: GraduationCap },
    { to: ROUTES.GROUPS, label: groupLabel, icon: Layers },
    { to: ROUTES.SUBJECTS, label: subjectLabel, icon: BookOpen },
  ]

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-bg-elevated border border-border shadow-2xs w-fit max-w-full overflow-x-auto scrollbar-none">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-150 select-none whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? 'bg-brand-dim text-brand border border-brand/30 font-bold shadow-2xs'
                  : 'text-text-muted hover:text-brand hover:bg-hover-bg border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={14} className={isActive ? 'text-brand' : 'text-text-subtle'} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </div>
  )
}
