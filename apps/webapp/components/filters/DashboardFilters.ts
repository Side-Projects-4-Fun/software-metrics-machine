export interface DashboardFilters {
  // Date filters
  startDate: string;
  endDate: string;
  timezone?: string;

  // Pipeline filters
  workflowSelector?: string;
  workflowStatus: string[];
  workflowConclusions: string[];
  jobSelector: string[];
  branch: string[];
  event: string[];

  // PR filters
  authorSelect: string[];
  excludeAuthorSelect: string[];
  excludeCommenterSelect: string[];
  labelSelector: string[];
  pullRequestStatus?: 'open' | 'closed' | 'merged' | 'draft';
  aggregateBy?: string;

  // Average computation filters
  weekends: 'include' | 'exclude' | 'weekends_only';
  outlierMode: 'include' | 'flag' | 'exclude';

  // Engineering health filters
  metric?: string;
  category?: string;
  compareStartDate: string;
  compareEndDate: string;
  rawFilters: string;
  period: 'day' | 'week' | 'month';

  // Source code filters
  ignorePatternFiles: string;
  includePatternFiles: string;
  authorSelectSourceCode: string[];
  topEntries: number;
  typeChurn?: string;

  // Metrics filters
  aggregateMetric: string;

  // SonarQube filters
  sonarqubeRemoveFolders: boolean;
}

export const DASHBOARD_FILTER_QUERY_KEYS = [
  'startDate',
  'endDate',
  'timezone',
  'workflowSelector',
  'workflowStatus',
  'workflowConclusions',
  'jobSelector',
  'branch',
  'event',
  'aggregateMetric',
  'ignorePatternFiles',
  'includePatternFiles',
  'authorSelectSourceCode',
  'topEntries',
  'typeChurn',
  'authorSelect',
  'excludeAuthorSelect',
  'excludeCommenterSelect',
  'labelSelector',
  'pullRequestStatus',
  'aggregateBy',
  'weekends',
  'outlierMode',
  'metric',
  'category',
  'compareStartDate',
  'compareEndDate',
  'rawFilters',
  'period',
  'sonarqubeRemoveFolders',
] as const;

export const defaultFilters: DashboardFilters = {
  startDate: '',
  endDate: '',
  timezone: '',
  workflowSelector: undefined,
  workflowStatus: [],
  workflowConclusions: [],
  jobSelector: [],
  branch: [],
  event: [],
  authorSelect: [],
  excludeAuthorSelect: [],
  excludeCommenterSelect: [],
  labelSelector: [],
  aggregateBy: 'week',
  weekends: 'include',
  outlierMode: 'include',
  metric: undefined,
  category: undefined,
  compareStartDate: '',
  compareEndDate: '',
  rawFilters: '',
  period: 'week',
  ignorePatternFiles: '',
  includePatternFiles: '',
  authorSelectSourceCode: [],
  topEntries: 20,
  typeChurn: 'added',
  aggregateMetric: 'avg',
  sonarqubeRemoveFolders: true,
};

type SearchParamValue = string | string[] | undefined;

type SearchParamSource = Record<string, SearchParamValue>;

