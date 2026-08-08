'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { JobsAverageTimeData, JobsAverageTimeByDayData } from './types';
import { useLinkBuilder } from '@/components/providers/LinkBuilderContext';
import react from 'react';
import { ApiParams } from '@/server/api';
import { useFilters } from '@/components/filters/FiltersContext';
import { TargetInfo } from '@/components/charts/TargetInfo';
import { formatMetricLabel, formatMetricMethod } from '@/utils/formatMetricMethod';

interface JobsAverageTimeCardProps {
  data: JobsAverageTimeData[];
  dataByDay: JobsAverageTimeByDayData[];
  apiParams: ApiParams;
}

export default function JobsAverageTimeCard({ data, dataByDay }: JobsAverageTimeCardProps) {
  const { urlBuilder } = useLinkBuilder();
  const { filters } = useFilters();
  const [activeTab, setActiveTab] = react.useState<'by-job' | 'by-day'>('by-job');
  const avgTimeLabel = formatMetricLabel(filters.method, 'Time');
  const methodLabel = formatMetricMethod(filters.method);

  const avgTimeTickMap = react.useMemo(() => {
    const map = new Map<number, string>();
    for (const item of data) {
      map.set(item.value, item.value_formatted);
    }
    for (const item of dataByDay) {
      map.set(item.value, item.value_formatted);
    }
    return map;
  }, [data, dataByDay]);

  const formatTooltipTime = (value: unknown, name: unknown): [string, string] => {
    const label = String(name);
    if (label === avgTimeLabel) {
      return [avgTimeTickMap.get(Number(value)) ?? String(Number(value) || 0), label];
    }
    return [String(value ?? ''), label];
  };

  const handleBarClick = (entry: JobsAverageTimeData) => {
    const url = urlBuilder.getJobRunsUrl(entry.job_name, entry.workflow_name, {
      startDate: filters.startDate,
      endDate: filters.endDate,
      timezone: filters.timezone,
    });
    window.open(url, '_blank');
  };

  const selectedJobsDisplay = filters.jobSelector && filters.jobSelector.length > 0 
    ? `${filters.jobSelector.length} job(s) selected`
    : 'All jobs';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Jobs Average Time</CardTitle>
          <TargetInfo metric="job-avg-time" />
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setActiveTab('by-job')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              activeTab === 'by-job'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            By Job
          </button>
          <button
            onClick={() => setActiveTab('by-day')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              activeTab === 'by-day'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            By Day
          </button>
        </div>
        {activeTab === 'by-job' && (
          <p className="text-xs text-gray-500 mt-2">Click on bars to view job runs</p>
        )}
        {activeTab === 'by-day' && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-xs text-gray-600">Filter: {selectedJobsDisplay}</p>
              <p className="text-xs text-gray-500">
              {methodLabel} job execution time per day to spot trends in performance
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {activeTab === 'by-job' && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="job_name" angle={-45} textAnchor="end" height={100} />
              <YAxis yAxisId="left" tickFormatter={(value) => avgTimeTickMap.get(Number(value)) ?? String(Number(value) || 0)} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={formatTooltipTime} />
              <Legend />
              <Bar dataKey="value" yAxisId="left" fill="#82ca9d" name={avgTimeLabel} onClick={(e) => handleBarClick(e.payload)} style={{ cursor: 'pointer' }} />
              <Bar dataKey="count" yAxisId="right" fill="#60a5fa" name="Runs Count" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'by-day' && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dataByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" angle={-45} textAnchor="end" height={100} />
              <YAxis yAxisId="left" tickFormatter={(value) => avgTimeTickMap.get(Number(value)) ?? String(Number(value) || 0)} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={formatTooltipTime} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="value" stroke="#82ca9d" name={avgTimeLabel} dot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="count" stroke="#60a5fa" name="Runs Count" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
