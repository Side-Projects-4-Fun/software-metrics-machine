'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientPaginatedSortableTable } from '@/components/ui/client-paginated-sortable-table';
import { JobByStatusData } from './types';
import { useLinkBuilder } from '@/components/providers/LinkBuilderContext';
import { TargetInfo } from '@/components/charts/TargetInfo';

export default function JobsByStatusCard({ data }: { data: JobByStatusData[] }) {
  const { urlBuilder } = useLinkBuilder();

  const getStatusColor = (status: string) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower === 'success') {
      return 'bg-green-100 text-green-800 hover:bg-green-200';
    } else if (statusLower === 'failure') {
      return 'bg-red-100 text-red-800 hover:bg-red-200';
    } else if (statusLower === 'pending' || statusLower === 'in_progress') {
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    }
    return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
  };

  const columns = [
    {
      key: 'status',
      label: 'Status',
      renderCell: (job: JobByStatusData) => (
        <a
          href={urlBuilder.getPipelinesUrl({ status: job.status })}
          target="_blank"
          rel="noopener noreferrer"
          className={`px-2 py-1 rounded text-xs font-medium inline-block transition-colors ${getStatusColor(job.status)}`}
        >
          {job.status || 'Unknown'}
        </a>
      ),
    },
    { key: 'count', label: 'Count', align: 'right' as const },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Jobs by Status</CardTitle>
          <TargetInfo metric="jobs-success-rate" />
        </div>
        <p className="text-xs text-gray-500 mt-1">Click to view pipeline runs with this status</p>
      </CardHeader>
      <CardContent>
        <ClientPaginatedSortableTable
          columns={columns}
          rows={Array.isArray(data) ? data : []}
          getRowKey={(job) => job.status || 'unknown'}
          defaultSort={{ key: 'count', direction: 'desc' }}
          pageSize={10}
        />
      </CardContent>
    </Card>
  );
}
