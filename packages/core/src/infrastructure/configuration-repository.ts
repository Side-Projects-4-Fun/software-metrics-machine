import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@smmachine/utils';
import {
  Configuration,
  ConfigurableDeploymentFrequencyTarget,
  IConfiguration,
  ISmmConfigFile,
  ISmmProjectConfig,
  JsonObject,
  StorageType,
} from './configuration';

/**
 * Repository interface for accessing project configurations.
 * Provides a single source of truth for configuration data across the application.
 */
export interface IConfigurationRepository {
  /**
   * Returns the active Configuration instance for the current project.
   */
  getActiveConfiguration(): Configuration;

  /**
   * Creates a Configuration directly from a project entry.
   */
  fromProjectConfig(projectConfig: ISmmProjectConfig): Configuration;

  /**
   * Returns all project configurations from smm_config.json.
   */
  getAllProjects(): ISmmProjectConfig[];

  /**
   * Returns just the github_repository identifiers for all projects.
   */
  getAllProjectNames(): string[];

  /**
   * Finds a project configuration by github_repository.
   * @param repository - The github_repository value to find (e.g. "owner/repo")
   * @returns The project config if found, undefined otherwise
   */
  getProjectByRepository(repository: string): ISmmProjectConfig | undefined;

  /**
   * Alias for getProjectByRepository — finds a project by its name (github_repository).
   * @param name - The github_repository value to find
   */
  getProjectByName(name: string): ISmmProjectConfig | undefined;

  /**
   * Finds a project configuration by index.
   * @param index - The zero-based index of the project
   * @returns The project config if the index is valid, undefined otherwise
   */
  getProjectByIndex(index: number): ISmmProjectConfig | undefined;

  /**
   * Returns the root-level default GitHub token from smm_config.json.
   */
  getDefaultGithubToken(): string | undefined;

  /**
   * Persists changes to the active project configuration.
   */
  save(): void;
}

/**
 * Implementation of IConfigurationRepository that reads from smm_config.json.
 *
 * Requires the multi-project format { projects: [...] }.
 */
export class ConfigurationRepository implements IConfigurationRepository {
  private configuration: Configuration;
  private projects: ISmmProjectConfig[];
  private rawConfig: ISmmConfigFile;
  private activeProjectIndex: number;
  private configPath: string;
  private env: Record<string, string | undefined>;

  constructor(
    env: Record<string, string | undefined> = process.env,
    projectName: string | undefined,
    private logger: Logger
  ) {
    const envObj = env === process.env ? { ...env } : env;
    this.env = envObj;

    if (!envObj.SMM_STORE_DATA_AT) {
      throw new Error('SMM_STORE_DATA_AT is required to load configuration.');
    }

    this.configPath = path.resolve(`${envObj.SMM_STORE_DATA_AT}/smm_config.json`);
    this.rawConfig = this.loadRawConfig();
    this.projects = this.extractProjects();

    if (Array.isArray(this.rawConfig.projects) && this.projects.length === 0) {
      throw new Error('smm_config.json has empty projects array.');
    }

    this.activeProjectIndex =
      this.projects.length > 0 ? this.resolveActiveProjectIndex(projectName) : 0;

    if (this.projects.length > 0) {
      this.configuration = this.fromProjectConfig(this.projects[this.activeProjectIndex]);
    } else {
      this.configuration = this.fromRootConfig(this.rawConfig, projectName);
    }
  }

  getActiveConfiguration(): Configuration {
    return this.configuration;
  }

  fromProjectConfig(projectConfig: ISmmProjectConfig): Configuration {
    return this.buildConfiguration(projectConfig);
  }

  private fromRootConfig(configData: JsonObject, projectName?: string): Configuration {
    return this.buildConfiguration(configData, projectName);
  }

