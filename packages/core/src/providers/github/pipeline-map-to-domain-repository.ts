import { PipelineStep } from "../../domain";
import { PipelineRun, PipelineJob } from "../../domain/pipelines/pipeline-types";
import { WorkflowJsonResponse, WorkflowJobJsonResponse, WorkflowJobStepJsonResponse } from "./github-response-types";

export class PipelineMapToDomainRepository {
  mapPipelinesToDomain(run: WorkflowJsonResponse): PipelineRun {
    return {
      ...run,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      number: Number(run.run_number),
      startedAt: run.run_started_at,
      completedAt: run.updated_at,
      runAttempt: Number(run.run_attempt || 1),
      branch: run.head_branch,
      path: run.path,
    };
  }

  mapPipelineJobsToDomain = (job: WorkflowJobJsonResponse): PipelineJob => {
    return {
      completedAt: job.completed_at,
      conclusion: job.conclusion,
      durationSeconds: this.calculateDurationInSeconds(job.started_at, job.completed_at),
      id: job.id,
      name: job.name,
      runId: job.run_id,
      startedAt: job.started_at,
      status: job.status,
      steps: job.steps ? job.steps.map(this.mapPipelineJobsStepToDomain) : [],
    };
  };

  mapPipelineJobsStepToDomain = (step: WorkflowJobStepJsonResponse): PipelineStep => {
    return {
      name: step.name,
      status: step.status,
      conclusion: step.conclusion,
      number: step.number,
      startedAt: step.started_at,
      completedAt: step.completed_at,
    };
  };

  private normalizeJobNames(jobNames?: string[], jobName?: string | string[]): string[] {
    const rawJobNames = Array.isArray(jobName)
      ? jobName.flatMap((name) => this.parseCsvList(name))
      : this.parseCsvList(jobName);

    return [...(jobNames || []), ...rawJobNames]
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean);
  }

  private parseCsvList(value?: string): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private calculateDurationInSeconds(startedAt: string, completedAt: string): number {
    if (!startedAt || !completedAt) return 0;
    return (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000;
  }

}