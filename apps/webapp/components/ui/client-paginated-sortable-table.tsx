'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Pagination, Typography } from '@mui/material';
import { SortableColumn, SortableTable } from '@/components/ui/sortable-table';

type SortDirection = 'asc' | 'desc';

interface ClientPaginatedSortableTableProps<T> {
  columns: SortableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  defaultSort?: { key: string; direction: SortDirection };
  pageSize?: number;
  frameHeight?: number | string;
  frameTestId?: string;
}

export function ClientPaginatedSortableTable<T>({
  columns,
  rows,
  getRowKey,
  defaultSort,
  pageSize = 10,
  frameHeight,
  frameTestId,
}: ClientPaginatedSortableTableProps<T>) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [rows]);

  const visibleRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, rows]
  );

  return (
    <>
      <Box
        data-testid={frameTestId}
        sx={{
          height: frameHeight,
          overflow: 'auto',
        }}
      >
        <SortableTable
          rows={visibleRows}
          getRowKey={getRowKey}
          defaultSort={defaultSort}
          columns={columns}
        />
      </Box>
      {rows.length > pageSize && (
        <Box
          sx={{
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, rows.length)} of {rows.length}
          </Typography>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_event, value) => setPage(value)}
            size="small"
            shape="rounded"
          />
        </Box>
      )}
    </>
  );
}
