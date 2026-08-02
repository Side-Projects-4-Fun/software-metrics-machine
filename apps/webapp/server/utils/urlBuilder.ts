/**
 * URL Builder for external provider links (GitHub, GitLab, SonarQube)
 * Builds URLs based on git provider type and SonarQube configuration
 */

import { DashboardGlobalConfiguration } from "../api/configuration";

export interface UrlBuilder {
  // PR/MR links
  getPRsUrl(filters?: { status?: string; author?: string; label?: string }): string;
  getPRUrl(prNumber: number): string;
  
  // Commit links
  getCommitUrl(hash: string): string;
  
  // Pipeline/Workflow links
  getPipelinesUrl(filters?: { status?: string; workflow?: string }): string;
  getPipelineRunUrl(runId: string, runNumber?: number): string;
  getJobRunsUrl(
    jobName: string,
    workflowName?: string,
    dateRange?: { startDate?: string; endDate?: string; timezone?: string }
  ): string;
  getWorkflowJobsMetricsUrl(
    workflowName: string,
    dateRange?: { startDate?: string; endDate?: string; timezone?: string }
  ): string;
  
  // SonarQube links
  getSonarqubeComponentUrl(componentKey: string): string;
  getSonarqubeComponentMeasuresUrl(componentKey: string, metric: string): string;
  getSonarqubeProjectMeasuresUrl(metric: string): string;
  getSonarqubeProjectUrl(): string;

  getActionPerformanceForJobUrl(jobName: string, workflowName: string, granularity: 'day' | 'week' | 'month', date: string, timezone?: string): string
}


type DateRange = { startDate?: string; endDate?: string; timezone?: string };
type DateParts = { year: number; month: number; day: number };
type DateTimeParts = DateParts & { hour: number; minute: number; second: number; millisecond: number };

const parseDateParts = (dateStr: string): DateParts | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

const addDays = (date: DateParts, days: number): DateParts => {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
};

const toUtcTimestamp = (date: DateTimeParts): number =>
  Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    date.hour,
    date.minute,
    date.second,
    date.millisecond,
  );

const startOfUtcDay = (date: DateParts): number =>
  toUtcTimestamp({ ...date, hour: 0, minute: 0, second: 0, millisecond: 0 });

const parseDateTimeParts = (dateStr: string): DateTimeParts | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?/.exec(dateStr);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
    millisecond: Number((match[7] || '0').padEnd(3, '0')),
  };
};

const computeRange = (dateStr: string, granularity: 'day' | 'week' | 'month'): { start: number; end: number } => {
  const date = parseDateParts(dateStr);
  if (!date) {
    return { start: Number.NaN, end: Number.NaN };
  }

  if (granularity === 'day') {
    return {
      start: startOfUtcDay(date),
      end: startOfUtcDay(addDays(date, 1)) - 1,
    };
  }

  const startUtc = Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0, 0);
  const [year, month, day] = [date.year, date.month, date.day];

  if (granularity === 'week') {
    const d = new Date(startUtc);
    const utcDay = d.getUTCDay();
    const diffToMonday = (utcDay + 6) % 7;
    const monday = addDays({ year, month, day }, -diffToMonday);
    const nextMonday = addDays(monday, 7);

    return {
      start: startOfUtcDay(monday),
      end: startOfUtcDay(nextMonday) - 1,
    };
  }

  const monthStart = { year, month, day: 1 };
  const nextMonthStart = month === 12
    ? { year: year + 1, month: 1, day: 1 }
    : { year, month: month + 1, day: 1 };

  return {
    start: startOfUtcDay(monthStart),
    end: startOfUtcDay(nextMonthStart) - 1,
  };
};

const isDateTimeValue = (dateStr: string): boolean => /^\d{4}-\d{2}-\d{2}T/.test(dateStr);

const computeDateRangeBoundary = (dateStr: string, boundary: 'start' | 'end'): number => {
  if (isDateTimeValue(dateStr)) {
    const date = parseDateTimeParts(dateStr);
    return date ? toUtcTimestamp(date) : Number.NaN;
  }

  const range = computeRange(dateStr, 'day');
  return boundary === 'start' ? range.start : range.end;
};

const formatProviderDateBoundary = (dateStr: string, boundary: 'start' | 'end'): string => {
  if (isDateTimeValue(dateStr)) {
    return dateStr;
  }

  return boundary === 'start' ? `${dateStr}T00:00:00Z` : `${dateStr}T23:59:59Z`;
};

const normalizeWorkflowFileName = (workflowName: string): string => {
  const parts = workflowName.split('/').filter(Boolean);
  return parts[parts.length - 1] || workflowName;
};

const buildGithubActionsMetricsFilters = (workflowName?: string, jobName?: string): string => {
  const filters = [
    workflowName ? `workflow_file_name:"${normalizeWorkflowFileName(workflowName)}"` : undefined,
    jobName ? `job_name:"${jobName}"` : undefined,
  ].filter((filter): filter is string => Boolean(filter));

  return filters.map((filter) => encodeURIComponent(filter)).join('+');
};

