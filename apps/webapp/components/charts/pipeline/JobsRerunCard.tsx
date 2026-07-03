'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientPaginatedSortableTable } from '@/components/ui/client-paginated-sortable-table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { JobSummaryData, JobRerunsByDayData } from './types';
import { TargetInfo } from '@/components/charts/TargetInfo';
import { useLinkBuilder } from '@/components/providers/LinkBuilderContext';
import { useFilters } from '@/components/filters/FiltersContext';

interface JobsRerunCardProps {
  data: JobSummaryData[];
  dataByDay: JobRerunsByDayData[];
}

export default function JobsRerunCard({ data, dataByDay }: JobsRerunCardProps) {
  const { urlBuilder } = useLinkBuilder();
  const { filters } = useFilters();
  const totalByDayReruns = dataByDay.reduce((sum, item) => sum + (item.rerun_count || 0), 0);

  const columns = [
    {
      key: 'job_name',
      label: 'Job',
      renderCell: (item: JobSummaryData) => (
        <a
          href={urlBuilder.getJobRunsUrl(item.job_name, item.workflow_name, {
            startDate: filters.startDate,
            endDate: filters.endDate,
            timezone: filters.timezone,
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-700 underline-offset-2 hover:underline"
        >
          {item.job_name || 'Unknown'}
        </a>
      ),
    },
    { key: 'total_runs', label: 'Total Runs', align: 'right' as const },
    {
      key: 'success_rate',
      label: 'Success Rate',
      align: 'right' as const,
      renderCell: (item: JobSummaryData) => (
        <span className="text-green-600">{(item.success_rate || 0).toFixed(1)}%</span>
      ),
    },
    {
      key: 'failure_rate',
      label: 'Failure Rate',
      align: 'right' as const,
      renderCell: (item: JobSummaryData) => (
        <span className="text-red-600">{(item.failure_rate || 0).toFixed(1)}%</span>
      ),
    },
    {
      key: 'rerun_count',
      label: 'Reruns',
      align: 'right' as const,
      renderCell: (item: JobSummaryData) => (
        <span className="font-medium text-red-600">{item.rerun_count || 0}</span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Job Reruns</CardTitle>
          <TargetInfo metric="job-reruns" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md border p-3 bg-gray-50">
            <div className="text-sm text-gray-600">Total reruns</div>
            <div className="text-2xl font-semibold text-gray-900">{totalByDayReruns}</div>
          </div>
          <div className="rounded-md border p-3 bg-gray-50">
            <div className="text-sm text-gray-600">Unique jobs</div>
            <div className="text-2xl font-semibold text-gray-900">{data.length}</div>
          </div>
        </div>

        {/* Time Series Chart */}
        {dataByDay && dataByDay.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 text-gray-700">Reruns by Day</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dataByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="rerun_count"
                  stroke="#ef4444"
                  name="Reruns"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Jobs Table */}
        <div>
          <div className="flex items-baseline gap-2 mb-3">
            <h3 className="text-sm font-medium text-gray-700">Jobs Summary</h3>
            <span className="text-xs text-gray-400">Failure rate = (failed / total runs) × 100</span>
          </div>
          <ClientPaginatedSortableTable
            columns={columns}
            rows={Array.isArray(data) ? data : []}
            getRowKey={(item) => `${item.workflow_name || 'unknown'}:${item.job_name || 'unknown'}`}
            defaultSort={{ key: 'rerun_count', direction: 'desc' }}
            pageSize={10}
          />
        </div>
      </CardContent>
    </Card>
  );
}
