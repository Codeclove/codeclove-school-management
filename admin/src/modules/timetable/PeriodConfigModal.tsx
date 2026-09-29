import { useState, useEffect } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, Save } from 'lucide-react'
import {
  usePeriods,
  useCreatePeriod,
  useUpdatePeriod,
  useDeletePeriod,
  useReorderPeriods,
  type TimetablePeriod
} from '@/api/timetable'
import {
  Button,
  Modal,
  ModalFooter,
  FormField,
  Input,
  Select,
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Skeleton
} from '@/components/ui'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { __, sprintf } from '@/lib/i18n'

interface PeriodConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: number
  unitId: number
  unitName: string
}

export default function PeriodConfigModal({
  open,
  onOpenChange,
  sessionId,
  unitId,
  unitName
}: PeriodConfigModalProps) {
  const toast = useToast()
  const confirm = useConfirm()
  const { data: periods = [], isLoading } = usePeriods({
    academic_session_id: sessionId,
    academic_unit_id: unitId
  })

  const createMutation = useCreatePeriod()
  const updateMutation = useUpdatePeriod()
  const deleteMutation = useDeletePeriod()
  const reorderMutation = useReorderPeriods()

  // Local state for editing/adding
  const [localPeriods, setLocalPeriods] = useState<TimetablePeriod[]>([])
  const [newPeriod, setNewPeriod] = useState({
    name: '',
    short_name: '',
    type: 'lesson' as 'lesson' | 'break' | 'assembly',
    start_time: '',
    end_time: ''
  })

  useEffect(() => {
    if (periods) {
      setLocalPeriods(periods)
    }
  }, [periods])

  const handleCreate = async () => {
    if (!newPeriod.name || !newPeriod.short_name || !newPeriod.start_time || !newPeriod.end_time) {
      toast.error(__( 'All fields are required to add a period.', 'codeclove-school-management' ))
      return
    }

    try {
      await createMutation.mutateAsync({
        academic_session_id: sessionId,
        academic_unit_id: unitId,
        ...newPeriod
      })
      toast.success(__( 'Period added successfully.', 'codeclove-school-management' ))
      setNewPeriod({
        name: '',
        short_name: '',
        type: 'lesson',
        start_time: '',
        end_time: ''
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to add period.', 'codeclove-school-management' )
      toast.error(message)
    }
  }

  const handleUpdateField = <K extends keyof TimetablePeriod>(index: number, field: K, value: TimetablePeriod[K]) => {
    const updated = [...localPeriods]
    const item = updated[index]
    if (item) {
      updated[index] = { ...item, [field]: value }
      setLocalPeriods(updated)
    }
  }

  const handleSaveRow = async (period: TimetablePeriod) => {
    try {
      await updateMutation.mutateAsync({
        id: period.id,
        data: {
          name: period.name,
          short_name: period.short_name,
          type: period.type,
          start_time: period.start_time,
          end_time: period.end_time
        }
      })
      toast.success(__( 'Period updated successfully.', 'codeclove-school-management' ))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to update period.', 'codeclove-school-management' )
      toast.error(message)
    }
  }

  const handleDelete = async (id: number) => {
    const isConfirmed = await confirm({
      title: __( 'Delete Period', 'codeclove-school-management' ),
      message: __( 'Are you sure you want to delete this period? This will clear all scheduling slots using this period.', 'codeclove-school-management' ),
    })
    if (!isConfirmed) return
    try {
      await deleteMutation.mutateAsync(id)
      toast.success(__( 'Period deleted successfully.', 'codeclove-school-management' ))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to delete period.', 'codeclove-school-management' )
      toast.error(message)
    }
  }

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= localPeriods.length) return

    const updated = [...localPeriods]
    const temp = updated[index] as TimetablePeriod
    updated[index] = updated[targetIndex] as TimetablePeriod
    updated[targetIndex] = temp

    setLocalPeriods(updated)

    try {
      await reorderMutation.mutateAsync(updated.map((p) => p.id))
      toast.success(__( 'Periods reordered.', 'codeclove-school-management' ))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : __( 'Failed to save reorder.', 'codeclove-school-management' )
      toast.error(message)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={sprintf( __( 'Configure Period Slots — %s', 'codeclove-school-management' ), unitName )}
      description={__( 'Define the time intervals, lectures, and break schedules for this class level.', 'codeclove-school-management' )}
      size="xl"
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
        ) : (
          <div className="space-y-4">
            {localPeriods.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">{__( 'No periods configured yet. Add one below.', 'codeclove-school-management' )}</p>
            ) : (
              <TableRoot className="border border-border rounded-lg overflow-hidden bg-bg-surface text-xs">
                <Thead>
                  <Tr>
                    <Th className="w-8"></Th>
                    <Th>{__( 'Period Name', 'codeclove-school-management' )}</Th>
                    <Th className="w-20">{__( 'Abbr', 'codeclove-school-management' )}</Th>
                    <Th className="w-32 min-w-[130px]">{__( 'Type', 'codeclove-school-management' )}</Th>
                    <Th className="w-28">{__( 'Start Time', 'codeclove-school-management' )}</Th>
                    <Th className="w-28">{__( 'End Time', 'codeclove-school-management' )}</Th>
                    <Th className="w-24 text-right">{__( 'Actions', 'codeclove-school-management' )}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {localPeriods.map((p, idx) => (
                    <Tr key={p.id} className="hover:bg-hover-bg/10">
                      <Td className="flex items-center gap-1 py-2">
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, 'up')}
                          className="p-1 rounded hover:bg-hover-bg text-text-subtle disabled:opacity-30"
                          aria-label={sprintf( __( 'Move %s up', 'codeclove-school-management' ), p.name || sprintf( __( 'row %d', 'codeclove-school-management' ), idx + 1 ) )}
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          disabled={idx === localPeriods.length - 1}
                          onClick={() => handleMove(idx, 'down')}
                          className="p-1 rounded hover:bg-hover-bg text-text-subtle disabled:opacity-30"
                          aria-label={sprintf( __( 'Move %s down', 'codeclove-school-management' ), p.name || sprintf( __( 'row %d', 'codeclove-school-management' ), idx + 1 ) )}
                        >
                          <ArrowDown size={11} />
                        </button>
                      </Td>
                      <Td>
                        <Input
                          aria-label={sprintf( __( 'Period name for %s', 'codeclove-school-management' ), p.name || sprintf( __( 'row %d', 'codeclove-school-management' ), idx + 1 ) )}
                          value={p.name}
                          onChange={(e) => handleUpdateField(idx, 'name', e.target.value)}
                          className="h-7 text-xs px-2"
                        />
                      </Td>
                      <Td>
                        <Input
                          aria-label={sprintf( __( 'Abbreviation for %s', 'codeclove-school-management' ), p.name || sprintf( __( 'row %d', 'codeclove-school-management' ), idx + 1 ) )}
                          value={p.short_name}
                          onChange={(e) => handleUpdateField(idx, 'short_name', e.target.value)}
                          className="h-7 text-xs px-2 font-mono"
                        />
                      </Td>
                      <Td>
                        <Select
                          aria-label={sprintf( __( 'Type for %s', 'codeclove-school-management' ), p.name || sprintf( __( 'row %d', 'codeclove-school-management' ), idx + 1 ) )}
                          value={p.type}
                          onValueChange={(val) => handleUpdateField(idx, 'type', val as TimetablePeriod['type'])}
                          options={[
                            { value: 'lesson', label: __( 'Lecture', 'codeclove-school-management' ) },
                            { value: 'break', label: __( 'Break', 'codeclove-school-management' ) },
                            { value: 'assembly', label: __( 'Assembly', 'codeclove-school-management' ) },
                          ]}
                          className="h-7 text-xs px-2"
                        />
                      </Td>
                      <Td>
                        <Input
                          type="time"
                          aria-label={sprintf( __( 'Start time for %s', 'codeclove-school-management' ), p.name || sprintf( __( 'row %d', 'codeclove-school-management' ), idx + 1 ) )}
                          value={p.start_time}
                          onChange={(e) => handleUpdateField(idx, 'start_time', e.target.value)}
                          className="h-7 text-xs px-2 font-mono"
                        />
                      </Td>
                      <Td>
                        <Input
                          type="time"
                          aria-label={sprintf( __( 'End time for %s', 'codeclove-school-management' ), p.name || sprintf( __( 'row %d', 'codeclove-school-management' ), idx + 1 ) )}
                          value={p.end_time}
                          onChange={(e) => handleUpdateField(idx, 'end_time', e.target.value)}
                          className="h-7 text-xs px-2 font-mono"
                        />
                      </Td>
                      <Td className="text-right space-x-1.5">
                        <button
                          onClick={() => handleSaveRow(p)}
                          className="p-1.5 rounded hover:bg-success-dim text-success-strong"
                          title={__( 'Save changes', 'codeclove-school-management' )}
                          aria-label={sprintf( __( 'Save changes for %s', 'codeclove-school-management' ), p.name || sprintf( __( 'row %d', 'codeclove-school-management' ), idx + 1 ) )}
                        >
                          <Save size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded hover:bg-danger-dim text-danger"
                          title={__( 'Delete period', 'codeclove-school-management' )}
                          aria-label={sprintf( __( 'Delete %s', 'codeclove-school-management' ), p.name || sprintf( __( 'row %d', 'codeclove-school-management' ), idx + 1 ) )}
                        >
                          <Trash2 size={12} />
                        </button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </TableRoot>
            )}

            {/* Add New Period form */}
            <div className="border border-dashed border-border rounded-xl p-4 bg-bg-base/30 space-y-3">
              <h4 className="text-xs font-semibold text-text uppercase tracking-wider">{__( 'Add Period Slot', 'codeclove-school-management' )}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <FormField label={__( 'Period Name', 'codeclove-school-management' )} required>
                  <Input
                    placeholder={__( 'e.g. Period 1', 'codeclove-school-management' )}
                    value={newPeriod.name}
                    onChange={(e) => setNewPeriod((prev) => ({ ...prev, name: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </FormField>
                <FormField label={__( 'Abbreviation', 'codeclove-school-management' )} required>
                  <Input
                    placeholder={__( 'e.g. P1', 'codeclove-school-management' )}
                    value={newPeriod.short_name}
                    onChange={(e) => setNewPeriod((prev) => ({ ...prev, short_name: e.target.value }))}
                    className="h-8 text-xs font-mono"
                  />
                </FormField>
                <FormField label={__( 'Slot Type', 'codeclove-school-management' )}>
                  <Select
                    value={newPeriod.type}
                    onValueChange={(val) => setNewPeriod((prev) => ({ ...prev, type: val as TimetablePeriod['type'] }))}
                    options={[
                      { value: 'lesson', label: __( 'Lecture', 'codeclove-school-management' ) },
                      { value: 'break', label: __( 'Break', 'codeclove-school-management' ) },
                      { value: 'assembly', label: __( 'Assembly', 'codeclove-school-management' ) }
                    ]}
                    placeholder={__( 'Type', 'codeclove-school-management' )}
                  />
                </FormField>
                <FormField label={__( 'Start Time', 'codeclove-school-management' )} required>
                  <Input
                    type="time"
                    value={newPeriod.start_time}
                    onChange={(e) => setNewPeriod((prev) => ({ ...prev, start_time: e.target.value }))}
                    className="h-8 text-xs font-mono"
                  />
                </FormField>
                <FormField label={__( 'End Time', 'codeclove-school-management' )} required>
                  <Input
                    type="time"
                    value={newPeriod.end_time}
                    onChange={(e) => setNewPeriod((prev) => ({ ...prev, end_time: e.target.value }))}
                    className="h-8 text-xs font-mono"
                  />
                </FormField>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-1 px-3 py-1 h-8 text-xs">
                  <Plus size={12} />
                  {__( 'Add Period', 'codeclove-school-management' )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {__( 'Close', 'codeclove-school-management' )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
