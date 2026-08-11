import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { Configuration } from '../../infrastructure';
import type { Logger } from '@smmachine/utils';

export interface GitCloneResult {
  /** The absolute path that now holds a cloned repository. */
  repositoryPath: string;
  /** `true` when a clone was performed, `false` when the repository was already present. */
  cloned: boolean;
  /** Remote URL used for the clone. Empty when no clone was performed. */
  cloneUrl: string;
}

/**
 * Describes how to build a clone URL for a single git provider.
 *
 * Each registered provider knows how to read its base URL and token from the active
 * configuration. New providers are added by appending an entry to
 * {@link GIT_CLONE_PROVIDERS} — no changes to {@link GitCloneService} are required.
 */
export interface GitCloneProvider {
  /** Provider identifier, matching the `git_provider` configuration key (lowercase). */
  id: string;
  /**
   * Resolves the base URL for the provider from the active configuration, without a
   * trailing slash. For self-hosted providers this may read an instance URL field.
   */
  resolveBaseUrl(configuration: Configuration): string;
  /** Returns the provider authentication token from the configuration, or undefined. */
  resolveToken(configuration: Configuration): string | undefined;
}

const GITHUB_DEFAULT_BASE = 'https://github.com';
const GITLAB_DEFAULT_BASE = 'https://gitlab.com';

/**
 * Registry of supported git providers for cloning.
 *
 * Add new providers here to teach the clone flow about them.
 */
export const GIT_CLONE_PROVIDERS: GitCloneProvider[] = [
  {
    id: 'github',
    resolveBaseUrl: () => GITHUB_DEFAULT_BASE,
    resolveToken: (configuration) => configuration.githubToken,
  },
  {
    id: 'gitlab',
    resolveBaseUrl: (configuration) =>
      (configuration.gitlabUrl || GITLAB_DEFAULT_BASE).replace(/\/+$/, ''),
    resolveToken: (configuration) => configuration.gitlabToken,
  },
];

/**
 * Clones a git repository from the configured provider into a local path.
 *
 * The clone URL is derived from the active project configuration using the registered
 * providers in {@link GIT_CLONE_PROVIDERS}. Authentication uses the provider token when
 * available, embedded in the clone URL so the clone works for private repositories.
 * Tokens are never logged.
 */
export class GitCloneService {
  constructor(
    private configuration: Configuration,
    private logger: Logger
  ) {}

  /**
   * Clones the repository into {@link targetPath} when that path is not already a git
   * repository. The parent directory of {@link targetPath} is created when missing.
   *
   * @returns the clone result. When the path already holds a git repository no clone is
   *   performed and `cloned` is `false`.
   */
  async cloneInto(targetPath: string): Promise<GitCloneResult> {
    const absolutePath = path.resolve(targetPath);

    if (this.isGitRepository(absolutePath)) {
      this.logger.info(`Repository already cloned at ${absolutePath}`);
      return { repositoryPath: absolutePath, cloned: false, cloneUrl: '' };
    }

    const cloneUrl = this.buildCloneUrl();
    this.logger.info(`Cloning repository from ${this.redactUrl(cloneUrl)} into ${absolutePath}`);

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

    execFileSync('git', ['clone', cloneUrl, absolutePath], {
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 300000,
    });

    this.logger.info(`Repository cloned to ${absolutePath}`);
    return { repositoryPath: absolutePath, cloned: true, cloneUrl };
  }

  private isGitRepository(directoryPath: string): boolean {
    if (!fs.existsSync(directoryPath)) {
      return false;
    }

    const stats = fs.statSync(directoryPath);
    if (!stats.isDirectory()) {
      return false;
    }

    return fs.existsSync(path.join(directoryPath, '.git'));
  }

  private buildCloneUrl(): string {
    const repository = this.configuration.githubRepository;
    if (!repository || !repository.includes('/')) {
      throw new Error(
        'GITHUB_REPOSITORY is required in owner/repo format to clone the repository.'
      );
    }

    const providerId = (this.configuration.gitProvider || 'github').toLowerCase();
    const provider = GIT_CLONE_PROVIDERS.find((entry) => entry.id === providerId);
    if (!provider) {
      throw new Error(
        `Unsupported git provider "${providerId}" for cloning. Supported providers: ${GIT_CLONE_PROVIDERS.map(
          (entry) => entry.id
        ).join(', ')}.`
      );
    }

    const base = provider.resolveBaseUrl(this.configuration);
    const token = provider.resolveToken(this.configuration);
    const publicUrl = `${base}/${repository}.git`;

    return token ? this.embedToken(publicUrl, token) : publicUrl;
  }

  private embedToken(publicUrl: string, token: string): string {
    return publicUrl.replace('https://', `https://${token}@`);
  }

  private redactUrl(url: string): string {
    return url.replace(/:\/\/[^@]+@/, '://***@');
  }
}
