import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { defaultFilters, parseDashboardFilters } from '@/components/filters/DashboardFilters';
import {
  engineeringHealthAPI,
  type EngineeringHealthEvaluation,
} from '@/server/api/engineeringHealth';

const CATEGORY_ORDER = ['delivery', 'quality', 'collaboration', 'architecture'] as const;

const CATEGORY_METADATA: Record<
  EngineeringHealthEvaluation['evaluations'][number]['category'],
  { title: string; description: string }
> = {
  delivery: {
    title: 'Delivery',
    description: 'Pipeline speed, deployment flow, and release reliability metrics.',
  },
  quality: {
    title: 'Quality',
    description: 'Code health signals such as complexity, duplication, and coverage.',
  },
  collaboration: {
    title: 'Collaboration',
    description: 'Review flow, participation, and shared knowledge indicators.',
  },
  architecture: {
    title: 'Architecture',
    description: 'Structural ownership, coupling, and component health metrics.',
  },
};

type ResultWrapper<T> = {
  result: T;
};

function unwrapResult<T>(data: T | ResultWrapper<T>): T {
  if (typeof data === 'object' && data !== null && 'result' in data) {
    return data.result;
  }

  return data;
}

function toQueryParams(filters: ReturnType<typeof parseDashboardFilters>) {
  const params: Record<string, string> = {};

  if (filters.startDate) {
    params.start_date = filters.startDate;
  }

  if (filters.endDate) {
    params.end_date = filters.endDate;
  }

  if (filters.period) {
    params.period = filters.period;
  }

  if (filters.weekends) {
    params.weekends = filters.weekends;
  }

  if (filters.outlierMode) {
    params.outlier_mode = filters.outlierMode;
  }

  if (filters.metric) {
    params.metric = filters.metric;
  }

  if (filters.category) {
    params.category = filters.category;
  }

  if (filters.labelSelector.length > 0) {
    params.pr_labels = filters.labelSelector.join(',');
  }

  if (filters.compareStartDate) {
    params.compare_start_date = filters.compareStartDate;
  }

  if (filters.compareEndDate) {
    params.compare_end_date = filters.compareEndDate;
  }

  if (filters.rawFilters) {
    params.raw_filters = filters.rawFilters;
  }

  return params;
}

function formatValue(value: number | null, unit: string): string {
  if (value === null || Number.isNaN(value)) {
    return 'N/A';
  }

  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return unit === 'percentage' || unit === '%' ? `${rounded}%` : `${rounded}${unit ? ` ${unit}` : ''}`;
}

function trendClassName(trend: EngineeringHealthEvaluation['evaluations'][number]['comparison']['trend']): string {
  if (trend === 'improving') return 'text-emerald-600';
  if (trend === 'degrading') return 'text-red-600';
  if (trend === 'stable') return 'text-amber-600';
  return 'text-muted-foreground';
}

function buildComparisonBars(
  evaluation: EngineeringHealthEvaluation['evaluations'][number],
): Array<{ label: string; value: number | null; width: number; tone: 'current' | 'previous' }> {
  const current = evaluation.comparison.current;
  const previous = evaluation.comparison.previous;
  const numericValues = [current, previous].filter((value): value is number => value !== null);
  const max = numericValues.length > 0 ? Math.max(...numericValues) : 0;

  const toWidth = (value: number | null): number => {
    if (value === null || max <= 0) {
      return 0;
    }

    return Math.max(8, Math.round((value / max) * 100));
  };

  return [
    {
      label: 'Current',
      value: current,
      width: toWidth(current),
      tone: 'current',
    },
    {
      label: 'Previous',
      value: previous,
      width: toWidth(previous),
      tone: 'previous',
    },
  ];
}

function renderSeriesSparkline(
  series?: Array<{ period: string; value: number }>,
) {
  if (!series || series.length < 2) {
    return null;
  }

  const width = 220;
  const height = 70;
  const padding = 6;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const yRange = max - min || 1;

  const points = series
    .map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / (series.length - 1);
      const normalizedY = (point.value - min) / yRange;
      const y = height - padding - normalizedY * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div>
      <p className="text-sm text-muted-foreground">Trend chart</p>
      <svg
        role="img"
        aria-label="Metric trend over selected period"
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[260px]"
      >
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
          className="text-primary"
        />
      </svg>
      <p className="text-xs text-muted-foreground">
        {series[0]?.period} to {series[series.length - 1]?.period}
      </p>
    </div>
  );
}

