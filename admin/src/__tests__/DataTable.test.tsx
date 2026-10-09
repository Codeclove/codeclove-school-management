import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { DataTable, type DataTableColumn } from '../components/ui/DataTable'
import type { UseTableStateReturn } from '../lib/useTableState'

interface SampleItem {
  id: number
  name: string
  code: string
  count: number
  status: string
  meta?: {
    tag: string
  }
}

const sampleColumns: DataTableColumn<SampleItem>[] = [
  { key: 'name', header: 'Name', type: 'primary', sortable: true },
  { key: 'code', header: 'Code', type: 'code' },
  { key: 'count', header: 'Count', type: 'number', sortable: true },
  { key: 'status', header: 'Status', type: 'badge' },
  { key: 'meta.tag', header: 'Tag' },
  {
    key: 'actions',
    header: 'Actions',
    type: 'actions',
    render: (row) => <button type="button">{`Edit ${row.name}`}</button>,
  },
]

const sampleData: SampleItem[] = [
  { id: 1, name: 'Alpha', code: 'ALP-01', count: 42, status: 'Active', meta: { tag: 'Important' } },
  { id: 2, name: 'Beta', code: 'BET-02', count: 18, status: 'Pending', meta: { tag: 'Review' } },
]

describe('DataTable<T> Component', () => {
  describe('Populated State & Rendering', () => {
    it('renders populated data with headers and cell contents', () => {
      const html = renderToString(
        <DataTable data={sampleData} columns={sampleColumns} />
      )

      expect(html).toContain('Alpha')
      expect(html).toContain('ALP-01')
      expect(html).toContain('42')
      expect(html).toContain('Active')
      expect(html).toContain('Important')
      expect(html).toContain('Edit Alpha')
      expect(html).toContain('Beta')
      expect(html).toContain('Review')
    })

    it('resolves nested object keys via dot notation fallback', () => {
      const html = renderToString(
        <DataTable data={sampleData} columns={sampleColumns} />
      )

      expect(html).toContain('Important')
      expect(html).toContain('Review')
    })

    it('uses custom keyExtractor when provided', () => {
      const keyExtractor = vi.fn((row: SampleItem) => `custom-${row.id}`)
      const html = renderToString(
        <DataTable data={sampleData} columns={sampleColumns} keyExtractor={keyExtractor} />
      )

      expect(keyExtractor).toHaveBeenCalled()
      expect(html).toContain('Alpha')
    })

    it('handles onRowClick adding cursor-pointer and tabIndex', () => {
      const onRowClick = vi.fn()
      const html = renderToString(
        <DataTable data={sampleData} columns={sampleColumns} onRowClick={onRowClick} />
      )

      expect(html).toContain('cursor-pointer')
      expect(html).toContain('tabindex="0"')
    })
  })

  describe('Column Alignment & Styling', () => {
    it('aligns number columns to the right with tabular-nums', () => {
      const html = renderToString(
        <DataTable data={sampleData} columns={sampleColumns} />
      )

      // The count column header and data cell
      expect(html).toContain('text-end')
      expect(html).toContain('tabular-nums')
    })

    it('aligns badge columns to the center', () => {
      const html = renderToString(
        <DataTable data={sampleData} columns={sampleColumns} />
      )

      expect(html).toContain('text-center')
    })

    it('aligns actions columns to the right', () => {
      const html = renderToString(
        <DataTable data={sampleData} columns={sampleColumns} />
      )

      expect(html).toContain('Edit Alpha')
    })
  })

  describe('Async UI States', () => {
    it('renders loading skeleton when isLoading is true', () => {
      const html = renderToString(
        <DataTable
          data={[]}
          columns={sampleColumns}
          isLoading={true}
          skeletonRows={3}
        />
      )

      expect(html).toContain('shimmer')
      expect(html).not.toContain('No records found')
      expect(html).not.toContain('Alpha')
    })

    it('renders error state with retry button when isError is true', () => {
      const onRetry = vi.fn()
      const html = renderToString(
        <DataTable
          data={[]}
          columns={sampleColumns}
          isError={true}
          errorMessage="Database connection failed"
          onRetry={onRetry}
        />
      )

      expect(html).toContain('Database connection failed')
      expect(html).toContain('Try again')
    })

    it('renders empty state when data is empty and not loading', () => {
      const html = renderToString(
        <DataTable
          data={[]}
          columns={sampleColumns}
          emptyState={{
            message: 'No students found',
            description: 'Try adjusting your search filters.',
          }}
        />
      )

      expect(html).toContain('No students found')
      expect(html).toContain('Try adjusting your search filters.')
    })
  })

  describe('Selection & Bulk Action Bar', () => {
    it('renders selection checkboxes when selectable is true', () => {
      const html = renderToString(
        <DataTable data={sampleData} columns={sampleColumns} selectable={true} />
      )

      expect(html).toContain('Select all rows')
      expect(html).toContain('Select row')
      expect(html).toContain('type="checkbox"')
    })

    it('renders bulk action bar when items are selected with useTableState mock', () => {
      const mockTable: Partial<UseTableStateReturn<any>> = {
        selectedIds: [1, 2],
        isSelected: (id) => [1, 2].includes(id),
        isAllSelected: () => true,
        toggleSelect: vi.fn(),
        toggleSelectAll: vi.fn(),
        clearSelection: vi.fn(),
        getSortProps: vi.fn(() => ({ sortable: true as const, sorted: false as const, onSort: vi.fn() })),
        page: 1,
        perPage: 10,
        setPage: vi.fn(),
        setPerPage: vi.fn(),
      }

      const html = renderToString(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          selectable={true}
          table={mockTable as UseTableStateReturn<any>}
          bulkActions={<button type="button">Delete All</button>}
        />
      )

      expect(html).toContain('2 selected')
      expect(html).toContain('Clear selection')
      expect(html).toContain('Delete All')
    })
  })

  describe('TablePagination Integration', () => {
    it('renders TablePagination when table and total are provided', () => {
      const mockTable: Partial<UseTableStateReturn<any>> = {
        page: 1,
        perPage: 10,
        setPage: vi.fn(),
        setPerPage: vi.fn(),
        selectedIds: [],
        isSelected: () => false,
        isAllSelected: () => false,
        toggleSelect: vi.fn(),
        toggleSelectAll: vi.fn(),
        clearSelection: vi.fn(),
        getSortProps: vi.fn(() => ({ sortable: true as const, sorted: false as const, onSort: vi.fn() })),
      }

      const html = renderToString(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          table={mockTable as UseTableStateReturn<any>}
          total={45}
        />
      )

      expect(html).toContain('Showing 1 to 10 of 45 records')
      expect(html).toContain('Rows:')
    })

    it('omits pagination when table is not provided', () => {
      const html = renderToString(
        <DataTable data={sampleData} columns={sampleColumns} total={45} />
      )

      expect(html).not.toContain('Showing 1 to 10 of 45 records')
    })
  })

  describe('Card Wrapper Configuration', () => {
    it('wraps in Card container by default (cardWrapper=true)', () => {
      const html = renderToString(
        <DataTable data={sampleData} columns={sampleColumns} />
      )

      expect(html).toContain('shadow-card')
      expect(html).toContain('bg-bg-elevated')
    })

    it('renders plain div container when cardWrapper is false', () => {
      const html = renderToString(
        <DataTable data={sampleData} columns={sampleColumns} cardWrapper={false} />
      )

      expect(html).toContain('overflow-hidden rounded-lg')
    })
  })
})
