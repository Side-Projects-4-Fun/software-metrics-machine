'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ensureArray } from '@/server/utils/chartData';
import { OpenThroughTimeData } from './types';
import { TargetInfo } from '@/components/charts/TargetInfo';

export default function OpenChangeRequestsThroughTimeCard({ data }: { data: OpenThroughTimeData[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Open Change Requests Through Time</CardTitle>
          <TargetInfo metric="open-change-requests-through-time" />
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={ensureArray(data)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="opened" stroke="#8884d8" name="Opened" />
            <Line type="monotone" dataKey="closed" stroke="#82ca9d" name="Closed" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}