import { NavLink, Outlet } from 'react-router-dom'
import { useLabels } from '@/lib/labels'
import { PageHeader } from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'

export default function StudentAttendanceLayout() {
  const { getLabel } = useLabels()
  const studentLabelPlural = getLabel('student', true, __('Students', 'codeclove-school-management'))
  const studentLabelSingular = getLabel('student', false, __('Student', 'codeclove-school-management'))

  return (
    <div className="space-y-6">
      <PageHeader
        title={sprintf(__('%s Attendance', 'codeclove-school-management'), studentLabelSingular)}
        description={sprintf(__('Record and manage daily or monthly %s attendance.', 'codeclove-school-management'), studentLabelSingular.toLowerCase())}
        breadcrumbs={[
          { label: studentLabelPlural },
          { label: __('Attendance', 'codeclove-school-management') }
        ]}
        actions={
          /* Tab navigation using React Router NavLinks */
          <div className="bg-bg-surface border border-border rounded-xl p-1 inline-flex items-center gap-1">
            <NavLink
              to=""
              end
              className={({ isActive }) =>
                `inline-flex items-center justify-center gap-1.5 font-medium text-sm rounded-lg transition-all h-8 px-3.5 select-none ${
                  isActive
                    ? 'bg-brand text-text-inverted hover:bg-brand-strong hover:text-text-inverted'
                    : 'text-text-muted hover:text-text hover:bg-bg-overlay'
                }`
              }
            >
              {__('Daily Register', 'codeclove-school-management')}
            </NavLink>
            <NavLink
              to="monthly"
              className={({ isActive }) =>
                `inline-flex items-center justify-center gap-1.5 font-medium text-sm rounded-lg transition-all h-8 px-3.5 select-none ${
                  isActive
                    ? 'bg-brand text-text-inverted hover:bg-brand-strong hover:text-text-inverted'
                    : 'text-text-muted hover:text-text hover:bg-bg-overlay'
                }`
              }
            >
              {__('Monthly Overview', 'codeclove-school-management')}
            </NavLink>
          </div>
        }
      />

      <Outlet />
    </div>
  )
}
