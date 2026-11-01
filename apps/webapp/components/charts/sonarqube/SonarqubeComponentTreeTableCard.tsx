'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SortableTable } from '@/components/ui/sortable-table';
import { SonarqubeComponentChartData } from './types';
import { useLinkBuilder } from '@/components/providers/LinkBuilderContext';
import { TargetInfo } from '@/components/charts/TargetInfo';

export default function SonarqubeComponentTreeTableCard({
  data,
}: {
  data: SonarqubeComponentChartData[];
}) {
  const { urlBuilder } = useLinkBuilder();

  const columns = [
    {
      key: 'name',
      label: 'Component',
      renderCell: (item: SonarqubeComponentChartData) => (
        <a
          href={urlBuilder.getSonarqubeComponentUrl(item.key)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
        >
          {item.name || item.key}
        </a>
      ),
    },
    {
      key: 'complexity',
      label: 'Complexity',
      align: 'right' as const,
      renderCell: (item: SonarqubeComponentChartData) => (
        <a
          href={urlBuilder.getSonarqubeComponentMeasuresUrl(item.key, 'complexity')}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {item.complexity.toFixed(0)}
        </a>
      ),
    },
    {
      key: 'cognitiveComplexity',
      label: 'Cognitive',
      align: 'right' as const,
      renderCell: (item: SonarqubeComponentChartData) => (
        <a
          href={urlBuilder.getSonarqubeComponentMeasuresUrl(item.key, 'cognitive_complexity')}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {item.cognitiveComplexity.toFixed(0)}
        </a>
      ),
    },
    {
      key: 'ncloc',
      label: 'NLOC',
      align: 'right' as const,
      renderCell: (item: SonarqubeComponentChartData) => item.ncloc.toFixed(0),
    },
    {
      key: 'coverage',
      label: 'Coverage',
      align: 'right' as const,
      renderCell: (item: SonarqubeComponentChartData) => `${item.coverage.toFixed(1)}%`,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Component Tree Metrics</CardTitle>
          <TargetInfo metric="sq-complexity" />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Detailed per-component metrics from SonarQube component tree (complexity, cognitive complexity,
          NLOC and coverage). Click component names to view in SonarQube.
        </p>
      </CardHeader>
      <CardContent>
        <SortableTable
          columns={columns}
          rows={data}
          getRowKey={(item) => item.key}
          defaultSort={{ key: 'complexity', direction: 'desc' }}
        />
      </CardContent>
    </Card>
  );
}
