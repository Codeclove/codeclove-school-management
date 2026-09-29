import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import {
  useStaffMember,
  useCreateStaff,
  useUpdateStaff,
} from '@/api/staff'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { PageHeader, EmptyState, Button, Skeleton } from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'
import StaffForm from './components/StaffForm'
import { type StaffFormValues } from '@/schemas/staff'

export default function StaffFormPage() {
  const { id } = useParams<{ id: string }>()
  const staffId = id ? Number(id) : null
  const isEditMode = staffId !== null

  const navigate = useNavigate()
  const toast = useToast()
  const { getLabel } = useLabels()
  const staffLabelSingular = getLabel('staff_member', false, __( 'Staff Member', 'codeclove-school-management' ))
  const staffLabelPlural = getLabel('staff_member', true, __( 'Staff Members', 'codeclove-school-management' ))

  const { data: staff, isLoading: isStaffLoading, isError } = useStaffMember(staffId ?? 0)
  const createMutation = useCreateStaff()
  const updateMutation = useUpdateStaff(staffId ?? 0)

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (values: StaffFormValues & { documents: unknown[] }) => {
    const payload = {
      ...values,
      middle_name: values.middle_name || null,
      preferred_name: values.preferred_name || null,
      phone: values.phone || null,
      department: values.department || null,
      designation: values.designation || null,
      joined_on: values.joined_on || null,
      photo_id: values.photo_id || null,
      role_id: values.role_id ? Number(values.role_id) : null,
      documents: values.documents,
    }

    if (isEditMode) {
      updateMutation.mutate(payload as unknown as Parameters<typeof updateMutation.mutate>[0], {
        onSuccess: () => {
          toast.success(sprintf( __( '%s profile updated successfully!', 'codeclove-school-management' ), staffLabelSingular ))
          navigate(`/staff/${staffId}`)
        },
        onError: (err) => {
          toast.error(err.message || sprintf( __( 'Failed to update %s.', 'codeclove-school-management' ), staffLabelSingular.toLowerCase() ))
        },
      })
    } else {
      createMutation.mutate(payload as unknown as Parameters<typeof createMutation.mutate>[0], {
        onSuccess: (data) => {
          toast.success(sprintf( __( '%s created successfully!', 'codeclove-school-management' ), staffLabelSingular ))
          navigate(`/staff/${data.id}`)
        },
        onError: (err) => {
          toast.error(err.message || sprintf( __( 'Failed to create %s.', 'codeclove-school-management' ), staffLabelSingular.toLowerCase() ))
        },
      })
    }
  }

  const onCancel = () => {
    navigate(isEditMode ? `/staff/${staffId}` : '/staff')
  }

  if (isEditMode && isStaffLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (isEditMode && (isError || !staff)) {
    return (
      <EmptyState
        title={sprintf( __( '%s not found', 'codeclove-school-management' ), staffLabelSingular )}
        description={__( 'The record you are trying to edit does not exist or has been deleted.', 'codeclove-school-management' )}
        icon={AlertTriangle}
        action={<Button size="sm" onClick={() => navigate('/staff')}>{__( 'Back to Directory', 'codeclove-school-management' )}</Button>}
      />
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={isEditMode ? sprintf( __( 'Edit %s Profile', 'codeclove-school-management' ), staffLabelSingular ) : sprintf( __( 'Add New %s', 'codeclove-school-management' ), staffLabelSingular )}
        description={
          isEditMode
            ? (staff?.staff_number ? sprintf( __( 'Updating profile for %1$s %2$s (%3$s ID: %4$s).', 'codeclove-school-management' ), staff?.first_name, staff?.last_name, staffLabelSingular, staff.staff_number ) : sprintf( __( 'Updating profile for %1$s %2$s.', 'codeclove-school-management' ), staff?.first_name, staff?.last_name ))
            : sprintf( __( 'Enter personal and institutional details to add a new %s.', 'codeclove-school-management' ), staffLabelSingular.toLowerCase() )
        }
        onBack={onCancel}
        breadcrumbs={[
          { label: staffLabelPlural },
          { label: __( 'Directory', 'codeclove-school-management' ), href: '/staff' },
          isEditMode ? { label: staff ? `${staff.first_name} ${staff.last_name}` : __( 'Profile', 'codeclove-school-management' ), href: `/staff/${staffId}` } : null,
          { label: isEditMode ? __( 'Edit', 'codeclove-school-management' ) : __( 'Add New', 'codeclove-school-management' ) }
        ].filter(Boolean) as { label: string; href?: string }[]}
      />

      <StaffForm
        mode={isEditMode ? 'edit' : 'add'}
        initialData={staff}
        onSubmit={onSubmit}
        onCancel={onCancel}
        isPending={isPending}
      />
    </div>
  )
}
