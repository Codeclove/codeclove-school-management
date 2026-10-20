/**
 * academic-utils.ts — Shared calculation & display helpers for academics.
 */

export function calculateTermSplits(startStr: string, endStr: string, count: number, label: string) {
  const start = new Date(startStr + 'T00:00:00')
  const end = new Date(endStr + 'T00:00:00')
  const totalDays = Math.round((end.getTime() - start.getTime()) / 864e5) + 1
  const daysPerTerm = Math.floor(totalDays / count)
  const prefix = count === 2 ? 'Semester' : count === 4 ? 'Quarter' : label
  const code = count === 2 ? 'S' : count === 4 ? 'Q' : 'T'

  // ponytail: en-CA locale formats natively as YYYY-MM-DD
  const toYMD = (d: Date) => d.toLocaleDateString('en-CA')

  return Array.from({ length: count }, (_, i) => {
    const s = new Date(start)
    s.setDate(s.getDate() + i * daysPerTerm)
    const e = i === count - 1 ? end : new Date(start)
    if (i !== count - 1) {
      e.setDate(e.getDate() + (i + 1) * daysPerTerm - 1)
    }
    const finalEnd = e > end ? end : e
    return {
      name: `${prefix} ${i + 1}`,
      code: `${code}${i + 1}`,
      start_date: toYMD(s),
      end_date: toYMD(finalEnd),
    }
  })
}
