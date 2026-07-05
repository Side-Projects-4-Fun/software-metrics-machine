import { ConfigurationRepository } from '@smmachine/core';
import { Logger } from '@smmachine/utils';
import { createMcpMetricsReader } from './metrics-reader';
import type { JsonObject, McpToolDefinition, McpToolResult } from './mcp-types';
import { buildMetricsInputSchema, parseMetricsToolArguments } from './validation';

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
    description: 'List configured Software Metrics Machine projects.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    async handler() {
      const repository = new ConfigurationRepository(
        process.env,
        undefined,
        new Logger('SmmMcpServer')
      );
      const projects = repository.getAllProjects().map((project) => ({
        github_repository: project.github_repository,
        git_provider: project.git_provider,
      }));

      return asToolResult({ projects });
    },
  },
  {
    name: 'smm_get_pr_metrics',
    description: 'Get pull request metrics for a configured SMM project.',
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
    description: 'Get deployment and pipeline metrics for a configured SMM project.',
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
    description: 'Get code churn, file coupling, and pairing metrics for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('Code metric filters.'),
    async handler(argumentsValue) {
      const { args, reader } = getReader(argumentsValue);
      return asToolResult(
        await reader.getCodeMetrics({
          startDate: args.startDate,
          endDate: args.endDate,
        })
      );
    },
  },
  {
    name: 'smm_get_issue_metrics',
    description: 'Get Jira issue metrics for a configured SMM project.',
    inputSchema: buildMetricsInputSchema('Issue metric filters.'),
    async handler(argumentsValue) {
      const { args, reader } = getReader(argumentsValue);
      return asToolResult(
        await reader.getIssueMetrics({
          startDate: args.startDate,
          endDate: args.endDate,
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
    name: 'smm_get_full_report',
    description: 'Get a complete metrics report for a configured SMM project.',
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
