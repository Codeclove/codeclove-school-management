import { describe, it, expect } from 'vitest'
// @ts-expect-error node built-in without @types/node
import fs from 'node:fs'

describe('Student Import and Units Pagination Consistency', () => {
  const importPageSource = fs.readFileSync(
    new URL('../modules/students/StudentImportPage.tsx', import.meta.url),
    'utf-8'
  )
  const academicsApiSource = fs.readFileSync(
    new URL('../api/academics.ts', import.meta.url),
    'utf-8'
  )

  it('StudentImportPage scopes useUnits to sessionId and per_page: 200', () => {
    // Ensures classes are scoped to the selected session and not capped at default 10
    expect(importPageSource).toMatch(/useUnits\(\s*sessionId \? \{ session_id: Number\(sessionId\), per_page: 200 \} : undefined/)
    expect(importPageSource).toContain('enabled: Boolean(sessionId)')
  })

  it('StudentImportPage resets unitId and groupId when sessionId changes', () => {
    // Ensures changing academic session invalidates previous session classes
    expect(importPageSource).toMatch(/setSessionId\(val\)\s*setUnitId\(''\)\s*setGroupId\(''\)/)
  })

  it('StudentImportPage disables class dropdown when no session is selected', () => {
    expect(importPageSource).toContain('disabled={!sessionId || loadingUnits}')
  })

  it('useUnits and useGroups support optional query options in academics API', () => {
    expect(academicsApiSource).toContain('options?: Partial<UseQueryOptions<PaginatedResponse<AcademicUnit>>>')
    expect(academicsApiSource).toContain('options?: Partial<UseQueryOptions<PaginatedResponse<AcademicGroup>>>')
  })
})
