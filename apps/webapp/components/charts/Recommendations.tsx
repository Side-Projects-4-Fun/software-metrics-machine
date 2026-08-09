'use client';

import { useMemo } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Box from '@mui/material/Box';
import Link from '@mui/icons-material/Link';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import {
  type RecommendationsProps,
  type Recommendation,
  type RecommendationSeverity,
} from './recommendations-types';
import { METRIC_TARGETS } from './targets';
import { ContextLink } from '@/components/filters/ContextLink';

type JobSummary = NonNullable<RecommendationsProps['jobsSummary']>[number];
type DeploymentFrequencyItem = NonNullable<RecommendationsProps['deploymentFrequency']>[number];

function formatPipelineJob(
  job: Pick<JobSummary, 'workflow_name' | 'job_name'>,
  selectedWorkflow?: string
): string {
  const workflowName = job.workflow_name || selectedWorkflow;
  return workflowName ? `${workflowName} / ${job.job_name}` : `All pipelines / ${job.job_name}`;
}

function formatDeploymentTarget(target: Pick<DeploymentFrequencyItem, 'pipeline' | 'job'>): string {
  return `${target.pipeline} / ${target.job}`;
}

function formatTopItems<T>(items: T[], formatter: (item: T) => string, limit = 3): string {
  const visible = items.slice(0, limit).map(formatter);
  const remaining = items.length - visible.length;

  if (remaining > 0) {
    return `${visible.join(', ')} and ${remaining} more`;
  }

  return visible.join(', ');
}

function getSeverityIcon(severity: RecommendationSeverity) {
  switch (severity) {
    case 'warning':
      return <WarningIcon sx={{ color: '#f59e0b', fontSize: 20 }} />;
    case 'success':
      return <CheckCircleIcon sx={{ color: '#10b981', fontSize: 20 }} />;
    case 'info':
    default:
      return <InfoIcon sx={{ color: '#3b82f6', fontSize: 20 }} />;
  }
}

function getSeverityBorder(severity: RecommendationSeverity): string {
  switch (severity) {
    case 'warning':
      return 'border-l-amber-500';
    case 'success':
      return 'border-l-emerald-500';
    case 'info':
    default:
      return 'border-l-blue-500';
  }
}

function getSeverityBg(severity: RecommendationSeverity): string {
  switch (severity) {
    case 'warning':
      return 'bg-amber-50 dark:bg-amber-950/20';
    case 'success':
      return 'bg-emerald-50 dark:bg-emerald-950/20';
    case 'info':
    default:
      return 'bg-blue-50 dark:bg-blue-950/20';
  }
}

