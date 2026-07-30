import { pipelineAPI } from '@/server/api';
import { buildPipelineApiParams } from '@/server/utils/apiParams';
import type {
  JobByStatusData,
  RunsDurationData,
  RunsByDayData,
  JobsAverageTimeData,
  JobsAverageTimeByDayData,
  JobsDurationByWorkflowItem,
  JobSummaryData,
  JobRerunsByDayData,
  JobStepsAverageTimeData,
  JobStepsAverageTimeByDayData,
} from '@/components/charts/pipeline/types';
import { defaultFilters, parseDashboardFilters } from '@/components/filters/DashboardFilters';
import PipelineRunsDurationCard from '@/components/charts/pipeline/PipelineRunsDurationCard';
import JobsAverageTimeCard from '@/components/charts/pipeline/JobsAverageTimeCard';
import JobsByStatusCard from '@/components/charts/pipeline/JobsByStatusCard';
import JobsRerunCard from '@/components/charts/pipeline/JobsRerunCard';
import JobStepsAnalysis from '@/components/charts/pipeline/JobStepsAnalysis';
import OutliersCard, { MetricOutlierRow } from '@/components/charts/OutliersCard';
import PipelineEvaluationCard from '@/components/charts/pipeline/PipelineEvaluationCard';
import { toOutlierRows } from '@/components/charts/outliers-utils';

interface EvaluationData {
  generatedAt: string;
  signals: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'good';
    category: string;
    metrics: Array<{ label: string; value: string }>;
  }>;
  summary: {
    totalRuns: number;
    averageDurationMinutes: number;
    successRate: number;
    failureRate: number;
    totalReruns: number;
    bottleneckJob?: string;
    bottleneckJobSharePercent?: number;
    slowestWorkflow?: string;
  };
}

export default async function PipelinesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseDashboardFilters((await searchParams) ?? {}, defaultFilters);
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
  let outliers: MetricOutlierRow[] = [];
  let evaluation: EvaluationData | null = null;
  let detailViewError: string | null = null;

  const isSingleJobSelected = filters.jobSelector && filters.jobSelector.length === 1;

  const apiParams = buildPipelineApiParams(filters);

  try {
    const [dashboardData, evalData] = await Promise.all([
      pipelineAPI.dashboard(apiParams),
      pipelineAPI.evaluate(apiParams),
    ]);

    evaluation = evalData;

    const data = dashboardData;

    const jobsData: JobByStatusData[] = Array.isArray(data.jobs_by_status)
      ? data.jobs_by_status.map((j) => ({
          status: (j.Status || 'unknown').toLowerCase(),
          count: j.Count || 0,
        }))
      : [];

    const durationData: RunsDurationData[] = Array.isArray(data.runs_duration)
      ? data.runs_duration.map((d) => ({
          workflow: d.workflow || 'Unknown',
          avg_duration: d.avg_duration ?? 0,
          min_duration: d.min_duration ?? 0,
          max_duration: d.max_duration ?? 0,
          total_runs: d.total_runs ?? 0,
          outliers: d.outliers,
        }))
      : [];

    const runsByDayMap: Map<string, number> = Array.isArray(data.runs_by)
      ? data.runs_by.reduce((acc, item) => {
          const day = item.period || '';
          if (!day) {return acc;}
          acc.set(day, (acc.get(day) || 0) + Number(item.runs || 0));
          return acc;
        }, new Map<string, number>())
      : new Map<string, number>();

    const avgTimeData: JobsAverageTimeData[] = Array.isArray(data.jobs_average_time)
      ? data.jobs_average_time.map((a) => ({
          job_name: a.job_name || 'Unknown',
          workflow_name: a.workflow_name,
          avg_time: a.avg_time || 0,
          count: a.count || 0,
          outliers: a.outliers,
        }))
      : [];

    const avgTimeByDayData: JobsAverageTimeByDayData[] = Array.isArray(data.jobs_average_time_by_day)
      ? data.jobs_average_time_by_day.map((a) => ({
          day: a.day || 'Unknown',
          avg_time: a.avg_time || 0,
          count: a.count || 0,
          outliers: a.outliers,
        }))
      : [];

    const jobsSummaryData: JobSummaryData[] = Array.isArray(data.jobs_summary)
      ? data.jobs_summary.map((item) => ({
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

    const jobsRerunsByDayData: JobRerunsByDayData[] = Array.isArray(data.jobs_reruns_by_day)
      ? data.jobs_reruns_by_day.map((item) => ({
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
    runsByDay = Array.from(runsByDayMap.entries())
      .map(([day, runs]) => ({ day, runs }))
      .sort((a, b) => a.day.localeCompare(b.day));
    jobsAvgTime = avgTimeData;
    jobsAvgTimeByDay = avgTimeByDayData;
    jobsDurationByWorkflow = Array.isArray(data.jobs_duration_by_workflow)
      ? data.jobs_duration_by_workflow
      : [];
    jobsSummary = jobsSummaryData;
    jobsRerunsByDay = jobsRerunsByDayData;

    if (Array.isArray(data.job_steps_average_time)) {
      jobStepsTime = data.job_steps_average_time.map((item) => ({
        name: item.name || 'Unknown',
        averageDurationMinutes: item.averageDurationMinutes || 0,
        count: item.count || 0,
        outliers: item.outliers,
      }));
    }

    const jobStepsByDayRaw = data.job_steps_average_time_by_day;
    if (Array.isArray(jobStepsByDayRaw)) {
      jobStepsTimeByDay = jobStepsByDayRaw.map((item) => {
        const obj: JobStepsAverageTimeByDayData = { day: item.day };
        item.steps.forEach((step) => {
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
      ...(Array.isArray(jobStepsByDayRaw)
        ? jobStepsByDayRaw.flatMap((item) =>
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
    detailViewError = 'Failed to load pipeline detail data.';
  }

  return (
    <div className="space-y-6">
      {evaluation ? (
        <PipelineEvaluationCard data={evaluation} method={filters.method} />
      ) : null}

      <OutliersCard rows={outliers} />

      <div className="border-t border-gray-200 pt-2">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Detail View</h2>
      </div>

      {detailViewError ? (
        <div className="text-red-600 text-sm">{detailViewError}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6">
            <PipelineRunsDurationCard
              dataByAggregation={runsDurationByAggregation}
              runsByDay={runsByDay}
              jobsDurationByWorkflow={jobsDurationByWorkflow}
            />
            <JobsAverageTimeCard
              data={jobsAvgTime}
              dataByDay={jobsAvgTimeByDay}
              apiParams={apiParams}
            />
          </div>

          <JobsRerunCard data={jobsSummary} dataByDay={jobsRerunsByDay} />
          <JobsByStatusCard data={jobsByStatus} />
          {isSingleJobSelected && jobStepsTime.length > 0 && (
            <JobStepsAnalysis
              data={jobStepsTime}
              dataByDay={jobStepsTimeByDay}
              jobName={filters.jobSelector[0]}
              method={filters.method}
            />
          )}
        </>
      )}
    </div>
  );
}
