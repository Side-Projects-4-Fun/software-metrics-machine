import { Logger } from '@smmachine/utils';
import * as path from 'path';
import { IRepository } from './repository';
import { JsonFileSystemRepository } from './repository';
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
  static create<T>(
    filePath: string,
    logger: Logger,
    config: Configuration
  ): IRepository<T> {
    const storageType = config.internal?.storageType ?? 'json';
    switch (storageType) {
      case 'json':
        return new JsonFileSystemRepository<T>(filePath, logger);
      case 'sqlite':
        return new SqliteRepository<T>(
          RepositoryFactory.getSqliteDatabasePath(config),
          RepositoryFactory.getSqliteNamespace(filePath, config),
          logger
        );
      default:
        throw new Error(
          `Unknown storage type: ${storageType}. Supported types: json, sqlite`
        );
    }
  }

  static getSqliteDatabasePath(config: Configuration): string {
    return path.join(config.getBaseDirectory(), 'smm.sqlite');
  }

  static getSqliteNamespace(filePath: string, config: Configuration): string {
    const baseDirectory = config.getBaseDirectory();
    const relativePath = path.relative(baseDirectory, filePath);

    return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
      ? relativePath
      : filePath;
  }
}
