import type { PipelineDashboard } from '../pipeline-types';
import type {
  PipelineEvaluation,
  PipelineBottleneckSignal,
  PipelineBottleneckSeverity,
} from '../pipeline-evaluation-types';
import { formatDuration } from '@smmachine/utils';

export class PipelineEvaluationService {
  evaluate(dashboard: PipelineDashboard): PipelineEvaluation {
    const rawSignals: Array<PipelineBottleneckSignal | null> = [
      this.evaluateDurationBottleneck(dashboard),
      this.evaluateStabilityBottleneck(dashboard),
      this.evaluateRerunBottleneck(dashboard),
      this.evaluateSlowestWorkflow(dashboard),
      this.evaluateJobBottlenecks(dashboard),
    ];

    return {
      generatedAt: new Date().toISOString(),
      signals: rawSignals.filter((s): s is PipelineBottleneckSignal => s !== null),
      summary: this.buildSummary(dashboard),
    };
  }

  private evaluateDurationBottleneck(
    dashboard: PipelineDashboard
  ): PipelineBottleneckSignal | null {
    const jobs = dashboard.jobs_time || [];
    if (jobs.length === 0) {
      return this.insufficientData('duration_top_job', 'duration');
    }

    const sortedJobs = [...jobs].sort((a, b) => b.value - a.value);
    const topJob = sortedJobs[0];

    const totalAvgTime = jobs.reduce((sum, j) => sum + j.value, 0);
    const share = totalAvgTime > 0 ? (topJob.value / totalAvgTime) * 100 : 0;

    const severity = this.severityFromThresholds(share, 40, 20);
    const count = jobs.length;

    return {
      id: 'duration_top_job',
      title: share >= 30 ? `${topJob.job_name} dominates pipeline time` : 'No single job dominates',
      description:
        share >= 30
          ? `"${topJob.job_name}" accounts for ${share.toFixed(1)}% of total job time across ${count} unique jobs — it is the primary speed bottleneck.`
          : `The slowest job ("${topJob.job_name}") uses ${share.toFixed(1)}% of total job time — work is reasonably balanced across ${count} jobs.`,
      severity,
      category: 'duration',
      metrics: [
        { label: 'Slowest job', value: topJob.job_name },
        { label: 'Avg time', value: formatDuration(topJob.value, 'minutes') },
        { label: 'Share of total', value: `${share.toFixed(1)}%` },
        { label: 'Runs', value: String(topJob.count) },
      ],
    };
  }

  private evaluateStabilityBottleneck(
    dashboard: PipelineDashboard
  ): PipelineBottleneckSignal | null {
    const summary = dashboard.jobs_summary || [];
    if (summary.length === 0) {
      return this.insufficientData('stability_worst_job', 'stability');
    }

    const sortedByFailure = [...summary]
      .filter((j) => j.total_runs >= 3)
      .sort((a, b) => b.failure_rate - a.failure_rate);
    const worstJob = sortedByFailure[0];

    if (!worstJob) {
      return {
        id: 'stability_worst_job',
        title: 'Not enough data for stability analysis',
        description: 'Need at least one job with 3+ runs to assess stability.',
        severity: 'good',
        category: 'stability',
        metrics: [],
      };
    }

    const severity = this.severityFromThresholds(worstJob.failure_rate, 20, 5);

    return {
      id: 'stability_worst_job',
      title:
        worstJob.failure_rate >= 10
          ? `High failure rate in "${worstJob.job_name}"`
          : 'Pipeline jobs are stable',
      description:
        worstJob.failure_rate >= 10
          ? `"${worstJob.job_name}" fails ${worstJob.failure_rate.toFixed(1)}% of the time (${worstJob.failure_count} of ${worstJob.total_runs} runs). This is the least stable job in your pipeline.`
          : `The least stable job ("${worstJob.job_name}") fails only ${worstJob.failure_rate.toFixed(1)}% of the time — stability is healthy.`,
      severity,
      category: 'stability',
      metrics: [
        { label: 'Worst job', value: worstJob.job_name },
        { label: 'Failure rate', value: `${worstJob.failure_rate.toFixed(1)}%` },
        { label: 'Failures / total', value: `${worstJob.failure_count}/${worstJob.total_runs}` },
        { label: 'Success rate', value: `${worstJob.success_rate.toFixed(1)}%` },
      ],
    };
  }

  private evaluateRerunBottleneck(dashboard: PipelineDashboard): PipelineBottleneckSignal | null {
    const summary = dashboard.jobs_summary || [];
    if (summary.length === 0) {
      return this.insufficientData('rerun_analysis', 'stability');
    }

    const totalRuns = summary.reduce((sum, j) => sum + j.total_runs, 0);
    const totalReruns = summary.reduce((sum, j) => sum + (j.rerun_count || 0), 0);
    const rerunRatio = totalRuns > 0 ? (totalReruns / totalRuns) * 100 : 0;

    const sortedByRerun = [...summary]
      .filter((j) => j.total_runs >= 3)
      .sort((a, b) => b.rerun_count - a.rerun_count);
    const topRerunJob = sortedByRerun[0];

    const severity = this.severityFromThresholds(rerunRatio, 15, 5);

    return {
      id: 'rerun_analysis',
      title: rerunRatio >= 10 ? 'Frequent reruns signal instability' : 'Rerun frequency is low',
      description:
        rerunRatio >= 10
          ? `${totalReruns} reruns detected out of ${totalRuns} total job runs (${rerunRatio.toFixed(1)}%). ${topRerunJob ? `"${topRerunJob.job_name}" leads with ${topRerunJob.rerun_count} reruns.` : ''} Reruns waste compute time and delay feedback.`
          : `Only ${totalReruns} reruns out of ${totalRuns} job runs (${rerunRatio.toFixed(1)}%) — your pipelines pass reliably.`,
      severity,
      category: 'stability',
      metrics: [
        { label: 'Total reruns', value: String(totalReruns) },
        { label: 'Rerun ratio', value: `${rerunRatio.toFixed(1)}%` },
        { label: 'Total job runs', value: String(totalRuns) },
        ...(topRerunJob && topRerunJob.rerun_count > 0
          ? [{ label: 'Most reruns', value: topRerunJob.job_name }]
          : []),
      ],
    };
  }

