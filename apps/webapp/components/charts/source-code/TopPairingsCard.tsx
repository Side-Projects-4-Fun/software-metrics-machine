'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SortableTable } from '@/components/ui/sortable-table';
import { TargetInfo } from '@/components/charts/TargetInfo';

type TopPairing = {
  author: string;
  co_author: string;
  paired_commits: number;
};

export function TopPairingsCard({ data }: { data: TopPairing[] }) {
  const columns = [
    {
      key: 'author',
      label: 'Pair',
      renderCell: (pair: TopPairing) => `${pair.author} + ${pair.co_author}`,
    },
    {
      key: 'paired_commits',
      label: 'Paired Commits',
      align: 'right' as const,
      renderCell: (pair: TopPairing) => (
        <span className="px-2 py-1 rounded bg-blue-100 text-blue-800">
          {pair.paired_commits}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Who Paired The Most With Whom</CardTitle>
          <TargetInfo metric="code-pairing-index" />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Ranked by number of paired commits between each author pair.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">No paired commits found for the selected filters.</p>
        ) : (
          <SortableTable
            columns={columns}
            rows={data}
            getRowKey={(pair) => `${pair.author}-${pair.co_author}`}
            defaultSort={{ key: 'paired_commits', direction: 'desc' }}
          />
        )}
      </CardContent>
    </Card>
  );
}