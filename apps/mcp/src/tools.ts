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
  buildCodeMetricsInputSchema,
  buildDoraMetricsInputSchema,
  buildEngineeringHealthInputSchema,
  buildEvaluationInputSchema,
  buildHealthCheckInputSchema,
  buildIssueMetricsInputSchema,
  buildMetricsInputSchema,
  listEngineeringHealthMetricCatalog,
  parseArchitectureViewArguments,
  parseBigOAnalyzeArguments,
  parseBigOFileArguments,
  parseCodeMetricsArguments,
  parseDoraMetricsArguments,
  parseEngineeringHealthArguments,
  parseHealthCheckArguments,
  parseIssueMetricsArguments,
  parseMetricsToolArguments,
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
    name: 'smm_get_pr_metrics',
    description:
      'Get pull request metrics (throughput, review time, authors, outliers) for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('Pull request metric filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { args, reader } = getReader(argumentsValue);
      return asToolResult(
        await reader.getPRMetrics({
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
      'Get a complete metrics report (pull requests, deployment, code, issues, quality) for a configured SMM project.',
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
    name: 'smm_evaluate_prs',
    description:
      'Evaluate pull request health signals (review bottlenecks, throughput, collaboration) and produce severity-graded recommendations.',
    inputSchema: buildEvaluationInputSchema('PR evaluation filters.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { args, reader } = getReader(argumentsValue);
      return asToolResult(
        await reader.evaluatePRs({
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
    name: 'smm_list_pr_filter_options',
    description:
      'List available pull request filter values (authors, labels, commenters) for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('PR filter options lookup.'),
    async handler(argumentsValue: unknown): Promise<McpToolResult> {
      const { reader } = getReader(argumentsValue);
      return asToolResult(await reader.listPRFilterOptions());
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
];

export function findTool(name: string): RegisteredTool | undefined {
  return tools.find((tool) => tool.name === name);
}
