'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MostCommentedChangeRequestData } from './types';
import { TargetInfo } from '@/components/charts/TargetInfo';

interface MostCommentedChangeRequestsCardProps {
  data: MostCommentedChangeRequestData[];
}

interface TooltipPayloadEntry {
  payload: MostCommentedChangeRequestData;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-tooltip" style={{ backgroundColor: '#fff', border: '1px solid #ccc', padding: '10px' }}>
        <p className="label">{`Change Request: ${data.change_request_title}`}</p>
        <p className="intro">{`Comments: ${data.comments_count}`}</p>
        <p className="url"><a href={data.change_request_url} target="_blank" rel="noopener noreferrer">View Change Request</a></p>
      </div>
    );
  }
  return null;
};

const MostCommentedChangeRequestsCard: React.FC<MostCommentedChangeRequestsCardProps> = ({ data }) => {
  const chartData = useMemo(
    () => [...data].sort((a, b) => b.comments_count - a.comments_count).slice(0, 10),
    [data]
  );

  const openChangeRequest = (entry?: MostCommentedChangeRequestData) => {
    if (!entry?.change_request_url) {
      return;
    }
    window.open(entry.change_request_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Most Commented Change Requests</CardTitle>
          <TargetInfo metric="most-commented-change-requests" />
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="change_request_title" angle={-45} textAnchor="end" height={100} />
              <YAxis dataKey="comments_count" />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="comments_count"
                fill="#8884d8"
                name="Comments"
                cursor="pointer"
                onClick={(entry) => openChangeRequest(entry?.payload)}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-gray-500">No data available for most commented change requests.</div>
        )}
        {chartData.length > 0 ? (
          <p className="mt-2 text-sm text-gray-600">Click a bar to open the change request.</p>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default MostCommentedChangeRequestsCard;