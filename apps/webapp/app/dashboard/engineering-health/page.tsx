import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { defaultFilters, parseDashboardFilters } from '@/components/filters/DashboardFilters';
import { METRIC_TARGETS, type SourceEntry } from '@/components/charts/targets';
import {
  engineeringHealthAPI,
  type EngineeringHealthEvaluation,
} from '@/server/api/engineeringHealth';

const CATEGORY_ORDER = ['delivery', 'quality', 'collaboration', 'architecture'] as const;

const CATEGORY_METADATA: Record<
  EngineeringHealthEvaluation['evaluations'][number]['category'],
  {
    title: string;
    description: string;
    color: {
      accent: string;
      border: string;
      badge: string;
      text: string;
    };
  }
> = {
  delivery: {
    title: 'Delivery',
    description: 'Pipeline speed, deployment flow, and release reliability metrics.',
    color: {
      accent: 'border-l-sky-500',
      border: 'border-sky-200',
      badge: 'bg-sky-50',
      text: 'text-sky-800',
    },
  },
  quality: {
    title: 'Quality',
    description: 'Code health signals such as complexity, duplication, and coverage.',
    color: {
      accent: 'border-l-teal-500',
      border: 'border-teal-200',
      badge: 'bg-teal-50',
      text: 'text-teal-800',
    },
  },
  collaboration: {
    title: 'Collaboration',
    description: 'Review flow, participation, and shared knowledge indicators.',
    color: {
      accent: 'border-l-amber-500',
      border: 'border-amber-200',
      badge: 'bg-amber-50',
      text: 'text-amber-800',
    },
  },
  architecture: {
    title: 'Architecture',
    description: 'Structural ownership, coupling, and component health metrics.',
    color: {
      accent: 'border-l-indigo-500',
      border: 'border-indigo-200',
      badge: 'bg-indigo-50',
      text: 'text-indigo-800',
    },
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

function trendBadgeClass(trend: EngineeringHealthEvaluation['evaluations'][number]['comparison']['trend']): string {
  if (trend === 'improving') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (trend === 'degrading') return 'bg-red-50 text-red-700 ring-red-200';
  if (trend === 'stable') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function recommendationBadgeClass(
  level: EngineeringHealthEvaluation['evaluations'][number]['recommendation']['level'],
): string {
  if (level === 'good') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (level === 'watch') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-rose-50 text-rose-700 ring-rose-200';
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMetricLabel(value: string): string {
  return value
    .split('-')
    .map((part) => capitalize(part))
    .join(' ');
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

function resolveReportTimeZone(timezone?: string): string {
  const candidate = timezone?.trim();

  if (!candidate) {
    return 'UTC';
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

function formatHumanDate(value?: string, timezone: string = 'UTC'): string {
  const raw = value?.trim();

  if (!raw) {
    return 'Not set';
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const parsed = isDateOnly ? new Date(`${raw}T00:00:00Z`) : new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  }).format(parsed);
}

function formatHumanDateTime(value?: string, timezone: string = 'UTC'): string {
  const raw = value?.trim();

  if (!raw) {
    return 'Not set';
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
    timeZoneName: 'short',
  }).format(parsed);
}

function formatWindow(startDate?: string, endDate?: string, timezone: string = 'UTC'): string {
  const start = startDate?.trim();
  const end = endDate?.trim();

  if (start && end) {
    return `${formatHumanDate(start, timezone)} to ${formatHumanDate(end, timezone)}`;
  }

  if (start) {
    return `From ${formatHumanDate(start, timezone)}`;
  }

  if (end) {
    return `Until ${formatHumanDate(end, timezone)}`;
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

const REFERENCE_KEYS_BY_METRIC: Record<string, string[]> = {
  'deployment-frequency': ['deployment-frequency'],
  'lead-time': ['deployment-frequency', 'pipeline-duration'],
  'pipeline-duration': ['pipeline-duration'],
  'failure-rate': ['jobs-success-rate'],
  'complexity': ['sonarqube-complexity'],
  'duplication': ['sonarqube-duplication'],
  'coverage': ['sonarqube-coverage'],
  'review-time': ['average-review-time', 'time-to-first-comment'],
  'review-participation': ['comments-by-author'],
  'pair-programming': ['pairing-index'],
  'knowledge-distribution': ['ownership'],
  'coupling': ['code-coupling'],
  'ownership': ['ownership'],
  'components': ['sonarqube-measurements'],
};

function collectReferences(
  evaluations: EngineeringHealthEvaluation['evaluations'],
): SourceEntry[] {
  const unique = new Map<string, SourceEntry>();

  for (const evaluation of evaluations) {
    const keys = REFERENCE_KEYS_BY_METRIC[evaluation.id] || [];

    for (const key of keys) {
      const target = METRIC_TARGETS[key];
      if (!target) {
        continue;
      }

      for (const source of target.sources) {
        const uniqueKey = `${source.label}||${source.url}`;
        if (!unique.has(uniqueKey)) {
          unique.set(uniqueKey, source);
        }
      }
    }
  }

  return Array.from(unique.values());
}

function sourceKey(source: SourceEntry): string {
  return `${source.label}||${source.url}`;
}

function buildReferenceIndex(references: SourceEntry[]): Map<string, number> {
  return new Map(references.map((reference, index) => [sourceKey(reference), index + 1]));
}

function getMetricReferences(metricId: string): SourceEntry[] {
  const keys = REFERENCE_KEYS_BY_METRIC[metricId] || [];
  const unique = new Map<string, SourceEntry>();

  for (const key of keys) {
    const target = METRIC_TARGETS[key];
    if (!target) {
      continue;
    }

    for (const source of target.sources) {
      unique.set(sourceKey(source), source);
    }
  }

  return Array.from(unique.values());
}

function renderInlineCitations(metricId: string, referenceIndex: Map<string, number>) {
  const references = getMetricReferences(metricId)
    .map((reference) => ({
      reference,
      number: referenceIndex.get(sourceKey(reference)),
    }))
    .filter((entry): entry is { reference: SourceEntry; number: number } => typeof entry.number === 'number');

  if (references.length === 0) {
    return null;
  }

  return (
    <span className="ml-1 inline-flex gap-1 align-super text-[0.7rem]">
      {references.map(({ reference, number }) => (
        <Link
          key={`${metricId}-${number}`}
          href={reference.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Reference ${number}: ${reference.label}`}
          className="underline"
        >
          [{number}]
        </Link>
      ))}
    </span>
  );
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
  const scorecardGroups = groupedEvaluations.map((group) => ({
    category: group.category,
    evaluations: sortByLeadershipPriority(group.evaluations),
  }));
  const keyDegradations = sortByLeadershipPriority(
    data.evaluations.filter((evaluation) => evaluation.comparison.trend === 'degrading')
  ).slice(0, 3);
  const keyImprovements = sortByLeadershipPriority(
    data.evaluations.filter((evaluation) => evaluation.comparison.trend === 'improving')
  ).slice(0, 3);

  const unknownComparisons = data.evaluations.filter((evaluation) => evaluation.comparison.trend === 'unknown').length;
  const missingSampleSize = data.evaluations.filter((evaluation) => typeof evaluation.value.sampleSize !== 'number').length;
  const withSeries = data.evaluations.filter((evaluation) => (evaluation.value.series?.length || 0) > 1).length;
  const reportReferences = collectReferences(data.evaluations);
  const referenceIndex = buildReferenceIndex(reportReferences);
  const reportTimeZone = resolveReportTimeZone(filters.timezone);

  return (
    <div className="eh-report space-y-6">
      <Card className="eh-print-section overflow-hidden border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eff6ff_45%,#f0f9ff_100%)] text-slate-900 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-700">
                Report
              </div>
              <CardTitle className="!text-slate-900">Engineering Health Overview</CardTitle>
              <p className="max-w-3xl text-sm leading-6 text-slate-700">
                A structured view of delivery, quality, collaboration, and architecture signals for executive review.
              </p>
            </div>
            <details className="group relative">
              <summary
                aria-label="Show comparison guide"
                className="list-none cursor-pointer select-none rounded-full border border-slate-300 bg-white w-7 h-7 flex items-center justify-center text-xs text-slate-700 hover:bg-slate-100"
              >
                i
              </summary>
              <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-sm min-w-[280px] max-w-[520px] text-slate-700 shadow-xl">
                <p className="text-sm font-medium">How comparison works</p>
                <p className="text-sm text-slate-600">
                  The selected date range is the current period. The compare date range is the previous
                  period used as the baseline. We compare current period values against previous period values.
                </p>
                <p className="text-sm text-slate-600">
                  Example: if current is June 1 to June 30 and compare is May 1 to May 31, June is compared
                  against May.
                </p>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <p>
                    <span className="text-slate-500">Current period:</span>{' '}
                    {formatWindow(filters.startDate, filters.endDate, reportTimeZone)}
                  </p>
                  <p>
                    <span className="text-slate-500">Comparison period:</span>{' '}
                    {formatWindow(filters.compareStartDate, filters.compareEndDate, reportTimeZone)}
                  </p>
                </div>
              </div>
            </details>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Generated</p>
              <p className="mt-1 text-sm text-slate-900">{formatHumanDateTime(data.generatedAt, reportTimeZone)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Current period</p>
              <p className="mt-1 text-sm text-slate-900">{formatWindow(filters.startDate, filters.endDate, reportTimeZone)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Comparison period</p>
              <p className="mt-1 text-sm text-slate-900">{formatWindow(filters.compareStartDate, filters.compareEndDate, reportTimeZone)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="eh-print-section border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="!text-slate-900">Executive Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
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
              {renderInlineCitations(executiveSummary.degrading.id, referenceIndex)}{' '}
              ({executiveSummary.degrading.category}) with delta{' '}
              <span className="font-semibold">{formatValue(executiveSummary.degrading.comparison.delta, executiveSummary.degrading.value.unit)}</span>.
            </p>
          ) : null}
          {executiveSummary.improving ? (
            <p>
              Strongest improvement: <span className="font-semibold">{executiveSummary.improving.summary.title}</span>{' '}
              {renderInlineCitations(executiveSummary.improving.id, referenceIndex)}
              ({executiveSummary.improving.category}) with delta{' '}
              <span className="font-semibold">{formatValue(executiveSummary.improving.comparison.delta, executiveSummary.improving.value.unit)}</span>.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="eh-print-section border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle className="!text-slate-900">Scorecard</CardTitle>
            <p className="text-sm text-slate-500">Priority metrics, sorted by executive risk and movement.</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-5 text-sm">
            {scorecardGroups.map((group) => (
              <div
                key={`${group.category}-scorecards`}
                role="region"
                aria-label={`${CATEGORY_METADATA[group.category].title} scorecards`}
                className="space-y-3"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${CATEGORY_METADATA[group.category].color.badge} ring-1 ${CATEGORY_METADATA[group.category].color.border}`} />
                  <div>
                    <p className={`text-sm font-semibold ${CATEGORY_METADATA[group.category].color.text}`}>
                      {CATEGORY_METADATA[group.category].title}
                    </p>
                    <p className="text-xs text-slate-500">Sorted by risk level, then largest movement.</p>
                  </div>
                </div>
                <div className="eh-scorecard-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {group.evaluations.map((evaluation) => (
                    <div
                      key={`${evaluation.id}-${evaluation.scope?.key || 'default'}-score`}
                      role="article"
                      aria-label={`${formatMetricLabel(evaluation.summary.title)} scorecard`}
                      className={`eh-scorecard-item rounded-2xl border border-l-4 ${CATEGORY_METADATA[evaluation.category].color.accent} border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 space-y-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">
                            {formatMetricLabel(evaluation.summary.title)}
                            {renderInlineCitations(evaluation.id, referenceIndex)}
                          </p>
                          <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-[0.16em] ${CATEGORY_METADATA[evaluation.category].color.border} ${CATEGORY_METADATA[evaluation.category].color.badge} ${CATEGORY_METADATA[evaluation.category].color.text}`}>
                            {evaluation.category}
                          </p>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ring-1 ${recommendationBadgeClass(evaluation.recommendation.level)}`}>
                          {evaluation.recommendation.level}
                        </span>
                      </div>
                      <div>
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Current</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                          {formatValue(evaluation.value.value, evaluation.value.unit)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Delta</p>
                          <p className="mt-1 text-sm text-slate-700">{formatValue(evaluation.comparison.delta, evaluation.value.unit)}</p>
                        </div>
                        <div>
                          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Trend</p>
                          <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ring-1 ${trendBadgeClass(evaluation.comparison.trend)}`}>
                            {evaluation.comparison.trend}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="eh-print-section border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle className="!text-slate-900">Trend And Driver Analysis</CardTitle>
            <p className="text-sm text-slate-500">The strongest signals leadership should review first.</p>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 space-y-3">
            <p className="font-medium text-slate-900">Top degrading signals</p>
            {keyDegradations.length === 0 ? (
              <p className="text-slate-500">No degrading trend identified for this window.</p>
            ) : (
              keyDegradations.map((evaluation) => (
                <p key={`${evaluation.id}-${evaluation.scope?.key || 'default'}-degrading`} className="leading-6 text-slate-700">
                  <span className="font-semibold text-slate-900">{formatMetricLabel(evaluation.summary.title)}</span>
                  {renderInlineCitations(evaluation.id, referenceIndex)} ({evaluation.category}):{' '}
                  {evaluation.comparison.summary}
                </p>
              ))
            )}
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
            <p className="font-medium text-slate-900">Top improving signals</p>
            {keyImprovements.length === 0 ? (
              <p className="text-slate-500">No improving trend identified for this window.</p>
            ) : (
              keyImprovements.map((evaluation) => (
                <p key={`${evaluation.id}-${evaluation.scope?.key || 'default'}-improving`} className="leading-6 text-slate-700">
                  <span className="font-semibold text-slate-900">{formatMetricLabel(evaluation.summary.title)}</span>
                  {renderInlineCitations(evaluation.id, referenceIndex)} ({evaluation.category}):{' '}
                  {evaluation.comparison.summary}
                </p>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="eh-print-section border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle className="!text-slate-900">Data Confidence And References</CardTitle>
            <p className="text-sm text-slate-500">What confidence to place in the analysis and where the evidence comes from.</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Comparison availability</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {data.evaluations.length - unknownComparisons}/{data.evaluations.length}
            </p>
            <p className="mt-2 text-slate-600">metrics have enough information to compute a trend.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Sample-size coverage</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {data.evaluations.length - missingSampleSize}/{data.evaluations.length}
            </p>
            <p className="mt-2 text-slate-600">metrics expose an explicit sample size.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Trend-chart coverage</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {withSeries}/{data.evaluations.length}
            </p>
            <p className="mt-2 text-slate-600">metrics provide a time series suitable for mini trend charts.</p>
          </div>
          <div className="md:col-span-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-slate-600">
            Metric definitions, thresholds, and supporting research references are available in{' '}
            <Link href="/dashboard/references" className="font-medium underline underline-offset-2">
              References
            </Link>
            .
          </div>
        </CardContent>
      </Card>

      {groupedEvaluations.map((group) => (
        <section key={group.category} className="space-y-4 eh-print-section">
          <div className={`space-y-2 border-b pb-3 ${CATEGORY_METADATA[group.category].color.border}`}>
            <div className={`inline-flex rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${CATEGORY_METADATA[group.category].color.border} ${CATEGORY_METADATA[group.category].color.badge} ${CATEGORY_METADATA[group.category].color.text}`}>
              {group.category}
            </div>
            <h2 className={`text-2xl font-semibold tracking-tight ${CATEGORY_METADATA[group.category].color.text}`}>{CATEGORY_METADATA[group.category].title}</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              {CATEGORY_METADATA[group.category].description}
            </p>
          </div>

          {groupByScope(group.evaluations).map((scopeGroup) => (
            <div key={`${group.category}-${scopeGroup.key}`} className="space-y-3">
              {scopeGroup.label ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-base font-medium text-slate-900">{scopeGroup.label}</h3>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Deployment target specific delivery metrics</p>
                </div>
              ) : null}

              <div className="eh-metric-grid grid grid-cols-1 lg:grid-cols-2 gap-6">
                {scopeGroup.evaluations.map((evaluation) => (
                  <Card key={`${evaluation.id}-${evaluation.scope?.key || 'default'}`} className="eh-print-keep border-slate-200 bg-white shadow-sm">
                    <CardHeader className="!mb-0 !pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Metric</p>
                          <CardTitle className="!mt-1 !text-slate-950">
                            {formatMetricLabel(evaluation.summary.title)}
                            {renderInlineCitations(evaluation.id, referenceIndex)}
                          </CardTitle>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ring-1 ${recommendationBadgeClass(evaluation.recommendation.level)}`}>
                          {evaluation.recommendation.level}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {evaluation.scope?.type === 'deployment-target' ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Deployment target</p>
                          <p className="mt-1 text-sm text-slate-800">{evaluation.scope.label}</p>
                        </div>
                      ) : null}

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Current value</p>
                          <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{formatValue(evaluation.value.value, evaluation.value.unit)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Trend</p>
                          <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ring-1 ${trendBadgeClass(evaluation.comparison.trend)}`}>
                            {evaluation.comparison.trend}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Delta</p>
                          <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{formatValue(evaluation.comparison.delta, evaluation.value.unit)}</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <p className="text-sm font-medium text-slate-900">Comparison chart</p>
                        {buildComparisonBars(evaluation).map((bar) => (
                          <div key={bar.label} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{bar.label}</span>
                              <span>{formatValue(bar.value, evaluation.value.unit)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${bar.tone === 'current' ? 'bg-sky-600' : 'bg-slate-400'}`}
                                style={{ width: `${bar.width}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {renderSeriesSparkline(evaluation.value.series)}

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-medium text-slate-900">Comparison summary</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{evaluation.comparison.summary}</p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-medium text-slate-900">Target</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {evaluation.target.description}
                          {renderInlineCitations(evaluation.id, referenceIndex)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-medium text-slate-900">Recommendation</p>
                        <p className="mt-2 text-sm font-medium text-slate-800">{evaluation.recommendation.summary}</p>
                        {evaluation.recommendation.actions.length > 0 ? (
                          <ul className="mt-2 list-disc pl-5 text-sm leading-6 text-slate-600">
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

      <Card className="eh-print-section border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle className="!text-slate-900">Report References</CardTitle>
            <p className="text-sm text-slate-500">Evidence base cited throughout this report.</p>
          </div>
        </CardHeader>
        <CardContent>
          {reportReferences.length === 0 ? (
            <p className="text-sm text-slate-500">
              No references available for the selected metric set.
            </p>
          ) : (
            <ul className="space-y-3 pl-0 text-sm text-slate-700">
              {reportReferences.map((reference, index) => (
                <li key={`${reference.label}-${reference.url}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Link href={reference.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    [{index + 1}] {reference.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
