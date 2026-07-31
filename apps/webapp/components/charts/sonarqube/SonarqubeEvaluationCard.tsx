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

interface SonarqubeEvaluationData {
  generatedAt: string;
  signals: BottleneckSignal[];
  summary: {
    totalComponents: number;
    avgComplexity: number;
    avgCoverage: number;
    totalNLOC: number;
    duplicationDensity: number;
    maintainabilityRating: number;
    reliabilityRating: number;
    securityRating: number;
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

function ratingLabel(rating: number): string {
  const labels: Record<number, string> = {
    1: 'A',
    2: 'B',
    3: 'C',
    4: 'D',
    5: 'E',
  };
  return labels[rating] || String(rating);
}

export default function SonarqubeEvaluationCard({
  data,
}: {
  data: SonarqubeEvaluationData;
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
          <CardTitle>SonarQube Health Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Components</p>
              <p className="text-xl font-bold text-blue-700">
                {summary.totalComponents}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Avg Complexity</p>
              <p className="text-xl font-bold text-blue-700">
                {summary.avgComplexity.toFixed(1)}
              </p>
            </div>
            <div
              className={`rounded-lg p-3 text-center ${
                summary.avgCoverage >= 60
                  ? 'bg-emerald-50'
                  : summary.avgCoverage >= 30
                    ? 'bg-amber-50'
                    : 'bg-red-50'
              }`}
            >
              <p className="text-xs text-gray-500">Avg Coverage</p>
              <p
                className={`text-xl font-bold ${
                  summary.avgCoverage >= 60
                    ? 'text-emerald-700'
                    : summary.avgCoverage >= 30
                      ? 'text-amber-700'
                      : 'text-red-700'
                }`}
              >
                {summary.avgCoverage.toFixed(0)}%
              </p>
            </div>
            <div
              className={`rounded-lg p-3 text-center ${
                summary.duplicationDensity <= 5
                  ? 'bg-emerald-50'
                  : summary.duplicationDensity <= 15
                    ? 'bg-amber-50'
                    : 'bg-red-50'
              }`}
            >
              <p className="text-xs text-gray-500">Duplication</p>
              <p
                className={`text-xl font-bold ${
                  summary.duplicationDensity <= 5
                    ? 'text-emerald-700'
                    : summary.duplicationDensity <= 15
                      ? 'text-amber-700'
                      : 'text-red-700'
                }`}
              >
                {summary.duplicationDensity.toFixed(1)}%
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Ratings</p>
              <p className="text-sm font-semibold text-blue-700">
                R:{ratingLabel(summary.reliabilityRating)}{' '}
                S:{ratingLabel(summary.securityRating)}{' '}
                M:{ratingLabel(summary.maintainabilityRating)}
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