  private evaluateSlowestWorkflow(dashboard: PipelineDashboard): PipelineBottleneckSignal | null {
    const durations = dashboard.runs_duration || [];
    if (durations.length === 0) {
      return this.insufficientData('slowest_workflow', 'duration');
    }

    const sorted = [...durations].sort((a, b) => b.value - a.value);
    const slowest = sorted[0];
    const avgAll = durations.reduce((sum, d) => sum + d.value, 0) / durations.length;
    const ratio = avgAll > 0 ? slowest.value / avgAll : 1;

    const severity = this.severityFromThresholds(ratio, 2, 1.3);

    return {
      id: 'slowest_workflow',
      title:
        ratio >= 1.5
          ? `"${slowest.workflow}" is the slowest workflow`
          : 'Workflow durations are balanced',
      description:
        ratio >= 1.5
          ? `"${slowest.workflow}" averages ${formatDuration(slowest.value, 'minutes')} — ${ratio.toFixed(1)}x slower than the average workflow (${formatDuration(avgAll, 'minutes')}). This is the throughput bottleneck.`
          : `The slowest workflow ("${slowest.workflow}") at ${formatDuration(slowest.value, 'minutes')} is only ${ratio.toFixed(1)}x the average (${formatDuration(avgAll, 'minutes')}) — durations are well balanced.`,
      severity,
      category: 'duration',
      metrics: [
        { label: 'Slowest workflow', value: slowest.workflow },
        { label: 'Avg duration', value: formatDuration(slowest.value, 'minutes') },
        { label: 'vs. average', value: `${ratio.toFixed(1)}x` },
        { label: 'Total runs', value: String(slowest.total_runs) },
      ],
    };
  }

  private evaluateJobBottlenecks(dashboard: PipelineDashboard): PipelineBottleneckSignal {
    const durByWorkflow = dashboard.jobs_duration_by_workflow || [];
    const jobsByStatus = dashboard.jobs_by_status || [];

    const failureCount = jobsByStatus
      .filter((j) => j.Status.toLowerCase() === 'failure')
      .reduce((sum, j) => sum + j.Count, 0);
    const totalCount = jobsByStatus.reduce((sum, j) => sum + j.Count, 0);
    const failureRatio = totalCount > 0 ? (failureCount / totalCount) * 100 : 0;

    const severity = this.severityFromThresholds(failureRatio, 15, 5);
    const workflowCount = durByWorkflow.length;

    return {
      id: 'job_overview',
      title:
        failureRatio >= 10
          ? `${failureRatio.toFixed(1)}% of job executions fail`
          : 'Pipeline job health is good',
      description:
        workflowCount > 0
          ? `Across ${workflowCount} workflow${workflowCount !== 1 ? 's' : ''}, ${totalCount} total job executions with ${failureCount} failures (${failureRatio.toFixed(1)}% failure rate).`
          : `${totalCount} total job executions with ${failureCount} failures.`,
      severity,
      category: 'stability',
      metrics: [
        { label: 'Total job runs', value: String(totalCount) },
        { label: 'Failures', value: String(failureCount) },
        { label: 'Failure rate', value: `${failureRatio.toFixed(1)}%` },
        { label: 'Workflows', value: String(workflowCount) },
      ],
    };
  }

  private buildSummary(dashboard: PipelineDashboard): PipelineEvaluation['summary'] {
    const s = dashboard.summary;
    const jobs = dashboard.jobs_time || [];
    const sortedJobs = [...jobs].sort((a, b) => b.value - a.value);
    const bottleneckJob = sortedJobs[0];
    const totalAvgTime = jobs.reduce((sum, j) => sum + j.value, 0);
    const bottleneckShare =
      totalAvgTime > 0 && bottleneckJob ? (bottleneckJob.value / totalAvgTime) * 100 : 0;

    const durations = dashboard.runs_duration || [];
    const sortedDur = [...durations].sort((a, b) => b.value - a.value);

    const summary = dashboard.jobs_summary || [];
    const totalReruns = summary.reduce((sum, j) => sum + (j.rerun_count || 0), 0);

    return {
      totalRuns: s?.total_runs || 0,
      durationMinutes: s?.value || 0,
      method: s?.method || 'average',
      successRate: s?.success_rate || 0,
      failureRate: s?.success_rate ? 100 - s.success_rate : 0,
      totalReruns,
      bottleneckJob: bottleneckJob?.job_name,
      bottleneckJobSharePercent: Math.round(bottleneckShare),
      slowestWorkflow: sortedDur[0]?.workflow,
    };
  }

  private severityFromThresholds(
    value: number,
    criticalThreshold: number,
    warningThreshold: number
  ): PipelineBottleneckSeverity {
    if (value >= criticalThreshold) return 'critical';
    if (value >= warningThreshold) return 'warning';
    return 'good';
  }

  private insufficientData(
    id: string,
    category: PipelineBottleneckSignal['category']
  ): PipelineBottleneckSignal {
    return {
      id,
      title: 'Not enough data',
      description: 'Run more pipeline jobs to populate this analysis.',
      severity: 'good',
      category,
      metrics: [],
    };
  }
}
