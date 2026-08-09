/**
 * Output Formatters for CLI
 */

import { formatDuration } from '@smmachine/utils';

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

/**
 * Format pull request metrics for output
 */
export function formatChangeRequestMetrics(
  data: ChangeRequestMetrics,
  options: FormatterOptions
): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    const lines: string[] = ['metric,value'];
    if (data.totalChangeRequests !== undefined) lines.push(`total_prs,${data.totalChangeRequests}`);
    if (data.leadTime?.average !== undefined) lines.push(`lead_time_days,${data.leadTime.average}`);
    if (data.commentSummary?.total !== undefined)
      lines.push(`total_comments,${data.commentSummary.total}`);
    return lines.join('\n');
  }

  // Text format (default)
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

/**
 * Format deployment metrics for output
 */
export function formatDeploymentMetrics(
  data: DeploymentMetrics,
  options: FormatterOptions
): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    const lines: string[] = ['date,deployments,success_rate'];
    if (data.deploymentFrequency) {
      for (const item of data.deploymentFrequency) {
        lines.push(`${item.date},${item.value},${data.pipelineMetrics?.successRate || 'N/A'}`);
      }
    }
    return lines.join('\n');
  }

  // Text format (default)
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

/**
 * Format code metrics for output
 */
export function formatCodeMetrics(data: CodeMetrics, options: FormatterOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    const lines: string[] = ['metric,value'];
    if (data.pairingIndex?.pairingIndexPercentage !== undefined) {
      lines.push(`pairing_index,${data.pairingIndex.pairingIndexPercentage}`);
    }
    if (data.codeChurn?.data) {
      lines.push(`additions,${data.codeChurn.data.additions}`);
      lines.push(`deletions,${data.codeChurn.data.deletions}`);
    }
    return lines.join('\n');
  }

  // Text format (default)
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

/**
 * Format issue metrics for output
 */
export function formatIssueMetrics(data: IssueMetrics, options: FormatterOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    const lines: string[] = ['key,status,priority,created_at'];
    if (data.issues) {
      for (const issue of data.issues.slice(0, 100)) {
        lines.push(`${issue.key},${issue.status},${issue.priority || 'N/A'},${issue.createdAt}`);
      }
    }
    return lines.join('\n');
  }

  // Text format (default)
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

/**
 * Format quality metrics for output
 */
export function formatQualityMetrics(data: QualityMetrics, options: FormatterOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    const lines: string[] = ['metric,value'];
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'filters') {
        lines.push(`${key},${value}`);
      }
    }
    return lines.join('\n');
  }

  // Text format (default)
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

/**
 * Format complete report for output
 */
export function formatCompleteReport(data: CompleteReport, options: FormatterOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    const lines: string[] = ['section,metric,value'];

    // Add change request metrics
    if (data.changeRequests) {
      lines.push(`Change request,total_prs,${data.changeRequests.totalChangeRequests}`);
      if (data.changeRequests.leadTime) {
        lines.push(`Change request,lead_time,${data.changeRequests.leadTime.average}`);
      }
    }

    // Add deployment metrics
    if (data.deployment) {
      if (data.deployment.pipelineMetrics?.totalRuns !== undefined) {
        lines.push(`Deployment,total_runs,${data.deployment.pipelineMetrics.totalRuns}`);
      }
      if (data.deployment.pipelineMetrics?.successRate !== undefined) {
        lines.push(
          `Deployment,success_rate,${(data.deployment.pipelineMetrics.successRate * 100).toFixed(1)}`
        );
      }
    }

    // Add code metrics
    if (data.code?.pairingIndex) {
      lines.push(`Code,pairing_index,${data.code.pairingIndex.pairingIndexPercentage}`);
    }

    // Add issue metrics
    if (data.issues) {
      lines.push(`Issues,total_issues,${data.issues.totalIssues}`);
    }

    // Add quality metrics
    if (data.quality) {
      for (const [key, value] of Object.entries(data.quality)) {
        if (key !== 'filters') {
          lines.push(`Quality,${key},${value}`);
        }
      }
    }

    return lines.join('\n');
  }

  // Text format (default)
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

  // Change Requests
  if (data.changeRequests) {
    output += '\n' + formatChangeRequestMetrics(data.changeRequests, { format: 'text' });
  }

  // Deployment
  if (data.deployment) {
    output += '\n' + formatDeploymentMetrics(data.deployment, { format: 'text' });
  }

  // Code
  if (data.code) {
    output += '\n' + formatCodeMetrics(data.code, { format: 'text' });
  }

  // Issues
  if (data.issues) {
    output += '\n' + formatIssueMetrics(data.issues, { format: 'text' });
  }

  // Quality
  if (data.quality) {
    output += '\n' + formatQualityMetrics(data.quality, { format: 'text' });
  }

  output += '\n';

  return output;
}

/**
 * Format error messages
 */
export function formatError(error: Error | string, options: { verbose?: boolean } = {}): string {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : '';

  if (options.verbose && stack) {
    return `❌ Error: ${message}\n\nStack Trace:\n${stack}`;
  }

  return `❌ Error: ${message}`;
}

/**
 * Format success message
 */
export function formatSuccess(message: string): string {
  return `✓ ${message}`;
}

/**
 * Format spinner/loading message
 */
export function formatLoading(message: string): string {
  return `⏳ ${message}`;
}
