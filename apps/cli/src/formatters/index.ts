import { formatDuration } from '@smmachine/utils';
import { stringifyCsv } from '@smmachine/core';

export interface FormatterOptions {
  format: 'json' | 'text' | 'csv';
  verbose?: boolean;
}

type MetricValue = string | number | boolean | null | undefined;
type MetricRecord = Record<string, MetricValue>;

interface ChangeRequestMetrics {
  totalChangeRequests?: number;
  leadTime?: { average?: number; unit?: string };
  commentSummary?: { total?: number };
  labelSummary?: Record<string, number>;
}

interface DeploymentMetrics {
  deploymentFrequency?: Array<{ date: string; value: number }>;
  pipelineMetrics?: { totalRuns?: number; successRate?: number };
  jobMetrics?: Array<{
    jobName: string;
    avgDuration: number;
    successRate?: number;
    failureRate?: number;
  }>;
}

interface CodeMetrics {
  pairingIndex?: { pairingIndexPercentage?: number };
  codeChurn?: { data?: { additions?: number; deletions?: number } };
  fileCoupling?: Array<{
    file1: string;
    file2: string;
    couplingStrength: number;
  }>;
}

interface IssueMetrics {
  totalIssues?: number;
  issues?: Array<{ key: string; status: string; priority?: string; createdAt: string }>;
}

type QualityMetrics = MetricRecord & { filters?: unknown };

interface CompleteReport {
  timestamp?: string;
  filters?: Record<string, MetricValue>;
  changeRequests?: ChangeRequestMetrics;
  deployment?: DeploymentMetrics;
  code?: CodeMetrics;
  issues?: IssueMetrics;
  quality?: QualityMetrics;
}

export function formatChangeRequestMetrics(
  data: ChangeRequestMetrics,
  options: FormatterOptions
): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    const rows: string[][] = [['metric', 'value']];
    if (data.totalChangeRequests !== undefined) {
      rows.push(['total_prs', String(data.totalChangeRequests)]);
    }
    if (data.leadTime?.average !== undefined) {
      rows.push(['lead_time_days', String(data.leadTime.average)]);
    }
    if (data.commentSummary?.total !== undefined) {
      rows.push(['total_comments', String(data.commentSummary.total)]);
    }
    return stringifyCsv(rows, false);
  }

  let output = '\n📊 Change Request Metrics\n';
  output += '═══════════════════════════════════════\n';
  output += `Total change requests: ${data.totalChangeRequests || 'N/A'}\n`;

  if (data.leadTime) {
    const unit = data.leadTime.unit || 'days';
    const formattedDuration =
      unit === 'days'
        ? formatDuration(data.leadTime.average || 0, 'days')
        : unit === 'hours'
          ? formatDuration(data.leadTime.average || 0, 'hours')
          : formatDuration(data.leadTime.average || 0, 'minutes');
    output += `Lead Time: ${formattedDuration}\n`;
  }

  if (data.commentSummary) {
    output += `Total Comments: ${data.commentSummary.total || 'N/A'}\n`;
  }

  if (data.labelSummary && Object.keys(data.labelSummary).length > 0) {
    output += '\nLabels:\n';
    for (const [label, count] of Object.entries(data.labelSummary)) {
      output += `  • ${label}: ${count}\n`;
    }
  }

  return output;
}

export function formatDeploymentMetrics(
  data: DeploymentMetrics,
  options: FormatterOptions
): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    const rows: string[][] = [['date', 'deployments', 'success_rate']];
    if (data.deploymentFrequency) {
      for (const item of data.deploymentFrequency) {
        rows.push([
          item.date,
          String(item.value),
          String(data.pipelineMetrics?.successRate || 'N/A'),
        ]);
      }
    }
    return stringifyCsv(rows, false);
  }

  let output = '\n🚀 Deployment Metrics\n';
  output += '═══════════════════════════════════════\n';

  if (data.pipelineMetrics) {
    output += `Total Runs: ${data.pipelineMetrics.totalRuns || 'N/A'}\n`;
    if (data.pipelineMetrics.successRate !== undefined) {
      output += `Success Rate: ${(data.pipelineMetrics.successRate * 100).toFixed(1)}%\n`;
    }
  }

  if (data.deploymentFrequency && data.deploymentFrequency.length > 0) {
    output += '\nDeployment Frequency:\n';
    for (const item of data.deploymentFrequency) {
      output += `  • ${item.date}: ${item.value} deployments\n`;
    }
  }

  if (data.jobMetrics && data.jobMetrics.length > 0) {
    output += '\nJob Metrics:\n';
    for (const job of data.jobMetrics) {
      output += `  • ${job.jobName}:\n`;
      output += `    - Avg Duration: ${job.avgDuration}s\n`;
      if (job.successRate !== undefined) {
        output += `    - Success Rate: ${(job.successRate * 100).toFixed(1)}%\n`;
      }
      if (job.failureRate !== undefined) {
        output += `    - Failure Rate: ${(job.failureRate * 100).toFixed(1)}%\n`;
      }
    }
  }

  return output;
}

