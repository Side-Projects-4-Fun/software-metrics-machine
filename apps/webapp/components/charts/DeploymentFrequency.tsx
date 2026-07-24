'use client';

import { useCallback, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ensureArray } from '@/server/utils/chartData';
import { DeploymentFrequencyPoint } from '@/app/dashboard/insights/insights-types';
import { useConfiguration } from '../providers/ConfigurationContext';
import { useLinkBuilder } from '../providers/LinkBuilderContext';
import { useFilters } from '../filters/FiltersContext';
import { TargetInfo } from './TargetInfo';

type Granularity = 'day' | 'week' | 'month';
type ChartRow = {
  period: string;
  [targetLabel: string]: string | number;
};
type DeploymentTarget = {
  pipeline: string;
  job: string;
};

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4b5563'];

export function DeploymentFrequency({ deploymentFrequency }: { deploymentFrequency: DeploymentFrequencyPoint[] }) {
  const configuration = useConfiguration();
  const configuredTargets = (configuration.deployment_frequency_targets || [])
    .filter((target) => target.pipeline && target.job);
  const { urlBuilder } = useLinkBuilder();
  const { filters } = useFilters();
  const points = ensureArray<DeploymentFrequencyPoint>(deploymentFrequency);
  const targetByLabel = useMemo(() => {
    const targets = new Map<string, DeploymentTarget>();

    configuredTargets.forEach((target) => {
      targets.set(`${target.pipeline} / ${target.job}`, target);
    });
    points.forEach((point) => {
      targets.set(point.target_label || `${point.pipeline} / ${point.job}`, {
        pipeline: point.pipeline,
        job: point.job,
      });
    });

    return targets;
  }, [configuredTargets, points]);
  const targetLabels = useMemo(() => {
    const labels = new Set<string>();

    configuredTargets.forEach((target) => {
      labels.add(`${target.pipeline} / ${target.job}`);
    });
    points.forEach((point) => {
      labels.add(point.target_label || `${point.pipeline} / ${point.job}`);
    });

    return Array.from(labels);
  }, [configuredTargets, points]);
  const [hiddenTargetLabels, setHiddenTargetLabels] = useState<Set<string>>(new Set());
  const visibleTargetLabels = targetLabels.filter((targetLabel) => !hiddenTargetLabels.has(targetLabel));

  const toggleTarget = useCallback((targetLabel: string) => {
    setHiddenTargetLabels((current) => {
      const next = new Set(current);
      if (next.has(targetLabel)) {
        next.delete(targetLabel);
      } else {
        next.add(targetLabel);
      }
      return next;
    });
  }, []);

  const handleClick = useCallback((date: string, granularity: Granularity, targetLabel: string) => {
    const target = targetByLabel.get(targetLabel);
    if (!target || !date) {
      return;
    }

    const workflowSegments = target.pipeline.split('/').filter(Boolean);
    const workflowFileName = workflowSegments.length > 0 ? workflowSegments[workflowSegments.length - 1] : target.pipeline;
    const url = urlBuilder.getActionPerformanceForJobUrl(target.job, workflowFileName, granularity, date, filters.timezone);
    window.open(url, '_blank');
  }, [filters.timezone, targetByLabel, urlBuilder]);

  const ClickDot = useCallback((granularity: Granularity, targetLabel: string) => {
    const DotComponent = (props: { cx?: number; cy?: number; payload?: { period?: string } }) => {
      const { cx, cy, payload } = props;
      if (!cx || !cy) {return null;}
      return (
        <g onClick={() => handleClick(payload?.period ?? '', granularity, targetLabel)} style={{ pointerEvents: 'auto' }}>
          <rect
            x={Number(cx) - 10}
            y={Number(cy) - 10}
            width={20}
            height={20}
            fill="transparent"
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          />
        </g>
      );
    };
    DotComponent.displayName = 'ClickDot';
    return DotComponent;
  }, [handleClick]);

  const buildChartData = (
    granularity: Granularity,
    countKey: 'day_count' | 'week_count' | 'month_count'
  ): ChartRow[] => {
    const grouped = new Map<string, ChartRow>();

    for (const point of points) {
      const period =
        granularity === 'day'
          ? point.date
          : granularity === 'week'
            ? point.week_label
            : point.month_label;
      const targetLabel = point.target_label || `${point.pipeline} / ${point.job}`;
      const row = grouped.get(period) || { period };
      row[targetLabel] = Math.max(Number(row[targetLabel] || 0), point[countKey] || 0);
      grouped.set(period, row);
    }

    return Array.from(grouped.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
  };

  const renderChart = (
    title: string,
    granularity: Granularity,
    countKey: 'day_count' | 'week_count' | 'month_count'
  ) => {
    const data = buildChartData(granularity, countKey);

    return (
      <div className="mb-8 last:mb-0">
        <h4 className="mb-3 text-sm font-semibold text-gray-700">{title}</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" angle={-45} textAnchor="end" height={100} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            {visibleTargetLabels.map((targetLabel) => {
              const colorIndex = Math.max(targetLabels.indexOf(targetLabel), 0);
              return (
                <Line
                  key={`${granularity}:${targetLabel}`}
                  type="monotone"
                  dataKey={targetLabel}
                  stroke={COLORS[colorIndex % COLORS.length]}
                  name={targetLabel}
                  dot={ClickDot(granularity, targetLabel)}
                  connectNulls
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Deployment Frequency Targets</h3>
        <TargetInfo metric="deployment-frequency" />
      </div>
      {targetLabels.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Toggle deployment frequency workflows">
          {targetLabels.map((targetLabel, index) => (
            <label
              key={targetLabel}
              className="inline-flex h-8 max-w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm"
              title={targetLabel}
            >
              <input
                type="checkbox"
                checked={!hiddenTargetLabels.has(targetLabel)}
                onChange={() => toggleTarget(targetLabel)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="truncate">{targetLabel}</span>
            </label>
          ))}
          <button
            type="button"
            onClick={() => setHiddenTargetLabels(new Set())}
            className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setHiddenTargetLabels(new Set(targetLabels))}
            className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Hide all
          </button>
        </div>
      )}
      {visibleTargetLabels.length === 0 && targetLabels.length > 0 && (
        <p className="mb-4 text-sm text-gray-600">No deployment workflows selected.</p>
      )}
      {renderChart('Deployments by Day', 'day', 'day_count')}
      {renderChart('Deployments by Week', 'week', 'week_count')}
      {renderChart('Deployments by Month', 'month', 'month_count')}
    </div>
  );
}
