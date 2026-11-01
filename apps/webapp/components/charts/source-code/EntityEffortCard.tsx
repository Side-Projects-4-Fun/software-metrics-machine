'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ensureArray } from '@/server/utils/chartData';
import { EntityEffortData } from './types';
import { TargetInfo } from '@/components/charts/TargetInfo';

export default function EntityEffortCard({
  data,
  topEntries,
}: {
  data: EntityEffortData[];
  topEntries: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Entity Effort (Top {topEntries})</CardTitle>
          <TargetInfo metric="code-entity-effort" />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Shows files touched most often. Taller bars mean more revisions, indicating higher
          maintenance effort.
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
            <Bar dataKey="total-revs" fill="#8884d8" name="Total Revisions" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
