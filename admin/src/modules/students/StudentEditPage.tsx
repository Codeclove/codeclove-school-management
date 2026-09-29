import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import {
  useStudentDetails,
  useUpdateStudent,
} from '@/api/students'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { Button, PageHeader, EmptyState, Skeleton } from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'
import StudentForm from './components/StudentForm'

export default function StudentEditPage() {
  const { id } = useParams<{ id: string }>()
  const studentId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()

  const { getLabel } = useLabels()
  const studentLabelSingular = getLabel('student', false, __( 'Student', 'codeclove-school-management' ))
  const studentLabelPlural = getLabel('student', true, __( 'Students', 'codeclove-school-management' ))

  const { data: student, isLoading: isStudentLoading, isError } = useStudentDetails(studentId)
  const updateMutation = useUpdateStudent()

  const onSubmit = (data: Record<string, unknown>) => {
    // Remove auto-generated settings fields that are only client concerns
    const payload = { ...data }
    delete payload.auto_generate_admission

    updateMutation.mutate(
      {
        id: studentId,
        ...payload,
        academic_unit_id: Number(payload.academic_unit_id),
        academic_group_id: payload.academic_group_id ? Number(payload.academic_group_id) : null,
        graduation_year: payload.graduation_year ? Number(payload.graduation_year) : null,
        guardian_id: payload.link_existing_guardian && payload.guardian_id ? Number(payload.guardian_id) : null,
      } as unknown as Parameters<typeof updateMutation.mutate>[0],
      {
        onSuccess: () => {
          toast.success(sprintf( __( '%s details updated successfully!', 'codeclove-school-management' ), studentLabelSingular ))
          navigate(`/students/${studentId}`)
        },
        onError: (err: unknown) => {
          let message = ''
          if (err instanceof Error) {
            message = err.message
          } else if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
            message = err.message
          }
          toast.error(message || sprintf( __( 'Failed to update %s details', 'codeclove-school-management' ), studentLabelSingular.toLowerCase() ))
        }
      }
    )
  }

  if (isStudentLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !student) {
    return (
      <EmptyState
        title={sprintf( __( '%s not found', 'codeclove-school-management' ), studentLabelSingular )}
        description={sprintf( __( 'The %s record you are trying to edit does not exist or has been deleted.', 'codeclove-school-management' ), studentLabelSingular.toLowerCase() )}
        icon={AlertTriangle}
        action={<Button size="sm" onClick={() => navigate('/students')}>{__( 'Back to Directory', 'codeclove-school-management' )}</Button>}
      />
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={sprintf( __( 'Edit %s Profile', 'codeclove-school-management' ), studentLabelSingular )}
        description={
          student.student_number
            ? sprintf( __( 'Updating profile for %1$s %2$s (%3$s Number: %4$s).', 'codeclove-school-management' ), student.first_name, student.last_name, studentLabelSingular, student.student_number )
            : sprintf( __( 'Updating profile for %1$s %2$s.', 'codeclove-school-management' ), student.first_name, student.last_name )
        }
        onBack={() => navigate(`/students/${student.id}`)}
        breadcrumbs={[
          { label: studentLabelPlural },
          { label: __( 'Directory', 'codeclove-school-management' ), href: '/students' },
          { label: `${student.first_name} ${student.last_name}`, href: `/students/${student.id}` },
          { label: __( 'Edit', 'codeclove-school-management' ) }
        ]}
      />

      <StudentForm
        mode="edit"
        initialData={student}
        onSubmit={onSubmit}
        onCancel={() => navigate(`/students/${studentId}`)}
        isPending={updateMutation.isPending}
      />
    </div>
  )
}
