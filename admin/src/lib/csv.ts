/**
 * ponytail: simple regex-free CSV parser supporting quoted values without external libraries.
 * Ceiling: In-memory string splitting, suitable for single-batch school rosters up to ~10,000 rows.
 * Upgrade path: PapaParse or Web Streams API if rosters exceed 10k rows or multiline quoted fields are required.
 */
export function parseCSVText(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2 || !lines[0]) return []

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase())

  return lines.slice(1).map((line) => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^["']|["']$/g, ''))
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim().replace(/^["']|["']$/g, ''))

    return Object.fromEntries(headers.map((h, idx) => [h, values[idx] || '']))
  })
}