function getSingleValue(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getArrayValue(value: SearchParamValue): string[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.length > 0) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function toNumber(value: string | undefined, fallback: number | undefined): number | undefined {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function toBoolean(value: SearchParamValue, fallback: boolean): boolean {
  const singleValue = getSingleValue(value);

  if (singleValue === 'true') {
    return true;
  }

  if (singleValue === 'false') {
    return false;
  }

  return fallback;
}

export function parseDashboardFilters(
  searchParams: SearchParamSource,
  fallback: DashboardFilters = defaultFilters,
): DashboardFilters {
  return {
    ...fallback,
    startDate: getSingleValue(searchParams.startDate) || fallback.startDate,
    endDate: getSingleValue(searchParams.endDate) || fallback.endDate,
    timezone: getSingleValue(searchParams.timezone) || fallback.timezone,
    workflowSelector: getSingleValue(searchParams.workflowSelector) || undefined,
    workflowStatus: getArrayValue(searchParams.workflowStatus),
    workflowConclusions: getArrayValue(searchParams.workflowConclusions),
    jobSelector: getArrayValue(searchParams.jobSelector),
    branch: getArrayValue(searchParams.branch),
    event: getArrayValue(searchParams.event),
    aggregateMetric: getSingleValue(searchParams.aggregateMetric) || fallback.aggregateMetric,
    ignorePatternFiles: getSingleValue(searchParams.ignorePatternFiles) || fallback.ignorePatternFiles,
    includePatternFiles: getSingleValue(searchParams.includePatternFiles) || fallback.includePatternFiles,
    authorSelectSourceCode: getArrayValue(searchParams.authorSelectSourceCode),
    topEntries: toNumber(getSingleValue(searchParams.topEntries), fallback.topEntries) || fallback.topEntries,
    typeChurn: getSingleValue(searchParams.typeChurn) || fallback.typeChurn,
    authorSelect: getArrayValue(searchParams.authorSelect),
    excludeAuthorSelect: getArrayValue(searchParams.excludeAuthorSelect),
    excludeCommenterSelect: getArrayValue(searchParams.excludeCommenterSelect),
    labelSelector: getArrayValue(searchParams.labelSelector),
    pullRequestStatus: getSingleValue(searchParams.pullRequestStatus) as DashboardFilters['pullRequestStatus'] || fallback.pullRequestStatus,
    aggregateBy: getSingleValue(searchParams.aggregateBy) || fallback.aggregateBy,
    weekends: parseWeekends(getSingleValue(searchParams.weekends), fallback.weekends),
    outlierMode: parseOutlierMode(getSingleValue(searchParams.outlierMode), fallback.outlierMode),
    metric: getSingleValue(searchParams.metric) || fallback.metric,
    category: getSingleValue(searchParams.category) || fallback.category,
    compareStartDate:
      getSingleValue(searchParams.compareStartDate) ||
      getSingleValue(searchParams.compare_start_date) ||
      fallback.compareStartDate,
    compareEndDate:
      getSingleValue(searchParams.compareEndDate) ||
      getSingleValue(searchParams.compare_end_date) ||
      fallback.compareEndDate,
    rawFilters:
      getSingleValue(searchParams.rawFilters) ||
      getSingleValue(searchParams.raw_filters) ||
      fallback.rawFilters,
    period: parsePeriod(getSingleValue(searchParams.period), fallback.period),
    sonarqubeRemoveFolders: toBoolean(searchParams.sonarqubeRemoveFolders, fallback.sonarqubeRemoveFolders),
  };
}

export function serializeDashboardFilters(filters: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams();

  const append = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  };

  const appendList = (key: string, values: string[] | undefined) => {
    if (values && values.length > 0) {
      params.set(key, values.join(','));
    }
  };

  append('startDate', filters.startDate);
  append('endDate', filters.endDate);
  append('timezone', filters.timezone);
  append('workflowSelector', filters.workflowSelector);
  appendList('workflowStatus', filters.workflowStatus);
  appendList('workflowConclusions', filters.workflowConclusions);
  appendList('jobSelector', filters.jobSelector);
  appendList('branch', filters.branch);
  appendList('event', filters.event);
  append('aggregateMetric', filters.aggregateMetric);
  append('ignorePatternFiles', filters.ignorePatternFiles);
  append('includePatternFiles', filters.includePatternFiles);
  appendList('authorSelectSourceCode', filters.authorSelectSourceCode);
  append('topEntries', filters.topEntries);
  append('typeChurn', filters.typeChurn);
  appendList('authorSelect', filters.authorSelect);
  appendList('excludeAuthorSelect', filters.excludeAuthorSelect);
  appendList('excludeCommenterSelect', filters.excludeCommenterSelect);
  appendList('labelSelector', filters.labelSelector);
  append('pullRequestStatus', filters.pullRequestStatus);
  append('aggregateBy', filters.aggregateBy);
  append('weekends', filters.weekends);
  append('outlierMode', filters.outlierMode);
  append('metric', filters.metric);
  append('category', filters.category);
  append('compareStartDate', filters.compareStartDate);
  append('compareEndDate', filters.compareEndDate);
  append('rawFilters', filters.rawFilters);
  if (filters.period !== defaultFilters.period) {
    append('period', filters.period);
  }
  append('sonarqubeRemoveFolders', filters.sonarqubeRemoveFolders ? 'true' : 'false');

  return params;
}

function parseWeekends(
  value: string | undefined,
  fallback: DashboardFilters['weekends'],
): DashboardFilters['weekends'] {
  return value === 'exclude' || value === 'include' || value === 'weekends_only'
    ? value
    : fallback;
}

function parseOutlierMode(
  value: string | undefined,
  fallback: DashboardFilters['outlierMode'],
): DashboardFilters['outlierMode'] {
  return value === 'flag' || value === 'exclude' || value === 'include' ? value : fallback;
}

function parsePeriod(
  value: string | undefined,
  fallback: DashboardFilters['period'],
): DashboardFilters['period'] {
  return value === 'day' || value === 'week' || value === 'month' ? value : fallback;
}
