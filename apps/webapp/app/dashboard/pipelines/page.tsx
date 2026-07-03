import { pipelineAPI } from '@/server/api';
import { buildPipelineApiParams } from '@/server/utils/apiParams';
import {
  JobsAverageTimeData,
  JobsAverageTimeResponseItem,
  JobsAverageTimeByDayResponseItem,
  JobsAverageTimeByDayData,
  JobByStatusData,
  JobByStatusResponseItem,
  JobsDurationByWorkflowItem,
  JobSummaryData,
  JobSummaryResponseItem,
  JobRerunsByDayData,
  JobRerunsByDayResponseItem,
  RunsByDayData,
  RunsByResponseItem,
  RunsDurationData,
  RunsDurationResponseItem,
  JobStepsAverageTimeData,
  JobStepsAverageTimeResponseItem,
  JobStepsAverageTimeByDayData,
  JobStepsAverageTimeByDayResponseItem,
  PipelineSummaryResponse,
} from '@/components/charts/pipeline/types';
import { defaultFilters, parseDashboardFilters } from '@/components/filters/DashboardFilters';
import PipelineRunsDurationCard from '@/components/charts/pipeline/PipelineRunsDurationCard';
import JobsAverageTimeCard from '@/components/charts/pipeline/JobsAverageTimeCard';
import JobsByStatusCard from '@/components/charts/pipeline/JobsByStatusCard';
import JobsRerunCard from '@/components/charts/pipeline/JobsRerunCard';
import JobStepsAnalysis from '@/components/charts/pipeline/JobStepsAnalysis';
import { Card, CardContent } from '@/components/ui/card';
import { toOutlierRows } from '@/components/charts/outliers-utils';
import OutliersCard, { MetricOutlierRow } from '@/components/charts/OutliersCard';

type ResultWrapper<T> = {
  result: T;
};

function unwrapResult<T>(data: T | ResultWrapper<T>): T {
  if (typeof data === 'object' && data !== null && 'result' in data) {
    return data.result;
  }
  return data;
}