  private buildConfiguration(configData: JsonObject, projectName?: string): Configuration {
    const config = new Configuration();
    const repository = this.getString(configData, 'github_repository') || projectName;

    config.gitProvider =
      this.getString(configData, 'git_provider') || this.getProjectEnv(repository, 'GIT_PROVIDER');
    config.githubRepository = repository;
    config.githubToken =
      this.getProjectEnv(config.githubRepository, 'GITHUB_TOKEN') ||
      this.getString(configData, 'github_token') ||
      this.getDefaultGithubToken();
    config.gitlabToken =
      this.getString(configData, 'gitlab_token') || this.getProjectEnv(repository, 'GITLAB_TOKEN');
    config.storeData = this.env.SMM_STORE_DATA_AT!;
    config.gitRepositoryLocation =
      this.getString(configData, 'git_repository_location') ||
      this.getProjectEnv(repository, 'GIT_REPOSITORY_PATH') ||
      '';
    config.deploymentFrequencyTargets = this.normalizeDeploymentFrequencyTargets(configData);
    config.mainBranch = this.getString(configData, 'main_branch');
    config.dashboardStartDate = this.getString(configData, 'dashboard_start_date');
    config.dashboardEndDate = this.getString(configData, 'dashboard_end_date');
    config.dashboardColor = this.getString(configData, 'dashboard_color');

    let logLevel: string = 'CRITICAL';
    const configuredLogLevel = this.getString(configData, 'log_level');
    if (configuredLogLevel) {
      logLevel = configuredLogLevel;
    }
    const projectLogLevel = this.getProjectEnv(repository, 'LOGGING_LEVEL');
    if (projectLogLevel) {
      logLevel = projectLogLevel;
    }

    const VALID_LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
    if (!VALID_LOG_LEVELS.includes(logLevel)) {
      this.logger?.warn(
        `Invalid log level "${logLevel}". Valid values: ${VALID_LOG_LEVELS.join(', ')}. Falling back to CRITICAL.`
      );
      logLevel = 'CRITICAL';
    }

    config.loggingLevel = logLevel as IConfiguration['loggingLevel'];

    config.jiraUrl =
      this.getString(configData, 'jira_url') || this.getProjectEnv(repository, 'JIRA_URL');
    config.jiraEmail =
      this.getString(configData, 'jira_email') || this.getProjectEnv(repository, 'JIRA_EMAIL');
    config.jiraToken =
      this.getString(configData, 'jira_token') || this.getProjectEnv(repository, 'JIRA_TOKEN');
    config.jiraProject =
      this.getString(configData, 'jira_project') || this.getProjectEnv(repository, 'JIRA_PROJECT');
    config.sonarUrl =
      this.getString(configData, 'sonar_url') || this.getProjectEnv(repository, 'SONAR_URL');
    config.sonarToken =
      this.getString(configData, 'sonar_token') || this.getProjectEnv(repository, 'SONAR_TOKEN');
    config.sonarProject =
      this.getString(configData, 'sonar_project') ||
      this.getProjectEnv(repository, 'SONAR_PROJECT');
    config.sonarLocalRunnerToken = this.getString(configData, 'sonar_local_runner_token');
    config.storeLogs = this.resolveStoreLogs(configData, repository);
    config.timezone =
      this.getString(configData, 'timezone') ||
      this.getProjectEnv(repository, 'SMM_TIMEZONE') ||
      'UTC';
    config.internal = {
      storageType: this.resolveStorageType(configData, repository),
    };
    config.validate();

    return config;
  }

  getAllProjects(): ISmmProjectConfig[] {
    return this.projects;
  }

  getAllProjectNames(): string[] {
    return this.projects.map((p) => p.github_repository || '').filter(Boolean);
  }

  getProjectByRepository(repository: string): ISmmProjectConfig | undefined {
    return this.projects.find((p) => p.github_repository === repository);
  }

  getProjectByName(name: string): ISmmProjectConfig | undefined {
    return this.getProjectByRepository(name);
  }

  getProjectByIndex(index: number): ISmmProjectConfig | undefined {
    if (index < 0 || index >= this.projects.length) {
      return undefined;
    }
    return this.projects[index];
  }

  getDefaultGithubToken(): string | undefined {
    return typeof this.rawConfig.github_token === 'string'
      ? this.rawConfig.github_token
      : undefined;
  }

  private getProjectEnv(repository: string | undefined, envName: string): string | undefined {
    const normalizedRepository = this.normalizeRepositoryForEnv(repository);
    return normalizedRepository ? this.env[`${normalizedRepository}_${envName}`] : undefined;
  }

  private getProjectBooleanEnv(
    repository: string | undefined,
    envName: string
  ): boolean | undefined {
    const value = this.getProjectEnv(repository, envName)?.trim().toLowerCase();
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return undefined;
  }

  private normalizeRepositoryForEnv(repository: string | undefined): string | undefined {
    const normalizedRepository = repository
      ?.trim()
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();

    return normalizedRepository || undefined;
  }

