import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { Configuration } from '../../infrastructure';
import type { Logger } from '@smmachine/utils';

export interface GitCloneResult {
  repositoryPath: string;

  cloned: boolean;

  cloneUrl: string;
}

export interface GitCloneProvider {
  id: string;

  resolveBaseUrl(configuration: Configuration): string;

  resolveToken(configuration: Configuration): string | undefined;
}

const GITHUB_DEFAULT_BASE = 'https://github.com';
const GITLAB_DEFAULT_BASE = 'https://gitlab.com';

export interface GitCloneFileSystem {
  existsSync(path: string): boolean;

  statSync(path: string): { isDirectory(): boolean };

  mkdirSync(path: string, options: { recursive: true }): unknown;
}

export interface GitCloneServiceDependencies {
  execFileSync(
    file: string,
    args: readonly string[],
    options: { stdio: ('ignore' | 'pipe' | 'inherit')[]; timeout: number }
  ): unknown;

  fileSystem: GitCloneFileSystem;
}

export const defaultGitCloneServiceDependencies: GitCloneServiceDependencies = {
  execFileSync: (file, args, options) => execFileSync(file, args, options),
  fileSystem: {
    existsSync: (targetPath) => fs.existsSync(targetPath),
    statSync: (targetPath) => fs.statSync(targetPath),
    mkdirSync: (targetPath, options) => fs.mkdirSync(targetPath, options),
  },
};

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

export class GitCloneService {
  private dependencies: GitCloneServiceDependencies;

  constructor(
    private configuration: Configuration,
    private logger: Logger,
    dependencies: GitCloneServiceDependencies = defaultGitCloneServiceDependencies
  ) {
    this.dependencies = dependencies;
  }

  async cloneInto(targetPath: string): Promise<GitCloneResult> {
    const absolutePath = path.resolve(targetPath);

    if (this.isGitRepository(absolutePath)) {
      this.logger.info(`Repository already cloned at ${absolutePath}`);
      return { repositoryPath: absolutePath, cloned: false, cloneUrl: '' };
    }

    const cloneUrl = this.buildCloneUrl();
    this.logger.info(`Cloning repository from ${this.redactUrl(cloneUrl)} into ${absolutePath}`);

    this.dependencies.fileSystem.mkdirSync(path.dirname(absolutePath), { recursive: true });

    this.dependencies.execFileSync('git', ['clone', cloneUrl, absolutePath], {
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 300000,
    });

    this.logger.info(`Repository cloned to ${absolutePath}`);
    return { repositoryPath: absolutePath, cloned: true, cloneUrl };
  }

  private isGitRepository(directoryPath: string): boolean {
    if (!this.dependencies.fileSystem.existsSync(directoryPath)) {
      return false;
    }

    const stats = this.dependencies.fileSystem.statSync(directoryPath);
    if (!stats.isDirectory()) {
      return false;
    }

    return this.dependencies.fileSystem.existsSync(path.join(directoryPath, '.git'));
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
