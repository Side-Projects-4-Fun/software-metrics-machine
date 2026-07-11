/**
 * Core Domain Types
 * Migrated from: api/src/software_metrics_machine/core/code_types.py
 */

import { PipelineStep } from './domain';

/**
 * Represents a Git commit
 */
export interface Commit {
  author: string;
  msg: string;
  hash: string;
  timestamp: string | Date; // ISO format or Date object
  email?: string;
  subject?: string;
  coAuthors?: string[];
  files?: CodeChange[];
}

/**
 * Represents a code change/diff
 */
export interface CodeChange {
  path: string;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

/**
 * Pairing index calculation result
 */
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

/**
 * Traverser result for commit analysis
 */
export interface TraverserResult {
  totalAnalyzedCommits: number;
  pairedCommits: number;
  commits: Commit[];
}

/**
 * Pull request information
 */
export interface PRUser {
  login: string;
  id: number;
}

export interface PRLabel {
  name: string;
  description?: string;
}

// export interface PullRequest {
//   id: number;
//   number: number;
//   title: string;
//   body?: string;
//   author: PRUser;
//   url: string;
//   createdAt: string; // ISO format
//   updatedAt: string;
//   closedAt?: string;
//   mergedAt?: string;
//   state: 'open' | 'closed' | 'merged' | 'draft';
//   additions?: number;
//   deletions?: number;
//   filesChanged?: number;
//   labels?: PRLabel[];
//   comments?: number;
// }

/**
 * Detailed pull request for analytics
 */
export interface PRDetails {
  id: number;
  number: number;
  title: string;
  createdAt: string; // ISO format
  updatedAt: string;
  mergedAt?: string; // null if not merged
  closedAt?: string;
  author: PRUser;
  labels: PRLabel[];
  state: 'open' | 'closed' | 'merged' | 'draft';
  url: string;
  comments: number;
}

/**
 * CI/CD Pipeline run information
 */
export interface PipelineJob {
  id: string;
  runId: string;
  name: string;
  startedAt: string; // ISO format
  completedAt?: string;
  conclusion: string; // success, failure, cancelled, skipped, timed_out
  status: string;
  durationSeconds?: number;
  steps?: PipelineStep[];
}

export interface PipelineRun {
  id: string;
  runAttempt: number;
  number: number;
  name: string;
  status: string; // completed, in_progress, queued
  conclusion?: string;
  createdAt: string; // ISO format
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  branch: string;
  commit?: string;
  path: string;
  jobs?: PipelineJob[];
  durationSeconds?: number;
}

/**
 * Issue/Ticket information
 */
export interface Issue {
  id: string;
  key?: string;
  title: string;
  description?: string;
  status: string;
  assignee?: string;
  createdAt: string;
  labels?: string[];
}

/**
 * Code metric measurement
 */
export interface CodeMetric {
  name: string;
  value: number;
  unit?: string;
  timestamp: string;
  file?: string;
}
