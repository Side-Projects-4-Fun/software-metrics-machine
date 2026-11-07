import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
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

  it('parses CSV timestamps with the project timezone, not the caller filtering timezone', async () => {
    const storeData = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-factory-tz-'));
    const projectDir = path.join(storeData, 'github_owner_repo');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'Jira.csv'),
      [
        'Summary,Issue key,Status,Created,Updated,Assignee,Labels,Description,Comment',
        'Timezone test,KAN-1,To Do,09/Oct/26 12:15 PM,09/Oct/26 12:15 PM,Alice,,,',
      ].join('\n'),
      'utf8'
    );

    const config = new Configuration({
      storeData,
      githubRepository: 'owner/repo',
      issuesProvider: 'jira-csv',
      timezone: 'Europe/Madrid',
    });

    try {
      const { issuesRepository } = IssuesFactory.create(
        config,
        logger,
        new TimeZoneProvider('UTC')
      );

      const issues = await issuesRepository.getIssues({ forceRefresh: true });

      expect(issues[0].createdAt).toBe('2026-10-09T10:15:00.000Z');
    } finally {
      await fs.rm(storeData, { recursive: true, force: true });
    }
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
