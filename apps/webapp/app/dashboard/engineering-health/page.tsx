import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Engineering Health Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Generated at: {data.generatedAt}</p>
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
