import Card from '@mui/material/Card';
import { DashboardFilters, defaultFilters, parseDashboardFilters } from "@/components/filters/DashboardFilters";
import { CardContent, CardHeader } from '@mui/material';
import { sourceCodeAPI, pipelineAPI, pullRequestAPI, ApiParams } from '@/server/api';
import { DeploymentFrequency } from '@/components/charts/DeploymentFrequency';
import { Recommendations } from '@/components/charts/Recommendations';
import { ContextLink } from '@/components/filters/ContextLink';
import { AverageReviewTimeItem, DeploymentFrequencyPoint, DeploymentFrequencyResponseItem, JobsSummaryItem, PairingIndex, PipelineSummary, PullRequestSummary, ResultWrapper } from './insights-types';
import { buildPullRequestApiParams } from '@/server/utils/apiParams';

function unwrapResult<T>(data: T | ResultWrapper<T>): T {
  if (typeof data === 'object' && data !== null && 'result' in data) {
    return data.result;
  }
  return data;
}

function buildSourceCodeApiParams(filters: DashboardFilters): ApiParams {
  return {
    start_date: filters.startDate,
    end_date: filters.endDate,
    timezone: filters.timezone,
    authors: filters.authorSelect && filters.authorSelect.length > 0 ? filters.authorSelect.join(',') : undefined,
  };
}

function buildPipelineApiParams(filters: DashboardFilters): ApiParams {
  return {
    start_date: filters.startDate,
    end_date: filters.endDate,
    timezone: filters.timezone,
    workflow_path: filters.workflowSelector,
    status: filters.workflowStatus?.length ? filters.workflowStatus.join(',') : undefined,
    conclusion: filters.workflowConclusions?.length ? filters.workflowConclusions.join(',') : undefined,
    job_name: filters.jobSelector?.length ? filters.jobSelector.join(',') : undefined,
    branch: filters.branch?.length ? filters.branch.join(',') : undefined,
    event: filters.event?.length ? filters.event.join(',') : undefined,
    metric: filters.aggregateMetric,
  };
}

function extractDate(value?: { created?: string; createdAt?: string; created_at?: string } | string | null): string | null {
  const formatDate = (rawDate: string): string | null => {
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return formatDate(value);
  }

  const raw = value.created || value.createdAt || value.created_at;
  if (!raw) {
    return null;
  }

  return formatDate(raw);
}