  save(): void {
    const rawConfig = this.loadRawConfig();

    const projectUpdate: Partial<ISmmProjectConfig> = {
      sonar_local_runner_token: this.configuration.sonarLocalRunnerToken,
      internal: {
        storage_type: this.configuration.internal?.storageType,
      },
    };

    if (Array.isArray(rawConfig.projects) && rawConfig.projects[this.activeProjectIndex]) {
      Object.assign(rawConfig.projects[this.activeProjectIndex], projectUpdate);
    } else {
      const rootInternal = this.getJsonObject(rawConfig as JsonObject, 'internal') || {};
      (rawConfig as JsonObject).internal = {
        ...rootInternal,
        storage_type: this.configuration.internal?.storageType,
      };
    }

    fs.writeFileSync(this.configPath, JSON.stringify(rawConfig, null, 2), 'utf-8');
    this.rawConfig = rawConfig;
    this.projects = this.extractProjects();
    this.logger?.debug(`Configuration saved to file: ${this.configPath}`);
  }

  private loadRawConfig(): ISmmConfigFile {
    if (!fs.existsSync(this.configPath)) {
      return {};
    }

    const fileContent = fs.readFileSync(this.configPath, 'utf-8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(fileContent);
    } catch {
      throw new Error(`smm_config.json at ${this.configPath} is not valid JSON.`);
    }

    this.validateConfig(parsed, this.configPath);

    return parsed as ISmmConfigFile;
  }

  /**
   * Validates the structure of smm_config.json against the expected schema.
   * Throws descriptive errors if the structure does not comply.
   */
  private validateConfig(data: unknown, configPath: string): void {
    if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(
        `smm_config.json at ${configPath} must be a JSON object, got ${Array.isArray(data) ? 'array' : typeof data}.`
      );
    }

    const obj = data as JsonObject;

    this.validateInternalConfig(obj.internal, 'internal', configPath);

