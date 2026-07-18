import { Logger } from '@smmachine/utils';
import * as path from 'path';
import { IRepository } from './repository';
import { Configuration } from './configuration';
import { SqliteRepository } from './sqlite-repository';

/**
 * Factory for creating IRepository<T> instances based on the configured storage type.
 *
 * Usage:
 *   const repo = RepositoryFactory.create<MyType>('/path/to/file.json', logger, config);
 */
export class RepositoryFactory {
  /**
   * Create a repository instance for the given configuration.
   *
   * @param filePath - Path to the storage location. For sqlite, this path becomes the
   * namespace inside the project database.
   * @param logger - Logger instance
   * @param config - Configuration containing internal.storageType
   * @returns An IRepository<T> implementation
   */
  static create<T>(filePath: string, logger: Logger, config: Configuration): IRepository<T> {
    const storageType = config.internal?.storageType ?? 'sqlite';
    if (storageType !== 'sqlite') {
      throw new Error(
        `Unsupported storage type: ${storageType}. Only sqlite repositories are supported.`
      );
    }

    return new SqliteRepository<T>(
      RepositoryFactory.getSqliteDatabasePath(config),
      RepositoryFactory.getSqliteNamespace(filePath, config),
      logger
    );
  }

  static getSqliteDatabasePath(config: Configuration): string {
    return path.join(RepositoryFactory.resolveBaseDirectory(config), 'smm.sqlite');
  }

  static getSqliteNamespace(filePath: string, config: Configuration): string {
    const baseDirectory = RepositoryFactory.resolveBaseDirectory(config);
    const relativePath = path.relative(baseDirectory, filePath);

    return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
      ? relativePath
      : filePath;
  }

  static getPipelineRunsRepositoryPath(config: Configuration): string {
    return path.join(config.getPathFromGitProvider(), 'pipeline-runs');
  }

  static getPipelineJobsRepositoryPath(config: Configuration): string {
    return path.join(config.getPathFromGitProvider(), 'pipeline-jobs');
  }

  static getPipelineRunsSqliteNamespace(config: Configuration): string {
    return RepositoryFactory.getSqliteNamespace(
      RepositoryFactory.getPipelineRunsRepositoryPath(config),
      config
    );
  }

  static getPipelineJobsSqliteNamespace(config: Configuration): string {
    return RepositoryFactory.getSqliteNamespace(
      RepositoryFactory.getPipelineJobsRepositoryPath(config),
      config
    );
  }

  private static resolveBaseDirectory(config: Configuration): string {
    const asUnknownConfig = config as unknown as {
      getBaseDirectory?: () => string;
      getSonarqubePath?: () => string;
      getCodeMaatPath?: () => string;
      getJiraPath?: () => string;
      getGitPath?: () => string;
      getPathFromGitProvider?: () => string;
      storeData?: string;
      gitProvider?: string;
      githubRepository?: string;
    };

    if (typeof asUnknownConfig.getBaseDirectory === 'function') {
      return asUnknownConfig.getBaseDirectory();
    }

    const providerPath = asUnknownConfig.getPathFromGitProvider?.();
    if (providerPath) {
      return path.dirname(providerPath);
    }

    const sonarqubePath = asUnknownConfig.getSonarqubePath?.();
    if (sonarqubePath) {
      return RepositoryFactory.resolveBaseFromDomainPath(sonarqubePath, 'sonarqube');
    }

    const codemaatPath = asUnknownConfig.getCodeMaatPath?.();
    if (codemaatPath) {
      return RepositoryFactory.resolveBaseFromDomainPath(codemaatPath, 'codemaat');
    }

    const jiraPath = asUnknownConfig.getJiraPath?.();
    if (jiraPath) {
      return RepositoryFactory.resolveBaseFromDomainPath(jiraPath, 'jira');
    }

    const gitPath = asUnknownConfig.getGitPath?.();
    if (gitPath) {
      return RepositoryFactory.resolveBaseFromDomainPath(gitPath, 'git');
    }

    if (asUnknownConfig.storeData) {
      const gitProvider = asUnknownConfig.gitProvider || 'github';
      const repoSlug = (asUnknownConfig.githubRepository || '').replace('/', '_');
      return path.join(asUnknownConfig.storeData, `${gitProvider}_${repoSlug}`);
    }

    throw new Error(
      'Unable to resolve SQLite base directory from configuration. Provide getBaseDirectory() or a path getter such as getSonarqubePath().'
    );
  }

  private static resolveBaseFromDomainPath(directoryPath: string, segment: string): string {
    const normalizedPath = path.normalize(directoryPath);
    return path.basename(normalizedPath) === segment
      ? path.dirname(normalizedPath)
      : normalizedPath;
  }
}
