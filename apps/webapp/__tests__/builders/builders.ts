import type { DashboardGlobalConfiguration } from '@/server/api/configuration';
import type { SavedFilterEntry, DashboardSection } from '@/components/filters/saved-filters-store';
import type { ReportEntry, ReportSectionRef, ReportDateWindow } from '@/components/reports/reports-store';
import { defaultFilters, type DashboardFilters } from '@/components/filters/DashboardFilters';

export class DashboardConfigurationBuilder {
  private data: DashboardGlobalConfiguration = {
    git_provider: 'github',
    github_repository: 'owner/repo',
    git_repository_location: '/tmp/repo',
    store_data: false,
    deployment_frequency_targets: [],
    main_branch: 'main',
    dashboard_start_date: null,
    dashboard_end_date: null,
    dashboard_color: '#1976d2',
    logging_level: 'info',
    jira_url: null,
    jira_email: null,
    jira_token: null,
    jira_project: null,
    sonar_url: null,
    sonar_project: null,
  };

  withGitProvider(provider: string): this {
    this.data.git_provider = provider;
    return this;
  }

  withGithubRepository(repo: string): this {
    this.data.github_repository = repo;
    return this;
  }

  withGitlabUrl(url: string): this {
    this.data.gitlab_url = url;
    return this;
  }

  withGitRepositoryLocation(location: string): this {
    this.data.git_repository_location = location;
    return this;
  }

  withStoreData(store: boolean): this {
    this.data.store_data = store;
    return this;
  }

  withDeploymentFrequencyTargets(targets: Array<{ pipeline: string; job: string }>): this {
    this.data.deployment_frequency_targets = targets;
    return this;
  }

  withMainBranch(branch: string): this {
    this.data.main_branch = branch;
    return this;
  }

  withDashboardStartDate(date: string | null): this {
    this.data.dashboard_start_date = date;
    return this;
  }

  withDashboardEndDate(date: string | null): this {
    this.data.dashboard_end_date = date;
    return this;
  }

  withDashboardColor(color: string): this {
    this.data.dashboard_color = color;
    return this;
  }

  withLoggingLevel(level: string): this {
    this.data.logging_level = level;
    return this;
  }

  withSonarQube(url: string, project: string): this {
    this.data.sonar_url = url;
    this.data.sonar_project = project;
    return this;
  }

  withJira(url: string, email: string, token: string, project: string): this {
    this.data.jira_url = url;
    this.data.jira_email = email;
    this.data.jira_token = token;
    this.data.jira_project = project;
    return this;
  }

  build(): DashboardGlobalConfiguration {
    return { ...this.data };
  }
}

export class SavedFilterBuilder {
  private data: SavedFilterEntry = {
    id: 'filter-1',
    name: 'Test Filter',
    section: 'pipelines',
    pathname: '/dashboard/pipelines',
    filters: { ...defaultFilters },
    repository: 'owner/repo',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withSection(section: DashboardSection): this {
    this.data.section = section;
    this.data.pathname = `/dashboard/${section}`;
    return this;
  }

  withPathname(pathname: string): this {
    this.data.pathname = pathname;
    return this;
  }

  withFilters(filters: Partial<DashboardFilters>): this {
    this.data.filters = { ...defaultFilters, ...filters };
    return this;
  }

  withRepository(repository: string): this {
    this.data.repository = repository;
    return this;
  }

  withCreatedAt(createdAt: string): this {
    this.data.createdAt = createdAt;
    return this;
  }

  build(): SavedFilterEntry {
    return { ...this.data, filters: { ...this.data.filters } };
  }
}

export class ReportEntryBuilder {
  private data: ReportEntry = {
    id: 'report-1',
    name: 'Test Report',
    repository: 'owner/repo',
    sections: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withRepository(repository: string): this {
    this.data.repository = repository;
    return this;
  }

  withSections(sections: ReportSectionRef[]): this {
    this.data.sections = sections;
    return this;
  }

  withStartDateOverride(date: string): this {
    this.data.startDateOverride = date;
    return this;
  }

  withEndDateOverride(date: string): this {
    this.data.endDateOverride = date;
    return this;
  }

  withDateWindows(windows: ReportDateWindow[]): this {
    this.data.dateWindows = windows;
    return this;
  }

  withCreatedAt(createdAt: string): this {
    this.data.createdAt = createdAt;
    return this;
  }

  build(): ReportEntry {
    return { ...this.data, sections: [...this.data.sections] };
  }
}

export class DashboardFiltersBuilder {
  private data: DashboardFilters = { ...defaultFilters };

  withStartDate(date: string): this {
    this.data.startDate = date;
    return this;
  }

  withEndDate(date: string): this {
    this.data.endDate = date;
    return this;
  }

  withWorkflowSelector(workflow: string): this {
    this.data.workflowSelector = workflow;
    return this;
  }

  withWorkflowStatus(status: string[]): this {
    this.data.workflowStatus = status;
    return this;
  }

  withWorkflowConclusions(conclusions: string[]): this {
    this.data.workflowConclusions = conclusions;
    return this;
  }

  withAuthorSelect(authors: string[]): this {
    this.data.authorSelect = authors;
    return this;
  }

  withLabelSelector(labels: string[]): this {
    this.data.labelSelector = labels;
    return this;
  }

  withAggregateBy(aggregateBy: string): this {
    this.data.aggregateBy = aggregateBy;
    return this;
  }

  withTopEntries(count: number): this {
    this.data.topEntries = count;
    return this;
  }

  withIgnorePatternFiles(pattern: string): this {
    this.data.ignorePatternFiles = pattern;
    return this;
  }

  withIncludePatternFiles(pattern: string): this {
    this.data.includePatternFiles = pattern;
    return this;
  }

  withAuthorSelectSourceCode(authors: string[]): this {
    this.data.authorSelectSourceCode = authors;
    return this;
  }

  withTypeChurn(type: string): this {
    this.data.typeChurn = type;
    return this;
  }

  withAggregateMetric(metric: string): this {
    this.data.aggregateMetric = metric;
    return this;
  }

  withTimezone(timezone: string): this {
    this.data.timezone = timezone;
    return this;
  }

  withMetric(metric: string): this {
    this.data.metric = metric;
    return this;
  }

  withCategory(category: string): this {
    this.data.category = category;
    return this;
  }

  withRawFilters(rawFilters: string): this {
    this.data.rawFilters = rawFilters;
    return this;
  }

  withPeriod(period: DashboardFilters['period']): this {
    this.data.period = period;
    return this;
  }

  withCompareDates(start: string, end: string): this {
    this.data.compareStartDate = start;
    this.data.compareEndDate = end;
    return this;
  }

  withOutlierMode(mode: 'include' | 'flag' | 'exclude'): this {
    this.data.outlierMode = mode;
    return this;
  }

  withWeekends(weekends: 'include' | 'exclude' | 'weekends_only'): this {
    this.data.weekends = weekends;
    return this;
  }

  withMethod(method: string): this {
    this.data.method = method;
    return this;
  }

  withSonarqubeRemoveFolders(remove: boolean): this {
    this.data.sonarqubeRemoveFolders = remove;
    return this;
  }

  build(): DashboardFilters {
    return { ...this.data };
  }
}
