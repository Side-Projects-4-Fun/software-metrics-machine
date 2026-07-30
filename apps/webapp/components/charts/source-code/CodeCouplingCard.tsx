'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SortableTable } from '@/components/ui/sortable-table';
import { CouplingData } from './types';
import { TargetInfo } from '@/components/charts/TargetInfo';
import { formatMetricLabel } from '@/utils/formatMetricMethod';

export default function CodeCouplingCard({ data, method }: { data: CouplingData[]; method?: string }) {
  const revsLabel = formatMetricLabel(method, 'Revs');
  const columns = [
    { key: 'entity', label: 'Entity' },
    { key: 'coupled', label: 'Coupled With' },
    {
      key: 'degree',
      label: 'Degree',
      align: 'right' as const,
      renderCell: (item: CouplingData) => (
        <span className="px-2 py-1 rounded bg-blue-100 text-blue-800">{item.degree}</span>
      ),
    },
    {
      key: 'averageRevs',
      label: revsLabel,
      align: 'right' as const,
      renderCell: (item: CouplingData) => (
        <span className="px-2 py-1 rounded bg-green-100 text-green-800">{item.averageRevs}</span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Code Coupling (Top 20)</CardTitle>
          <TargetInfo metric="code-coupling" />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Lists file pairs that often change together. Higher Degree means stronger coupling;
          Avg. Revs indicates average shared revision activity.
        </p>
      </CardHeader>
      <CardContent>
        <SortableTable
          columns={columns}
          rows={Array.isArray(data) ? data : []}
          getRowKey={(item) => `${item.entity}-${item.coupled}`}
          defaultSort={{ key: 'degree', direction: 'desc' }}
        />
      </CardContent>
    </Card>
  );
}