function formatWindow(startDate?: string, endDate?: string): string {
  const start = startDate?.trim();
  const end = endDate?.trim();

  if (start && end) {
    return `${start} to ${end}`;
  }

  if (start) {
    return `From ${start}`;
  }

  if (end) {
    return `Until ${end}`;
  }

  return 'Not set';
}

function groupByCategory(data: EngineeringHealthEvaluation) {
  const grouped = new Map<
    EngineeringHealthEvaluation['evaluations'][number]['category'],
    EngineeringHealthEvaluation['evaluations']
  >();

  for (const evaluation of data.evaluations) {
    const current = grouped.get(evaluation.category) || [];
    current.push(evaluation);
    grouped.set(evaluation.category, current);
  }

  return CATEGORY_ORDER
    .map((category) => ({
      category,
      evaluations: grouped.get(category) || [],
    }))
    .filter((group) => group.evaluations.length > 0);
}

function groupByScope(
  evaluations: EngineeringHealthEvaluation['evaluations'],
) {
  const grouped = new Map<string, EngineeringHealthEvaluation['evaluations']>();

  for (const evaluation of evaluations) {
    const key = evaluation.scope?.key || '__ungrouped__';
    const current = grouped.get(key) || [];
    current.push(evaluation);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries()).map(([key, scopedEvaluations]) => ({
    key,
    label: scopedEvaluations[0]?.scope?.label,
    evaluations: scopedEvaluations,
  }));
}

function isTargetMet(evaluation: EngineeringHealthEvaluation['evaluations'][number]): boolean {
  const value = evaluation.value.value;
  const target = evaluation.target;

  if (value === null || typeof target.value !== 'number') {
    return false;
  }

  if (target.operator === 'lt') return value < target.value;
  if (target.operator === 'lte') return value <= target.value;
  if (target.operator === 'gt') return value > target.value;
  if (target.operator === 'gte') return value >= target.value;
  if (target.operator === 'eq') return value === target.value;
  return false;
}

function sortByLeadershipPriority(
  evaluations: EngineeringHealthEvaluation['evaluations'],
): EngineeringHealthEvaluation['evaluations'] {
  const severity = { critical: 0, watch: 1, good: 2 } as const;

  return [...evaluations].sort((left, right) => {
    const levelDelta = severity[left.recommendation.level] - severity[right.recommendation.level];
    if (levelDelta !== 0) {
      return levelDelta;
    }

    const leftDelta = Math.abs(left.comparison.delta ?? 0);
    const rightDelta = Math.abs(right.comparison.delta ?? 0);
    return rightDelta - leftDelta;
  });
}

function buildExecutiveSummary(data: EngineeringHealthEvaluation) {
  const critical = data.evaluations.filter((evaluation) => evaluation.recommendation.level === 'critical').length;
  const watch = data.evaluations.filter((evaluation) => evaluation.recommendation.level === 'watch').length;
  const good = data.evaluations.filter((evaluation) => evaluation.recommendation.level === 'good').length;
  const targetMet = data.evaluations.filter((evaluation) => isTargetMet(evaluation)).length;
  const targetTotal = data.evaluations.filter((evaluation) => typeof evaluation.target.value === 'number').length;

  const degrading = sortByLeadershipPriority(
    data.evaluations.filter((evaluation) => evaluation.comparison.trend === 'degrading')
  )[0];
  const improving = sortByLeadershipPriority(
    data.evaluations.filter((evaluation) => evaluation.comparison.trend === 'improving')
  )[0];

  return {
    critical,
    watch,
    good,
    targetMet,
    targetTotal,
    degrading,
    improving,
  };
}

