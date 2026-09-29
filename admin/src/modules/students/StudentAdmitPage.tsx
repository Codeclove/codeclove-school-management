import { useNavigate } from 'react-router-dom'
import { useCreateStudent } from '@/api/students'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { PageHeader } from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'
import StudentForm from './components/StudentForm'

export default function StudentAdmitPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createMutation = useCreateStudent()
  const { getLabel } = useLabels()
  const studentLabelSingular = getLabel('student', false, __( 'Student', 'codeclove-school-management' ))
  const studentLabelPlural = getLabel('student', true, __( 'Students', 'codeclove-school-management' ))

  const onSubmit = (data: Record<string, unknown>) => {
    // Remove client-only field before sending payload
    const payload = { ...data }
    delete payload.auto_generate_admission

    createMutation.mutate(
      {
        ...payload,
        academic_session_id: Number(payload.academic_session_id),
        academic_unit_id: Number(payload.academic_unit_id),
        academic_group_id: payload.academic_group_id ? Number(payload.academic_group_id) : null,
        graduation_year: payload.graduation_year ? Number(payload.graduation_year) : null,
        guardian_id: payload.link_existing_guardian && payload.guardian_id ? Number(payload.guardian_id) : null,
      } as unknown as Parameters<typeof createMutation.mutate>[0],
      {
        onSuccess: () => {
          toast.success(sprintf( __( '%s admitted successfully!', 'codeclove-school-management' ), studentLabelSingular ))
          navigate('/students')
        },
        onError: (err: unknown) => {
          let message = ''
          if (err instanceof Error) {
            message = err.message
          } else if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
            message = err.message
          }
          toast.error(message || sprintf( __( 'Failed to admit %s', 'codeclove-school-management' ), studentLabelSingular.toLowerCase() ))
        }
      }
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={sprintf( __( 'Admit New %s', 'codeclove-school-management' ), studentLabelSingular )}
        description={sprintf( __( 'Manually register and place a new %s record.', 'codeclove-school-management' ), studentLabelSingular.toLowerCase() )}
        onBack={() => navigate('/students')}
        breadcrumbs={[
          { label: studentLabelPlural },
          { label: __( 'Directory', 'codeclove-school-management' ), href: '/students' },
          { label: sprintf( __( 'Admit %s', 'codeclove-school-management' ), studentLabelSingular ) }
        ]}
      />

      <StudentForm
        mode="admit"
        onSubmit={onSubmit}
        onCancel={() => navigate('/students')}
        isPending={createMutation.isPending}
      />
    </div>
  )
}
