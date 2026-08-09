'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ensureArray } from '@/server/utils/chartData';
import { ByAuthorData } from './types';
import { useLinkBuilder } from '@/components/providers/LinkBuilderContext';
import { TargetInfo } from '@/components/charts/TargetInfo';

export default function ChangeRequestsByAuthorCard({ data }: { data: ByAuthorData[] }) {
  const { urlBuilder } = useLinkBuilder();

  const handleBarClick = (entry: ByAuthorData) => {
    const url = urlBuilder.getChangeRequestsUrl({ author: entry.author });
    window.open(url, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Change Requests by Author</CardTitle>
          <TargetInfo metric="change-requests-by-author" />
        </div>
        <p className="text-xs text-gray-500 mt-1">Click on bars to view author&apos;s change requests</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={ensureArray(data)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="author" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#8884d8" name="Change Request Count" onClick={(e) => handleBarClick(e.payload)} style={{ cursor: 'pointer' }} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}