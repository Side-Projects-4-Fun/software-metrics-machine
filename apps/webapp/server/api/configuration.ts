import { fetchAPI } from './client';

export interface DashboardGlobalConfiguration {
  git_provider: string;
  github_repository: string;
  gitlab_url?: string;
  git_repository_location: string;
  store_data: boolean;
  deployment_frequency_targets: Array<{ pipeline: string; job: string }>;
  main_branch: string;
  dashboard_start_date: string | null;
  dashboard_end_date: string | null;
  dashboard_color: string;
  logging_level: string;
  jira_url: string | null;
  jira_email: string | null;
  jira_token: string | null;
  jira_project: string | null;
  sonar_url: string | null;
  sonar_project: string | null;
}

export interface DashboardConfiguration {
  result: DashboardGlobalConfiguration;
}

export interface ProjectItem {
  github_repository: string;
}

export interface ProjectsListResponse {
  result: ProjectItem[];
}

export const configurationAPI = {
  getConfiguration: () =>
    fetchAPI<DashboardConfiguration>('/configuration'),
};

export const projectsAPI = {
  getProjects: () =>
    fetchAPI<ProjectsListResponse>('/projects'),
};
