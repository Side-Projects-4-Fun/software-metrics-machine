'use client';

import { useMemo, useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';

type SortDirection = 'asc' | 'desc';

export interface SortableColumn<T> {
  /** Accessor key on the row object */
  key: string;
  /** Header label */
  label: string;
  /** Text alignment (default: 'left') */
  align?: 'left' | 'right' | 'center';
  /** Whether this column is sortable (default: true) */
  sortable?: boolean;
  /** Custom cell renderer. If omitted, renders row[key] as-is. */
  renderCell?: (row: T) => React.ReactNode;
  /** Custom sort comparator. If omitted, sorts by row[key] using generic comparison. */
  compare?: (a: T, b: T) => number;
}

export interface SortableTableProps<T> {
  columns: SortableColumn<T>[];
  rows: T[];
  /** Returns a unique key for each row */
  getRowKey: (row: T) => string;
  /** Initial sort state */
  defaultSort?: { key: string; direction: SortDirection };
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  return String(a).localeCompare(String(b));
}

export function SortableTable<T>({
  columns,
  rows,
  getRowKey,
  defaultSort,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort?.direction ?? 'asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;

    const column = columns.find((c) => c.key === sortKey);
    const comparator = column?.compare ?? ((a: T, b: T) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];
      return compareValues(aVal, bVal);
    });

    const sorted = [...rows].sort((a, b) => comparator(a, b));
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [rows, sortKey, sortDirection, columns]);

  return (
    <TableContainer sx={{ overflow: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell
                key={col.key}
                align={col.align ?? 'left'}
                sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {col.sortable !== false ? (
                  <TableSortLabel
                    active={sortKey === col.key}
                    direction={sortKey === col.key ? sortDirection : 'asc'}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                  </TableSortLabel>
                ) : (
                  col.label
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={getRowKey(row)} hover>
              {columns.map((col) => (
                <TableCell key={col.key} align={col.align ?? 'left'}>
                  {col.renderCell
                    ? col.renderCell(row)
                    : String((row as Record<string, unknown>)[col.key] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
