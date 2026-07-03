import { ApiParams } from '@/server/api';

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  timezone?: string;
  workflowSelector?: string;
  workflowStatus?: string[];
  workflowConclusions?: string[];
  jobSelector?: string[];
  branch?: string[];
  event?: string[];
  aggregateMetric?: string;
  ignorePatternFiles?: string;
  includePatternFiles?: string;
  authorSelectSourceCode?: string[];
  topEntries?: number;
  typeChurn?: string;
  authorSelect?: string[];
  excludeAuthorSelect?: string[];
  excludeCommenterSelect?: string[];
  labelSelector?: string[];
  pullRequestStatus?: 'open' | 'closed' | 'merged' | 'draft';
  aggregateBy?: string;
  weekends?: 'include' | 'exclude' | 'weekends_only';
  outlierMode?: 'include' | 'flag' | 'exclude';
  sonarqubeRemoveFolders?: boolean;
}

/**
 * Convert pipeline section filters to API parameters
 */
export function buildPipelineApiParams(filters: DashboardFilters): ApiParams {
  return {
    start_date: filters.startDate,
    end_date: filters.endDate,
    timezone: filters.timezone,
    workflow_path: filters.workflowSelector,
    status: filters.workflowStatus?.length ? filters.workflowStatus.join(',') : undefined,
    conclusion: filters.workflowConclusions?.length ? filters.workflowConclusions.join(',') : undefined,
    job_name: filters.jobSelector?.length ? filters.jobSelector.join(',') : undefined,
    branch: filters.branch?.length ? filters.branch.join(',') : undefined,
    event: filters.event?.length ? filters.event.join(',') : undefined,
    metric: filters.aggregateMetric,
    weekends: filters.weekends,
    outlier_mode: filters.outlierMode,
  };
}

/**
 * Convert source code section filters to API parameters
 */
export function buildSourceCodeApiParams(filters: DashboardFilters): ApiParams {
  return {
    start_date: filters.startDate,
    end_date: filters.endDate,
    timezone: filters.timezone,
    ignore_files: filters.ignorePatternFiles || undefined,
    include_only: filters.includePatternFiles || undefined,
    authors: filters.authorSelectSourceCode?.length
      ? filters.authorSelectSourceCode.join(',')
      : undefined,
    top: filters.topEntries,
    type_churn: filters.typeChurn,
  };
}

/**
 * Convert pull request section filters to API parameters
 */
export function buildPullRequestApiParams(filters: DashboardFilters): ApiParams {
  return {
    start_date: filters.startDate,
    end_date: filters.endDate,
    timezone: filters.timezone,
    authors: filters.authorSelect?.length ? filters.authorSelect.join(',') : undefined,
    exclude_authors: filters.excludeAuthorSelect?.length
      ? filters.excludeAuthorSelect.join(',')
      : undefined,
    exclude_commenters: filters.excludeCommenterSelect?.length
      ? filters.excludeCommenterSelect.join(',')
      : undefined,
    labels: filters.labelSelector?.length ? filters.labelSelector.join(',') : undefined,
    status: filters.pullRequestStatus,
    aggregate_by: filters.aggregateBy,
    weekends: filters.weekends,
    outlier_mode: filters.outlierMode,
  };
}

/**
 * Convert SonarQube section filters to API parameters
 */
export function buildSonarqubeApiParams(filters: DashboardFilters): ApiParams {
  return {
    ignore_files: filters.ignorePatternFiles || undefined,
    include_files: filters.includePatternFiles || undefined,
    remove_folders: filters.sonarqubeRemoveFolders ? 'true' : undefined,
  };
}

/**
 * Batch export for easy access to all builders
 */
export const apiParamBuilders = {
  pipeline: buildPipelineApiParams,
  sourceCode: buildSourceCodeApiParams,
  pullRequest: buildPullRequestApiParams,
  sonarqube: buildSonarqubeApiParams,
};
