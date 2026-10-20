import { parse, isValid } from 'date-fns'

/**
 * Parses dates with multiple formats and delimiters flexibly.
 */
export function parseFlexibleDate(val: string, formatStr: string): Date | null {
  const cleanVal = val.trim()
  if (!cleanVal) return null

  // 1. Try exact parse with the format string first
  let parsed = parse(cleanVal, formatStr, new Date())
  if (isValid(parsed)) return parsed

  // 2. Try normalizing delimiters and matching formats
  const normalizedVal = cleanVal.replace(/[-.\s]/g, '/')
  const normalizedFormat = formatStr.replace(/[-.\s]/g, '/')
  parsed = parse(normalizedVal, normalizedFormat, new Date())
  if (isValid(parsed)) return parsed

  // 3. Positional parsing based on component indices (DMY, MDY, YMD)
  const lowerFormat = formatStr.toLowerCase()
  const dIdx = lowerFormat.indexOf('d')
  const mIdx = lowerFormat.indexOf('m')
  const yIdx = lowerFormat.indexOf('y')

  const parts = cleanVal.split(/[^0-9]+/)
  if (parts.length === 3) {
    let day = 0, month = 0, year = 0

    const indices = [
      { name: 'd', idx: dIdx },
      { name: 'm', idx: mIdx },
      { name: 'y', idx: yIdx },
    ].sort((a, b) => a.idx - b.idx)

    indices.forEach((item, index) => {
      const partVal = parseInt(parts[index] || '', 10)
      if (item.name === 'd') day = partVal
      if (item.name === 'm') month = partVal
      if (item.name === 'y') year = partVal
    })

    if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      if (year < 100) {
        year = year >= 50 ? 1900 + year : 2000 + year
      }
      const testDate = new Date(year, month - 1, day)
      if (
        isValid(testDate) &&
        testDate.getDate() === day &&
        testDate.getMonth() === month - 1 &&
        testDate.getFullYear() === year
      ) {
        return testDate
      }
    }
  }

  // 4. Native JS date parse fallback
  const nativeTime = Date.parse(cleanVal)
  if (!isNaN(nativeTime)) {
    const nativeDate = new Date(nativeTime)
    if (isValid(nativeDate)) return nativeDate
  }

  return null
}
