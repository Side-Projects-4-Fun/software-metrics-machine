export type PipelineFilterOptions = {
  workflows: Array<{ name: string; path: string }>;
  statuses: string[];
  conclusions: string[];
  branches: string[];
  events: string[];
  jobs: Array<{ name: string; id: string }>;
  jobsByWorkflowPath: Record<string, Array<{ name: string; id: string }>>;
};

export type PipelineFilterOptionsQuery = {
  workflowPath?: string;
};

export interface PipelineFiltersRepository {

  loadOptions(query?: PipelineFilterOptionsQuery): Promise<PipelineFilterOptions>;

  refreshOptions(): Promise<PipelineFilterOptions>;
}
