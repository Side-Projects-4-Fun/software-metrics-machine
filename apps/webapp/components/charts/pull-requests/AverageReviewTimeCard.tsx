'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ensureArray } from '@/server/utils/chartData';
import { AvgReviewTimeData } from './types';
import { useLinkBuilder } from '@/components/providers/LinkBuilderContext';
import { TargetInfo } from '@/components/charts/TargetInfo';
import { formatMetricLabel } from '@/utils/formatMetricMethod';

export default function AverageReviewTimeCard({ data, method }: { data: AvgReviewTimeData[]; method?: string }) {
  const { urlBuilder } = useLinkBuilder();
  const daysLabel = formatMetricLabel(method, 'Days');

  const handleBarClick = (entry: AvgReviewTimeData) => {
    const url = urlBuilder.getPRsUrl({ author: entry.author });
    window.open(url, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Average Review Time</CardTitle>
          <TargetInfo metric="average-review-time" />
        </div>
        <p className="text-xs text-gray-500 mt-1">Click on bars to view author&apos;s PRs</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={ensureArray(data)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="author" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="avg_days" fill="#82ca9d" name={daysLabel} onClick={(e) => handleBarClick(e.payload)} style={{ cursor: 'pointer' }} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
