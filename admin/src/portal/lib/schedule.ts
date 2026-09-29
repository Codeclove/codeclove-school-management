/**
 * Portal Schedule & Timetable Utilities.
 *
 * Provides time parsing, break/recess calculation, room formatting,
 * and current slot detection for portal schedule components.
 */

export const parseTimeToMinutes = (timeStr?: string | null): number | null => {
  if (!timeStr || !/^\d{1,2}:\d{2}/.test(timeStr)) return null
  const [h, m] = timeStr.split(':').map(Number)
  return h !== undefined && m !== undefined ? h * 60 + m : null
}

export interface ScheduleBreak {
  type: 'break'
  startTime: string
  endTime: string
  durationMinutes: number
  label: string
}

export const getBreakBetweenSlots = (
  currentEndTime?: string | null,
  nextStartTime?: string | null
): ScheduleBreak | null => {
  const endMin = parseTimeToMinutes(currentEndTime)
  const nextStartMin = parseTimeToMinutes(nextStartTime)
  if (endMin === null || nextStartMin === null) return null
  const gap = nextStartMin - endMin
  if (gap < 10) return null

  return {
    type: 'break',
    startTime: currentEndTime!,
    endTime: nextStartTime!,
    durationMinutes: gap,
    label: endMin >= 690 && endMin <= 810 ? 'Lunch Break' : 'Recess / Break',
  }
}

export const getSlotStatus = (
  startTime?: string | null,
  endTime?: string | null,
  currentTime: Date = new Date()
): 'past' | 'current' | 'upcoming' => {
  const startMin = parseTimeToMinutes(startTime)
  const endMin = parseTimeToMinutes(endTime)
  if (startMin === null || endMin === null) return 'upcoming'

  const currentMin = currentTime.getHours() * 60 + currentTime.getMinutes()
  return currentMin < startMin ? 'upcoming' : currentMin < endMin ? 'current' : 'past'
}

export const getGreeting = (date: Date = new Date()): string => {
  const h = date.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export const formatRoomName = (room?: string | null): string | null => {
  if (!room || typeof room !== 'string') return null
  const trimmed = room.trim()
  if (!trimmed || /seeded/i.test(trimmed)) return null
  return /^(room|lab|hall|ground|auditorium|block|studio)\b/i.test(trimmed)
    ? trimmed
    : `Room ${trimmed}`
}
