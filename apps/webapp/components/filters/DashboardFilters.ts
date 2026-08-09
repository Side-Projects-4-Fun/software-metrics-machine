export interface DashboardFilters {
  startDate: string;
  endDate: string;
  timezone?: string;
  workflowSelector?: string;
  workflowStatus: string[];
  workflowConclusions: string[];
  jobSelector: string[];
  branch: string[];
  event: string[];
  authorSelect: string[];
  excludeAuthorSelect: string[];
  excludeCommenterSelect: string[];
  labelSelector: string[];
  changeRequestStatus?: 'open' | 'closed' | 'merged' | 'draft';
  aggregateBy?: string;
  weekends: 'include' | 'exclude' | 'weekends_only';
  outlierMode: 'include' | 'flag' | 'exclude';
  metric?: string;
  category?: string;
  compareStartDate: string;
  compareEndDate: string;
  rawFilters: string;
  period: 'day' | 'week' | 'month';
  ignorePatternFiles: string;
  includePatternFiles: string;
  authorSelectSourceCode: string[];
  topEntries: number;
  typeChurn?: string;
  aggregateMetric: string;
  sonarqubeRemoveFolders: boolean;
  method?: string;
}

export const DASHBOARD_FILTER_QUERY_KEYS = [
  'startDate', 'endDate', 'timezone', 'workflowSelector', 'workflowStatus',
  'workflowConclusions', 'jobSelector', 'branch', 'event', 'aggregateMetric',
  'ignorePatternFiles', 'includePatternFiles', 'authorSelectSourceCode',
  'topEntries', 'typeChurn', 'authorSelect', 'excludeAuthorSelect',
  'excludeCommenterSelect', 'labelSelector', 'changeRequestStatus',
  'aggregateBy', 'weekends', 'outlierMode', 'metric', 'category',
  'compareStartDate', 'compareEndDate', 'rawFilters', 'period',
  'sonarqubeRemoveFolders',
  'method',
] as const;

export const defaultFilters: DashboardFilters = {
  startDate: '', endDate: '', timezone: '', workflowSelector: undefined,
  workflowStatus: [], workflowConclusions: [], jobSelector: [], branch: [],
  event: [], authorSelect: [], excludeAuthorSelect: [],
  excludeCommenterSelect: [], labelSelector: [], aggregateBy: 'week',
  weekends: 'include', outlierMode: 'include', metric: undefined,
  category: undefined, compareStartDate: '', compareEndDate: '',
  rawFilters: '', period: 'week', ignorePatternFiles: '',
  includePatternFiles: '', authorSelectSourceCode: [], topEntries: 20,
  typeChurn: 'added', aggregateMetric: 'avg', sonarqubeRemoveFolders: true,
  method: 'average',
};

type SearchParamValue = string | string[] | undefined;
type SearchParamSource = Record<string, SearchParamValue>;

function getSingleValue(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {return value[0];}
  return value;
}

function getArrayValue(value: SearchParamValue): string[] {
  if (Array.isArray(value)) {return value;}
  if (typeof value === 'string' && value.length > 0)
    {return value.split(',').map((s) => s.trim()).filter(Boolean);}
  return [];
}

function toNumber(value: string | undefined, fallback: number | undefined): number | undefined {
  if (!value) {return fallback;}
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value: SearchParamValue, fallback: boolean): boolean {
  const v = getSingleValue(value);
  if (v === 'true') {return true;}
  if (v === 'false') {return false;}
  return fallback;
}

function parseWeekends(v: string | undefined, fb: DashboardFilters['weekends']): DashboardFilters['weekends'] {
  return v === 'exclude' || v === 'include' || v === 'weekends_only' ? v : fb;
}

function parseOutlierMode(v: string | undefined, fb: DashboardFilters['outlierMode']): DashboardFilters['outlierMode'] {
  return v === 'flag' || v === 'exclude' || v === 'include' ? v : fb;
}

function parsePeriod(v: string | undefined, fb: DashboardFilters['period']): DashboardFilters['period'] {
  return v === 'day' || v === 'week' || v === 'month' ? v : fb;
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
    changeRequestStatus: getSingleValue(searchParams.changeRequestStatus) as DashboardFilters['changeRequestStatus'] || fallback.changeRequestStatus,
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
    method: getSingleValue(searchParams.method) || fallback.method,
  };
}

export function serializeDashboardFilters(filters: DashboardFilters): URLSearchParams {
  const p = new URLSearchParams();
  const a = (k: string, v: string | number | undefined) => { if (v !== undefined && v !== '') {p.set(k, String(v));} };
  const al = (k: string, vs: string[] | undefined) => { if (vs && vs.length > 0) {p.set(k, vs.join(','));} };
  a('startDate', filters.startDate);
  a('endDate', filters.endDate);
  a('timezone', filters.timezone);
  a('workflowSelector', filters.workflowSelector);
  al('workflowStatus', filters.workflowStatus);
  al('workflowConclusions', filters.workflowConclusions);
  al('jobSelector', filters.jobSelector);
  al('branch', filters.branch);
  al('event', filters.event);
  a('aggregateMetric', filters.aggregateMetric);
  a('ignorePatternFiles', filters.ignorePatternFiles);
  a('includePatternFiles', filters.includePatternFiles);
  al('authorSelectSourceCode', filters.authorSelectSourceCode);
  a('topEntries', filters.topEntries);
  a('typeChurn', filters.typeChurn);
  al('authorSelect', filters.authorSelect);
  al('excludeAuthorSelect', filters.excludeAuthorSelect);
  al('excludeCommenterSelect', filters.excludeCommenterSelect);
  al('labelSelector', filters.labelSelector);
  a('changeRequestStatus', filters.changeRequestStatus);
  a('aggregateBy', filters.aggregateBy);
  a('weekends', filters.weekends);
  a('outlierMode', filters.outlierMode);
  a('metric', filters.metric);
  a('category', filters.category);
  a('compareStartDate', filters.compareStartDate);
  a('compareEndDate', filters.compareEndDate);
  a('rawFilters', filters.rawFilters);
  if (filters.period !== defaultFilters.period) {a('period', filters.period);}
  a('sonarqubeRemoveFolders', filters.sonarqubeRemoveFolders ? 'true' : 'false');
  a('method', filters.method);
  return p;
}
