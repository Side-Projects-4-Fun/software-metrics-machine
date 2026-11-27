import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Configuration } from '../../../infrastructure/configuration';
import {
  GitCloneService,
  GIT_CLONE_PROVIDERS,
  type GitCloneFileSystem,
  type GitCloneServiceDependencies,
} from '../git-clone-service';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

const mockExecFileSync = vi.fn<GitCloneServiceDependencies['execFileSync']>();
const mockExistsSync = vi.fn<GitCloneFileSystem['existsSync']>();
const mockStatSync = vi.fn<GitCloneFileSystem['statSync']>();
const mockMkdirSync = vi.fn<GitCloneFileSystem['mkdirSync']>();

const dependencies: GitCloneServiceDependencies = {
  execFileSync: mockExecFileSync,
  fileSystem: {
    existsSync: mockExistsSync,
    statSync: mockStatSync,
    mkdirSync: mockMkdirSync,
  },
};

const logger = new MockLoggerBuilder().build();

function buildConfiguration(values: Partial<Configuration>): Configuration {
  return new Configuration({
    storeData: '/data/smm',
    gitProvider: 'github',
    githubRepository: 'acme/widgets',
    ...values,
  });
}

function buildService(values: Partial<Configuration>): GitCloneService {
  return new GitCloneService(buildConfiguration(values), logger, dependencies);
}

