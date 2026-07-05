import { PipelineJob, PipelineRun } from '../pipeline-types';
import { type WeekendsMode } from '../../metric-samples';

export type LoadPipelinesOptions = {
  includeJobs?: boolean;
  startDate?: string;
  endDate?: string;
  weekends?: WeekendsMode;
  workflowPath?: string;
  status?: string;
  conclusion?: string;
  targetBranch?: string;
  event?: string;
  jobName?: string;
  jobNames?: string[];
  excludeJobName?: string | string[];
  jobConclusion?: string;
  rawFilters?: string;
  sort_by?: {
    created_at?: 'asc' | 'desc';
  };
};

export interface PipelinesRepository {
  loadPipelines(options?: LoadPipelinesOptions): Promise<PipelineRun[]>;
  loadPipelineJobs(): Promise<PipelineJob[]>;
}
