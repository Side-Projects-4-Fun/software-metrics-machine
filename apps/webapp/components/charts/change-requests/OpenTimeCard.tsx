'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ensureArray } from '@/server/utils/chartData';
import { OpenTimeData } from './types';
import { TargetInfo } from '@/components/charts/TargetInfo';
import { formatMetricLabel } from '@/utils/formatMetricMethod';

export default function OpenTimeCard({ data, method }: { data: OpenTimeData[]; method?: string }) {
  const openLabel = formatMetricLabel(method, 'Days Open');
  const formattedMap = new Map<number, string>(data.map((item) => [item.value, item.value_formatted]));
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Days Change Requests Remain Open</CardTitle>
          <TargetInfo metric="change-requests-remain-open" />
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={ensureArray(data)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis tickFormatter={(value) => formattedMap.get(Number(value)) ?? String(Number(value) || 0)} />
            <Tooltip formatter={(value: unknown) => formattedMap.get(Number(value)) ?? String(Number(value) || 0)} />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#82ca9d" name={openLabel} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}