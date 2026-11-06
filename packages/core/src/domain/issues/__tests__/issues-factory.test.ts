import { describe, expect, it } from 'vitest';
import { Configuration } from '../../../infrastructure/configuration';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';
import { GitHubIssuesClient } from '../../../providers/github/github-issues-client';
import { JiraIssuesClient } from '../../../providers/jira/jira-client';
import { JiraCsvIssuesClient } from '../../../providers/jira/jira-csv-client';
import { IssuesFactory } from '../factories/issues-factory';

const logger = new MockLoggerBuilder().build();

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return new Configuration({
    storeData: '/tmp/smm-issues-factory',
    githubRepository: 'owner/repo',
    githubToken: 'token',
    ...overrides,
  });
}

describe('IssuesFactory', () => {
  it('defaults to the Jira client when issues_provider is absent', () => {
    const client = IssuesFactory.createClient(createConfig(), logger);

    expect(client.provider).toBe('jira');
    expect(client).toBeInstanceOf(JiraIssuesClient);
  });

  it('selects the GitHub client when issues_provider is github', () => {
    const client = IssuesFactory.createClient(createConfig({ issuesProvider: 'github' }), logger);

    expect(client.provider).toBe('github');
    expect(client).toBeInstanceOf(GitHubIssuesClient);
  });

  it('selects the file-backed Jira CSV client when issues_provider is jira-csv', () => {
    const client = IssuesFactory.createClient(createConfig({ issuesProvider: 'jira-csv' }), logger);

    expect(client.provider).toBe('jira-csv');
    expect(client).toBeInstanceOf(JiraCsvIssuesClient);
  });

  it('returns a repository that exposes the selected provider', () => {
    const dependencies = IssuesFactory.create(
      createConfig({ issuesProvider: 'github' }),
      logger,
      new TimeZoneProvider('UTC')
    );

    expect(dependencies.provider).toBe('github');
    expect(dependencies.issuesRepository.provider).toBe('github');
  });

  it('rejects the GitHub provider without a repository', () => {
    expect(() =>
      IssuesFactory.createClient(
        createConfig({ issuesProvider: 'github', githubRepository: undefined }),
        logger
      )
    ).toThrow('GitHub issues provider requires github_repository');
  });

  it('rejects the GitHub provider without a token', () => {
    expect(() =>
      IssuesFactory.createClient(
        createConfig({ issuesProvider: 'github', githubToken: undefined }),
        logger
      )
    ).toThrow('GitHub issues provider requires github_token');
  });
});
