'use client';

import { useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import { Tab, Tabs } from '@mui/material';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientPaginatedSortableTable } from '@/components/ui/client-paginated-sortable-table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter, ComposedChart } from 'recharts';
import { ensureArray } from '@/server/utils/chartData';
import { JobsDurationByWorkflowItem, RunsByDayData, RunsDurationData } from './types';
import { useLinkBuilder } from '@/components/providers/LinkBuilderContext';
import { formatDurationMinutes } from './duration-format';
import { TargetInfo } from '@/components/charts/TargetInfo';
import { useFilters } from '@/components/filters/FiltersContext';

type ActiveTab = 'duration' | 'job-breakdown' | 'daily-runs';

interface TooltipPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

// Stable palette for up to 20 jobs
const JOB_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#84cc16',
  '#06b6d4', '#a855f7', '#eab308', '#22c55e', '#f43f5e',
  '#0ea5e9', '#d946ef', '#fb923c', '#4ade80', '#38bdf8',
];

function DurationTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow">
        <p className="font-semibold">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number' ? formatDurationMinutes(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

function JobBreakdownTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow">
        <p className="font-semibold">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number' ? formatDurationMinutes(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function PipelineRunsDurationCard({
  dataByAggregation,
  runsByDay,
  jobsDurationByWorkflow,
}: {
  dataByAggregation: Record<'avg' | 'min' | 'max', RunsDurationData[]>;
  runsByDay: RunsByDayData[];
  jobsDurationByWorkflow: JobsDurationByWorkflowItem[];
}) {
  const { urlBuilder } = useLinkBuilder();
  const { filters } = useFilters();
  const [activeTab, setActiveTab] = useState<ActiveTab>('duration');
  const [hiddenJobNames, setHiddenJobNames] = useState<Set<string>>(new Set());

  const sortedDailyRuns = useMemo(
    () => [...ensureArray<RunsByDayData>(runsByDay)].sort((a, b) => a.day.localeCompare(b.day)),
    [runsByDay],
  );

  const sourceData = useMemo(
    () => ensureArray<RunsDurationData>(dataByAggregation.avg || []),
    [dataByAggregation],
  );

  // Min-Max range chart data (existing)
  const durationRangeData = useMemo(
    () => sourceData.map((item) => ({
      workflow: item.workflow,
      min: item.min_duration,
      max: item.max_duration,
      range: Math.max(0, item.max_duration - item.min_duration),
      avg: item.avg_duration,
    })),
    [sourceData],
  );

  // Job breakdown: one row per workflow, each job is a key with its avg duration
  const { jobBreakdownData, allJobNames } = useMemo(() => {
    const rows = ensureArray<JobsDurationByWorkflowItem>(jobsDurationByWorkflow);
    const jobBreakdownData = rows.map((row) => ({
      workflow: row.workflow,
      ...row.jobs, // only include jobs that belong to this workflow
    }));
    
    // Collect unique job names that exist across all workflows
    const jobSet = new Set<string>();
    for (const row of jobBreakdownData) {
      for (const key of Object.keys(row)) {
        if (key !== 'workflow') {
          jobSet.add(key);
        }
      }
    }
    const allJobNames = Array.from(jobSet).sort();
    return { jobBreakdownData, allJobNames };
  }, [jobsDurationByWorkflow]);
  const visibleJobNames = allJobNames.filter((name) => !hiddenJobNames.has(name));

  const toggleJob = useCallback((jobName: string) => {
    setHiddenJobNames((current) => {
      const next = new Set(current);
      if (next.has(jobName)) {
        next.delete(jobName);
      } else {
        next.add(jobName);
      }
      return next;
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Pipeline Runs Duration</CardTitle>
          <TargetInfo metric="pipeline-duration" />
        </div>
        <Box sx={{ mt: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_event, value) => setActiveTab(value as ActiveTab)}
            textColor="secondary"
            indicatorColor="secondary"
            aria-label="pipeline runs tabs"
          >
            <Tab value="duration" label="Min-Max Range" />
            <Tab value="job-breakdown" label="Job Breakdown" />
            <Tab value="daily-runs" label="Runs by Day" />
          </Tabs>
        </Box>
        {activeTab === 'duration' && (
          <p className="mt-2 text-sm text-gray-600">
            Min-Max duration range in minutes for each workflow, with average marked as a point. Click workflow names below to view runs.
          </p>
        )}
        {activeTab === 'job-breakdown' && (
          <p className="mt-2 text-sm text-gray-600">
            Average duration of each job per workflow, stacked to show the total pipeline runtime composition.
          </p>
        )}
        {activeTab === 'daily-runs' && (
          <p className="mt-2 text-sm text-gray-600">
            Number of pipeline runs per day, useful to spot peaks and drops in execution activity.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {activeTab === 'duration' && (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={durationRangeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="workflow" angle={-45} textAnchor="end" height={100} />
                <YAxis tickFormatter={(value) => formatDurationMinutes(Number(value) || 0)} />
                <Tooltip content={<DurationTooltip />} />
                <Legend />
                <Bar dataKey="min" stackId="r" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0)" legendType="none" />
                <Bar dataKey="range" stackId="r" fill="#93c5fd" name="Min-Max Range" />
                <Scatter dataKey="avg" fill="#1d4ed8" name="Average" />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-6 overflow-x-auto">
              <ClientPaginatedSortableTable
                columns={[
                  {
                    key: 'workflow',
                    label: 'Workflow',
                    renderCell: (item: (typeof durationRangeData)[number]) => (
                      <a
                        href={urlBuilder.getPipelinesUrl({ workflow: item.workflow })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {item.workflow}
                      </a>
                    ),
                  },
                  {
                    key: 'avg',
                    label: 'Average',
                    align: 'right' as const,
                    renderCell: (item: (typeof durationRangeData)[number]) => (
                      <a
                        href={urlBuilder.getWorkflowJobsMetricsUrl(item.workflow, {
                          startDate: filters.startDate,
                          endDate: filters.endDate,
                          timezone: filters.timezone,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tabular-nums text-blue-700 underline-offset-2 hover:underline"
                      >
                        {formatDurationMinutes(item.avg)}
                      </a>
                    ),
                  },
                  {
                    key: 'min',
                    label: 'Minimum',
                    align: 'right' as const,
                    renderCell: (item: (typeof durationRangeData)[number]) => (
                      <span className="tabular-nums">{formatDurationMinutes(item.min)}</span>
                    ),
                  },
                  {
                    key: 'max',
                    label: 'Maximum',
                    align: 'right' as const,
                    renderCell: (item: (typeof durationRangeData)[number]) => (
                      <span className="tabular-nums">{formatDurationMinutes(item.max)}</span>
                    ),
                  },
                ]}
                rows={durationRangeData}
                getRowKey={(item) => item.workflow}
                defaultSort={{ key: 'avg', direction: 'desc' }}
                pageSize={10}
              />
            </div>
          </>
        )}

        {activeTab === 'job-breakdown' && (
          <>
            {allJobNames.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Toggle job breakdown jobs">
                {allJobNames.map((name, index) => (
                  <label
                    key={name}
                    className="inline-flex h-8 max-w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm"
                    title={name}
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenJobNames.has(name)}
                      onChange={() => toggleJob(name)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: JOB_COLORS[index % JOB_COLORS.length] }}
                    />
                    <span className="truncate">{name}</span>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setHiddenJobNames(new Set())}
                  className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setHiddenJobNames(new Set(allJobNames))}
                  className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  Hide all
                </button>
              </div>
            )}
            {visibleJobNames.length === 0 && allJobNames.length > 0 && (
              <p className="mb-4 text-sm text-gray-600">No jobs selected.</p>
            )}
            <ResponsiveContainer width="100%" height={Math.max(300, jobBreakdownData.length * 60)}>
              <BarChart data={jobBreakdownData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => formatDurationMinutes(Number(value) || 0)} />
                <YAxis type="category" dataKey="workflow" width={180} />
                <Tooltip content={<JobBreakdownTooltip />} />
                <Legend />
                {visibleJobNames.map((name) => {
                  const colorIndex = Math.max(allJobNames.indexOf(name), 0);
                  return (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="jobs"
                      fill={JOB_COLORS[colorIndex % JOB_COLORS.length]}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {activeTab === 'daily-runs' && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sortedDailyRuns}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" angle={-45} textAnchor="end" height={100} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="runs" fill="#10b981" name="Runs" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
