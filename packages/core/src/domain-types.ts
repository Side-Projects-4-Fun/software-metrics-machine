import type { PipelineStep } from './domain';

export interface Commit {
  author: string;
  msg: string;
  hash: string;
  timestamp: string | Date;
  email?: string;
  subject?: string;
  coAuthors?: string[];
  files?: CodeChange[];
}

export interface CodeChange {
  path: string;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

export interface PairingIndexResult {
  pairingIndexPercentage: number;
  totalAnalyzedCommits: number;
  pairedCommits: number;
  topPairings?: PairingAuthorsStat[];
  latestPairedCommits?: PairedCommitSummary[];
}

export interface PairingAuthorsStat {
  author: string;
  coAuthor: string;
  pairedCommits: number;
}

export interface PairedCommitSummary {
  hash: string;
  author: string;
  coAuthors: string[];
  timestamp: string;
  subject: string;
}

export interface TraverserResult {
  totalAnalyzedCommits: number;
  pairedCommits: number;
  commits: Commit[];
}

export interface ChangeRequestUser {
  login: string;
  id: number;
}

export interface ChangeRequestLabel {
  name: string;
  description?: string;
}

export interface ChangeRequestDetails {
  id: number;
  number: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  closedAt?: string;
  author: ChangeRequestUser;
  labels: ChangeRequestLabel[];
  state: 'open' | 'closed' | 'merged' | 'draft';
  url: string;
  comments: number;
}

export interface PipelineJob {
  id: string;
  runId: string;
  name: string;
  startedAt: string;
  completedAt?: string;
  conclusion: string;
  status: string;
  durationSeconds?: number;
  steps?: PipelineStep[];
}

export interface PipelineRun {
  id: string;
  runAttempt: number;
  number: number;
  name: string;
  status: string;
  conclusion?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  branch: string;
  commit?: string;
  path: string;
  jobs?: PipelineJob[];
  durationSeconds?: number;
}

export type IssueProvider = 'jira' | 'github' | 'jira-csv';

export interface Issue {
  id: string;
  key?: string;
  title: string;
  description?: string;
  status: string;
  assignee?: string;
  createdAt: string;
  labels?: string[];
  provider?: IssueProvider;
  url?: string;
  updatedAt?: string;
  closedAt?: string;
}

export interface IssueComment {
  id: string;
  issueKey: string;
  author?: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  url?: string;
  provider?: IssueProvider;
}

export interface CodeMetric {
  name: string;
  value: number;
  unit?: string;
  timestamp: string;
  file?: string;
}
