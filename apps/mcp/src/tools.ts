import { ConfigurationRepository } from '@smmachine/core';
import { Logger } from '@smmachine/utils';
import { createMcpMetricsReader } from './metrics-reader';
import type { JsonObject, McpToolDefinition, McpToolResult } from './mcp-types';
import {
  buildArchitectureViewInputSchema,
  buildCodeMetricsInputSchema,
  buildDoraMetricsInputSchema,
  buildEngineeringHealthInputSchema,
  buildIssueMetricsInputSchema,
  buildMetricsInputSchema,
  listEngineeringHealthMetricCatalog,
  parseArchitectureViewArguments,
  parseCodeMetricsArguments,
  parseDoraMetricsArguments,
  parseEngineeringHealthArguments,
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

function getReader(argumentsValue: unknown) {
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
    async handler() {
      const repository = new ConfigurationRepository(
        process.env,
        undefined,
        new Logger('SmmMcpServer', 'CRITICAL')
      );
      const projects = repository.getAllProjects().map((project) => ({
        github_repository: project.github_repository,
        git_provider: project.git_provider,
      }));

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
    async handler() {
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
    async handler(argumentsValue) {
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
    async handler(argumentsValue) {
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
    async handler(argumentsValue) {
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
    async handler(argumentsValue) {
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
    async handler(argumentsValue) {
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
    async handler(argumentsValue) {
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
    async handler(argumentsValue) {
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
    async handler(argumentsValue) {
      const { reader } = getReader(argumentsValue);
      return asToolResult(await reader.listArchitectureSnapshots());
    },
  },
  {
    name: 'smm_get_architecture_view',
    description:
      'Read a C4 architecture view (context, container, component, or code) for a configured SMM project, with optional file pattern filters.',
    inputSchema: buildArchitectureViewInputSchema(),
    async handler(argumentsValue) {
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
    async handler(argumentsValue) {
      const { args, reader } = getReader(argumentsValue);
      return asToolResult(
        await reader.getFullReport({
          startDate: args.startDate,
          endDate: args.endDate,
        })
      );
    },
  },
];

export function findTool(name: string): RegisteredTool | undefined {
  return tools.find((tool) => tool.name === name);
}
