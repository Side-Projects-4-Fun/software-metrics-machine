export type PipelineDashboardResponse = Awaited<
  ReturnType<typeof import('@/server/api/pipeline').pipelineAPI.dashboard>
>;

export class PipelineDashboardBuilder {
  private data: PipelineDashboardResponse = {
    summary: { total_runs: 10, in_progress: 0, queued: 0 },
    jobs_by_status: [{ Status: 'completed', Count: 10 }],
    runs_duration: [],
    runs_by: [],
    jobs_time: [],
    jobs_time_by_day: [],
    jobs_duration_by_workflow: [],
    jobs_summary: [],
    jobs_reruns_by_day: [],
    job_steps_time: [],
    job_steps_time_total_minutes: 0,
    job_steps_time_total_minutes_formatted: '0 min',
    job_steps_time_by_day: [],
  };

  build(): PipelineDashboardResponse {
    return { ...this.data };
  }
}
