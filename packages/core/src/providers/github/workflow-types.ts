import type { PipelineRun } from '../../domain';
import type { WorkflowJobJsonResponse, WorkflowJsonResponse } from './github-response-types';

export type GitHubWorkflowFilters = { rawFilters?: string; created?: string; byDay?: boolean };
export type GitHubWorkflowResponse = { runs: WorkflowJsonResponse[]; hasNext: boolean };
export type GitHubWorkflowJobFilters = { rawFilters?: string };
export type GitHubWorkflowJobResponse = { jobs: WorkflowJobJsonResponse[]; hasNext: boolean };

export interface IGithubWorkflowClient {
  fetchWorkflows(options?: GitHubWorkflowFilters): Promise<PipelineRun[]>;

  fetchWorkflowRunsPage(
    page: number,
    perPage?: number,
    options?: GitHubWorkflowFilters
  ): Promise<GitHubWorkflowResponse>;
}

export interface IGithubWorkflowJobClient {
  fetchJobsPage(
    runId: string,
    page: number,
    perPage?: number,
    options?: GitHubWorkflowJobFilters
  ): Promise<GitHubWorkflowJobResponse>;
}
