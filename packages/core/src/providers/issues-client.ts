import type { Issue, IssueComment, IssueProvider } from '../domain-types';

export type { IssueProvider };

export interface IssueQueryOptions {
  startDate?: string;
  endDate?: string;
  status?: string;
  issueType?: string;
  labels?: string[];
  project?: string;
}

export interface IssueCommentQueryOptions {
  /**
   * When set, fetch comments for this single issue.
   * Jira expects a key such as `PROJ-123`; GitHub accepts `123` or `#123`.
   */
  issueKey?: string;
  /** Comment-creation window. Ignored when `issueKey` is set. */
  startDate?: string;
  endDate?: string;
}

/**
 * Provider-neutral contract for issue trackers.
 *
 * Implementations live under `providers/<vendor>` and are selected once by
 * `IssuesFactory`. The domain never imports a vendor client directly.
 */
export interface IIssuesClient {
  readonly provider: IssueProvider;
  fetchIssues(options?: IssueQueryOptions): Promise<Issue[]>;
  fetchComments(options?: IssueCommentQueryOptions): Promise<IssueComment[]>;
}