export function Recommendations({
  pairingIndex,
  prSummary,
  deploymentFrequency,
  jobsSummary,
  selectedWorkflow,
  averageReviewTime,
}: RecommendationsProps) {
  const recommendations = useMemo(() => {
    const recs: Recommendation[] = [];

    // --- Pairing Index ---
    if (pairingIndex) {
      const target = METRIC_TARGETS['pairing-index'];
      const value = pairingIndex.pairing_index_percentage;
      if (value < 30) {
        recs.push({
          id: 'pairing-low',
          metric: 'pairing-index',
          title: 'Increase Pair Programming',
          message: `Your pairing index is ${value.toFixed(1)}%, below the 30% target. Consider scheduling more pair programming sessions to improve knowledge sharing and reduce bus factor risk.`,
          severity: 'warning',
          currentValue: `${value.toFixed(1)}%`,
          targetValue: target?.target,
          href: '/dashboard/source-code',
          hrefLabel: 'View Source Code',
        });
      } else {
        recs.push({
          id: 'pairing-good',
          metric: 'pairing-index',
          title: 'Pair Programming on Track',
          message: `Your pairing index is ${value.toFixed(1)}%, meeting the 30% target. Keep up the collaborative practices!`,
          severity: 'success',
          currentValue: `${value.toFixed(1)}%`,
          targetValue: target?.target,
        });
      }
    }

    // --- Pipeline Success Rate ---
    if (jobsSummary && jobsSummary.length > 0) {
      const target = METRIC_TARGETS['jobs-success-rate'];
      const overallSuccessRate =
        jobsSummary.reduce((sum, j) => sum + j.success_rate, 0) / jobsSummary.length;

      if (overallSuccessRate < 90) {
        const affectedJobs = jobsSummary
          .filter((job) => job.success_rate < 90)
          .sort((a, b) => a.success_rate - b.success_rate);
        const affectedJobsMessage = formatTopItems(
          affectedJobs.length > 0 ? affectedJobs : [...jobsSummary].sort((a, b) => a.success_rate - b.success_rate),
          (job) => `${formatPipelineJob(job, selectedWorkflow)} (${job.success_rate.toFixed(1)}%)`
        );
        recs.push({
          id: 'pipeline-success-low',
          metric: 'jobs-success-rate',
          title: 'Improve Pipeline Reliability',
          message: `Overall pipeline success rate is ${overallSuccessRate.toFixed(1)}%, below the 90% target. Most affected: ${affectedJobsMessage}. Investigate flaky tests and failure patterns to improve CI stability.`,
          severity: 'warning',
          currentValue: `${overallSuccessRate.toFixed(1)}%`,
          targetValue: target?.target,
          contextItems: (affectedJobs.length > 0 ? affectedJobs : [...jobsSummary].sort((a, b) => a.success_rate - b.success_rate))
            .slice(0, 3)
            .map((job) => `${formatPipelineJob(job, selectedWorkflow)} - ${job.success_rate.toFixed(1)}% success`),
          href: '/dashboard/pipelines',
          hrefLabel: 'View Pipelines',
        });
      } else {
        recs.push({
          id: 'pipeline-success-good',
          metric: 'jobs-success-rate',
          title: 'Pipeline Reliability on Track',
          message: `Overall pipeline success rate is ${overallSuccessRate.toFixed(1)}%, meeting the 90% target.`,
          severity: 'success',
          currentValue: `${overallSuccessRate.toFixed(1)}%`,
          targetValue: target?.target,
        });
      }
    }

    // --- Job Reruns ---
    if (jobsSummary && jobsSummary.length > 0) {
      const target = METRIC_TARGETS['job-reruns'];
      const totalReruns = jobsSummary.reduce((sum, j) => sum + j.rerun_count, 0);

      if (totalReruns > 0) {
        const rerunJobs = jobsSummary
          .filter((j) => j.rerun_count > 0)
          .sort((a, b) => b.rerun_count - a.rerun_count);
        const rerunJobsMessage = formatTopItems(
          rerunJobs,
          (job) => `${formatPipelineJob(job, selectedWorkflow)} (${job.rerun_count})`
        );
        recs.push({
          id: 'reruns-detected',
          metric: 'job-reruns',
          title: 'Reduce Pipeline Reruns',
          message: `Detected ${totalReruns} reruns across ${rerunJobs.length} job(s): ${rerunJobsMessage}. Reruns waste compute and erode CI trust; investigate flaky tests as the likely root cause.`,
          severity: 'warning',
          currentValue: `${totalReruns} reruns`,
          targetValue: target?.target,
          contextItems: rerunJobs
            .slice(0, 3)
            .map((job) => `${formatPipelineJob(job, selectedWorkflow)} - ${job.rerun_count} reruns`),
          href: '/dashboard/pipelines',
          hrefLabel: 'View Pipelines',
        });
      }
    }

    // --- Average Job Duration ---
    if (jobsSummary && jobsSummary.length > 0) {
      const target = METRIC_TARGETS['job-avg-time'];
      const avgDuration =
        jobsSummary.reduce((sum, j) => sum + j.value, 0) / jobsSummary.length;
      const avgDurationFormatted = jobsSummary[0]?.value_formatted || `${avgDuration.toFixed(1)} min`;

      if (avgDuration > 5) {
        const slowJobs = jobsSummary
          .filter((job) => job.value > 5)
          .sort((a, b) => b.value - a.value);
        const slowJobsMessage = formatTopItems(
          slowJobs.length > 0 ? slowJobs : [...jobsSummary].sort((a, b) => b.value - a.value),
          (job) => `${formatPipelineJob(job, selectedWorkflow)} (${job.value_formatted || `${job.value.toFixed(1)} min`})`
        );
        recs.push({
          id: 'job-duration-high',
          metric: 'job-avg-time',
          title: 'Optimize Job Duration',
          message: `Average job duration is ${avgDurationFormatted}, exceeding the 5 min target. Slowest jobs: ${slowJobsMessage}. Consider parallelizing steps, caching dependencies, or splitting large jobs.`,
          severity: 'warning',
          currentValue: avgDurationFormatted,
          targetValue: target?.target,
          contextItems: (slowJobs.length > 0 ? slowJobs : [...jobsSummary].sort((a, b) => b.value - a.value))
            .slice(0, 3)
            .map((job) => `${formatPipelineJob(job, selectedWorkflow)} - ${job.value_formatted || `${job.value.toFixed(1)} min`} avg`),
          href: '/dashboard/pipelines',
          hrefLabel: 'View Pipelines',
        });
      }
    }

    // --- Change Request Review Time ---
    if (averageReviewTime && averageReviewTime.length > 0) {
      const target = METRIC_TARGETS['average-review-time'];
      const avgReviewDays =
        averageReviewTime.reduce((sum, a) => sum + a.value, 0) / averageReviewTime.length;
      const avgReviewTimeFormatted = averageReviewTime[0]?.value_formatted || `${avgReviewDays.toFixed(1)}d`;

      if (avgReviewDays > 1) {
        recs.push({
          id: 'review-time-high',
          metric: 'average-review-time',
          title: 'Speed Up Code Reviews',
          message: `Average review time is ${avgReviewTimeFormatted}, exceeding the 24-hour target. Slow reviews create delivery bottlenecks and reduce author productivity.`,
          severity: 'warning',
          currentValue: avgReviewTimeFormatted,
          targetValue: target?.target,
          href: '/dashboard/change-requests',
          hrefLabel: 'View Change Requests',
        });
      } else if (avgReviewDays > 0) {
        recs.push({
          id: 'review-time-good',
          metric: 'average-review-time',
          title: 'Review Time on Track',
          message: `Average review time is ${avgReviewTimeFormatted}, within the 24-hour target.`,
          severity: 'success',
          currentValue: avgReviewTimeFormatted,
          targetValue: target?.target,
        });
      }
    }

    // --- Open Change Requests ---
    if (prSummary && prSummary.open > 0) {
      const target = METRIC_TARGETS['change-requests-remain-open'];
      recs.push({
        id: 'open-change-requests',
        metric: 'change-requests-remain-open',
        title: 'Review Open Change Requests',
        message: `You have ${prSummary.open} open change request(s). Change requests open beyond 3 days slow delivery and increase merge conflicts. Prioritize reviewing stale change requests.`,
        severity: 'info',
        currentValue: `${prSummary.open} open`,
        targetValue: target?.target,
        href: '/dashboard/change-requests',
        hrefLabel: 'View Change Requests',
      });
    }

    // --- Deployment Frequency ---
    if (deploymentFrequency && deploymentFrequency.length > 0) {
      const target = METRIC_TARGETS['deployment-frequency'];
      const totalDailyDeployments = deploymentFrequency.reduce(
        (sum, d) => sum + d.day_count,
        0
      );

      if (totalDailyDeployments === 0) {
        const deploymentTargetsMessage = formatTopItems(
          deploymentFrequency,
          formatDeploymentTarget
        );
        recs.push({
          id: 'no-deployments',
          metric: 'deployment-frequency',
          title: 'Increase Deployment Frequency',
          message: `No deployments detected for ${deploymentTargetsMessage} in the selected period. Elite teams deploy daily or multiple times per day. Consider automating your deployment pipeline.`,
          severity: 'info',
          currentValue: '0 deployments',
          targetValue: target?.target,
          contextItems: deploymentFrequency.slice(0, 3).map(formatDeploymentTarget),
          href: '/dashboard/pipelines',
          hrefLabel: 'View Pipelines',
        });
      }
    }

    // --- General Guidance ---
    if (recs.length === 0 || (recs.length > 0 && recs.every((r) => r.severity === 'success'))) {
      recs.push({
        id: 'general-explore',
        metric: 'general',
        title: 'Explore Deeper Insights',
        message: 'Your metrics look healthy! Consider diving into code churn, entity coupling, and ownership data to identify potential hotspots before they become issues.',
        severity: 'info',
        href: '/dashboard/source-code',
        hrefLabel: 'View Source Code',
      });
    }

    return recs;
  }, [pairingIndex, prSummary, deploymentFrequency, jobsSummary, selectedWorkflow, averageReviewTime]);

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LightbulbIcon sx={{ color: '#f59e0b' }} />
            Recommendations
          </Box>
        }
        subheader="Actionable tips based on your current metrics"
      />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {recommendations.map((rec) => (
            <Box
              key={rec.id}
              className={`border-l-4 ${getSeverityBorder(rec.severity)} ${getSeverityBg(rec.severity)} rounded-r-lg p-4`}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                {getSeverityIcon(rec.severity)}
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.95rem' }}>{rec.title}</Box>
                  <Box sx={{ color: 'text.secondary', fontSize: '0.875rem', lineHeight: 1.6 }}>
                    {rec.message}
                  </Box>
                  {(rec.currentValue || rec.targetValue) && (
                    <Box sx={{ mt: 1, display: 'flex', gap: 2, fontSize: '0.8rem' }}>
                      {rec.currentValue && (
                        <Box component="span" sx={{ color: 'text.secondary' }}>
                          Current: <strong>{rec.currentValue}</strong>
                        </Box>
                      )}
                      {rec.targetValue && (
                        <Box component="span" sx={{ color: 'text.secondary' }}>
                          Target: <strong>{rec.targetValue}</strong>
                        </Box>
                      )}
                    </Box>
                  )}
                  {rec.contextItems && rec.contextItems.length > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {rec.contextItems.map((item) => (
                        <Box
                          key={item}
                          component="span"
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            color: 'text.primary',
                            fontSize: '0.75rem',
                            px: 1,
                            py: 0.25,
                          }}
                        >
                          {item}
                        </Box>
                      ))}
                    </Box>
                  )}
                  {rec.href && rec.hrefLabel && (
                    <Box sx={{ mt: 1 }}>
                      <ContextLink
                        href={rec.href}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Link sx={{ fontSize: 14 }} />
                        {rec.hrefLabel}
                      </ContextLink>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
