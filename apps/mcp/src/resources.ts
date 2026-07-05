import { ConfigurationRepository } from '@smmachine/core';
import { Logger } from '@smmachine/utils';
import { createMcpMetricsReader } from './metrics-reader';
import type { JsonValue, McpResourceDefinition } from './mcp-types';
import { redactSecrets } from './redaction';

export type ResourceReadResult = {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
};

function getConfigurationRepository(): ConfigurationRepository {
  return new ConfigurationRepository(process.env, undefined, new Logger('SmmMcpServer'));
}

function encodeProject(project: string): string {
  return encodeURIComponent(project);
}

function decodeProject(project: string): string {
  return decodeURIComponent(project);
}

function jsonResource(uri: string, value: JsonValue): ResourceReadResult {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function listResources(): McpResourceDefinition[] {
  const repository = getConfigurationRepository();
  const projects = repository.getAllProjectNames();

  return [
    {
      uri: 'smm://projects',
      name: 'SMM projects',
      description: 'Configured Software Metrics Machine projects.',
      mimeType: 'application/json',
    },
    ...projects.flatMap((project) => [
      {
        uri: `smm://project/${encodeProject(project)}/configuration`,
        name: `${project} configuration`,
        description: 'Redacted project configuration.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/report`,
        name: `${project} report`,
        description: 'Complete metrics report for the project.',
        mimeType: 'application/json',
      },
    ]),
  ];
}

export async function readResource(uri: string): Promise<ResourceReadResult> {
  const repository = getConfigurationRepository();

  if (uri === 'smm://projects') {
    return jsonResource(uri, {
      projects: repository.getAllProjects().map((project) => ({
        github_repository: project.github_repository,
        git_provider: project.git_provider,
      })),
    });
  }

  const match = uri.match(/^smm:\/\/project\/([^/]+)\/(configuration|report)$/);
  if (!match) {
    throw new Error(`Unknown MCP resource: ${uri}`);
  }

  const projectName = decodeProject(match[1]);
  const resourceType = match[2];
  const project = repository.getProjectByName(projectName);
  if (!project) {
    throw new Error(`Unknown project: ${projectName}`);
  }

  if (resourceType === 'configuration') {
    return jsonResource(uri, redactSecrets(project as JsonValue));
  }

  const reader = createMcpMetricsReader({ project: projectName });

  return jsonResource(uri, (await reader.getFullReport()) as JsonValue);
}
