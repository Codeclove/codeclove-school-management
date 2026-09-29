/** Tab: In-App Notifications — settings section for global in-app alerts defaults */

import { Bell } from 'lucide-react'
import type { Control } from 'react-hook-form'
import type { CodeCloveSettings } from '@/api/settings'
import { FormGroup, FormCheckbox } from '../components/SettingsFormPrimitives'
import { __ } from '@/lib/i18n'

interface InAppNotificationsTabProps {
  control: Control<CodeCloveSettings>
}

export function InAppNotificationsTab({ control }: InAppNotificationsTabProps) {
  return (
    <div className="space-y-6 animate-slide-up">
      <FormGroup
        title={__( 'Global In-App Notifications', 'codeclove-school-management' )}
        description={__( 'Choose which system events trigger persistent in-app notifications for administrators and staff by default.', 'codeclove-school-management' )}
        icon={Bell}
        cols={2}
      >
        <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormCheckbox
            label={__( 'Admission Submitted', 'codeclove-school-management' )}
            name="notifications.in_app_events.notify_admission_received"
            control={control}
            description={__( 'Notify when a new student application is received.', 'codeclove-school-management' )}
          />
          <FormCheckbox
            label={__( 'Admission Status Updated', 'codeclove-school-management' )}
            name="notifications.in_app_events.notify_admission_status"
            control={control}
            description={__( 'Notify when an application status changes.', 'codeclove-school-management' )}
          />
          <FormCheckbox
            label={__( 'Invoice Issued', 'codeclove-school-management' )}
            name="notifications.in_app_events.notify_invoice_issued"
            control={control}
            description={__( 'Notify when a new fee invoice is generated.', 'codeclove-school-management' )}
          />
          <FormCheckbox
            label={__( 'Payment Received', 'codeclove-school-management' )}
            name="notifications.in_app_events.notify_payment_recorded"
            control={control}
            description={__( 'Notify when a fee payment receipt is recorded.', 'codeclove-school-management' )}
          />
          <FormCheckbox
            label={__( 'Invoice Overdue', 'codeclove-school-management' )}
            name="notifications.in_app_events.notify_invoice_overdue"
            control={control}
            description={__( 'Notify when bills pass their due date.', 'codeclove-school-management' )}
          />
          <FormCheckbox
            label={__( 'Attendance Taken', 'codeclove-school-management' )}
            name="notifications.in_app_events.notify_attendance_taken"
            control={control}
            description={__( 'Notify when daily attendance records are saved.', 'codeclove-school-management' )}
          />
        </div>
      </FormGroup>
    </div>
  )
}