export function formatCodeMetrics(data: CodeMetrics, options: FormatterOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    const rows: string[][] = [['metric', 'value']];
    if (data.pairingIndex?.pairingIndexPercentage !== undefined) {
      rows.push(['pairing_index', String(data.pairingIndex.pairingIndexPercentage)]);
    }
    if (data.codeChurn?.data) {
      rows.push(['additions', String(data.codeChurn.data.additions)]);
      rows.push(['deletions', String(data.codeChurn.data.deletions)]);
    }
    return stringifyCsv(rows, false);
  }

  let output = '\n💻 Code Metrics\n';
  output += '═══════════════════════════════════════\n';

  if (data.pairingIndex) {
    output += `Pairing Index: ${data.pairingIndex.pairingIndexPercentage || 'N/A'}%\n`;
  }

  if (data.codeChurn?.data) {
    output += `Code Churn: +${data.codeChurn.data.additions} -${data.codeChurn.data.deletions}\n`;
  }

  if (data.fileCoupling && data.fileCoupling.length > 0) {
    output += `\nFile Coupling (${data.fileCoupling.length} pairs):\n`;
    for (const coupling of data.fileCoupling.slice(0, 10)) {
      output += `  • ${coupling.file1} ↔ ${coupling.file2}\n`;
      output += `    Coupling: ${(coupling.couplingStrength * 100).toFixed(1)}%\n`;
    }
    if (data.fileCoupling.length > 10) {
      output += `  ... and ${data.fileCoupling.length - 10} more\n`;
    }
  }

  return output;
}

export function formatIssueMetrics(data: IssueMetrics, options: FormatterOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    const rows: string[][] = [['key', 'status', 'priority', 'created_at']];
    if (data.issues) {
      for (const issue of data.issues.slice(0, 100)) {
        rows.push([issue.key, issue.status, issue.priority || 'N/A', issue.createdAt]);
      }
    }
    return stringifyCsv(rows, false);
  }

  let output = '\n🎫 Issue Metrics\n';
  output += '═══════════════════════════════════════\n';
  output += `Total Issues: ${data.totalIssues || 'N/A'}\n`;

  if (data.issues && data.issues.length > 0) {
    output += '\nRecent Issues:\n';
    for (const issue of data.issues.slice(0, 10)) {
      output += `  • [${issue.status}] ${issue.key}\n`;
      if (issue.priority) output += `    Priority: ${issue.priority}\n`;
      output += `    Created: ${issue.createdAt}\n`;
    }
    if (data.issues.length > 10) {
      output += `  ... and ${data.issues.length - 10} more\n`;
    }
  }

  return output;
}

export function formatQualityMetrics(data: QualityMetrics, options: FormatterOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    const rows: string[][] = [['metric', 'value']];
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'filters') {
        rows.push([key, String(value)]);
      }
    }
    return stringifyCsv(rows, false);
  }

  let output = '\n✅ Quality Metrics\n';
  output += '═══════════════════════════════════════\n';

  for (const [key, value] of Object.entries(data)) {
    if (key !== 'filters') {
      const metricName = key.replace(/_/g, ' ');
      const capitalizedMetric = metricName.charAt(0).toUpperCase() + metricName.slice(1);
      output += `${capitalizedMetric}: ${value}\n`;
    }
  }

  return output;
}

export function formatCompleteReport(data: CompleteReport, options: FormatterOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    const rows: string[][] = [['section', 'metric', 'value']];

    if (data.changeRequests) {
      rows.push(['Change request', 'total_prs', String(data.changeRequests.totalChangeRequests)]);
      if (data.changeRequests.leadTime) {
        rows.push(['Change request', 'lead_time', String(data.changeRequests.leadTime.average)]);
      }
    }

    if (data.deployment) {
      if (data.deployment.pipelineMetrics?.totalRuns !== undefined) {
        rows.push(['Deployment', 'total_runs', String(data.deployment.pipelineMetrics.totalRuns)]);
      }
      if (data.deployment.pipelineMetrics?.successRate !== undefined) {
        rows.push([
          'Deployment',
          'success_rate',
          (data.deployment.pipelineMetrics.successRate * 100).toFixed(1),
        ]);
      }
    }

    if (data.code?.pairingIndex) {
      rows.push(['Code', 'pairing_index', String(data.code.pairingIndex.pairingIndexPercentage)]);
    }

    if (data.issues) {
      rows.push(['Issues', 'total_issues', String(data.issues.totalIssues)]);
    }

    if (data.quality) {
      for (const [key, value] of Object.entries(data.quality)) {
        if (key !== 'filters') {
          rows.push(['Quality', key, String(value)]);
        }
      }
    }

    return stringifyCsv(rows, false);
  }

  let output = '\n';
  output += '╔════════════════════════════════════════════════════════╗\n';
  output += '║                    Software Metrics Machine            ║\n';
  output += '║                  Comprehensive Report                  ║\n';
  output += '╚════════════════════════════════════════════════════════╝\n';
  output += `Generated: ${data.timestamp || new Date().toISOString()}\n`;

  if (data.filters && Object.keys(data.filters).length > 0) {
    output += '\nApplied Filters:\n';
    for (const [key, value] of Object.entries(data.filters)) {
      if (value) {
        output += `  • ${key}: ${value}\n`;
      }
    }
  }

  if (data.changeRequests) {
    output += '\n' + formatChangeRequestMetrics(data.changeRequests, { format: 'text' });
  }

  if (data.deployment) {
    output += '\n' + formatDeploymentMetrics(data.deployment, { format: 'text' });
  }

  if (data.code) {
    output += '\n' + formatCodeMetrics(data.code, { format: 'text' });
  }

  if (data.issues) {
    output += '\n' + formatIssueMetrics(data.issues, { format: 'text' });
  }

  if (data.quality) {
    output += '\n' + formatQualityMetrics(data.quality, { format: 'text' });
  }

  output += '\n';

  return output;
}

export function formatError(error: Error | string, options: { verbose?: boolean } = {}): string {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : '';

  if (options.verbose && stack) {
    return `❌ Error: ${message}\n\nStack Trace:\n${stack}`;
  }

  return `❌ Error: ${message}`;
}

export function formatSuccess(message: string): string {
  return `✓ ${message}`;
}

export function formatLoading(message: string): string {
  return `⏳ ${message}`;
}