const buildGithubJobMetricsQuery = (
  filters: string,
  dateRange?: DateRange
): string => {
  if (!dateRange?.startDate || !dateRange?.endDate) {
    return `tab=jobs&filters=${filters}`;
  }

  const start = computeDateRangeBoundary(dateRange.startDate, 'start');
  const end = computeDateRangeBoundary(dateRange.endDate, 'end');
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return `tab=jobs&filters=${filters}`;
  }

  return `dateRangeType=DATE_RANGE_TYPE_CUSTOM&tab=jobs&filters=${filters}&range=${start}-${end}`;
};

/**
 * Create URL builder based on git provider
 */
export function createUrlBuilder(config: DashboardGlobalConfiguration): UrlBuilder {
  const provider = (config.git_provider || 'github').toLowerCase();
  
  if (provider.includes('gitlab')) {
    return createGitLabBuilder(config);
  }
  
  // Default to GitHub
  return createGitHubBuilder(config);
}

/**
 * GitHub URL builder
 */
function createGitHubBuilder(config: DashboardGlobalConfiguration): UrlBuilder {
  const [owner, repo] = config.github_repository.split('/').filter(Boolean);
  const baseUrl = `https://github.com/${owner}/${repo}`;

  return {
    getPRsUrl(filters) {
      const params: string[] = [];

      if (filters?.status) {
        params.push(`is:${filters.status}`);
      }
      if (filters?.author) {
        params.push(`author:@${filters.author}`);
      }
      if (filters?.label) {
        params.push(`label:"${filters.label}"`);
      }

      const query = params.join('+');
      return query ? `${baseUrl}/pulls?q=${query}` : `${baseUrl}/pulls`;
    },

    getPRUrl(prNumber) {
      return `${baseUrl}/pull/${prNumber}`;
    },

    getCommitUrl(hash) {
      return `${baseUrl}/commit/${hash}`;
    },

    getPipelinesUrl(filters) {
      // If filtering by workflow, link to the specific workflow file
      if (filters?.workflow) {
        const workflowFile = filters.workflow.endsWith('.yml') ? filters.workflow : `${filters.workflow}.yml`;
        return `${baseUrl}/actions/workflows/${workflowFile}`;
      }

      // Otherwise, link to actions with status filter if provided
      if (filters?.status) {
        return `${baseUrl}/actions?query=is%3A${encodeURIComponent(filters.status)}`;
      }

      return `${baseUrl}/actions`;
    },

    getPipelineRunUrl(runId) {
      return `${baseUrl}/actions/runs/${runId}`;
    },

    getJobRunsUrl(jobName, workflowName, dateRange) {
      const filters = buildGithubActionsMetricsFilters(workflowName, jobName);
      return `${baseUrl}/actions/metrics/performance?${buildGithubJobMetricsQuery(filters, dateRange)}`;
    },

    getWorkflowJobsMetricsUrl(workflowName, dateRange) {
      const filters = buildGithubActionsMetricsFilters(workflowName);
      return `${baseUrl}/actions/metrics/performance?${buildGithubJobMetricsQuery(filters, dateRange)}`;
    },

    getSonarqubeComponentUrl(componentKey) {
      if (!config.sonar_url || !config.sonar_project) {
        return '#';
      }
      return `${config.sonar_url}/code?id=${encodeURIComponent(config.sonar_project)}&selected=${encodeURIComponent(componentKey)}`;
    },

    getSonarqubeComponentMeasuresUrl(componentKey, metric) {
      if (!config.sonar_url || !config.sonar_project) {
        return '#';
      }
      return `${config.sonar_url}/component_measures?id=${encodeURIComponent(config.sonar_project)}&metric=${encodeURIComponent(metric)}&selected=${encodeURIComponent(componentKey)}`;
    },

    getSonarqubeProjectMeasuresUrl(metric) {
      if (!config.sonar_url || !config.sonar_project) {
        return '#';
      }
      return `${config.sonar_url}/component_measures?id=${encodeURIComponent(config.sonar_project)}&metric=${encodeURIComponent(metric)}`;
    },

    getSonarqubeProjectUrl() {
      if (!config.sonar_url || !config.sonar_project) {
        return '#';
      }
      return config.sonar_project
        ? `${config.sonar_url}/dashboard?id=${encodeURIComponent(config.sonar_project)}`
        : `${config.sonar_url}/dashboard`;
    },

    getActionPerformanceForJobUrl(jobName: string, workflowName: string, granularity: 'day' | 'week' | 'month', date: string, timezone?: string): string {
      void timezone;
      const range = computeRange(date, granularity);

      const filterParam = buildGithubActionsMetricsFilters(workflowName, jobName);
      const url = `https://github.com/${config.github_repository.replace(/\/$/, '')}/actions/metrics/usage?dateRangeType=DATE_RANGE_TYPE_CUSTOM&tab=jobs&filters=${filterParam}&range=${range.start}-${range.end}`;
      return url;
    }
  }
};

