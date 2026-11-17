import type { Logger } from '@smmachine/utils';
import type { Configuration } from '../../../infrastructure';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import type { IssueProvider } from '../../../domain-types';
import type { IIssuesClient } from '../../../providers/issues-client';
import { JiraIssuesClient } from '../../../providers/jira/jira-client';
import { JiraCsvIssuesClient } from '../../../providers/jira/jira-csv-client';
import { GitHubIssuesClient } from '../../../providers/github/github-issues-client';
import { GitHubRateLimitManager } from '../../../providers/github/github-rate-limit-manager';
import { IssuesRepository } from '../issues-repository';

export interface IssuesDependencies {
  issuesRepository: IssuesRepository;
  provider: IssueProvider;
}

export class IssuesFactory {
  static create(
    config: Configuration,
    logger: Logger,
    timeZoneProvider: TimeZoneProvider
  ): IssuesDependencies {
    const client = IssuesFactory.createClient(config, logger);
    const issuesRepository = new IssuesRepository(
      client,
      config.getIssuesPath(),
      logger,
      timeZoneProvider,
      config
    );

    return { issuesRepository, provider: client.provider };
  }

  static createClient(
    config: Configuration,
    logger: Logger,
    timeZoneProvider: TimeZoneProvider = new TimeZoneProvider(config.timezone || 'UTC')
  ): IIssuesClient {
    const provider = config.issuesProvider || 'jira';

    if (provider === 'github') {
      const repository = config.githubRepository;
      const [owner, repo] = (repository || '').split('/');

      if (!owner || !repo) {
        throw new Error(
          'GitHub issues provider requires github_repository in owner/repo format. Check smm_config.json.'
        );
      }

      if (!config.githubToken) {
        throw new Error(
          'GitHub issues provider requires github_token. Check smm_config.json or the project environment variables.'
        );
      }

      return new GitHubIssuesClient(
        config.githubToken,
        owner,
        repo,
        new GitHubRateLimitManager(logger),
        logger
      );
    }

    if (provider === 'jira-csv') {
      return new JiraCsvIssuesClient(
        config.getJiraCsvPath(),
        logger,
        timeZoneProvider,
        config.jiraUrl
      );
    }

    return new JiraIssuesClient(
      config.jiraUrl || '',
      config.jiraEmail || '',
      config.jiraToken || '',
      config.jiraProject || '',
      logger
    );
  }
}
