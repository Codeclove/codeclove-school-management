import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseCSVText, formatCSV, exportToCSV } from '../lib/csv'

describe('CSV Utilities', () => {
  describe('parseCSVText', () => {
    it('returns empty array when input is empty or has only headers', () => {
      expect(parseCSVText('')).toEqual([])
      expect(parseCSVText('name,email')).toEqual([])
      expect(parseCSVText('   \n  ')).toEqual([])
    })

    it('parses valid CSV text into records with clean snake_case keys', () => {
      const input = `First Name,Last Name,Grade\nJohn,Doe,10\nJane,Smith,11`
      const result = parseCSVText(input)
      expect(result).toEqual([
        { first_name: 'John', last_name: 'Doe', grade: '10' },
        { first_name: 'Jane', last_name: 'Smith', grade: '11' },
      ])
    })

    it('handles quoted fields with commas and slashes in headers', () => {
      const input = `Name,Address,Primary Parent / Guardian\n"Doe, John","123 Maple St, Apt 4","Jane Doe"`
      const result = parseCSVText(input)
      expect(result[0]).toEqual({
        name: 'Doe, John',
        address: '123 Maple St, Apt 4',
        primary_parent_guardian: 'Jane Doe',
      })
    })

    it('strips UTF-8 BOM on import', () => {
      const input = `\uFEFFFirst Name,Last Name\nAlice,Wonderland`
      const result = parseCSVText(input)
      expect(result[0]).toEqual({
        first_name: 'Alice',
        last_name: 'Wonderland',
      })
    })
  })

  describe('formatCSV', () => {
    it('prepends UTF-8 BOM and wraps all fields in quotes', () => {
      const headers = ['ID', 'Name', 'Status']
      const rows = [
        [1, 'Alice', 'active'],
        [2, 'Bob', 'inactive'],
      ]
      const output = formatCSV(headers, rows)

      expect(output.startsWith('\uFEFF')).toBe(true)
      const clean = output.slice(1) // strip BOM
      const lines = clean.split('\r\n')
      expect(lines[0]).toBe('"ID","Name","Status"')
      expect(lines[1]).toBe('"1","Alice","active"')
      expect(lines[2]).toBe('"2","Bob","inactive"')
    })

    it('escapes internal double quotes by doubling them', () => {
      const headers = ['Note']
      const rows = [
        ['Quoted "word" test'],
        [null],
        [undefined],
      ]
      const output = formatCSV(headers, rows).slice(1)
      const lines = output.split('\r\n')

      expect(lines[1]).toBe('"Quoted ""word"" test"')
      expect(lines[2]).toBe('""')
      expect(lines[3]).toBe('""')
    })
  })

  describe('exportToCSV', () => {
    let originalCreateObjectURL: typeof URL.createObjectURL
    let originalRevokeObjectURL: typeof URL.revokeObjectURL
    let originalDocument: typeof globalThis.document

    beforeEach(() => {
      originalCreateObjectURL = URL.createObjectURL
      originalRevokeObjectURL = URL.revokeObjectURL
      originalDocument = globalThis.document

      URL.createObjectURL = vi.fn(() => 'blob:mock-url')
      URL.revokeObjectURL = vi.fn()
    })

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
      globalThis.document = originalDocument
      vi.restoreAllMocks()
    })

    it('handles execution safely in non-browser environments without error', () => {
      // @ts-expect-error simulating node environment without document
      globalThis.document = undefined
      expect(() => exportToCSV('test', ['A'], [['1']])).not.toThrow()
    })

    it('creates a download link with .csv extension and triggers click', () => {
      const clickSpy = vi.fn()
      const appendChildSpy = vi.fn()
      const removeChildSpy = vi.fn()
      const setAttributeSpy = vi.fn()

      const mockLink = {
        setAttribute: setAttributeSpy,
        click: clickSpy,
      }

      globalThis.document = {
        createElement: vi.fn((tag: string) => {
          if (tag === 'a') return mockLink as unknown as HTMLElement
          return {} as HTMLElement
        }),
        body: {
          appendChild: appendChildSpy,
          removeChild: removeChildSpy,
        } as unknown as HTMLElement,
      } as unknown as Document

      exportToCSV('students_test', ['ID', 'Name'], [[1, 'John Doe']])

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
      expect(setAttributeSpy).toHaveBeenCalledWith('href', 'blob:mock-url')
      expect(setAttributeSpy).toHaveBeenCalledWith('download', 'students_test.csv')
      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink)
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })
  })
})
