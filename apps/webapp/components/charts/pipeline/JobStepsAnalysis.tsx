'use client';

import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientPaginatedSortableTable } from '@/components/ui/client-paginated-sortable-table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { JobStepsAverageTimeData, JobStepsAverageTimeByDayData } from './types';
import { formatDurationMinutes } from './duration-format';
import { TargetInfo } from '@/components/charts/TargetInfo';

// Generate a sequence of colors for the stacked bars
const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c', 
  '#d0ed57', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c'
];

export default function JobStepsAnalysis({
  data,
  dataByDay,
  jobName,
}: {
  data: JobStepsAverageTimeData[];
  dataByDay: JobStepsAverageTimeByDayData[];
  jobName: string;
}) {
  const [hiddenStepNames, setHiddenStepNames] = useState<Set<string>>(new Set());
  const totalTime = useMemo(() => {
    return data.reduce((sum, step) => sum + step.averageDurationMinutes, 0);
  }, [data]);
  const visibleSteps = data.filter((step) => !hiddenStepNames.has(step.name));

  const toggleStep = useCallback((stepName: string) => {
    setHiddenStepNames((current) => {
      const next = new Set(current);
      if (next.has(stepName)) {
        next.delete(stepName);
      } else {
        next.add(stepName);
      }
      return next;
    });
  }, []);

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Steps Analysis: {jobName}</CardTitle>
          <TargetInfo metric="pipeline-duration" />
        </div>
        <p className="text-sm text-gray-500">
          Average execution time of each step across {data[0]?.count || 0} runs.
          Total average time: {formatDurationMinutes(totalTime)}.
        </p>
      </CardHeader>
      <CardContent>
        {/* Daily Stacked Bar Chart showing step durations over time */}
        {dataByDay && dataByDay.length > 0 && (
          <div className="mb-10">
            <h4 className="text-sm font-semibold mb-4 text-gray-700">Average Duration By Day</h4>
            <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Toggle step duration bars">
              {data.map((step, index) => (
                <label
                  key={step.name}
                  className="inline-flex h-8 max-w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm"
                  title={step.name}
                >
                  <input
                    type="checkbox"
                    checked={!hiddenStepNames.has(step.name)}
                    onChange={() => toggleStep(step.name)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate">{step.name}</span>
                </label>
              ))}
              <button
                type="button"
                onClick={() => setHiddenStepNames(new Set())}
                className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setHiddenStepNames(new Set(data.map((step) => step.name)))}
                className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Hide all
              </button>
            </div>
            {visibleSteps.length === 0 && (
              <p className="mb-4 text-sm text-gray-600">No steps selected.</p>
            )}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataByDay}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis
                    tickFormatter={(value) => formatDurationMinutes(Number(value) || 0)}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [formatDurationMinutes(Number(value) || 0), String(name)]}
                    wrapperStyle={{ zIndex: 1000 }}
                  />
                  <Legend />
                  {visibleSteps.map((step) => {
                    const colorIndex = Math.max(data.findIndex((item) => item.name === step.name), 0);
                    return (
                      <Bar
                        key={step.name}
                        dataKey={step.name}
                        stackId="a"
                        fill={COLORS[colorIndex % COLORS.length]}
                        name={step.name}
                      />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Overall Proportions Stacked Bar Chart */}
        {/* <div className="h-48 mb-6">
          <h4 className="text-sm font-semibold mb-4 text-gray-700">Overall Time Proportion</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" hide />
              <Tooltip 
                formatter={(value: any, name: any) => [formatDurationMinutes(Number(value) || 0), name]}
              />
              {data.map((step, index) => (
                <Bar 
                  key={step.name} 
                  dataKey={step.name} 
                  stackId="a" 
                  fill={COLORS[index % COLORS.length]} 
                  name={step.name}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div> */}

        {/* Breakdown List */}
        <div className="overflow-x-auto">
          <ClientPaginatedSortableTable
            columns={[
              {
                key: 'name',
                label: 'Step Name',
                renderCell: (step: JobStepsAverageTimeData & { _colorIndex: number }) => (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[step._colorIndex % COLORS.length] }}
                    />
                    <span className="font-medium text-gray-800">{step.name}</span>
                  </div>
                ),
              },
              {
                key: 'averageDurationMinutes',
                label: 'Average Time',
                align: 'right' as const,
                renderCell: (step: JobStepsAverageTimeData) => (
                  <span className="tabular-nums">{formatDurationMinutes(step.averageDurationMinutes)}</span>
                ),
              },
              {
                key: '_percentage',
                label: '% of Total',
                align: 'right' as const,
                renderCell: (step: JobStepsAverageTimeData & { _percentage: number }) => (
                  <span className="tabular-nums text-gray-600">{step._percentage.toFixed(1)}%</span>
                ),
                compare: (a: JobStepsAverageTimeData & { _percentage: number }, b: JobStepsAverageTimeData & { _percentage: number }) => a._percentage - b._percentage,
              },
            ]}
            rows={data.map((step, index) => ({
              ...step,
              _colorIndex: index,
              _percentage: totalTime > 0 ? (step.averageDurationMinutes / totalTime) * 100 : 0,
            }))}
            getRowKey={(step) => step.name}
            defaultSort={{ key: 'averageDurationMinutes', direction: 'desc' }}
            pageSize={10}
          />
        </div>
      </CardContent>
    </Card>
  );
}
