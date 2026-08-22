import { ConfigurationRepository } from '@smmachine/core';
import { getApplicationVersion, Logger } from '@smmachine/utils';
import { toolLogger } from './mcp-logger';
import { createMcpMetricsReader } from './metrics-reader';
import type { JsonObject, McpToolDefinition, McpToolResult } from './mcp-types';
import { redactSecrets } from './redaction';
import {
  buildArchitectureViewInputSchema,
  buildBigOAnalyzeInputSchema,
  buildBigOListInputSchema,
  buildChangeRequestMetricsInputSchema,
  buildCodeEntityInputSchema,
  buildCodeHistoryInputSchema,
  buildCodeMetricsInputSchema,
  buildDoraMetricsInputSchema,
  buildEngineeringHealthInputSchema,
  buildEvaluationInputSchema,
  buildHealthCheckInputSchema,
  buildIssueMetricsInputSchema,
  buildMetricsInputSchema,
  buildPipelineDashboardInputSchema,
  buildSavedFilterGetInputSchema,
  buildSavedFilterListInputSchema,
  buildSonarqubeComponentTreeInputSchema,
  listEngineeringHealthMetricCatalog,
  parseArchitectureViewArguments,
  parseBigOAnalyzeArguments,
  parseBigOFileArguments,
  parseChangeRequestMetricsArguments,
  parseCodeEntityArguments,
  parseCodeHistoryArguments,
  parseCodeMetricsArguments,
  parseDoraMetricsArguments,
  parseEngineeringHealthArguments,
  parseHealthCheckArguments,
  parseIssueMetricsArguments,
  parseMetricsToolArguments,
  parsePipelineDashboardArguments,
  parseSavedFilterGetArguments,
  parseSavedFilterListArguments,
  parseSonarqubeComponentTreeArguments,
} from './validation';

type ToolHandler = (argumentsValue: unknown) => Promise<McpToolResult>;

export type RegisteredTool = McpToolDefinition & {
  handler: ToolHandler;
};

function asToolResult(value: unknown): McpToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
    structuredContent: value as JsonObject,
  };
}

function getReader(argumentsValue: unknown): {
  args: ReturnType<typeof parseMetricsToolArguments>;
  reader: ReturnType<typeof createMcpMetricsReader>;
} {
  const args = parseMetricsToolArguments(argumentsValue);
  return {
    args,
    reader: createMcpMetricsReader({
      project: args.project,
      timezone: args.timezone,
    }),
  };
}

