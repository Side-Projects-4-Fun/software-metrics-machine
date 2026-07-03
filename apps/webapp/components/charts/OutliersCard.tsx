'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TargetInfo } from '@/components/charts/TargetInfo';
import { ClientPaginatedSortableTable } from '@/components/ui/client-paginated-sortable-table';

export interface MetricOutlierRow {
  id: string;
  metric: string;
  value: number;
  timestamp: string;
  lowerBound: number;
  upperBound: number;
  item: Record<string, unknown>;
}

const TABLE_HEIGHT = 560;

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function itemLabel(item: Record<string, unknown>): string {
  const prNumber = item.number ? `#${String(item.number)}` : '';
  const title = typeof item.title === 'string' ? item.title : '';
  const runId = typeof item.runId === 'string' ? `run ${item.runId}` : '';
  const jobName = typeof item.jobName === 'string' ? item.jobName : '';
  const stepName = typeof item.stepName === 'string' ? item.stepName : '';
  const workflowName = typeof item.workflowName === 'string' ? item.workflowName : '';

  return [prNumber, title, workflowName, jobName, stepName, runId]
    .filter(Boolean)
    .join(' / ') || 'Unknown';
}

export default function OutliersCard({ rows }: { rows: MetricOutlierRow[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Flagged Outliers</CardTitle>
          <TargetInfo metric="metric-outliers" />
        </div>
      </CardHeader>
      <CardContent>
        <ClientPaginatedSortableTable
          frameTestId="outliers-table-frame"
          frameHeight={TABLE_HEIGHT}
          rows={rows}
          pageSize={10}
          getRowKey={(row) => row.id}
          defaultSort={{ key: 'value', direction: 'desc' }}
          columns={[
            { key: 'metric', label: 'Metric' },
            {
              key: 'value',
              label: 'Value',
              align: 'right',
              renderCell: (row) => formatNumber(row.value),
            },
            {
              key: 'bounds',
              label: 'IQR Bounds',
              sortable: false,
              renderCell: (row) => `${formatNumber(row.lowerBound)} - ${formatNumber(row.upperBound)}`,
            },
            { key: 'timestamp', label: 'Timestamp' },
            {
              key: 'item',
              label: 'Item',
              sortable: false,
              renderCell: (row) => {
                const url = typeof row.item.url === 'string' ? row.item.url : '';
                const label = itemLabel(row.item);
                return url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                    {label}
                  </a>
                ) : (
                  label
                );
              },
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
