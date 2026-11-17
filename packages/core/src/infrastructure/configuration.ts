import * as path from 'path';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface IConfiguration {
  gitProvider?: string;

  githubToken?: string;

  gitlabToken?: string;

  gitlabUrl?: string;

  githubRepository?: string;

  storeData: string;

  gitRepositoryLocation?: string;

  deploymentFrequencyTargets?: ConfigurableDeploymentFrequencyTarget[];

  mainBranch?: string;

  dashboardStartDate?: string;

  dashboardEndDate?: string;

  loggingLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

  jiraUrl?: string;

  jiraEmail?: string;

  jiraToken?: string;

  jiraProject?: string;

  issuesProvider?: 'jira' | 'github' | 'jira-csv';

  sonarUrl?: string;

  sonarToken?: string;

  sonarProject?: string;

  sonarLocalRunnerToken?: string;

  storeLogs?: boolean;

  timezone?: string;
}

export interface ConfigurableDeploymentFrequencyTarget extends JsonObject {
  pipeline: string;
  job: string;
}

export interface ISmmProjectConfig extends JsonObject {
  git_provider?: string;
  github_token?: string;
  gitlab_token?: string;
  gitlab_url?: string;
  github_repository?: string;
  git_repository_location?: string;
  deployment_frequency_targets?: ConfigurableDeploymentFrequencyTarget[];
  main_branch?: string;
  dashboard_start_date?: string;
  dashboard_end_date?: string;
  log_level?: string;
  jira_url?: string;
  jira_email?: string;
  jira_token?: string;
  jira_project?: string;
  issues_provider?: string;
  sonar_url?: string;
  sonar_token?: string;
  sonar_project?: string;
  sonar_local_runner_token?: string;
  store_logs?: boolean;
  timezone?: string;
}

export interface ISmmConfigFile extends JsonObject {
  github_token?: string;
  projects?: ISmmProjectConfig[];
}

export class Configuration implements IConfiguration {
  gitProvider?: string;
  githubToken?: string;
  gitlabToken?: string;
  gitlabUrl?: string;
  githubRepository?: string;
  storeData = '';
  gitRepositoryLocation = '';
  deploymentFrequencyTargets?: ConfigurableDeploymentFrequencyTarget[];
  mainBranch?: string;
  dashboardStartDate?: string;
  dashboardEndDate?: string;
  loggingLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' = 'CRITICAL';
  jiraUrl?: string;
  jiraEmail?: string;
  jiraToken?: string;
  jiraProject?: string;
  issuesProvider?: 'jira' | 'github' | 'jira-csv';
  sonarUrl?: string;
  sonarToken?: string;
  sonarProject?: string;
  sonarLocalRunnerToken?: string;
  storeLogs?: boolean;
  timezone?: string;

  constructor(values: Partial<IConfiguration> = {}) {
    Object.assign(this, values);
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.gitRepositoryLocation) {
      errors.push('GIT_REPOSITORY_LOCATION is required');
    }

    if (this.gitProvider && ['github', 'gitlab'].includes(this.gitProvider.toLowerCase())) {
      if (!this.githubRepository) {
        errors.push('GITHUB_REPOSITORY is required (format: owner/repo)');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  getBaseDirectory(): string {
    if (!this.storeData) {
      throw new Error('STORE_DATA_AT is not set');
    }

    const baseDir = this.storeData;
    const gitProvider = this.gitProvider || 'github';
    const repoSlug = (this.githubRepository || '').replace('/', '_');
    return path.join(baseDir, `${gitProvider}_${repoSlug}`);
  }

  getLogPath(): string {
    return path.join(this.getBaseDirectory(), 'smm.log');
  }

  getDeploymentFrequencyTargets(): ConfigurableDeploymentFrequencyTarget[] {
    return this.deploymentFrequencyTargets || [];
  }

  getCodeMaatPath(): string {
    return path.join(this.getBaseDirectory(), 'codemaat');
  }

  getSonarqubePath(): string {
    return path.join(this.getBaseDirectory(), 'sonarqube');
  }

  getJiraPath(): string {
    return path.join(this.getBaseDirectory(), 'jira');
  }

  getIssuesPath(): string {
    return path.join(this.getBaseDirectory(), this.issuesProvider || 'jira');
  }

  getJiraCsvPath(): string {
    return path.join(this.getBaseDirectory(), 'Jira.csv');
  }

  getPathFromGitProvider(): string {
    const gitProvider = this.gitProvider || 'github';
    return path.join(this.getBaseDirectory(), gitProvider);
  }

  getGitPath(): string {
    return path.join(this.getBaseDirectory(), 'git');
  }

  getArchitecturePath(): string {
    return path.join(this.getBaseDirectory(), 'architecture');
  }
}
