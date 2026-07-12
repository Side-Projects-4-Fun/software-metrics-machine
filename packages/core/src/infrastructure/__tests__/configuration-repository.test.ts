import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@smmachine/utils';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { ConfigurationRepository } from '../configuration-repository';
import { RepositoryFactory } from '../repository-factory';
import { SqliteRepository } from '../sqlite-repository';
import type { ISmmProjectConfig } from '../configuration';

const logger = new Logger('ConfigurationRepositoryTest', 'CRITICAL');

function createConfigurationRepository(
  env: Record<string, string | undefined>,
  projectName?: string
): ConfigurationRepository {
  return new ConfigurationRepository(env, projectName, logger);
}

describe('ConfigurationRepository', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  describe('multi-project format', () => {
    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo-a',
              git_repository_location: '/tmp/repo-a',
              github_token: 'token-a',
            },
            {
              github_repository: 'org/repo-b',
              git_repository_location: '/tmp/repo-b',
              github_token: 'token-b',
            },
          ],
        }),
        'utf-8'
      );
    });

    it('should load all projects', () => {
      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo-a');
      const projects = repo.getAllProjects();
      expect(projects).toHaveLength(2);
      expect(projects[0].github_repository).toBe('org/repo-a');
      expect(projects[1].github_repository).toBe('org/repo-b');
    });

    it('should get active configuration for the default project', () => {
      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo-a');
      const config = repo.getActiveConfiguration();
      expect(config.githubRepository).toBe('org/repo-a');
      expect(config.gitRepositoryLocation).toBe('/tmp/repo-a');
      expect(config.githubToken).toBe('token-a');
    });

    it('should normalize deployment frequency targets for the active configuration', () => {
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo-a',
              git_repository_location: '/tmp/repo-a',
              deployment_frequency_targets: [
                { pipeline: ' .github/workflows/release.yml ', job: ' deploy-production ' },
                { pipeline: '.github/workflows/mobile.yml', job: 'deploy-mobile' },
              ],
            },
          ],
        }),
        'utf-8'
      );

      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo-a');

      expect(repo.getActiveConfiguration().getDeploymentFrequencyTargets()).toEqual([
        { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
        { pipeline: '.github/workflows/mobile.yml', job: 'deploy-mobile' },
      ]);
    });

    it('should expose root github_token as default token', () => {
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          github_token: 'default-token',
          projects: [
            {
              github_repository: 'org/repo-a',
              git_repository_location: '/tmp/repo-a',
            },
          ],
        }),
        'utf-8'
      );

      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo-a');

      expect(repo.getDefaultGithubToken()).toBe('default-token');
      expect(repo.getActiveConfiguration().githubToken).toBe('default-token');
    });

    it('should use root github_token default when creating configuration from project config', () => {
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          github_token: 'default-token',
          projects: [
            {
              github_repository: 'org/repo-a',
              git_repository_location: '/tmp/repo-a',
            },
          ],
        }),
        'utf-8'
      );

      const repo = createConfigurationRepository(
        {
          SMM_STORE_DATA_AT: tempDir,
          GITHUB_TOKEN: 'env-token',
        },
        'org/repo-a'
      );
      const projectConfig = repo.getProjectByName('org/repo-a');

      expect(projectConfig).toBeDefined();
      expect(repo.fromProjectConfig(projectConfig!).githubToken).toBe('default-token');
    });

    it('should ignore generic GITHUB_TOKEN environment variable', () => {
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo-a',
              git_repository_location: '/tmp/repo-a',
            },
          ],
        }),
        'utf-8'
      );

      const repo = createConfigurationRepository(
        {
          SMM_STORE_DATA_AT: tempDir,
          GITHUB_TOKEN: 'generic-env-token',
        },
        'org/repo-a'
      );

      expect(repo.getActiveConfiguration().githubToken).toBeUndefined();
    });

    it('should use project-specific environment variables for project configuration', () => {
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo-a',
            },
          ],
        }),
        'utf-8'
      );

      const repo = createConfigurationRepository(
        {
          SMM_STORE_DATA_AT: tempDir,
          ORG_REPO_A_GIT_PROVIDER: 'github',
          ORG_REPO_A_GITHUB_TOKEN: 'github-token',
          ORG_REPO_A_GITLAB_TOKEN: 'gitlab-token',
          ORG_REPO_A_GIT_REPOSITORY_PATH: '/tmp/repo-a',
          ORG_REPO_A_LOGGING_LEVEL: 'DEBUG',
          ORG_REPO_A_JIRA_URL: 'https://jira.example.com',
          ORG_REPO_A_JIRA_EMAIL: 'user@example.com',
          ORG_REPO_A_JIRA_TOKEN: 'jira-token',
          ORG_REPO_A_JIRA_PROJECT: 'JIRA',
          ORG_REPO_A_SONAR_URL: 'https://sonar.example.com',
          ORG_REPO_A_SONAR_TOKEN: 'sonar-token',
          ORG_REPO_A_SONAR_PROJECT: 'sonar-project',
          ORG_REPO_A_STORE_LOGS: 'true',
          ORG_REPO_A_SMM_TIMEZONE: 'Europe/Madrid',
          ORG_REPO_A_SMM_STORAGE_TYPE: 'sqlite',
        },
        'org/repo-a'
      );

      const config = repo.getActiveConfiguration();
      expect(config.gitProvider).toBe('github');
      expect(config.githubToken).toBe('github-token');
      expect(config.gitlabToken).toBe('gitlab-token');
      expect(config.gitRepositoryLocation).toBe('/tmp/repo-a');
      expect(config.loggingLevel).toBe('DEBUG');
      expect(config.jiraUrl).toBe('https://jira.example.com');
      expect(config.jiraEmail).toBe('user@example.com');
      expect(config.jiraToken).toBe('jira-token');
      expect(config.jiraProject).toBe('JIRA');
      expect(config.sonarUrl).toBe('https://sonar.example.com');
      expect(config.sonarToken).toBe('sonar-token');
      expect(config.sonarProject).toBe('sonar-project');
      expect(config.storeLogs).toBe(true);
      expect(config.timezone).toBe('Europe/Madrid');
      expect(config.internal.storageType).toBe('sqlite');
    });

    it('should ignore generic project configuration environment variables', () => {
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo-a',
            },
          ],
        }),
        'utf-8'
      );

      const repo = createConfigurationRepository(
        {
          SMM_STORE_DATA_AT: tempDir,
          GIT_PROVIDER: 'github',
          GITHUB_TOKEN: 'github-token',
          GITLAB_TOKEN: 'gitlab-token',
          GIT_REPOSITORY_PATH: '/tmp/repo-a',
          LOGGING_LEVEL: 'DEBUG',
          JIRA_URL: 'https://jira.example.com',
          JIRA_EMAIL: 'user@example.com',
          JIRA_TOKEN: 'jira-token',
          JIRA_PROJECT: 'JIRA',
          SONAR_URL: 'https://sonar.example.com',
          SONAR_TOKEN: 'sonar-token',
          SONAR_PROJECT: 'sonar-project',
          STORE_LOGS: 'true',
          SMM_TIMEZONE: 'Europe/Madrid',
          SMM_STORAGE_TYPE: 'sqlite',
        },
        'org/repo-a'
      );

      const config = repo.getActiveConfiguration();
      expect(config.gitProvider).toBeUndefined();
      expect(config.githubToken).toBeUndefined();
      expect(config.gitlabToken).toBeUndefined();
      expect(config.gitRepositoryLocation).toBe('');
      expect(config.loggingLevel).toBe('CRITICAL');
      expect(config.jiraUrl).toBeUndefined();
      expect(config.jiraEmail).toBeUndefined();
      expect(config.jiraToken).toBeUndefined();
      expect(config.jiraProject).toBeUndefined();
      expect(config.sonarUrl).toBeUndefined();
      expect(config.sonarToken).toBeUndefined();
      expect(config.sonarProject).toBeUndefined();
      expect(config.storeLogs).toBeUndefined();
      expect(config.timezone).toBe('UTC');
      expect(config.internal.storageType).toBe('json');
    });

    it('should use project-specific GitHub token from environment', () => {
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'bla/123',
              git_repository_location: '/tmp/repo-a',
            },
            {
              github_repository: 'bu/456',
              git_repository_location: '/tmp/repo-b',
            },
          ],
        }),
        'utf-8'
      );

      const repo = createConfigurationRepository(
        {
          SMM_STORE_DATA_AT: tempDir,
          BLA_123_GITHUB_TOKEN: 'token-from-bla-env',
          BU_456_GITHUB_TOKEN: 'token-from-bu-env',
        },
        'bu/456'
      );

      expect(repo.getActiveConfiguration().githubToken).toBe('token-from-bu-env');
    });

    it('should prefer project-specific environment token over JSON tokens', () => {
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          github_token: 'default-token',
          projects: [
            {
              github_repository: 'bla/123',
              git_repository_location: '/tmp/repo-a',
              github_token: 'project-token',
            },
          ],
        }),
        'utf-8'
      );

      const repo = createConfigurationRepository(
        {
          SMM_STORE_DATA_AT: tempDir,
          BLA_123_GITHUB_TOKEN: 'env-project-token',
          GITHUB_TOKEN: 'generic-env-token',
        },
        'bla/123'
      );

      expect(repo.getActiveConfiguration().githubToken).toBe('env-project-token');
    });

    it('should default to first project when project is not specified', () => {
      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir });
      const config = repo.getActiveConfiguration();
      expect(config.githubRepository).toBe('org/repo-a');
      expect(config.gitRepositoryLocation).toBe('/tmp/repo-a');
      expect(config.githubToken).toBe('token-a');
    });

    it('should resolve project-specific environment variables for the first project when project is not specified', () => {
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo-a',
            },
            {
              github_repository: 'org/repo-b',
            },
          ],
        }),
        'utf-8'
      );

      const repo = createConfigurationRepository({
        SMM_STORE_DATA_AT: tempDir,
        ORG_REPO_A_GITHUB_TOKEN: 'first-project-token',
        ORG_REPO_A_GIT_REPOSITORY_PATH: '/tmp/repo-a-from-env',
        ORG_REPO_B_GITHUB_TOKEN: 'second-project-token',
        ORG_REPO_B_GIT_REPOSITORY_PATH: '/tmp/repo-b-from-env',
      });

      const config = repo.getActiveConfiguration();
      expect(config.githubRepository).toBe('org/repo-a');
      expect(config.githubToken).toBe('first-project-token');
      expect(config.gitRepositoryLocation).toBe('/tmp/repo-a-from-env');
    });

    it('should find project by repository', () => {
      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo-a');
      const project = repo.getProjectByRepository('org/repo-b');
      expect(project).toBeDefined();
      expect(project?.github_repository).toBe('org/repo-b');
    });

    it('should return undefined for unknown repository', () => {
      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo-a');
      const project = repo.getProjectByRepository('nonexistent/repo');
      expect(project).toBeUndefined();
    });

    it('should find project by index', () => {
      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo-a');
      const project = repo.getProjectByIndex(1);
      expect(project).toBeDefined();
      expect(project?.github_repository).toBe('org/repo-b');
    });

    it('should return undefined for out-of-range index', () => {
      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo-a');
      expect(repo.getProjectByIndex(5)).toBeUndefined();
      expect(repo.getProjectByIndex(-1)).toBeUndefined();
    });

    it('should select project by name', () => {
      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo-b');
      const config = repo.getActiveConfiguration();
      expect(config.githubRepository).toBe('org/repo-b');
    });

    it('should save changes to the active project', () => {
      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo-b');
      const config = repo.getActiveConfiguration();
      config.sonarLocalRunnerToken = 'local-token-b';
      config.internal.storageType = 'sqlite';

      repo.save();

      const saved = JSON.parse(readFileSync(join(tempDir, 'smm_config.json'), 'utf-8')) as Record<
        string,
        ISmmProjectConfig[]
      >;
      expect(saved.projects[0].sonar_local_runner_token).toBeUndefined();
      expect(saved.projects[1].sonar_local_runner_token).toBe('local-token-b');
      expect(saved.projects[1].internal?.storage_type).toBe('sqlite');
    });

    it('should throw when project not found', () => {
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'nonexistent/repo')
      ).toThrow('Project "nonexistent/repo" not found');
    });
  });

  describe('missing projects array', () => {
    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-noprojects-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          github_repository: 'org/repo',
          git_repository_location: '/tmp/repo',
        }),
        'utf-8'
      );
    });

    it('should return empty projects list when projects array is missing', () => {
      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo');
      expect(repo.getAllProjects()).toHaveLength(0);
    });
  });

  describe('empty projects array', () => {
    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-empty-'));
      writeFileSync(join(tempDir, 'smm_config.json'), JSON.stringify({ projects: [] }), 'utf-8');
    });

    it('should throw error when projects array is empty', () => {
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow('smm_config.json has empty projects array');
    });
  });

  describe('no config file', () => {
    it('should handle missing config file gracefully', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-nofile-'));
      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo');
      expect(repo.getAllProjects()).toHaveLength(0);
    });
  });

  describe('missing SMM_STORE_DATA_AT', () => {
    it('should throw error', () => {
      expect(() => createConfigurationRepository({}, 'org/repo')).toThrow(
        'SMM_STORE_DATA_AT is required'
      );
    });
  });

  describe('config validation', () => {
    it('should throw when config file contains invalid JSON', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-invalidjson-'));
      writeFileSync(join(tempDir, 'smm_config.json'), '{ invalid json }', 'utf-8');
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/is not valid JSON/);
    });

    it('should throw when root is an array instead of object', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-rootarray-'));
      writeFileSync(join(tempDir, 'smm_config.json'), '[]', 'utf-8');
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/must be a JSON object, got array/);
    });

    it('should throw when root is a primitive', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-rootprim-'));
      writeFileSync(join(tempDir, 'smm_config.json'), '"hello"', 'utf-8');
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/must be a JSON object, got string/);
    });

    it('should throw when projects is not an array', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-projnotarray-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({ projects: 'not-an-array' }),
        'utf-8'
      );
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/"projects" must be an array, got string/);
    });

    it('should throw when a project entry is not an object', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-projnotobj-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({ projects: ['not-an-object'] }),
        'utf-8'
      );
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/projects\[0\] must be a JSON object, got string/);
    });

    it('should throw when a project entry is null', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-projnull-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({ projects: [null] }),
        'utf-8'
      );
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/projects\[0\] must be a JSON object, got object/);
    });

    it('should throw when a project entry is an array', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-projarray-'));
      writeFileSync(join(tempDir, 'smm_config.json'), JSON.stringify({ projects: [[]] }), 'utf-8');
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/projects\[0\] must be a JSON object, got array/);
    });

    it('should throw when string field has wrong type', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-strfield-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({ projects: [{ github_repository: 123 }] }),
        'utf-8'
      );
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/projects\[0\]\.github_repository must be a string/);
    });

    it('should throw when store_logs is not a boolean', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-storelogs-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({ projects: [{ store_logs: 'yes' }] }),
        'utf-8'
      );
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/projects\[0\]\.store_logs must be a boolean/);
    });

    it('should throw when deployment_frequency_targets is not an array', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-deptarget-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({ projects: [{ deployment_frequency_targets: 'not-array' }] }),
        'utf-8'
      );
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/projects\[0\]\.deployment_frequency_targets must be an array/);
    });

    it('should throw when deployment_frequency_targets entry is not an object', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-deptargetobj-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({ projects: [{ deployment_frequency_targets: ['bad'] }] }),
        'utf-8'
      );
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/projects\[0\]\.deployment_frequency_targets\[0\] must be an object/);
    });

    it('should throw when deployment_frequency_targets entry missing pipeline', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-deptargetpipe-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({ projects: [{ deployment_frequency_targets: [{ job: 'deploy' }] }] }),
        'utf-8'
      );
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/projects\[0\]\.deployment_frequency_targets\[0\]\.pipeline must be a string/);
    });

    it('should throw when deployment_frequency_targets entry missing job', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-deptargetjob-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({ projects: [{ deployment_frequency_targets: [{ pipeline: 'ci' }] }] }),
        'utf-8'
      );
      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/projects\[0\]\.deployment_frequency_targets\[0\]\.job must be a string/);
    });

    it('should fall back to CRITICAL when log_level in config file is invalid', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-invalid-loglevel-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo',
              git_repository_location: '/tmp/repo',
              log_level: 'TRACE',
            },
          ],
        }),
        'utf-8'
      );
      const config = createConfigurationRepository(
        { SMM_STORE_DATA_AT: tempDir },
        'org/repo'
      ).getActiveConfiguration();
      expect(config.loggingLevel).toBe('CRITICAL');
    });

    it('should fall back to CRITICAL when LOGGING_LEVEL env var is invalid', () => {
      const config = createConfigurationRepository(
        {
          SMM_STORE_DATA_AT: '/tmp',
          ORG_REPO_LOGGING_LEVEL: 'VERBOSE',
        },
        'org/repo'
      ).getActiveConfiguration();
      expect(config.loggingLevel).toBe('CRITICAL');
    });

    it('should accept valid config with all fields', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-valid-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              git_provider: 'github',
              github_token: 'token',
              github_repository: 'org/repo',
              git_repository_location: '/tmp/repo',
              deployment_frequency_targets: [{ pipeline: 'ci', job: 'deploy' }],
              main_branch: 'main',
              log_level: 'DEBUG',
              store_logs: true,
              timezone: 'UTC',
            },
          ],
        }),
        'utf-8'
      );
      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo');
      expect(repo.getAllProjects()).toHaveLength(1);
    });

    it('should accept nested JSON configuration data', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-nested-json-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo',
              git_repository_location: '/tmp/repo',
              internal: {
                storage_type: 'sqlite',
              },
            },
          ],
        }),
        'utf-8'
      );

      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo');

      expect(repo.getActiveConfiguration().internal.storageType).toBe('sqlite');
    });

    it('should inherit root internal storage configuration for selected projects', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-root-internal-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          internal: {
            storage_type: 'sqlite',
          },
          projects: [
            {
              github_repository: 'org/repo',
              git_repository_location: '/tmp/repo',
            },
          ],
        }),
        'utf-8'
      );

      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo');

      expect(repo.getActiveConfiguration().internal.storageType).toBe('sqlite');
      expect(
        RepositoryFactory.create(
          join(tempDir, 'github_org_repo', 'prs.json'),
          new Logger('RepositoryFactoryTest'),
          repo.getActiveConfiguration()
        )
      ).toBeInstanceOf(SqliteRepository);
    });

    it('should let project internal storage configuration override root internal storage', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-project-internal-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          internal: {
            storage_type: 'sqlite',
          },
          projects: [
            {
              github_repository: 'org/repo',
              git_repository_location: '/tmp/repo',
              internal: {
                storage_type: 'json',
              },
            },
          ],
        }),
        'utf-8'
      );

      const repo = createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo');

      expect(repo.getActiveConfiguration().internal.storageType).toBe('json');
    });

    it('should reject root internal storageType in JSON configuration', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-root-internal-camelcase-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          internal: {
            storageType: 'sqlite',
          },
          projects: [
            {
              github_repository: 'org/repo',
              git_repository_location: '/tmp/repo',
            },
          ],
        }),
        'utf-8'
      );

      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(/internal\.storageType is not supported.*internal\.storage_type/);
    });

    it('should reject project internal storageType in JSON configuration', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-repo-project-internal-camelcase-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo',
              git_repository_location: '/tmp/repo',
              internal: {
                storageType: 'sqlite',
              },
            },
          ],
        }),
        'utf-8'
      );

      expect(() =>
        createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir }, 'org/repo')
      ).toThrow(
        /projects\[0\]\.internal\.storageType is not supported.*projects\[0\]\.internal\.storage_type/
      );
    });
  });
});