export const tools: RegisteredTool[] = [
  {
    name: 'smm_list_projects',
    description:
      'List configured Software Metrics Machine projects from smm_config.json, including git provider and repository.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    async handler(): Promise<McpToolResult> {
      toolLogger.debug('smm_list_projects: loading project list from smm_config.json');
      const repository = new ConfigurationRepository(
        process.env,
        undefined,
        new Logger('SmmMcpServer', 'CRITICAL')
      );
      const projects = repository.getAllProjects().map((project) => ({
        github_repository: project.github_repository,
        git_provider: project.git_provider,
      }));
      toolLogger.debug(`smm_list_projects: found ${projects.length} projects`);

      return asToolResult({ projects });
    },
  },
  {
    name: 'smm_list_engineering_health_metrics',
    description:
      'List the available engineering health metric ids, categories, and labels. Use this to discover which metric ids can be passed to smm_get_engineering_health.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    async handler(): Promise<McpToolResult> {
      toolLogger.debug('smm_list_engineering_health_metrics: returning metric catalog');
      return asToolResult({
        categories: ['delivery', 'quality', 'collaboration', 'architecture'],
        metrics: listEngineeringHealthMetricCatalog(),
      });
    },
  },
  {
    name: 'smm_get_change_request_metrics',
    description:
      'Get change request metrics (throughput, review time, authors, outliers) for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('Change request metric filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { args, reader } = getReader(argumentsValue);
      return asToolResult(
        await reader.getChangeRequestMetrics({
          startDate: args.startDate,
          endDate: args.endDate,
        })
      );
    },
  },
  {
    name: 'smm_get_deployment_metrics',
    description:
      'Get pipeline and deployment metrics (durations, success rate, deployment frequency, jobs) for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('Deployment metric filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { args, reader } = getReader(argumentsValue);
      return asToolResult(
        await reader.getDeploymentMetrics({
          startDate: args.startDate,
          endDate: args.endDate,
        })
      );
    },
  },
  {
    name: 'smm_get_code_metrics',
    description:
      'Get code churn, file coupling, and pairing metrics for a configured SMM project. Supports author and file pattern filters.',
    inputSchema: buildCodeMetricsInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });

      return asToolResult(
        await reader.getCodeMetrics({
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          authors: parsed.authors,
          includePatterns: parsed.includePatterns,
          ignorePatterns: parsed.ignorePatterns,
        })
      );
    },
  },
  {
    name: 'smm_get_issue_metrics',
    description:
      'Get Jira issue metrics for a configured SMM project. Supports optional status filter.',
    inputSchema: buildIssueMetricsInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseIssueMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });

      return asToolResult(
        await reader.getIssueMetrics({
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          status: parsed.status,
        })
      );
    },
  },
  {
    name: 'smm_get_quality_metrics',
    description: 'Get SonarQube quality metrics for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('Quality metric filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { args, reader } = getReader(argumentsValue);
      return asToolResult(
        await reader.getQualityMetrics({
          startDate: args.startDate,
          endDate: args.endDate,
        })
      );
    },
  },
  {
    name: 'smm_get_engineering_health',
    description:
      'Evaluate engineering health metrics across delivery, quality, collaboration, and architecture categories. Produces values, trends, targets, and recommendations. Optionally compare a current window against a previous window.',
    inputSchema: buildEngineeringHealthInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseEngineeringHealthArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });

      return asToolResult(await reader.getEngineeringHealthEvaluation(parsed));
    },
  },
  {
    name: 'smm_get_dora_metrics',
    description:
      'Get DORA and pipeline metrics (deployment frequency, lead time inputs, failure rate inputs, pipeline duration, jobs) with rich filtering by workflow, branch, status, conclusion, event, and cleaning options.',
    inputSchema: buildDoraMetricsInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseDoraMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });

      return asToolResult(await reader.getDoraMetrics(parsed));
    },
  },
  {
    name: 'smm_list_architecture_snapshots',
    description:
      'List architecture snapshots previously generated for a configured SMM project. Each entry includes the snapshot id, generation time, branch, commit count, and available view levels.',
    inputSchema: buildMetricsInputSchema('Architecture snapshot lookup filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { reader } = getReader(argumentsValue);
      return asToolResult(await reader.listArchitectureSnapshots());
    },
  },
  {
    name: 'smm_get_architecture_view',
    description:
      'Read a C4 architecture view (context, container, component, or code) for a configured SMM project, with optional file pattern filters.',
    inputSchema: buildArchitectureViewInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseArchitectureViewArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
      });

      return asToolResult(await reader.getArchitectureView(parsed));
    },
  },
  {
    name: 'smm_get_full_report',
    description:
      'Get a complete metrics report (change requests, deployment, code, issues, quality) for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('Complete report filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { args, reader } = getReader(argumentsValue);
      return asToolResult(
        await reader.getFullReport({
          startDate: args.startDate,
          endDate: args.endDate,
        })
      );
    },
  },
  {
    name: 'smm_evaluate_change_requests',
    description:
      'Evaluate change request health signals (review bottlenecks, throughput, collaboration) and produce severity-graded recommendations.',
    inputSchema: buildEvaluationInputSchema('Change request evaluation filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { args, reader } = getReader(argumentsValue);
      return asToolResult(
        await reader.evaluateChangeRequests({
          startDate: args.startDate,
          endDate: args.endDate,
        })
      );
    },
  },
  {
    name: 'smm_evaluate_pipelines',
    description:
      'Evaluate pipeline health signals (duration, stability, throughput) and produce severity-graded recommendations.',
    inputSchema: buildEvaluationInputSchema('Pipeline evaluation filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { args, reader } = getReader(argumentsValue);
      return asToolResult(
        await reader.evaluatePipelines({
          startDate: args.startDate,
          endDate: args.endDate,
        })
      );
    },
  },
  {
    name: 'smm_evaluate_code',
    description:
      'Evaluate code health signals (churn, coupling, ownership, complexity, collaboration) and produce severity-graded recommendations.',
    inputSchema: buildCodeMetricsInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(
        await reader.evaluateCode({
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          authors: parsed.authors,
          includePatterns: parsed.includePatterns,
          ignorePatterns: parsed.ignorePatterns,
        })
      );
    },
  },
  {
    name: 'smm_evaluate_quality',
    description:
      'Evaluate SonarQube quality signals (ratings, complexity, coverage, duplication) and produce severity-graded recommendations.',
    inputSchema: {
      type: 'object',
      description:
        'SonarQube quality evaluation. No date filters needed — evaluates the latest snapshot.',
      additionalProperties: false,
      properties: {
        project: {
          type: 'string',
          description: 'Optional github_repository project name from smm_config.json.',
        },
      },
    },
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const args = parseMetricsToolArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: args.project,
      });
      return asToolResult(await reader.evaluateQuality());
    },
  },
  {
    name: 'smm_evaluate_architecture',
    description:
      'Evaluate architecture health signals (container count, dependency concentration, orphan nodes, confidence) and produce severity-graded recommendations.',
    inputSchema: buildArchitectureViewInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseArchitectureViewArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
      });
      return asToolResult(await reader.evaluateArchitecture(parsed));
    },
  },
  {
    name: 'smm_list_big_o_files',
    description:
      'List source files with their Big-O complexity classification (O(1), O(log n), O(n), O(n log n), O(n^2), O(n^3+)). Supports search and file pattern filters.',
    inputSchema: buildBigOListInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseBigOFileArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
      });
      return asToolResult(
        await reader.listBigOFiles({
          search: parsed.search,
          ignorePatterns: parsed.ignorePatterns,
          includePatterns: parsed.includePatterns,
          limit: parsed.limit,
        })
      );
    },
  },
  {
    name: 'smm_analyze_big_o_file',
    description:
      'Analyze a specific source file for Big-O complexity, returning line-by-line classifications with reasons.',
    inputSchema: buildBigOAnalyzeInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseBigOAnalyzeArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
      });
      return asToolResult(await reader.analyzeBigOFile(parsed.filePath));
    },
  },
  {
    name: 'smm_health_check',
    description:
      'Generate a health report on dataset freshness, gaps, missing fields, and item counts across all data providers (GitHub, Jira, SonarQube, CodeMaat).',
    inputSchema: buildHealthCheckInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseHealthCheckArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
      });
      return asToolResult(await reader.healthCheck(parsed.providerFilter, parsed.maxGapDays));
    },
  },
  {
    name: 'smm_get_version',
    description: 'Get the Software Metrics Machine version and server name.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    async handler(): Promise<McpToolResult> {
      return asToolResult({
        version: getApplicationVersion(),
        name: 'software-metrics-machine',
      });
    },
  },
  {
    name: 'smm_get_configuration',
    description:
      'Get the redacted project configuration (tokens and secrets are masked) for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('Configuration lookup filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const args = parseMetricsToolArguments(argumentsValue);
      const repository = new ConfigurationRepository(
        process.env,
        args.project,
        new Logger('SmmMcpServer', 'CRITICAL')
      );
      const project = repository.getProjectByName(args.project || '');
      if (!project) {
        throw new Error(`Unknown project: ${args.project || '<default>'}`);
      }
      return asToolResult(redactSecrets(project as unknown as JsonObject));
    },
  },
  {
    name: 'smm_list_change_request_filter_options',
    description:
      'List available change request filter values (authors, labels, commenters) for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('Change request filter options lookup.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { reader } = getReader(argumentsValue);
      return asToolResult(await reader.listChangeRequestFilterOptions());
    },
  },
  {
    name: 'smm_list_pipeline_filter_options',
    description:
      'List available pipeline filter values (workflows, statuses, conclusions, branches, events, jobs) for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('Pipeline filter options lookup.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { reader } = getReader(argumentsValue);
      return asToolResult(await reader.listPipelineFilterOptions());
    },
  },
  {
    name: 'smm_list_code_authors',
    description:
      'List all code authors available in the CodeMaat data for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('Code authors lookup.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { reader } = getReader(argumentsValue);
      return asToolResult(await reader.listCodeAuthors());
    },
  },
  {
    name: 'smm_get_change_request_summary',
    description:
      'Get a detailed change request summary (total, merged, closed, labels, top commenter, themes, first/last/most-commented, time to first comment).',
    inputSchema: buildChangeRequestMetricsInputSchema('Change request summary filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseChangeRequestMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getChangeRequestSummary(parsed));
    },
  },
  {
    name: 'smm_get_change_request_through_time',
    description:
      'Get change requests opened and closed through time, optionally aggregated by day, week, or month.',
    inputSchema: buildChangeRequestMetricsInputSchema('Change request through-time filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseChangeRequestMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getChangeRequestThroughTime(parsed));
    },
  },
  {
    name: 'smm_get_change_request_by_author',
    description:
      'Get change request counts grouped by author, with optional top-N limit and label/author filters.',
    inputSchema: buildChangeRequestMetricsInputSchema('Change request by-author filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseChangeRequestMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getChangeRequestByAuthor(parsed));
    },
  },
  {
    name: 'smm_get_change_request_review_time',
    description:
      'Get change request review time (days) by author with selectable statistical method and outlier handling.',
    inputSchema: buildChangeRequestMetricsInputSchema('Change request review-time filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseChangeRequestMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getChangeRequestReviewTime(parsed));
    },
  },
  {
    name: 'smm_get_change_request_open_time',
    description:
      'Get change request open time (days) aggregated by day/week/month with selectable statistical method.',
    inputSchema: buildChangeRequestMetricsInputSchema('Change request open-time filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseChangeRequestMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getChangeRequestOpenTime(parsed));
    },
  },
  {
    name: 'smm_get_change_request_comments',
    description:
      'Get comments per change request with selectable statistical method (overall or by-period when aggregateBy is set).',
    inputSchema: buildChangeRequestMetricsInputSchema('Change request comments filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseChangeRequestMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getChangeRequestComments(parsed));
    },
  },
  {
    name: 'smm_get_change_request_comments_by_author',
    description: 'Get change request comment counts grouped by author, with optional top-N limit.',
    inputSchema: buildChangeRequestMetricsInputSchema('Change request comments-by-author filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseChangeRequestMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getChangeRequestCommentsByAuthor(parsed));
    },
  },
  {
    name: 'smm_get_change_request_first_comment_time',
    description:
      'Get time to first comment (hours) by author with selectable statistical method and top-N limit.',
    inputSchema: buildChangeRequestMetricsInputSchema('Change request first-comment-time filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseChangeRequestMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getChangeRequestFirstCommentTime(parsed));
    },
  },
  {
    name: 'smm_get_change_request_metrics_by_month',
    description:
      'Get change request metrics (comments, review time, open time) grouped by month, with selectable statistical method.',
    inputSchema: buildChangeRequestMetricsInputSchema('Change request by-month filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseChangeRequestMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getChangeRequestMetricsByMonth(parsed));
    },
  },
  {
    name: 'smm_get_change_request_metrics_by_week',
    description:
      'Get change request metrics (comments, review time, open time) grouped by week, with selectable statistical method.',
    inputSchema: buildChangeRequestMetricsInputSchema('Change request by-week filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseChangeRequestMetricsArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getChangeRequestMetricsByWeek(parsed));
    },
  },
  {
    name: 'smm_get_pipeline_dashboard',
    description:
      'Get the full pipeline dashboard (summary, runs_duration, runs_by, jobs_time, jobs_summary, job_steps_time, jobs_duration_by_workflow) with rich filtering.',
    inputSchema: buildPipelineDashboardInputSchema('Pipeline dashboard filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parsePipelineDashboardArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getPipelineDashboard(parsed));
    },
  },
  {
    name: 'smm_get_code_pairing_index',
    description:
      'Get detailed pairing index (percentage, total/paired commits, top pairs, latest paired commits) for a configured SMM project.',
    inputSchema: buildCodeHistoryInputSchema('Code pairing index filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeHistoryArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodePairingIndex(parsed));
    },
  },
  {
    name: 'smm_get_code_churn',
    description: 'Get code churn metrics (added/deleted/commits per period).',
    inputSchema: buildCodeHistoryInputSchema('Code churn filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeHistoryArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodeChurn(parsed));
    },
  },
  {
    name: 'smm_get_code_churn_history',
    description: 'Get timestamped code churn history entries.',
    inputSchema: buildCodeHistoryInputSchema('Code churn history filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeHistoryArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodeChurnHistory(parsed));
    },
  },
  {
    name: 'smm_get_code_coupling',
    description: 'Get file coupling relationships with optional pattern/top filters.',
    inputSchema: buildCodeEntityInputSchema('Code coupling filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeEntityArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodeCoupling(parsed));
    },
  },
  {
    name: 'smm_get_code_coupling_history',
    description: 'Get timestamped file coupling history entries.',
    inputSchema: buildCodeEntityInputSchema('Code coupling history filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeEntityArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodeCouplingHistory(parsed));
    },
  },
  {
    name: 'smm_get_code_layered_coupling',
    description: 'Get layered file coupling relationships with optional pattern/top filters.',
    inputSchema: buildCodeEntityInputSchema('Code layered coupling filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeEntityArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodeLayeredCoupling(parsed));
    },
  },
  {
    name: 'smm_get_code_layered_coupling_history',
    description: 'Get timestamped layered file coupling history entries.',
    inputSchema: buildCodeEntityInputSchema('Code layered coupling history filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeEntityArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodeLayeredCouplingHistory(parsed));
    },
  },
  {
    name: 'smm_get_code_entity_churn',
    description: 'Get entity-level churn metrics with optional pattern/top filters.',
    inputSchema: buildCodeEntityInputSchema('Code entity churn filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeEntityArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodeEntityChurn(parsed));
    },
  },
  {
    name: 'smm_get_code_entity_churn_history',
    description: 'Get timestamped entity-level churn history entries.',
    inputSchema: buildCodeEntityInputSchema('Code entity churn history filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeEntityArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodeEntityChurnHistory(parsed));
    },
  },
  {
    name: 'smm_get_code_entity_effort',
    description: 'Get entity-level effort metrics with optional pattern/top filters.',
    inputSchema: buildCodeEntityInputSchema('Code entity effort filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeEntityArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodeEntityEffort(parsed));
    },
  },
  {
    name: 'smm_get_code_entity_effort_history',
    description: 'Get timestamped entity-level effort history entries.',
    inputSchema: buildCodeEntityInputSchema('Code entity effort history filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeEntityArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodeEntityEffortHistory(parsed));
    },
  },
  {
    name: 'smm_get_code_entity_ownership',
    description: 'Get entity ownership by developers with optional pattern/authors/top filters.',
    inputSchema: buildCodeEntityInputSchema('Code entity ownership filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeEntityArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodeEntityOwnership(parsed));
    },
  },
  {
    name: 'smm_get_code_entity_ownership_history',
    description: 'Get timestamped entity ownership history entries.',
    inputSchema: buildCodeEntityInputSchema('Code entity ownership history filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseCodeEntityArguments(argumentsValue);
      const reader = createMcpMetricsReader({
        project: parsed.project,
        timezone: parsed.timezone,
      });
      return asToolResult(await reader.getCodeEntityOwnershipHistory(parsed));
    },
  },
  {
    name: 'smm_get_sonarqube_component_tree',
    description:
      'Get the SonarQube component tree with metrics, optional component/depth/metrics/pattern filters.',
    inputSchema: buildSonarqubeComponentTreeInputSchema('SonarQube component tree filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseSonarqubeComponentTreeArguments(argumentsValue);
      const reader = createMcpMetricsReader({ project: parsed.project });
      return asToolResult(await reader.getSonarqubeComponentTree(parsed));
    },
  },
  {
    name: 'smm_get_sonarqube_component_tree_history',
    description: 'Get timestamped SonarQube component tree history entries.',
    inputSchema: buildSonarqubeComponentTreeInputSchema(
      'SonarQube component tree history filters.'
    ),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseSonarqubeComponentTreeArguments(argumentsValue);
      const reader = createMcpMetricsReader({ project: parsed.project });
      return asToolResult(await reader.getSonarqubeComponentTreeHistory(parsed));
    },
  },
  {
    name: 'smm_get_sonarqube_measurements',
    description: 'Get all SonarQube measurements (latest snapshot) for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('SonarQube measurements lookup.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const args = parseMetricsToolArguments(argumentsValue);
      const reader = createMcpMetricsReader({ project: args.project });
      return asToolResult(await reader.getSonarqubeMeasurements());
    },
  },
  {
    name: 'smm_get_sonarqube_measurements_history',
    description:
      'Get timestamped SonarQube measurement history entries for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('SonarQube measurements history lookup.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const args = parseMetricsToolArguments(argumentsValue);
      const reader = createMcpMetricsReader({ project: args.project });
      return asToolResult(await reader.getSonarqubeMeasurementsHistory());
    },
  },
  {
    name: 'smm_get_architecture_summary',
    description:
      'Get architecture snapshot metadata (snapshot id, generated at, branch, commit count, view counts) for the latest or a specific snapshot.',
    inputSchema: buildArchitectureViewInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseArchitectureViewArguments(argumentsValue);
      const reader = createMcpMetricsReader({ project: parsed.project });
      return asToolResult(await reader.getArchitectureSummary(parsed.snapshotId));
    },
  },
  {
    name: 'smm_export_architecture_view',
    description:
      'Export an architecture view (context, container, component, code) as JSON plus a Mermaid diagram string.',
    inputSchema: buildArchitectureViewInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseArchitectureViewArguments(argumentsValue);
      const reader = createMcpMetricsReader({ project: parsed.project });
      return asToolResult(await reader.exportArchitectureView(parsed));
    },
  },
  {
    name: 'smm_list_saved_filters',
    description:
      'List saved filters and reports (read-only) for a configured SMM project, including filter id, name, section, repository, and createdAt. Optionally filter by dashboard section.',
    inputSchema: buildSavedFilterListInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseSavedFilterListArguments(argumentsValue);
      const reader = createMcpMetricsReader({ project: parsed.project });
      return asToolResult(await reader.listSavedFilters(parsed));
    },
  },
  {
    name: 'smm_get_saved_filter',
    description:
      'Look up a single saved filter by name or id for a configured SMM project. Returns the full filter entry including section, filters, and repository.',
    inputSchema: buildSavedFilterGetInputSchema(),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const parsed = parseSavedFilterGetArguments(argumentsValue);
      const reader = createMcpMetricsReader({ project: parsed.project });
      return asToolResult(await reader.getSavedFilter(parsed));
    },
  },
];

export function findTool(name: string): RegisteredTool | undefined {
  return tools.find((tool) => tool.name === name);
}
