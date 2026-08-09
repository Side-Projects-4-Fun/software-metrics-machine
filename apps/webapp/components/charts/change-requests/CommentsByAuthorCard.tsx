'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ensureArray } from '@/server/utils/chartData';
import { CommentsByAuthorData } from './types';
import { TargetInfo } from '@/components/charts/TargetInfo';

export default function CommentsByAuthorCard({ data }: { data: CommentsByAuthorData[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Who Comments The Most</CardTitle>
          <TargetInfo metric="comments-by-author" />
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={ensureArray<CommentsByAuthorData>(data)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="author" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#8884d8" name="Comments" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}