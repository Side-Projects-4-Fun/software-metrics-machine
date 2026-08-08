'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMetricLabel } from '@/utils/formatMetricMethod';

type Severity = 'critical' | 'warning' | 'good';

interface BottleneckSignal {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  metrics: Array<{ label: string; value: string }>;
}

interface PREvaluationData {
  generatedAt: string;
  signals: BottleneckSignal[];
  summary: {
    totalPRs: number;
    mergedPRs: number;
    openPRs: number;
    avgCommentsPerPR: number;
    reviewHours: number;
    reviewHours_formatted: string;
    openDays: number;
    openDays_formatted: string;
    method: string;
    uniqueAuthors: number;
    topReviewer?: string;
    bottleneckAuthor?: string;
  };
}

function severityColor(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'border-red-400 bg-red-50';
    case 'warning':
      return 'border-amber-400 bg-amber-50';
    case 'good':
      return 'border-emerald-400 bg-emerald-50';
  }
}

function severityDot(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500';
    case 'warning':
      return 'bg-amber-500';
    case 'good':
      return 'bg-emerald-500';
  }
}

function ratingColor(value: number, goodThreshold: number, warnThreshold: number): string {
  if (value >= goodThreshold) {return 'text-emerald-700 bg-emerald-50';}
  if (value >= warnThreshold) {return 'text-amber-700 bg-amber-50';}
  return 'text-red-700 bg-red-50';
}

export default function PREvaluationCard({
  data,
  method,
}: {
  data: PREvaluationData;
  method?: string;
}) {
  const { signals, summary } = data;
  const openTimeLabel = formatMetricLabel(method, 'Open Time');
  const commentsPrLabel = formatMetricLabel(method, 'Comments/PR');
  const reviewTimeLabel = formatMetricLabel(method, 'Review Time');

  const sortedSignals = [...signals].sort((a, b) => {
    const order: Record<Severity, number> = { critical: 0, warning: 1, good: 2 };
    return order[a.severity] - order[b.severity];
  });

  const mergeRate = summary.totalPRs > 0
    ? (summary.mergedPRs / summary.totalPRs) * 100
    : 0;

  const openTimeRating = ratingColor(1 / Math.max(summary.openDays, 0.001), 0.8, 0.3);
  const reviewTimeRating = ratingColor(1 / Math.max(summary.reviewHours, 0.001), 0.15, 0.05);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>PR Health Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Total PRs</p>
              <p className="text-xl font-bold text-blue-700">
                {summary.totalPRs.toLocaleString('en-US')}
              </p>
            </div>
            <div className={`rounded-lg p-3 text-center ${ratingColor(mergeRate, 80, 50)}`}>
              <p className="text-xs text-gray-500">Merge Rate</p>
              <p className={`text-xl font-bold`}>
                {mergeRate.toFixed(0)}%
              </p>
            </div>
            <div className={`rounded-lg p-3 text-center ${openTimeRating}`}>
              <p className="text-xs text-gray-500">{openTimeLabel}</p>
              <p className="text-xl font-bold">
                {summary.openDays_formatted}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Reviewers</p>
              <p className="text-xl font-bold text-blue-700">
                {summary.uniqueAuthors}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">{commentsPrLabel}</p>
              <p className="text-xl font-bold text-blue-700">
                {summary.avgCommentsPerPR.toFixed(1)}
              </p>
            </div>
            <div className={`rounded-lg p-3 text-center ${reviewTimeRating}`}>
              <p className="text-xs text-gray-500">{reviewTimeLabel}</p>
              <p className="text-xl font-bold">
                {summary.reviewHours_formatted}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Top Reviewer</p>
              <p className="text-sm font-semibold text-blue-700 truncate" title={summary.topReviewer}>
                {summary.topReviewer || '—'}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Most Active Author</p>
              <p className="text-sm font-semibold text-blue-700 truncate" title={summary.bottleneckAuthor}>
                {summary.bottleneckAuthor || '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {sortedSignals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Bottleneck Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedSignals.map((signal) => (
                <div
                  key={signal.id}
                  className={`border-l-4 rounded-r-lg p-4 ${severityColor(signal.severity)}`}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span
                      className={`mt-0.5 h-3 w-3 rounded-full flex-shrink-0 ${severityDot(signal.severity)}`}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {signal.title}
                      </h4>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {signal.description}
                      </p>
                    </div>
                  </div>
                  {signal.metrics.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 ml-5">
                      {signal.metrics.map((metric, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs bg-white/60 rounded px-2 py-0.5 text-gray-700"
                        >
                          <span className="text-gray-400">{metric.label}:</span>
                          <span className="font-medium">{metric.value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
