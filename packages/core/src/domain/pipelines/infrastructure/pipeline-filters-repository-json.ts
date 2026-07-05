import { PipelineFilterOptions, PipelineFilterOptionsQuery, PipelineFiltersRepository } from '..';
import { IRepository } from '../../../infrastructure';
import {
  WorkflowJobJsonResponse,
  WorkflowJsonResponse,
} from '../../../providers/github/github-response-types';

export class PipelineFiltersRepositoryJson implements PipelineFiltersRepository {
  constructor(
    private pipelineRunJsonRepository: IRepository<WorkflowJsonResponse>,
    private pipelineJobsJsonRepository: IRepository<WorkflowJobJsonResponse>,
    private pipelineFiltersJsonRepository: IRepository<PipelineFilterOptions>
  ) {}

  async loadOptions(query: PipelineFilterOptionsQuery = {}): Promise<PipelineFilterOptions> {
    const cachedOptions = await this.pipelineFiltersJsonRepository.load();
    const options = cachedOptions || (await this.refreshOptions());

    if (!query?.workflowPath) {
      return options;
    }

    return {
      ...options,
      jobs: options.jobsByWorkflowPath?.[query.workflowPath] || [],
    };
  }

  async refreshOptions(): Promise<PipelineFilterOptions> {
    const [runs, jobs] = await Promise.all([
      this.pipelineRunJsonRepository.loadAll(),
      this.pipelineJobsJsonRepository.loadAll(),
    ]);

    const workflowByPath = new Map<string, string>();
    const statuses = new Set<string>();
    const conclusions = new Set<string>();
    const branches = new Set<string>();
    const events = new Set<string>();
    const selectedRunIds = new Set<string>();
    const workflowPathByRunId = new Map<string, string>();

    for (const run of runs) {
      this.addValue(statuses, run.status);
      this.addValue(conclusions, run.conclusion);
      this.addValue(branches, run.head_branch);
      this.addValue(events, run.event);

      const path = this.trim(run.path);
      if (path) {
        workflowByPath.set(path, this.trim(run.name) || path);
        workflowPathByRunId.set(String(run.id), path);
      }

      selectedRunIds.add(String(run.id));
    }

    const jobNames = new Set<string>();
    const jobNamesByWorkflowPath = new Map<string, Set<string>>();
    for (const job of jobs) {
      const runId = String(job.run_id);
      if (!selectedRunIds.has(runId)) {
        continue;
      }

      this.addValue(jobNames, job.name);

      const workflowPath = workflowPathByRunId.get(runId);
      const jobName = this.trim(job.name);
      if (workflowPath && jobName) {
        if (!jobNamesByWorkflowPath.has(workflowPath)) {
          jobNamesByWorkflowPath.set(workflowPath, new Set<string>());
        }
        jobNamesByWorkflowPath.get(workflowPath)!.add(jobName);
      }
    }

    const options = {
      workflows: Array.from(workflowByPath.entries())
        .map(([path, name]) => ({ name, path }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      statuses: this.sortedValues(statuses),
      conclusions: this.sortedValues(conclusions),
      branches: this.sortedValues(branches),
      events: this.sortedValues(events),
      jobs: this.sortedValues(jobNames).map((name) => ({ name, id: name })),
      jobsByWorkflowPath: Object.fromEntries(
        Array.from(jobNamesByWorkflowPath.entries()).map(([workflowPath, names]) => [
          workflowPath,
          this.sortedValues(names).map((name) => ({ name, id: name })),
        ])
      ),
    };

    await this.pipelineFiltersJsonRepository.save(options);
    return options;
  }

  private addValue(target: Set<string>, value?: string | null): void {
    const normalized = this.trim(value);
    if (normalized) {
      target.add(normalized);
    }
  }

  private trim(value?: string | null): string {
    return (value || '').trim();
  }

  private sortedValues(values: Set<string>): string[] {
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }
}