/**
 * GitLab URL builder
 */
function createGitLabBuilder(config: DashboardGlobalConfiguration): UrlBuilder {
  const [owner, repo] = config.github_repository.split('/').filter(Boolean);
  const baseUrl = config.gitlab_url || `https://gitlab.com/${owner}/${repo}`;
  
  return {
    getPRsUrl(filters) {
      const params: string[] = [];
      
      if (filters?.status === 'open') {
        params.push('state=opened');
      } else if (filters?.status === 'closed') {
        params.push('state=closed');
      } else if (filters?.status === 'merged') {
        params.push('state=merged');
      }
      
      if (filters?.author) {
        params.push(`author_username=${filters.author}`);
      }
      
      if (filters?.label) {
        params.push(`label_name[]=${encodeURIComponent(filters.label)}`);
      }
      
      const query = params.join('&');
      return query ? `${baseUrl}/-/merge_requests?${query}` : `${baseUrl}/-/merge_requests`;
    },
    
    getPRUrl(prNumber) {
      return `${baseUrl}/-/merge_requests/${prNumber}`;
    },
    
    getCommitUrl(hash) {
      return `${baseUrl}/-/commit/${hash}`;
    },
    
    getPipelinesUrl(filters) {
      const params: string[] = [];
      
      if (filters?.status) {
        params.push(`status=${filters.status}`);
      }
      if (filters?.workflow) {
        params.push(`ref=${encodeURIComponent(filters.workflow)}`);
      }
      
      const query = params.join('&');
      return query ? `${baseUrl}/-/pipelines?${query}` : `${baseUrl}/-/pipelines`;
    },
    
    getPipelineRunUrl(runId) {
      return `${baseUrl}/-/pipelines/${runId}`;
    },
    
    getJobRunsUrl(jobName, workflowName, dateRange) {
      const params = new URLSearchParams();
      params.set('scope[]', 'all');
      params.set('search', jobName);
      if (workflowName) {
        params.set('ref', workflowName);
      }
      if (dateRange?.startDate) {
        params.set('created_after', formatProviderDateBoundary(dateRange.startDate, 'start'));
      }
      if (dateRange?.endDate) {
        params.set('created_before', formatProviderDateBoundary(dateRange.endDate, 'end'));
      }

      return `${baseUrl}/-/jobs?${params.toString()}`;
    },

    getWorkflowJobsMetricsUrl(workflowName, dateRange) {
      const params = new URLSearchParams();
      params.set('scope[]', 'all');
      params.set('ref', workflowName);
      if (dateRange?.startDate) {
        params.set('created_after', formatProviderDateBoundary(dateRange.startDate, 'start'));
      }
      if (dateRange?.endDate) {
        params.set('created_before', formatProviderDateBoundary(dateRange.endDate, 'end'));
      }

      return `${baseUrl}/-/jobs?${params.toString()}`;
    },
    
    getSonarqubeComponentUrl(componentKey) {
      if (!config.sonar_url || !config.sonar_project) {
        return '#';
      }
      return `${config.sonar_url}/code?id=${encodeURIComponent(config.sonar_project)}&selected=${encodeURIComponent(componentKey)}`;
    },

    getSonarqubeComponentMeasuresUrl(componentKey, metric) {
      if (!config.sonar_url || !config.sonar_project) {
        return '#';
      }
      return `${config.sonar_url}/component_measures?id=${encodeURIComponent(config.sonar_project)}&metric=${encodeURIComponent(metric)}&selected=${encodeURIComponent(componentKey)}`;
    },

    getSonarqubeProjectMeasuresUrl(metric) {
      if (!config.sonar_url || !config.sonar_project) {
        return '#';
      }
      return `${config.sonar_url}/component_measures?id=${encodeURIComponent(config.sonar_project)}&metric=${encodeURIComponent(metric)}`;
    },
    
    getSonarqubeProjectUrl() {
      if (!config.sonar_url || !config.sonar_project) {
        return '#';
      }
      return config.sonar_url
        ? `${config.sonar_url}/dashboard?id=${encodeURIComponent(config.sonar_project)}`
        : `${config.sonar_url}/dashboard`;
    },

    getActionPerformanceForJobUrl(jobName: string, workflowName: string, granularity: 'day' | 'week' | 'month', date: string, timezone?: string): string {
      void timezone;
      const range = computeRange(date, granularity);
      const startIso = new Date(range.start).toISOString();
      const endIso = new Date(range.end).toISOString();

      const params = new URLSearchParams();
      params.set('scope[]', 'all');
      params.set('search', jobName);
      if (workflowName) {
        params.set('ref', workflowName);
      }
      params.set('created_after', startIso);
      params.set('created_before', endIso);

      return `${baseUrl}/-/jobs?${params.toString()}`;
    }

  };
};
