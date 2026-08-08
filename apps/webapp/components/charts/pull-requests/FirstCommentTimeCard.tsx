'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ensureArray } from '@/server/utils/chartData';
import { FirstCommentTimeData } from './types';
import { useLinkBuilder } from '@/components/providers/LinkBuilderContext';
import { TargetInfo } from '@/components/charts/TargetInfo';
import { formatMetricLabel } from '@/utils/formatMetricMethod';

export default function FirstCommentTimeCard({ data, method }: { data: FirstCommentTimeData[]; method?: string }) {
  const { urlBuilder } = useLinkBuilder();
  const hoursLabel = formatMetricLabel(method, 'Hours');

  const handleBarClick = (entry: FirstCommentTimeData) => {
    const url = urlBuilder.getPRsUrl({ author: entry.author });
    window.open(url, '_blank');
  };

  const formattedMap = new Map<number, string>(data.map((item) => [item.value, item.value_formatted]));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Time To First Comment</CardTitle>
          <TargetInfo metric="time-to-first-comment" />
        </div>
        <p className="text-xs text-gray-500 mt-1">Click on bars to view author&apos;s PRs</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={ensureArray<FirstCommentTimeData>(data)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="author" angle={-45} textAnchor="end" height={100} />
            <YAxis tickFormatter={(value) => formattedMap.get(Number(value)) ?? String(Number(value) || 0)} />
            <Tooltip formatter={(value: unknown) => formattedMap.get(Number(value)) ?? String(Number(value) || 0)} />
            <Legend />
            <Bar
              dataKey="value"
              fill="#82ca9d"
              name={hoursLabel}
              onClick={(e) => handleBarClick(e.payload)}
              style={{ cursor: 'pointer' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}