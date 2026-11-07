import { readFile } from 'fs/promises';
import type { Logger } from '@smmachine/utils';
import type { Issue, IssueComment } from '../../domain-types';
import type { IIssuesClient, IssueCommentQueryOptions, IssueQueryOptions } from '../issues-client';
import { TimeZoneProvider } from '../../infrastructure/timezone-provider';
import type { JiraCsvRecord } from './jira-csv-parser';
import { parseJiraCsv } from './jira-csv-parser';

function isFileNotFound(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ENOENT'
  );
}

function isWithinWindow(value: string | undefined, start?: string, end?: string): boolean {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  if (start) {
    const startTimestamp = new Date(start).getTime();
    if (!Number.isNaN(startTimestamp) && timestamp < startTimestamp) {
      return false;
    }
  }

  if (end) {
    const endTimestamp = new Date(end).getTime();
    if (!Number.isNaN(endTimestamp) && timestamp > endTimestamp) {
      return false;
    }
  }

  return true;
}

/**
 * File-backed Jira issue source.
 *
 * Reads the CSV export users place at `<project data dir>/Jira.csv`. It
 * implements the same contract as the Jira API client, so the repository,
 * CLI, REST API and MCP server do not need a file-specific path.
 */
export class JiraCsvIssuesClient implements IIssuesClient {
  readonly provider = 'jira-csv' as const;

  constructor(
    private readonly filePath: string,
    private readonly logger: Logger,
    private readonly timeZoneProvider: TimeZoneProvider = new TimeZoneProvider('UTC'),
    private readonly jiraUrl?: string
  ) {}

  async fetchIssues(options?: IssueQueryOptions): Promise<Issue[]> {
    const records = await this.loadRecords();
    const status = options?.status?.toLowerCase();
    const issueType = options?.issueType?.toLowerCase();
    const labels = options?.labels?.map((label) => label.toLowerCase());

    return records
      .filter((record) => {
        const createdInWindow = isWithinWindow(
          record.createdAt,
          options?.startDate,
          options?.endDate
        );
        // Incremental fetches use the latest cached updatedAt as `startDate`.
        // Include issues updated in that window even when they were created earlier.
        const updatedInWindow = options?.startDate
          ? isWithinWindow(record.updatedAt ?? record.createdAt, options.startDate, options.endDate)
          : false;

        if (!createdInWindow && !updatedInWindow) {
          return false;
        }
        if (status && record.status.toLowerCase() !== status) {
          return false;
        }
        if (issueType && (record.issueType ?? '').toLowerCase() !== issueType) {
          return false;
        }
        if (options?.project && record.projectKey !== options.project) {
          return false;
        }
        if (labels && labels.length > 0) {
          const recordLabels = record.labels.map((label) => label.toLowerCase());
          if (!labels.some((label) => recordLabels.includes(label))) {
            return false;
          }
        }
        return true;
      })
      .map((record) => this.toDomainIssue(record));
  }

  async fetchComments(options?: IssueCommentQueryOptions): Promise<IssueComment[]> {
    const records = await this.loadRecords();

    if (options?.issueKey) {
      const record = records.find((candidate) => candidate.key === options.issueKey);
      return record ? this.toDomainComments(record) : [];
    }

    return records
      .flatMap((record) => this.toDomainComments(record))
      .filter((comment) => isWithinWindow(comment.createdAt, options?.startDate, options?.endDate));
  }

  private async loadRecords(): Promise<JiraCsvRecord[]> {
    try {
      this.logger.info(`Reading Jira CSV export from ${this.filePath}`);
      const content = await readFile(this.filePath, 'utf8');
      const records = parseJiraCsv(content, this.timeZoneProvider);
      this.logger.info(`Parsed ${records.length} Jira CSV records`);
      return records;
    } catch (error) {
      if (isFileNotFound(error)) {
        throw new Error(
          `Jira CSV export not found at ${this.filePath}. Place the export at this path or switch issues_provider.`
        );
      }
      throw error;
    }
  }

  private toDomainIssue(record: JiraCsvRecord): Issue {
    return {
      id: record.id,
      key: record.key,
      title: record.title,
      description: record.description,
      status: record.status,
      assignee: record.assignee,
      createdAt: record.createdAt,
      labels: record.labels,
      provider: 'jira-csv',
      updatedAt: record.updatedAt,
      closedAt: record.closedAt,
      url: this.jiraUrl ? `${this.jiraUrl.replace(/\/$/, '')}/browse/${record.key}` : undefined,
    };
  }

  private toDomainComments(record: JiraCsvRecord): IssueComment[] {
    return record.comments.map((comment, index) => ({
      id: `${record.key}-comment-${index + 1}`,
      issueKey: record.key,
      author: comment.author,
      body: comment.body,
      createdAt: comment.createdAt,
      provider: 'jira-csv',
    }));
  }
}
