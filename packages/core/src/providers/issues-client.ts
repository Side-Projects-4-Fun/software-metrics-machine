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
  issueKey?: string;

  startDate?: string;
  endDate?: string;
}

export interface IIssuesClient {
  readonly provider: IssueProvider;
  fetchIssues(options?: IssueQueryOptions): Promise<Issue[]>;
  fetchComments(options?: IssueCommentQueryOptions): Promise<IssueComment[]>;
}