export default async function EngineeringHealthPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = parseDashboardFilters(resolvedSearchParams, defaultFilters);
  const params = toQueryParams(filters);

  let data: EngineeringHealthEvaluation | null = null;

  try {
    const response = await engineeringHealthAPI.evaluate(params);
    data = unwrapResult(response);
  } catch (error) {
    console.error('Error fetching engineering health data:', error);
  }

  if (!data || data.evaluations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No engineering health metrics available</CardTitle>
        </CardHeader>
        <CardContent>
          Adjust your dashboard filters or verify that data providers are configured.
        </CardContent>
      </Card>
    );
  }

  const groupedEvaluations = groupByCategory(data);
  const executiveSummary = buildExecutiveSummary(data);
  const priorityScorecard = sortByLeadershipPriority(data.evaluations).slice(0, 8);
  const keyDegradations = sortByLeadershipPriority(
    data.evaluations.filter((evaluation) => evaluation.comparison.trend === 'degrading')
  ).slice(0, 3);
  const keyImprovements = sortByLeadershipPriority(
    data.evaluations.filter((evaluation) => evaluation.comparison.trend === 'improving')
  ).slice(0, 3);

  const unknownComparisons = data.evaluations.filter((evaluation) => evaluation.comparison.trend === 'unknown').length;
  const missingSampleSize = data.evaluations.filter((evaluation) => typeof evaluation.value.sampleSize !== 'number').length;
  const withSeries = data.evaluations.filter((evaluation) => (evaluation.value.series?.length || 0) > 1).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Engineering Health Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Generated at: {data.generatedAt}</p>
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <p className="text-sm font-medium">How comparison works</p>
            <p className="text-sm text-muted-foreground">
              The selected date range is the current period. The compare date range is the previous
              period used as the baseline. We compare current period values against previous period values.
            </p>
            <p className="text-sm text-muted-foreground">
              Example: if current is June 1 to June 30 and compare is May 1 to May 31, June is compared
              against May.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">Current period:</span>{' '}
                {formatWindow(filters.startDate, filters.endDate)}
              </p>
              <p>
                <span className="text-muted-foreground">Comparison period:</span>{' '}
                {formatWindow(filters.compareStartDate, filters.compareEndDate)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Total metrics reviewed: <span className="font-semibold">{data.evaluations.length}</span>.
            Current risk distribution: <span className="font-semibold">{executiveSummary.critical} critical</span>,{' '}
            <span className="font-semibold">{executiveSummary.watch} watch</span>,{' '}
            <span className="font-semibold">{executiveSummary.good} on-track</span>.
          </p>
          <p>
            Target compliance: <span className="font-semibold">{executiveSummary.targetMet}/{executiveSummary.targetTotal || data.evaluations.length}</span>{' '}
            metrics are within target thresholds.
          </p>
          {executiveSummary.degrading ? (
            <p>
              Most relevant degradation: <span className="font-semibold">{executiveSummary.degrading.summary.title}</span>{' '}
              ({executiveSummary.degrading.category}) with delta{' '}
              <span className="font-semibold">{formatValue(executiveSummary.degrading.comparison.delta, executiveSummary.degrading.value.unit)}</span>.
            </p>
          ) : null}
          {executiveSummary.improving ? (
            <p>
              Strongest improvement: <span className="font-semibold">{executiveSummary.improving.summary.title}</span>{' '}
              ({executiveSummary.improving.category}) with delta{' '}
              <span className="font-semibold">{formatValue(executiveSummary.improving.comparison.delta, executiveSummary.improving.value.unit)}</span>.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            {priorityScorecard.map((evaluation) => (
              <div key={`${evaluation.id}-${evaluation.scope?.key || 'default'}-score`} className="rounded border p-3 space-y-1">
                <p className="font-medium">{evaluation.summary.title}</p>
                <p className="text-muted-foreground">{evaluation.category}</p>
                <p>
                  <span className="text-muted-foreground">Current:</span>{' '}
                  <span className="font-semibold">{formatValue(evaluation.value.value, evaluation.value.unit)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Delta:</span>{' '}
                  {formatValue(evaluation.comparison.delta, evaluation.value.unit)}
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <span className={`font-medium ${trendClassName(evaluation.comparison.trend)}`}>{evaluation.recommendation.level}</span>
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trend And Driver Analysis</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2">
            <p className="font-medium">Top degrading signals</p>
            {keyDegradations.length === 0 ? (
              <p className="text-muted-foreground">No degrading trend identified for this window.</p>
            ) : (
              keyDegradations.map((evaluation) => (
                <p key={`${evaluation.id}-${evaluation.scope?.key || 'default'}-degrading`}>
                  <span className="font-semibold">{evaluation.summary.title}</span> ({evaluation.category}):{' '}
                  {evaluation.comparison.summary}
                </p>
              ))
            )}
          </div>
          <div className="space-y-2">
            <p className="font-medium">Top improving signals</p>
            {keyImprovements.length === 0 ? (
              <p className="text-muted-foreground">No improving trend identified for this window.</p>
            ) : (
              keyImprovements.map((evaluation) => (
                <p key={`${evaluation.id}-${evaluation.scope?.key || 'default'}-improving`}>
                  <span className="font-semibold">{evaluation.summary.title}</span> ({evaluation.category}):{' '}
                  {evaluation.comparison.summary}
                </p>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Confidence And References</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Comparison availability: <span className="font-semibold">{data.evaluations.length - unknownComparisons}/{data.evaluations.length}</span>{' '}
            metrics have enough information to compute a trend.
          </p>
          <p>
            Sample-size coverage: <span className="font-semibold">{data.evaluations.length - missingSampleSize}/{data.evaluations.length}</span>{' '}
            metrics expose an explicit sample size.
          </p>
          <p>
            Trend-chart coverage: <span className="font-semibold">{withSeries}/{data.evaluations.length}</span>{' '}
            metrics provide a time series suitable for mini trend charts.
          </p>
          <p className="text-muted-foreground">
            Metric definitions, thresholds, and supporting research references are available in{' '}
            <Link href="/dashboard/references" className="underline">
              References
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      {groupedEvaluations.map((group) => (
        <section key={group.category} className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{CATEGORY_METADATA[group.category].title}</h2>
            <p className="text-sm text-muted-foreground">
              {CATEGORY_METADATA[group.category].description}
            </p>
          </div>

          {groupByScope(group.evaluations).map((scopeGroup) => (
            <div key={`${group.category}-${scopeGroup.key}`} className="space-y-3">
              {scopeGroup.label ? (
                <div>
                  <h3 className="text-base font-medium">{scopeGroup.label}</h3>
                  <p className="text-xs text-muted-foreground">Deployment target specific delivery metrics.</p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {scopeGroup.evaluations.map((evaluation) => (
                  <Card key={`${evaluation.id}-${evaluation.scope?.key || 'default'}`}>
                    <CardHeader>
                      <CardTitle>{evaluation.summary.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {evaluation.scope?.type === 'deployment-target' ? (
                        <div>
                          <p className="text-sm text-muted-foreground">Deployment target</p>
                          <p className="text-sm">{evaluation.scope.label}</p>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Current value</span>
                        <span className="font-semibold">{formatValue(evaluation.value.value, evaluation.value.unit)}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Trend</span>
                        <span className={`font-medium ${trendClassName(evaluation.comparison.trend)}`}>
                          {evaluation.comparison.trend}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Delta</span>
                        <span>{formatValue(evaluation.comparison.delta, evaluation.value.unit)}</span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Comparison chart</p>
                        {buildComparisonBars(evaluation).map((bar) => (
                          <div key={bar.label} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{bar.label}</span>
                              <span>{formatValue(bar.value, evaluation.value.unit)}</span>
                            </div>
                            <div className="h-2 rounded bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded ${bar.tone === 'current' ? 'bg-blue-500' : 'bg-slate-400'}`}
                                style={{ width: `${bar.width}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {renderSeriesSparkline(evaluation.value.series)}

                      <div>
                        <p className="text-sm text-muted-foreground">Comparison summary</p>
                        <p className="text-sm">{evaluation.comparison.summary}</p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Target</p>
                        <p className="text-sm">{evaluation.target.description}</p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Recommendation</p>
                        <p className="text-sm font-medium">{evaluation.recommendation.summary}</p>
                        {evaluation.recommendation.actions.length > 0 ? (
                          <ul className="list-disc pl-5 text-sm text-muted-foreground">
                            {evaluation.recommendation.actions.map((action) => (
                              <li key={action}>{action}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
