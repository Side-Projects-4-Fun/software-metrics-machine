'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SonarqubeComponentChartData } from './types';
import { TargetInfo } from '@/components/charts/TargetInfo';
import { useLinkBuilder } from '@/components/providers/LinkBuilderContext';

type ComponentMeasure = {
  key: string;
  name: string;
  type?: string;
  qualifier?: string;
  measures?: Array<{ key?: string; metric?: string; name?: string; value?: string | number }>;
};

type ComponentTreeHistoryEntry = {
  fetchedAt: string;
  data: ComponentMeasure[];
};

type ChartDataRow = Record<string, number | string | null> & { fetchedAt: string };

const FILE_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ca8a04',
  '#0891b2', '#ea580c', '#be185d', '#4f46e5', '#15803d',
  '#b91c1c', '#7c3aed', '#a16207', '#0e7490', '#c2410c',
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

function metricValue(
  measures: ComponentMeasure['measures'] = [],
  metric: string,
): number | null {
  const measure = measures.find(
    (item) => item.key === metric || item.metric === metric || item.name === metric,
  );

  if (!measure) {
    return null;
  }

  const numeric = Number(measure.value ?? 0);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildChartData(
  history: ComponentTreeHistoryEntry[],
  files: SonarqubeComponentChartData[],
): ChartDataRow[] {
  const fileKeys = new Set(files.map((file) => file.key));

  return history.map((entry) => {
    const row: ChartDataRow = { fetchedAt: formatDate(entry.fetchedAt) };
    const componentsByKey = new Map(entry.data.map((component) => [component.key, component]));

    for (const fileKey of fileKeys) {
      const component = componentsByKey.get(fileKey);
      row[`${fileKey}:complexity`] = metricValue(component?.measures, 'complexity');
      row[`${fileKey}:cognitive_complexity`] = metricValue(component?.measures, 'cognitive_complexity');
    }

    return row;
  });
}

export default function SonarqubeComponentTreeHistoryCard({
  files,
  history,
}: {
  files: SonarqubeComponentChartData[];
  history: ComponentTreeHistoryEntry[];
}) {
  const { urlBuilder } = useLinkBuilder();
  const [hiddenFileKeys, setHiddenFileKeys] = useState<Set<string>>(() => new Set());
  const chartData = useMemo(() => buildChartData(history, files), [history, files]);
  const visibleFiles = files.filter((file) => !hiddenFileKeys.has(file.key));

  function toggleFile(fileKey: string) {
    setHiddenFileKeys((current) => {
      const next = new Set(current);
      if (next.has(fileKey)) {
        next.delete(fileKey);
      } else {
        next.add(fileKey);
      }
      return next;
    });
  }

  function openComponentMetricInSonarqube(componentKey: string, metric: string) {
    const url = urlBuilder.getSonarqubeComponentMeasuresUrl(componentKey, metric);
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
          <CardTitle>Component Tree Metrics History</CardTitle>
          <TargetInfo metric="sq-complexity" />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Complexity and cognitive complexity changes over time for the selected files. Click a
          line to open that file and metric in SonarQube.
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 && files.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2" aria-label="Toggle component files">
              {files.map((file, index) => (
                <label
                  key={file.key}
                  className="inline-flex h-8 max-w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm"
                  title={file.name || file.key}
                >
                  <input
                    type="checkbox"
                    checked={!hiddenFileKeys.has(file.key)}
                    onChange={() => toggleFile(file.key)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: FILE_COLORS[index % FILE_COLORS.length] }}
                  />
                  <span className="truncate">{file.name || file.key}</span>
                </label>
              ))}
              <button
                type="button"
                onClick={() => setHiddenFileKeys(new Set())}
                className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setHiddenFileKeys(new Set(files.map((file) => file.key)))}
                className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Clear
              </button>
            </div>

            {visibleFiles.length > 0 ? (
              <ResponsiveContainer width="100%" height={420}>
                <LineChart data={chartData}>
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
                  {visibleFiles.flatMap((file) => {
                    const colorIndex = files.findIndex((item) => item.key === file.key);
                    const color = FILE_COLORS[colorIndex % FILE_COLORS.length];
                    const label = file.name || file.key;

                    return [
                      <Line
                        key={`${file.key}:complexity`}
                        type="monotone"
                        dataKey={`${file.key}:complexity`}
                        name={`${label} complexity`}
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                        onClick={() => openComponentMetricInSonarqube(file.key, 'complexity')}
                        style={{ cursor: 'pointer' }}
                      />,
                      <Line
                        key={`${file.key}:cognitive_complexity`}
                        type="monotone"
                        dataKey={`${file.key}:cognitive_complexity`}
                        name={`${label} cognitive`}
                        stroke={color}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        connectNulls
                        onClick={() =>
                          openComponentMetricInSonarqube(file.key, 'cognitive_complexity')
                        }
                        style={{ cursor: 'pointer' }}
                      />,
                    ];
                  })}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[420px] items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-600">
                Select at least one file to display the component history chart.
              </div>
            )}
          </div>
        ) : (
          <p>No component tree history available.</p>
        )}
      </CardContent>
    </Card>
  );
}
