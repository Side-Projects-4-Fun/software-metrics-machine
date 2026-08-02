'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import { Tab, Tabs } from '@mui/material';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TargetInfo } from '@/components/charts/TargetInfo';
import { useLinkBuilder } from '@/components/providers/LinkBuilderContext';

type ActiveTab = 'current' | 'history';

interface MeasurementEntry {
  fetchedAt: string;
  data: Array<{ metric: string; value: string }>;
}

const METRIC_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#84cc16',
  '#06b6d4', '#a855f7', '#eab308', '#22c55e', '#f43f5e',
];

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type ChartDataRow = Record<string, number | string> & { fetchedAt: string };

function buildChartData(entries: MeasurementEntry[]): { chartData: ChartDataRow[]; metrics: string[] } {
  const metricsSet = new Set<string>();
  for (const entry of entries) {
    for (const m of entry.data) {
      metricsSet.add(m.metric);
    }
  }
  const metrics = Array.from(metricsSet).sort((a, b) => a.localeCompare(b));

  const chartData = entries.map((entry) => {
    const row: ChartDataRow = { fetchedAt: formatDate(entry.fetchedAt) };
    for (const m of entry.data) {
      const num = Number(m.value);
      row[m.metric] = Number.isFinite(num) ? num : 0;
    }
    return row;
  });

  return { chartData, metrics };
}

export default function SonarqubeMeasurementsTabbedCard({
  measurements,
  history,
}: {
  measurements: Array<{ metric: string; value: string }>;
  history: MeasurementEntry[];
}) {
  const { urlBuilder } = useLinkBuilder();
  const [activeTab, setActiveTab] = useState<ActiveTab>('current');
  const { chartData, metrics } = useMemo(() => buildChartData(history), [history]);
  const [hiddenMetrics, setHiddenMetrics] = useState<Set<string>>(() => new Set());

  const enabledMetrics = metrics.filter((metric) => !hiddenMetrics.has(metric));

  function toggleMetric(metric: string) {
    setHiddenMetrics((current) => {
      const next = new Set(current);
      if (next.has(metric)) {
        next.delete(metric);
      } else {
        next.add(metric);
      }
      return next;
    });
  }

  function openMetricInSonarqube(metric: string) {
    const url = urlBuilder.getSonarqubeProjectMeasuresUrl(metric);
    if (url === '#') {
      return;
    }

    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (opened) {
      opened.opener = null;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>SonarQube Measurements</CardTitle>
          <TargetInfo metric="sonarqube-measurements" />
        </div>
        <Box sx={{ mt: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_event, value) => setActiveTab(value as ActiveTab)}
            textColor="secondary"
            indicatorColor="secondary"
            aria-label="sonarqube measurements tabs"
          >
            <Tab value="current" label="Current" />
            <Tab value="history" label="History" />
          </Tabs>
        </Box>
        {activeTab === 'current' && (
          <p className="mt-2 text-sm text-gray-600">
            Latest SonarQube measurements for the project.
          </p>
        )}
        {activeTab === 'history' && (
          <p className="mt-2 text-sm text-gray-600">
            Measurements over time, grouped by fetch date.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {activeTab === 'current' && (
          <>
            {measurements && measurements.length > 0 ? (
              <ul>
                {measurements.map((measurement, index) => (
                  <li key={index}>
                    <strong>{measurement.metric}:</strong> {measurement.value}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No measurements found.</p>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            {chartData.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2" aria-label="Toggle history measurements">
                  {metrics.map((metric, index) => (
                    <label
                      key={metric}
                      className="inline-flex h-8 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenMetrics.has(metric)}
                        onChange={() => toggleMetric(metric)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: METRIC_COLORS[index % METRIC_COLORS.length] }}
                      />
                      <span>{metric}</span>
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => setHiddenMetrics(new Set())}
                    className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setHiddenMetrics(new Set(metrics))}
                    className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    Clear
                  </button>
                </div>

                {enabledMetrics.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="fetchedAt"
                        angle={-30}
                        textAnchor="end"
                        height={100}
                        interval={0}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {enabledMetrics.map((metric) => {
                        const colorIndex = metrics.indexOf(metric);
                        return (
                          <Bar
                            key={metric}
                            dataKey={metric}
                            stackId="measurements"
                            fill={METRIC_COLORS[colorIndex % METRIC_COLORS.length]}
                            onClick={() => openMetricInSonarqube(metric)}
                            style={{ cursor: 'pointer' }}
                          />
                        );
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-600">
                    Select at least one measurement to display the history chart.
                  </div>
                )}
              </div>
            ) : (
              <p>No historical data available.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
