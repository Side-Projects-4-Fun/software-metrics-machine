import type { Configuration } from '../infrastructure/configuration';

/**
 * Builder for creating test configuration objects.
 * Replaces `{ getPathFromGitProvider: () => '/tmp' } as any` patterns in tests.
 *
 * Produces an object that is structurally compatible with the `Configuration`
 * class used by fetch repositories and services.
 *
 * Usage:
 *   const config = new TestConfigurationBuilder()
 *     .withGetPathFromGitProvider('/tmp')
 *     .build();
 *
 *   const repository = new PipelinesFetchRepository(config, client, store);
 *
 * If the test needs additional properties not covered by the builder methods,
 * use withExtra():
 *   const config = new TestConfigurationBuilder()
 *     .withGetPathFromGitProvider('/tmp')
 *     .withExtra('gitProvider', 'github')
 *     .build();
 */
export class TestConfigurationBuilder {
  private config: Record<string, unknown> = {
    getPathFromGitProvider: () => '/tmp',
    internal: { storageType: 'json' },
  };

  /** Sets the return value of `getPathFromGitProvider()` (default: `'/tmp'`). */
  withGetPathFromGitProvider(path: string): this {
    this.config.getPathFromGitProvider = () => path;
    return this;
  }

  /**
   * Sets the internal storage type (default: `'json'`).
   */
  withStorageType(storageType: 'json' | 'sqlite'): this {
    this.config.internal = { storageType };
    return this;
  }

  /**
   * Sets an arbitrary property on the configuration object.
   * Use this when a test needs a property not covered by the dedicated builder methods.
   */
  withExtra(key: string, value: unknown): this {
    this.config[key] = value;
    return this;
  }

  /** Returns a plain object cast to Configuration for use in constructor parameters. */
  build(): Configuration {
    return this.config as unknown as Configuration;
  }
}
