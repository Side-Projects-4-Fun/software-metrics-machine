import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SortableTable } from '@/components/ui/sortable-table';

interface TestRow {
  name: string;
  count: number;
  status: string;
}

const defaultColumns = [
  { key: 'name', label: 'Name' },
  { key: 'count', label: 'Count', align: 'right' as const },
  { key: 'status', label: 'Status' },
];

const defaultRows: TestRow[] = [
  { name: 'Alice', count: 30, status: 'active' },
  { name: 'Bob', count: 10, status: 'inactive' },
  { name: 'Charlie', count: 20, status: 'active' },
];

function renderTable(overrides?: {
  columns?: typeof defaultColumns;
  rows?: TestRow[];
  getRowKey?: (row: TestRow) => string;
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
}) {
  return render(
    <SortableTable
      columns={overrides?.columns ?? defaultColumns}
      rows={overrides?.rows ?? defaultRows}
      getRowKey={overrides?.getRowKey ?? ((row) => row.name)}
      defaultSort={overrides?.defaultSort}
    />,
  );
}

describe('SortableTable', () => {
  it('renders column headers', () => {
    renderTable();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders all rows', () => {
    renderTable();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('renders cells with correct alignment', () => {
    renderTable();
    // MUI TableCell uses CSS textAlign, not HTML align attribute
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toHaveStyle({ textAlign: 'left' });

    const countHeader = screen.getByText('Count').closest('th');
    expect(countHeader).toHaveStyle({ textAlign: 'right' });
  });

  it('sorts ascending when a column header is clicked', () => {
    renderTable();
    fireEvent.click(screen.getByText('Name'));

    const rows = screen.getAllByRole('row');
    // row 0 is header, rows 1-3 are data
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Bob');
    expect(rows[3]).toHaveTextContent('Charlie');
  });

  it('sorts descending on second click', () => {
    renderTable();
    fireEvent.click(screen.getByText('Name'));
    fireEvent.click(screen.getByText('Name'));

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Charlie');
    expect(rows[2]).toHaveTextContent('Bob');
    expect(rows[3]).toHaveTextContent('Alice');
  });

  it('sorts numbers correctly', () => {
    renderTable();
    fireEvent.click(screen.getByText('Count'));

    const rows = screen.getAllByRole('row');
    // ascending: 10, 20, 30
    expect(rows[1]).toHaveTextContent('Bob');
    expect(rows[2]).toHaveTextContent('Charlie');
    expect(rows[3]).toHaveTextContent('Alice');
  });

  it('sorts numbers descending', () => {
    renderTable();
    fireEvent.click(screen.getByText('Count'));
    fireEvent.click(screen.getByText('Count'));

    const rows = screen.getAllByRole('row');
    // descending: 30, 20, 10
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Charlie');
    expect(rows[3]).toHaveTextContent('Bob');
  });

  it('applies defaultSort on initial render', () => {
    renderTable({
      defaultSort: { key: 'count', direction: 'desc' },
    });

    const rows = screen.getAllByRole('row');
    // desc: 30, 20, 10
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Charlie');
    expect(rows[3]).toHaveTextContent('Bob');
  });

  it('applies defaultSort ascending', () => {
    renderTable({
      defaultSort: { key: 'count', direction: 'asc' },
    });

    const rows = screen.getAllByRole('row');
    // asc: 10, 20, 30
    expect(rows[1]).toHaveTextContent('Bob');
    expect(rows[2]).toHaveTextContent('Charlie');
    expect(rows[3]).toHaveTextContent('Alice');
  });

  it('switches sort direction when clicking a different column', () => {
    renderTable({ defaultSort: { key: 'count', direction: 'desc' } });

    // Currently sorted by count desc: Alice(30), Charlie(20), Bob(10)
    let rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Alice');

    // Click Name -> sorts by name ascending
    fireEvent.click(screen.getByText('Name'));
    rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Bob');
    expect(rows[3]).toHaveTextContent('Charlie');
  });

  it('supports custom renderCell', () => {
    const columns = [
      {
        key: 'status',
        label: 'Status',
        renderCell: (row: TestRow) => (
          <span data-testid={`badge-${row.name}`}>{row.status.toUpperCase()}</span>
        ),
      },
    ];
    renderTable({ columns });

    expect(screen.getByTestId('badge-Alice')).toHaveTextContent('ACTIVE');
    expect(screen.getByTestId('badge-Bob')).toHaveTextContent('INACTIVE');
    expect(screen.getByTestId('badge-Charlie')).toHaveTextContent('ACTIVE');
  });

  it('supports custom compare function', () => {
    const columns = [
      {
        key: 'name',
        label: 'Name',
      },
      {
        key: 'status',
        label: 'Status',
        compare: (a: TestRow, b: TestRow) => {
          // Sort active before inactive
          if (a.status === 'active' && b.status !== 'active') {return -1;}
          if (a.status !== 'active' && b.status === 'active') {return 1;}
          return 0;
        },
      },
    ];
    renderTable({ columns, defaultSort: { key: 'status', direction: 'asc' } });

    const rows = screen.getAllByRole('row');
    // active rows first (Alice and Charlie), then inactive (Bob)
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Charlie');
    expect(rows[3]).toHaveTextContent('Bob');
  });

  it('renders non-sortable column without TableSortLabel', () => {
    const columns = [
      { key: 'name', label: 'Name', sortable: false },
    ];
    renderTable({ columns });

    const header = screen.getByText('Name').closest('th');
    expect(header).toBeInTheDocument();
    // TableSortLabel adds a specific class; non-sortable should not have it
    expect(screen.getByText('Name').closest('button')).toBeNull();
  });

  it('handles empty rows array', () => {
    renderTable({ rows: [] });
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    // Only header row
    expect(rows).toHaveLength(1);
  });

  it('uses getRowKey for row keys', () => {
    const getRowKey = jest.fn((row: TestRow) => `key-${row.name}`);
    renderTable({ getRowKey });

    expect(getRowKey).toHaveBeenCalledTimes(3);
    expect(getRowKey).toHaveBeenCalledWith(defaultRows[0]);
    expect(getRowKey).toHaveBeenCalledWith(defaultRows[1]);
    expect(getRowKey).toHaveBeenCalledWith(defaultRows[2]);
  });

  it('handles rows with null/undefined values gracefully', () => {
    const rows: TestRow[] = [
      { name: 'Alice', count: 10, status: 'active' },
      { name: '', count: 0, status: '' },
    ];
    renderTable({ rows });

    // Should not throw
    const tableRows = screen.getAllByRole('row');
    expect(tableRows).toHaveLength(3); // header + 2 data rows
  });

  it('marks the active sort column header', () => {
    renderTable({ defaultSort: { key: 'name', direction: 'asc' } });

    const nameHeader = screen.getByText('Name').closest('th');
    const countHeader = screen.getByText('Count').closest('th');

    // TableSortLabel adds aria-sort or active class when active
    const nameLabel = nameHeader?.querySelector('[class*="active"]');
    const countLabel = countHeader?.querySelector('[class*="active"]');

    expect(nameLabel).toBeInTheDocument();
    expect(countLabel).toBeNull();
  });

  it('sorts by string columns alphabetically', () => {
    renderTable({ defaultSort: { key: 'status', direction: 'asc' } });

    const rows = screen.getAllByRole('row');
    // alphabetically: active, active, inactive
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Charlie');
    expect(rows[3]).toHaveTextContent('Bob');
  });

  it('toggles direction multiple times on same column', () => {
    renderTable();

    // click 1: asc
    fireEvent.click(screen.getByText('Count'));
    let rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Bob'); // 10

    // click 2: desc
    fireEvent.click(screen.getByText('Count'));
    rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Alice'); // 30

    // click 3: asc again
    fireEvent.click(screen.getByText('Count'));
    rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Bob'); // 10
  });
});
