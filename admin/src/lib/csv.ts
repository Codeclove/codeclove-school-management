/**
 * ponytail: simple regex-free CSV parser supporting quoted values without external libraries.
 * Ceiling: In-memory string splitting, suitable for single-batch school rosters up to ~10,000 rows.
 * Upgrade path: PapaParse or Web Streams API if rosters exceed 10k rows or multiline quoted fields are required.
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

export function parseCSVText(text: string): Record<string, string>[] {
  const cleanText = text.replace(/^\uFEFF/, '')
  const lines = cleanText.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2 || !lines[0]) return []

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().trim().replace(/[\s./\\()#*—-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  )

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line)
    return Object.fromEntries(headers.map((h, idx) => [h, values[idx] || '']))
  })
}
/**
 * Formats a 2D array of headers and rows into a sanitized CSV string.
 * Escapes internal quotes and wraps each field with quotation marks.
 * Prepends UTF-8 BOM (\uFEFF) for seamless Microsoft Excel compatibility.
 */
export function formatCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const sanitize = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '""'
    return `"${String(val).replace(/"/g, '""')}"`
  }

  const csvBody = [headers, ...rows]
    .map((row) => row.map(sanitize).join(','))
    .join('\r\n')

  return '\uFEFF' + csvBody
}

/**
 * Triggers a native browser download of a CSV file.
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  if (typeof document === 'undefined') return
  const content = formatCSV(headers, rows)
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
