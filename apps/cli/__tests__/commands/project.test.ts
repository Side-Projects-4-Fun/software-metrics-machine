import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Command } from 'commander';
import { commands } from '../../src';

const mocks = vi.hoisted(() => ({
  prompt: vi.fn(),
}));

vi.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: mocks.prompt,
  },
}));

function readConfig(tempDir: string): unknown {
  return JSON.parse(readFileSync(join(tempDir, 'smm_config.json'), 'utf-8'));
}

function readUserSettings(tempDir: string): unknown {
  const settingsPath = join(tempDir, 'config-home', 'smm', 'config.json');
  if (!existsSync(settingsPath)) {
    return undefined;
  }
  return JSON.parse(readFileSync(settingsPath, 'utf-8'));
}

describe('cli: Project Commands', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  const getOutput = () =>
    consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-project-'));

    vi.stubEnv('SMM_STORE_DATA_AT', tempDir);
    vi.stubEnv('XDG_CONFIG_HOME', join(tempDir, 'config-home'));
    vi.stubEnv('OWNER_REPO_GIT_PROVIDER', 'github');
    vi.stubEnv('OWNER_REPO_GITHUB_TOKEN', 'fake-token');
    vi.stubEnv('OWNER_REPO_GIT_REPOSITORY_PATH', '/tmp/repo');

    mocks.prompt.mockReset();

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`);
    });

    program = commands();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = '';
  });

  describe('project configure', () => {
    it('creates smm_config.json with a GitHub project from interactive answers', async () => {
      mocks.prompt
        .mockResolvedValueOnce({
          git_provider: 'github',
          github_repository: 'acme/widgets',
          git_repository_location: '/repo',
          main_branch: 'main',
          github_token: 'ghp_123',
        })
        .mockResolvedValueOnce({ configure_jira: false, configure_sonarqube: false })
        .mockResolvedValueOnce({ log_level: 'INFO', timezone: 'UTC', store_logs: false });

      await program.parseAsync(['project', 'configure'], { from: 'user' });

      expect(readConfig(tempDir)).toEqual({
        projects: [
          {
            git_provider: 'github',
            github_repository: 'acme/widgets',
            git_repository_location: '/repo',
            main_branch: 'main',
            github_token: 'ghp_123',
            log_level: 'INFO',
            timezone: 'UTC',
            store_logs: false,
          },
        ],
      });
      expect(getOutput()).toContain('acme/widgets');
      expect(getOutput()).toContain('smm_config.json');
    });

    it('prompts for the data directory when SMM_STORE_DATA_AT is not set and saves the default to user settings', async () => {
      vi.stubEnv('SMM_STORE_DATA_AT', '');

      mocks.prompt
        .mockResolvedValueOnce({ store_data_at: tempDir })
        .mockResolvedValueOnce({
          git_provider: 'github',
          github_repository: 'acme/widgets',
          git_repository_location: '',
          main_branch: 'main',
          github_token: '',
        })
        .mockResolvedValueOnce({ configure_jira: false, configure_sonarqube: false })
        .mockResolvedValueOnce({ log_level: 'INFO', timezone: 'UTC', store_logs: false });

      await program.parseAsync(['project', 'configure'], { from: 'user' });

      expect(process.env.SMM_STORE_DATA_AT).toBe(tempDir);
      const config = readConfig(tempDir) as { projects: Array<{ github_repository: string }> };
      expect(config.projects[0].github_repository).toBe('acme/widgets');
      expect(getOutput()).toContain('Default data directory saved to user settings:');
      expect(readUserSettings(tempDir)).toEqual({ store_data_at: tempDir });
    });

    it('saves the data directory to user settings when SMM_STORE_DATA_AT is already set', async () => {
      mocks.prompt
        .mockResolvedValueOnce({
          git_provider: 'github',
          github_repository: 'acme/widgets',
          git_repository_location: '',
          main_branch: 'main',
          github_token: '',
        })
        .mockResolvedValueOnce({ configure_jira: false, configure_sonarqube: false })
        .mockResolvedValueOnce({ log_level: 'INFO', timezone: 'UTC', store_logs: false });

      await program.parseAsync(['project', 'configure'], { from: 'user' });

      expect(readUserSettings(tempDir)).toEqual({ store_data_at: tempDir });
      expect(getOutput()).not.toContain('Default data directory saved to user settings:');
    });

    it('writes gitlab fields when gitlab provider is selected', async () => {
      mocks.prompt
        .mockResolvedValueOnce({
          git_provider: 'gitlab',
          github_repository: 'gitlab-org/gitlab',
          git_repository_location: '',
          main_branch: 'main',
          gitlab_token: 'glpat_123',
          gitlab_url: 'https://gitlab.com',
        })
        .mockResolvedValueOnce({ configure_jira: false, configure_sonarqube: false })
        .mockResolvedValueOnce({ log_level: 'INFO', timezone: 'UTC', store_logs: false });

      await program.parseAsync(['project', 'configure'], { from: 'user' });

      const config = readConfig(tempDir) as {
        projects: Array<Record<string, unknown>>;
      };
      expect(config.projects[0]).toMatchObject({
        git_provider: 'gitlab',
        github_repository: 'gitlab-org/gitlab',
        gitlab_token: 'glpat_123',
        gitlab_url: 'https://gitlab.com',
      });
      expect(config.projects[0]).not.toHaveProperty('github_token');
    });

    it('writes jira and sonarqube fields when integrations are enabled', async () => {
      mocks.prompt
        .mockResolvedValueOnce({
          git_provider: 'github',
          github_repository: 'acme/widgets',
          git_repository_location: '',
          main_branch: 'main',
          github_token: '',
        })
        .mockResolvedValueOnce({
          configure_jira: true,
          jira_url: 'https://acme.atlassian.net',
          jira_email: 'dev@acme.com',
          jira_token: 'jira_123',
          jira_project: 'KAN',
          configure_sonarqube: true,
          sonar_url: 'https://sonarcloud.io',
          sonar_token: 'sonar_123',
          sonar_project: 'acme-widgets',
        })
        .mockResolvedValueOnce({ log_level: 'INFO', timezone: 'UTC', store_logs: false });

      await program.parseAsync(['project', 'configure'], { from: 'user' });

      const config = readConfig(tempDir) as {
        projects: Array<Record<string, unknown>>;
      };
      expect(config.projects[0]).toMatchObject({
        jira_url: 'https://acme.atlassian.net',
        jira_email: 'dev@acme.com',
        jira_token: 'jira_123',
        jira_project: 'KAN',
        sonar_url: 'https://sonarcloud.io',
        sonar_token: 'sonar_123',
        sonar_project: 'acme-widgets',
      });
    });

    it('updates an existing project and keeps other projects untouched', async () => {
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'acme/one',
              git_provider: 'github',
              main_branch: 'main',
              github_token: 'old-token',
            },
            { github_repository: 'acme/two', git_provider: 'github', main_branch: 'main' },
          ],
        }),
        'utf-8'
      );

      mocks.prompt
        .mockResolvedValueOnce({ action: 'Update acme/one' })
        .mockResolvedValueOnce({
          git_provider: 'github',
          github_repository: 'acme/one',
          git_repository_location: '/new/repo',
          main_branch: 'main',
          github_token: '',
        })
        .mockResolvedValueOnce({ configure_jira: false, configure_sonarqube: false })
        .mockResolvedValueOnce({ log_level: 'INFO', timezone: 'UTC', store_logs: false });

      await program.parseAsync(['project', 'configure'], { from: 'user' });

      const config = readConfig(tempDir) as {
        projects: Array<Record<string, unknown>>;
      };
      expect(config.projects).toHaveLength(2);
      expect(config.projects[0]).toMatchObject({
        github_repository: 'acme/one',
        git_repository_location: '/new/repo',
        github_token: 'old-token',
      });
      expect(config.projects[1]).toEqual({
        github_repository: 'acme/two',
        git_provider: 'github',
        main_branch: 'main',
      });
    });

    it('adds a new project when "Create a new project" is selected', async () => {
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [{ github_repository: 'acme/one', git_provider: 'github' }],
        }),
        'utf-8'
      );

      mocks.prompt
        .mockResolvedValueOnce({ action: 'Create a new project' })
        .mockResolvedValueOnce({
          git_provider: 'github',
          github_repository: 'acme/two',
          git_repository_location: '',
          main_branch: 'main',
          github_token: '',
        })
        .mockResolvedValueOnce({ configure_jira: false, configure_sonarqube: false })
        .mockResolvedValueOnce({ log_level: 'INFO', timezone: 'UTC', store_logs: false });

      await program.parseAsync(['project', 'configure'], { from: 'user' });

      const config = readConfig(tempDir) as {
        projects: Array<{ github_repository: string }>;
      };
      expect(config.projects).toHaveLength(2);
      expect(config.projects[1].github_repository).toBe('acme/two');
    });

    it('reports an error when smm_config.json is not valid JSON', async () => {
      writeFileSync(join(tempDir, 'smm_config.json'), '{invalid', 'utf-8');

      await expect(program.parseAsync(['project', 'configure'], { from: 'user' })).rejects.toThrow(
        'process.exit(1)'
      );

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(getOutput()).toContain('not valid JSON');
    });
  });

  describe('project list', () => {
    it('prints a hint when SMM_STORE_DATA_AT is not set', async () => {
      vi.stubEnv('SMM_STORE_DATA_AT', '');

      await program.parseAsync(['project', 'list'], { from: 'user' });

      expect(getOutput()).toContain('smm project configure');
    });

    it('prints a hint when no projects are configured', async () => {
      await program.parseAsync(['project', 'list'], { from: 'user' });

      expect(getOutput()).toContain('smm project configure');
    });

    it('resolves the data directory from user settings when SMM_STORE_DATA_AT is not set', async () => {
      vi.stubEnv('SMM_STORE_DATA_AT', '');
      mkdirSync(join(tempDir, 'config-home', 'smm'), { recursive: true });
      writeFileSync(
        join(tempDir, 'config-home', 'smm', 'config.json'),
        JSON.stringify({ store_data_at: tempDir }),
        'utf-8'
      );
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            { github_repository: 'acme/one', git_provider: 'github' },
            { github_repository: 'acme/two', git_provider: 'gitlab' },
          ],
        }),
        'utf-8'
      );

      await program.parseAsync(['project', 'list'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('acme/one');
      expect(output).toContain('acme/two');
    });

    it('prints the configured projects', async () => {
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            { github_repository: 'acme/one', git_provider: 'github' },
            { github_repository: 'acme/two', git_provider: 'gitlab' },
          ],
        }),
        'utf-8'
      );

      await program.parseAsync(['project', 'list'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('acme/one');
      expect(output).toContain('acme/two');
    });
  });

  describe('project --help', () => {
    it('renders the configure and list subcommands', async () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await expect(program.parseAsync(['project', '--help'], { from: 'user' })).rejects.toThrow(
        'process.exit(0)'
      );

      const helpOutput = stdoutSpy.mock.calls.flat().join('');
      expect(helpOutput).toContain('configure');
      expect(helpOutput).toContain('list');

      stdoutSpy.mockRestore();
    });
  });
});