describe('GitCloneService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFileSync.mockReturnValue(Buffer.from(''));
    mockMkdirSync.mockReturnValue(undefined);
  });

  describe('cloneInto', () => {
    it('skips cloning when the target path is already a git repository', async () => {
      mockExistsSync.mockImplementation((targetPath: string) => {
        if (targetPath === '/data/repos/widgets' || targetPath === '/data/repos/widgets/.git') {
          return true;
        }
        return false;
      });
      const dirStats = { isDirectory: (): boolean => true };
      mockStatSync.mockReturnValue(dirStats);

      const service = buildService({});
      const result = await service.cloneInto('/data/repos/widgets');

      expect(result.cloned).toBe(false);
      expect(result.repositoryPath).toBe('/data/repos/widgets');
      expect(result.cloneUrl).toBe('');
      expect(mockExecFileSync).not.toHaveBeenCalled();
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it('clones a public GitHub repository into the target path', async () => {
      mockExistsSync.mockReturnValue(false);

      const service = buildService({ githubToken: undefined });
      const result = await service.cloneInto('/data/repos/widgets');

      expect(result.cloned).toBe(true);
      expect(result.repositoryPath).toBe('/data/repos/widgets');
      expect(result.cloneUrl).toBe('https://github.com/acme/widgets.git');

      expect(mockMkdirSync).toHaveBeenCalledWith('/data/repos', { recursive: true });
      expect(mockExecFileSync).toHaveBeenCalledTimes(1);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        ['clone', 'https://github.com/acme/widgets.git', '/data/repos/widgets'],
        expect.objectContaining({ timeout: 300000 })
      );
    });

    it('embeds the GitHub token in the clone URL for private repositories', async () => {
      mockExistsSync.mockReturnValue(false);

      const service = buildService({ githubToken: 'ghp_secret' });
      const result = await service.cloneInto('/data/repos/widgets');

      expect(result.cloned).toBe(true);
      expect(result.cloneUrl).toBe('https://ghp_secret@github.com/acme/widgets.git');
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        ['clone', 'https://ghp_secret@github.com/acme/widgets.git', '/data/repos/widgets'],
        expect.anything()
      );
    });

    it('builds a GitLab clone URL using the configured gitlab_url and token', async () => {
      mockExistsSync.mockReturnValue(false);

      const service = buildService({
        gitProvider: 'gitlab',
        gitlabUrl: 'https://gitlab.example.com',
        gitlabToken: 'glpat-secret',
        githubToken: undefined,
      });
      const result = await service.cloneInto('/data/repos/widgets');

      expect(result.cloned).toBe(true);
      expect(result.cloneUrl).toBe('https://glpat-secret@gitlab.example.com/acme/widgets.git');
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        [
          'clone',
          'https://glpat-secret@gitlab.example.com/acme/widgets.git',
          '/data/repos/widgets',
        ],
        expect.anything()
      );
    });

    it('defaults the GitLab base URL to https://gitlab.com', async () => {
      mockExistsSync.mockReturnValue(false);

      const service = buildService({
        gitProvider: 'gitlab',
        gitlabUrl: undefined,
        gitlabToken: undefined,
        githubToken: undefined,
      });
      const result = await service.cloneInto('/data/repos/widgets');

      expect(result.cloneUrl).toBe('https://gitlab.com/acme/widgets.git');
    });

    it('re-clones when the target path exists but is not a git repository', async () => {
      mockExistsSync.mockImplementation((targetPath: string) => {
        if (targetPath === '/data/repos/widgets') {
          return true;
        }
        return false;
      });
      const dirStats = { isDirectory: (): boolean => true };
      mockStatSync.mockReturnValue(dirStats);

      const service = buildService({});
      const result = await service.cloneInto('/data/repos/widgets');

      expect(result.cloned).toBe(true);
      expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    });

    it('throws when github_repository is missing', async () => {
      mockExistsSync.mockReturnValue(false);

      const service = buildService({ githubRepository: undefined });

      await expect(service.cloneInto('/data/repos/widgets')).rejects.toThrow(
        'GITHUB_REPOSITORY is required in owner/repo format to clone the repository.'
      );
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it('throws when github_repository does not include a slash', async () => {
      mockExistsSync.mockReturnValue(false);

      const service = buildService({ githubRepository: 'invalid-repo' });

      await expect(service.cloneInto('/data/repos/widgets')).rejects.toThrow(
        'GITHUB_REPOSITORY is required in owner/repo format to clone the repository.'
      );
    });

    it('throws when the configured git provider is not registered for cloning', async () => {
      mockExistsSync.mockReturnValue(false);

      const service = buildService({ gitProvider: 'bitbucket' });

      await expect(service.cloneInto('/data/repos/widgets')).rejects.toThrow(
        'Unsupported git provider "bitbucket" for cloning'
      );
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it('throws when git clone fails', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFileSync.mockImplementation(() => {
        throw new Error('fatal: repository not found');
      });

      const service = buildService({});

      await expect(service.cloneInto('/data/repos/widgets')).rejects.toThrow(
        'fatal: repository not found'
      );
    });
  });

  describe('GIT_CLONE_PROVIDERS registry', () => {
    it('registers github and gitlab providers', () => {
      const ids = GIT_CLONE_PROVIDERS.map((provider) => provider.id);
      expect(ids).toContain('github');
      expect(ids).toContain('gitlab');
    });

    it('github resolves its base URL and token from the configuration', () => {
      const provider = GIT_CLONE_PROVIDERS.find((entry) => entry.id === 'github');
      const configuration = buildConfiguration({ githubToken: 'ghp_token' });

      expect(provider?.resolveBaseUrl(configuration)).toBe('https://github.com');
      expect(provider?.resolveToken(configuration)).toBe('ghp_token');
    });

    it('gitlab resolves its base URL and token from the configuration', () => {
      const provider = GIT_CLONE_PROVIDERS.find((entry) => entry.id === 'gitlab');
      const configuration = buildConfiguration({
        gitProvider: 'gitlab',
        gitlabUrl: 'https://gitlab.example.com/',
        gitlabToken: 'glpat-token',
      });

      expect(provider?.resolveBaseUrl(configuration)).toBe('https://gitlab.example.com');
      expect(provider?.resolveToken(configuration)).toBe('glpat-token');
    });

    it('gitlab falls back to https://gitlab.com when no url is configured', () => {
      const provider = GIT_CLONE_PROVIDERS.find((entry) => entry.id === 'gitlab');
      const configuration = buildConfiguration({ gitProvider: 'gitlab', gitlabUrl: undefined });

      expect(provider?.resolveBaseUrl(configuration)).toBe('https://gitlab.com');
    });
  });
});
