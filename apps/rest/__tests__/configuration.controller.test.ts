import { describe, expect, it, vi } from 'vitest';
import { ConfigurationController } from '../src/controllers/configuration.controller';

describe('ConfigurationController', () => {
  function createController(configOverrides: Record<string, unknown> = {}) {
    const config = {
      gitProvider: 'github',
      githubRepository: 'org/repo',
      gitRepositoryLocation: '/tmp/repo',
      storeData: 'json',
      mainBranch: 'main',
      dashboardStartDate: '2026-01-01',
      dashboardEndDate: '2026-06-01',
      loggingLevel: 'info',
      jiraUrl: 'https://jira.example.com',
      jiraEmail: 'user@example.com',
      jiraToken: 'token-123',
      jiraProject: 'PROJ',
      sonarUrl: 'https://sonar.example.com',
      sonarProject: 'sonar-proj',
      getDeploymentFrequencyTargets: vi
        .fn()
        .mockReturnValue([{ pipeline: 'ci.yml', job: 'deploy' }]),
      ...configOverrides,
    };
    const controller = new ConfigurationController(config as never);

    return { controller, config };
  }

  it('maps all configuration fields through directly when populated', () => {
    const { controller } = createController();

    const result = controller.configuration();

    expect(result).toEqual({
      result: {
        git_provider: 'github',
        github_repository: 'org/repo',
        git_repository_location: '/tmp/repo',
        store_data: 'json',
        deployment_frequency_targets: [{ pipeline: 'ci.yml', job: 'deploy' }],
        main_branch: 'main',
        dashboard_start_date: '2026-01-01',
        dashboard_end_date: '2026-06-01',
        logging_level: 'info',
        jira_url: 'https://jira.example.com',
        jira_email: 'user@example.com',
        jira_token: 'token-123',
        jira_project: 'PROJ',
        sonar_url: 'https://sonar.example.com',
        sonar_project: 'sonar-proj',
      },
    });
  });

  it('falls back to null for optional fields left undefined', () => {
    const { controller } = createController({
      dashboardStartDate: undefined,
      dashboardEndDate: undefined,
      jiraUrl: undefined,
      jiraEmail: undefined,
      jiraToken: undefined,
      jiraProject: undefined,
      sonarUrl: undefined,
      sonarProject: undefined,
    });

    const result = controller.configuration();

    expect(result.result.dashboard_start_date).toBeNull();
    expect(result.result.dashboard_end_date).toBeNull();
    expect(result.result.jira_url).toBeNull();
    expect(result.result.jira_email).toBeNull();
    expect(result.result.jira_token).toBeNull();
    expect(result.result.jira_project).toBeNull();
    expect(result.result.sonar_url).toBeNull();
    expect(result.result.sonar_project).toBeNull();
  });
});
