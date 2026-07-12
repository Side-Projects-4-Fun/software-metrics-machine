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
import { Card, CardContent } from '@/components/ui/card';
import { toOutlierRows } from '@/components/charts/outliers-utils';
import OutliersCard, { MetricOutlierRow } from '@/components/charts/OutliersCard';

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
    const data = await pipelineAPI.dashboard(apiParams);

    totalRuns = data.summary?.total_runs || 0;

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
          if (!day) return acc;
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
