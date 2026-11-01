'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ensureArray } from '@/server/utils/chartData';
import { EntityChurnData } from './types';
import { TargetInfo } from '@/components/charts/TargetInfo';

export default function EntityChurnCard({
  data,
  topEntries,
}: {
  data: EntityChurnData[];
  topEntries: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Entity Churn (Top {topEntries})</CardTitle>
          <TargetInfo metric="code-entity-churn" />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Compares files with the highest change volume. Each bar is one file: green is lines added
          and red is lines deleted.
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={ensureArray(data)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="entity" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="added" stackId="a" fill="#82ca9d" name="Added" />
            <Bar dataKey="deleted" stackId="a" fill="#ff6b6b" name="Deleted" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
