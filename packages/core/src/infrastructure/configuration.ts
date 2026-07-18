import * as path from 'path';

export type StorageType = 'json' | 'sqlite';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface InternalConfiguration {
  /**
   * Storage backend type for repository persistence.
   * - 'json' (default): JSON files on disk
   * - 'sqlite': SQLite database
   */
  storageType: StorageType;
}

export interface IConfiguration {
  /**
   * Git provider (github, gitlab)
   */
  gitProvider?: string;

  /**
   * GitHub API token for authentication
   */
  githubToken?: string;

  /**
   * GitLab API token for authentication
   */
  gitlabToken?: string;

  /**
   * GitHub repository in format owner/repo
   */
  githubRepository?: string;

  /**
   * Path to store data
   */
  storeData: string;

  /**
   * Git repository location (local path)
   */
  gitRepositoryLocation?: string;

  /**
   * Target workflows and jobs for deployment frequency
   */
  deploymentFrequencyTargets?: ConfigurableDeploymentFrequencyTarget[];

  /**
   * Main branch name
   */
  mainBranch?: string;

  /**
   * Dashboard start date
   */
  dashboardStartDate?: string;

  /**
   * Dashboard end date
   */
  dashboardEndDate?: string;

  /**
   * Dashboard color (hex)
   */
  dashboardColor?: string;

  /**
   * Log level (DEBUG, INFO, WARN, ERROR, CRITICAL)
   */
  loggingLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

  /**
   * Jira URL
   */
  jiraUrl?: string;

  /**
   * Jira email
   */
  jiraEmail?: string;

  /**
   * Jira API token for authentication
   */
  jiraToken?: string;

  /**
   * Jira project key
   */
  jiraProject?: string;

  /**
   * SonarQube server URL
   */
  sonarUrl?: string;

  /**
   * SonarQube authentication token
   */
  sonarToken?: string;

  /**
   * SonarQube project key
   */
  sonarProject?: string;

  /**
   * SonarQube local analysis runner token (generated and persisted by local analysis)
   */
  sonarLocalRunnerToken?: string;

  storeLogs?: boolean;

  /**
   * IANA timezone identifier (e.g. "Europe/Madrid", "UTC")
   */
  timezone?: string;

  /**
   * Internal configuration for developer-only settings.
   * Controls internal behavior like storage backend selection.
   */
  internal?: InternalConfiguration;
}

export interface ConfigurableDeploymentFrequencyTarget extends JsonObject {
  pipeline: string;
  job: string;
}

export interface ISmmInternalConfig extends JsonObject {
  storage_type?: StorageType;
}

/**
 * Shape of a single project entry in smm_config.json
 */
export interface ISmmProjectConfig extends JsonObject {
  git_provider?: string;
  github_token?: string;
  gitlab_token?: string;
  github_repository?: string;
  git_repository_location?: string;
  deployment_frequency_targets?: ConfigurableDeploymentFrequencyTarget[];
  main_branch?: string;
  dashboard_start_date?: string;
  dashboard_end_date?: string;
  dashboard_color?: string;
  log_level?: string;
  jira_url?: string;
  jira_email?: string;
  jira_token?: string;
  jira_project?: string;
  sonar_url?: string;
  sonar_token?: string;
  sonar_project?: string;
  sonar_local_runner_token?: string;
  store_logs?: boolean;
  timezone?: string;
  internal?: ISmmInternalConfig;
}

/**
 * Shape of smm_config.json with multi-project support
 */
export interface ISmmConfigFile extends JsonObject {
  github_token?: string;
  projects?: ISmmProjectConfig[];
}

/**
 * Runtime configuration values.
 *
 * Loading and persistence belong to ConfigurationRepository.
 */
export class Configuration implements IConfiguration {
  gitProvider?: string;
  githubToken?: string;
  gitlabToken?: string;
  githubRepository?: string;
  storeData = '';
  gitRepositoryLocation = '';
  deploymentFrequencyTargets?: ConfigurableDeploymentFrequencyTarget[];
  mainBranch?: string;
  dashboardStartDate?: string;
  dashboardEndDate?: string;
  dashboardColor?: string;
  loggingLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' = 'CRITICAL';
  jiraUrl?: string;
  jiraEmail?: string;
  jiraToken?: string;
  jiraProject?: string;
  sonarUrl?: string;
  sonarToken?: string;
  sonarProject?: string;
  sonarLocalRunnerToken?: string;
  storeLogs?: boolean;
  timezone?: string;
  internal: InternalConfiguration = { storageType: 'sqlite' };

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