export default async function InsightsSection({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseDashboardFilters(await searchParams ?? {}, defaultFilters);

  let pairingIndex: PairingIndex | null = null;
  let pipelineSummary: PipelineSummary | null = null;
  let prSummary: PullRequestSummary | null = null;
  let deploymentFrequency: DeploymentFrequencyPoint[] = [];
  let jobsSummary: JobsSummaryItem[] = [];
  let averageReviewTime: AverageReviewTimeItem[] = [];

  try {
    const sourceCodeParams = buildSourceCodeApiParams(filters);
    const pullRequestParams = buildPullRequestApiParams(filters);
    const pipelineParams = buildPipelineApiParams(filters);
    const [pairing, pipeline, pr, deployment, jobs, reviewTime] = await Promise.all([
      sourceCodeAPI.pairingIndex(sourceCodeParams),
      pipelineAPI.summary(pipelineParams),
      pullRequestAPI.summary(pullRequestParams),
      pipelineAPI.deploymentFrequency(pipelineParams),
      pipelineAPI.jobsSummary(pipelineParams),
      pullRequestAPI.averageReviewTime(pullRequestParams),
    ]);
    const prData = unwrapResult(pr as PullRequestSummary | ResultWrapper<PullRequestSummary>);
    const pairingData = unwrapResult(pairing as PairingIndex | ResultWrapper<PairingIndex>);
    const pipelineData = unwrapResult(pipeline as PipelineSummary | ResultWrapper<PipelineSummary>);
    const deploymentResult = unwrapResult(
      deployment as DeploymentFrequencyResponseItem[] | ResultWrapper<DeploymentFrequencyResponseItem[]>
    );
    const deploymentData = Array.isArray(deploymentResult) ? deploymentResult
      .map((d: DeploymentFrequencyResponseItem): DeploymentFrequencyPoint => {
        const dateStr = d.days || 'Unknown';
        // Extract month from date (YYYY-MM-DD -> YYYY-MM)
        const month = dateStr !== 'Unknown' ? dateStr.substring(0, 7) : 'Unknown';
        const pipeline = d.pipeline || 'Deployment pipeline';
        const job = d.job || 'Deployment job';
        return {
          pipeline,
          job,
          target_label: `${pipeline} / ${job}`,
          date: dateStr,
          week_label: d.weeks || 'Unknown',
          month_label: d.months || month,
          month: month,
          day_count: d.daily_counts || 0,
          week_count: d.weekly_counts || 0,
          month_count: d.monthly_counts || 0,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      : [];

    pairingIndex = pairingData || null;
    pipelineSummary = pipelineData || null;
    prSummary = prData;
    deploymentFrequency = deploymentData;
    const jobsResult = unwrapResult(
      jobs as JobsSummaryItem[] | ResultWrapper<JobsSummaryItem[]>
    );
    jobsSummary = Array.isArray(jobsResult)
      ? jobsResult.map((job: JobsSummaryItem): JobsSummaryItem => ({
          workflow_name: job.workflow_name,
          job_name: job.job_name || 'Unknown',
          total_runs: job.total_runs || 0,
          value: job.value || 0,
          value_formatted: job.value_formatted,
          method: job.method,
          success_count: job.success_count || 0,
          failure_count: job.failure_count || 0,
          success_rate: job.success_rate || 0,
          failure_rate: job.failure_rate || 0,
          rerun_count: job.rerun_count || 0,
        }))
      : [];


    const reviewTimeResult = unwrapResult(
      reviewTime as AverageReviewTimeItem[] | ResultWrapper<AverageReviewTimeItem[]>
    );
    averageReviewTime = Array.isArray(reviewTimeResult)
      ? reviewTimeResult.map((item: AverageReviewTimeItem): AverageReviewTimeItem => ({
          author: item.author || 'Unknown',
          value: item.value || 0,
          value_formatted: item.value_formatted,
          method: item.method,
        }))
      : [];

  } catch (error) {
    console.error('Error fetching insights:', error);
    pairingIndex = null;
    pipelineSummary = null;
    prSummary = null;
    deploymentFrequency = [];
    jobsSummary = [];
    averageReviewTime = [];
  }

  const pipelineFirstDataPoint = extractDate(pipelineSummary?.first_run);
  const pipelineLastDataPoint = extractDate(pipelineSummary?.last_run);
  const prFirstDataPoint = extractDate(prSummary?.first_pr);
  const prLastDataPoint = extractDate(prSummary?.last_pr);
  
  return (
    <div className="space-y-6">
      <Recommendations
        pairingIndex={pairingIndex}
        prSummary={
          prSummary
            ? {
                total: prSummary.total_prs ?? prSummary.total ?? 0,
                merged: prSummary.merged_prs ?? prSummary.merged ?? 0,
                closed: prSummary.closed_prs ?? prSummary.closed ?? 0,
                open: prSummary.open_prs ?? prSummary.open ?? 0,
              }
            : null
        }
        deploymentFrequency={deploymentFrequency}
        jobsSummary={jobsSummary}
        selectedWorkflow={filters.workflowSelector}
        averageReviewTime={averageReviewTime}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader title="Pairing Index">
            <CardContent>Team collaboration metric</CardContent>
          </CardHeader>
          <CardContent>
            <ContextLink
              href="/dashboard/source-code"
              className="group block cursor-pointer"
            >
              <div className="text-4xl font-bold group-hover:text-blue-600 transition-colors">
                {pairingIndex?.pairing_index_percentage?.toFixed(2) || 0}%
              </div>
              <p className="text-sm text-muted-foreground mt-2 group-hover:text-gray-900 transition-colors">
                {pairingIndex?.paired_commits || 0} of {pairingIndex?.total_analyzed_commits || 0} commits
              </p>
            </ContextLink>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Pipeline Runs">
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{pipelineSummary?.total_runs || 0}</div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
              <ContextLink
                href="/dashboard/pipelines"
                filterOverrides={{ workflowConclusions: ['success'], workflowStatus: ['completed'] }}
                className="text-green-600 font-semibold cursor-pointer hover:text-green-800 hover:underline transition-colors"
              >
                ✓ Success
              </ContextLink>
              <ContextLink
                href="/dashboard/pipelines"
                filterOverrides={{ workflowStatus: ['in_progress'] }}
                className="text-yellow-600 font-semibold cursor-pointer hover:text-yellow-800 hover:underline transition-colors"
              >
                {pipelineSummary?.in_progress || 0} In Progress
              </ContextLink>
              <ContextLink
                href="/dashboard/pipelines"
                filterOverrides={{ workflowStatus: ['queued'] }}
                className="text-blue-600 font-semibold cursor-pointer hover:text-blue-800 hover:underline transition-colors"
              >
                {pipelineSummary?.queued || 0} Queued
              </ContextLink>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Data frame: {pipelineFirstDataPoint || '-'} to {pipelineLastDataPoint || '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Pull Requests">
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{prSummary?.total_prs || prSummary?.total || 0}</div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
              <ContextLink 
                href="/dashboard/pull-requests" 
                filterOverrides={{ pullRequestStatus: 'merged' }}
                className="text-green-600 font-semibold cursor-pointer hover:text-green-800 hover:underline transition-colors"
              >
                {prSummary?.merged_prs || prSummary?.merged || 0} Merged
              </ContextLink>
              <ContextLink 
                href="/dashboard/pull-requests" 
                filterOverrides={{ pullRequestStatus: 'closed' }}
                className="text-gray-600 font-semibold cursor-pointer hover:text-gray-800 hover:underline transition-colors"
              >
                {prSummary?.closed_prs || prSummary?.closed || 0} Closed
              </ContextLink>
              <ContextLink 
                href="/dashboard/pull-requests" 
                filterOverrides={{ pullRequestStatus: 'open' }}
                className="text-blue-600 font-semibold cursor-pointer hover:text-blue-800 hover:underline transition-colors"
              >
                {prSummary?.open_prs || prSummary?.open || 0} Open
              </ContextLink>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Data frame: {prFirstDataPoint || '-'} to {prLastDataPoint || '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Deployment Frequency" />
        <CardContent>
          <DeploymentFrequency deploymentFrequency={deploymentFrequency} />
        </CardContent>
      </Card>
    </div>
  );
}