export default async function PipelinesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseDashboardFilters(await searchParams ?? {}, defaultFilters);
  let jobsByStatus: JobByStatusData[] = [];
  let runsDurationByAggregation: Record<'avg' | 'min' | 'max', RunsDurationData[]> = {
    avg: [],
    min: [],
    max: [],
  };
  let runsByDay: RunsByDayData[] = [];
  let jobsAvgTime: JobsAverageTimeData[] = [];
  let jobsAvgTimeByDay: JobsAverageTimeByDayData[] = [];
  let jobsDurationByWorkflow: JobsDurationByWorkflowItem[] = [];
  let jobsSummary: JobSummaryData[] = [];
  let jobsRerunsByDay: JobRerunsByDayData[] = [];
  let jobStepsTime: JobStepsAverageTimeData[] = [];
  let jobStepsTimeByDay: JobStepsAverageTimeByDayData[] = [];
  let totalRuns = 0;
  let outliers: MetricOutlierRow[] = [];

  const isSingleJobSelected = filters.jobSelector && filters.jobSelector.length === 1;

  try {
    const apiParams = buildPipelineApiParams(filters);
    const [
      summary,
      jobs,
      duration,
      runsBy,
      avgTime,
      avgTimeByDay,
      jobsDurationRaw,
      jobsSummaryRaw,
      jobsRerunsByDayRaw,
      jobStepsTimeRaw,
      jobStepsTimeByDayRaw,
    ] = await Promise.all([
      pipelineAPI.summary(apiParams),
      pipelineAPI.jobsByStatus(apiParams),
      pipelineAPI.runsDuration(apiParams),
      pipelineAPI.runsBy({ ...apiParams, aggregate_by: 'day' }),
      pipelineAPI.jobsAverageTime(apiParams),
      pipelineAPI.jobsAverageTimeByDay(apiParams),
      pipelineAPI.jobsDurationByWorkflow(apiParams),
      pipelineAPI.jobsSummary(apiParams),
      pipelineAPI.jobsRerunsByDay(apiParams),
      pipelineAPI.jobStepsAverageTime(apiParams),
      pipelineAPI.jobStepsAverageTimeByDay(apiParams),
    ]);

    const summaryResult = unwrapResult(summary as PipelineSummaryResponse | ResultWrapper<PipelineSummaryResponse>);
    totalRuns = summaryResult?.total_runs || 0;

    // Handle jobsByStatus - Status and Count fields
    const jobsResult = unwrapResult(jobs as JobByStatusResponseItem[] | ResultWrapper<JobByStatusResponseItem[]>);
    const jobsData = Array.isArray(jobsResult) ? jobsResult.map((j: JobByStatusResponseItem): JobByStatusData => ({
      status: (j.Status || 'unknown').toLowerCase(),
      count: j.Count || 0,
    })) : [];

    // Handle runsDuration - read all API-computed aggregations from a single response
    const durationResult = unwrapResult(
      duration as RunsDurationResponseItem[] | ResultWrapper<RunsDurationResponseItem[]>
    );
    const durationData = Array.isArray(durationResult)
      ? durationResult.map((d: RunsDurationResponseItem): RunsDurationData => ({
          workflow: d.workflow || d.name || 'Unknown',
          avg_duration: d.avg_duration ?? d.value ?? 0,
          min_duration: d.min_duration ?? 0,
          max_duration: d.max_duration ?? 0,
          total_runs: d.total_runs ?? 0,
          name: d.name,
          value: d.value,
          outliers: d.outliers,
        }))
      : [];

    const runsByResult = unwrapResult(
      runsBy as RunsByResponseItem[] | ResultWrapper<RunsByResponseItem[]>
    );
    const runsByDayData = Array.isArray(runsByResult)
      ? runsByResult.reduce((acc: Map<string, number>, item: RunsByResponseItem) => {
          const day = item.period || '';
          if (!day) {
            return acc;
          }

          acc.set(day, (acc.get(day) || 0) + Number(item.runs || 0));
          return acc;
        }, new Map<string, number>())
      : new Map<string, number>();

    // Handle jobsAverageTime - unwrap if needed and transform
    let avgTimeData: JobsAverageTimeData[] = [];
    const avgTimeResult = unwrapResult(
      avgTime as JobsAverageTimeResponseItem[] | ResultWrapper<JobsAverageTimeResponseItem[]>
    );
    if (Array.isArray(avgTimeResult)) {
      avgTimeData = avgTimeResult.map((a: JobsAverageTimeResponseItem): JobsAverageTimeData => ({
        job_name: a.job_name || 'Unknown',
        workflow_name: a.workflow_name,
        avg_time: a.avg_time || 0,
        count: a.count || 0,
        outliers: a.outliers,
      }));
    }

    // Handle jobsAverageTimeByDay - unwrap if needed and transform
    let avgTimeByDayData: JobsAverageTimeByDayData[] = [];
    const avgTimeByDayResult = unwrapResult(
      avgTimeByDay as JobsAverageTimeByDayResponseItem[] | ResultWrapper<JobsAverageTimeByDayResponseItem[]>
    );
    if (Array.isArray(avgTimeByDayResult)) {
      avgTimeByDayData = avgTimeByDayResult.map((a: JobsAverageTimeByDayResponseItem): JobsAverageTimeByDayData => ({
        day: a.day || 'Unknown',
        avg_time: a.avg_time || 0,
        count: a.count || 0,
        outliers: a.outliers,
      }));
    }

    const jobsSummaryResult = unwrapResult(
      jobsSummaryRaw as JobSummaryResponseItem[] | ResultWrapper<JobSummaryResponseItem[]>
    );
    const jobsSummaryData = Array.isArray(jobsSummaryResult)
      ? jobsSummaryResult.map((item: JobSummaryResponseItem): JobSummaryData => ({
          workflow_name: item.workflow_name,
          job_name: item.job_name || 'Unknown',
          total_runs: item.total_runs || 0,
          avg_duration_minutes: item.avg_duration_minutes || 0,
          success_count: item.success_count || 0,
          failure_count: item.failure_count || 0,
          success_rate: item.success_rate || 0,
          failure_rate: item.failure_rate || 0,
          rerun_count: item.rerun_count || 0,
          outliers: item.outliers,
        }))
      : [];

    const jobsRerunsByDayResult = unwrapResult(
      jobsRerunsByDayRaw as JobRerunsByDayResponseItem[] | ResultWrapper<JobRerunsByDayResponseItem[]>
    );
    const jobsRerunsByDayData = Array.isArray(jobsRerunsByDayResult)
      ? jobsRerunsByDayResult.map((item: JobRerunsByDayResponseItem): JobRerunsByDayData => ({
          day: item.day || 'Unknown',
          rerun_count: item.rerun_count || 0,
        }))
      : [];

    jobsByStatus = jobsData;
    runsDurationByAggregation = {
      avg: durationData,
      min: durationData,
      max: durationData,
    };
    runsByDay = Array.from(runsByDayData.entries())
      .map(([day, runs]) => ({ day, runs }))
      .sort((a, b) => a.day.localeCompare(b.day));
    jobsAvgTime = avgTimeData;
    jobsAvgTimeByDay = avgTimeByDayData;
    jobsDurationByWorkflow = Array.isArray(jobsDurationRaw) ? jobsDurationRaw : [];
    jobsSummary = jobsSummaryData;
    jobsRerunsByDay = jobsRerunsByDayData;

    const jobStepsResult = unwrapResult(
      jobStepsTimeRaw as JobStepsAverageTimeResponseItem[] | ResultWrapper<JobStepsAverageTimeResponseItem[]>
    );
    if (Array.isArray(jobStepsResult)) {
      jobStepsTime = jobStepsResult.map((item: JobStepsAverageTimeResponseItem): JobStepsAverageTimeData => ({
        name: item.name || 'Unknown',
        averageDurationMinutes: item.averageDurationMinutes || 0,
        count: item.count || 0,
        outliers: item.outliers,
      }));
    }

    const jobStepsByDayResult = unwrapResult(
      jobStepsTimeByDayRaw as JobStepsAverageTimeByDayResponseItem[] | ResultWrapper<JobStepsAverageTimeByDayResponseItem[]>
    );
    if (Array.isArray(jobStepsByDayResult)) {
      jobStepsTimeByDay = jobStepsByDayResult.map((item: JobStepsAverageTimeByDayResponseItem): JobStepsAverageTimeByDayData => {
        const obj: JobStepsAverageTimeByDayData = { day: item.day };
        item.steps.forEach(step => {
          obj[step.name] = step.averageDurationMinutes;
        });
        return obj;
      });
    }
    outliers = [
      ...durationData.flatMap((item) =>
        toOutlierRows(`Run duration: ${item.workflow}`, item.outliers)
      ),
      ...avgTimeData.flatMap((item) =>
        toOutlierRows(`Job average time: ${item.job_name}`, item.outliers)
      ),
      ...avgTimeByDayData.flatMap((item) =>
        toOutlierRows(`Job average time by day: ${item.day}`, item.outliers)
      ),
      ...jobsSummaryData.flatMap((item) =>
        toOutlierRows(`Job summary duration: ${item.job_name}`, item.outliers)
      ),
      ...jobStepsTime.flatMap((item) =>
        toOutlierRows(`Step average time: ${item.name}`, item.outliers)
      ),
      ...(Array.isArray(jobStepsByDayResult)
        ? jobStepsByDayResult.flatMap((item) =>
            item.steps.flatMap((step) =>
              toOutlierRows(`Step average time by day: ${item.day} / ${step.name}`, step.outliers)
            )
          )
        : []),
    ];
  } catch (error) {
    console.error('Error fetching pipeline data:', error);
    jobsByStatus = [];
    runsDurationByAggregation = { avg: [], min: [], max: [] };
    runsByDay = [];
    jobsAvgTime = [];
    jobsAvgTimeByDay = [];
    jobsDurationByWorkflow = [];
    jobsSummary = [];
    jobsRerunsByDay = [];
    jobStepsTime = [];
    jobStepsTimeByDay = [];
    totalRuns = 0;
  }

  return (
    <div className="space-y-6">
      <OutliersCard rows={outliers} />
      <Card>
        <CardContent>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Total runs</p>
            <p className="text-3xl font-bold text-blue-600">{totalRuns.toLocaleString('en-US')}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <PipelineRunsDurationCard
          dataByAggregation={runsDurationByAggregation}
          runsByDay={runsByDay}
          jobsDurationByWorkflow={jobsDurationByWorkflow}
        />
        <JobsAverageTimeCard data={jobsAvgTime} dataByDay={jobsAvgTimeByDay} apiParams={buildPipelineApiParams(filters)} />
      </div>

      <JobsRerunCard data={jobsSummary} dataByDay={jobsRerunsByDay} />
      <JobsByStatusCard data={jobsByStatus} />
      {isSingleJobSelected && jobStepsTime.length > 0 && (
        <JobStepsAnalysis data={jobStepsTime} dataByDay={jobStepsTimeByDay} jobName={filters.jobSelector[0]} />
      )}
    </div>
  );
}
