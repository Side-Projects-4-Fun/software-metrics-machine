'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Severity = 'critical' | 'warning' | 'good';

interface BottleneckSignal {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  metrics: Array<{ label: string; value: string }>;
}

interface CodeEvaluationData {
  generatedAt: string;
  signals: BottleneckSignal[];
  summary: {
    totalChurn: number;
    linesAdded: number;
    linesDeleted: number;
    hotspots: number;
    avgPairingIndex: number;
    totalCouplingPairs: number;
    highComplexityFiles: number;
    topChurnFile?: string;
    mostCoupledPair?: string;
    dominantAuthor?: string;
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

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export default function CodeEvaluationCard({
  data,
}: {
  data: CodeEvaluationData;
}) {
  const { signals, summary } = data;

  const sortedSignals = [...signals].sort((a, b) => {
    const order: Record<Severity, number> = { critical: 0, warning: 1, good: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Code Health Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Total Churn</p>
              <p className="text-xl font-bold text-blue-700">
                {formatNumber(summary.totalChurn)}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Hotspots</p>
              <p className="text-xl font-bold text-blue-700">
                {summary.hotspots}
              </p>
            </div>
            <div
              className={`rounded-lg p-3 text-center ${
                summary.avgPairingIndex >= 20
                  ? 'bg-emerald-50'
                  : summary.avgPairingIndex >= 10
                    ? 'bg-amber-50'
                    : 'bg-red-50'
              }`}
            >
              <p className="text-xs text-gray-500">Pairing Index</p>
              <p
                className={`text-xl font-bold ${
                  summary.avgPairingIndex >= 20
                    ? 'text-emerald-700'
                    : summary.avgPairingIndex >= 10
                      ? 'text-amber-700'
                      : 'text-red-700'
                }`}
              >
                {summary.avgPairingIndex}%
              </p>
            </div>
            <div
              className={`rounded-lg p-3 text-center ${
                summary.highComplexityFiles === 0
                  ? 'bg-emerald-50'
                  : summary.highComplexityFiles <= 5
                    ? 'bg-amber-50'
                    : 'bg-red-50'
              }`}
            >
              <p className="text-xs text-gray-500">High Complexity Files</p>
              <p
                className={`text-xl font-bold ${
                  summary.highComplexityFiles === 0
                    ? 'text-emerald-700'
                    : summary.highComplexityFiles <= 5
                      ? 'text-amber-700'
                      : 'text-red-700'
                }`}
              >
                {summary.highComplexityFiles}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Top Churn File</p>
              <p
                className="text-sm font-semibold text-blue-700 truncate"
                title={summary.topChurnFile}
              >
                {summary.topChurnFile || '\u2014'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {sortedSignals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Code Quality Signals</CardTitle>
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
