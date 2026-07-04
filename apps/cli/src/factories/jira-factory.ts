import { IssuesRepository } from '@smmachine/core/aggregates/issues-repository-json';
import { Configuration } from '@smmachine/core/infrastructure/configuration';
import { TimeZoneProvider } from '@smmachine/core/infrastructure/timezone-provider';
import { JiraIssuesClient } from '@smmachine/core/providers/jira/jira-client';
import type { Logger } from '@smmachine/utils';

export function createJiraDependencies(
  config: Configuration,
  jiraDirectory: string,
  logger: Logger
): {
  issuesRepository: IssuesRepository;
} {
  const jiraClient = new JiraIssuesClient(
    config.jiraUrl || '',
    config.jiraEmail || '',
    config.jiraToken || '',
    config.jiraProject || '',
    logger
  );

  return {
    issuesRepository: new IssuesRepository(
      jiraClient,
      jiraDirectory,
      logger,
      new TimeZoneProvider(config.timezone),
      config
    ),
  };
}