describe('Configuration', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('should create configuration from environment variables', () => {
    const env = {
      SMM_STORE_DATA_AT: '/tmp',
      OWNER_REPO_GIT_PROVIDER: 'github',
      OWNER_REPO_GITHUB_TOKEN: 'gh_test',
      OWNER_REPO_LOGGING_LEVEL: 'DEBUG',
      OWNER_REPO_GIT_REPOSITORY_PATH: '/tmp/repo',
    };
    const config = createConfigurationRepository(env, 'owner/repo').getActiveConfiguration();
    expect(config.githubRepository).toBe('owner/repo');
    expect(config.gitProvider).toBe('github');
    expect(config.githubToken).toBe('gh_test');
    expect(config.loggingLevel).toBe('DEBUG');
    expect(config.storeData).toBe('/tmp');
    expect(config.getLogPath()).toBe(join('/tmp', 'github_owner_repo', 'smm.log'));
  });

  it('should load store logs configuration', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-config-'));
    writeFileSync(
      join(tempDir, 'smm_config.json'),
      JSON.stringify({
        projects: [
          {
            github_repository: 'owner/repo',
            git_repository_location: '/tmp/repo',
            log_level: 'INFO',
            store_logs: true,
          },
        ],
      }),
      'utf-8'
    );

    const config = createConfigurationRepository({
      SMM_STORE_DATA_AT: tempDir,
    }).getActiveConfiguration();

    expect(config.storeLogs).toBe(true);
    expect(config.getLogPath()).toBe(join(tempDir, 'github_owner_repo', 'smm.log'));
  });

  it('should use default values when env vars not set', () => {
    const config = createConfigurationRepository({
      SMM_STORE_DATA_AT: '/tmp',
    }).getActiveConfiguration();
    expect(config.loggingLevel).toBe('CRITICAL');
    expect(config.storeData).toBe('/tmp');
  });

  it('should validate configuration', () => {
    const config = createConfigurationRepository(
      {
        SMM_STORE_DATA_AT: '/tmp',
        OWNER_REPO_GIT_REPOSITORY_PATH: '/tmp/repo',
      },
      'owner/repo'
    ).getActiveConfiguration();
    const validation = config.validate();
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  describe('multi-project support', () => {
    it('should load first project by default when more than one project exists and no project is specified', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo-a',
              git_repository_location: '/tmp/repo-a',
              github_token: 'token-a',
            },
            {
              github_repository: 'org/repo-b',
              git_repository_location: '/tmp/repo-b',
              github_token: 'token-b',
            },
          ],
        }),
        'utf-8'
      );

      const config = createConfigurationRepository({
        SMM_STORE_DATA_AT: tempDir,
      }).getActiveConfiguration();
      expect(config.githubRepository).toBe('org/repo-a');
      expect(config.gitRepositoryLocation).toBe('/tmp/repo-a');
      expect(config.githubToken).toBe('token-a');
    });

    it('should use root github_token as default when selected project has no github_token', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          github_token: 'default-token',
          projects: [
            {
              github_repository: 'org/repo-a',
              git_repository_location: '/tmp/repo-a',
            },
            {
              github_repository: 'org/repo-b',
              git_repository_location: '/tmp/repo-b',
              github_token: 'project-token',
            },
          ],
        }),
        'utf-8'
      );

      const config = createConfigurationRepository(
        {
          SMM_STORE_DATA_AT: tempDir,
          GITHUB_TOKEN: 'env-token',
        },
        'org/repo-a'
      ).getActiveConfiguration();

      expect(config.githubToken).toBe('default-token');
    });

    it('should prefer project github_token over root github_token', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          github_token: 'default-token',
          projects: [
            {
              github_repository: 'org/repo-a',
              git_repository_location: '/tmp/repo-a',
              github_token: 'project-token',
            },
          ],
        }),
        'utf-8'
      );

      const config = createConfigurationRepository(
        { SMM_STORE_DATA_AT: tempDir },
        'org/repo-a'
      ).getActiveConfiguration();

      expect(config.githubToken).toBe('project-token');
    });

    it('should select project by constructor projectName (github_repository)', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo-a',
              git_repository_location: '/tmp/repo-a',
            },
            {
              github_repository: 'org/repo-b',
              git_repository_location: '/tmp/repo-b',
            },
          ],
        }),
        'utf-8'
      );

      const config = createConfigurationRepository(
        { SMM_STORE_DATA_AT: tempDir },
        'org/repo-b'
      ).getActiveConfiguration();
      expect(config.githubRepository).toBe('org/repo-b');
      expect(config.gitRepositoryLocation).toBe('/tmp/repo-b');
    });

    it('should load first project when there is only one project', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo-a',
              git_repository_location: '/tmp/repo-a',
            },
          ],
        }),
        'utf-8'
      );

      const config = createConfigurationRepository({
        SMM_STORE_DATA_AT: tempDir,
      }).getActiveConfiguration();
      expect(config.githubRepository).toBe('org/repo-a');
      expect(config.gitRepositoryLocation).toBe('/tmp/repo-a');
    });

    it('should throw error when selected project is not found', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          projects: [
            {
              github_repository: 'org/repo-a',
              git_repository_location: '/tmp/repo-a',
            },
          ],
        }),
        'utf-8'
      );

      expect(() =>
        createConfigurationRepository(
          {
            SMM_STORE_DATA_AT: tempDir,
          },
          'nonexistent/repo'
        )
      ).toThrow('Project "nonexistent/repo" not found');
    });

    it('should throw error when projects array is empty', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-'));
      writeFileSync(join(tempDir, 'smm_config.json'), JSON.stringify({ projects: [] }), 'utf-8');

      expect(() => createConfigurationRepository({ SMM_STORE_DATA_AT: tempDir })).toThrow(
        'smm_config.json has empty projects array'
      );
    });

    it('should load from env vars when projects array is missing', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-config-'));
      writeFileSync(
        join(tempDir, 'smm_config.json'),
        JSON.stringify({
          github_repository: 'org/repo',
          git_repository_location: '/tmp/repo',
        }),
        'utf-8'
      );

      const config = createConfigurationRepository({
        SMM_STORE_DATA_AT: tempDir,
      }).getActiveConfiguration();
      expect(config.githubRepository).toBe('org/repo');
      expect(config.gitRepositoryLocation).toBe('/tmp/repo');
    });
  });
});