    // Validate projects field if present
    if ('projects' in obj) {
      if (!Array.isArray(obj.projects)) {
        throw new Error(
          `smm_config.json at ${configPath}: "projects" must be an array, got ${typeof obj.projects}.`
        );
      }

      for (let i = 0; i < obj.projects.length; i++) {
        const project = obj.projects[i];
        this.validateProject(project, i, configPath);
      }
    }
  }

  private validateInternalConfig(
    internalConfig: unknown,
    pathPrefix: string,
    configPath: string
  ): void {
    if (internalConfig === undefined || internalConfig === null) {
      return;
    }

    if (typeof internalConfig !== 'object' || Array.isArray(internalConfig)) {
      throw new Error(
        `smm_config.json at ${configPath}: ${pathPrefix} must be a JSON object, got ${Array.isArray(internalConfig) ? 'array' : typeof internalConfig}.`
      );
    }

    const obj = internalConfig as JsonObject;
    if ('storageType' in obj) {
      throw new Error(
        `smm_config.json at ${configPath}: ${pathPrefix}.storageType is not supported. Use ${pathPrefix}.storage_type instead.`
      );
    }

    const storageType = obj.storage_type;
    if (storageType !== undefined && storageType !== null && typeof storageType !== 'string') {
      throw new Error(
        `smm_config.json at ${configPath}: ${pathPrefix}.storage_type must be a string, got ${typeof storageType}.`
      );
    }
  }

  /**
   * Validates a single project entry within smm_config.json.
   */
  private validateProject(project: unknown, index: number, configPath: string): void {
    if (
      project === null ||
      project === undefined ||
      typeof project !== 'object' ||
      Array.isArray(project)
    ) {
      throw new Error(
        `smm_config.json at ${configPath}: projects[${index}] must be a JSON object, got ${Array.isArray(project) ? 'array' : typeof project}.`
      );
    }

    const obj = project as JsonObject;
    this.validateInternalConfig(obj.internal, `projects[${index}].internal`, configPath);

    const stringFields = [
      'git_provider',
      'github_token',
      'gitlab_token',
      'github_repository',
      'git_repository_location',
      'main_branch',
      'dashboard_start_date',
      'dashboard_end_date',
      'dashboard_color',
      'log_level',
      'jira_url',
      'jira_email',
      'jira_token',
      'jira_project',
      'sonar_url',
      'sonar_token',
      'sonar_project',
      'sonar_local_runner_token',
      'timezone',
    ];

    for (const field of stringFields) {
      if (
        field in obj &&
        obj[field] !== undefined &&
        obj[field] !== null &&
        typeof obj[field] !== 'string'
      ) {
        throw new Error(
          `smm_config.json at ${configPath}: projects[${index}].${field} must be a string, got ${typeof obj[field]}.`
        );
      }
    }

    // Validate store_logs is boolean if present
    if (
      'store_logs' in obj &&
      obj.store_logs !== undefined &&
      typeof obj.store_logs !== 'boolean'
    ) {
      throw new Error(
        `smm_config.json at ${configPath}: projects[${index}].store_logs must be a boolean, got ${typeof obj.store_logs}.`
      );
    }

    // Validate deployment_frequency_targets is array of objects with pipeline/job strings
    if ('deployment_frequency_targets' in obj && obj.deployment_frequency_targets !== undefined) {
      if (!Array.isArray(obj.deployment_frequency_targets)) {
        throw new Error(
          `smm_config.json at ${configPath}: projects[${index}].deployment_frequency_targets must be an array, got ${typeof obj.deployment_frequency_targets}.`
        );
      }

      for (let t = 0; t < obj.deployment_frequency_targets.length; t++) {
        const target = obj.deployment_frequency_targets[t];
        if (
          target === null ||
          target === undefined ||
          typeof target !== 'object' ||
          Array.isArray(target)
        ) {
          throw new Error(
            `smm_config.json at ${configPath}: projects[${index}].deployment_frequency_targets[${t}] must be an object, got ${Array.isArray(target) ? 'array' : typeof target}.`
          );
        }
        const targetObj = target as JsonObject;
        if (typeof targetObj.pipeline !== 'string') {
          throw new Error(
            `smm_config.json at ${configPath}: projects[${index}].deployment_frequency_targets[${t}].pipeline must be a string.`
          );
        }
        if (typeof targetObj.job !== 'string') {
          throw new Error(
            `smm_config.json at ${configPath}: projects[${index}].deployment_frequency_targets[${t}].job must be a string.`
          );
        }
      }
    }
  }

  private extractProjects(): ISmmProjectConfig[] {
    if (Array.isArray(this.rawConfig.projects)) {
      return this.rawConfig.projects;
    }

    // No config file or missing projects array
    return [];
  }

  private resolveActiveProjectIndex(projectName?: string): number {
    if (!projectName) {
      return 0;
    }
    const found = this.projects.findIndex((p) => p.github_repository === projectName);
    if (found === -1) {
      throw new Error(
        `Project "${projectName}" not found. Available: ${this.projects.map((p) => p.github_repository || '(unnamed)').join(', ')}`
      );
    }
    return found;
  }

  private normalizeDeploymentFrequencyTargets(
    configData: JsonObject
  ): ConfigurableDeploymentFrequencyTarget[] | undefined {
    const configuredTargets = configData.deployment_frequency_targets;

    if (Array.isArray(configuredTargets)) {
      const targets = configuredTargets
        .map((target): ConfigurableDeploymentFrequencyTarget | null => {
          if (!target || typeof target !== 'object' || Array.isArray(target)) {
            return null;
          }

          const pipeline = typeof target.pipeline === 'string' ? target.pipeline.trim() : '';
          const job = typeof target.job === 'string' ? target.job.trim() : '';

          return pipeline && job ? { pipeline, job } : null;
        })
        .filter((target): target is ConfigurableDeploymentFrequencyTarget => target !== null);

      return targets.length > 0 ? targets : undefined;
    }

    return undefined;
  }

  private getString(configData: JsonObject | undefined, key: string): string | undefined {
    const value = configData?.[key];
    return typeof value === 'string' ? value : undefined;
  }

  private getJsonObject(configData: JsonObject, key: string): JsonObject | undefined {
    const value = configData[key];
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
  }

  private resolveStoreLogs(
    configData: JsonObject,
    repository: string | undefined
  ): boolean | undefined {
    if (typeof configData.store_logs === 'boolean') {
      return configData.store_logs;
    }

    if (typeof configData.STORE_LOGS === 'boolean') {
      return configData.STORE_LOGS;
    }

    return this.getProjectBooleanEnv(repository, 'STORE_LOGS');
  }

  private resolveStorageType(configData: JsonObject, repository: string | undefined): StorageType {
    const projectInternalConfig = this.getJsonObject(configData, 'internal');
    const rootInternalConfig =
      configData === this.rawConfig ? undefined : this.getJsonObject(this.rawConfig, 'internal');
    const storageType =
      this.getConfiguredStorageType(projectInternalConfig) ||
      this.getConfiguredStorageType(rootInternalConfig) ||
      this.getProjectEnv(repository, 'SMM_STORAGE_TYPE') ||
      'json';

    return storageType as StorageType;
  }

  private getConfiguredStorageType(configData: JsonObject | undefined): string | undefined {
    return this.getString(configData, 'storage_type');
  }
}
